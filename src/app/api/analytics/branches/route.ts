import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/utils/auth-middleware';
import { AnalyticsService } from '@/lib/services/analytics';

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req, ['ADMIN', 'FINANCE']);
  if (authResult instanceof NextResponse) return authResult;

  const url = new URL(req.url);
  const startDate = url.searchParams.get('startDate') || undefined;
  const endDate = url.searchParams.get('endDate') || undefined;

  const comparison = AnalyticsService.getBranchComparison(startDate, endDate);
  return NextResponse.json({ success: true, comparison });
}
