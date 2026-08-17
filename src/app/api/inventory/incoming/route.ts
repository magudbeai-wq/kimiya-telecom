import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/utils/auth-middleware';
import { InventoryService } from '@/lib/services/inventory';

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req, ['ADMIN', 'FINANCE']);
  if (authResult instanceof NextResponse) return authResult;

  const url = new URL(req.url);
  const productType = url.searchParams.get('productType') as any;
  const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : 50;

  const history = InventoryService.getIncomingHistory(productType, limit);
  return NextResponse.json({ success: true, history });
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req, ['ADMIN', 'FINANCE']);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await req.json();
    const { productType, denominationId, quantity, unitCost, supplierName, referenceNumber, notes } =
      body;

    if (!productType || !quantity || unitCost === undefined || !supplierName || !referenceNumber) {
      return NextResponse.json(
        {
          success: false,
          error: 'Product type, quantity, unit cost, supplier name, and reference number are required.',
        },
        { status: 400 }
      );
    }

    const incoming = InventoryService.receiveIncomingStock({
      productType,
      denominationId,
      quantity: parseInt(quantity),
      unitCost: parseFloat(unitCost),
      supplierName,
      referenceNumber,
      notes,
      actor: authResult.user,
    });

    return NextResponse.json({ success: true, incoming }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
