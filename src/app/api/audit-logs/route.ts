import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/utils/auth-middleware';
import { AuditService } from '@/lib/services/audit';

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req, ['ADMIN', 'FINANCE']);
  if (authResult instanceof NextResponse) return authResult;

  const url = new URL(req.url);
  const entityType = url.searchParams.get('entityType') || undefined;
  const entityId = url.searchParams.get('entityId') || undefined;
  const action = url.searchParams.get('action') || undefined;
  const actorUserId = url.searchParams.get('actorUserId') || undefined;
  const startDate = url.searchParams.get('startDate') || undefined;
  const endDate = url.searchParams.get('endDate') || undefined;
  const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : 50;
  const offset = url.searchParams.get('offset') ? parseInt(url.searchParams.get('offset')!) : 0;

  const result = AuditService.getLogs({
    entityType,
    entityId,
    action,
    actorUserId,
    startDate,
    endDate,
    limit,
    offset,
  });

  return NextResponse.json({ success: true, ...result });
}
