import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/utils/auth-middleware';
import { FinanceService } from '@/lib/services/finance';

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req, ['ADMIN', 'FINANCE']);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await req.json();
    const { locationType, branchId, productType, denominationId, physicalCount, reason } = body;

    if (!locationType || !productType || physicalCount === undefined || !reason) {
      return NextResponse.json(
        {
          success: false,
          error: 'Location type, product type, physical count, and mandatory reason are required.',
        },
        { status: 400 }
      );
    }

    const result = FinanceService.reconcileStock({
      locationType,
      branchId,
      productType,
      denominationId,
      physicalCount: parseInt(physicalCount),
      reason,
      actor: authResult.user,
    });

    return NextResponse.json({
      success: true,
      message: `Stock reconciliation adjustment recorded successfully (Variance: ${result.difference > 0 ? '+' : ''}${result.difference}).`,
      ...result,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
