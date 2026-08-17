'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  TrendingUp,
  Building2,
  Boxes,
  CreditCard,
  Smartphone,
  Calendar,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [trend, setTrend] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [scratchPerformance, setScratchPerformance] = useState<any[]>([]);
  const [days, setDays] = useState('14');
  const [loading, setLoading] = useState(false);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const [trRes, brRes, scRes] = await Promise.all([
        fetch(`/api/analytics/trend?days=${days}`),
        user?.role !== 'SHOP_USER' ? fetch('/api/analytics/branches') : Promise.resolve(null),
        user?.role !== 'SHOP_USER' ? fetch('/api/analytics/scratch') : Promise.resolve(null),
      ]);

      if (trRes.ok) {
        const json = await trRes.json();
        setTrend(json.trend || []);
      }
      if (brRes && brRes.ok) {
        const json = await brRes.json();
        setBranches(json.comparison || []);
      }
      if (scRes && scRes.ok) {
        const json = await scRes.json();
        setScratchPerformance(json.performance || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [days, user]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300">
              <TrendingUp className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Enterprise Analytics</h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time financial performance, branch comparisons, and denomination analytics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500">Timeline:</span>
          <select
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none"
          >
            <option value="7">Past 7 Days</option>
            <option value="14">Past 14 Days</option>
            <option value="30">Past 30 Days</option>
            <option value="90">Past 90 Days</option>
          </select>
        </div>
      </div>

      {/* Main Revenue vs Profit Area Chart */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Daily Revenue, Expenses & Net Profit Trend</h3>
          <p className="text-xs text-slate-500">Continuous daily tracking</p>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="anRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1367f6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#1367f6" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="anProf" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', fontSize: '12px' }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              <Area type="monotone" dataKey="revenue" name="Total Revenue (ETB)" stroke="#1367f6" strokeWidth={2} fill="url(#anRev)" />
              <Area type="monotone" dataKey="profit" name="Net Profit (ETB)" stroke="#10b981" strokeWidth={2} fill="url(#anProf)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Branch Comparison & Denomination Breakdowns */}
      {user?.role !== 'SHOP_USER' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Branch Comparison Bar Chart */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Revenue by Branch</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={branches} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
                  <XAxis dataKey="branchCode" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Bar dataKey="revenue" name="Revenue (ETB)" fill="#1367f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="profit" name="Net Profit (ETB)" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Scratch Denomination Distribution Bar Chart */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Scratch Cards Sold by Denomination</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={scratchPerformance} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
                  <XAxis dataKey="denominationValue" unit=" ETB" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Bar dataKey="soldQuantity" name="Cards Sold (Units)" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="totalBranchStock" name="Current Stock (Units)" fill="#89ccff" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
