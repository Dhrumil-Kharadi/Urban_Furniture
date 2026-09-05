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
 *
 * Styled strictly with Frozen Lake tokens and transactions.css classes.
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
    <div className="doc-status-bar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {backUrl && (
          <Link
            href={backUrl}
            className="doc-btn doc-btn-icon"
            title="Back to list"
          >
            <ArrowLeft size={16} />
          </Link>
        )}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h1 className="doc-page-title" style={{ fontSize: '1rem', margin: 0 }}>{title}</h1>
            {docNumber && (
              <span className="doc-cell-code" style={{ padding: '0.2rem 0.5rem', background: 'var(--bg-surface)', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                {docNumber}
              </span>
            )}
          </div>
          <p className="doc-page-sub" style={{ margin: '0.15rem 0 0' }}>
            Current status: <strong style={{ color: 'var(--text-primary)', textTransform: 'capitalize' }}>{status}</strong>
          </p>
        </div>
      </div>

      {/* Pipeline Status Stages */}
      <div className="doc-status-stages">
        {isCancelled ? (
          <span className="doc-stage-badge" style={{ background: 'var(--status-error-bg)', color: 'var(--status-error)', border: '1px solid var(--status-error-border)' }}>
            <XCircle size={13} style={{ marginRight: '4px' }} />
            Cancelled
          </span>
        ) : (
          stages.map((stage, idx) => {
            const isActive = stage === status;
            const isCompleted = currentIdx > idx;

            return (
              <React.Fragment key={stage}>
                <div
                  className={`doc-stage-badge ${isActive ? 'active' : ''}`}
                  style={
                    isCompleted
                      ? {
                          background: 'rgba(16, 185, 129, 0.12)',
                          color: '#10b981',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }
                      : { display: 'inline-flex', alignItems: 'center', gap: '4px' }
                  }
                >
                  {isCompleted && <CheckCircle2 size={12} />}
                  {stage}
                </div>
                {idx < stages.length - 1 && (
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', userSelect: 'none' }}>→</span>
                )}
              </React.Fragment>
            );
          })
        )}
      </div>

      {/* Document Action Buttons */}
      <div className="doc-page-actions">
        {status === 'draft' && onConfirm && (
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="doc-btn doc-btn-primary"
          >
            <CheckCircle2 size={14} />
            Confirm Order
          </button>
        )}

        {status === 'confirmed' && onCreateBill && (
          <button
            type="button"
            onClick={onCreateBill}
            disabled={loading}
            className="doc-btn doc-btn-primary"
          >
            <FileText size={14} />
            Create Vendor Bill
          </button>
        )}

        {status === 'draft' && onPost && (
          <button
            type="button"
            onClick={onPost}
            disabled={loading}
            className="doc-btn doc-btn-primary"
          >
            <Send size={14} />
            Post to Ledger
          </button>
        )}

        {status !== 'cancelled' && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="doc-btn"
          >
            <XCircle size={14} />
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
