'use client';

/**
 * @file Sales Orders List Page
 * @route /dashboard/sales-orders
 * @spec Doc/project.md §5.2, Doc/phase.md Phase 9, Doc/strict.md
 *
 * The mirror of the Purchase Orders list. Lifecycle:
 * draft → confirmed → invoiced → cancelled.
 *
 * strict.md: every colour comes from transactions.css / forms.css, which use
 * var(--*) only; every string comes from useTranslations.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, RefreshCw, FileText } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { salesOrdersService } from '@/services/sales.service';
import { formatMoney, formatDate } from '@/utils/format';
import { Pagination, StatusPill, EmptyState, ErrorState } from '@/components/shared';

export default function SalesOrdersPage() {
  const t = useTranslations('salesOrders');
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();

  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchOrders = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await salesOrdersService.list({
        page,
        limit: 10,
        status: statusFilter || undefined,
      });
      setOrders(res.items || []);
      setPagination(res.meta || { page: 1, limit: 10, total: 0, totalPages: 1 });
    } catch (err) {
      setError(err.message || tc('states.errorBody'));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, tc]);

  useEffect(() => {
    fetchOrders(1);
  }, [fetchOrders]);

  // Filtered in the browser because the list endpoint has no free-text search
  // for documents; the page size is bounded at 10, so this stays honest.
  const visible = searchQuery
    ? orders.filter((o) =>
        [o.so_number, o.customer_name].some((f) =>
          String(f || '').toLowerCase().includes(searchQuery.toLowerCase())))
    : orders;

  const isFiltered = Boolean(searchQuery || statusFilter);

  return (
    <div className="doc-page">
      <div className="doc-page-head">
        <div>
          <h1 className="doc-page-title">
            <FileText size={19} className="doc-icon-accent" aria-hidden="true" />
            {t('title')}
          </h1>
          <p className="doc-page-sub">{t('subtitle')}</p>
        </div>

        <Link href="/dashboard/sales-orders/new" className="doc-btn doc-btn-primary">
          <Plus size={15} aria-hidden="true" />
          {t('newAction')}
        </Link>
      </div>

      <div className="doc-filters">
        <div className="doc-filter-grow filter-search-wrap">
          <Search size={15} className="filter-search-icon" aria-hidden="true" />
          <input
            type="search"
            className="filter-search-input"
            placeholder={t('searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <select
          className="form-select"
          aria-label={tc('allStatuses')}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">{tc('allStatuses')}</option>
          <option value="draft">{tc('status.draft')}</option>
          <option value="confirmed">{tc('status.confirmed')}</option>
          <option value="invoiced">{tc('status.invoiced')}</option>
          <option value="cancelled">{tc('status.cancelled')}</option>
        </select>

        <button
          type="button"
          onClick={() => fetchOrders(pagination.page)}
          className="doc-btn doc-btn-icon"
          aria-label={tc('actions.refresh')}
        >
          <RefreshCw size={15} aria-hidden="true" />
        </button>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={() => fetchOrders(1)} />
      ) : !loading && visible.length === 0 ? (
        <EmptyState
          isFiltered={isFiltered}
          title={t('empty.title')}
          description={t('empty.body')}
          actionLabel={t('newAction')}
          onAction={() => router.push('/dashboard/sales-orders/new')}
          onClearFilters={() => {
            setSearchQuery('');
            setStatusFilter('');
          }}
        />
      ) : (
        <div className="doc-table-wrap">
          <table className="doc-table">
            <thead>
              <tr>
                <th>{t('table.number')}</th>
                <th>{t('table.date')}</th>
                <th>{t('table.customer')}</th>
                <th className="doc-th-right">{t('table.total')}</th>
                <th>{t('table.status')}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((order) => (
                <tr
                  key={order.id}
                  className="is-clickable"
                  onClick={() => router.push(`/dashboard/sales-orders/${order.id}`)}
                >
                  <td className="doc-cell-code">{order.so_number}</td>
                  <td className="doc-cell-muted">{formatDate(order.order_date, locale)}</td>
                  <td>{order.customer_name || '—'}</td>
                  <td className="doc-cell-money">{formatMoney(order.total_amount, locale)}</td>
                  <td><StatusPill status={order.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={pagination.page}
        limit={pagination.limit}
        total={pagination.total}
        totalPages={pagination.totalPages}
        onPageChange={(p) => fetchOrders(p)}
      />
    </div>
  );
}
