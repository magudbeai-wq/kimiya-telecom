import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/utils/auth-middleware';
import { BusinessSessionService } from '@/lib/services/sessions';

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req, ['ADMIN', 'SHOP_USER']);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await req.json();
    let { branchId, openingNotes } = body;

    // For Shop User, force branchId to their assigned branch
    if (authResult.user.role === 'SHOP_USER') {
      branchId = authResult.user.branch_id;
    }

    if (!branchId) {
      return NextResponse.json({ success: false, error: 'Branch ID is required.' }, { status: 400 });
    }

    const session = BusinessSessionService.openSession({
      branchId,
      openingNotes,
      actor: authResult.user,
    });

    return NextResponse.json({
      success: true,
      message: `Business day successfully opened (#${session.id}).`,
      session,
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
