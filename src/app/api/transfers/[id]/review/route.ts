import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/utils/auth-middleware';
import { TransferService } from '@/lib/services/transfers';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const authResult = await requireAuth(req, ['ADMIN', 'FINANCE']);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const transferId = params.id;
    const body = await req.json();
    const { action, correctedQuantity, notes } = body;

    if (!transferId || !action || !['RESOLVE', 'CANCEL', 'RESEND'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Valid action (RESOLVE, CANCEL, RESEND) is required.' },
        { status: 400 }
      );
    }

    const result = TransferService.financeReviewTransfer({
      transferId,
      action,
      correctedQuantity: correctedQuantity ? parseInt(correctedQuantity) : undefined,
      notes,
      actor: authResult.user,
    });

    return NextResponse.json({
      success: true,
      message: `Transfer #${transferId} review processed with action '${action}'.`,
      ...result,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
