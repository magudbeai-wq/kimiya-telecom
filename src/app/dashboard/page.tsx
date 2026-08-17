'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import {
  DollarSign,
  ShoppingCart,
  Boxes,
  ArrowLeftRight,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Smartphone,
  CreditCard,
  Building2,
  CalendarCheck,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
} from 'recharts';

export default function DashboardPage() {
  const { user, activeSession } = useAuth();
  const [data, setData] = useState<any>(null);
  const [trend, setTrend] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [dashRes, trendRes, branchRes] = await Promise.all([
        fetch('/api/analytics/dashboard'),
        fetch('/api/analytics/trend?days=14'),
        user?.role !== 'SHOP_USER' ? fetch('/api/analytics/branches') : Promise.resolve(null),
      ]);

      if (dashRes.ok) {
        const dashJson = await dashRes.json();
        setData(dashJson.dashboard);
      }
      if (trendRes.ok) {
        const trendJson = await trendRes.json();
        setTrend(trendJson.trend || []);
      }
      if (branchRes && branchRes.ok) {
        const branchJson = await branchRes.json();
        setBranches(branchJson.comparison || []);
      }
    } catch (err) {
      console.error('Error fetching dashboard metrics', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  if (loading && !data) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  const today = data?.today || {};
  const mtd = data?.mtd || {};
  const inventory = data?.inventory || {};
  const operations = data?.operations || {};
  const alerts = data?.alerts || [];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg shadow-blue-600/15">
        <div>
          <span className="inline-block px-2.5 py-0.5 rounded-full bg-white/20 text-[11px] font-bold tracking-wider uppercase mb-2 backdrop-blur-sm">
            {user?.role === 'ADMIN' ? 'HQ Administrator' : user?.role === 'FINANCE' ? 'Central Finance Store' : `${user?.branch_name} Branch`}
          </span>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight">
            Welcome back, {user?.full_name}
          </h2>
          <p className="text-xs text-blue-100 mt-1 max-w-xl">
            Live enterprise distribution dashboard. Real-time synchronized stock, sales, and financial ledger data.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {user?.role === 'SHOP_USER' ? (
            <>
              <Link
                href="/sales?type=SIM"
                className="px-3.5 py-2 rounded-xl bg-white text-blue-700 font-bold text-xs shadow hover:bg-blue-50 transition-all flex items-center gap-1.5"
              >
                <Smartphone className="h-4 w-4" />
                Sell SIM
              </Link>
              <Link
                href="/sales?type=SCRATCH_CARD"
                className="px-3.5 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-bold text-xs transition-all flex items-center gap-1.5"
              >
                <CreditCard className="h-4 w-4" />
                Sell Scratch Card
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/transfers"
                className="px-3.5 py-2 rounded-xl bg-white text-blue-700 font-bold text-xs shadow hover:bg-blue-50 transition-all flex items-center gap-1.5"
              >
                <ArrowLeftRight className="h-4 w-4" />
                Send Transfer
              </Link>
              <Link
                href="/incoming"
                className="px-3.5 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-bold text-xs transition-all flex items-center gap-1.5"
              >
                <Boxes className="h-4 w-4" />
                Receive Stock
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Business Session Warning Banner for Shop Users if day is closed */}
      {user?.role === 'SHOP_USER' && !activeSession && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-2xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <p className="text-xs font-bold text-amber-900 dark:text-amber-200">Business Day is Currently CLOSED</p>
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                You must open the daily business session before point-of-sale transactions can be processed.
              </p>
            </div>
          </div>
          <Link
            href="/sessions"
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg transition-colors shrink-0"
          >
            Open Business Day
          </Link>
        </div>
      )}

      {/* Live Operational Alerts */}
      {alerts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {alerts.map((alert: any, idx: number) => (
            <Link
              key={idx}
              href={alert.link || '#'}
              className={`p-3.5 rounded-xl border flex items-start gap-3 transition-all card-hover ${
                alert.severity === 'DANGER'
                  ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60 text-rose-900 dark:text-rose-200'
                  : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200'
              }`}
            >
              <ShieldAlert className={`h-5 w-5 shrink-0 ${alert.severity === 'DANGER' ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`} />
              <div className="flex-1">
                <p className="text-xs font-bold">{alert.title}</p>
                <p className="text-[11px] opacity-90 mt-0.5">{alert.message}</p>
              </div>
              <ChevronRight className="h-4 w-4 opacity-50 shrink-0 self-center" />
            </Link>
          ))}
        </div>
      )}

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today Revenue */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Today's Revenue</span>
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            {Number(today.revenue || 0).toLocaleString()} <span className="text-xs font-bold text-slate-400">ETB</span>
          </div>
          <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            <span>{today.salesCount || 0} sales</span>
            <span>•</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">+{Number(today.profit || 0).toLocaleString()} ETB net</span>
          </div>
        </div>

        {/* MTD Revenue */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
            <span>MTD Revenue</span>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            {Number(mtd.revenue || 0).toLocaleString()} <span className="text-xs font-bold text-slate-400">ETB</span>
          </div>
          <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            <span>{mtd.salesCount || 0} month sales</span>
            <span>•</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">+{Number(mtd.profit || 0).toLocaleString()} ETB net</span>
          </div>
        </div>

        {/* Total Stock Available */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Stock Inventory</span>
            <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400">
              <Boxes className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            {user?.role === 'SHOP_USER'
              ? `${(inventory.branchSimStock + inventory.branchScratchStock).toLocaleString()} units`
              : `${(inventory.centralSimStock + inventory.centralScratchStock + inventory.branchSimStock + inventory.branchScratchStock).toLocaleString()} units`}
          </div>
          <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            <span>Valuation:</span>
            <span className="text-slate-800 dark:text-slate-200 font-bold">{Number(inventory.totalStockValue || 0).toLocaleString()} ETB</span>
          </div>
        </div>

        {/* Pending Approvals & Operations */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Transfer Approvals</span>
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400">
              <ArrowLeftRight className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span>{operations.pendingApprovals || 0}</span>
            {operations.pendingApprovals > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-xs font-bold">
                Pending
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            <span>{operations.rejectedTransfers || 0} rejected</span>
            <span>•</span>
            <Link href="/transfers" className="text-blue-600 dark:text-blue-400 font-bold hover:underline">
              View queue &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* Analytics Chart & Breakdown Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue & Profit Trend Chart (14 Days) */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Sales & Net Profit Trend (Past 14 Days)</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Real-time daily financial flow</p>
            </div>
            <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 rounded-lg">
              Live DB Aggregated
            </span>
          </div>

          <div className="h-64 w-full">
            {trend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1367f6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#1367f6" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorProf" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', fontSize: '12px' }}
                    labelStyle={{ color: '#94a3b8', fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="revenue" name="Revenue (ETB)" stroke="#1367f6" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" />
                  <Area type="monotone" dataKey="profit" name="Net Profit (ETB)" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorProf)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-slate-400 text-xs">
                No recent sales activity to display.
              </div>
            )}
          </div>
        </div>

        {/* Product System Split */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-1">Product Systems Breakdown</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Independent operational product tracking</p>

            <div className="space-y-4">
              {/* SIM System Card */}
              <Link
                href="/sim"
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500/50 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between transition-all block card-hover"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300">
                    <Smartphone className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">SIM Cards System</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Tracked by Quantity Only</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400">Manage &rarr;</span>
                </div>
              </Link>

              {/* Scratch Card System Card */}
              <Link
                href="/scratch"
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between transition-all block card-hover"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">Scratch Cards System</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">5 to 100 ETB Denominations</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Manage &rarr;</span>
                </div>
              </Link>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800">
            <Link
              href="/reports"
              className="w-full py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors"
            >
              Export System Reports (Excel / PDF) &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* Branch Comparison Table (For Admin and Finance) */}
      {user?.role !== 'SHOP_USER' && branches.length > 0 && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Branch Performance Comparison</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Live operational comparison across all company branches</p>
            </div>
            <Link href="/branches" className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline">
              Manage Branches &rarr;
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold uppercase border-y border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Branch</th>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">SIM Stock</th>
                  <th className="py-3 px-4">Scratch Stock</th>
                  <th className="py-3 px-4">SIM Sold</th>
                  <th className="py-3 px-4">Scratch Sold</th>
                  <th className="py-3 px-4">Revenue</th>
                  <th className="py-3 px-4">Net Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {branches.map((b) => (
                  <tr key={b.branchId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-slate-400" />
                      {b.branchName}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">{b.branchCode}</td>
                    <td className="py-3 px-4">{Number(b.currentSimStock || 0).toLocaleString()}</td>
                    <td className="py-3 px-4">{Number(b.currentScratchStock || 0).toLocaleString()}</td>
                    <td className="py-3 px-4">{Number(b.simSales || 0).toLocaleString()}</td>
                    <td className="py-3 px-4">{Number(b.scratchSales || 0).toLocaleString()}</td>
                    <td className="py-3 px-4 font-bold">{Number(b.revenue || 0).toLocaleString()} ETB</td>
                    <td className="py-3 px-4 font-bold text-emerald-600 dark:text-emerald-400">
                      +{Number(b.profit || 0).toLocaleString()} ETB
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
