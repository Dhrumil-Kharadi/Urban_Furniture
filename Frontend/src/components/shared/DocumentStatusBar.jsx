'use client';

import React from 'react';
import { ArrowLeft, CheckCircle2, FileText, Send, XCircle } from 'lucide-react';
import { Link } from '@/i18n/navigation';

/**
 * DocumentStatusBar Component
 *
 * Top workflow bar for transaction documents (PO, Bill, SO, Invoice):
 * - Back button to collection list
 * - Document identifier & status breadcrumbs
 * - Action buttons based on current state & permissions
 */
export default function DocumentStatusBar({
  title,
  docNumber,
  status = 'draft',
  stages = ['draft', 'confirmed', 'billed'],
  onConfirm,
  onCreateBill,
  onPost,
  onCancel,
  backUrl,
  loading = false,
  isCancelled = false,
}) {
  const currentIdx = stages.indexOf(status);

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-gray-700/60 bg-gray-900/70 shadow-md">
      <div className="flex items-center gap-3">
        {backUrl && (
          <Link
            href={backUrl}
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
            title="Back to list"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
        )}
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-gray-100">{title}</h1>
            {docNumber && (
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-gray-800 text-indigo-300 font-semibold">
                {docNumber}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 capitalize">Current status: <span className="font-medium text-gray-200">{status}</span></p>
        </div>
      </div>

      {/* Pipeline Status Stages */}
      <div className="flex items-center gap-1 self-stretch sm:self-auto overflow-x-auto py-1">
        {isCancelled ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-950/60 border border-red-800 text-red-300">
            <XCircle className="w-3.5 h-3.5" />
            Cancelled
          </span>
        ) : (
          stages.map((stage, idx) => {
            const isActive = stage === status;
            const isCompleted = currentIdx > idx;

            return (
              <React.Fragment key={stage}>
                <div
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium capitalize transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                      : isCompleted
                      ? 'bg-emerald-950/60 border border-emerald-700/60 text-emerald-300'
                      : 'bg-gray-800/60 text-gray-400 border border-gray-700/50'
                  }`}
                >
                  {isCompleted && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                  {stage}
                </div>
                {idx < stages.length - 1 && (
                  <span className="text-gray-600 text-xs select-none">→</span>
                )}
              </React.Fragment>
            );
          })
        )}
      </div>

      {/* Document Action Buttons */}
      <div className="flex items-center gap-2">
        {status === 'draft' && onConfirm && (
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition-colors shadow-sm"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Confirm Order
          </button>
        )}

        {status === 'confirmed' && onCreateBill && (
          <button
            type="button"
            onClick={onCreateBill}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 transition-colors shadow-sm"
          >
            <FileText className="w-3.5 h-3.5" />
            Create Vendor Bill
          </button>
        )}

        {status === 'draft' && onPost && (
          <button
            type="button"
            onClick={onPost}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 transition-colors shadow-sm"
          >
            <Send className="w-3.5 h-3.5" />
            Post Bill (To Ledger)
          </button>
        )}

        {status !== 'cancelled' && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-800/40 transition-colors"
          >
            <XCircle className="w-3.5 h-3.5" />
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
