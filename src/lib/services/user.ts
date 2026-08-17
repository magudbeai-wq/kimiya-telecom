import bcrypt from 'bcryptjs';
import { getDatabase, runImmediateTransaction } from '../db/db';
import { User, UserRole, AuthSessionUser } from '../types';
import { AuditService } from './audit';
import crypto from 'crypto';

export class UserService {
  /**
   * Get list of users with branch names
   */
  static getUsers(filters?: {
    role?: UserRole;
    branchId?: string;
    status?: 'ACTIVE' | 'DISABLED';
  }): User[] {
    const db = getDatabase();
    const conditions: string[] = ['1=1'];
    const params: string[] = [];

    if (filters?.role) {
      conditions.push('u.role = ?');
      params.push(filters.role);
    }
    if (filters?.branchId) {
      conditions.push('u.branch_id = ?');
      params.push(filters.branchId);
    }
    if (filters?.status) {
      conditions.push('u.status = ?');
      params.push(filters.status);
    }

    const whereClause = conditions.join(' AND ');

    return db
      .prepare(`
        SELECT 
          u.id, u.username, u.full_name, u.email, u.role,
          u.branch_id, u.status, u.last_login_at, u.created_at,
          b.name as branch_name, b.code as branch_code
        FROM users u
        LEFT JOIN branches b ON u.branch_id = b.id
        WHERE ${whereClause}
        ORDER BY u.full_name ASC
      `)
      .all(...params) as User[];
  }

  /**
   * Get single user by ID
   */
  static getUserById(id: string): User | null {
    const db = getDatabase();
    const row = db
      .prepare(`
        SELECT 
          u.id, u.username, u.full_name, u.email, u.role,
          u.branch_id, u.status, u.last_login_at, u.created_at,
          b.name as branch_name, b.code as branch_code
        FROM users u
        LEFT JOIN branches b ON u.branch_id = b.id
        WHERE u.id = ?
      `)
      .get(id) as User | undefined;

    return row || null;
  }

  /**
   * Create a new user (Admin only)
   */
  static async createUser(
    params: {
      username: string;
      fullName: string;
      email: string;
      password: string;
      role: UserRole;
      branchId?: string | null;
    },
    actor: AuthSessionUser
  ): Promise<User> {
    if (!params.username || params.username.trim().length < 3) {
      throw new Error('Username must be at least 3 characters.');
    }
    if (!params.password || params.password.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }
    if (params.role === 'SHOP_USER' && !params.branchId) {
      throw new Error('Shop User must be assigned to exactly one branch.');
    }

    const passwordHash = await bcrypt.hash(params.password, 10);
    const userId = `USER-${crypto.randomUUID()}`;

    return runImmediateTransaction((dbInstance) => {
      // Check username or email uniqueness
      const existing = dbInstance
        .prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)')
        .get(params.username, params.email) as User | undefined;

      if (existing) {
        throw new Error(`A user with username '${params.username}' or email '${params.email}' already exists.`);
      }

      dbInstance
        .prepare(`
          INSERT INTO users (
            id, username, full_name, email, password_hash,
            role, branch_id, status, created_at
          ) VALUES (
            ?, ?, ?, ?, ?,
            ?, ?, 'ACTIVE', datetime('now', '+3 hours')
          )
        `)
        .run(
          userId,
          params.username.trim(),
          params.fullName.trim(),
          params.email.trim().toLowerCase(),
          passwordHash,
          params.role,
          params.role === 'SHOP_USER' ? params.branchId : null
        );

      AuditService.log({
        action: 'USER_CREATED',
        entityType: 'USER',
        entityId: userId,
        actorUserId: actor.id,
        actorRole: actor.role,
        actorBranchId: null,
        newValues: {
          username: params.username,
          fullName: params.fullName,
          email: params.email,
          role: params.role,
          branchId: params.branchId,
        },
      });

      return this.getUserById(userId)!;
    });
  }

  /**
   * Update existing user details, role, or branch
   */
  static async updateUser(
    id: string,
    params: {
      fullName?: string;
      email?: string;
      password?: string;
      role?: UserRole;
      branchId?: string | null;
      status?: 'ACTIVE' | 'DISABLED';
    },
    actor: AuthSessionUser
  ): Promise<User> {
    const user = this.getUserById(id);
    if (!user) {
      throw new Error(`User #${id} not found.`);
    }

    let passwordHashUpdate = '';
    const updateParams: any[] = [];

    const newFullName = params.fullName ?? user.full_name;
    const newEmail = params.email ? params.email.trim().toLowerCase() : user.email;
    const newRole = params.role ?? user.role;
    const newBranchId = newRole === 'SHOP_USER' ? (params.branchId !== undefined ? params.branchId : user.branch_id) : null;
    const newStatus = params.status ?? user.status;

    if (params.password && params.password.length >= 6) {
      const hash = await bcrypt.hash(params.password, 10);
      passwordHashUpdate = ', password_hash = ?';
      updateParams.push(hash);
    }

    return runImmediateTransaction((dbInstance) => {
      const sql = `
        UPDATE users
        SET full_name = ?, email = ?, role = ?, branch_id = ?, status = ? ${passwordHashUpdate}
        WHERE id = ?
      `;

      dbInstance.prepare(sql).run(
        newFullName,
        newEmail,
        newRole,
        newBranchId,
        newStatus,
        ...updateParams,
        id
      );

      AuditService.log({
        action: 'USER_UPDATED',
        entityType: 'USER',
        entityId: id,
        actorUserId: actor.id,
        actorRole: actor.role,
        actorBranchId: null,
        oldValues: {
          fullName: user.full_name,
          email: user.email,
          role: user.role,
          branchId: user.branch_id,
          status: user.status,
        },
        newValues: {
          fullName: newFullName,
          email: newEmail,
          role: newRole,
          branchId: newBranchId,
          status: newStatus,
        },
      });

      return this.getUserById(id)!;
    });
  }
}
