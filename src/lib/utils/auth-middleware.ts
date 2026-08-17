import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '../services/auth';
import { AuthSessionUser, UserRole } from '../types';

export interface AuthenticatedRequest extends NextRequest {
  user?: AuthSessionUser;
}

/**
 * Extracts and verifies the session user from cookies or Authorization header
 */
export async function getAuthUser(req: NextRequest): Promise<AuthSessionUser | null> {
  const cookieToken = req.cookies.get('kimiya_session')?.value;
  const headerToken = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const token = cookieToken || headerToken;

  if (!token) {
    return null;
  }

  return AuthService.verifyToken(token);
}

/**
 * Route protection helper ensuring user is logged in and belongs to allowed roles
 */
export async function requireAuth(
  req: NextRequest,
  allowedRoles?: UserRole[]
): Promise<{ user: AuthSessionUser } | NextResponse> {
  const user = await getAuthUser(req);

  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized: Authentication required' }, { status: 401 });
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return NextResponse.json(
      { success: false, error: `Forbidden: Insufficient privileges. Required: ${allowedRoles.join(', ')}` },
      { status: 403 }
    );
  }

  return { user };
}

/**
 * Ensures a SHOP_USER cannot access another branch's operational data (Anti-IDOR / Anti-Tampering)
 */
export function requireBranchAccess(
  user: AuthSessionUser,
  targetBranchId: string
): NextResponse | null {
  if (!AuthService.hasBranchAccess(user, targetBranchId)) {
    return NextResponse.json(
      {
        success: false,
        error: 'Forbidden: Access denied to branch operational data (Branch Isolation Enforced)',
      },
      { status: 403 }
    );
  }
  return null;
}
