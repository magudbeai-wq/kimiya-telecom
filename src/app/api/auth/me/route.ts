import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/utils/auth-middleware';

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  return NextResponse.json({
    success: true,
    user: authResult.user,
  });
}
