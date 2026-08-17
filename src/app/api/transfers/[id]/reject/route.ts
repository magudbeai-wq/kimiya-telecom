import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/utils/auth-middleware';
import { TransferService } from '@/lib/services/transfers';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const authResult = await requireAuth(req, ['ADMIN', 'SHOP_USER']);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const transferId = params.id;
    const body = await req.json();
    const { reasonCode, reasonText } = body;

    if (!transferId || !reasonCode) {
      return NextResponse.json(
        { success: false, error: 'Transfer ID and rejection reason code are required.' },
        { status: 400 }
      );
    }

    const transfer = TransferService.rejectTransfer({
      transferId,
      reasonCode,
      reasonText,
      actor: authResult.user,
    });

    return NextResponse.json({
      success: true,
      message: `Transfer #${transferId} rejected. Finance has been notified for review.`,
      transfer,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
