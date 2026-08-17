import { getDatabase, runImmediateTransaction } from '../db/db';
import { Branch, AuthSessionUser } from '../types';
import { AuditService } from './audit';

export class BranchService {
  /**
   * Get all branches
   */
  static getBranches(includeDisabled = false): Branch[] {
    const db = getDatabase();
    const query = includeDisabled
      ? 'SELECT * FROM branches ORDER BY name ASC'
      : "SELECT * FROM branches WHERE status = 'ACTIVE' ORDER BY name ASC";
    return db.prepare(query).all() as Branch[];
  }

  /**
   * Get branch by ID
   */
  static getBranchById(id: string): Branch | null {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM branches WHERE id = ?').get(id) as Branch | undefined;
    return row || null;
  }

  /**
   * Create a new branch (Admin only)
   * Automatically initializes branch_stock for SIM and all Scratch denominations
   */
  static createBranch(
    params: {
      code: string;
      name: string;
      location: string;
    },
    actor: AuthSessionUser
  ): Branch {
    return runImmediateTransaction((dbInstance) => {
      const id = `BR-${params.code.toUpperCase()}`;

      // Check unique code and name
      const existing = dbInstance
        .prepare('SELECT * FROM branches WHERE code = ? OR LOWER(name) = LOWER(?)')
        .get(params.code.toUpperCase(), params.name) as Branch | undefined;

      if (existing) {
        throw new Error(`Branch with code '${params.code}' or name '${params.name}' already exists.`);
      }

      dbInstance
        .prepare(`
          INSERT INTO branches (
            id, code, name, location, status, created_at, updated_at
          ) VALUES (
            ?, ?, ?, ?, 'ACTIVE',
            datetime('now', '+3 hours'), datetime('now', '+3 hours')
          )
        `)
        .run(id, params.code.toUpperCase(), params.name, params.location);

      // Initialize SIM branch stock
      dbInstance
        .prepare(`
          INSERT INTO branch_stock (
            id, branch_id, product_type, denomination_id, quantity, cost_price, selling_price, low_stock_threshold, updated_at
          ) VALUES (?, ?, 'SIM', NULL, 0, 30.0, 50.0, 100, datetime('now', '+3 hours'))
        `)
        .run(`BS-${id}-SIM`, id);

      // Initialize Scratch Card branch stock for all denominations
      const denoms = dbInstance.prepare('SELECT id, denomination_value FROM scratch_denominations').all() as {
        id: string;
        denomination_value: number;
      }[];

      const insertBsStmt = dbInstance.prepare(`
        INSERT INTO branch_stock (
          id, branch_id, product_type, denomination_id, quantity, cost_price, selling_price, low_stock_threshold, updated_at
        ) VALUES (?, ?, 'SCRATCH_CARD', ?, 0, ?, ?, 200, datetime('now', '+3 hours'))
      `);

      for (const d of denoms) {
        insertBsStmt.run(
          `BS-${id}-SC-${d.denomination_value}`,
          id,
          d.id,
          d.denomination_value * 0.9,
          d.denomination_value
        );
      }

      AuditService.log({
        action: 'BRANCH_CREATED',
        entityType: 'BRANCH',
        entityId: id,
        actorUserId: actor.id,
        actorRole: actor.role,
        actorBranchId: null,
        newValues: {
          id,
          code: params.code.toUpperCase(),
          name: params.name,
          location: params.location,
        },
      });

      return this.getBranchById(id)!;
    });
  }

  /**
   * Update branch details or toggle active status
   */
  static updateBranch(
    id: string,
    params: {
      name?: string;
      location?: string;
      status?: 'ACTIVE' | 'DISABLED';
    },
    actor: AuthSessionUser
  ): Branch {
    return runImmediateTransaction((dbInstance) => {
      const branch = this.getBranchById(id);
      if (!branch) {
        throw new Error(`Branch #${id} not found.`);
      }

      const newName = params.name ?? branch.name;
      const newLoc = params.location ?? branch.location;
      const newStatus = params.status ?? branch.status;

      dbInstance
        .prepare(`
          UPDATE branches
          SET name = ?, location = ?, status = ?, updated_at = datetime('now', '+3 hours')
          WHERE id = ?
        `)
        .run(newName, newLoc, newStatus, id);

      AuditService.log({
        action: 'BRANCH_UPDATED',
        entityType: 'BRANCH',
        entityId: id,
        actorUserId: actor.id,
        actorRole: actor.role,
        actorBranchId: null,
        oldValues: { name: branch.name, location: branch.location, status: branch.status },
        newValues: { name: newName, location: newLoc, status: newStatus },
      });

      return this.getBranchById(id)!;
    });
  }
}
