'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { PackagePlus, Smartphone, CreditCard, CheckCircle2, AlertCircle, Boxes } from 'lucide-react';
import { ProductType } from '@/lib/types';

export default function IncomingPage() {
  const { user } = useAuth();
  const [productType, setProductType] = useState<ProductType>('SIM');
  const [denominations, setDenominations] = useState<any[]>([]);
  const [incomingHistory, setIncomingHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Form states
  const [denominationId, setDenominationId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('30.00');
  const [supplierName, setSupplierName] = useState('Ethio Telecom Central Distribution');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [dnRes, inRes] = await Promise.all([
        fetch('/api/inventory/denominations'),
        fetch('/api/inventory/incoming?limit=50'),
      ]);

      if (dnRes.ok) {
        const json = await dnRes.json();
        setDenominations(json.denominations || []);
        if (json.denominations.length > 0 && !denominationId) {
          setDenominationId(json.denominations[0].id);
        }
      }
      if (inRes.ok) {
        const json = await inRes.json();
        setIncomingHistory(json.history || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (productType === 'SIM') {
      setUnitCost('30.00');
    } else {
      const selected = denominations.find((d) => d.id === denominationId);
      if (selected) {
        setUnitCost((selected.denomination_value * 0.9).toFixed(2));
      }
    }
  }, [productType, denominationId, denominations]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setMessage(null);
      const res = await fetch('/api/inventory/incoming', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productType,
          denominationId: productType === 'SCRATCH_CARD' ? denominationId : null,
          quantity: parseInt(quantity),
          unitCost: parseFloat(unitCost),
          supplierName,
          referenceNumber: referenceNumber || `REF-${Date.now()}`,
          notes,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: `Incoming stock batch #${data.incoming.id} recorded into Central Store.` });
        setQuantity('');
        setReferenceNumber('');
        setNotes('');
        await fetchData();
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
            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300">
              <PackagePlus className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Incoming Stock Receiving</h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Finance & Head Office central store stock intake from telecom supplier.
          </p>
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
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
          )}
          <p className="font-semibold">{message.text}</p>
        </div>
      )}

      {/* Grid: Form & History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Box */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="font-black text-sm text-slate-900 dark:text-white">Receive Stock Delivery</h3>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setProductType('SIM')}
              className={`p-2.5 rounded-xl border text-center font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                productType === 'SIM'
                  ? 'bg-blue-600 text-white border-blue-600 shadow'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              <Smartphone className="h-4 w-4" />
              SIM Cards
            </button>
            <button
              type="button"
              onClick={() => setProductType('SCRATCH_CARD')}
              className={`p-2.5 rounded-xl border text-center font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                productType === 'SCRATCH_CARD'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              <CreditCard className="h-4 w-4" />
              Scratch Cards
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {productType === 'SCRATCH_CARD' && (
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Denomination</label>
                <select
                  value={denominationId}
                  onChange={(e) => setDenominationId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500"
                  required
                >
                  {denominations.map((d) => (
                    <option key={d.id} value={d.id}>{d.denomination_value} ETB Scratch Card</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Delivered Quantity</label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="e.g. 10000"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Unit Cost Price (ETB)</label>
              <input
                type="number"
                step="0.01"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Supplier</label>
              <input
                type="text"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Delivery Reference #</label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="e.g. GRN-2026-0817"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="p-3 bg-slate-900 text-white rounded-xl text-xs space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>Valuation:</span>
                <span className="font-bold text-emerald-400">
                  {(parseInt(quantity || '0') * parseFloat(unitCost || '0')).toLocaleString()} ETB
                </span>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md transition-colors"
            >
              Confirm Receipt into Central Store
            </button>
          </form>
        </div>

        {/* History Table */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Central Store Receiving Log</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold uppercase border-y border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Transaction ID</th>
                  <th className="py-2.5 px-3">Product</th>
                  <th className="py-2.5 px-3">Quantity</th>
                  <th className="py-2.5 px-3">Unit Cost</th>
                  <th className="py-2.5 px-3">Total Cost</th>
                  <th className="py-2.5 px-3">Supplier</th>
                  <th className="py-2.5 px-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {incomingHistory.map((h) => (
                  <tr key={h.id}>
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">{h.id}</td>
                    <td className="py-2.5 px-3 font-bold">
                      {h.product_type} {h.denomination_value ? `(${h.denomination_value} ETB)` : ''}
                    </td>
                    <td className="py-2.5 px-3 font-bold">{h.quantity?.toLocaleString()}</td>
                    <td className="py-2.5 px-3">{h.unit_cost} ETB</td>
                    <td className="py-2.5 px-3 font-bold">{h.total_cost?.toLocaleString()} ETB</td>
                    <td className="py-2.5 px-3">{h.supplier_name}</td>
                    <td className="py-2.5 px-3 text-slate-500">{h.received_at?.substring(0, 16)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
