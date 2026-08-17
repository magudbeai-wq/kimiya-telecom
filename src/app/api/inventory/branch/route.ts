import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireBranchAccess } from '@/lib/utils/auth-middleware';
import { InventoryService } from '@/lib/services/inventory';

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  const url = new URL(req.url);
  let branchId = url.searchParams.get('branchId') || undefined;

  // Enforce branch isolation for SHOP_USER
  if (authResult.user.role === 'SHOP_USER') {
    if (!authResult.user.branch_id) {
      return NextResponse.json(
        { success: false, error: 'Shop user is not assigned to any branch.' },
        { status: 403 }
      );
    }
    // Override requested branchId to user's assigned branch
    branchId = authResult.user.branch_id;
  } else if (branchId) {
    const branchCheck = requireBranchAccess(authResult.user, branchId);
    if (branchCheck) return branchCheck;
  }

  const branchStock = InventoryService.getBranchStock(branchId);
  return NextResponse.json({ success: true, branchStock });
}
