'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  FileSpreadsheet,
  Download,
  Filter,
  Calendar,
  Building2,
  Boxes,
  ShoppingCart,
  ArrowLeftRight,
  Receipt,
  FileText,
} from 'lucide-react';

export default function ReportsPage() {
  const { user } = useAuth();
  const [reportType, setReportType] = useState('SALES');
  const [branchId, setBranchId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [branches, setBranches] = useState<any[]>([]);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchBranches = async () => {
    try {
      const res = await fetch('/api/branches');
      if (res.ok) {
        const json = await res.json();
        setBranches(json.branches || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPreview = async () => {
    try {
      setLoading(true);
      const targetBranch = user?.role === 'SHOP_USER' ? user.branch_id : branchId;

      if (reportType === 'SALES' || reportType === 'SIM_SALES' || reportType === 'SCRATCH_SALES') {
        const pType = reportType === 'SIM_SALES' ? 'SIM' : reportType === 'SCRATCH_SALES' ? 'SCRATCH_CARD' : '';
        const url = `/api/sales?branchId=${targetBranch || ''}&productType=${pType}&startDate=${startDate}&endDate=${endDate}&limit=50`;
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          setPreviewData(json.sales || []);
        }
      } else if (reportType === 'CENTRAL_STOCK') {
        const res = await fetch('/api/inventory/central');
        if (res.ok) {
          const json = await res.json();
          setPreviewData(json.centralStock || []);
        }
      } else if (reportType === 'BRANCH_STOCK') {
        const res = await fetch(`/api/inventory/branch?branchId=${targetBranch || ''}`);
        if (res.ok) {
          const json = await res.json();
          setPreviewData(json.branchStock || []);
        }
      } else if (reportType === 'TRANSFERS') {
        const res = await fetch(`/api/transfers?branchId=${targetBranch || ''}&startDate=${startDate}&endDate=${endDate}&limit=50`);
        if (res.ok) {
          const json = await res.json();
          setPreviewData(json.transfers || []);
        }
      } else if (reportType === 'EXPENSES') {
        const res = await fetch(`/api/expenses?branchId=${targetBranch || ''}&startDate=${startDate}&endDate=${endDate}&limit=50`);
        if (res.ok) {
          const json = await res.json();
          setPreviewData(json.expenses || []);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    fetchPreview();
  }, [reportType, branchId, startDate, endDate, user]);

  const handleExport = async (format: 'EXCEL' | 'PDF') => {
    try {
      const targetBranch = user?.role === 'SHOP_USER' ? user.branch_id : branchId;
      const res = await fetch('/api/reports/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType,
          format,
          branchId: targetBranch || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        }),
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `KIMIYA_${reportType}_${new Date().toISOString().substring(0, 10)}.${format === 'EXCEL' ? 'xlsx' : 'pdf'}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Report Center & Exports</h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Export company-wide financial, inventory, transfer, and sales statements into formatted Excel (.xlsx) and PDF (.pdf).
          </p>
        </div>

        {/* Download Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport('EXCEL')}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition-colors flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export Excel (.xlsx)
          </button>
          <button
            onClick={() => handleExport('PDF')}
            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow transition-colors flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export PDF (.pdf)
          </button>
        </div>
      </div>

      {/* Filter Control Bar */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Report Type</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500"
            >
              <option value="SALES">All Sales Report</option>
              <option value="SIM_SALES">SIM Card Sales Only</option>
              <option value="SCRATCH_SALES">Scratch Card Sales Only</option>
              <option value="CENTRAL_STOCK">Central Store Stock Valuation</option>
              <option value="BRANCH_STOCK">Branch Stock Valuation</option>
              <option value="TRANSFERS">Stock Transfers & Approvals Log</option>
              <option value="EXPENSES">Operational Expenses Statement</option>
            </select>
          </div>

          {user?.role !== 'SHOP_USER' && (
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Branch Scope</label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500"
              >
                <option value="">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Live Preview Table */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Live Report Preview ({previewData.length} records)
          </h3>
          <span className="text-xs text-slate-400">Values match database records exactly</span>
        </div>

        <div className="overflow-x-auto">
          {previewData.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">No records found matching current criteria.</div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold uppercase border-y border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Record ID</th>
                  <th className="py-2.5 px-3">Date / Time</th>
                  <th className="py-2.5 px-3">Location / Branch</th>
                  <th className="py-2.5 px-3">Product / Detail</th>
                  <th className="py-2.5 px-3">Qty</th>
                  <th className="py-2.5 px-3">Amount / Valuation (ETB)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {previewData.slice(0, 30).map((row, idx) => (
                  <tr key={row.id || idx}>
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">{row.id}</td>
                    <td className="py-2.5 px-3 text-slate-500">{row.created_at || row.date || row.sent_at || '-'}</td>
                    <td className="py-2.5 px-3 font-bold">{row.branch_name || row.destination_branch_name || 'Central Store'}</td>
                    <td className="py-2.5 px-3">
                      {row.product_type || row.category || '-'}{' '}
                      {row.denomination_value ? `(${row.denomination_value} ETB)` : ''}
                    </td>
                    <td className="py-2.5 px-3 font-bold">{row.quantity ? row.quantity.toLocaleString() : '-'}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                      {Number(row.total_amount || row.amount || (row.quantity * (row.cost_price || row.selling_price || 0)) || 0).toLocaleString()} ETB
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
