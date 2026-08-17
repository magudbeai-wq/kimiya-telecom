import { getDatabase, runImmediateTransaction } from '../db/db';
import { BusinessSession, AuthSessionUser } from '../types';
import { generateTransactionId, getAddisAbabaBusinessDate } from '../utils/id-generator';
import { AuditService } from './audit';
import { NotificationService } from './notifications';

export class BusinessSessionService {
  /**
   * Get the active (OPEN) business session for a branch
   */
  static getActiveSession(branchId: string): BusinessSession | null {
    const db = getDatabase();
    const row = db
      .prepare(`
        SELECT 
          s.*,
          b.name as branch_name,
          b.code as branch_code,
          u1.full_name as opened_by_user_name,
          u2.full_name as closed_by_user_name
        FROM business_sessions s
        JOIN branches b ON s.branch_id = b.id
        LEFT JOIN users u1 ON s.opened_by_user_id = u1.id
        LEFT JOIN users u2 ON s.closed_by_user_id = u2.id
        WHERE s.branch_id = ? AND s.status = 'OPEN'
        ORDER BY s.opened_at DESC
        LIMIT 1
      `)
      .get(branchId) as BusinessSession | undefined;

    return row || null;
  }

  /**
   * Open a new business session for a branch
   */
  static openSession(params: {
    branchId: string;
    openingNotes?: string | null;
    actor: AuthSessionUser;
  }): BusinessSession {
    return runImmediateTransaction((dbInstance) => {
      // 1. Verify branch exists and is active
      const branch = dbInstance
        .prepare("SELECT * FROM branches WHERE id = ? AND status = 'ACTIVE'")
        .get(params.branchId) as { id: string; name: string; code: string } | undefined;

      if (!branch) {
        throw new Error('Branch not found or is currently disabled.');
      }

      // 2. Check if an open session already exists (Strict Duplicate Refusal)
      const existing = dbInstance
        .prepare("SELECT * FROM business_sessions WHERE branch_id = ? AND status = 'OPEN'")
        .get(params.branchId) as BusinessSession | undefined;

      if (existing) {
        throw new Error(
          `Duplicate Refused: An active OPEN business session (#${existing.id}) is already running for branch '${branch.name}'. You cannot open multiple concurrent sessions.`
        );
      }

      // Check if a business session has already been recorded for today for this branch
      const businessDate = getAddisAbabaBusinessDate();
      const existingForToday = dbInstance
        .prepare('SELECT * FROM business_sessions WHERE branch_id = ? AND business_date = ?')
        .get(params.branchId, businessDate) as BusinessSession | undefined;

      if (existingForToday) {
        throw new Error(
          `Duplicate Refused: A business session (#${existingForToday.id}) has already been created for branch '${branch.name}' on today (${businessDate}). Only one session per calendar day is permitted.`
        );
      }

      // 3. Generate Session ID e.g. SESSION-20260817-KAR-0001
      const sessionId = generateTransactionId('SESSION', branch.code);

      // 4. Insert Session Record
      dbInstance
        .prepare(`
          INSERT INTO business_sessions (
            id, branch_id, business_date, status, opened_by_user_id,
            opened_at, opening_notes
          ) VALUES (
            ?, ?, ?, 'OPEN', ?,
            datetime('now', '+3 hours'), ?
          )
        `)
        .run(
          sessionId,
          params.branchId,
          businessDate,
          params.actor.id,
          params.openingNotes || null
        );

      // 5. Notify Finance
      NotificationService.create({
        recipientRole: 'FINANCE',
        title: `Business Day Opened: ${branch.name}`,
        message: `${params.actor.full_name} opened business session #${sessionId} for ${branch.name} on ${businessDate}.`,
        type: 'SESSION_OPENED',
        referenceId: sessionId,
      });

      // 6. Audit Log
      AuditService.log({
        action: 'BUSINESS_SESSION_OPENED',
        entityType: 'BUSINESS_SESSION',
        entityId: sessionId,
        actorUserId: params.actor.id,
        actorRole: params.actor.role,
        actorBranchId: params.branchId,
        newValues: {
          sessionId,
          branchId: params.branchId,
          businessDate,
          openedBy: params.actor.id,
        },
      });

      return this.getSessionById(sessionId)!;
    });
  }

  /**
   * Close a business session and aggregate totals
   */
  static closeSession(params: {
    sessionId: string;
    closingNotes?: string | null;
    isOverride?: boolean;
    actor: AuthSessionUser;
  }): BusinessSession {
    return runImmediateTransaction((dbInstance) => {
      const session = dbInstance
        .prepare('SELECT * FROM business_sessions WHERE id = ?')
        .get(params.sessionId) as BusinessSession | undefined;

      if (!session) {
        throw new Error(`Business session #${params.sessionId} not found.`);
      }

      if (session.status === 'CLOSED') {
        throw new Error(
          `Duplicate Refused: Business session #${params.sessionId} is already CLOSED (closed at ${session.closed_at}). Duplicate close operations are strictly rejected.`
        );
      }

      // Branch authorization check
      if (params.actor.role === 'SHOP_USER' && params.actor.branch_id !== session.branch_id) {
        throw new Error('Unauthorized: You can only close sessions for your assigned branch.');
      }

      // Calculate totals for this session
      const simSalesRow = dbInstance
        .prepare("SELECT COALESCE(SUM(quantity), 0) as total FROM sales WHERE session_id = ? AND product_type = 'SIM'")
        .get(params.sessionId) as { total: number };

      const scratchSalesRow = dbInstance
        .prepare("SELECT COALESCE(SUM(quantity), 0) as total FROM sales WHERE session_id = ? AND product_type = 'SCRATCH_CARD'")
        .get(params.sessionId) as { total: number };

      const revenueRow = dbInstance
        .prepare('SELECT COALESCE(SUM(total_amount), 0) as total FROM sales WHERE session_id = ?')
        .get(params.sessionId) as { total: number };

      const expensesRow = dbInstance
        .prepare('SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE branch_id = ? AND date = ?')
        .get(session.branch_id, session.business_date) as { total: number };

      const totalSimSold = simSalesRow.total;
      const totalScratchSold = scratchSalesRow.total;
      const totalRevenue = revenueRow.total;
      const totalExpenses = expensesRow.total;

      const overrideBy = params.isOverride ? params.actor.id : null;

      dbInstance
        .prepare(`
          UPDATE business_sessions
          SET status = 'CLOSED',
              closed_by_user_id = ?,
              closed_at = datetime('now', '+3 hours'),
              closing_notes = ?,
              total_sim_sold = ?,
              total_scratch_sold = ?,
              total_revenue = ?,
              total_expenses = ?,
              closing_override_by = ?
          WHERE id = ?
        `)
        .run(
          params.actor.id,
          params.closingNotes || null,
          totalSimSold,
          totalScratchSold,
          totalRevenue,
          totalExpenses,
          overrideBy,
          params.sessionId
        );

      const branch = dbInstance
        .prepare('SELECT name FROM branches WHERE id = ?')
        .get(session.branch_id) as { name: string };

      // Notify Finance
      NotificationService.create({
        recipientRole: 'FINANCE',
        title: `Business Day Closed: ${branch.name}`,
        message: `${params.actor.full_name} closed session #${params.sessionId} for ${branch.name}. Revenue: ${totalRevenue.toLocaleString()} ETB (SIM: ${totalSimSold}, Scratch: ${totalScratchSold}).`,
        type: 'SESSION_CLOSED',
        referenceId: params.sessionId,
      });

      // Audit Log
      AuditService.log({
        action: params.isOverride ? 'BUSINESS_SESSION_CLOSED_OVERRIDE' : 'BUSINESS_SESSION_CLOSED',
        entityType: 'BUSINESS_SESSION',
        entityId: params.sessionId,
        actorUserId: params.actor.id,
        actorRole: params.actor.role,
        actorBranchId: session.branch_id,
        newValues: {
          sessionId: params.sessionId,
          status: 'CLOSED',
          totalSimSold,
          totalScratchSold,
          totalRevenue,
          totalExpenses,
          isOverride: params.isOverride,
        },
      });

      return this.getSessionById(params.sessionId)!;
    });
  }

  /**
   * Get single session by ID
   */
  static getSessionById(id: string): BusinessSession | null {
    const db = getDatabase();
    const row = db
      .prepare(`
        SELECT 
          s.*,
          b.name as branch_name,
          b.code as branch_code,
          u1.full_name as opened_by_user_name,
          u2.full_name as closed_by_user_name
        FROM business_sessions s
        JOIN branches b ON s.branch_id = b.id
        LEFT JOIN users u1 ON s.opened_by_user_id = u1.id
        LEFT JOIN users u2 ON s.closed_by_user_id = u2.id
        WHERE s.id = ?
      `)
      .get(id) as BusinessSession | undefined;

    return row || null;
  }

  /**
   * Query sessions history
   */
  static getSessions(filters?: {
    branchId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): { sessions: BusinessSession[]; total: number } {
    const db = getDatabase();
    const conditions: string[] = ['1=1'];
    const params: (string | number)[] = [];

    if (filters?.branchId) {
      conditions.push('s.branch_id = ?');
      params.push(filters.branchId);
    }
    if (filters?.status) {
      conditions.push('s.status = ?');
      params.push(filters.status);
    }
    if (filters?.startDate) {
      conditions.push('s.business_date >= ?');
      params.push(filters.startDate);
    }
    if (filters?.endDate) {
      conditions.push('s.business_date <= ?');
      params.push(filters.endDate);
    }

    const whereClause = conditions.join(' AND ');

    const countRow = db
      .prepare(`SELECT COUNT(*) as total FROM business_sessions s WHERE ${whereClause}`)
      .get(...params) as { total: number };

    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;

    const queryParams = [...params, limit, offset];
    const sessions = db
      .prepare(`
        SELECT 
          s.*,
          b.name as branch_name,
          b.code as branch_code,
          u1.full_name as opened_by_user_name,
          u2.full_name as closed_by_user_name
        FROM business_sessions s
        JOIN branches b ON s.branch_id = b.id
        LEFT JOIN users u1 ON s.opened_by_user_id = u1.id
        LEFT JOIN users u2 ON s.closed_by_user_id = u2.id
        WHERE ${whereClause}
        ORDER BY s.opened_at DESC
        LIMIT ? OFFSET ?
      `)
      .all(...queryParams) as BusinessSession[];

    return {
      sessions,
      total: countRow?.total || 0,
    };
  }
}
