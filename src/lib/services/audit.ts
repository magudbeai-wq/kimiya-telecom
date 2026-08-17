import { getDatabase } from '../db/db';
import { AuditLog } from '../types';
import crypto from 'crypto';

export class AuditService {
  /**
   * Append-only audit logger.
   * Every important business, security, financial, and inventory action MUST call this.
   */
  static log(params: {
    action: string;
    entityType: string;
    entityId: string;
    actorUserId: string;
    actorRole: string;
    actorBranchId?: string | null;
    ipAddress?: string | null;
    oldValues?: Record<string, unknown> | null;
    newValues?: Record<string, unknown> | null;
  }): string {
    const db = getDatabase();
    const id = `AUDIT-${crypto.randomUUID()}`;

    const stmt = db.prepare(`
      INSERT INTO audit_logs (
        id, action, entity_type, entity_id, actor_user_id,
        actor_role, actor_branch_id, ip_address, old_values,
        new_values, created_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, datetime('now', '+3 hours')
      )
    `);

    stmt.run(
      id,
      params.action,
      params.entityType,
      params.entityId,
      params.actorUserId,
      params.actorRole,
      params.actorBranchId || null,
      params.ipAddress || null,
      params.oldValues ? JSON.stringify(params.oldValues) : null,
      params.newValues ? JSON.stringify(params.newValues) : null
    );

    return id;
  }

  /**
   * Query audit logs with pagination and filters
   */
  static getLogs(filters?: {
    entityType?: string;
    entityId?: string;
    action?: string;
    actorUserId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): { logs: AuditLog[]; total: number } {
    const db = getDatabase();
    const conditions: string[] = ['1=1'];
    const params: (string | number)[] = [];

    if (filters?.entityType) {
      conditions.push('a.entity_type = ?');
      params.push(filters.entityType);
    }
    if (filters?.entityId) {
      conditions.push('a.entity_id = ?');
      params.push(filters.entityId);
    }
    if (filters?.action) {
      conditions.push('a.action = ?');
      params.push(filters.action);
    }
    if (filters?.actorUserId) {
      conditions.push('a.actor_user_id = ?');
      params.push(filters.actorUserId);
    }
    if (filters?.startDate) {
      conditions.push('a.created_at >= ?');
      params.push(filters.startDate);
    }
    if (filters?.endDate) {
      conditions.push('a.created_at <= ?');
      params.push(`${filters.endDate} 23:59:59`);
    }

    const whereClause = conditions.join(' AND ');

    const countRow = db
      .prepare(`SELECT COUNT(*) as total FROM audit_logs a WHERE ${whereClause}`)
      .get(...params) as { total: number };

    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;

    const queryParams = [...params, limit, offset];
    const logs = db
      .prepare(`
        SELECT 
          a.*,
          u.full_name as actor_user_name,
          b.name as actor_branch_name
        FROM audit_logs a
        LEFT JOIN users u ON a.actor_user_id = u.id
        LEFT JOIN branches b ON a.actor_branch_id = b.id
        WHERE ${whereClause}
        ORDER BY a.created_at DESC
        LIMIT ? OFFSET ?
      `)
      .all(...queryParams) as AuditLog[];

    return {
      logs,
      total: countRow?.total || 0,
    };
  }
}
