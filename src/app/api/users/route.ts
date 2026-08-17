import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/utils/auth-middleware';
import { UserService } from '@/lib/services/user';

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req, ['ADMIN', 'FINANCE']);
  if (authResult instanceof NextResponse) return authResult;

  const url = new URL(req.url);
  const role = url.searchParams.get('role') as any;
  const branchId = url.searchParams.get('branchId') || undefined;
  const status = url.searchParams.get('status') as any;

  const users = UserService.getUsers({ role, branchId, status });
  return NextResponse.json({ success: true, users });
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req, ['ADMIN']);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await req.json();
    const { username, fullName, email, password, role, branchId } = body;

    if (!username || !fullName || !email || !password || !role) {
      return NextResponse.json(
        { success: false, error: 'Username, full name, email, password, and role are required.' },
        { status: 400 }
      );
    }

    const user = await UserService.createUser(
      { username, fullName, email, password, role, branchId },
      authResult.user
    );

    return NextResponse.json({ success: true, user }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  const authResult = await requireAuth(req, ['ADMIN']);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await req.json();
    const { id, fullName, email, password, role, branchId, status } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'User ID is required.' }, { status: 400 });
    }

    const user = await UserService.updateUser(
      id,
      { fullName, email, password, role, branchId, status },
      authResult.user
    );

    return NextResponse.json({ success: true, user });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
