'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  ShoppingCart,
  Smartphone,
  CreditCard,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  CalendarCheck,
  Search,
  Filter,
} from 'lucide-react';

export default function SalesPage() {
  const { user, activeSession } = useAuth();
  const [productType, setProductType] = useState<'SIM' | 'SCRATCH_CARD'>('SIM');
  const [denominations, setDenominations] = useState<any[]>([]);
  const [branchStock, setBranchStock] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Sale form states
  const [selectedDenomId, setSelectedDenomId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('50.00');

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBranchId, setFilterBranchId] = useState('');
  const [branches, setBranches] = useState<any[]>([]);

  // Receipt Modal
  const [recentSale, setRecentSale] = useState<any>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [dnRes, bsRes, slRes, brRes] = await Promise.all([
        fetch('/api/inventory/denominations'),
        fetch('/api/inventory/branch'),
        fetch('/api/sales?limit=50'),
        fetch('/api/branches'),
      ]);

      if (dnRes.ok) {
        const json = await dnRes.json();
        setDenominations(json.denominations || []);
        if (json.denominations.length > 0 && !selectedDenomId) {
          setSelectedDenomId(json.denominations[0].id);
        }
      }
      if (bsRes.ok) {
        const json = await bsRes.json();
        setBranchStock(json.branchStock || []);
      }
      if (slRes.ok) {
        const json = await slRes.json();
        setSales(json.sales || []);
      }
      if (brRes.ok) {
        const json = await brRes.json();
        setBranches(json.branches || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  // Update unitPrice when changing denomination
  useEffect(() => {
    if (productType === 'SCRATCH_CARD') {
      const selected = denominations.find((d) => d.id === selectedDenomId);
      if (selected) {
        setUnitPrice(String(selected.denomination_value));
      }
    } else {
      setUnitPrice('50.00');
    }
  }, [productType, selectedDenomId, denominations]);

  // Calculate current available stock for selected product
  const currentAvailableStock = (() => {
    if (productType === 'SIM') {
      const bs = branchStock.find(
        (b) => b.product_type === 'SIM' && (!user?.branch_id || b.branch_id === user?.branch_id)
      );
      return bs?.quantity || 0;
    } else {
      const bs = branchStock.find(
        (b) =>
          b.product_type === 'SCRATCH_CARD' &&
          b.denomination_id === selectedDenomId &&
          (!user?.branch_id || b.branch_id === user?.branch_id)
      );
      return bs?.quantity || 0;
    }
  })();

  const handleSaleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setMessage(null);
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: user?.branch_id,
          productType,
          denominationId: productType === 'SCRATCH_CARD' ? selectedDenomId : null,
          quantity: parseInt(quantity),
          unitPrice: parseFloat(unitPrice),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setRecentSale(data.sale);
        setMessage({ type: 'success', text: data.message });
        setQuantity('1');
        await fetchData();
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const filteredSales = sales.filter((s) => {
    const matchesSearch =
      s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.branch_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.user_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesBranch = !filterBranchId || s.branch_id === filterBranchId;
    return matchesSearch && matchesBranch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Point-of-Sale Terminal</h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Cash sales terminal with immediate inventory ledger deduction and authoritative backend verification.
          </p>
        </div>

        {/* Business Day indicator */}
        {user?.role === 'SHOP_USER' && (
          <div
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
              activeSession
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
            }`}
          >
            <CalendarCheck className="h-4 w-4" />
            <span>{activeSession ? `Session Active (#${activeSession.id})` : 'Day Closed - Open Session to Sell'}</span>
          </div>
        )}
      </div>

      {/* Alert Messages */}
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

      {/* POS Terminal & Sales Stream Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Interactive Sales Box */}
        <div className="lg:col-span-5 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md space-y-5">
          <div>
            <h3 className="font-black text-sm text-slate-900 dark:text-white">New Retail Sale</h3>
            <p className="text-xs text-slate-500">Select product type and enter quantity.</p>
          </div>

          {/* Product Type Toggle */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setProductType('SIM')}
              className={`p-3 rounded-xl border text-center font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                productType === 'SIM'
                  ? 'bg-blue-600 text-white border-blue-600 shadow'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              <Smartphone className="h-4 w-4" />
              SIM Card (50 ETB)
            </button>
            <button
              type="button"
              onClick={() => setProductType('SCRATCH_CARD')}
              className={`p-3 rounded-xl border text-center font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                productType === 'SCRATCH_CARD'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              <CreditCard className="h-4 w-4" />
              Scratch Card
            </button>
          </div>

          <form onSubmit={handleSaleSubmit} className="space-y-4">
            {/* Scratch Denomination Selector if Scratch selected */}
            {productType === 'SCRATCH_CARD' && (
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">
                  Denomination
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {denominations.map((d) => {
                    const isSelected = selectedDenomId === d.id;
                    const denomStock = branchStock.find(
                      (bs) =>
                        bs.denomination_id === d.id &&
                        (!user?.branch_id || bs.branch_id === user?.branch_id)
                    );
                    const stockQty = denomStock?.quantity || 0;
                    return (
                      <button
                        type="button"
                        key={d.id}
                        onClick={() => setSelectedDenomId(d.id)}
                        className={`p-2 rounded-xl border text-center transition-all ${
                          isSelected
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="text-xs font-black">{d.denomination_value} ETB</div>
                        <div className={`text-[9px] mt-0.5 ${isSelected ? 'text-emerald-100' : 'text-slate-400'}`}>
                          {stockQty} avail
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quantity */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Quantity</label>
                <span className="text-[11px] text-slate-400">
                  Stock Available: <span className="font-bold text-blue-600 dark:text-blue-400">{currentAvailableStock}</span>
                </span>
              </div>
              <input
                type="number"
                min="1"
                max={currentAvailableStock > 0 ? currentAvailableStock : 1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            {/* Calculation summary block */}
            <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-2">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Unit Selling Price:</span>
                <span>{unitPrice} ETB</span>
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <span>Quantity:</span>
                <span>{quantity || 0} units</span>
              </div>
              <div className="flex justify-between items-baseline pt-2 border-t border-slate-800">
                <span className="text-xs font-bold text-slate-300">Total Authoritative Amount:</span>
                <span className="text-xl font-black text-emerald-400">
                  {(parseInt(quantity || '0') * parseFloat(unitPrice || '0')).toLocaleString()} ETB
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={(user?.role === 'SHOP_USER' && !activeSession) || currentAvailableStock < parseInt(quantity || '1')}
              className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs rounded-xl shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <ShoppingCart className="h-4 w-4" />
              Complete Sale (Direct Cash Payment)
            </button>
          </form>
        </div>

        {/* Right: Sales Stream and Receipt viewer */}
        <div className="lg:col-span-7 space-y-4">
          {/* Recent Receipt preview banner if sale was just completed */}
          {recentSale && (
            <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-900 text-emerald-600">
                  <Receipt className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                    Receipt Generated: #{recentSale.id}
                  </p>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                    {recentSale.quantity} × {recentSale.product_type} {recentSale.denomination_value ? `(${recentSale.denomination_value} ETB)` : ''} ={' '}
                    <span className="font-bold">{recentSale.total_amount?.toLocaleString()} ETB</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => window.print()}
                className="px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-lg border shadow-sm"
              >
                Print Slip
              </button>
            </div>
          )}

          {/* Sales History Log Table with Filter */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Point-of-Sale Transactions</h3>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search sale ID / cashier..."
                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-8 pr-3 py-1 text-xs focus:outline-none"
                  />
                </div>
                {user?.role !== 'SHOP_USER' && (
                  <select
                    value={filterBranchId}
                    onChange={(e) => setFilterBranchId(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs focus:outline-none"
                  >
                    <option value="">All Branches</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold uppercase border-y border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Sale ID</th>
                    <th className="py-2.5 px-3">Product</th>
                    <th className="py-2.5 px-3">Branch</th>
                    <th className="py-2.5 px-3">Qty</th>
                    <th className="py-2.5 px-3">Total (ETB)</th>
                    <th className="py-2.5 px-3">Profit</th>
                    <th className="py-2.5 px-3">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {filteredSales.slice(0, 20).map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">{s.id}</td>
                      <td className="py-2.5 px-3">
                        {s.product_type} {s.denomination_value ? `(${s.denomination_value} ETB)` : ''}
                      </td>
                      <td className="py-2.5 px-3 font-bold">{s.branch_name}</td>
                      <td className="py-2.5 px-3 font-bold">{s.quantity}</td>
                      <td className="py-2.5 px-3 font-black text-slate-900 dark:text-white">{s.total_amount?.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-emerald-600 font-bold">+{s.profit?.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-slate-400">{s.created_at?.substring(11, 16)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
