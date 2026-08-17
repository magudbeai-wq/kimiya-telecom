import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/utils/auth-middleware';
import { BackupService } from '@/lib/services/backup';

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req, ['ADMIN', 'FINANCE']);
  if (authResult instanceof NextResponse) return authResult;

  const backups = BackupService.getBackups();
  return NextResponse.json({ success: true, backups });
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req, ['ADMIN', 'FINANCE']);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const backup = await BackupService.createBackup();
    return NextResponse.json({
      success: true,
      message: `Database backup created successfully (${backup.file_name}).`,
      backup,
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
