import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/utils/auth-middleware';
import { TransferService } from '@/lib/services/transfers';

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  const url = new URL(req.url);
  let branchId = url.searchParams.get('branchId') || undefined;
  const productType = url.searchParams.get('productType') as any;
  const status = url.searchParams.get('status') || undefined;
  const financeReviewStatus = url.searchParams.get('financeReviewStatus') || undefined;
  const startDate = url.searchParams.get('startDate') || undefined;
  const endDate = url.searchParams.get('endDate') || undefined;
  const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : 50;
  const offset = url.searchParams.get('offset') ? parseInt(url.searchParams.get('offset')!) : 0;

  // Enforce branch isolation for SHOP_USER
  if (authResult.user.role === 'SHOP_USER') {
    branchId = authResult.user.branch_id || undefined;
  }

  const result = TransferService.getTransfers({
    branchId,
    productType,
    status,
    financeReviewStatus,
    startDate,
    endDate,
    limit,
    offset,
  });

  return NextResponse.json({ success: true, ...result });
}
