'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  CreditCard,
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
  Coins,
} from 'lucide-react';

export default function ScratchCardsPage() {
  const { user, activeSession } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'incoming' | 'stock' | 'transfers' | 'sales' | 'reports'>('dashboard');

  // State data
  const [denominations, setDenominations] = useState<any[]>([]);
  const [centralStock, setCentralStock] = useState<any[]>([]);
  const [branchStock, setBranchStock] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [incomingHistory, setIncomingHistory] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [performance, setPerformance] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Form states
  const [incomingDenomId, setIncomingDenomId] = useState('');
  const [incomingQty, setIncomingQty] = useState('');
  const [incomingCost, setIncomingCost] = useState('');
  const [incomingSupplier, setIncomingSupplier] = useState('Ethio Telecom National Distribution');
  const [incomingRef, setIncomingRef] = useState('');

  const [transferBranchId, setTransferBranchId] = useState('');
  const [transferDenomId, setTransferDenomId] = useState('');
  const [transferQty, setTransferQty] = useState('');
  const [transferNotes, setTransferNotes] = useState('');

  const [saleDenomId, setSaleDenomId] = useState('');
  const [saleQty, setSaleQty] = useState('1');

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [denomRes, csRes, bsRes, trRes, slRes, inRes, brRes, perfRes] = await Promise.all([
        fetch('/api/inventory/denominations'),
        fetch('/api/inventory/central'),
        fetch('/api/inventory/branch'),
        fetch('/api/transfers?productType=SCRATCH_CARD'),
        fetch('/api/sales?productType=SCRATCH_CARD&limit=50'),
        fetch('/api/inventory/incoming?productType=SCRATCH_CARD'),
        fetch('/api/branches'),
        fetch('/api/analytics/scratch'),
      ]);

      if (denomRes.ok) {
        const json = await denomRes.json();
        setDenominations(json.denominations || []);
        if (json.denominations.length > 0) {
          if (!incomingDenomId) setIncomingDenomId(json.denominations[0].id);
          if (!transferDenomId) setTransferDenomId(json.denominations[0].id);
          if (!saleDenomId) setSaleDenomId(json.denominations[0].id);
        }
      }
      if (csRes.ok) {
        const json = await csRes.json();
        const scStocks = (json.centralStock || []).filter((s: any) => s.product_type === 'SCRATCH_CARD');
        setCentralStock(scStocks);
      }
      if (bsRes.ok) {
        const json = await bsRes.json();
        const scStocks = (json.branchStock || []).filter((s: any) => s.product_type === 'SCRATCH_CARD');
        setBranchStock(scStocks);
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
      if (perfRes.ok) {
        const json = await perfRes.json();
        setPerformance(json.performance || []);
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

  // Handle auto cost calculation when selecting denomination for incoming
  useEffect(() => {
    if (incomingDenomId && denominations.length > 0) {
      const selected = denominations.find((d) => d.id === incomingDenomId);
      if (selected) {
        setIncomingCost((selected.denomination_value * 0.9).toFixed(2));
      }
    }
  }, [incomingDenomId, denominations]);

  // Handle Incoming Scratch Card Intake
  const handleIncomingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setMessage(null);
      const res = await fetch('/api/inventory/incoming', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productType: 'SCRATCH_CARD',
          denominationId: incomingDenomId,
          quantity: parseInt(incomingQty),
          unitCost: parseFloat(incomingCost),
          supplierName: incomingSupplier,
          referenceNumber: incomingRef || `REF-SC-${Date.now()}`,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: `Successfully received ${incomingQty} Scratch Cards into Central Store.` });
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

  // Handle Scratch Card Transfer Dispatch
  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setMessage(null);
      const res = await fetch('/api/transfers/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productType: 'SCRATCH_CARD',
          denominationId: transferDenomId,
          destinationBranchId: transferBranchId,
          quantity: parseInt(transferQty),
          notes: transferNotes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: `Scratch Card transfer #${data.transfer.id} dispatched (Pending Branch Approval).` });
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

  // Handle Scratch Card Sale
  const handleSaleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setMessage(null);
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: user?.branch_id,
          productType: 'SCRATCH_CARD',
          denominationId: saleDenomId,
          quantity: parseInt(saleQty),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: `Scratch Card Sale #${data.sale.id} completed for ${data.sale.total_amount} ETB.` });
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
          reportType: 'SCRATCH_SALES',
          format,
          branchId: user?.branch_id || undefined,
        }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `SCRATCH_CARD_REPORT_${Date.now()}.${format === 'EXCEL' ? 'xlsx' : 'pdf'}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const selectedSaleDenom = denominations.find((d) => d.id === saleDenomId);
  const currentBranchStockForSelected = branchStock.find(
    (bs) => bs.denomination_id === saleDenomId && (!user?.branch_id || bs.branch_id === user?.branch_id)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-300">
              <CreditCard className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Scratch Cards System</h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Tracked strictly by Denomination (5, 10, 15, 20, 25, 50, 100 ETB) + Quantity.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: Boxes },
            ...(user?.role !== 'SHOP_USER' ? [{ id: 'incoming', label: 'Incoming Intake', icon: PackagePlus }] : []),
            { id: 'stock', label: 'Denomination Stock', icon: Boxes },
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
                    ? 'bg-emerald-600 text-white shadow-sm'
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

      {/* TAB 1: DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Denomination Performance Cards Grid */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">
              Scratch Card Performance by Denomination
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
              {performance.map((p) => (
                <div
                  key={p.denominationId}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-center flex flex-col justify-between"
                >
                  <div>
                    <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-black text-xs mb-1">
                      {p.denominationValue}
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">ETB Card</p>
                  </div>

                  <div className="my-2">
                    <div className="text-base font-black text-slate-900 dark:text-white">
                      {(p.centralStock + p.totalBranchStock).toLocaleString()}
                    </div>
                    <p className="text-[9px] text-slate-500">In Stock Units</p>
                  </div>

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 text-[10px]">
                    <span className="text-emerald-600 font-bold">{p.soldQuantity} sold</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Detailed Denomination Matrix Table */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Complete Denominations Matrix</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold uppercase border-y border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Denomination</th>
                    <th className="py-2.5 px-3">Central Store Qty</th>
                    <th className="py-2.5 px-3">Branch Stock Qty</th>
                    <th className="py-2.5 px-3">Incoming Received</th>
                    <th className="py-2.5 px-3">Transferred</th>
                    <th className="py-2.5 px-3">Sold Qty</th>
                    <th className="py-2.5 px-3">Gross Revenue (ETB)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {performance.map((p) => (
                    <tr key={p.denominationId}>
                      <td className="py-2.5 px-3 font-bold text-emerald-600 dark:text-emerald-400">
                        {p.denominationValue} ETB Scratch Card
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">{p.centralStock?.toLocaleString()}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">{p.totalBranchStock?.toLocaleString()}</td>
                      <td className="py-2.5 px-3">{p.incomingQuantity?.toLocaleString()}</td>
                      <td className="py-2.5 px-3">{p.sentQuantity?.toLocaleString()}</td>
                      <td className="py-2.5 px-3 font-bold text-blue-600 dark:text-blue-400">{p.soldQuantity?.toLocaleString()}</td>
                      <td className="py-2.5 px-3 font-bold">{p.revenue?.toLocaleString()} ETB</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: INCOMING INTAKE */}
      {activeTab === 'incoming' && user?.role !== 'SHOP_USER' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Receive Scratch Cards</h3>
            <p className="text-xs text-slate-500 mb-4">Record new batches into Head Office Central Store.</p>

            <form onSubmit={handleIncomingSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Denomination</label>
                <select
                  value={incomingDenomId}
                  onChange={(e) => setIncomingDenomId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-emerald-500"
                  required
                >
                  {denominations.map((d) => (
                    <option key={d.id} value={d.id}>{d.denomination_value} ETB Scratch Card</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Quantity (Cards)</label>
                <input
                  type="number"
                  min="1"
                  value={incomingQty}
                  onChange={(e) => setIncomingQty(e.target.value)}
                  placeholder="e.g. 10000"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-emerald-500"
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
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Supplier Name</label>
                <input
                  type="text"
                  value={incomingSupplier}
                  onChange={(e) => setIncomingSupplier(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Reference Number</label>
                <input
                  type="text"
                  value={incomingRef}
                  onChange={(e) => setIncomingRef(e.target.value)}
                  placeholder="e.g. DO-SC-20260817"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-[11px] text-emerald-900 dark:text-emerald-200 font-medium">
                Total Cost: {(parseInt(incomingQty || '0') * parseFloat(incomingCost || '0')).toLocaleString()} ETB
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition-colors"
              >
                Record Incoming Scratch Cards
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Scratch Card Intake History</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold uppercase border-y border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Transaction ID</th>
                    <th className="py-2.5 px-3">Denomination</th>
                    <th className="py-2.5 px-3">Qty</th>
                    <th className="py-2.5 px-3">Unit Cost</th>
                    <th className="py-2.5 px-3">Total Cost</th>
                    <th className="py-2.5 px-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {incomingHistory.map((h) => (
                    <tr key={h.id}>
                      <td className="py-2.5 px-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">{h.id}</td>
                      <td className="py-2.5 px-3 font-bold">{h.denomination_value} ETB</td>
                      <td className="py-2.5 px-3 font-bold">{h.quantity?.toLocaleString()}</td>
                      <td className="py-2.5 px-3">{h.unit_cost} ETB</td>
                      <td className="py-2.5 px-3 font-bold">{h.total_cost?.toLocaleString()} ETB</td>
                      <td className="py-2.5 px-3">{h.received_at?.substring(0, 16)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: STOCK LEVELS */}
      {activeTab === 'stock' && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Scratch Card Stock Inventory by Denomination</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold uppercase border-y border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Denomination</th>
                  <th className="py-3 px-4">Stock Quantity</th>
                  <th className="py-3 px-4">Cost Price</th>
                  <th className="py-3 px-4">Face Value</th>
                  <th className="py-3 px-4">Valuation (ETB)</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {user?.role !== 'SHOP_USER' &&
                  centralStock.map((cs) => (
                    <tr key={cs.id} className="bg-emerald-50/40 dark:bg-emerald-950/20 font-bold">
                      <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400">Head Office Central Store</td>
                      <td className="py-3 px-4">{cs.denomination_value} ETB</td>
                      <td className="py-3 px-4 text-slate-900 dark:text-white">{cs.quantity?.toLocaleString()}</td>
                      <td className="py-3 px-4">{cs.cost_price} ETB</td>
                      <td className="py-3 px-4">{cs.selling_price} ETB</td>
                      <td className="py-3 px-4">{(cs.quantity * cs.cost_price).toLocaleString()} ETB</td>
                      <td className="py-3 px-4 text-emerald-600">Central Hub</td>
                    </tr>
                  ))}
                {branchStock.map((bs) => (
                  <tr key={bs.id}>
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{bs.branch_name}</td>
                    <td className="py-3 px-4 font-bold text-emerald-600 dark:text-emerald-400">{bs.denomination_value} ETB</td>
                    <td className="py-3 px-4 font-bold">{bs.quantity?.toLocaleString()}</td>
                    <td className="py-3 px-4">{bs.cost_price} ETB</td>
                    <td className="py-3 px-4">{bs.selling_price} ETB</td>
                    <td className="py-3 px-4">{(bs.quantity * bs.selling_price).toLocaleString()} ETB</td>
                    <td className="py-3 px-4">
                      {bs.quantity <= bs.low_stock_threshold ? (
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-600 text-[10px] font-bold">Low</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-600 text-[10px] font-bold">OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: TRANSFERS */}
      {activeTab === 'transfers' && (
        <div className="space-y-6">
          {user?.role !== 'SHOP_USER' && (
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Dispatch Scratch Cards Transfer</h3>
              <p className="text-xs text-slate-500 mb-4">Shipment requires destination branch approval before stock enters branch inventory.</p>

              <form onSubmit={handleTransferSubmit} className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Destination Branch</label>
                  <select
                    value={transferBranchId}
                    onChange={(e) => setTransferBranchId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-emerald-500"
                    required
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Denomination</label>
                  <select
                    value={transferDenomId}
                    onChange={(e) => setTransferDenomId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-emerald-500"
                    required
                  >
                    {denominations.map((d) => (
                      <option key={d.id} value={d.id}>{d.denomination_value} ETB</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={transferQty}
                    onChange={(e) => setTransferQty(e.target.value)}
                    placeholder="e.g. 500"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Notes</label>
                  <input
                    type="text"
                    value={transferNotes}
                    onChange={(e) => setTransferNotes(e.target.value)}
                    placeholder="Reference notes"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition-colors"
                  >
                    Dispatch Transfer
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Scratch Card Transfers Log</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold uppercase border-y border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Transfer ID</th>
                    <th className="py-2.5 px-3">Denomination</th>
                    <th className="py-2.5 px-3">Destination</th>
                    <th className="py-2.5 px-3">Quantity</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Sent At</th>
                    <th className="py-2.5 px-3">Sent By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {transfers.map((t) => (
                    <tr key={t.id}>
                      <td className="py-2.5 px-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">{t.id}</td>
                      <td className="py-2.5 px-3 font-bold">{t.denomination_value} ETB</td>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: POS TERMINAL */}
      {activeTab === 'sales' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md">
            <h3 className="text-base font-black text-slate-900 dark:text-white mb-1">Scratch Card POS Terminal</h3>
            <p className="text-xs text-slate-500 mb-4">Select denomination and quantity for instant checkout.</p>

            <form onSubmit={handleSaleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">Choose Denomination</label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {denominations.map((d) => {
                    const isSelected = saleDenomId === d.id;
                    const denomStock = branchStock.find(
                      (bs) => bs.denomination_id === d.id && (!user?.branch_id || bs.branch_id === user?.branch_id)
                    );
                    const availableQty = denomStock?.quantity || 0;
                    return (
                      <button
                        type="button"
                        key={d.id}
                        onClick={() => setSaleDenomId(d.id)}
                        className={`p-2.5 rounded-xl border text-center transition-all ${
                          isSelected
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/30'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-emerald-500 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        <div className="text-xs font-black">{d.denomination_value} ETB</div>
                        <div className={`text-[9px] mt-0.5 ${isSelected ? 'text-emerald-100' : 'text-slate-400'}`}>
                          Stock: {availableQty}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={saleQty}
                  onChange={(e) => setSaleQty(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="p-4 bg-slate-900 text-white rounded-2xl">
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Selected Denomination:</span>
                  <span>{selectedSaleDenom?.denomination_value || 0} ETB Card</span>
                </div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Branch Stock Available:</span>
                  <span className="font-bold text-amber-400">{currentBranchStockForSelected?.quantity || 0} cards</span>
                </div>
                <div className="flex justify-between items-baseline pt-2 border-t border-slate-800">
                  <span className="text-xs font-bold text-slate-300">Total Price:</span>
                  <span className="text-xl font-black text-emerald-400">
                    {(parseInt(saleQty || '0') * (selectedSaleDenom?.denomination_value || 0)).toLocaleString()} ETB
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={user?.role === 'SHOP_USER' && !activeSession}
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <ShoppingCart className="h-4 w-4" />
                Complete Scratch Card Sale (Cash)
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Recent Scratch Card Sales</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold uppercase border-y border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Sale ID</th>
                    <th className="py-2.5 px-3">Denomination</th>
                    <th className="py-2.5 px-3">Branch</th>
                    <th className="py-2.5 px-3">Qty</th>
                    <th className="py-2.5 px-3">Total (ETB)</th>
                    <th className="py-2.5 px-3">Profit</th>
                    <th className="py-2.5 px-3">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {sales.map((s) => (
                    <tr key={s.id}>
                      <td className="py-2.5 px-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">{s.id}</td>
                      <td className="py-2.5 px-3 font-bold">{s.denomination_value} ETB</td>
                      <td className="py-2.5 px-3">{s.branch_name}</td>
                      <td className="py-2.5 px-3 font-bold">{s.quantity}</td>
                      <td className="py-2.5 px-3 font-black text-slate-900 dark:text-white">{s.total_amount?.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-emerald-600 font-bold">+{s.profit?.toLocaleString()}</td>
                      <td className="py-2.5 px-3">{s.created_at?.substring(11, 16)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: REPORTS */}
      {activeTab === 'reports' && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">Scratch Card Reports & Analytics</h3>
              <p className="text-xs text-slate-500">Download formatted reports with denomination breakdowns.</p>
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
                  <th className="py-3 px-4">Denomination</th>
                  <th className="py-3 px-4">Branch</th>
                  <th className="py-3 px-4">Quantity</th>
                  <th className="py-3 px-4">Unit Price</th>
                  <th className="py-3 px-4">Total Amount</th>
                  <th className="py-3 px-4">Profit</th>
                  <th className="py-3 px-4">Date & Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {sales.map((s) => (
                  <tr key={s.id}>
                    <td className="py-3 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">{s.id}</td>
                    <td className="py-3 px-4 font-bold">{s.denomination_value} ETB</td>
                    <td className="py-3 px-4">{s.branch_name}</td>
                    <td className="py-3 px-4 font-bold">{s.quantity}</td>
                    <td className="py-3 px-4">{s.unit_price} ETB</td>
                    <td className="py-3 px-4 font-bold">{s.total_amount?.toLocaleString()} ETB</td>
                    <td className="py-3 px-4 font-bold text-emerald-600">+{s.profit?.toLocaleString()} ETB</td>
                    <td className="py-3 px-4">{s.created_at}</td>
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
