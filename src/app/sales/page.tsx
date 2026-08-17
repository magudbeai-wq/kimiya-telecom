'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  ShoppingCart,
  Smartphone,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  CalendarCheck,
  Search,
  Percent,
  Plus,
  Minus,
  Trash2,
  Printer,
} from 'lucide-react';

export default function SalesPage() {
  const { user, activeSession } = useAuth();
  const [productType, setProductType] = useState<'SIM' | 'SCRATCH_CARD'>('SCRATCH_CARD');
  const [denominations, setDenominations] = useState<any[]>([]);
  const [branchStock, setBranchStock] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // SIM Sale state
  const [simQty, setSimQty] = useState('1');
  const [simUnitPrice, setSimUnitPrice] = useState('50.00');

  // Scratch Multi-Denomination Cart State
  // map denomination_id -> quantity string
  const [scratchQuantities, setScratchQuantities] = useState<Record<string, string>>({});
  const [discountPercent, setDiscountPercent] = useState<number>(6.0); // Default 6% wholesale discount

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBranchId, setFilterBranchId] = useState('');
  const [branches, setBranches] = useState<any[]>([]);

  // Receipt Modal / Banner
  const [recentReceipt, setRecentReceipt] = useState<any>(null);
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
        const denoms = json.denominations || [];
        setDenominations(denoms);
        // Initialize scratch quantities if not set
        setScratchQuantities((prev) => {
          const updated = { ...prev };
          denoms.forEach((d: any) => {
            if (updated[d.id] === undefined) updated[d.id] = '0';
          });
          return updated;
        });
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

  // Stock helpers
  const getSimStock = () => {
    const bs = branchStock.find(
      (b) => b.product_type === 'SIM' && (!user?.branch_id || b.branch_id === user?.branch_id)
    );
    return bs?.quantity || 0;
  };

  const getDenomStock = (denomId: string) => {
    const bs = branchStock.find(
      (b) =>
        b.product_type === 'SCRATCH_CARD' &&
        b.denomination_id === denomId &&
        (!user?.branch_id || b.branch_id === user?.branch_id)
    );
    return bs?.quantity || 0;
  };

  // Scratch Bundle calculations
  const scratchCartCalculations = (() => {
    let grossTotal = 0;
    let totalCardQty = 0;
    const itemsList: Array<{ denominationId: string; faceValue: number; quantity: number; lineGross: number; availStock: number }> = [];

    denominations.forEach((d) => {
      const q = parseInt(scratchQuantities[d.id] || '0');
      const avail = getDenomStock(d.id);
      if (q > 0) {
        const lineGross = q * d.denomination_value;
        grossTotal += lineGross;
        totalCardQty += q;
        itemsList.push({
          denominationId: d.id,
          faceValue: d.denomination_value,
          quantity: q,
          lineGross,
          availStock: avail,
        });
      }
    });

    const discountAmount = grossTotal * (discountPercent / 100);
    const netCashTotal = grossTotal - discountAmount;

    return {
      grossTotal,
      totalCardQty,
      itemsList,
      discountAmount,
      netCashTotal,
    };
  })();

  const handleSetScratchQty = (denomId: string, val: string) => {
    const num = Math.max(0, parseInt(val || '0'));
    setScratchQuantities((prev) => ({
      ...prev,
      [denomId]: String(isNaN(num) ? 0 : num),
    }));
  };

  const handleAdjustScratchQty = (denomId: string, delta: number) => {
    const current = parseInt(scratchQuantities[denomId] || '0');
    const avail = getDenomStock(denomId);
    const nextVal = Math.min(avail, Math.max(0, current + delta));
    setScratchQuantities((prev) => ({
      ...prev,
      [denomId]: String(nextVal),
    }));
  };

  const handleClearScratchCart = () => {
    const reset: Record<string, string> = {};
    denominations.forEach((d) => {
      reset[d.id] = '0';
    });
    setScratchQuantities(reset);
  };

  // Submit SIM Sale
  const handleSimSaleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setMessage(null);
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: user?.branch_id,
          productType: 'SIM',
          quantity: parseInt(simQty),
          unitPrice: parseFloat(simUnitPrice),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setRecentReceipt({
          id: data.sale.id,
          type: 'SIM',
          items: [{ name: 'SIM Cards', qty: data.sale.quantity, unitPrice: data.sale.unit_price, lineTotal: data.sale.total_amount }],
          grossAmount: data.sale.total_amount,
          discountAmount: 0,
          netAmount: data.sale.total_amount,
          time: new Date().toLocaleString(),
          cashier: user?.full_name || user?.username,
          branch: data.sale.branch_name,
        });
        setMessage({ type: 'success', text: data.message });
        setSimQty('1');
        await fetchData();
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  // Submit Scratch Multi-Item Wholesale Bundle Sale
  const handleScratchBundleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setMessage(null);
      const validItems = scratchCartCalculations.itemsList.map((i) => ({
        denominationId: i.denominationId,
        quantity: i.quantity,
      }));

      if (validItems.length === 0) {
        setMessage({ type: 'error', text: 'Please enter quantity for at least one scratch card denomination.' });
        return;
      }

      // Check stock
      for (const item of scratchCartCalculations.itemsList) {
        if (item.quantity > item.availStock) {
          setMessage({
            type: 'error',
            text: `Insufficient stock for ${item.faceValue} ETB cards. Available: ${item.availStock}, Requested: ${item.quantity}.`,
          });
          return;
        }
      }

      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: user?.branch_id,
          isBundle: true,
          items: validItems,
          discountPercentage: discountPercent,
        }),
      });

      const data = await res.json();
      if (data.success) {
        const bundle = data.bundle;
        setRecentReceipt({
          id: bundle.bundleId,
          type: 'SCRATCH_CARD_WHOLESALE',
          items: scratchCartCalculations.itemsList.map((i) => ({
            name: `${i.faceValue} ETB Scratch Card`,
            qty: i.quantity,
            faceValue: i.faceValue,
            lineGross: i.lineGross,
          })),
          grossAmount: bundle.grossAmount,
          discountPercent: bundle.discountPercentage,
          discountAmount: bundle.discountAmount,
          netAmount: bundle.netAmount,
          totalQty: bundle.totalQuantity,
          time: new Date().toLocaleString(),
          cashier: user?.full_name || user?.username,
          branch: branches.find((b) => b.id === user?.branch_id)?.name || 'Branch',
        });

        setMessage({ type: 'success', text: data.message });
        handleClearScratchCart();
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
    <div className="space-y-6 pb-12">
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
            Cash sales terminal with immediate inventory ledger deduction and 6% customer margin discount calculations.
          </p>
        </div>

        {/* Business Day indicator */}
        {user?.role === 'SHOP_USER' && (
          <div
            className={`px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 shadow-sm ${
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
        <div className="lg:col-span-7 space-y-5">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-black text-sm text-slate-900 dark:text-white">Direct Retail & Wholesale POS</h3>
                <p className="text-xs text-slate-500">Multi-denomination scratch bundle or individual SIM card sales.</p>
              </div>

              {/* Product System Toggle */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setProductType('SCRATCH_CARD')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all ${
                    productType === 'SCRATCH_CARD'
                      ? 'bg-emerald-600 text-white shadow'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                >
                  <CreditCard className="h-3.5 w-3.5" />
                  Scratch Cards (6% Discount)
                </button>
                <button
                  type="button"
                  onClick={() => setProductType('SIM')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all ${
                    productType === 'SIM'
                      ? 'bg-blue-600 text-white shadow'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                >
                  <Smartphone className="h-3.5 w-3.5" />
                  SIM Cards
                </button>
              </div>
            </div>

            {/* ======================================================== */}
            {/* SCRATCH CARD WHOLESALE MULTI-DENOMINATION CART */}
            {/* ======================================================== */}
            {productType === 'SCRATCH_CARD' && (
              <form onSubmit={handleScratchBundleSubmit} className="space-y-5">
                {/* Wholesale Discount Selector */}
                <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Percent className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-xs font-black text-emerald-900 dark:text-emerald-200">
                        Customer Wholesale Margin / Dhimista Macmiilka
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {[6.0, 5.0, 7.0].map((rate) => (
                        <button
                          key={rate}
                          type="button"
                          onClick={() => setDiscountPercent(rate)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all ${
                            discountPercent === rate
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {rate}% {rate === 6.0 ? '(Standard)' : ''}
                        </button>
                      ))}
                      <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-0.5">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={discountPercent}
                          onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
                          className="w-10 bg-transparent text-xs font-bold text-slate-900 dark:text-white focus:outline-none text-right"
                        />
                        <span className="text-[10px] font-bold text-slate-400 ml-0.5">%</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
                    Standard 6% discount is automatically deducted from total face value as the retailer's wholesale commission.
                  </p>
                </div>

                {/* Denominations Quantity Grid */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Select Denominations & Quantities (Xabbadaha)
                    </label>
                    <button
                      type="button"
                      onClick={handleClearScratchCart}
                      className="text-[11px] font-bold text-rose-500 hover:text-rose-600 flex items-center gap-1"
                    >
                      <Trash2 className="h-3 w-3" />
                      Clear Quantities
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                    {denominations.map((d) => {
                      const avail = getDenomStock(d.id);
                      const currentQty = parseInt(scratchQuantities[d.id] || '0');
                      const lineGross = currentQty * d.denomination_value;

                      return (
                        <div
                          key={d.id}
                          className={`p-3.5 rounded-xl border transition-all space-y-2.5 ${
                            currentQty > 0
                              ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-300 dark:border-blue-800 shadow-sm'
                              : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="font-black text-sm text-slate-900 dark:text-white">
                                {d.denomination_value} ETB
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium">Card</span>
                            </div>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                avail > 0
                                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                              }`}
                            >
                              {avail.toLocaleString()} in stock
                            </span>
                          </div>

                          {/* Quick Steppers & Input */}
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleAdjustScratchQty(d.id, -50)}
                              className="p-1.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 text-[11px] font-bold"
                            >
                              -50
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAdjustScratchQty(d.id, -10)}
                              className="p-1.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 text-[11px] font-bold"
                            >
                              -10
                            </button>
                            <input
                              type="number"
                              min="0"
                              max={avail}
                              value={scratchQuantities[d.id] || '0'}
                              onChange={(e) => handleSetScratchQty(d.id, e.target.value)}
                              className="w-full text-center bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg py-1 text-xs font-black text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                            />
                            <button
                              type="button"
                              onClick={() => handleAdjustScratchQty(d.id, 10)}
                              className="p-1.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 text-[11px] font-bold"
                            >
                              +10
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAdjustScratchQty(d.id, 50)}
                              className="p-1.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 text-[11px] font-bold"
                            >
                              +50
                            </button>
                          </div>

                          {currentQty > 0 && (
                            <div className="flex justify-between text-[11px] pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                              <span className="text-slate-500">Gross Value:</span>
                              <span className="font-bold text-slate-900 dark:text-white">
                                {lineGross.toLocaleString()} ETB
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Calculation Summary Box */}
                <div className="p-5 bg-slate-950 text-white rounded-2xl space-y-3 shadow-xl border border-slate-800">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Total Cards Selected:</span>
                    <span className="font-bold text-white">{scratchCartCalculations.totalCardQty.toLocaleString()} pcs</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Wadarta Qiimaha Wejiga (Gross Face Value):</span>
                    <span className="font-bold text-white text-sm">
                      {scratchCartCalculations.grossTotal.toLocaleString()} ETB
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-emerald-400 font-semibold">
                    <span>Dhimista Macmiilka ({discountPercent}% Customer Margin):</span>
                    <span>- {scratchCartCalculations.discountAmount.toLocaleString()} ETB</span>
                  </div>
                  <div className="flex justify-between items-baseline pt-3 border-t border-slate-800">
                    <div>
                      <span className="text-xs font-black text-slate-300 uppercase tracking-wider block">
                        Lacagta Cash-ka ee Soo Gashay (Net Cash Paid):
                      </span>
                      <span className="text-[10px] text-slate-400">Exact amount to collect into cash drawer</span>
                    </div>
                    <span className="text-2xl font-black text-emerald-400">
                      {scratchCartCalculations.netCashTotal.toLocaleString()} ETB
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={
                    (user?.role === 'SHOP_USER' && !activeSession) ||
                    scratchCartCalculations.totalCardQty === 0
                  }
                  className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm rounded-xl shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <ShoppingCart className="h-5 w-5" />
                  Complete Wholesale Sale ({scratchCartCalculations.netCashTotal.toLocaleString()} ETB Cash)
                </button>
              </form>
            )}

            {/* ======================================================== */}
            {/* SIM CARD RETAIL SALE */}
            {/* ======================================================== */}
            {productType === 'SIM' && (
              <form onSubmit={handleSimSaleSubmit} className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      SIM Card Selling Price (ETB)
                    </label>
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">
                      Editable Unit Price
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.50"
                      min="0.01"
                      value={simUnitPrice}
                      onChange={(e) => setSimUnitPrice(e.target.value)}
                      placeholder="e.g. 50.00"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 pr-14"
                      required
                    />
                    <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-xs font-black text-slate-400">
                      ETB
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Quantity</label>
                    <span className="text-[11px] text-slate-400">
                      Stock Available: <span className="font-bold text-blue-600 dark:text-blue-400">{getSimStock()}</span>
                    </span>
                  </div>
                  <input
                    type="number"
                    min="1"
                    max={getSimStock() > 0 ? getSimStock() : 1}
                    value={simQty}
                    onChange={(e) => setSimQty(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>

                {/* Calculation summary */}
                <div className="p-4 bg-slate-950 text-white rounded-2xl space-y-2">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Unit Selling Price:</span>
                    <span>{simUnitPrice} ETB</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Quantity:</span>
                    <span>{simQty || 0} units</span>
                  </div>
                  <div className="flex justify-between items-baseline pt-2 border-t border-slate-800">
                    <span className="text-xs font-bold text-slate-300">Total Authoritative Cash:</span>
                    <span className="text-xl font-black text-emerald-400">
                      {(parseInt(simQty || '0') * parseFloat(simUnitPrice || '0')).toLocaleString()} ETB
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={(user?.role === 'SHOP_USER' && !activeSession) || getSimStock() < parseInt(simQty || '1')}
                  className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs rounded-xl shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <ShoppingCart className="h-4 w-4" />
                  Complete SIM Sale (Cash Payment)
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Right: Sales Stream and Receipt viewer */}
        <div className="lg:col-span-5 space-y-4">
          {/* Recent Receipt preview banner if sale was just completed */}
          {recentReceipt && (
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border-2 border-emerald-500 shadow-xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-emerald-600" />
                  <div>
                    <h4 className="font-black text-xs text-slate-900 dark:text-white">KIMIYA TELECOM RECEIPT</h4>
                    <p className="text-[10px] text-slate-400 font-mono">ID: #{recentReceipt.id}</p>
                  </div>
                </div>
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded-lg flex items-center gap-1 shadow-sm transition-colors"
                >
                  <Printer className="h-3 w-3" />
                  Print Slip
                </button>
              </div>

              <div className="space-y-1 text-xs divide-y divide-slate-100 dark:divide-slate-800">
                <div className="py-1">
                  <p className="text-[11px] text-slate-500">Branch: <span className="font-bold text-slate-800 dark:text-slate-200">{recentReceipt.branch}</span></p>
                  <p className="text-[11px] text-slate-500">Cashier: <span className="font-bold text-slate-800 dark:text-slate-200">{recentReceipt.cashier}</span></p>
                  <p className="text-[11px] text-slate-500">Time: <span className="font-bold text-slate-800 dark:text-slate-200">{recentReceipt.time}</span></p>
                </div>

                <div className="py-2 space-y-1">
                  {recentReceipt.items.map((it: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-[11px]">
                      <span>{it.qty} × {it.name}</span>
                      <span className="font-bold">{(it.lineGross || it.lineTotal)?.toLocaleString()} ETB</span>
                    </div>
                  ))}
                </div>

                <div className="pt-2 space-y-1">
                  {recentReceipt.discountAmount > 0 && (
                    <>
                      <div className="flex justify-between text-slate-500 text-xs">
                        <span>Gross Face Value:</span>
                        <span>{recentReceipt.grossAmount.toLocaleString()} ETB</span>
                      </div>
                      <div className="flex justify-between text-emerald-600 text-xs font-bold">
                        <span>Customer Margin ({recentReceipt.discountPercent}%):</span>
                        <span>- {recentReceipt.discountAmount.toLocaleString()} ETB</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between text-sm font-black text-slate-900 dark:text-white pt-1">
                    <span>TOTAL CASH COLLECTED:</span>
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {recentReceipt.netAmount.toLocaleString()} ETB
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Sales History Log Table with Filter */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Recent Transactions</h3>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search sale ID..."
                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-8 pr-3 py-1 text-xs focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold uppercase border-y border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Sale ID</th>
                    <th className="py-2.5 px-3">Product</th>
                    <th className="py-2.5 px-3">Qty</th>
                    <th className="py-2.5 px-3">Cash (ETB)</th>
                    <th className="py-2.5 px-3">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {filteredSales.slice(0, 15).map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">{s.id}</td>
                      <td className="py-2.5 px-3">
                        {s.product_type} {s.denomination_value ? `(${s.denomination_value} ETB)` : ''}
                      </td>
                      <td className="py-2.5 px-3 font-bold">{s.quantity}</td>
                      <td className="py-2.5 px-3 font-black text-slate-900 dark:text-white">{s.total_amount?.toLocaleString()}</td>
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
