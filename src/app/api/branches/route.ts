import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/utils/auth-middleware';
import { BranchService } from '@/lib/services/branch';

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  const url = new URL(req.url);
  const includeDisabled = url.searchParams.get('includeDisabled') === 'true';

  const branches = BranchService.getBranches(includeDisabled);
  return NextResponse.json({ success: true, branches });
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req, ['ADMIN']);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await req.json();
    const { code, name, location } = body;

    if (!code || !name || !location) {
      return NextResponse.json(
        { success: false, error: 'Code, name, and location are required.' },
        { status: 400 }
      );
    }

    const branch = BranchService.createBranch({ code, name, location }, authResult.user);
    return NextResponse.json({ success: true, branch }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  const authResult = await requireAuth(req, ['ADMIN']);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await req.json();
    const { id, name, location, status } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Branch ID is required.' }, { status: 400 });
    }

    const branch = BranchService.updateBranch(id, { name, location, status }, authResult.user);
    return NextResponse.json({ success: true, branch });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
