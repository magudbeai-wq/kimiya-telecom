'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  DollarSign,
  TrendingUp,
  Receipt,
  RotateCcw,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Scale,
  PieChart,
  Boxes,
} from 'lucide-react';
import { ExpenseCategory, ProductType } from '@/lib/types';

export default function FinancePage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'statement' | 'expenses' | 'reconcile'>('statement');

  const [statement, setStatement] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [denominations, setDenominations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Expense form
  const [expCategory, setExpCategory] = useState<ExpenseCategory>('RENT');
  const [expAmount, setExpAmount] = useState('');
  const [expBranchId, setExpBranchId] = useState('');
  const [expDesc, setExpDesc] = useState('');
  const [expDate, setExpDate] = useState(new Date().toISOString().substring(0, 10));

  // Reconcile form
  const [reconLoc, setReconLoc] = useState<'CENTRAL_STORE' | 'BRANCH'>('CENTRAL_STORE');
  const [reconBranchId, setReconBranchId] = useState('');
  const [reconProd, setReconProd] = useState<ProductType>('SIM');
  const [reconDenomId, setReconDenomId] = useState('');
  const [reconCount, setReconCount] = useState('');
  const [reconReason, setReconReason] = useState('');

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchFinanceData = async () => {
    try {
      setLoading(true);
      const [stmtRes, expRes, brRes, dnRes] = await Promise.all([
        fetch('/api/finance/statement'),
        fetch('/api/expenses?limit=50'),
        fetch('/api/branches'),
        fetch('/api/inventory/denominations'),
      ]);

      if (stmtRes.ok) {
        const json = await stmtRes.json();
        setStatement(json.statement);
      }
      if (expRes.ok) {
        const json = await expRes.json();
        setExpenses(json.expenses || []);
      }
      if (brRes.ok) {
        const json = await brRes.json();
        setBranches(json.branches || []);
        if (json.branches.length > 0 && !reconBranchId) {
          setReconBranchId(json.branches[0].id);
        }
      }
      if (dnRes.ok) {
        const json = await dnRes.json();
        setDenominations(json.denominations || []);
        if (json.denominations.length > 0 && !reconDenomId) {
          setReconDenomId(json.denominations[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinanceData();
  }, [user]);

  // Handle Add Expense
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setMessage(null);
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: expCategory,
          amount: parseFloat(expAmount),
          branchId: expBranchId || null,
          description: expDesc,
          date: expDate,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: `Expense #${data.expense.id} recorded successfully.` });
        setExpAmount('');
        setExpDesc('');
        await fetchFinanceData();
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  // Handle Stock Reconciliation
  const handleReconcileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setMessage(null);
      const res = await fetch('/api/finance/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationType: reconLoc,
          branchId: reconLoc === 'BRANCH' ? reconBranchId : null,
          productType: reconProd,
          denominationId: reconProd === 'SCRATCH_CARD' ? reconDenomId : null,
          physicalCount: parseInt(reconCount),
          reason: reconReason,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: data.message });
        setReconCount('');
        setReconReason('');
        await fetchFinanceData();
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-300">
              <DollarSign className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Finance & Accounting</h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Financial statements, profit calculations (Revenue - COGS - Expenses), expense tracking, and stock reconciliations.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex flex-wrap gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('statement')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'statement'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            <span>Profit & Loss Statement</span>
          </button>
          <button
            onClick={() => setActiveTab('expenses')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'expenses'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Receipt className="h-3.5 w-3.5" />
            <span>Expense Management</span>
          </button>
          <button
            onClick={() => setActiveTab('reconcile')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'reconcile'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Scale className="h-3.5 w-3.5" />
            <span>Stock Reconciliation</span>
          </button>
        </div>
      </div>

      {/* Message Banner */}
      {message && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 text-xs ${
            message.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
          )}
          <p className="font-semibold">{message.text}</p>
        </div>
      )}

      {/* TAB 1: PROFIT & LOSS STATEMENT */}
      {activeTab === 'statement' && (
        <div className="space-y-6">
          {/* Executive P&L Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Sales Revenue</span>
              <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
                {Number(statement?.revenue || 0).toLocaleString()} <span className="text-xs text-slate-400">ETB</span>
              </div>
              <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-1">
                SIM: {Number(statement?.simRevenue || 0).toLocaleString()} | SC: {Number(statement?.scratchRevenue || 0).toLocaleString()}
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Cost of Goods Sold (COGS)</span>
              <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
                {Number(statement?.costOfGoodsSold || 0).toLocaleString()} <span className="text-xs text-slate-400">ETB</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Direct product acquisition cost</p>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Operational Expenses</span>
              <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
                {Number(statement?.expenses || 0).toLocaleString()} <span className="text-xs text-slate-400">ETB</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Rent, salaries, transport, utilities</p>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Net Profit</span>
              <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                +{Number(statement?.netProfit || 0).toLocaleString()} <span className="text-xs text-slate-400">ETB</span>
              </div>
              <p className="text-[11px] text-emerald-600 font-bold mt-1">
                Profit Margin: {statement?.profitMarginPercent || 0}%
              </p>
            </div>
          </div>

          {/* Statement Breakdown Table */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-4">Itemized Financial Ledger Statement</h3>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800 font-bold text-slate-900 dark:text-white">
                <span>1. Gross Sales Revenue</span>
                <span>{Number(statement?.revenue || 0).toLocaleString()} ETB</span>
              </div>
              <div className="flex justify-between py-1 text-slate-500 pl-4">
                <span>• SIM Card Retail Sales</span>
                <span>{Number(statement?.simRevenue || 0).toLocaleString()} ETB</span>
              </div>
              <div className="flex justify-between py-1 text-slate-500 pl-4">
                <span>• Scratch Card Retail Sales</span>
                <span>{Number(statement?.scratchRevenue || 0).toLocaleString()} ETB</span>
              </div>

              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800 font-bold text-rose-600 dark:text-rose-400">
                <span>2. Less: Cost of Goods Sold (COGS)</span>
                <span>- {Number(statement?.costOfGoodsSold || 0).toLocaleString()} ETB</span>
              </div>

              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800 font-bold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800/40 px-3 rounded-lg">
                <span>3. Gross Profit (Revenue - COGS)</span>
                <span>{Number(statement?.grossProfit || 0).toLocaleString()} ETB</span>
              </div>

              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800 font-bold text-rose-600 dark:text-rose-400">
                <span>4. Less: Operating Expenses</span>
                <span>- {Number(statement?.expenses || 0).toLocaleString()} ETB</span>
              </div>

              <div className="flex justify-between py-3 border-t-2 border-slate-900 dark:border-slate-100 font-black text-base text-emerald-600 dark:text-emerald-400">
                <span>NET PROFIT</span>
                <span>+{Number(statement?.netProfit || 0).toLocaleString()} ETB</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: EXPENSES */}
      {activeTab === 'expenses' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add Expense Form */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Record Business Expense</h3>
            <p className="text-xs text-slate-500 mb-4">Add operating expenses for branch or headquarters.</p>

            <form onSubmit={handleAddExpense} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Category</label>
                <select
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500"
                  required
                >
                  <option value="RENT">Rent & Lease</option>
                  <option value="UTILITIES">Utilities & Power</option>
                  <option value="SALARIES">Staff Salaries & Wages</option>
                  <option value="TRANSPORT">Transport & Logistics</option>
                  <option value="OFFICE">Office Supplies & Stationery</option>
                  <option value="MAINTENANCE">Facility Maintenance</option>
                  <option value="MARKETING">Marketing & Distribution</option>
                  <option value="OTHER">Other Operating Expense</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Branch / Location</label>
                <select
                  value={expBranchId}
                  onChange={(e) => setExpBranchId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500"
                >
                  <option value="">Head Office / Company-wide</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Amount (ETB)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  placeholder="e.g. 2500.00"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Description</label>
                <input
                  type="text"
                  value={expDesc}
                  onChange={(e) => setExpDesc(e.target.value)}
                  placeholder="e.g. Karamardha branch monthly electricity bill"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Expense Date</label>
                <input
                  type="date"
                  value={expDate}
                  onChange={(e) => setExpDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow transition-colors"
              >
                Record Expense
              </button>
            </form>
          </div>

          {/* Expense Ledger Table */}
          <div className="lg:col-span-2 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Expense Ledger Archive</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold uppercase border-y border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Expense ID</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Branch</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {expenses.map((e) => (
                    <tr key={e.id}>
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">{e.id}</td>
                      <td className="py-2.5 px-3">{e.date}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold">
                          {e.category}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">{e.branch_name || 'Head Office'}</td>
                      <td className="py-2.5 px-3 max-w-xs truncate">{e.description}</td>
                      <td className="py-2.5 px-3 font-bold text-rose-600 dark:text-rose-400">
                        {Number(e.amount).toLocaleString()} ETB
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: STOCK RECONCILIATION */}
      {activeTab === 'reconcile' && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm max-w-2xl mx-auto space-y-4">
          <div>
            <h3 className="font-black text-base text-slate-900 dark:text-white">Stock Audit & Physical Reconciliation</h3>
            <p className="text-xs text-slate-500">
              Align physical physical count with database recorded quantity. Creates an immutable stock correction ledger entry and triggers audit record.
            </p>
          </div>

          <form onSubmit={handleReconcileSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Target Location</label>
              <select
                value={reconLoc}
                onChange={(e) => setReconLoc(e.target.value as any)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-semibold focus:outline-none focus:border-blue-500"
                required
              >
                <option value="CENTRAL_STORE">Head Office Central Store</option>
                <option value="BRANCH">Branch Location</option>
              </select>
            </div>

            {reconLoc === 'BRANCH' && (
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Select Branch</label>
                <select
                  value={reconBranchId}
                  onChange={(e) => setReconBranchId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-semibold focus:outline-none focus:border-blue-500"
                  required
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Product System</label>
              <select
                value={reconProd}
                onChange={(e) => setReconProd(e.target.value as any)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-semibold focus:outline-none focus:border-blue-500"
                required
              >
                <option value="SIM">SIM Cards</option>
                <option value="SCRATCH_CARD">Scratch Cards</option>
              </select>
            </div>

            {reconProd === 'SCRATCH_CARD' && (
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Denomination</label>
                <select
                  value={reconDenomId}
                  onChange={(e) => setReconDenomId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-semibold focus:outline-none focus:border-blue-500"
                  required
                >
                  {denominations.map((d) => (
                    <option key={d.id} value={d.id}>{d.denomination_value} ETB</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Actual Physical Count (Verified Units)</label>
              <input
                type="number"
                min="0"
                value={reconCount}
                onChange={(e) => setReconCount(e.target.value)}
                placeholder="e.g. 4850"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-semibold focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                Mandatory Audit Justification / Reason
              </label>
              <textarea
                value={reconReason}
                onChange={(e) => setReconReason(e.target.value)}
                rows={2}
                placeholder="Explain the cause of variance (e.g. Quarterly physical stock audit recount)..."
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500"
                required
              ></textarea>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md transition-colors"
            >
              Execute Stock Reconciliation & Update Ledger
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
