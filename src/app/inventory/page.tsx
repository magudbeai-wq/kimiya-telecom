'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Boxes, Smartphone, CreditCard, Building2, Download, AlertTriangle } from 'lucide-react';

export default function InventoryPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'all' | 'central' | 'branches'>('all');
  const [centralStock, setCentralStock] = useState<any[]>([]);
  const [branchStock, setBranchStock] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const [csRes, bsRes] = await Promise.all([
        user?.role !== 'SHOP_USER' ? fetch('/api/inventory/central') : Promise.resolve(null),
        fetch('/api/inventory/branch'),
      ]);

      if (csRes && csRes.ok) {
        const csJson = await csRes.json();
        setCentralStock(csJson.centralStock || []);
      }
      if (bsRes && bsRes.ok) {
        const bsJson = await bsRes.json();
        setBranchStock(bsJson.branchStock || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, [user]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300">
              <Boxes className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Inventory & Stock Levels</h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time multi-location stock valuations for SIM Cards and Scratch Cards.
          </p>
        </div>

        {user?.role !== 'SHOP_USER' && (
          <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'all' ? 'bg-blue-600 text-white shadow' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              All Locations
            </button>
            <button
              onClick={() => setActiveTab('central')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'central' ? 'bg-blue-600 text-white shadow' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Central Store
            </button>
            <button
              onClick={() => setActiveTab('branches')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'branches' ? 'bg-blue-600 text-white shadow' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Branches
            </button>
          </div>
        )}
      </div>

      {/* Central Store Table */}
      {(activeTab === 'all' || activeTab === 'central') && user?.role !== 'SHOP_USER' && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-600"></span>
              Head Office Central Store Inventory
            </h3>
            <span className="text-xs text-slate-400">Managed by Finance</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold uppercase border-y border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Product</th>
                  <th className="py-2.5 px-3">Denomination</th>
                  <th className="py-2.5 px-3">Quantity</th>
                  <th className="py-2.5 px-3">Cost Price</th>
                  <th className="py-2.5 px-3">Retail Price</th>
                  <th className="py-2.5 px-3">Valuation (ETB)</th>
                  <th className="py-2.5 px-3">Threshold</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {centralStock.map((s) => (
                  <tr key={s.id}>
                    <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      {s.product_type === 'SIM' ? <Smartphone className="h-4 w-4 text-blue-500" /> : <CreditCard className="h-4 w-4 text-emerald-500" />}
                      {s.product_type}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-emerald-600">
                      {s.denomination_value ? `${s.denomination_value} ETB` : 'Quantity Only'}
                    </td>
                    <td className="py-2.5 px-3 font-black text-slate-900 dark:text-white text-sm">{s.quantity?.toLocaleString()}</td>
                    <td className="py-2.5 px-3">{s.cost_price} ETB</td>
                    <td className="py-2.5 px-3">{s.selling_price} ETB</td>
                    <td className="py-2.5 px-3 font-bold">{(s.quantity * s.cost_price).toLocaleString()} ETB</td>
                    <td className="py-2.5 px-3 text-slate-400">{s.low_stock_threshold} units</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Branch Stock Table */}
      {(activeTab === 'all' || activeTab === 'branches' || user?.role === 'SHOP_USER') && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-600"></span>
              {user?.role === 'SHOP_USER' ? `${user.branch_name} Branch Stock` : 'Retail Branches Inventory'}
            </h3>
            <span className="text-xs text-slate-400">Available Point-of-Sale Stock</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold uppercase border-y border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Branch</th>
                  <th className="py-2.5 px-3">Product</th>
                  <th className="py-2.5 px-3">Denomination</th>
                  <th className="py-2.5 px-3">Quantity</th>
                  <th className="py-2.5 px-3">Retail Price</th>
                  <th className="py-2.5 px-3">Stock Value (ETB)</th>
                  <th className="py-2.5 px-3">Safety Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {branchStock.map((b) => (
                  <tr key={b.id}>
                    <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">{b.branch_name}</td>
                    <td className="py-2.5 px-3 font-semibold">{b.product_type}</td>
                    <td className="py-2.5 px-3 font-bold text-emerald-600">
                      {b.denomination_value ? `${b.denomination_value} ETB` : 'Quantity'}
                    </td>
                    <td className="py-2.5 px-3 font-black text-slate-900 dark:text-white text-sm">{b.quantity?.toLocaleString()}</td>
                    <td className="py-2.5 px-3">{b.selling_price} ETB</td>
                    <td className="py-2.5 px-3 font-bold">{(b.quantity * b.selling_price).toLocaleString()} ETB</td>
                    <td className="py-2.5 px-3">
                      {b.quantity <= b.low_stock_threshold ? (
                        <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-600 font-bold text-[10px]">
                          Low Stock ({b.quantity})
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-600 font-bold text-[10px]">
                          In Stock
                        </span>
                      )}
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
