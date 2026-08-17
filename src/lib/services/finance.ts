import { getDatabase, runImmediateTransaction } from '../db/db';
import { Expense, ExpenseCategory, AuthSessionUser, ProductType } from '../types';
import { generateTransactionId } from '../utils/id-generator';
import { AuditService } from './audit';
import crypto from 'crypto';

export class FinanceService {
  /**
   * Create an expense entry
   */
  static addExpense(params: {
    branchId?: string | null;
    category: ExpenseCategory;
    amount: number;
    description: string;
    date: string; // YYYY-MM-DD
    notes?: string | null;
    actor: AuthSessionUser;
  }): Expense {
    if (params.amount <= 0) {
      throw new Error('Expense amount must be greater than zero.');
    }
    if (!params.description || params.description.trim().length === 0) {
      throw new Error('Expense description is required.');
    }

    return runImmediateTransaction((dbInstance) => {
      const expenseId = generateTransactionId('EXP');

      dbInstance
        .prepare(`
          INSERT INTO expenses (
            id, branch_id, category, amount, description,
            created_by_user_id, date, created_at, notes
          ) VALUES (
            ?, ?, ?, ?, ?,
            ?, ?, datetime('now', '+3 hours'), ?
          )
        `)
        .run(
          expenseId,
          params.branchId || null,
          params.category,
          params.amount,
          params.description,
          params.actor.id,
          params.date,
          params.notes || null
        );

      AuditService.log({
        action: 'EXPENSE_RECORDED',
        entityType: 'EXPENSE',
        entityId: expenseId,
        actorUserId: params.actor.id,
        actorRole: params.actor.role,
        actorBranchId: params.branchId || null,
        newValues: {
          expenseId,
          branchId: params.branchId,
          category: params.category,
          amount: params.amount,
          description: params.description,
          date: params.date,
        },
      });

      return this.getExpenseById(expenseId)!;
    });
  }

  /**
   * Get single expense by ID
   */
  static getExpenseById(id: string): Expense | null {
    const db = getDatabase();
    const row = db
      .prepare(`
        SELECT 
          e.*,
          b.name as branch_name,
          b.code as branch_code,
          u.full_name as created_by_user_name
        FROM expenses e
        LEFT JOIN branches b ON e.branch_id = b.id
        LEFT JOIN users u ON e.created_by_user_id = u.id
        WHERE e.id = ?
      `)
      .get(id) as Expense | undefined;

    return row || null;
  }

  /**
   * Get expenses with filters
   */
  static getExpenses(filters?: {
    branchId?: string;
    category?: ExpenseCategory;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): { expenses: Expense[]; total: number; totalAmount: number } {
    const db = getDatabase();
    const conditions: string[] = ['1=1'];
    const params: (string | number)[] = [];

    if (filters?.branchId) {
      conditions.push('e.branch_id = ?');
      params.push(filters.branchId);
    }
    if (filters?.category) {
      conditions.push('e.category = ?');
      params.push(filters.category);
    }
    if (filters?.startDate) {
      conditions.push('e.date >= ?');
      params.push(filters.startDate);
    }
    if (filters?.endDate) {
      conditions.push('e.date <= ?');
      params.push(filters.endDate);
    }

    const whereClause = conditions.join(' AND ');

    const summaryRow = db
      .prepare(`
        SELECT 
          COUNT(*) as total,
          COALESCE(SUM(amount), 0) as totalAmount
        FROM expenses e 
        WHERE ${whereClause}
      `)
      .get(...params) as { total: number; totalAmount: number };

    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;

    const queryParams = [...params, limit, offset];
    const expenses = db
      .prepare(`
        SELECT 
          e.*,
          b.name as branch_name,
          b.code as branch_code,
          u.full_name as created_by_user_name
        FROM expenses e
        LEFT JOIN branches b ON e.branch_id = b.id
        LEFT JOIN users u ON e.created_by_user_id = u.id
        WHERE ${whereClause}
        ORDER BY e.date DESC, e.created_at DESC
        LIMIT ? OFFSET ?
      `)
      .all(...queryParams) as Expense[];

    return {
      expenses,
      total: summaryRow?.total || 0,
      totalAmount: summaryRow?.totalAmount || 0,
    };
  }

  /**
   * Calculate Financial Profit and Loss Statement for a given period
   * Formula: Net Profit = Revenue - COGS - Expenses
   */
  static getFinancialStatement(filters?: {
    branchId?: string;
    startDate?: string;
    endDate?: string;
  }): {
    revenue: number;
    costOfGoodsSold: number;
    grossProfit: number;
    expenses: number;
    netProfit: number;
    profitMarginPercent: number;
    simRevenue: number;
    scratchRevenue: number;
    simCost: number;
    scratchCost: number;
    expensesByCategory: { category: string; amount: number }[];
  } {
    const db = getDatabase();

    // Sales metrics
    const salesConditions: string[] = ['1=1'];
    const salesParams: string[] = [];

    if (filters?.branchId) {
      salesConditions.push('s.branch_id = ?');
      salesParams.push(filters.branchId);
    }
    if (filters?.startDate) {
      salesConditions.push('s.created_at >= ?');
      salesParams.push(filters.startDate);
    }
    if (filters?.endDate) {
      salesConditions.push('s.created_at <= ?');
      salesParams.push(`${filters.endDate} 23:59:59`);
    }

    const salesWhere = salesConditions.join(' AND ');

    const salesMetrics = db
      .prepare(`
        SELECT 
          COALESCE(SUM(total_amount), 0) as revenue,
          COALESCE(SUM(total_cost), 0) as costOfGoodsSold,
          COALESCE(SUM(CASE WHEN product_type = 'SIM' THEN total_amount ELSE 0 END), 0) as simRevenue,
          COALESCE(SUM(CASE WHEN product_type = 'SCRATCH_CARD' THEN total_amount ELSE 0 END), 0) as scratchRevenue,
          COALESCE(SUM(CASE WHEN product_type = 'SIM' THEN total_cost ELSE 0 END), 0) as simCost,
          COALESCE(SUM(CASE WHEN product_type = 'SCRATCH_CARD' THEN total_cost ELSE 0 END), 0) as scratchCost
        FROM sales s
        WHERE ${salesWhere}
      `)
      .get(...salesParams) as {
      revenue: number;
      costOfGoodsSold: number;
      simRevenue: number;
      scratchRevenue: number;
      simCost: number;
      scratchCost: number;
    };

    // Expense metrics
    const expConditions: string[] = ['1=1'];
    const expParams: string[] = [];

    if (filters?.branchId) {
      expConditions.push('e.branch_id = ?');
      expParams.push(filters.branchId);
    }
    if (filters?.startDate) {
      expConditions.push('e.date >= ?');
      expParams.push(filters.startDate);
    }
    if (filters?.endDate) {
      expConditions.push('e.date <= ?');
      expParams.push(filters.endDate);
    }

    const expWhere = expConditions.join(' AND ');

    const totalExpRow = db
      .prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM expenses e WHERE ${expWhere}`)
      .get(...expParams) as { total: number };

    const expensesByCategory = db
      .prepare(`
        SELECT category, COALESCE(SUM(amount), 0) as amount
        FROM expenses e
        WHERE ${expWhere}
        GROUP BY category
        ORDER BY amount DESC
      `)
      .all(...expParams) as { category: string; amount: number }[];

    const revenue = salesMetrics?.revenue || 0;
    const costOfGoodsSold = salesMetrics?.costOfGoodsSold || 0;
    const grossProfit = revenue - costOfGoodsSold;
    const expenses = totalExpRow?.total || 0;
    const netProfit = grossProfit - expenses;
    const profitMarginPercent = revenue > 0 ? (netProfit / revenue) * 100 : 0;

    return {
      revenue,
      costOfGoodsSold,
      grossProfit,
      expenses,
      netProfit,
      profitMarginPercent: Number(profitMarginPercent.toFixed(2)),
      simRevenue: salesMetrics?.simRevenue || 0,
      scratchRevenue: salesMetrics?.scratchRevenue || 0,
      simCost: salesMetrics?.simCost || 0,
      scratchCost: salesMetrics?.scratchCost || 0,
      expensesByCategory,
    };
  }

  /**
   * Perform Stock Reconciliation adjustment (Requires authorization, audits, and creates stock ledger entry)
   */
  static reconcileStock(params: {
    locationType: 'CENTRAL_STORE' | 'BRANCH';
    branchId?: string | null;
    productType: ProductType;
    denominationId?: string | null;
    physicalCount: number;
    reason: string;
    actor: AuthSessionUser;
  }): { recordedStock: number; physicalCount: number; difference: number } {
    if (!params.reason || params.reason.trim().length === 0) {
      throw new Error('Reconciliation reason is mandatory.');
    }

    return runImmediateTransaction((dbInstance) => {
      let recordedStock = 0;
      let stockRowId = '';

      if (params.locationType === 'CENTRAL_STORE') {
        const row = dbInstance
          .prepare(
            'SELECT * FROM central_stock WHERE product_type = ? AND (denomination_id = ? OR (denomination_id IS NULL AND ? IS NULL))'
          )
          .get(params.productType, params.denominationId || null, params.denominationId || null) as any;
        if (!row) throw new Error('Central stock item not found.');
        recordedStock = row.quantity;
        stockRowId = row.id;

        dbInstance
          .prepare("UPDATE central_stock SET quantity = ?, updated_at = datetime('now', '+3 hours') WHERE id = ?")
          .run(params.physicalCount, stockRowId);
      } else {
        if (!params.branchId) throw new Error('Branch ID is required for branch stock reconciliation.');
        const row = dbInstance
          .prepare(
            'SELECT * FROM branch_stock WHERE branch_id = ? AND product_type = ? AND (denomination_id = ? OR (denomination_id IS NULL AND ? IS NULL))'
          )
          .get(
            params.branchId,
            params.productType,
            params.denominationId || null,
            params.denominationId || null
          ) as any;
        if (!row) throw new Error('Branch stock item not found.');
        recordedStock = row.quantity;
        stockRowId = row.id;

        dbInstance
          .prepare("UPDATE branch_stock SET quantity = ?, updated_at = datetime('now', '+3 hours') WHERE id = ?")
          .run(params.physicalCount, stockRowId);
      }

      const difference = params.physicalCount - recordedStock;
      const transactionId = `RECON-${crypto.randomUUID()}`;

      // Write to Stock Ledger
      const ledgerId = `LEDGER-${crypto.randomUUID()}`;
      dbInstance
        .prepare(`
          INSERT INTO stock_ledger (
            id, transaction_id, product_type, denomination_id, movement_type,
            source_type, source_id, destination_type, destination_id,
            previous_quantity, change_quantity, new_quantity, user_id, notes, created_at
          ) VALUES (
            ?, ?, ?, ?, 'CORRECTION',
            ?, ?, ?, ?,
            ?, ?, ?, ?, ?, datetime('now', '+3 hours')
          )
        `)
        .run(
          ledgerId,
          transactionId,
          params.productType,
          params.denominationId || null,
          params.locationType,
          params.branchId || 'CENTRAL_STORE',
          params.locationType,
          params.branchId || 'CENTRAL_STORE',
          recordedStock,
          difference,
          params.physicalCount,
          params.actor.id,
          `Stock Reconciliation Adjustment: ${params.reason} (Variance: ${difference > 0 ? '+' : ''}${difference})`
        );

      // Audit log
      AuditService.log({
        action: 'STOCK_RECONCILIATION_ADJUSTMENT',
        entityType: 'INVENTORY',
        entityId: stockRowId,
        actorUserId: params.actor.id,
        actorRole: params.actor.role,
        actorBranchId: params.branchId || null,
        newValues: {
          locationType: params.locationType,
          branchId: params.branchId,
          productType: params.productType,
          denominationId: params.denominationId,
          recordedStock,
          physicalCount: params.physicalCount,
          difference,
          reason: params.reason,
        },
      });

      return {
        recordedStock,
        physicalCount: params.physicalCount,
        difference,
      };
    });
  }
}
