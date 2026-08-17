import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/utils/auth-middleware';
import { ReportService, ReportMetadata } from '@/lib/services/reports';
import { SalesService } from '@/lib/services/sales';
import { InventoryService } from '@/lib/services/inventory';
import { TransferService } from '@/lib/services/transfers';
import { FinanceService } from '@/lib/services/finance';
import { BranchService } from '@/lib/services/branch';

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await req.json();
    const { reportType, format, branchId, startDate, endDate, productType } = body;

    if (!reportType || !format || !['EXCEL', 'PDF'].includes(format)) {
      return NextResponse.json(
        { success: false, error: 'Valid reportType and format (EXCEL, PDF) are required.' },
        { status: 400 }
      );
    }

    let branchName = 'All Branches';
    if (branchId) {
      const b = BranchService.getBranchById(branchId);
      if (b) branchName = b.name;
    }

    const metadata: ReportMetadata = {
      reportTitle: `${reportType.replace(/_/g, ' ')} REPORT`,
      generatedBy: `${authResult.user.full_name} (${authResult.user.role})`,
      branchName,
      startDate,
      endDate,
    };

    let columns: any[] = [];
    let rows: Record<string, any>[] = [];
    const timestampStr = new Date().toISOString().substring(0, 10);
    const fileName = `KIMIYA_${reportType}_${timestampStr}.${format === 'EXCEL' ? 'xlsx' : 'pdf'}`;

    if (reportType === 'SALES' || reportType === 'SIM_SALES' || reportType === 'SCRATCH_SALES') {
      const pType = reportType === 'SIM_SALES' ? 'SIM' : reportType === 'SCRATCH_SALES' ? 'SCRATCH_CARD' : productType;
      const salesResult = SalesService.getSales({
        branchId,
        productType: pType,
        startDate,
        endDate,
        limit: 1000,
      });

      columns = [
        { header: 'Sale ID', key: 'id', dataKey: 'id', width: 22 },
        { header: 'Date & Time', key: 'created_at', dataKey: 'created_at', width: 20 },
        { header: 'Branch', key: 'branch_name', dataKey: 'branch_name', width: 18 },
        { header: 'Product', key: 'product_type', dataKey: 'product_type', width: 15 },
        { header: 'Denomination', key: 'denom_display', dataKey: 'denom_display', width: 15 },
        { header: 'Qty', key: 'quantity', dataKey: 'quantity', width: 10, isNumber: true },
        { header: 'Unit Price', key: 'unit_price', dataKey: 'unit_price', width: 15, isCurrency: true },
        { header: 'Total (ETB)', key: 'total_amount', dataKey: 'total_amount', width: 18, isCurrency: true },
        { header: 'Profit (ETB)', key: 'profit', dataKey: 'profit', width: 18, isCurrency: true },
      ];

      rows = salesResult.sales.map((s) => ({
        ...s,
        denom_display: s.denomination_value ? `${s.denomination_value} ETB` : 'N/A',
      }));
    } else if (reportType === 'CENTRAL_STOCK') {
      const stock = InventoryService.getCentralStock();
      columns = [
        { header: 'Stock ID', key: 'id', dataKey: 'id', width: 18 },
        { header: 'Product', key: 'product_type', dataKey: 'product_type', width: 16 },
        { header: 'Denomination', key: 'denom_display', dataKey: 'denom_display', width: 16 },
        { header: 'Quantity', key: 'quantity', dataKey: 'quantity', width: 14, isNumber: true },
        { header: 'Cost Price (ETB)', key: 'cost_price', dataKey: 'cost_price', width: 16, isCurrency: true },
        { header: 'Selling Price (ETB)', key: 'selling_price', dataKey: 'selling_price', width: 16, isCurrency: true },
        { header: 'Total Valuation (ETB)', key: 'valuation', dataKey: 'valuation', width: 20, isCurrency: true },
      ];

      rows = stock.map((st) => ({
        ...st,
        denom_display: st.denomination_value ? `${st.denomination_value} ETB` : 'N/A',
        valuation: st.quantity * st.cost_price,
      }));
    } else if (reportType === 'BRANCH_STOCK') {
      const stock = InventoryService.getBranchStock(branchId);
      columns = [
        { header: 'Branch', key: 'branch_name', dataKey: 'branch_name', width: 18 },
        { header: 'Product', key: 'product_type', dataKey: 'product_type', width: 16 },
        { header: 'Denomination', key: 'denom_display', dataKey: 'denom_display', width: 16 },
        { header: 'Quantity', key: 'quantity', dataKey: 'quantity', width: 14, isNumber: true },
        { header: 'Selling Price (ETB)', key: 'selling_price', dataKey: 'selling_price', width: 16, isCurrency: true },
        { header: 'Total Value (ETB)', key: 'valuation', dataKey: 'valuation', width: 20, isCurrency: true },
      ];

      rows = stock.map((st) => ({
        ...st,
        denom_display: st.denomination_value ? `${st.denomination_value} ETB` : 'N/A',
        valuation: st.quantity * st.selling_price,
      }));
    } else if (reportType === 'TRANSFERS') {
      const transferResult = TransferService.getTransfers({
        branchId,
        productType,
        startDate,
        endDate,
        limit: 1000,
      });

      columns = [
        { header: 'Transfer ID', key: 'id', dataKey: 'id', width: 24 },
        { header: 'Product', key: 'product_type', dataKey: 'product_type', width: 15 },
        { header: 'Denomination', key: 'denom_display', dataKey: 'denom_display', width: 15 },
        { header: 'Destination', key: 'destination_branch_name', dataKey: 'destination_branch_name', width: 18 },
        { header: 'Quantity', key: 'quantity', dataKey: 'quantity', width: 12, isNumber: true },
        { header: 'Status', key: 'status', dataKey: 'status', width: 15 },
        { header: 'Sent By', key: 'sent_by_user_name', dataKey: 'sent_by_user_name', width: 18 },
        { header: 'Sent At', key: 'sent_at', dataKey: 'sent_at', width: 20 },
      ];

      rows = transferResult.transfers.map((t) => ({
        ...t,
        denom_display: t.denomination_value ? `${t.denomination_value} ETB` : 'N/A',
      }));
    } else if (reportType === 'EXPENSES') {
      const expResult = FinanceService.getExpenses({
        branchId,
        startDate,
        endDate,
        limit: 1000,
      });

      columns = [
        { header: 'Expense ID', key: 'id', dataKey: 'id', width: 20 },
        { header: 'Date', key: 'date', dataKey: 'date', width: 14 },
        { header: 'Branch', key: 'branch_display', dataKey: 'branch_display', width: 18 },
        { header: 'Category', key: 'category', dataKey: 'category', width: 16 },
        { header: 'Description', key: 'description', dataKey: 'description', width: 30 },
        { header: 'Amount (ETB)', key: 'amount', dataKey: 'amount', width: 18, isCurrency: true },
        { header: 'Created By', key: 'created_by_user_name', dataKey: 'created_by_user_name', width: 18 },
      ];

      rows = expResult.expenses.map((e) => ({
        ...e,
        branch_display: e.branch_name || 'Head Office / Central',
      }));
    }

    if (format === 'EXCEL') {
      const excelBuffer = await ReportService.generateExcelReport(metadata, columns, rows);
      return new NextResponse(excelBuffer as any, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${fileName}"`,
        },
      });
    } else {
      const pdfBuffer = ReportService.generatePdfReport(metadata, columns, rows);
      return new NextResponse(pdfBuffer as any, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${fileName}"`,
        },
      });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
