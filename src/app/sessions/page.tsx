'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  CalendarCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  Building2,
  DollarSign,
  Smartphone,
  CreditCard,
  Lock,
  Unlock,
  History,
} from 'lucide-react';

export default function SessionsPage() {
  const { user, activeSession, refreshSession } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [openingNotes, setOpeningNotes] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/sessions?limit=50');
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [user]);

  // Handle Open Day (Protected against duplicate submissions)
  const handleOpenDay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    try {
      setSubmitting(true);
      setMessage(null);
      const res = await fetch('/api/sessions/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: user?.branch_id,
          openingNotes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: data.message });
        setOpeningNotes('');
        await refreshSession();
        await fetchSessions();
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Close Day (Protected against duplicate submissions)
  const handleCloseDay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession || submitting) return;
    try {
      setSubmitting(true);
      setMessage(null);
      const res = await fetch('/api/sessions/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: activeSession.id,
          closingNotes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: data.message });
        setClosingNotes('');
        await refreshSession();
        await fetchSessions();
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300">
            <CalendarCheck className="h-5 w-5" />
          </div>
          <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Business Day Sessions</h1>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Branch business day open and close controller. Mandatory before selling activities. Timezone: Africa/Addis_Ababa.
        </p>
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
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
          )}
          <p className="font-semibold">{message.text}</p>
        </div>
      )}

      {/* Active Session Controller Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Status Panel */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Current Business Status</span>
              <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2 mt-1">
                {activeSession ? (
                  <>
                    <span className="flex h-3 w-3 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>BUSINESS DAY OPEN</span>
                  </>
                ) : (
                  <>
                    <span className="flex h-3 w-3 rounded-full bg-amber-500"></span>
                    <span>BUSINESS DAY CLOSED</span>
                  </>
                )}
              </h3>
            </div>

            {activeSession && (
              <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-mono font-bold text-xs rounded-full">
                #{activeSession.id}
              </span>
            )}
          </div>

          {activeSession ? (
            /* Open Session Details & Close Form */
            <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                  <span className="text-[10px] font-bold text-slate-400">Date</span>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{activeSession.business_date}</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                  <span className="text-[10px] font-bold text-slate-400">Opened At</span>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{activeSession.opened_at?.substring(11, 16)}</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                  <span className="text-[10px] font-bold text-slate-400">Opened By</span>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{activeSession.opened_by_user_name}</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                  <span className="text-[10px] font-bold text-slate-400">Branch</span>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{activeSession.branch_name}</p>
                </div>
              </div>

              <form onSubmit={handleCloseDay} className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    End-of-Day Closing Notes
                  </label>
                  <textarea
                    value={closingNotes}
                    onChange={(e) => setClosingNotes(e.target.value)}
                    rows={2}
                    placeholder="Provide closing reconciliation remarks..."
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500"
                  ></textarea>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Lock className="h-4 w-4" />
                  {submitting ? 'Processing Close Day...' : 'Close Business Day & Calculate Totals'}
                </button>
              </form>
            </div>
          ) : (
            /* Closed Session - Open Form */
            <form onSubmit={handleOpenDay} className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs text-slate-500">
                Opening the business day logs the opening timestamp in Addis Ababa time (+03:00) and enables cashier selling.
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Opening Remarks / Cash Float Notes
                </label>
                <input
                  type="text"
                  value={openingNotes}
                  onChange={(e) => setOpeningNotes(e.target.value)}
                  placeholder="e.g. Standard float verified. Ready for trade."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-semibold focus:outline-none focus:border-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Unlock className="h-4 w-4" />
                {submitting ? 'Opening Business Day...' : 'Open Business Day for Today'}
              </button>
            </form>
          )}
        </div>

        {/* Info Card */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">Business Day Protocol</h4>
          <ul className="space-y-2.5 text-xs text-slate-500">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <span>Cashiers cannot execute sales unless a business session is actively open.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <span>Closing the session aggregates SIM sales, Scratch Card sales, revenue, and local expenses automatically.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <span>All opening and closing events are audited and permanently logged in the ledger.</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Past Sessions History Table */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Business Day Sessions Archive</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold uppercase border-y border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Session ID</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Branch</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">SIMs Sold</th>
                <th className="py-2.5 px-3">Scratch Sold</th>
                <th className="py-2.5 px-3">Total Revenue</th>
                <th className="py-2.5 px-3">Opened By</th>
                <th className="py-2.5 px-3">Closed At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td className="py-2.5 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">{s.id}</td>
                  <td className="py-2.5 px-3 font-bold">{s.business_date}</td>
                  <td className="py-2.5 px-3">{s.branch_name}</td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        s.status === 'OPEN'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">{s.total_sim_sold}</td>
                  <td className="py-2.5 px-3">{s.total_scratch_sold}</td>
                  <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                    {Number(s.total_revenue || 0).toLocaleString()} ETB
                  </td>
                  <td className="py-2.5 px-3">{s.opened_by_user_name}</td>
                  <td className="py-2.5 px-3">{s.closed_at ? s.closed_at.substring(11, 16) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
