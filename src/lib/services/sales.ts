import { getDatabase, runImmediateTransaction } from '../db/db';
import { Sale, ProductType, AuthSessionUser, BranchStock } from '../types';
import { generateTransactionId } from '../utils/id-generator';
import { AuditService } from './audit';
import crypto from 'crypto';

export class SalesService {
  /**
   * Process a sale (SIM Card or Scratch Card)
   * Strictly atomic and protected against overselling / concurrency races
   */
  static processSale(params: {
    branchId: string;
    productType: ProductType;
    denominationId?: string | null;
    quantity: number;
    unitPrice?: number; // Optional user override if authorized, otherwise takes branch selling_price
    actor: AuthSessionUser;
  }): Sale {
    if (params.quantity <= 0) {
      throw new Error('Sale quantity must be greater than zero.');
    }
    if (params.productType === 'SCRATCH_CARD' && !params.denominationId) {
      throw new Error('Denomination is required for Scratch Card sales.');
    }

    // Branch authorization check
    if (params.actor.role === 'SHOP_USER' && params.actor.branch_id !== params.branchId) {
      throw new Error('Unauthorized: You can only create sales for your assigned branch.');
    }

    return runImmediateTransaction((dbInstance) => {
      // 1. Verify Active OPEN Business Session for the branch
      const session = dbInstance
        .prepare("SELECT * FROM business_sessions WHERE branch_id = ? AND status = 'OPEN'")
        .get(params.branchId) as { id: string } | undefined;

      if (!session) {
        throw new Error(
          'Sale rejected: No active OPEN business session found for this branch. Please open the business day first.'
        );
      }

      // 2. Fetch and lock Branch Stock row
      const bs = dbInstance
        .prepare(`
          SELECT * FROM branch_stock
          WHERE branch_id = ? AND product_type = ? AND (denomination_id = ? OR (denomination_id IS NULL AND ? IS NULL))
        `)
        .get(
          params.branchId,
          params.productType,
          params.denominationId || null,
          params.denominationId || null
        ) as BranchStock | undefined;

      if (!bs || bs.quantity < params.quantity) {
        const available = bs ? bs.quantity : 0;
        throw new Error(`Insufficient stock. Available quantity: ${available}. Requested: ${params.quantity}.`);
      }

      // 3. Calculate Prices & Authoritative Totals
      const unitPrice = params.unitPrice !== undefined && params.unitPrice > 0 ? params.unitPrice : bs.selling_price;
      const unitCost = bs.cost_price;
      const totalAmount = params.quantity * unitPrice;
      const totalCost = params.quantity * unitCost;
      const profit = totalAmount - totalCost;

      // 4. Generate Sale ID
      const saleId = generateTransactionId('SALE');

      // 5. Insert Sale Record
      dbInstance
        .prepare(`
          INSERT INTO sales (
            id, session_id, branch_id, user_id, product_type, denomination_id,
            quantity, unit_price, unit_cost, total_amount, total_cost, profit, created_at
          ) VALUES (
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, datetime('now', '+3 hours')
          )
        `)
        .run(
          saleId,
          session.id,
          params.branchId,
          params.actor.id,
          params.productType,
          params.denominationId || null,
          params.quantity,
          unitPrice,
          unitCost,
          totalAmount,
          totalCost,
          profit
        );

      // 6. Deduct Branch Stock
      const prevQty = bs.quantity;
      const newQty = prevQty - params.quantity;

      dbInstance
        .prepare("UPDATE branch_stock SET quantity = ?, updated_at = datetime('now', '+3 hours') WHERE id = ?")
        .run(newQty, bs.id);

      // 7. Write Stock Ledger Entry
      const ledgerId = `LEDGER-${crypto.randomUUID()}`;
      dbInstance
        .prepare(`
          INSERT INTO stock_ledger (
            id, transaction_id, product_type, denomination_id, movement_type,
            source_type, source_id, destination_type, destination_id,
            previous_quantity, change_quantity, new_quantity, user_id, notes, created_at
          ) VALUES (
            ?, ?, ?, ?, 'SALE',
            'BRANCH', ?, 'CUSTOMER', 'CUSTOMER',
            ?, ?, ?, ?, ?, datetime('now', '+3 hours')
          )
        `)
        .run(
          ledgerId,
          saleId,
          params.productType,
          params.denominationId || null,
          params.branchId,
          prevQty,
          -params.quantity,
          newQty,
          params.actor.id,
          `Direct point-of-sale transaction #${saleId}`
        );

      // 8. Audit Log
      AuditService.log({
        action: 'SALE_CREATED',
        entityType: 'SALE',
        entityId: saleId,
        actorUserId: params.actor.id,
        actorRole: params.actor.role,
        actorBranchId: params.branchId,
        newValues: {
          saleId,
          sessionId: session.id,
          productType: params.productType,
          denominationId: params.denominationId,
          quantity: params.quantity,
          unitPrice,
          totalAmount,
          profit,
          previousStock: prevQty,
          remainingStock: newQty,
        },
      });

      return this.getSaleById(saleId)!;
    });
  }

  /**
   * Process a Multi-Item Scratch Card Bundle Sale with Wholesale Customer Discount (e.g. 6% Wholesale Margin)
   * Strictly atomic and protected against overselling across multiple denominations
   */
  static processBundleSale(params: {
    branchId: string;
    items: Array<{
      denominationId: string;
      quantity: number;
    }>;
    discountPercentage?: number; // e.g. 6 (meaning 6%)
    notes?: string;
    actor: AuthSessionUser;
  }) {
    const validItems = params.items.filter((i) => i.quantity > 0);
    if (validItems.length === 0) {
      throw new Error('Bundle sale requires at least one item with quantity greater than zero.');
    }

    if (params.actor.role === 'SHOP_USER' && params.actor.branch_id !== params.branchId) {
      throw new Error('Unauthorized: You can only create sales for your assigned branch.');
    }

    const discountRate = params.discountPercentage !== undefined && params.discountPercentage >= 0 
      ? params.discountPercentage 
      : 6.0;

    return runImmediateTransaction((dbInstance) => {
      // 1. Verify Active OPEN Business Session
      const session = dbInstance
        .prepare("SELECT * FROM business_sessions WHERE branch_id = ? AND status = 'OPEN'")
        .get(params.branchId) as { id: string } | undefined;

      if (!session) {
        throw new Error(
          'Sale rejected: No active OPEN business session found for this branch. Please open the business day first.'
        );
      }

      const bundleId = generateTransactionId('BNDL');
      const salesCreated: Sale[] = [];
      let totalGross = 0;
      let totalNet = 0;
      let totalCostSum = 0;
      let totalQtySum = 0;

      // 2. Pre-verify stock for ALL items before making any modifications
      for (const item of validItems) {
        const bs = dbInstance
          .prepare(`
            SELECT bs.*, sd.denomination_value
            FROM branch_stock bs
            JOIN scratch_denominations sd ON bs.denomination_id = sd.id
            WHERE bs.branch_id = ? AND bs.product_type = 'SCRATCH_CARD' AND bs.denomination_id = ?
          `)
          .get(params.branchId, item.denominationId) as (BranchStock & { denomination_value: number }) | undefined;

        if (!bs || bs.quantity < item.quantity) {
          const avail = bs ? bs.quantity : 0;
          const denomVal = bs?.denomination_value ? `${bs.denomination_value} ETB` : 'selected denomination';
          throw new Error(`Insufficient stock for ${denomVal}. Available: ${avail}, Requested: ${item.quantity}.`);
        }
      }

      // 3. Process each line item
      for (const item of validItems) {
        const bs = dbInstance
          .prepare(`
            SELECT bs.*, sd.denomination_value
            FROM branch_stock bs
            JOIN scratch_denominations sd ON bs.denomination_id = sd.id
            WHERE bs.branch_id = ? AND bs.product_type = 'SCRATCH_CARD' AND bs.denomination_id = ?
          `)
          .get(params.branchId, item.denominationId) as (BranchStock & { denomination_value: number });

        const faceValue = bs.denomination_value;
        const lineGross = faceValue * item.quantity;
        const netUnitPrice = faceValue * (1 - discountRate / 100);
        const lineNet = item.quantity * netUnitPrice;
        const lineCost = item.quantity * bs.cost_price;
        const lineProfit = lineNet - lineCost;

        totalGross += lineGross;
        totalNet += lineNet;
        totalCostSum += lineCost;
        totalQtySum += item.quantity;

        const saleId = generateTransactionId('SALE');

        dbInstance
          .prepare(`
            INSERT INTO sales (
              id, session_id, branch_id, user_id, product_type, denomination_id,
              quantity, unit_price, unit_cost, total_amount, total_cost, profit, created_at
            ) VALUES (
              ?, ?, ?, ?, 'SCRATCH_CARD', ?,
              ?, ?, ?, ?, ?, ?, datetime('now', '+3 hours')
            )
          `)
          .run(
            saleId,
            session.id,
            params.branchId,
            params.actor.id,
            item.denominationId,
            item.quantity,
            netUnitPrice,
            bs.cost_price,
            lineNet,
            lineCost,
            lineProfit
          );

        // Deduct Stock
        const prevQty = bs.quantity;
        const newQty = prevQty - item.quantity;
        dbInstance
          .prepare("UPDATE branch_stock SET quantity = ?, updated_at = datetime('now', '+3 hours') WHERE id = ?")
          .run(newQty, bs.id);

        // Ledger entry
        const ledgerId = `LEDGER-${crypto.randomUUID()}`;
        dbInstance
          .prepare(`
            INSERT INTO stock_ledger (
              id, transaction_id, product_type, denomination_id, movement_type,
              source_type, source_id, destination_type, destination_id,
              previous_quantity, change_quantity, new_quantity, user_id, notes, created_at
            ) VALUES (
              ?, ?, 'SCRATCH_CARD', ?, 'SALE',
              'BRANCH', ?, 'CUSTOMER', 'CUSTOMER',
              ?, ?, ?, ?, ?, datetime('now', '+3 hours')
            )
          `)
          .run(
            ledgerId,
            saleId,
            item.denominationId,
            params.branchId,
            prevQty,
            -item.quantity,
            newQty,
            params.actor.id,
            `Scratch Card Wholesale Bundle #${bundleId} (${discountRate}% discount)`
          );

        salesCreated.push(this.getSaleById(saleId)!);
      }

      const discountAmount = totalGross - totalNet;
      const profit = totalNet - totalCostSum;

      // Audit Log
      AuditService.log({
        action: 'SALE_CREATED',
        entityType: 'SALE',
        entityId: bundleId,
        actorUserId: params.actor.id,
        actorRole: params.actor.role,
        actorBranchId: params.branchId,
        newValues: {
          bundleId,
          totalGross,
          discountRate,
          discountAmount,
          netAmount: totalNet,
          totalQuantity: totalQtySum,
          salesCount: salesCreated.length,
        },
      });

      return {
        success: true,
        bundleId,
        sales: salesCreated,
        totalQuantity: totalQtySum,
        grossAmount: totalGross,
        discountPercentage: discountRate,
        discountAmount,
        netAmount: totalNet,
        totalCost: totalCostSum,
        profit,
      };
    });
  }

  /**
   * Get single sale by ID
   */
  static getSaleById(id: string): Sale | null {
    const db = getDatabase();
    const row = db
      .prepare(`
        SELECT 
          s.*,
          b.name as branch_name,
          b.code as branch_code,
          u.full_name as user_name,
          sd.denomination_value
        FROM sales s
        JOIN branches b ON s.branch_id = b.id
        JOIN users u ON s.user_id = u.id
        LEFT JOIN scratch_denominations sd ON s.denomination_id = sd.id
        WHERE s.id = ?
      `)
      .get(id) as Sale | undefined;

    return row || null;
  }

  /**
   * Query sales with extensive filtering and pagination
   */
  static getSales(filters?: {
    branchId?: string;
    sessionId?: string;
    productType?: ProductType;
    denominationId?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): { sales: Sale[]; total: number; totalAmount: number; totalProfit: number; totalQuantity: number } {
    const db = getDatabase();
    const conditions: string[] = ['1=1'];
    const params: (string | number)[] = [];

    if (filters?.branchId) {
      conditions.push('s.branch_id = ?');
      params.push(filters.branchId);
    }
    if (filters?.sessionId) {
      conditions.push('s.session_id = ?');
      params.push(filters.sessionId);
    }
    if (filters?.productType) {
      conditions.push('s.product_type = ?');
      params.push(filters.productType);
    }
    if (filters?.denominationId) {
      conditions.push('s.denomination_id = ?');
      params.push(filters.denominationId);
    }
    if (filters?.userId) {
      conditions.push('s.user_id = ?');
      params.push(filters.userId);
    }
    if (filters?.startDate) {
      conditions.push('s.created_at >= ?');
      params.push(filters.startDate);
    }
    if (filters?.endDate) {
      conditions.push('s.created_at <= ?');
      params.push(`${filters.endDate} 23:59:59`);
    }

    const whereClause = conditions.join(' AND ');

    const summaryRow = db
      .prepare(`
        SELECT 
          COUNT(*) as total,
          COALESCE(SUM(total_amount), 0) as totalAmount,
          COALESCE(SUM(profit), 0) as totalProfit,
          COALESCE(SUM(quantity), 0) as totalQuantity
        FROM sales s 
        WHERE ${whereClause}
      `)
      .get(...params) as { total: number; totalAmount: number; totalProfit: number; totalQuantity: number };

    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;

    const queryParams = [...params, limit, offset];
    const sales = db
      .prepare(`
        SELECT 
          s.*,
          b.name as branch_name,
          b.code as branch_code,
          u.full_name as user_name,
          sd.denomination_value
        FROM sales s
        JOIN branches b ON s.branch_id = b.id
        JOIN users u ON s.user_id = u.id
        LEFT JOIN scratch_denominations sd ON s.denomination_id = sd.id
        WHERE ${whereClause}
        ORDER BY s.created_at DESC
        LIMIT ? OFFSET ?
      `)
      .all(...queryParams) as Sale[];

    return {
      sales,
      total: summaryRow?.total || 0,
      totalAmount: summaryRow?.totalAmount || 0,
      totalProfit: summaryRow?.totalProfit || 0,
      totalQuantity: summaryRow?.totalQuantity || 0,
    };
  }
}
