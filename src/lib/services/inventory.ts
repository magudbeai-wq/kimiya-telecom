import { getDatabase, runImmediateTransaction } from '../db/db';
import {
  CentralStock,
  BranchStock,
  IncomingStock,
  ProductType,
  ScratchDenomination,
  AuthSessionUser,
} from '../types';
import { generateTransactionId } from '../utils/id-generator';
import { AuditService } from './audit';
import { NotificationService } from './notifications';
import crypto from 'crypto';

export class InventoryService {
  /**
   * Fetch all active scratch card denominations
   */
  static getScratchDenominations(onlyActive = false): ScratchDenomination[] {
    const db = getDatabase();
    const query = onlyActive
      ? 'SELECT * FROM scratch_denominations WHERE is_active = 1 ORDER BY display_order ASC, denomination_value ASC'
      : 'SELECT * FROM scratch_denominations ORDER BY display_order ASC, denomination_value ASC';
    return db.prepare(query).all() as ScratchDenomination[];
  }

  /**
   * Add a new scratch card denomination (Admin/Finance configurable)
   */
  static createScratchDenomination(
    denominationValue: number,
    displayOrder = 0,
    actor: AuthSessionUser
  ): ScratchDenomination {
    const db = getDatabase();
    const id = `DENOM-${denominationValue}ETB`;

    const existing = db
      .prepare('SELECT * FROM scratch_denominations WHERE denomination_value = ?')
      .get(denominationValue) as ScratchDenomination | undefined;

    if (existing) {
      throw new Error(`Denomination ${denominationValue} ETB already exists.`);
    }

    return runImmediateTransaction((dbInstance) => {
      dbInstance
        .prepare(
          'INSERT INTO scratch_denominations (id, denomination_value, is_active, display_order, created_at) VALUES (?, ?, 1, ?, datetime(\'now\', \'+3 hours\'))'
        )
        .run(id, denominationValue, displayOrder);

      // Initialize central stock entry for this denomination
      dbInstance
        .prepare(
          'INSERT INTO central_stock (id, product_type, denomination_id, quantity, cost_price, selling_price, low_stock_threshold, updated_at) VALUES (?, \'SCRATCH_CARD\', ?, 0, ?, ?, 1000, datetime(\'now\', \'+3 hours\'))'
        )
        .run(`CS-SC-${denominationValue}`, id, denominationValue * 0.9, denominationValue);

      // Initialize branch stock entries for all branches
      const branches = dbInstance.prepare('SELECT id FROM branches').all() as { id: string }[];
      const insertBranchStock = dbInstance.prepare(`
        INSERT OR IGNORE INTO branch_stock (
          id, branch_id, product_type, denomination_id, quantity, cost_price, selling_price, low_stock_threshold, updated_at
        ) VALUES (?, ?, 'SCRATCH_CARD', ?, 0, ?, ?, 200, datetime('now', '+3 hours'))
      `);

      for (const branch of branches) {
        insertBranchStock.run(
          `BS-${branch.id}-SC-${denominationValue}`,
          branch.id,
          id,
          denominationValue * 0.9,
          denominationValue
        );
      }

      AuditService.log({
        action: 'CREATE_DENOMINATION',
        entityType: 'SCRATCH_DENOMINATION',
        entityId: id,
        actorUserId: actor.id,
        actorRole: actor.role,
        actorBranchId: actor.branch_id,
        newValues: { denominationValue, displayOrder },
      });

      return dbInstance
        .prepare('SELECT * FROM scratch_denominations WHERE id = ?')
        .get(id) as ScratchDenomination;
    });
  }

  /**
   * Fetch Central Store stock levels (SIM and Scratch Cards with Denominations)
   */
  static getCentralStock(): CentralStock[] {
    const db = getDatabase();
    return db
      .prepare(`
        SELECT 
          cs.*,
          sd.denomination_value
        FROM central_stock cs
        LEFT JOIN scratch_denominations sd ON cs.denomination_id = sd.id
        ORDER BY cs.product_type ASC, sd.display_order ASC, sd.denomination_value ASC
      `)
      .all() as CentralStock[];
  }

  /**
   * Fetch Branch stock levels for a specific branch or all branches (if authorized)
   */
  static getBranchStock(branchId?: string): BranchStock[] {
    const db = getDatabase();
    let query = `
      SELECT 
        bs.*,
        b.name as branch_name,
        b.code as branch_code,
        sd.denomination_value
      FROM branch_stock bs
      JOIN branches b ON bs.branch_id = b.id
      LEFT JOIN scratch_denominations sd ON bs.denomination_id = sd.id
    `;
    const params: string[] = [];

    if (branchId) {
      query += ' WHERE bs.branch_id = ?';
      params.push(branchId);
    }

    query += ' ORDER BY b.name ASC, bs.product_type ASC, sd.display_order ASC, sd.denomination_value ASC';

    return db.prepare(query).all(...params) as BranchStock[];
  }

  /**
   * Receive Incoming Stock into Central Store (Finance operation)
   */
  static receiveIncomingStock(params: {
    productType: ProductType;
    denominationId?: string | null;
    quantity: number;
    unitCost: number;
    supplierName: string;
    referenceNumber: string;
    notes?: string | null;
    actor: AuthSessionUser;
  }): IncomingStock {
    if (params.quantity <= 0) {
      throw new Error('Quantity must be greater than zero.');
    }
    if (params.unitCost < 0) {
      throw new Error('Unit cost cannot be negative.');
    }
    if (params.productType === 'SCRATCH_CARD' && !params.denominationId) {
      throw new Error('Denomination is required for Scratch Card incoming stock.');
    }

    return runImmediateTransaction((dbInstance) => {
      const idPrefix = params.productType === 'SIM' ? 'IN-SIM' : 'IN-SC';
      const id = generateTransactionId(idPrefix as any);
      const totalCost = params.quantity * params.unitCost;

      // 1. Insert Incoming Stock Record
      dbInstance
        .prepare(`
          INSERT INTO incoming_stock (
            id, product_type, denomination_id, quantity, unit_cost, total_cost,
            supplier_name, reference_number, received_by_user_id, received_at, notes
          ) VALUES (
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, datetime('now', '+3 hours'), ?
          )
        `)
        .run(
          id,
          params.productType,
          params.denominationId || null,
          params.quantity,
          params.unitCost,
          totalCost,
          params.supplierName,
          params.referenceNumber,
          params.actor.id,
          params.notes || null
        );

      // 2. Fetch Central Stock record and update
      let csRow = dbInstance
        .prepare(
          'SELECT * FROM central_stock WHERE product_type = ? AND (denomination_id = ? OR (denomination_id IS NULL AND ? IS NULL))'
        )
        .get(params.productType, params.denominationId || null, params.denominationId || null) as
        | CentralStock
        | undefined;

      const previousQty = csRow ? csRow.quantity : 0;
      const newQty = previousQty + params.quantity;

      if (!csRow) {
        const csId = `CS-${params.productType}-${params.denominationId || 'DEFAULT'}`;
        dbInstance
          .prepare(`
            INSERT INTO central_stock (
              id, product_type, denomination_id, quantity, cost_price, selling_price, low_stock_threshold, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, 500, datetime('now', '+3 hours'))
          `)
          .run(csId, params.productType, params.denominationId || null, newQty, params.unitCost, params.unitCost * 1.5);
      } else {
        dbInstance
          .prepare(`
            UPDATE central_stock 
            SET quantity = quantity + ?, cost_price = ?, updated_at = datetime('now', '+3 hours')
            WHERE id = ?
          `)
          .run(params.quantity, params.unitCost, csRow.id);
      }

      // 3. Write Stock Ledger Entry
      const ledgerId = `LEDGER-${crypto.randomUUID()}`;
      dbInstance
        .prepare(`
          INSERT INTO stock_ledger (
            id, transaction_id, product_type, denomination_id, movement_type,
            source_type, source_id, destination_type, destination_id,
            previous_quantity, change_quantity, new_quantity, user_id, notes, created_at
          ) VALUES (
            ?, ?, ?, ?, 'INCOMING',
            'SUPPLIER', ?, 'CENTRAL_STORE', 'CENTRAL_STORE',
            ?, ?, ?, ?, ?, datetime('now', '+3 hours')
          )
        `)
        .run(
          ledgerId,
          id,
          params.productType,
          params.denominationId || null,
          params.supplierName,
          previousQty,
          params.quantity,
          newQty,
          params.actor.id,
          `Incoming stock received from ${params.supplierName}. Ref: ${params.referenceNumber}`
        );

      // 4. Audit Log
      AuditService.log({
        action: 'INCOMING_STOCK_RECEIVED',
        entityType: 'INCOMING_STOCK',
        entityId: id,
        actorUserId: params.actor.id,
        actorRole: params.actor.role,
        actorBranchId: null,
        newValues: {
          productType: params.productType,
          denominationId: params.denominationId,
          quantity: params.quantity,
          unitCost: params.unitCost,
          totalCost,
          supplierName: params.supplierName,
          referenceNumber: params.referenceNumber,
        },
      });

      return dbInstance
        .prepare(`
          SELECT i.*, sd.denomination_value, u.full_name as received_by_user_name
          FROM incoming_stock i
          LEFT JOIN scratch_denominations sd ON i.denomination_id = sd.id
          LEFT JOIN users u ON i.received_by_user_id = u.id
          WHERE i.id = ?
        `)
        .get(id) as IncomingStock;
    });
  }

  /**
   * Fetch incoming stock history
   */
  static getIncomingHistory(productType?: ProductType, limit = 50): IncomingStock[] {
    const db = getDatabase();
    let query = `
      SELECT 
        i.*,
        sd.denomination_value,
        u.full_name as received_by_user_name
      FROM incoming_stock i
      LEFT JOIN scratch_denominations sd ON i.denomination_id = sd.id
      LEFT JOIN users u ON i.received_by_user_id = u.id
    `;
    const params: (string | number)[] = [];

    if (productType) {
      query += ' WHERE i.product_type = ?';
      params.push(productType);
    }

    query += ' ORDER BY i.received_at DESC LIMIT ?';
    params.push(limit);

    return db.prepare(query).all(...params) as IncomingStock[];
  }
}
