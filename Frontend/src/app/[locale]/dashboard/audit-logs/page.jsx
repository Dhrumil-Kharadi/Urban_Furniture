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
import {
  Search,
  RefreshCw,
  X,
  Eye,
  ShieldAlert,
  ArrowRight,
  Copy,
  Check,
  Code2,
  TableProperties,
  ChevronDown,
  ChevronUp,
  FileText
} from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import DashboardFrame from '@/components/dashboard/DashboardFrame';
import Button from '@/reusablefiles/button';
import { DashboardSkeleton } from '@/reusablefiles/skeleton';
import '@/styles/auditlogs.css';

const ENTITY_TYPES = [
  'customer_invoice',
  'vendor_bill',
  'purchase_order',
  'sales_order',
  'payment',
  'journal_entry',
  'budget',
  'product',
  'product_category',
  'contact',
  'user',
  'tax',
  'journal',
  'account',
  'analytic_account',
];

const ACTIONS = [
  'create',
  'update',
  'delete',
  'post',
  'reverse',
  'cancel',
  'send',
  'confirm',
  'convert',
  'archive',
  'unarchive',
  'create_bill_from_po',
  'portal_access_enabled',
  'portal_access_disabled',
  'PORTAL_CARD_PAYMENT',
  'login',
  'logout',
  'upload_attachment',
];

const PAGE_SIZE = 20;

function formatValue(val) {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'object') return JSON.stringify(val);
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  return String(val);
}

function computeAuditDiff(before, after) {
  const b = before && typeof before === 'object' ? before : {};
  const a = after && typeof after === 'object' ? after : {};

  const allKeys = Array.from(new Set([...Object.keys(b), ...Object.keys(a)]));

  const changed = [];
  const unchanged = [];
  const added = [];
  const removed = [];

  for (const key of allKeys) {
    const hasBefore = key in b;
    const hasAfter = key in a;
    const valBefore = b[key];
    const valAfter = a[key];

    const strBefore = JSON.stringify(valBefore);
    const strAfter = JSON.stringify(valAfter);

    if (hasBefore && hasAfter) {
      if (strBefore !== strAfter) {
        changed.push({ key, before: valBefore, after: valAfter });
      } else {
        unchanged.push({ key, value: valAfter });
      }
    } else if (!hasBefore && hasAfter) {
      added.push({ key, after: valAfter });
    } else if (hasBefore && !hasAfter) {
      removed.push({ key, before: valBefore });
    }
  }

  return { changed, unchanged, added, removed };
}

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
  const [diffMode, setDiffMode] = useState('visual'); // 'visual' | 'raw'
  const [showUnchanged, setShowUnchanged] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  const getActionLabel = useCallback((act) => {
    if (!act) return '—';
    try {
      if (typeof t.has === 'function' && t.has(`actions.${act}`)) {
        return t(`actions.${act}`);
      }
    } catch {
      // safe fallback
    }
    return act.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }, [t]);

  const getEntityLabel = useCallback((entity) => {
    if (!entity) return '—';
    try {
      if (typeof t.has === 'function' && t.has(`entityTypes.${entity}`)) {
        return t(`entityTypes.${entity}`);
      }
    } catch {
      // safe fallback
    }
    return entity.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }, [t]);

  const isOwner = role === 'business_owner';

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
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

  const parsedDiff = useMemo(() => {
    if (!selectedLog) return null;
    return computeAuditDiff(selectedLog.before, selectedLog.after);
  }, [selectedLog]);

  const handleCopyJson = () => {
    if (!selectedLog) return;
    const payload = JSON.stringify(
      { before: selectedLog.before, after: selectedLog.after },
      null,
      2
    );
    navigator.clipboard.writeText(payload);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

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
              aria-label={t('entityType')}
            >
              <option value="">{t('allTypes')}</option>
              {ENTITY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {getEntityLabel(type)}
                </option>
              ))}
            </select>

            <select
              className="audit-select"
              value={action}
              onChange={(e) => {
                setAction(e.target.value);
                setPage(1);
              }}
              aria-label={t('action')}
            >
              <option value="">{t('allActions')}</option>
              {ACTIONS.map((act) => (
                <option key={act} value={act}>
                  {getActionLabel(act)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table Area */}
        <div className="audit-table-card">
          {loading ? (
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
                    const actionClass = log.action ? log.action.toLowerCase() : '';

                    return (
                      <tr key={log.id}>
                        <td className="audit-time-cell">
                          {log.created_at ? new Date(log.created_at).toLocaleString() : '—'}
                        </td>
                        <td>
                          <div className="audit-actor-name">{log.user_name || 'System'}</div>
                          <div className="audit-actor-email">{log.user_email || '—'}</div>
                        </td>
                        <td>
                          <span className={`audit-badge-action ${actionClass}`}>
                            {getActionLabel(log.action)}
                          </span>
                        </td>
                        <td className="audit-entity-cell">
                          {getEntityLabel(log.entity_type)}
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
                              onClick={() => {
                                setSelectedLog(log);
                                setDiffMode('visual');
                                setShowUnchanged(false);
                              }}
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

        {/* ── UPGRADED VISUAL DIFF MODAL ── */}
        {selectedLog && parsedDiff && (
          <div className="audit-modal-backdrop" onClick={() => setSelectedLog(null)}>
            <div
              className="audit-modal-card"
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="audit-modal-header">
                <div className="audit-modal-title-wrap">
                  <h3 className="audit-modal-title">
                    <FileText size={18} style={{ color: 'var(--accent-primary)' }} />
                    <span>Change Detail — {getActionLabel(selectedLog.action)} ({getEntityLabel(selectedLog.entity_type)})</span>
                  </h3>
                  <div className="audit-modal-meta">
                    <span>By: <strong>{selectedLog.user_name || selectedLog.user_email || 'System'}</strong></span>
                    <span>•</span>
                    <span>{selectedLog.created_at ? new Date(selectedLog.created_at).toLocaleString() : ''}</span>
                    <span>•</span>
                    <span>ID: {selectedLog.entity_id ? selectedLog.entity_id.slice(0, 16) + '…' : '—'}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="audit-modal-close"
                  aria-label={t('close')}
                  onClick={() => setSelectedLog(null)}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="audit-modal-body">
                {/* View Switcher Nav */}
                <div className="audit-diff-nav">
                  <div className="audit-diff-tabs">
                    <button
                      type="button"
                      className={`audit-diff-tab-btn${diffMode === 'visual' ? ' active' : ''}`}
                      onClick={() => setDiffMode('visual')}
                    >
                      <TableProperties size={14} />
                      <span>Visual Field Comparison</span>
                    </button>
                    <button
                      type="button"
                      className={`audit-diff-tab-btn${diffMode === 'raw' ? ' active' : ''}`}
                      onClick={() => setDiffMode('raw')}
                    >
                      <Code2 size={14} />
                      <span>Raw JSON</span>
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button
                      type="button"
                      className="audit-btn-diff"
                      onClick={handleCopyJson}
                    >
                      {copiedJson ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                      <span>{copiedJson ? 'Copied!' : 'Copy JSON'}</span>
                    </button>
                  </div>
                </div>

                {/* VISUAL FIELD-BY-FIELD COMPARISON */}
                {diffMode === 'visual' ? (
                  <div className="audit-visual-diff-wrap">
                    {parsedDiff.changed.length === 0 && parsedDiff.added.length === 0 && parsedDiff.removed.length === 0 ? (
                      <div className="audit-state" style={{ padding: '2rem' }}>
                        No attribute differences detected between before and after states.
                      </div>
                    ) : (
                      <table className="audit-diff-table">
                        <thead>
                          <tr>
                            <th className="audit-diff-table-th" style={{ width: '22%' }}>Field</th>
                            <th className="audit-diff-table-th" style={{ width: '35%' }}>Before Value</th>
                            <th className="audit-diff-table-th" style={{ width: '6%', textAlign: 'center' }}></th>
                            <th className="audit-diff-table-th" style={{ width: '37%' }}>After Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* Changed attributes */}
                          {parsedDiff.changed.map((item) => (
                            <tr key={item.key} className="audit-diff-row">
                              <td className="audit-diff-td">
                                <span className="audit-diff-field-name">{item.key}</span>
                              </td>
                              <td className="audit-diff-td">
                                <span className="audit-diff-val-before">
                                  {formatValue(item.before)}
                                </span>
                              </td>
                              <td className="audit-diff-td" style={{ textAlign: 'center' }}>
                                <ArrowRight size={14} style={{ color: 'var(--text-secondary)' }} />
                              </td>
                              <td className="audit-diff-td">
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                                  <span className="audit-diff-val-after">
                                    {formatValue(item.after)}
                                  </span>
                                  <span className="audit-diff-type-pill modified">Modified</span>
                                </div>
                              </td>
                            </tr>
                          ))}

                          {/* Added attributes */}
                          {parsedDiff.added.map((item) => (
                            <tr key={item.key} className="audit-diff-row">
                              <td className="audit-diff-td">
                                <span className="audit-diff-field-name">{item.key}</span>
                              </td>
                              <td className="audit-diff-td">
                                <span style={{ color: 'var(--text-muted)' }}>— (not set)</span>
                              </td>
                              <td className="audit-diff-td" style={{ textAlign: 'center' }}>
                                <ArrowRight size={14} style={{ color: 'var(--text-secondary)' }} />
                              </td>
                              <td className="audit-diff-td">
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                                  <span className="audit-diff-val-after">
                                    {formatValue(item.after)}
                                  </span>
                                  <span className="audit-diff-type-pill added">Added</span>
                                </div>
                              </td>
                            </tr>
                          ))}

                          {/* Removed attributes */}
                          {parsedDiff.removed.map((item) => (
                            <tr key={item.key} className="audit-diff-row">
                              <td className="audit-diff-td">
                                <span className="audit-diff-field-name">{item.key}</span>
                              </td>
                              <td className="audit-diff-td">
                                <span className="audit-diff-val-before">
                                  {formatValue(item.before)}
                                </span>
                              </td>
                              <td className="audit-diff-td" style={{ textAlign: 'center' }}>
                                <ArrowRight size={14} style={{ color: 'var(--text-secondary)' }} />
                              </td>
                              <td className="audit-diff-td">
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                                  <span style={{ color: 'var(--text-muted)' }}>— (removed)</span>
                                  <span className="audit-diff-type-pill removed">Removed</span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    {/* Collapsible Unchanged Attributes */}
                    {parsedDiff.unchanged.length > 0 && (
                      <div className="audit-diff-unchanged-section">
                        <button
                          type="button"
                          className="audit-diff-unchanged-header"
                          onClick={() => setShowUnchanged((prev) => !prev)}
                        >
                          <span>{parsedDiff.unchanged.length} unchanged attributes</span>
                          {showUnchanged ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        </button>

                        {showUnchanged && (
                          <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-raised)' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.65rem' }}>
                              {parsedDiff.unchanged.map((item) => (
                                <div key={item.key} style={{ fontSize: '0.76rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  <span style={{ fontFamily: 'Orbitron, monospace', color: 'var(--text-secondary)', fontSize: '0.68rem' }}>
                                    {item.key}:
                                  </span>
                                  <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                                    {formatValue(item.value)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  /* RAW JSON SIDE-BY-SIDE */
                  <div className="audit-diff-raw-grid">
                    <div className="audit-diff-pane">
                      <h4 className="audit-diff-title before">
                        <span>{t('before')}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Previous State</span>
                      </h4>
                      <pre className="audit-diff-pre">
                        {selectedLog.before
                          ? JSON.stringify(selectedLog.before, null, 2)
                          : t('noChanges')}
                      </pre>
                    </div>

                    <div className="audit-diff-pane">
                      <h4 className="audit-diff-title after">
                        <span>{t('after')}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Updated State</span>
                      </h4>
                      <pre className="audit-diff-pre">
                        {selectedLog.after
                          ? JSON.stringify(selectedLog.after, null, 2)
                          : t('noChanges')}
                      </pre>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="audit-modal-footer">
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontFamily: 'Sora, sans-serif' }}>
                  {parsedDiff.changed.length} modified • {parsedDiff.added.length} added • {parsedDiff.removed.length} removed
                </span>
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
