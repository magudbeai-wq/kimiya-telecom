'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ShieldCheck, Search, Filter, Clock, User, Building2, Code2 } from 'lucide-react';

export default function AuditLogsPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState<any>(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/audit-logs?limit=100');
      if (res.ok) {
        const json = await res.json();
        setLogs(json.logs || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.entity_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.entity_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.actor_user_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAction = !actionFilter || log.action === actionFilter;
    return matchesSearch && matchesAction;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Immutable Audit Trail</h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Permanent, append-only security and business audit log. Every transfer, sale, approval, and financial adjustment is recorded.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by action, entity ID, or actor..."
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-blue-500"
          />
        </div>

        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="w-full sm:w-64 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500"
        >
          <option value="">All Actions</option>
          <option value="LOGIN_SUCCESS">LOGIN_SUCCESS</option>
          <option value="TRANSFER_DISPATCHED">TRANSFER_DISPATCHED</option>
          <option value="TRANSFER_APPROVED">TRANSFER_APPROVED</option>
          <option value="TRANSFER_REJECTED">TRANSFER_REJECTED</option>
          <option value="SALE_CREATED">SALE_CREATED</option>
          <option value="BUSINESS_SESSION_OPENED">BUSINESS_SESSION_OPENED</option>
          <option value="BUSINESS_SESSION_CLOSED">BUSINESS_SESSION_CLOSED</option>
          <option value="EXPENSE_RECORDED">EXPENSE_RECORDED</option>
          <option value="STOCK_RECONCILIATION_ADJUSTMENT">STOCK_RECONCILIATION_ADJUSTMENT</option>
        </select>
      </div>

      {/* Logs Table */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Audit Event Records ({filteredLogs.length})</h3>
          <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
            Append-Only Protected
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold uppercase border-y border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Action</th>
                <th className="py-2.5 px-3">Entity Type</th>
                <th className="py-2.5 px-3">Entity ID</th>
                <th className="py-2.5 px-3">Actor</th>
                <th className="py-2.5 px-3">Role / Branch</th>
                <th className="py-2.5 px-3">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {filteredLogs.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td className="py-2.5 px-3 font-mono text-slate-500">{l.created_at}</td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-mono font-bold text-[10px]">
                      {l.action}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-bold">{l.entity_type}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400">{l.entity_id}</td>
                  <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">{l.actor_user_name || l.actor_user_id}</td>
                  <td className="py-2.5 px-3 text-slate-500">
                    {l.actor_role} {l.actor_branch_name ? `(${l.actor_branch_name})` : ''}
                  </td>
                  <td className="py-2.5 px-3">
                    <button
                      onClick={() => setSelectedLog(l)}
                      className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-[10px] font-bold text-blue-600 dark:text-blue-400 transition-colors"
                    >
                      View Diff
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* JSON Payload Diff Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 py-8">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-lg w-full max-h-[88vh] overflow-y-auto shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Code2 className="h-5 w-5 text-blue-600" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Audit Event Details</h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <p><span className="font-bold text-slate-400">Action:</span> {selectedLog.action}</p>
              <p><span className="font-bold text-slate-400">Entity:</span> {selectedLog.entity_type} ({selectedLog.entity_id})</p>
              <p><span className="font-bold text-slate-400">Actor:</span> {selectedLog.actor_user_name} ({selectedLog.actor_role})</p>
              <p><span className="font-bold text-slate-400">Timestamp:</span> {selectedLog.created_at}</p>
            </div>

            {selectedLog.old_values && (
              <div>
                <label className="block text-[11px] font-bold text-rose-500 mb-1">Previous Values (Diff)</label>
                <pre className="p-3 bg-slate-950 text-rose-300 font-mono text-[11px] rounded-xl overflow-x-auto max-h-36">
                  {JSON.stringify(JSON.parse(selectedLog.old_values), null, 2)}
                </pre>
              </div>
            )}

            {selectedLog.new_values && (
              <div>
                <label className="block text-[11px] font-bold text-emerald-500 mb-1">New Values (Diff)</label>
                <pre className="p-3 bg-slate-950 text-emerald-300 font-mono text-[11px] rounded-xl overflow-x-auto max-h-36">
                  {JSON.stringify(JSON.parse(selectedLog.new_values), null, 2)}
                </pre>
              </div>
            )}

            <button
              onClick={() => setSelectedLog(null)}
              className="w-full py-2 bg-slate-100 dark:bg-slate-800 font-bold text-xs rounded-xl hover:bg-slate-200 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
