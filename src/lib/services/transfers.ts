import { getDatabase, runImmediateTransaction } from '../db/db';
import {
  StockTransfer,
  ProductType,
  RejectionReasonCode,
  AuthSessionUser,
  CentralStock,
  BranchStock,
} from '../types';
import { generateTransactionId } from '../utils/id-generator';
import { AuditService } from './audit';
import { NotificationService } from './notifications';
import crypto from 'crypto';

export class TransferService {
  /**
   * Finance dispatches a stock transfer to a branch
   */
  static dispatchTransfer(params: {
    productType: ProductType;
    denominationId?: string | null;
    destinationBranchId: string;
    quantity: number;
    notes?: string | null;
    referenceTransferId?: string | null;
    actor: AuthSessionUser;
  }): StockTransfer {
    if (params.quantity <= 0) {
      throw new Error('Transfer quantity must be greater than zero.');
    }
    if (params.productType === 'SCRATCH_CARD' && !params.denominationId) {
      throw new Error('Denomination is required for Scratch Card stock transfer.');
    }

    return runImmediateTransaction((dbInstance) => {
      // 1. Verify destination branch exists and is active
      const branch = dbInstance
        .prepare("SELECT * FROM branches WHERE id = ? AND status = 'ACTIVE'")
        .get(params.destinationBranchId) as { id: string; name: string; code: string } | undefined;

      if (!branch) {
        throw new Error('Destination branch is invalid or inactive.');
      }

      // 2. Check Central Store has enough stock
      const cs = dbInstance
        .prepare(`
          SELECT * FROM central_stock 
          WHERE product_type = ? AND (denomination_id = ? OR (denomination_id IS NULL AND ? IS NULL))
        `)
        .get(params.productType, params.denominationId || null, params.denominationId || null) as
        | CentralStock
        | undefined;

      if (!cs || cs.quantity < params.quantity) {
        throw new Error(
          `Insufficient central store stock. Available: ${cs?.quantity || 0}, Requested: ${params.quantity}`
        );
      }

      // 3. Generate Transfer ID
      const prefix = params.productType === 'SIM' ? 'SIM-TR' : 'SC-TR';
      const transferId = generateTransactionId(prefix as any);

      // 4. Insert Transfer Record in status 'SENT'
      dbInstance
        .prepare(`
          INSERT INTO stock_transfers (
            id, product_type, denomination_id, destination_branch_id,
            quantity, status, sent_by_user_id, sent_at,
            reference_transfer_id, notes
          ) VALUES (
            ?, ?, ?, ?,
            ?, 'SENT', ?, datetime('now', '+3 hours'),
            ?, ?
          )
        `)
        .run(
          transferId,
          params.productType,
          params.denominationId || null,
          params.destinationBranchId,
          params.quantity,
          params.actor.id,
          params.referenceTransferId || null,
          params.notes || null
        );

      // 5. Send notification to branch
      const productName =
        params.productType === 'SIM' ? 'SIM Card' : 'Scratch Card';
      NotificationService.create({
        recipientRole: 'SHOP_USER',
        recipientBranchId: params.destinationBranchId,
        title: `New ${productName} Shipment Requires Approval`,
        message: `Finance has sent ${params.quantity} ${productName}s (Transfer #${transferId}) to ${branch.name}. Please review and approve/reject.`,
        type: 'TRANSFER_SENT',
        referenceId: transferId,
      });

      // 6. Audit Log
      AuditService.log({
        action: 'TRANSFER_DISPATCHED',
        entityType: 'STOCK_TRANSFER',
        entityId: transferId,
        actorUserId: params.actor.id,
        actorRole: params.actor.role,
        actorBranchId: null,
        newValues: {
          transferId,
          productType: params.productType,
          denominationId: params.denominationId,
          destinationBranchId: params.destinationBranchId,
          quantity: params.quantity,
          referenceTransferId: params.referenceTransferId,
        },
      });

      return this.getTransferById(transferId)!;
    });
  }

  /**
   * Branch User APPROVES incoming stock transfer
   * Atomic operation:
   * - Central Store stock decreases
   * - Branch stock increases
   * - Stock Ledger recorded
   * - Status becomes APPROVED
   * - Finance notified
   */
  static approveTransfer(transferId: string, actor: AuthSessionUser): StockTransfer {
    return runImmediateTransaction((dbInstance) => {
      // 1. Fetch and lock transfer row
      const transfer = dbInstance
        .prepare('SELECT * FROM stock_transfers WHERE id = ?')
        .get(transferId) as StockTransfer | undefined;

      if (!transfer) {
        throw new Error(`Transfer #${transferId} not found.`);
      }

      if (transfer.status !== 'SENT') {
        throw new Error(
          `Duplicate Refused: Transfer #${transferId} cannot be approved because its current status is '${transfer.status}'. Only newly dispatched 'SENT' transfers can be approved.`
        );
      }

      // Branch authorization check
      if (actor.role === 'SHOP_USER' && actor.branch_id !== transfer.destination_branch_id) {
        throw new Error('Unauthorized: You can only approve transfers destined for your branch.');
      }

      // 2. Fetch Central Stock and verify quantity
      const cs = dbInstance
        .prepare(`
          SELECT * FROM central_stock 
          WHERE product_type = ? AND (denomination_id = ? OR (denomination_id IS NULL AND ? IS NULL))
        `)
        .get(transfer.product_type, transfer.denomination_id, transfer.denomination_id) as
        | CentralStock
        | undefined;

      if (!cs || cs.quantity < transfer.quantity) {
        throw new Error(
          `Approval failed: Central store does not have enough stock to fulfill transfer. Available: ${cs?.quantity || 0}, Transfer qty: ${transfer.quantity}`
        );
      }

      // 3. Deduct Central Stock
      const csPrevQty = cs.quantity;
      const csNewQty = csPrevQty - transfer.quantity;
      dbInstance
        .prepare("UPDATE central_stock SET quantity = ?, updated_at = datetime('now', '+3 hours') WHERE id = ?")
        .run(csNewQty, cs.id);

      // 4. Increase Branch Stock
      let bs = dbInstance
        .prepare(`
          SELECT * FROM branch_stock 
          WHERE branch_id = ? AND product_type = ? AND (denomination_id = ? OR (denomination_id IS NULL AND ? IS NULL))
        `)
        .get(
          transfer.destination_branch_id,
          transfer.product_type,
          transfer.denomination_id,
          transfer.denomination_id
        ) as BranchStock | undefined;

      const bsPrevQty = bs ? bs.quantity : 0;
      const bsNewQty = bsPrevQty + transfer.quantity;

      if (!bs) {
        const bsId = `BS-${transfer.destination_branch_id}-${transfer.product_type}-${transfer.denomination_id || 'DEFAULT'}`;
        dbInstance
          .prepare(`
            INSERT INTO branch_stock (
              id, branch_id, product_type, denomination_id, quantity, cost_price, selling_price, low_stock_threshold, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 100, datetime('now', '+3 hours'))
          `)
          .run(
            bsId,
            transfer.destination_branch_id,
            transfer.product_type,
            transfer.denomination_id,
            bsNewQty,
            cs.cost_price,
            cs.selling_price
          );
      } else {
        dbInstance
          .prepare("UPDATE branch_stock SET quantity = ?, updated_at = datetime('now', '+3 hours') WHERE id = ?")
          .run(bsNewQty, bs.id);
      }

      // 5. Update Transfer Status
      dbInstance
        .prepare(`
          UPDATE stock_transfers
          SET status = 'APPROVED',
              reviewed_by_user_id = ?,
              reviewed_at = datetime('now', '+3 hours')
          WHERE id = ?
        `)
        .run(actor.id, transferId);

      // 6. Write Stock Ledger entries (One for Central Store deduction, one for Branch addition)
      const ledgerIdCentral = `LEDGER-${crypto.randomUUID()}`;
      dbInstance
        .prepare(`
          INSERT INTO stock_ledger (
            id, transaction_id, product_type, denomination_id, movement_type,
            source_type, source_id, destination_type, destination_id,
            previous_quantity, change_quantity, new_quantity, user_id, notes, created_at
          ) VALUES (
            ?, ?, ?, ?, 'SENT_TO_BRANCH',
            'CENTRAL_STORE', 'CENTRAL_STORE', 'BRANCH', ?,
            ?, ?, ?, ?, ?, datetime('now', '+3 hours')
          )
        `)
        .run(
          ledgerIdCentral,
          transferId,
          transfer.product_type,
          transfer.denomination_id,
          transfer.destination_branch_id,
          csPrevQty,
          -transfer.quantity,
          csNewQty,
          actor.id,
          `Dispatched and approved transfer to branch #${transfer.destination_branch_id}`
        );

      const ledgerIdBranch = `LEDGER-${crypto.randomUUID()}`;
      dbInstance
        .prepare(`
          INSERT INTO stock_ledger (
            id, transaction_id, product_type, denomination_id, movement_type,
            source_type, source_id, destination_type, destination_id,
            previous_quantity, change_quantity, new_quantity, user_id, notes, created_at
          ) VALUES (
            ?, ?, ?, ?, 'APPROVED',
            'CENTRAL_STORE', 'CENTRAL_STORE', 'BRANCH', ?,
            ?, ?, ?, ?, ?, datetime('now', '+3 hours')
          )
        `)
        .run(
          ledgerIdBranch,
          transferId,
          transfer.product_type,
          transfer.denomination_id,
          transfer.destination_branch_id,
          bsPrevQty,
          transfer.quantity,
          bsNewQty,
          actor.id,
          `Received and approved transfer #${transferId}`
        );

      // 7. Notify Finance
      const branchRow = dbInstance
        .prepare('SELECT name FROM branches WHERE id = ?')
        .get(transfer.destination_branch_id) as { name: string };

      NotificationService.create({
        recipientRole: 'FINANCE',
        title: `Transfer #${transferId} Approved`,
        message: `${branchRow.name} approved stock transfer #${transferId} (${transfer.quantity} ${transfer.product_type}s). Branch stock updated.`,
        type: 'TRANSFER_APPROVED',
        referenceId: transferId,
      });

      // 8. Audit Log
      AuditService.log({
        action: 'TRANSFER_APPROVED',
        entityType: 'STOCK_TRANSFER',
        entityId: transferId,
        actorUserId: actor.id,
        actorRole: actor.role,
        actorBranchId: transfer.destination_branch_id,
        newValues: {
          status: 'APPROVED',
          transferId,
          previousCentralQty: csPrevQty,
          newCentralQty: csNewQty,
          previousBranchQty: bsPrevQty,
          newBranchQty: bsNewQty,
        },
      });

      return this.getTransferById(transferId)!;
    });
  }

  /**
   * Branch User REJECTS incoming stock transfer
   * Mandatory Reason required.
   * Atomic operation:
   * - Branch stock DOES NOT increase
   * - Central stock remains intact
   * - Status becomes REJECTED
   * - Finance notified with 'REVIEW REQUIRED'
   */
  static rejectTransfer(params: {
    transferId: string;
    reasonCode: RejectionReasonCode;
    reasonText?: string | null;
    actor: AuthSessionUser;
  }): StockTransfer {
    if (!params.reasonCode) {
      throw new Error('Rejection reason code is mandatory.');
    }
    if (params.reasonCode === 'OTHER' && (!params.reasonText || params.reasonText.trim().length === 0)) {
      throw new Error('Detailed explanation is required when selecting "OTHER" as rejection reason.');
    }

    return runImmediateTransaction((dbInstance) => {
      const transfer = dbInstance
        .prepare('SELECT * FROM stock_transfers WHERE id = ?')
        .get(params.transferId) as StockTransfer | undefined;

      if (!transfer) {
        throw new Error(`Transfer #${params.transferId} not found.`);
      }

      if (transfer.status !== 'SENT') {
        throw new Error(
          `Duplicate Refused: Transfer #${params.transferId} cannot be rejected because its current status is '${transfer.status}'. Only newly dispatched 'SENT' transfers can be rejected.`
        );
      }

      // Branch authorization check
      if (params.actor.role === 'SHOP_USER' && params.actor.branch_id !== transfer.destination_branch_id) {
        throw new Error('Unauthorized: You can only reject transfers destined for your branch.');
      }

      // Update Transfer Status to REJECTED & flag for Finance Review
      dbInstance
        .prepare(`
          UPDATE stock_transfers
          SET status = 'REJECTED',
              reviewed_by_user_id = ?,
              reviewed_at = datetime('now', '+3 hours'),
              rejection_reason_code = ?,
              rejection_reason_text = ?,
              finance_review_status = 'PENDING'
          WHERE id = ?
        `)
        .run(
          params.actor.id,
          params.reasonCode,
          params.reasonText || null,
          params.transferId
        );

      const branchRow = dbInstance
        .prepare('SELECT name FROM branches WHERE id = ?')
        .get(transfer.destination_branch_id) as { name: string };

      // Send notification to Finance
      const reasonDisplay = params.reasonCode.replace(/_/g, ' ') + (params.reasonText ? `: ${params.reasonText}` : '');
      NotificationService.create({
        recipientRole: 'FINANCE',
        title: `REVIEW REQUIRED: ${branchRow.name} Rejected Transfer #${params.transferId}`,
        message: `${branchRow.name} rejected transfer #${params.transferId} (${transfer.quantity} ${transfer.product_type}s). Reason: ${reasonDisplay}`,
        type: 'REVIEW_REQUIRED',
        referenceId: params.transferId,
      });

      // Audit Log
      AuditService.log({
        action: 'TRANSFER_REJECTED',
        entityType: 'STOCK_TRANSFER',
        entityId: params.transferId,
        actorUserId: params.actor.id,
        actorRole: params.actor.role,
        actorBranchId: transfer.destination_branch_id,
        newValues: {
          status: 'REJECTED',
          reasonCode: params.reasonCode,
          reasonText: params.reasonText,
        },
      });

      return this.getTransferById(params.transferId)!;
    });
  }

  /**
   * Finance Reviews a rejected transfer, adds notes, and can resolve, cancel, or trigger a resend
   */
  static financeReviewTransfer(params: {
    transferId: string;
    action: 'RESOLVE' | 'CANCEL' | 'RESEND';
    correctedQuantity?: number;
    notes?: string | null;
    actor: AuthSessionUser;
  }): { reviewedTransfer: StockTransfer; resentTransfer?: StockTransfer } {
    return runImmediateTransaction((dbInstance) => {
      const transfer = this.getTransferById(params.transferId);
      if (!transfer) {
        throw new Error(`Transfer #${params.transferId} not found.`);
      }

      if (transfer.status !== 'REJECTED') {
        throw new Error(`Transfer #${params.transferId} is not in REJECTED status.`);
      }

      let reviewStatus: 'RESOLVED' | 'CANCELLED' | 'RESENT' = 'RESOLVED';
      if (params.action === 'CANCEL') reviewStatus = 'CANCELLED';
      if (params.action === 'RESEND') reviewStatus = 'RESENT';

      dbInstance
        .prepare(`
          UPDATE stock_transfers
          SET finance_review_status = ?,
              finance_review_notes = ?
          WHERE id = ?
        `)
        .run(reviewStatus, params.notes || null, params.transferId);

      AuditService.log({
        action: `FINANCE_REVIEW_${params.action}`,
        entityType: 'STOCK_TRANSFER',
        entityId: params.transferId,
        actorUserId: params.actor.id,
        actorRole: params.actor.role,
        actorBranchId: null,
        newValues: {
          financeReviewStatus: reviewStatus,
          notes: params.notes,
          action: params.action,
        },
      });

      let resentTransfer: StockTransfer | undefined;
      if (params.action === 'RESEND') {
        const qtyToResend = params.correctedQuantity || transfer.quantity;
        resentTransfer = this.dispatchTransfer({
          productType: transfer.product_type,
          denominationId: transfer.denomination_id,
          destinationBranchId: transfer.destination_branch_id,
          quantity: qtyToResend,
          referenceTransferId: params.transferId,
          notes: `Corrected resend of rejected transfer #${params.transferId}. Notes: ${params.notes || ''}`,
          actor: params.actor,
        });
      }

      return {
        reviewedTransfer: this.getTransferById(params.transferId)!,
        resentTransfer,
      };
    });
  }

  /**
   * Get single transfer by ID with full joins
   */
  static getTransferById(id: string): StockTransfer | null {
    const db = getDatabase();
    const row = db
      .prepare(`
        SELECT 
          st.*,
          st.product_type as productType,
          b.name as destination_branch_name,
          b.code as destination_branch_code,
          sd.denomination_value,
          u1.full_name as sent_by_user_name,
          u2.full_name as reviewed_by_user_name
        FROM stock_transfers st
        JOIN branches b ON st.destination_branch_id = b.id
        LEFT JOIN scratch_denominations sd ON st.denomination_id = sd.id
        LEFT JOIN users u1 ON st.sent_by_user_id = u1.id
        LEFT JOIN users u2 ON st.reviewed_by_user_id = u2.id
        WHERE st.id = ?
      `)
      .get(id) as StockTransfer | undefined;

    return row || null;
  }

  /**
   * Query transfers with filters (by branch, product type, status, date)
   */
  static getTransfers(filters?: {
    branchId?: string;
    productType?: ProductType;
    status?: string;
    financeReviewStatus?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): { transfers: StockTransfer[]; total: number } {
    const db = getDatabase();
    const conditions: string[] = ['1=1'];
    const params: (string | number)[] = [];

    if (filters?.branchId) {
      conditions.push('st.destination_branch_id = ?');
      params.push(filters.branchId);
    }
    if (filters?.productType) {
      conditions.push('st.product_type = ?');
      params.push(filters.productType);
    }
    if (filters?.status) {
      conditions.push('st.status = ?');
      params.push(filters.status);
    }
    if (filters?.financeReviewStatus) {
      conditions.push('st.finance_review_status = ?');
      params.push(filters.financeReviewStatus);
    }
    if (filters?.startDate) {
      conditions.push('st.sent_at >= ?');
      params.push(filters.startDate);
    }
    if (filters?.endDate) {
      conditions.push('st.sent_at <= ?');
      params.push(`${filters.endDate} 23:59:59`);
    }

    const whereClause = conditions.join(' AND ');

    const countRow = db
      .prepare(`SELECT COUNT(*) as total FROM stock_transfers st WHERE ${whereClause}`)
      .get(...params) as { total: number };

    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;

    const queryParams = [...params, limit, offset];
    const transfers = db
      .prepare(`
        SELECT 
          st.*,
          st.product_type as productType,
          b.name as destination_branch_name,
          b.code as destination_branch_code,
          sd.denomination_value,
          u1.full_name as sent_by_user_name,
          u2.full_name as reviewed_by_user_name
        FROM stock_transfers st
        JOIN branches b ON st.destination_branch_id = b.id
        LEFT JOIN scratch_denominations sd ON st.denomination_id = sd.id
        LEFT JOIN users u1 ON st.sent_by_user_id = u1.id
        LEFT JOIN users u2 ON st.reviewed_by_user_id = u2.id
        WHERE ${whereClause}
        ORDER BY st.sent_at DESC
        LIMIT ? OFFSET ?
      `)
      .all(...queryParams) as StockTransfer[];

    return {
      transfers,
      total: countRow?.total || 0,
    };
  }
}
