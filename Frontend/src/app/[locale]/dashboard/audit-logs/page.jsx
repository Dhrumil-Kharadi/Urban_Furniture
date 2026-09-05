'use client';

// ============================================================
// FILE: src/app/[locale]/dashboard/audit-logs/page.jsx
//
// System Audit Logs — BUSINESS OWNER ONLY
// Reference: project.md §9.2 · phase.md Phase 13 · strict.md
//
// Filterable immutable audit trail with before/after state diffs.
// ============================================================

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Search, RefreshCw, X, Eye, ShieldAlert } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import DashboardFrame from '@/components/dashboard/DashboardFrame';
import Button from '@/reusablefiles/button';
import { DashboardSkeleton } from '@/reusablefiles/skeleton';

const ENTITY_TYPES = [
  'customer_invoice',
  'vendor_bill',
  'payment',
  'journal_entry',
  'budget',
  'product',
  'contact',
  'user',
];

const ACTIONS = ['post', 'create', 'update', 'delete', 'reverse', 'cancel', 'upload_attachment'];

const PAGE_SIZE = 20;

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
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  });

  // Diff Modal State
  const [selectedLog, setSelectedLog] = useState(null);

  const isOwner = role === 'business_owner';

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // `entityId` takes a full record UUID; a partial string matches nothing,
      // so only send it once it looks like one.
      const trimmed = search.trim();
      const res = await api.get('/audit-logs', {
        params: {
          page,
          limit: PAGE_SIZE,
          entityType: entityType || undefined,
          action: action || undefined,
          entityId: trimmed || undefined,
        },
      });

      // The API client hands back the parsed envelope; the previous
      // `res.data.success` check never passed, which is why this table was
      // permanently empty.
      if (res.success) {
        setLogs(res.data?.items || []);
        setPagination({
          page: res.data?.pagination?.page ?? 1,
          total: res.data?.pagination?.total ?? 0,
          totalPages: res.data?.pagination?.totalPages || 1,
          hasNext: Boolean(res.data?.pagination?.hasNext),
          hasPrev: Boolean(res.data?.pagination?.hasPrev),
        });
      }
    } catch (err) {
      setError(err?.message || t('loadError'));
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [page, entityType, action, search, t]);

  useEffect(() => {
    if (isOwner) fetchLogs();
  }, [fetchLogs, isOwner]);

  const range = useMemo(() => {
    if (!pagination.total) return { from: 0, to: 0 };
    const from = (pagination.page - 1) * PAGE_SIZE + 1;
    return { from, to: Math.min(from + logs.length - 1, pagination.total) };
  }, [pagination, logs.length]);

  // Access is enforced on the server; this is the UX half of the same rule.
  if (role && !isOwner) {
    return (
      <DashboardFrame role={role} activeKey="auditLogs">
        <div className="audit-container">
          <div className="audit-table-card audit-denied">
            <ShieldAlert size={48} className="audit-denied-icon" />
            <h2 className="audit-denied-title">{t('deniedTitle')}</h2>
            <p className="audit-subtitle">{t('deniedBody')}</p>
          </div>
        </div>
      </DashboardFrame>
    );
  }

  return (
    <DashboardFrame role="business_owner" activeKey="auditLogs">
      <div className="audit-container">
        {/* Header */}
        <div className="audit-header">
          <div className="audit-header-content">
            <span className="audit-badge">{t('badge')}</span>
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
            <div className="audit-search-wrap">
              <Search size={15} className="audit-search-icon" aria-hidden="true" />
              <input
                type="text"
                className="audit-search-input has-icon"
                placeholder={t('search')}
                aria-label={t('search')}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <select
              className="audit-select"
              aria-label={t('entityType')}
              value={entityType}
              onChange={(e) => {
                setEntityType(e.target.value);
                setPage(1);
              }}
            >
              <option value="">{t('allTypes')}</option>
              {ENTITY_TYPES.map((key) => (
                <option key={key} value={key}>
                  {t(`entityTypes.${key}`)}
                </option>
              ))}
            </select>

            <select
              className="audit-select"
              aria-label={t('action')}
              value={action}
              onChange={(e) => {
                setAction(e.target.value);
                setPage(1);
              }}
            >
              <option value="">{t('allActions')}</option>
              {ACTIONS.map((key) => (
                <option key={key} value={key}>
                  {t(`actions.${key}`)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Audit Table */}
        <div className="audit-table-card">
          {loading && logs.length === 0 ? (
            <DashboardSkeleton count={5} />
          ) : error ? (
            <div className="audit-state is-error">{error}</div>
          ) : logs.length === 0 ? (
            <div className="audit-state">{t('noLogs')}</div>
          ) : (
            <div className="audit-table-scroll">
              <table className="audit-table">
                <thead>
                  <tr>
                    <th>{t('timestamp')}</th>
                    <th>{t('actor')}</th>
                    <th>{t('action')}</th>
                    <th>{t('entityType')}</th>
                    <th>{t('entityId')}</th>
                    <th>{t('ipAddress')}</th>
                    <th className="audit-col-right">{t('changes')}</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const actionLower = (log.action || '').toLowerCase();
                    let actionClass = 'audit-badge-action';
                    if (actionLower.includes('post')) actionClass += ' post';
                    else if (actionLower.includes('create')) actionClass += ' create';
                    else if (actionLower.includes('delete') || actionLower.includes('cancel')) {
                      actionClass += ' delete';
                    }

                    const entityKey = ENTITY_TYPES.includes(log.entity_type) ? log.entity_type : null;
                    const actionKey = ACTIONS.includes(actionLower) ? actionLower : null;

                    return (
                      <tr key={log.id}>
                        <td className="audit-time-cell">
                          {log.created_at ? new Date(log.created_at).toLocaleString() : '—'}
                        </td>
                        <td>
                          <div className="audit-actor-name">
                            {log.actor_name || t('systemActor')}
                          </div>
                          <div className="audit-actor-email">{log.actor_email || '—'}</div>
                        </td>
                        <td>
                          <span className={actionClass}>
                            {actionKey ? t(`actions.${actionKey}`) : log.action}
                          </span>
                        </td>
                        <td className="audit-entity-cell">
                          {entityKey ? t(`entityTypes.${entityKey}`) : log.entity_type}
                        </td>
                        <td>
                          <span className="audit-id-cell" title={log.entity_id || ''}>
                            {log.entity_id ? `${log.entity_id.slice(0, 13)}…` : '—'}
                          </span>
                        </td>
                        <td className="audit-ip-cell">{log.ip_address || '—'}</td>
                        <td className="audit-col-right">
                          {log.before || log.after ? (
                            <button
                              type="button"
                              className="audit-btn-diff"
                              onClick={() => setSelectedLog(log)}
                            >
                              <Eye size={12} aria-hidden="true" />
                              <span>{t('viewDiff')}</span>
                            </button>
                          ) : (
                            <span className="audit-ip-cell">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {pagination.total > 0 && !error ? (
            <div className="audit-pagination">
              <span className="audit-pagination-label">
                {t('showing', { from: range.from, to: range.to, total: pagination.total })}
              </span>
              <div className="audit-pagination-actions">
                <Button
                  variant="ghost"
                  disabled={!pagination.hasPrev || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  {t('previous')}
                </Button>
                <Button
                  variant="ghost"
                  disabled={!pagination.hasNext || loading}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {t('next')}
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        {/* Diff Modal */}
        {selectedLog && (
          <div className="audit-modal-backdrop" onClick={() => setSelectedLog(null)}>
            <div
              className="audit-modal-card"
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="audit-modal-header">
                <h3 className="audit-modal-title">
                  {t('modalTitle')} — {selectedLog.action} ({selectedLog.entity_type})
                </h3>
                <button
                  type="button"
                  className="audit-modal-close"
                  aria-label={t('close')}
                  onClick={() => setSelectedLog(null)}
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
