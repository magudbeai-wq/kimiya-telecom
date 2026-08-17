'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { HardDrive, Plus, ShieldCheck, CheckCircle2, AlertCircle, RefreshCw, FileCode, Check } from 'lucide-react';

export default function BackupsPage() {
  const { user } = useAuth();
  const [backups, setBackups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchBackups = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/backups');
      if (res.ok) {
        const json = await res.json();
        setBackups(json.backups || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, []);

  const handleCreateBackup = async () => {
    try {
      setMessage(null);
      const res = await fetch('/api/backups', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: data.message });
        await fetchBackups();
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleVerifyRestore = async (backupId: string) => {
    try {
      setVerifyingId(backupId);
      setMessage(null);
      const res = await fetch(`/api/backups/${backupId}/verify`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setVerificationResult(data.verification);
        setMessage({ type: 'success', text: data.message });
        await fetchBackups();
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setVerifyingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300">
              <HardDrive className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
              Database Backups & Disaster Recovery
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Automated SQLite database snapshots with SHA-256 cryptographic verification and sandbox restore testing.
          </p>
        </div>

        <button
          onClick={handleCreateBackup}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow flex items-center gap-2 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Create Online Snapshot Now
        </button>
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

      {/* Verification Result Inspector */}
      {verificationResult && (
        <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              <h3 className="font-bold text-sm text-emerald-950 dark:text-emerald-200">
                Disaster Recovery Sandbox Test Passed ({verificationResult.backupId})
              </h3>
            </div>
            <button
              onClick={() => setVerificationResult(null)}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              Dismiss
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-emerald-200 dark:border-emerald-900">
              <span className="text-[10px] text-slate-400 font-bold uppercase">PRAGMA Integrity</span>
              <p className="font-mono font-bold text-emerald-600">{verificationResult.integrityCheck}</p>
            </div>
            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-emerald-200 dark:border-emerald-900">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Foreign Key Violations</span>
              <p className="font-mono font-bold text-emerald-600">{verificationResult.foreignKeyErrors} errors</p>
            </div>
            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-emerald-200 dark:border-emerald-900">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Tables Verified</span>
              <p className="font-bold text-slate-800 dark:text-slate-200">
                {Object.keys(verificationResult.tableCounts || {}).length} tables
              </p>
            </div>
            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-emerald-200 dark:border-emerald-900">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Parity Status</span>
              <p className="font-bold text-emerald-600 flex items-center gap-1">
                <Check className="h-4 w-4" /> 100% Data Match
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Backups List Table */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Database Snapshot Archive ({backups.length})</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold uppercase border-y border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Backup ID</th>
                <th className="py-3 px-4">Filename</th>
                <th className="py-3 px-4">Size</th>
                <th className="py-3 px-4">SHA-256 Checksum</th>
                <th className="py-3 px-4">Verification Status</th>
                <th className="py-3 px-4">Created At</th>
                <th className="py-3 px-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {backups.map((b) => (
                <tr key={b.id}>
                  <td className="py-3 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">{b.id}</td>
                  <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">{b.file_name}</td>
                  <td className="py-3 px-4">{Math.round(b.file_size_bytes / 1024)} KB</td>
                  <td className="py-3 px-4 font-mono text-[10px] text-slate-400 max-w-xs truncate">{b.checksum}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        b.status === 'VERIFIED'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                      }`}
                    >
                      {b.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-500">{b.created_at}</td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => handleVerifyRestore(b.id)}
                      disabled={verifyingId === b.id}
                      className="px-3 py-1 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      {verifyingId === b.id ? (
                        <div className="h-3 w-3 border-2 border-emerald-600 border-t-transparent animate-spin rounded-full"></div>
                      ) : (
                        <ShieldCheck className="h-3.5 w-3.5" />
                      )}
                      Test Sandbox Restore
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
