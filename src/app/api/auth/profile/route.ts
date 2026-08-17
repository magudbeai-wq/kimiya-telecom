import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDatabase, runImmediateTransaction } from '@/lib/db/db';
import { requireAuth } from '@/lib/utils/auth-middleware';
import { AuditService } from '@/lib/services/audit';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const user = authResult.user;

    const db = getDatabase();
    const row = db
      .prepare(`
        SELECT u.id, u.username, u.full_name, u.email, u.role, u.branch_id, u.status, u.created_at,
               b.name as branch_name, b.code as branch_code
        FROM users u
        LEFT JOIN branches b ON u.branch_id = b.id
        WHERE u.id = ?
      `)
      .get(user.id);

    return NextResponse.json({ success: true, user: row });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const currentUser = authResult.user;

    const body = await request.json();
    const { username, fullName, email, currentPassword, newPassword } = body;

    const db = getDatabase();
    const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(currentUser.id) as any;
    if (!userRow) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Validate new username uniqueness
    if (username && username.trim().toLowerCase() !== userRow.username.toLowerCase()) {
      const existingUser = db
        .prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND id != ?')
        .get(username.trim(), currentUser.id);

      if (existingUser) {
        return NextResponse.json(
          { success: false, error: `Username '${username.trim()}' is already taken by another user.` },
          { status: 400 }
        );
      }
    }

    // Validate new email uniqueness
    if (email && email.trim().toLowerCase() !== userRow.email.toLowerCase()) {
      const existingEmail = db
        .prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id != ?')
        .get(email.trim(), currentUser.id);

      if (existingEmail) {
        return NextResponse.json(
          { success: false, error: `Email '${email.trim()}' is already registered.` },
          { status: 400 }
        );
      }
    }

    // If changing password, verify current password
    let passwordHash = userRow.password_hash;
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { success: false, error: 'Current password is required to set a new password.' },
          { status: 400 }
        );
      }

      const isCurrentValid = await bcrypt.compare(currentPassword, userRow.password_hash);
      if (!isCurrentValid) {
        return NextResponse.json(
          { success: false, error: 'Current password entered is incorrect.' },
          { status: 400 }
        );
      }

      if (newPassword.length < 6) {
        return NextResponse.json(
          { success: false, error: 'New password must be at least 6 characters long.' },
          { status: 400 }
        );
      }

      passwordHash = await bcrypt.hash(newPassword, 10);
    }

    const updatedUsername = username ? username.trim() : userRow.username;
    const updatedFullName = fullName ? fullName.trim() : userRow.full_name;
    const updatedEmail = email ? email.trim().toLowerCase() : userRow.email;

    runImmediateTransaction((dbInstance) => {
      dbInstance
        .prepare(`
          UPDATE users
          SET username = ?, full_name = ?, email = ?, password_hash = ?
          WHERE id = ?
        `)
        .run(updatedUsername, updatedFullName, updatedEmail, passwordHash, currentUser.id);

      AuditService.log({
        action: 'USER_PROFILE_UPDATED',
        entityType: 'USER',
        entityId: currentUser.id,
        actorUserId: currentUser.id,
        actorRole: currentUser.role,
        actorBranchId: currentUser.branch_id || null,
        oldValues: {
          username: userRow.username,
          fullName: userRow.full_name,
          email: userRow.email,
          passwordChanged: Boolean(newPassword),
        },
        newValues: {
          username: updatedUsername,
          fullName: updatedFullName,
          email: updatedEmail,
          passwordChanged: Boolean(newPassword),
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: 'Account credentials updated successfully! Please use your new username/password for future logins.',
      user: {
        id: currentUser.id,
        username: updatedUsername,
        full_name: updatedFullName,
        email: updatedEmail,
        role: currentUser.role,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
