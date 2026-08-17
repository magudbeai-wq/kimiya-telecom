'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  ArrowLeftRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Smartphone,
  CreditCard,
  Building2,
  Clock,
  Send,
  RotateCcw,
  ShieldAlert,
  FileText,
} from 'lucide-react';
import { RejectionReasonCode } from '@/lib/types';

export default function TransfersPage() {
  const { user, refreshNotifications } = useAuth();
  const [activeTab, setActiveTab] = useState<'pending' | 'history' | 'dispatch' | 'reviews'>('pending');

  const [transfers, setTransfers] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [denominations, setDenominations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Sub-filter for pending tab: SIM vs Scratch Card
  const [pendingProductFilter, setPendingProductFilter] = useState<'ALL' | 'SIM' | 'SCRATCH_CARD'>('ALL');

  // Dispatch form state
  const [dispatchType, setDispatchType] = useState<'SIM' | 'SCRATCH_CARD'>('SIM');
  const [dispatchBranchId, setDispatchBranchId] = useState('');
  const [dispatchDenomId, setDispatchDenomId] = useState('');
  const [dispatchQty, setDispatchQty] = useState('');
  const [dispatchNotes, setDispatchNotes] = useState('');

  // Rejection modal state
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedTransferForReject, setSelectedTransferForReject] = useState<any>(null);
  const [rejectReasonCode, setRejectReasonCode] = useState<RejectionReasonCode>('WRONG_QUANTITY');
  const [rejectReasonText, setRejectReasonText] = useState('');

  // Finance Review modal state
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedTransferForReview, setSelectedTransferForReview] = useState<any>(null);
  const [reviewAction, setReviewAction] = useState<'RESOLVE' | 'CANCEL' | 'RESEND'>('RESEND');
  const [correctedQty, setCorrectedQty] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchTransfers = async () => {
    try {
      setLoading(true);
      const [trRes, brRes, dnRes] = await Promise.all([
        fetch('/api/transfers?limit=100'),
        fetch('/api/branches'),
        fetch('/api/inventory/denominations'),
      ]);

      if (trRes.ok) {
        const json = await trRes.json();
        setTransfers(json.transfers || []);
      }
      if (brRes.ok) {
        const json = await brRes.json();
        setBranches(json.branches || []);
        if (json.branches.length > 0 && !dispatchBranchId) {
          setDispatchBranchId(json.branches[0].id);
        }
      }
      if (dnRes.ok) {
        const json = await dnRes.json();
        setDenominations(json.denominations || []);
        if (json.denominations.length > 0 && !dispatchDenomId) {
          setDispatchDenomId(json.denominations[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransfers();
  }, [user]);

  // Handle Approve Transfer
  const handleApprove = async (transferId: string) => {
    try {
      setMessage(null);
      const res = await fetch(`/api/transfers/${transferId}/approve`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: data.message });
        await fetchTransfers();
        await refreshNotifications();
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  // Open Rejection Modal
  const openRejectModal = (transfer: any) => {
    setSelectedTransferForReject(transfer);
    setRejectReasonCode('WRONG_QUANTITY');
    setRejectReasonText('');
    setRejectModalOpen(true);
  };

  // Submit Rejection
  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTransferForReject) return;
    try {
      setMessage(null);
      const res = await fetch(`/api/transfers/${selectedTransferForReject.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reasonCode: rejectReasonCode,
          reasonText: rejectReasonText,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: data.message });
        setRejectModalOpen(false);
        await fetchTransfers();
        await refreshNotifications();
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  // Handle Dispatch Transfer (Finance)
  const handleDispatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setMessage(null);
      const res = await fetch('/api/transfers/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productType: dispatchType,
          destinationBranchId: dispatchBranchId,
          denominationId: dispatchType === 'SCRATCH_CARD' ? dispatchDenomId : null,
          quantity: parseInt(dispatchQty),
          notes: dispatchNotes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: `Transfer #${data.transfer.id} successfully sent to branch.` });
        setDispatchQty('');
        setDispatchNotes('');
        setActiveTab('history');
        await fetchTransfers();
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  // Open Finance Review Modal
  const openReviewModal = (transfer: any) => {
    setSelectedTransferForReview(transfer);
    setReviewAction('RESEND');
    setCorrectedQty(String(transfer.quantity));
    setReviewNotes('');
    setReviewModalOpen(true);
  };

  // Submit Finance Review
  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTransferForReview) return;
    try {
      setMessage(null);
      const res = await fetch(`/api/transfers/${selectedTransferForReview.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: reviewAction,
          correctedQuantity: reviewAction === 'RESEND' ? parseInt(correctedQty) : undefined,
          notes: reviewNotes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: data.message });
        setReviewModalOpen(false);
        await fetchTransfers();
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  // Filter transfers
  const pendingTransfers = transfers.filter(
    (t) =>
      t.status === 'SENT' &&
      (pendingProductFilter === 'ALL' || t.product_type === pendingProductFilter)
  );

  const rejectedTransfers = transfers.filter(
    (t) => t.status === 'REJECTED' && (!t.finance_review_status || t.finance_review_status === 'PENDING')
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300">
              <ArrowLeftRight className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Stock Transfers Hub</h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Central Store to Branch stock transfers with mandatory branch review and approval lifecycle.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex flex-wrap gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'pending'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>Pending Approvals</span>
            {pendingTransfers.length > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                {pendingTransfers.length}
              </span>
            )}
          </button>

          {user?.role !== 'SHOP_USER' && (
            <button
              onClick={() => setActiveTab('dispatch')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'dispatch'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Send className="h-3.5 w-3.5" />
              <span>Dispatch Transfer</span>
            </button>
          )}

          {user?.role !== 'SHOP_USER' && (
            <button
              onClick={() => setActiveTab('reviews')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'reviews'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              <span>Review Required</span>
              {rejectedTransfers.length > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-700 px-1 text-[9px] font-bold text-white">
                  {rejectedTransfers.length}
                </span>
              )}
            </button>
          )}

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'history'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>All Transfers History</span>
          </button>
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
            <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
          )}
          <p className="font-semibold">{message.text}</p>
        </div>
      )}

      {/* TAB 1: PENDING APPROVALS */}
      {activeTab === 'pending' && (
        <div className="space-y-4">
          {/* Subfilter SIM vs Scratch */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Shipments Awaiting Branch Review
            </h3>

            <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
              <button
                onClick={() => setPendingProductFilter('ALL')}
                className={`px-3 py-1 rounded-lg ${pendingProductFilter === 'ALL' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-sm' : 'text-slate-500'}`}
              >
                All Products
              </button>
              <button
                onClick={() => setPendingProductFilter('SIM')}
                className={`px-3 py-1 rounded-lg ${pendingProductFilter === 'SIM' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-sm' : 'text-slate-500'}`}
              >
                SIM Approvals
              </button>
              <button
                onClick={() => setPendingProductFilter('SCRATCH_CARD')}
                className={`px-3 py-1 rounded-lg ${pendingProductFilter === 'SCRATCH_CARD' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-sm' : 'text-slate-500'}`}
              >
                Scratch Approvals
              </button>
            </div>
          </div>

          {pendingTransfers.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2 opacity-60" />
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Pending Approvals</h4>
              <p className="text-xs text-slate-400 mt-1">All incoming shipments have been reviewed and processed.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingTransfers.map((t) => (
                <div
                  key={t.id}
                  className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[11px] font-bold font-mono">
                        #{t.id}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-[10px] font-bold">
                        PENDING APPROVAL
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div
                        className={`p-3 rounded-xl ${
                          t.product_type === 'SIM'
                            ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300'
                            : 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-300'
                        }`}
                      >
                        {t.product_type === 'SIM' ? <Smartphone className="h-6 w-6" /> : <CreditCard className="h-6 w-6" />}
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-900 dark:text-white">
                          {t.quantity?.toLocaleString()}{' '}
                          {t.product_type === 'SIM' ? 'SIM Cards' : `${t.denomination_value} ETB Scratch Cards`}
                        </h4>
                        <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <Building2 className="h-3.5 w-3.5 text-slate-400" />
                          Destination: <span className="font-bold text-slate-700 dark:text-slate-300">{t.destination_branch_name}</span>
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 space-y-1">
                      <p>Dispatched by: <span className="text-slate-800 dark:text-slate-200 font-semibold">{t.sent_by_user_name}</span></p>
                      <p>Sent at: <span className="text-slate-800 dark:text-slate-200 font-semibold">{t.sent_at}</span></p>
                      {t.notes && <p className="italic text-slate-400">Notes: "{t.notes}"</p>}
                    </div>
                  </div>

                  {/* Approve / Reject Actions */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button
                      onClick={() => handleApprove(t.id)}
                      className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition-colors flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Approve All ({t.quantity})
                    </button>
                    <button
                      onClick={() => openRejectModal(t)}
                      className="py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow transition-colors flex items-center justify-center gap-1.5"
                    >
                      <XCircle className="h-4 w-4" />
                      Reject All
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DISPATCH TRANSFER (FINANCE/ADMIN) */}
      {activeTab === 'dispatch' && user?.role !== 'SHOP_USER' && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm max-w-2xl mx-auto">
          <h3 className="text-base font-black text-slate-900 dark:text-white mb-1">Create Stock Transfer</h3>
          <p className="text-xs text-slate-500 mb-6">Send stock from Central Store to a specific branch.</p>

          <form onSubmit={handleDispatchSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">Product System</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setDispatchType('SIM')}
                  className={`p-3 rounded-xl border text-center font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                    dispatchType === 'SIM'
                      ? 'bg-blue-600 text-white border-blue-600 shadow'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <Smartphone className="h-4 w-4" />
                  SIM Cards
                </button>
                <button
                  type="button"
                  onClick={() => setDispatchType('SCRATCH_CARD')}
                  className={`p-3 rounded-xl border text-center font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                    dispatchType === 'SCRATCH_CARD'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <CreditCard className="h-4 w-4" />
                  Scratch Cards
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Destination Branch</label>
              <select
                value={dispatchBranchId}
                onChange={(e) => setDispatchBranchId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-semibold focus:outline-none focus:border-blue-500"
                required
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name} ({b.code}) - {b.location}</option>
                ))}
              </select>
            </div>

            {dispatchType === 'SCRATCH_CARD' && (
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Scratch Denomination</label>
                <select
                  value={dispatchDenomId}
                  onChange={(e) => setDispatchDenomId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-semibold focus:outline-none focus:border-blue-500"
                  required
                >
                  {denominations.map((d) => (
                    <option key={d.id} value={d.id}>{d.denomination_value} ETB Scratch Card</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Transfer Quantity</label>
              <input
                type="number"
                min="1"
                value={dispatchQty}
                onChange={(e) => setDispatchQty(e.target.value)}
                placeholder="e.g. 500"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-semibold focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Delivery Reference Notes</label>
              <textarea
                value={dispatchNotes}
                onChange={(e) => setDispatchNotes(e.target.value)}
                rows={2}
                placeholder="Optional transfer description"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500"
              ></textarea>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md transition-colors"
            >
              Dispatch Shipment to Branch
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: REVIEW REQUIRED (REJECTED TRANSFERS QUEUE) */}
      {activeTab === 'reviews' && user?.role !== 'SHOP_USER' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Shipments Rejected by Branches (Finance Review Queue)
            </h3>
          </div>

          {rejectedTransfers.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2 opacity-60" />
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Rejected Transfers</h4>
              <p className="text-xs text-slate-400 mt-1">There are no pending rejected shipments requiring review.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rejectedTransfers.map((t) => (
                <div
                  key={t.id}
                  className="p-5 rounded-2xl bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/60 shadow-sm space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-rose-700 dark:text-rose-300">#{t.id}</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-[10px] font-bold">
                      REJECTED
                    </span>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      {t.destination_branch_name} rejected {t.quantity} {t.product_type}s
                      {t.denomination_value ? ` (${t.denomination_value} ETB)` : ''}
                    </h4>
                    <div className="mt-2 p-3 bg-white dark:bg-slate-900 rounded-xl border border-rose-200 dark:border-rose-900 text-xs">
                      <p className="font-bold text-rose-600 dark:text-rose-400">
                        Reason: {t.rejection_reason_code?.replace(/_/g, ' ')}
                      </p>
                      {t.rejection_reason_text && (
                        <p className="text-slate-600 dark:text-slate-400 mt-0.5 italic">"{t.rejection_reason_text}"</p>
                      )}
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-500">
                    <p>Reviewed by: {t.reviewed_by_user_name} on {t.reviewed_at}</p>
                  </div>

                  <button
                    onClick={() => openReviewModal(t)}
                    className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow transition-colors flex items-center justify-center gap-1.5"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Review & Take Action (Resend / Cancel)
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: ALL TRANSFERS HISTORY */}
      {activeTab === 'history' && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Stock Transfers Complete Audit History</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold uppercase border-y border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Transfer ID</th>
                  <th className="py-2.5 px-3">Product</th>
                  <th className="py-2.5 px-3">Denom</th>
                  <th className="py-2.5 px-3">Destination</th>
                  <th className="py-2.5 px-3">Quantity</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Sent By</th>
                  <th className="py-2.5 px-3">Sent At</th>
                  <th className="py-2.5 px-3">Reviewed By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {transfers.map((t) => (
                  <tr key={t.id}>
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">{t.id}</td>
                    <td className="py-2.5 px-3 font-bold">{t.product_type}</td>
                    <td className="py-2.5 px-3">{t.denomination_value ? `${t.denomination_value} ETB` : '-'}</td>
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
                    <td className="py-2.5 px-3">{t.sent_by_user_name}</td>
                    <td className="py-2.5 px-3">{t.sent_at?.substring(0, 16)}</td>
                    <td className="py-2.5 px-3">{t.reviewed_by_user_name || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REJECTION MODAL */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-900 text-rose-600 dark:text-rose-300">
                <XCircle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-black text-sm text-slate-900 dark:text-white">
                  Reject Shipment #{selectedTransferForReject?.id}
                </h3>
                <p className="text-xs text-slate-500">
                  Rejecting will NOT increase branch stock. Finance will be notified for review.
                </p>
              </div>
            </div>

            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Mandatory Rejection Reason
                </label>
                <select
                  value={rejectReasonCode}
                  onChange={(e) => setRejectReasonCode(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-semibold focus:outline-none focus:border-rose-500"
                  required
                >
                  <option value="WRONG_QUANTITY">Wrong Quantity Received</option>
                  <option value="WRONG_DENOMINATION">Wrong Denomination</option>
                  <option value="WRONG_PRODUCT">Wrong Product Type</option>
                  <option value="ITEMS_NOT_RECEIVED">Items Not Physically Received</option>
                  <option value="DAMAGED_STOCK">Damaged / Defective Stock</option>
                  <option value="OTHER">Other Reason (Specify below)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Explanation / Remarks {rejectReasonCode === 'OTHER' && <span className="text-rose-500">*</span>}
                </label>
                <textarea
                  value={rejectReasonText}
                  onChange={(e) => setRejectReasonText(e.target.value)}
                  rows={3}
                  placeholder="Provide explicit details regarding the rejection..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-rose-500"
                  required={rejectReasonCode === 'OTHER'}
                ></textarea>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow transition-colors"
                >
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FINANCE REVIEW MODAL */}
      {reviewModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300">
                <RotateCcw className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-black text-sm text-slate-900 dark:text-white">
                  Finance Review: Transfer #{selectedTransferForReview?.id}
                </h3>
                <p className="text-xs text-slate-500">Correct shipment, resend, or cancel.</p>
              </div>
            </div>

            <form onSubmit={handleReviewSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Resolution Action</label>
                <select
                  value={reviewAction}
                  onChange={(e) => setReviewAction(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-semibold focus:outline-none focus:border-blue-500"
                  required
                >
                  <option value="RESEND">Resend Corrected Shipment (Generates new transfer linked to this ID)</option>
                  <option value="CANCEL">Cancel Transfer Discrepancy</option>
                  <option value="RESOLVE">Mark Resolved Without Resend</option>
                </select>
              </div>

              {reviewAction === 'RESEND' && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Corrected Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={correctedQty}
                    onChange={(e) => setCorrectedQty(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Finance Review Notes</label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={3}
                  placeholder="Notes regarding this review decision..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500"
                ></textarea>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReviewModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow transition-colors"
                >
                  Execute Review Action
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
