import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/utils/auth-middleware';
import { AnalyticsService } from '@/lib/services/analytics';

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  const url = new URL(req.url);
  let branchId = url.searchParams.get('branchId') || undefined;
  const days = url.searchParams.get('days') ? parseInt(url.searchParams.get('days')!) : 14;

  if (authResult.user.role === 'SHOP_USER') {
    branchId = authResult.user.branch_id || undefined;
  }

  const trend = AnalyticsService.getSalesTrend(days, branchId);
  return NextResponse.json({ success: true, trend });
}
