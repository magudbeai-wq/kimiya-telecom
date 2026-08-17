import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { getDatabase } from '../db/db';
import { AuthSessionUser, User } from '../types';
import { AuditService } from './audit';

const JWT_SECRET_STRING = process.env.JWT_SECRET || 'kimiya-telecom-enterprise-super-secure-key-2026';
const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_STRING);
const TOKEN_EXPIRY = '12h';

export class AuthService {
  /**
   * Hash a plain text password with salt
   */
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  /**
   * Verify password against hash
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Authenticate user with username and password
   */
  static async login(
    username: string,
    password: string,
    ipAddress?: string
  ): Promise<{ token: string; user: AuthSessionUser } | null> {
    const db = getDatabase();

    const userRow = db
      .prepare(`
        SELECT u.*, b.name as branch_name, b.code as branch_code
        FROM users u
        LEFT JOIN branches b ON u.branch_id = b.id
        WHERE LOWER(u.username) = LOWER(?) AND u.status = 'ACTIVE'
      `)
      .get(username) as (User & { password_hash: string }) | undefined;

    if (!userRow) {
      return null;
    }

    const isValid = await this.verifyPassword(password, userRow.password_hash);
    if (!isValid) {
      AuditService.log({
        action: 'LOGIN_FAILED',
        entityType: 'USER',
        entityId: userRow.id,
        actorUserId: userRow.id,
        actorRole: userRow.role,
        actorBranchId: userRow.branch_id,
        ipAddress,
        notes: 'Invalid password attempt',
      } as any);
      return null;
    }

    // Update last_login_at
    db.prepare("UPDATE users SET last_login_at = datetime('now', '+3 hours') WHERE id = ?").run(userRow.id);

    const sessionUser: AuthSessionUser = {
      id: userRow.id,
      username: userRow.username,
      full_name: userRow.full_name,
      email: userRow.email,
      role: userRow.role,
      branch_id: userRow.branch_id,
      branch_name: userRow.branch_name || null,
      branch_code: userRow.branch_code || null,
    };

    const token = await new SignJWT({ ...sessionUser })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(TOKEN_EXPIRY)
      .sign(JWT_SECRET);

    AuditService.log({
      action: 'LOGIN_SUCCESS',
      entityType: 'USER',
      entityId: userRow.id,
      actorUserId: userRow.id,
      actorRole: userRow.role,
      actorBranchId: userRow.branch_id,
      ipAddress,
    });

    return { token, user: sessionUser };
  }

  /**
   * Verify and decode a JWT token
   */
  static async verifyToken(token: string): Promise<AuthSessionUser | null> {
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      return payload as unknown as AuthSessionUser;
    } catch {
      return null;
    }
  }

  /**
   * Check if a user has access to a specific branch.
   * - ADMIN & FINANCE have company-wide branch access.
   * - SHOP_USER only has access to their assigned branch.
   */
  static hasBranchAccess(user: AuthSessionUser, branchId: string): boolean {
    if (user.role === 'ADMIN' || user.role === 'FINANCE') {
      return true;
    }
    return user.role === 'SHOP_USER' && user.branch_id === branchId;
  }
}
