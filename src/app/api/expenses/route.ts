import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/utils/auth-middleware';
import { FinanceService } from '@/lib/services/finance';

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req, ['ADMIN', 'FINANCE']);
  if (authResult instanceof NextResponse) return authResult;

  const url = new URL(req.url);
  const branchId = url.searchParams.get('branchId') || undefined;
  const category = url.searchParams.get('category') as any;
  const startDate = url.searchParams.get('startDate') || undefined;
  const endDate = url.searchParams.get('endDate') || undefined;
  const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : 50;
  const offset = url.searchParams.get('offset') ? parseInt(url.searchParams.get('offset')!) : 0;

  const result = FinanceService.getExpenses({
    branchId,
    category,
    startDate,
    endDate,
    limit,
    offset,
  });

  return NextResponse.json({ success: true, ...result });
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req, ['ADMIN', 'FINANCE']);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await req.json();
    const { branchId, category, amount, description, date, notes } = body;

    if (!category || !amount || !description || !date) {
      return NextResponse.json(
        { success: false, error: 'Category, amount, description, and date are required.' },
        { status: 400 }
      );
    }

    const expense = FinanceService.addExpense({
      branchId,
      category,
      amount: parseFloat(amount),
      description,
      date,
      notes,
      actor: authResult.user,
    });

    return NextResponse.json({ success: true, expense }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
