import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/utils/auth-middleware';
import { BusinessSessionService } from '@/lib/services/sessions';

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req, ['ADMIN', 'FINANCE', 'SHOP_USER']);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await req.json();
    const { sessionId, closingNotes } = body;

    if (!sessionId) {
      return NextResponse.json({ success: false, error: 'Session ID is required.' }, { status: 400 });
    }

    const isOverride = authResult.user.role === 'ADMIN' || authResult.user.role === 'FINANCE';

    const session = BusinessSessionService.closeSession({
      sessionId,
      closingNotes,
      isOverride,
      actor: authResult.user,
    });

    return NextResponse.json({
      success: true,
      message: `Business day session #${sessionId} closed. Revenue: ${session.total_revenue.toLocaleString()} ETB.`,
      session,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
