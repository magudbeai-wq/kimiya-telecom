'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  Smartphone,
  Boxes,
  ArrowLeftRight,
  ShoppingCart,
  FileSpreadsheet,
  PackagePlus,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Download,
  Building2,
  Calendar,
} from 'lucide-react';

export default function SimCardsPage() {
  const { user, activeSession } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'incoming' | 'stock' | 'transfers' | 'sales' | 'reports'>('dashboard');

  // State data
  const [centralStock, setCentralStock] = useState<any>(null);
  const [branchStock, setBranchStock] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [incomingHistory, setIncomingHistory] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Form states
  const [incomingQty, setIncomingQty] = useState('');
  const [incomingCost, setIncomingCost] = useState('30.00');
  const [incomingSupplier, setIncomingSupplier] = useState('Ethio Telecom Central Distribution');
  const [incomingRef, setIncomingRef] = useState('');

  const [transferBranchId, setTransferBranchId] = useState('');
  const [transferQty, setTransferQty] = useState('');
  const [transferNotes, setTransferNotes] = useState('');

  const [saleQty, setSaleQty] = useState('1');
  const [salePrice, setSalePrice] = useState('50.00');

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [csRes, bsRes, trRes, slRes, inRes, brRes] = await Promise.all([
        fetch('/api/inventory/central'),
        fetch('/api/inventory/branch'),
        fetch('/api/transfers?productType=SIM'),
        fetch('/api/sales?productType=SIM&limit=50'),
        fetch('/api/inventory/incoming?productType=SIM'),
        fetch('/api/branches'),
      ]);

      if (csRes.ok) {
        const json = await csRes.json();
        const sim = (json.centralStock || []).find((s: any) => s.product_type === 'SIM');
        setCentralStock(sim || null);
      }
      if (bsRes.ok) {
        const json = await bsRes.json();
        const simStocks = (json.branchStock || []).filter((s: any) => s.product_type === 'SIM');
        setBranchStock(simStocks);
      }
      if (trRes.ok) {
        const json = await trRes.json();
        setTransfers(json.transfers || []);
      }
      if (slRes.ok) {
        const json = await slRes.json();
        setSales(json.sales || []);
      }
      if (inRes.ok) {
        const json = await inRes.json();
        setIncomingHistory(json.history || []);
      }
      if (brRes.ok) {
        const json = await brRes.json();
        setBranches(json.branches || []);
        if (json.branches.length > 0 && !transferBranchId) {
          setTransferBranchId(json.branches[0].id);
        }
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

  // Handle Receive Incoming SIM Stock
  const handleIncomingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setMessage(null);
      const res = await fetch('/api/inventory/incoming', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productType: 'SIM',
          quantity: parseInt(incomingQty),
          unitCost: parseFloat(incomingCost),
          supplierName: incomingSupplier,
          referenceNumber: incomingRef || `REF-SIM-${Date.now()}`,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: `Successfully received ${incomingQty} SIM cards into Central Store.` });
        setIncomingQty('');
        setIncomingRef('');
        fetchData();
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  // Handle Dispatch SIM Transfer to Branch
  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setMessage(null);
      const res = await fetch('/api/transfers/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productType: 'SIM',
          destinationBranchId: transferBranchId,
          quantity: parseInt(transferQty),
          notes: transferNotes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: `SIM Card transfer #${data.transfer.id} dispatched to branch (Pending Approval).` });
        setTransferQty('');
        setTransferNotes('');
        fetchData();
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  // Handle SIM Sale
  const handleSaleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setMessage(null);
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: user?.branch_id,
          productType: 'SIM',
          quantity: parseInt(saleQty),
          unitPrice: parseFloat(salePrice),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: `SIM Sale completed! Receipt #${data.sale.id} for ${data.sale.total_amount} ETB.` });
        setSaleQty('1');
        fetchData();
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  // Export Report
  const handleExport = async (format: 'EXCEL' | 'PDF') => {
    try {
      const res = await fetch('/api/reports/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType: 'SIM_SALES',
          format,
          branchId: user?.branch_id || undefined,
        }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `SIM_SALES_REPORT_${Date.now()}.${format === 'EXCEL' ? 'xlsx' : 'pdf'}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const totalBranchSimStock = branchStock.reduce((acc, curr) => acc + (curr.quantity || 0), 0);
  const totalSimSold = sales.reduce((acc, curr) => acc + (curr.quantity || 0), 0);
  const totalSimRevenue = sales.reduce((acc, curr) => acc + (curr.total_amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300">
              <Smartphone className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">SIM Cards System</h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Tracked strictly by quantity. Central store, branch distributions, transfers, and retail sales.
          </p>
        </div>

        {/* System Tabs */}
        <div className="flex flex-wrap gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: Boxes },
            ...(user?.role !== 'SHOP_USER' ? [{ id: 'incoming', label: 'Incoming Intake', icon: PackagePlus }] : []),
            { id: 'stock', label: 'Stock Levels', icon: Boxes },
            { id: 'transfers', label: 'Transfers', icon: ArrowLeftRight },
            { id: 'sales', label: 'POS Terminal', icon: ShoppingCart },
            { id: 'reports', label: 'Reports', icon: FileSpreadsheet },
          ].map((tab) => {
            const Icon = tab.icon;
            const isCurrent = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  setMessage(null);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  isCurrent
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Status Message */}
      {message && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 text-xs ${
            message.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
          )}
          <p className="font-semibold">{message.text}</p>
        </div>
      )}

      {/* TAB 1: SIM DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Central Store SIMs</span>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {(centralStock?.quantity || 0).toLocaleString()} <span className="text-xs text-slate-400">cards</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Unit Cost: {centralStock?.cost_price || 30} ETB</p>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Branch SIMs</span>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {totalBranchSimStock.toLocaleString()} <span className="text-xs text-slate-400">cards</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Across all branches</p>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">SIMs Sold (Recorded)</span>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {totalSimSold.toLocaleString()} <span className="text-xs text-slate-400">cards</span>
              </div>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-1">
                {totalSimRevenue.toLocaleString()} ETB Revenue
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">SIM Retail Price</span>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                50.00 <span className="text-xs text-slate-400">ETB</span>
              </div>
              <p className="text-[11px] text-blue-600 dark:text-blue-400 font-bold mt-1">Margin: +20.00 ETB / card</p>
            </div>
          </div>

          {/* Branch Stock Breakdown Table */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Branch SIM Card Inventory Levels</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {branchStock.map((bs) => (
                <div key={bs.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-slate-400" />
                      {bs.branch_name}
                    </span>
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 font-mono">{bs.branch_code}</span>
                  </div>
                  <div className="text-xl font-black text-slate-900 dark:text-white">
                    {Number(bs.quantity || 0).toLocaleString()} <span className="text-xs font-normal text-slate-400">cards</span>
                  </div>
                  <div className="mt-2 text-[10px] text-slate-500 flex justify-between">
                    <span>Threshold: {bs.low_stock_threshold}</span>
                    <span className={bs.quantity <= bs.low_stock_threshold ? 'text-amber-500 font-bold' : 'text-emerald-500'}>
                      {bs.quantity <= bs.low_stock_threshold ? 'Low Stock' : 'Optimal'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SIM INCOMING (FINANCE ONLY) */}
      {activeTab === 'incoming' && user?.role !== 'SHOP_USER' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Intake Form */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Receive SIM Shipment</h3>
            <p className="text-xs text-slate-500 mb-4">Stock directly enters Central Store upon receipt.</p>

            <form onSubmit={handleIncomingSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Quantity (Cards)</label>
                <input
                  type="number"
                  min="1"
                  value={incomingQty}
                  onChange={(e) => setIncomingQty(e.target.value)}
                  placeholder="e.g. 5000"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Unit Cost Price (ETB)</label>
                <input
                  type="number"
                  step="0.01"
                  value={incomingCost}
                  onChange={(e) => setIncomingCost(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Supplier Name</label>
                <input
                  type="text"
                  value={incomingSupplier}
                  onChange={(e) => setIncomingSupplier(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Delivery Reference #</label>
                <input
                  type="text"
                  value={incomingRef}
                  onChange={(e) => setIncomingRef(e.target.value)}
                  placeholder="e.g. DO-2026-0817"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl text-[11px] text-blue-900 dark:text-blue-200 font-medium">
                Total Valuation: {(parseInt(incomingQty || '0') * parseFloat(incomingCost || '0')).toLocaleString()} ETB
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow transition-colors"
              >
                Record Incoming SIMs
              </button>
            </form>
          </div>

          {/* Intake History Table */}
          <div className="lg:col-span-2 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">SIM Intake History</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold uppercase border-y border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Transaction ID</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Qty</th>
                    <th className="py-2.5 px-3">Unit Cost</th>
                    <th className="py-2.5 px-3">Total Cost</th>
                    <th className="py-2.5 px-3">Supplier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {incomingHistory.map((h) => (
                    <tr key={h.id}>
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">{h.id}</td>
                      <td className="py-2.5 px-3">{h.received_at?.substring(0, 16)}</td>
                      <td className="py-2.5 px-3 font-bold">{h.quantity?.toLocaleString()}</td>
                      <td className="py-2.5 px-3">{h.unit_cost} ETB</td>
                      <td className="py-2.5 px-3 font-bold">{h.total_cost?.toLocaleString()} ETB</td>
                      <td className="py-2.5 px-3">{h.supplier_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SIM STOCK */}
      {activeTab === 'stock' && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">SIM Card Complete Inventory Valuation</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold uppercase border-y border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Quantity</th>
                  <th className="py-3 px-4">Cost Price</th>
                  <th className="py-3 px-4">Selling Price</th>
                  <th className="py-3 px-4">Total Value (ETB)</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {user?.role !== 'SHOP_USER' && centralStock && (
                  <tr className="bg-blue-50/40 dark:bg-blue-950/20 font-bold">
                    <td className="py-3 px-4 text-blue-600 dark:text-blue-400">Head Office Central Store</td>
                    <td className="py-3 px-4">Central Hub</td>
                    <td className="py-3 px-4 text-slate-900 dark:text-white">{centralStock.quantity?.toLocaleString()}</td>
                    <td className="py-3 px-4">{centralStock.cost_price} ETB</td>
                    <td className="py-3 px-4">{centralStock.selling_price} ETB</td>
                    <td className="py-3 px-4">{(centralStock.quantity * centralStock.cost_price).toLocaleString()} ETB</td>
                    <td className="py-3 px-4 text-emerald-600">Active Central</td>
                  </tr>
                )}
                {branchStock.map((bs) => (
                  <tr key={bs.id}>
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{bs.branch_name}</td>
                    <td className="py-3 px-4">Retail Branch</td>
                    <td className="py-3 px-4 font-bold">{bs.quantity?.toLocaleString()}</td>
                    <td className="py-3 px-4">{bs.cost_price} ETB</td>
                    <td className="py-3 px-4">{bs.selling_price} ETB</td>
                    <td className="py-3 px-4">{(bs.quantity * bs.selling_price).toLocaleString()} ETB</td>
                    <td className="py-3 px-4">
                      {bs.quantity <= bs.low_stock_threshold ? (
                        <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-600 text-[10px] font-bold">Low Stock</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-600 text-[10px] font-bold">In Stock</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: SIM TRANSFERS */}
      {activeTab === 'transfers' && (
        <div className="space-y-6">
          {/* Dispatch form for Finance */}
          {user?.role !== 'SHOP_USER' && (
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Dispatch SIM Stock to Branch</h3>
              <p className="text-xs text-slate-500 mb-4">Stock moves to branch inventory only upon branch user approval.</p>

              <form onSubmit={handleTransferSubmit} className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Destination Branch</label>
                  <select
                    value={transferBranchId}
                    onChange={(e) => setTransferBranchId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500"
                    required
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Quantity (SIM Cards)</label>
                  <input
                    type="number"
                    min="1"
                    value={transferQty}
                    onChange={(e) => setTransferQty(e.target.value)}
                    placeholder="e.g. 500"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Transfer Notes</label>
                  <input
                    type="text"
                    value={transferNotes}
                    onChange={(e) => setTransferNotes(e.target.value)}
                    placeholder="Optional delivery notes"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow transition-colors"
                  >
                    Dispatch SIM Transfer
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* SIM Transfers History Table */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">SIM Card Stock Transfers Log</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold uppercase border-y border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Transfer ID</th>
                    <th className="py-2.5 px-3">Destination</th>
                    <th className="py-2.5 px-3">Quantity</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Sent At</th>
                    <th className="py-2.5 px-3">Dispatched By</th>
                    <th className="py-2.5 px-3">Reviewed At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {transfers.map((t) => (
                    <tr key={t.id}>
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">{t.id}</td>
                      <td className="py-2.5 px-3 font-bold">{t.destination_branch_name}</td>
                      <td className="py-2.5 px-3 font-bold">{t.quantity?.toLocaleString()}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            t.status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                              : t.status === 'REJECTED'
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">{t.sent_at?.substring(0, 16)}</td>
                      <td className="py-2.5 px-3">{t.sent_by_user_name}</td>
                      <td className="py-2.5 px-3">{t.reviewed_at ? t.reviewed_at.substring(0, 16) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: SIM SALES (POS TERMINAL) */}
      {activeTab === 'sales' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sale Terminal Box */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md">
            <h3 className="text-base font-black text-slate-900 dark:text-white mb-1">SIM Point-of-Sale Terminal</h3>
            <p className="text-xs text-slate-500 mb-4">Instant sale and branch inventory deduction.</p>

            <form onSubmit={handleSaleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={saleQty}
                  onChange={(e) => setSaleQty(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Selling Price (ETB)</label>
                <input
                  type="number"
                  step="0.01"
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              {/* Total Calculation Display */}
              <div className="p-4 bg-slate-900 text-white rounded-2xl">
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Price Calculation:</span>
                  <span>{saleQty || 0} × {salePrice} ETB</span>
                </div>
                <div className="flex justify-between items-baseline pt-2 border-t border-slate-800">
                  <span className="text-xs font-bold text-slate-300">Total Authoritative:</span>
                  <span className="text-xl font-black text-emerald-400">
                    {(parseInt(saleQty || '0') * parseFloat(salePrice || '0')).toLocaleString()} ETB
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={user?.role === 'SHOP_USER' && !activeSession}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs rounded-xl shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <ShoppingCart className="h-4 w-4" />
                Complete SIM Sale (Cash)
              </button>
            </form>
          </div>

          {/* Recent SIM Sales Stream */}
          <div className="lg:col-span-2 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Recent SIM Retail Transactions</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold uppercase border-y border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Sale ID</th>
                    <th className="py-2.5 px-3">Time</th>
                    <th className="py-2.5 px-3">Branch</th>
                    <th className="py-2.5 px-3">Qty</th>
                    <th className="py-2.5 px-3">Total (ETB)</th>
                    <th className="py-2.5 px-3">Profit (ETB)</th>
                    <th className="py-2.5 px-3">Cashier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {sales.map((s) => (
                    <tr key={s.id}>
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">{s.id}</td>
                      <td className="py-2.5 px-3">{s.created_at?.substring(11, 16)}</td>
                      <td className="py-2.5 px-3 font-bold">{s.branch_name}</td>
                      <td className="py-2.5 px-3 font-bold">{s.quantity}</td>
                      <td className="py-2.5 px-3 font-black text-slate-900 dark:text-white">{s.total_amount?.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-emerald-600 font-bold">+{s.profit?.toLocaleString()}</td>
                      <td className="py-2.5 px-3">{s.user_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: SIM REPORTS & EXPORTS */}
      {activeTab === 'reports' && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">SIM Card Financial & Operational Reports</h3>
              <p className="text-xs text-slate-500">Export verified records with company header, author metadata, and totals.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExport('EXCEL')}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow flex items-center gap-1.5 transition-colors"
              >
                <Download className="h-4 w-4" />
                Download Excel (.xlsx)
              </button>
              <button
                onClick={() => handleExport('PDF')}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow flex items-center gap-1.5 transition-colors"
              >
                <Download className="h-4 w-4" />
                Download PDF (.pdf)
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold uppercase border-y border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Transaction ID</th>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Branch</th>
                  <th className="py-3 px-4">Quantity</th>
                  <th className="py-3 px-4">Unit Price</th>
                  <th className="py-3 px-4">Revenue</th>
                  <th className="py-3 px-4">Net Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sales.map((s) => (
                  <tr key={s.id}>
                    <td className="py-3 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">{s.id}</td>
                    <td className="py-3 px-4">{s.created_at}</td>
                    <td className="py-3 px-4 font-bold">{s.branch_name}</td>
                    <td className="py-3 px-4 font-bold">{s.quantity}</td>
                    <td className="py-3 px-4">{s.unit_price} ETB</td>
                    <td className="py-3 px-4 font-bold">{s.total_amount?.toLocaleString()} ETB</td>
                    <td className="py-3 px-4 font-bold text-emerald-600">+{s.profit?.toLocaleString()} ETB</td>
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
