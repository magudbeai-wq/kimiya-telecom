import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/utils/auth-middleware';
import { BackupService } from '@/lib/services/backup';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const authResult = await requireAuth(req, ['ADMIN', 'FINANCE']);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const backupId = params.id;
    if (!backupId) {
      return NextResponse.json({ success: false, error: 'Backup ID is required.' }, { status: 400 });
    }

    const verification = BackupService.verifyRestore(backupId);
    return NextResponse.json({
      success: true,
      message: `Backup #${backupId} restoration and integrity verification completed: ${verification.verified ? 'ALL CHECKS PASSED' : 'INTEGRITY ISSUES DETECTED'}.`,
      verification,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
