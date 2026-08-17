import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/utils/auth-middleware';
import { TransferService } from '@/lib/services/transfers';

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req, ['ADMIN', 'FINANCE']);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await req.json();
    const { productType, denominationId, destinationBranchId, quantity, notes, referenceTransferId } =
      body;

    if (!productType || !destinationBranchId || !quantity) {
      return NextResponse.json(
        {
          success: false,
          error: 'Product type, destination branch ID, and quantity are required.',
        },
        { status: 400 }
      );
    }

    const transfer = TransferService.dispatchTransfer({
      productType,
      denominationId,
      destinationBranchId,
      quantity: parseInt(quantity),
      notes,
      referenceTransferId,
      actor: authResult.user,
    });

    return NextResponse.json({ success: true, transfer }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
