import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/utils/auth-middleware';
import { BusinessSessionService } from '@/lib/services/sessions';

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  const url = new URL(req.url);
  let branchId = url.searchParams.get('branchId') || undefined;
  const activeOnly = url.searchParams.get('activeOnly') === 'true';
  const status = url.searchParams.get('status') || undefined;
  const startDate = url.searchParams.get('startDate') || undefined;
  const endDate = url.searchParams.get('endDate') || undefined;
  const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : 50;
  const offset = url.searchParams.get('offset') ? parseInt(url.searchParams.get('offset')!) : 0;

  // Enforce branch isolation for SHOP_USER
  if (authResult.user.role === 'SHOP_USER') {
    branchId = authResult.user.branch_id || undefined;
  }

  if (activeOnly && branchId) {
    const activeSession = BusinessSessionService.getActiveSession(branchId);
    return NextResponse.json({ success: true, activeSession });
  }

  const result = BusinessSessionService.getSessions({
    branchId,
    status,
    startDate,
    endDate,
    limit,
    offset,
  });

  return NextResponse.json({ success: true, ...result });
}
