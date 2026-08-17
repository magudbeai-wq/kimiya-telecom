import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/utils/auth-middleware';
import { InventoryService } from '@/lib/services/inventory';

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  const denominations = InventoryService.getScratchDenominations();
  return NextResponse.json({ success: true, denominations });
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req, ['ADMIN', 'FINANCE']);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await req.json();
    const { denominationValue, displayOrder } = body;

    if (!denominationValue || isNaN(parseInt(denominationValue))) {
      return NextResponse.json(
        { success: false, error: 'Valid denomination integer value is required.' },
        { status: 400 }
      );
    }

    const denom = InventoryService.createScratchDenomination(
      parseInt(denominationValue),
      displayOrder ? parseInt(displayOrder) : 0,
      authResult.user
    );

    return NextResponse.json({ success: true, denomination: denom }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
