import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/utils/auth-middleware';
import { InventoryService } from '@/lib/services/inventory';

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req, ['ADMIN', 'FINANCE']);
  if (authResult instanceof NextResponse) return authResult;

  const centralStock = InventoryService.getCentralStock();
  return NextResponse.json({ success: true, centralStock });
}
