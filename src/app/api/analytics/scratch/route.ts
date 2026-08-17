import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/utils/auth-middleware';
import { AnalyticsService } from '@/lib/services/analytics';

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req, ['ADMIN', 'FINANCE']);
  if (authResult instanceof NextResponse) return authResult;

  const performance = AnalyticsService.getScratchDenominationPerformance();
  return NextResponse.json({ success: true, performance });
}
