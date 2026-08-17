import { getDatabase } from '../db/db';
import { Notification, NotificationType, UserRole } from '../types';
import crypto from 'crypto';

export class NotificationService {
  /**
   * Create a targeted notification
   */
  static create(params: {
    recipientUserId?: string | null;
    recipientRole?: UserRole | null;
    recipientBranchId?: string | null;
    title: string;
    message: string;
    type: NotificationType;
    referenceId?: string | null;
  }): string {
    const db = getDatabase();
    const id = `NOTIF-${crypto.randomUUID()}`;

    const stmt = db.prepare(`
      INSERT INTO notifications (
        id, recipient_user_id, recipient_role, recipient_branch_id,
        title, message, type, reference_id, is_read, created_at
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?, 0, datetime('now', '+3 hours')
      )
    `);

    stmt.run(
      id,
      params.recipientUserId || null,
      params.recipientRole || null,
      params.recipientBranchId || null,
      params.title,
      params.message,
      params.type,
      params.referenceId || null
    );

    return id;
  }

  /**
   * Get notifications for a user based on their specific ID, Role, or Branch
   */
  static getUserNotifications(user: {
    id: string;
    role: UserRole;
    branch_id: string | null;
  }): { notifications: Notification[]; unreadCount: number } {
    const db = getDatabase();

    const notifications = db
      .prepare(`
        SELECT * FROM notifications
        WHERE (
          recipient_user_id = ?
          OR (recipient_role = ? AND (recipient_branch_id IS NULL OR recipient_branch_id = ?))
          OR (recipient_role IS NULL AND recipient_branch_id = ?)
          OR (recipient_user_id IS NULL AND recipient_role IS NULL AND recipient_branch_id IS NULL)
        )
        ORDER BY created_at DESC
        LIMIT 100
      `)
      .all(user.id, user.role, user.branch_id, user.branch_id) as Notification[];

    const unreadRow = db
      .prepare(`
        SELECT COUNT(*) as count FROM notifications
        WHERE is_read = 0 AND (
          recipient_user_id = ?
          OR (recipient_role = ? AND (recipient_branch_id IS NULL OR recipient_branch_id = ?))
          OR (recipient_role IS NULL AND recipient_branch_id = ?)
          OR (recipient_user_id IS NULL AND recipient_role IS NULL AND recipient_branch_id IS NULL)
        )
      `)
      .get(user.id, user.role, user.branch_id, user.branch_id) as { count: number };

    return {
      notifications,
      unreadCount: unreadRow?.count || 0,
    };
  }

  /**
   * Mark a notification as read
   */
  static markAsRead(id: string): void {
    const db = getDatabase();
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(id);
  }

  /**
   * Mark all notifications for a user as read
   */
  static markAllAsRead(user: {
    id: string;
    role: UserRole;
    branch_id: string | null;
  }): void {
    const db = getDatabase();
    db.prepare(`
      UPDATE notifications SET is_read = 1
      WHERE is_read = 0 AND (
        recipient_user_id = ?
        OR (recipient_role = ? AND (recipient_branch_id IS NULL OR recipient_branch_id = ?))
        OR (recipient_role IS NULL AND recipient_branch_id = ?)
      )
    `).run(user.id, user.role, user.branch_id, user.branch_id);
  }
}
