import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/utils/auth-middleware';
import { FinanceService } from '@/lib/services/finance';

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req, ['ADMIN', 'FINANCE']);
  if (authResult instanceof NextResponse) return authResult;

  const url = new URL(req.url);
  const branchId = url.searchParams.get('branchId') || undefined;
  const startDate = url.searchParams.get('startDate') || undefined;
  const endDate = url.searchParams.get('endDate') || undefined;

  const statement = FinanceService.getFinancialStatement({
    branchId,
    startDate,
    endDate,
  });

  return NextResponse.json({ success: true, statement });
}
