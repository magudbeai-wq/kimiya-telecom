import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/utils/auth-middleware';
import { SalesService } from '@/lib/services/sales';

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  const url = new URL(req.url);
  let branchId = url.searchParams.get('branchId') || undefined;
  const sessionId = url.searchParams.get('sessionId') || undefined;
  const productType = url.searchParams.get('productType') as any;
  const denominationId = url.searchParams.get('denominationId') || undefined;
  const userId = url.searchParams.get('userId') || undefined;
  const startDate = url.searchParams.get('startDate') || undefined;
  const endDate = url.searchParams.get('endDate') || undefined;
  const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : 50;
  const offset = url.searchParams.get('offset') ? parseInt(url.searchParams.get('offset')!) : 0;

  // Enforce branch isolation for SHOP_USER
  if (authResult.user.role === 'SHOP_USER') {
    branchId = authResult.user.branch_id || undefined;
  }

  const result = SalesService.getSales({
    branchId,
    sessionId,
    productType,
    denominationId,
    userId,
    startDate,
    endDate,
    limit,
    offset,
  });

  return NextResponse.json({ success: true, ...result });
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req, ['ADMIN', 'SHOP_USER']);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await req.json();
    let { branchId, productType, denominationId, quantity, unitPrice } = body;

    // Enforce branch isolation for SHOP_USER
    if (authResult.user.role === 'SHOP_USER') {
      branchId = authResult.user.branch_id;
    }

    if (!branchId || !productType || !quantity) {
      return NextResponse.json(
        { success: false, error: 'Branch ID, product type, and quantity are required.' },
        { status: 400 }
      );
    }

    const sale = SalesService.processSale({
      branchId,
      productType,
      denominationId,
      quantity: parseInt(quantity),
      unitPrice: unitPrice ? parseFloat(unitPrice) : undefined,
      actor: authResult.user,
    });

    return NextResponse.json({
      success: true,
      message: `Sale #${sale.id} completed. Total: ${sale.total_amount.toLocaleString()} ETB.`,
      sale,
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
