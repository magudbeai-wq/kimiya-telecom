'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ShieldCheck, UserCheck, KeyRound, Building2, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please enter both username and password.');
      return;
    }
    setError(null);
    setLoading(true);
    const result = await login(username, password);
    if (!result.success) {
      setError(result.error || 'Invalid credentials.');
    }
    setLoading(false);
  };

  const handleQuickFill = (u: string, p = 'Password@123') => {
    setUsername(u);
    setPassword(p);
    setError(null);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-blue-950 px-4 py-8 relative overflow-hidden">
      {/* Background Decorative Glow */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 relative z-10 text-white">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white font-black text-2xl shadow-lg shadow-blue-500/25 mb-4">
            KT
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">KIMIYA TELECOM</h1>
          <p className="text-xs text-slate-400 font-medium tracking-wide mt-1">
            Enterprise Telecom Distribution & Management
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-3.5 bg-rose-950/60 border border-rose-800/80 rounded-xl flex items-center gap-3 text-rose-300 text-xs">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <p>{error}</p>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Username
            </label>
            <div className="relative">
              <UserCheck className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className="w-full bg-slate-950/60 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950/60 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 rounded-xl text-xs shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="h-4 w-4 border-2 border-white border-t-transparent animate-spin rounded-full"></div>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" />
                Sign In to Kimiya Telecom
              </>
            )}
          </button>
        </form>

        {/* Quick Demo Accounts Selection */}
        <div className="mt-8 pt-6 border-t border-slate-800/80">
          <p className="text-[11px] font-bold tracking-wider text-slate-400 uppercase text-center mb-3">
            Quick-Login Demo Accounts
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleQuickFill('admin')}
              className="p-2.5 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 rounded-xl text-center transition-all group"
            >
              <div className="text-[11px] font-bold text-blue-400 group-hover:text-blue-300">Admin</div>
              <div className="text-[9px] text-slate-400">Headquarters</div>
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('finance')}
              className="p-2.5 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 rounded-xl text-center transition-all group"
            >
              <div className="text-[11px] font-bold text-emerald-400 group-hover:text-emerald-300">Finance</div>
              <div className="text-[9px] text-slate-400">Central Store</div>
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('ahmed_kar')}
              className="p-2.5 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 rounded-xl text-center transition-all group"
            >
              <div className="text-[11px] font-bold text-amber-400 group-hover:text-amber-300">Shop User</div>
              <div className="text-[9px] text-slate-400">Karamardha</div>
            </button>
          </div>
          <div className="mt-2 text-center">
            <p className="text-[10px] text-slate-500">
              Default password: <span className="text-slate-300 font-mono">Password@123</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
