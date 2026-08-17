import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/utils/auth-middleware';
import { TransferService } from '@/lib/services/transfers';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const authResult = await requireAuth(req, ['ADMIN', 'SHOP_USER']);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const transferId = params.id;
    if (!transferId) {
      return NextResponse.json({ success: false, error: 'Transfer ID is required.' }, { status: 400 });
    }

    const transfer = TransferService.approveTransfer(transferId, authResult.user);
    return NextResponse.json({
      success: true,
      message: `Transfer #${transferId} successfully approved. Branch stock updated.`,
      transfer,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
