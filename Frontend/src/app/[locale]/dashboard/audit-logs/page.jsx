'use client';

// ============================================================
// FILE: src/app/[locale]/dashboard/audit-logs/page.jsx
//
// System Audit Logs — ADMIN ONLY
// Reference: project.md §9.2 · phase.md Phase 13 · strict.md
//
// Filterable immutable audit trail with before/after state diffs.
// ============================================================

import React, { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Search, RefreshCw, X, Eye, ShieldAlert } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import DashboardFrame from '@/components/dashboard/DashboardFrame';
import Button from '@/reusablefiles/button';
import { DashboardSkeleton } from '@/reusablefiles/skeleton';

export default function AuditLogsPage() {
  const t = useTranslations('audit');
  const tCommon = useTranslations('dashboard.common');
  const { role } = useAuth();

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });

  // Diff Modal State
  const [selectedLog, setSelectedLog] = useState(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit: 20 };
      if (entityType) params.entityType = entityType;
      if (action) params.action = action;
      if (search.trim()) params.entityId = search.trim();

      const res = await api.get('/audit-logs', { params });
      if (res.data?.success) {
        setLogs(res.data.data.items || []);
        setPagination({
          page: res.data.data.page,
          total: res.data.data.total,
          totalPages: res.data.data.totalPages || 1,
        });
      }
    } catch (err) {
      setError(err?.response?.data?.error?.message || err?.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [page, entityType, action, search]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Admin access check
  if (role && role !== 'business_owner') {
    return (
      <DashboardFrame>
        <div className="audit-container">
          <div className="audit-table-card" style={{ textAlign: 'center', padding: '3rem' }}>
            <ShieldAlert size={48} style={{ color: 'var(--accent-primary)', margin: '0 auto 1rem' }} />
            <h2 className="audit-title" style={{ fontSize: '1.4rem' }}>Access Denied</h2>
            <p className="audit-subtitle" style={{ margin: '0.5rem auto' }}>
              System audit logs are strictly restricted to Business Owners and Administrators.
            </p>
          </div>
        </div>
      </DashboardFrame>
    );
  }

  return (
    <DashboardFrame>
      <div className="audit-container">
        {/* Header */}
        <div className="audit-header">
          <div className="audit-header-content">
            <span className="audit-badge">Compliance & Security</span>
            <h1 className="audit-title">{t('title')}</h1>
            <p className="audit-subtitle">{t('subtitle')}</p>
          </div>
          <Button
            variant="ghost"
            onClick={fetchLogs}
            disabled={loading}
            icon={<RefreshCw size={14} className={loading ? 'ui-spin' : ''} />}
          >
            {tCommon('refresh')}
          </Button>
        </div>

        {/* Controls and Filters */}
        <div className="audit-controls-card">
          <div className="audit-filters-group">
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={15} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="audit-search-input"
                style={{ paddingLeft: '32px' }}
                placeholder={t('search')}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <select
              className="audit-select"
              value={entityType}
              onChange={(e) => {
                setEntityType(e.target.value);
                setPage(1);
              }}
            >
              <option value="">{t('allTypes')}</option>
              <option value="customer_invoice">Customer Invoice</option>
              <option value="vendor_bill">Vendor Bill</option>
              <option value="payment">Payment</option>
              <option value="journal_entry">Journal Entry</option>
              <option value="budget">Budget</option>
              <option value="product">Product</option>
              <option value="contact">Contact</option>
            </select>

            <select
              className="audit-select"
              value={action}
              onChange={(e) => {
                setAction(e.target.value);
                setPage(1);
              }}
            >
              <option value="">{t('allActions')}</option>
              <option value="post">Post (Commit to Ledger)</option>
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="delete">Delete</option>
              <option value="reverse">Reverse</option>
              <option value="cancel">Cancel</option>
              <option value="upload_attachment">Upload Attachment</option>
            </select>
          </div>
        </div>

        {/* Audit Table */}
        <div className="audit-table-card">
          {loading && logs.length === 0 ? (
            <DashboardSkeleton count={5} />
          ) : error ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>{error}</div>
          ) : logs.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              {t('noLogs')}
            </div>
          ) : (
            <table className="audit-table">
              <thead>
                <tr>
                  <th>{t('timestamp')}</th>
                  <th>{t('actor')}</th>
                  <th>{t('action')}</th>
                  <th>{t('entityType')}</th>
                  <th>{t('entityId')}</th>
                  <th>{t('ipAddress')}</th>
                  <th style={{ textAlign: 'right' }}>{t('changes')}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const actionLower = (log.action || '').toLowerCase();
                  let actionClass = 'audit-badge-action';
                  if (actionLower.includes('post')) actionClass += ' post';
                  else if (actionLower.includes('create')) actionClass += ' create';
                  else if (actionLower.includes('delete') || actionLower.includes('cancel')) actionClass += ' delete';

                  return (
                    <tr key={log.id}>
                      <td className="audit-time-cell">
                        {log.created_at ? new Date(log.created_at).toLocaleString() : '—'}
                      </td>
                      <td>
                        <div className="audit-actor-name">{log.actor_name || 'System / Batch'}</div>
                        <div className="audit-actor-email">{log.actor_email || '—'}</div>
                      </td>
                      <td>
                        <span className={actionClass}>{log.action}</span>
                      </td>
                      <td>
                        <code style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {log.entity_type}
                        </code>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {log.entity_id ? log.entity_id.slice(0, 13) + '…' : '—'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {log.ip_address || '—'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {(log.before || log.after) ? (
                          <button
                            type="button"
                            className="audit-btn-diff"
                            onClick={() => setSelectedLog(log)}
                          >
                            <Eye size={12} style={{ marginRight: '4px', verticalAlign: '-1px' }} />
                            {t('viewDiff')}
                          </button>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Diff Modal */}
        {selectedLog && (
          <div className="audit-modal-backdrop" onClick={() => setSelectedLog(null)}>
            <div className="audit-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="audit-modal-header">
                <h3 className="audit-modal-title">
                  {t('modalTitle')} — {selectedLog.action} ({selectedLog.entity_type})
                </h3>
                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="audit-modal-body">
                <div className="audit-diff-pane">
                  <h4 className="audit-diff-title before">{t('before')}</h4>
                  <pre className="audit-diff-pre">
                    {selectedLog.before
                      ? JSON.stringify(selectedLog.before, null, 2)
                      : t('noChanges')}
                  </pre>
                </div>

                <div className="audit-diff-pane">
                  <h4 className="audit-diff-title after">{t('after')}</h4>
                  <pre className="audit-diff-pre">
                    {selectedLog.after
                      ? JSON.stringify(selectedLog.after, null, 2)
                      : t('noChanges')}
                  </pre>
                </div>
              </div>

              <div className="audit-modal-footer">
                <Button variant="ghost" onClick={() => setSelectedLog(null)}>
                  {t('close')}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardFrame>
  );
}
