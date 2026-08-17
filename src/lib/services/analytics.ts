import { getDatabase } from '../db/db';
import { getAddisAbabaBusinessDate } from '../utils/id-generator';

export class AnalyticsService {
  /**
   * Get comprehensive company-wide or branch-specific dashboard KPIs
   */
  static getDashboardSummary(branchId?: string): {
    today: {
      salesCount: number;
      revenue: number;
      simQuantity: number;
      scratchQuantity: number;
      expenses: number;
      profit: number;
    };
    mtd: {
      salesCount: number;
      revenue: number;
      simQuantity: number;
      scratchQuantity: number;
      expenses: number;
      profit: number;
    };
    inventory: {
      centralSimStock: number;
      centralScratchStock: number;
      branchSimStock: number;
      branchScratchStock: number;
      totalStockValue: number;
    };
    operations: {
      pendingApprovals: number;
      rejectedTransfers: number;
      lowStockAlerts: number;
      activeSessions: number;
    };
    alerts: {
      type: 'PENDING_APPROVAL' | 'REJECTED_TRANSFER' | 'LOW_STOCK' | 'UNUSUAL_ACTIVITY';
      severity: 'WARNING' | 'DANGER' | 'INFO';
      title: string;
      message: string;
      link?: string;
    }[];
  } {
    const db = getDatabase();
    const todayDate = getAddisAbabaBusinessDate(); // YYYY-MM-DD
    const mtdStartDate = `${todayDate.substring(0, 7)}-01`;

    const branchFilterSales = branchId ? 'AND s.branch_id = ?' : '';
    const branchFilterExp = branchId ? 'AND e.branch_id = ?' : '';
    const branchFilterBS = branchId ? 'AND bs.branch_id = ?' : '';
    const branchFilterTr = branchId ? 'AND st.destination_branch_id = ?' : '';
    const branchFilterSess = branchId ? 'AND sess.branch_id = ?' : '';

    const paramsToday = branchId ? [todayDate, branchId] : [todayDate];
    const paramsMtd = branchId ? [mtdStartDate, branchId] : [mtdStartDate];

    // Today Sales
    const todaySales = db
      .prepare(`
        SELECT 
          COUNT(*) as salesCount,
          COALESCE(SUM(total_amount), 0) as revenue,
          COALESCE(SUM(profit), 0) as profit,
          COALESCE(SUM(CASE WHEN product_type = 'SIM' THEN quantity ELSE 0 END), 0) as simQuantity,
          COALESCE(SUM(CASE WHEN product_type = 'SCRATCH_CARD' THEN quantity ELSE 0 END), 0) as scratchQuantity
        FROM sales s
        WHERE date(s.created_at) = ? ${branchFilterSales}
      `)
      .get(...paramsToday) as any;

    // Today Expenses
    const todayExpenses = db
      .prepare(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM expenses e
        WHERE e.date = ? ${branchFilterExp}
      `)
      .get(...paramsToday) as any;

    // MTD Sales
    const mtdSales = db
      .prepare(`
        SELECT 
          COUNT(*) as salesCount,
          COALESCE(SUM(total_amount), 0) as revenue,
          COALESCE(SUM(profit), 0) as profit,
          COALESCE(SUM(CASE WHEN product_type = 'SIM' THEN quantity ELSE 0 END), 0) as simQuantity,
          COALESCE(SUM(CASE WHEN product_type = 'SCRATCH_CARD' THEN quantity ELSE 0 END), 0) as scratchQuantity
        FROM sales s
        WHERE date(s.created_at) >= ? ${branchFilterSales}
      `)
      .get(...paramsMtd) as any;

    // MTD Expenses
    const mtdExpenses = db
      .prepare(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM expenses e
        WHERE e.date >= ? ${branchFilterExp}
      `)
      .get(...paramsMtd) as any;

    // Central Stock
    const centralSim = db
      .prepare("SELECT COALESCE(SUM(quantity), 0) as total, COALESCE(SUM(quantity * cost_price), 0) as value FROM central_stock WHERE product_type = 'SIM'")
      .get() as any;

    const centralScratch = db
      .prepare("SELECT COALESCE(SUM(quantity), 0) as total, COALESCE(SUM(quantity * cost_price), 0) as value FROM central_stock WHERE product_type = 'SCRATCH_CARD'")
      .get() as any;

    // Branch Stock
    const branchStockParam = branchId ? [branchId] : [];
    const branchSim = db
      .prepare(`SELECT COALESCE(SUM(quantity), 0) as total, COALESCE(SUM(quantity * cost_price), 0) as value FROM branch_stock bs WHERE bs.product_type = 'SIM' ${branchFilterBS}`)
      .get(...branchStockParam) as any;

    const branchScratch = db
      .prepare(`SELECT COALESCE(SUM(quantity), 0) as total, COALESCE(SUM(quantity * cost_price), 0) as value FROM branch_stock bs WHERE bs.product_type = 'SCRATCH_CARD' ${branchFilterBS}`)
      .get(...branchStockParam) as any;

    // Operations: Pending Approvals, Rejected Transfers, Active Sessions
    const pendingTransfers = db
      .prepare(`SELECT COUNT(*) as count FROM stock_transfers st WHERE st.status = 'SENT' ${branchFilterTr}`)
      .get(...branchStockParam) as any;

    const rejectedTransfers = db
      .prepare(`SELECT COUNT(*) as count FROM stock_transfers st WHERE st.status = 'REJECTED' AND (st.finance_review_status IS NULL OR st.finance_review_status = 'PENDING') ${branchFilterTr}`)
      .get(...branchStockParam) as any;

    const activeSessions = db
      .prepare(`SELECT COUNT(*) as count FROM business_sessions sess WHERE sess.status = 'OPEN' ${branchFilterSess}`)
      .get(...branchStockParam) as any;

    // Low stock items query
    const lowStockBranch = db
      .prepare(`
        SELECT COUNT(*) as count FROM branch_stock bs 
        WHERE bs.quantity <= bs.low_stock_threshold ${branchFilterBS}
      `)
      .get(...branchStockParam) as any;

    const lowStockCentral = db
      .prepare('SELECT COUNT(*) as count FROM central_stock cs WHERE cs.quantity <= cs.low_stock_threshold')
      .get() as any;

    const lowStockAlerts = (lowStockBranch?.count || 0) + (!branchId ? (lowStockCentral?.count || 0) : 0);

    // Dynamic Alert List
    const alerts: any[] = [];

    if (pendingTransfers?.count > 0) {
      alerts.push({
        type: 'PENDING_APPROVAL',
        severity: 'WARNING',
        title: 'Pending Branch Approvals',
        message: `${pendingTransfers.count} stock transfer shipment(s) awaiting branch approval.`,
        link: '/transfers',
      });
    }

    if (rejectedTransfers?.count > 0) {
      alerts.push({
        type: 'REJECTED_TRANSFER',
        severity: 'DANGER',
        title: 'Rejected Shipments Require Review',
        message: `${rejectedTransfers.count} transfer shipment(s) rejected by branches requiring Finance review.`,
        link: '/finance/reviews',
      });
    }

    if (lowStockAlerts > 0) {
      alerts.push({
        type: 'LOW_STOCK',
        severity: 'WARNING',
        title: 'Low Stock Level Alert',
        message: `${lowStockAlerts} inventory line item(s) are at or below minimum safety threshold.`,
        link: '/inventory',
      });
    }

    const todayRev = todaySales?.revenue || 0;
    const todayExp = todayExpenses?.total || 0;
    const todayGrossProf = todaySales?.profit || 0;
    const todayNetProfit = todayGrossProf - todayExp;

    const mtdRev = mtdSales?.revenue || 0;
    const mtdExp = mtdExpenses?.total || 0;
    const mtdGrossProf = mtdSales?.profit || 0;
    const mtdNetProfit = mtdGrossProf - mtdExp;

    const totalStockValue =
      (centralSim?.value || 0) +
      (centralScratch?.value || 0) +
      (branchSim?.value || 0) +
      (branchScratch?.value || 0);

    return {
      today: {
        salesCount: todaySales?.salesCount || 0,
        revenue: todayRev,
        simQuantity: todaySales?.simQuantity || 0,
        scratchQuantity: todaySales?.scratchQuantity || 0,
        expenses: todayExp,
        profit: todayNetProfit,
      },
      mtd: {
        salesCount: mtdSales?.salesCount || 0,
        revenue: mtdRev,
        simQuantity: mtdSales?.simQuantity || 0,
        scratchQuantity: mtdSales?.scratchQuantity || 0,
        expenses: mtdExp,
        profit: mtdNetProfit,
      },
      inventory: {
        centralSimStock: centralSim?.total || 0,
        centralScratchStock: centralScratch?.total || 0,
        branchSimStock: branchSim?.total || 0,
        branchScratchStock: branchScratch?.total || 0,
        totalStockValue,
      },
      operations: {
        pendingApprovals: pendingTransfers?.count || 0,
        rejectedTransfers: rejectedTransfers?.count || 0,
        lowStockAlerts,
        activeSessions: activeSessions?.count || 0,
      },
      alerts,
    };
  }

  /**
   * Daily sales and profit trend (e.g. past 14 or 30 days)
   */
  static getSalesTrend(days = 14, branchId?: string): {
    date: string;
    revenue: number;
    simRevenue: number;
    scratchRevenue: number;
    expenses: number;
    profit: number;
    salesCount: number;
  }[] {
    const db = getDatabase();
    const branchFilterSales = branchId ? 'AND s.branch_id = ?' : '';
    const branchFilterExp = branchId ? 'AND e.branch_id = ?' : '';

    const paramsSales = branchId ? [days, branchId] : [days];
    const paramsExp = branchId ? [days, branchId] : [days];

    const salesByDay = db
      .prepare(`
        SELECT 
          date(s.created_at) as saleDate,
          COUNT(*) as count,
          COALESCE(SUM(total_amount), 0) as revenue,
          COALESCE(SUM(CASE WHEN product_type = 'SIM' THEN total_amount ELSE 0 END), 0) as simRevenue,
          COALESCE(SUM(CASE WHEN product_type = 'SCRATCH_CARD' THEN total_amount ELSE 0 END), 0) as scratchRevenue,
          COALESCE(SUM(profit), 0) as grossProfit
        FROM sales s
        WHERE date(s.created_at) >= date('now', '-' || ? || ' days') ${branchFilterSales}
        GROUP BY date(s.created_at)
        ORDER BY saleDate ASC
      `)
      .all(...paramsSales) as any[];

    const expensesByDay = db
      .prepare(`
        SELECT 
          e.date as expDate,
          COALESCE(SUM(amount), 0) as totalExpenses
        FROM expenses e
        WHERE e.date >= date('now', '-' || ? || ' days') ${branchFilterExp}
        GROUP BY e.date
      `)
      .all(...paramsExp) as any[];

    const expMap = new Map<string, number>();
    for (const exp of expensesByDay) {
      expMap.set(exp.expDate, exp.totalExpenses);
    }

    return salesByDay.map((s) => {
      const exp = expMap.get(s.saleDate) || 0;
      return {
        date: s.saleDate,
        revenue: s.revenue,
        simRevenue: s.simRevenue,
        scratchRevenue: s.scratchRevenue,
        expenses: exp,
        profit: s.grossProfit - exp,
        salesCount: s.count,
      };
    });
  }

  /**
   * Compare performance across all branches
   */
  static getBranchComparison(startDate?: string, endDate?: string): {
    branchId: string;
    branchCode: string;
    branchName: string;
    revenue: number;
    simSales: number;
    scratchSales: number;
    expenses: number;
    profit: number;
    currentSimStock: number;
    currentScratchStock: number;
  }[] {
    const db = getDatabase();
    const today = getAddisAbabaBusinessDate();
    const start = startDate || `${today.substring(0, 7)}-01`; // default MTD
    const end = endDate || today;

    const branches = db.prepare("SELECT id, code, name FROM branches WHERE status = 'ACTIVE' ORDER BY name ASC").all() as any[];

    return branches.map((branch) => {
      const sales = db
        .prepare(`
          SELECT 
            COALESCE(SUM(total_amount), 0) as revenue,
            COALESCE(SUM(CASE WHEN product_type = 'SIM' THEN quantity ELSE 0 END), 0) as simSales,
            COALESCE(SUM(CASE WHEN product_type = 'SCRATCH_CARD' THEN quantity ELSE 0 END), 0) as scratchSales,
            COALESCE(SUM(profit), 0) as grossProfit
          FROM sales
          WHERE branch_id = ? AND date(created_at) BETWEEN ? AND ?
        `)
        .get(branch.id, start, end) as any;

      const exp = db
        .prepare('SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE branch_id = ? AND date BETWEEN ? AND ?')
        .get(branch.id, start, end) as any;

      const simStock = db
        .prepare("SELECT COALESCE(SUM(quantity), 0) as total FROM branch_stock WHERE branch_id = ? AND product_type = 'SIM'")
        .get(branch.id) as any;

      const scratchStock = db
        .prepare("SELECT COALESCE(SUM(quantity), 0) as total FROM branch_stock WHERE branch_id = ? AND product_type = 'SCRATCH_CARD'")
        .get(branch.id) as any;

      const revenue = sales?.revenue || 0;
      const expenses = exp?.total || 0;
      const profit = (sales?.grossProfit || 0) - expenses;

      return {
        branchId: branch.id,
        branchCode: branch.code,
        branchName: branch.name,
        revenue,
        simSales: sales?.simSales || 0,
        scratchSales: sales?.scratchSales || 0,
        expenses,
        profit,
        currentSimStock: simStock?.total || 0,
        currentScratchStock: scratchStock?.total || 0,
      };
    });
  }

  /**
   * Performance breakdown for each Scratch Card denomination
   */
  static getScratchDenominationPerformance(): {
    denominationId: string;
    denominationValue: number;
    incomingQuantity: number;
    sentQuantity: number;
    approvedQuantity: number;
    soldQuantity: number;
    centralStock: number;
    totalBranchStock: number;
    revenue: number;
  }[] {
    const db = getDatabase();
    const denoms = db
      .prepare('SELECT * FROM scratch_denominations ORDER BY display_order ASC, denomination_value ASC')
      .all() as any[];

    return denoms.map((d) => {
      const incoming = db
        .prepare("SELECT COALESCE(SUM(quantity), 0) as total FROM incoming_stock WHERE product_type = 'SCRATCH_CARD' AND denomination_id = ?")
        .get(d.id) as any;

      const sent = db
        .prepare("SELECT COALESCE(SUM(quantity), 0) as total FROM stock_transfers WHERE product_type = 'SCRATCH_CARD' AND denomination_id = ?")
        .get(d.id) as any;

      const approved = db
        .prepare("SELECT COALESCE(SUM(quantity), 0) as total FROM stock_transfers WHERE product_type = 'SCRATCH_CARD' AND denomination_id = ? AND status = 'APPROVED'")
        .get(d.id) as any;

      const sales = db
        .prepare("SELECT COALESCE(SUM(quantity), 0) as totalQty, COALESCE(SUM(total_amount), 0) as totalRev FROM sales WHERE product_type = 'SCRATCH_CARD' AND denomination_id = ?")
        .get(d.id) as any;

      const cs = db
        .prepare("SELECT COALESCE(SUM(quantity), 0) as total FROM central_stock WHERE product_type = 'SCRATCH_CARD' AND denomination_id = ?")
        .get(d.id) as any;

      const bs = db
        .prepare("SELECT COALESCE(SUM(quantity), 0) as total FROM branch_stock WHERE product_type = 'SCRATCH_CARD' AND denomination_id = ?")
        .get(d.id) as any;

      return {
        denominationId: d.id,
        denominationValue: d.denomination_value,
        incomingQuantity: incoming?.total || 0,
        sentQuantity: sent?.total || 0,
        approvedQuantity: approved?.total || 0,
        soldQuantity: sales?.totalQty || 0,
        centralStock: cs?.total || 0,
        totalBranchStock: bs?.total || 0,
        revenue: sales?.totalRev || 0,
      };
    });
  }
}
