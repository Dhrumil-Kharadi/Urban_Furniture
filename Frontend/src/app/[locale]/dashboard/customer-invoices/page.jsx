'use client';

/**
 * @file Customer Invoices List
 * @route /dashboard/customer-invoices
 * @spec Doc/project.md §5.2, §5.2.6, Doc/phase.md Phase 9, Doc/strict.md
 *
 * OVERDUE is a computed field, not a stored status — technicalrequirement.md
 * §7.8. The badge and the filter come from the same server-side predicate, so
 * they cannot disagree.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, RefreshCw, Receipt, AlertTriangle } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { customerInvoicesService } from '@/services/sales.service';
import { formatMoney, formatDate } from '@/utils/format';
import { Pagination, StatusPill, EmptyState, ErrorState } from '@/components/shared';

export default function CustomerInvoicesPage() {
  const t = useTranslations('customerInvoices');
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();

  const [invoices, setInvoices] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchInvoices = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await customerInvoicesService.list({
        page,
        limit: 10,
        status: statusFilter || undefined,
        overdue: overdueOnly ? 'true' : undefined,
      });
      setInvoices(res.items || []);
      setPagination(res.meta || { page: 1, limit: 10, total: 0, totalPages: 1 });
    } catch (err) {
      setError(err.message || tc('states.errorBody'));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, overdueOnly, tc]);

  useEffect(() => {
    fetchInvoices(1);
  }, [fetchInvoices]);

  const visible = searchQuery
    ? invoices.filter((i) =>
        [i.invoice_number, i.customer_name].some((f) =>
          String(f || '').toLowerCase().includes(searchQuery.toLowerCase())))
    : invoices;

  const isFiltered = Boolean(searchQuery || statusFilter || overdueOnly);

  return (
    <div className="doc-page">
      <div className="doc-page-head">
        <div>
          <h1 className="doc-page-title">
            <Receipt size={19} className="doc-icon-accent" aria-hidden="true" />
            {t('title')}
          </h1>
          <p className="doc-page-sub">{t('subtitle')}</p>
        </div>

        <Link href="/dashboard/customer-invoices/new" className="doc-btn doc-btn-primary">
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
          <option value="posted">{tc('status.posted')}</option>
          <option value="partially_paid">{tc('status.partiallyPaid')}</option>
          <option value="paid">{tc('status.paid')}</option>
          <option value="cancelled">{tc('status.cancelled')}</option>
        </select>

        <label className="doc-filter-check">
          <input
            type="checkbox"
            checked={overdueOnly}
            onChange={(e) => setOverdueOnly(e.target.checked)}
          />
          {t('overdueOnly')}
        </label>

        <button
          type="button"
          onClick={() => fetchInvoices(pagination.page)}
          className="doc-btn doc-btn-icon"
          aria-label={tc('actions.refresh')}
        >
          <RefreshCw size={15} aria-hidden="true" />
        </button>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={() => fetchInvoices(1)} />
      ) : !loading && visible.length === 0 ? (
        <EmptyState
          isFiltered={isFiltered}
          title={t('empty.title')}
          description={t('empty.body')}
          actionLabel={t('newAction')}
          onAction={() => router.push('/dashboard/customer-invoices/new')}
          onClearFilters={() => {
            setSearchQuery('');
            setStatusFilter('');
            setOverdueOnly(false);
          }}
        />
      ) : (
        <div className="doc-table-wrap">
          <table className="doc-table">
            <thead>
              <tr>
                <th>{t('table.number')}</th>
                <th>{t('table.date')}</th>
                <th>{t('table.dueDate')}</th>
                <th>{t('table.customer')}</th>
                <th className="doc-th-right">{t('table.total')}</th>
                <th className="doc-th-right">{t('table.outstanding')}</th>
                <th>{t('table.status')}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((invoice) => (
                <tr
                  key={invoice.id}
                  className="is-clickable"
                  onClick={() => router.push(`/dashboard/customer-invoices/${invoice.id}`)}
                >
                  <td className="doc-cell-code">{invoice.invoice_number}</td>
                  <td className="doc-cell-muted">{formatDate(invoice.invoice_date, locale)}</td>
                  <td className="doc-cell-muted">
                    {invoice.is_overdue ? (
                      <span className="doc-overdue-flag">
                        <AlertTriangle size={13} aria-hidden="true" />
                        {invoice.due_date ? formatDate(invoice.due_date, locale) : t('overdue')}
                      </span>
                    ) : (
                      invoice.due_date ? formatDate(invoice.due_date, locale) : '—'
                    )}
                  </td>
                  <td>{invoice.customer_name || '—'}</td>
                  <td className="doc-cell-money">{formatMoney(invoice.total_amount, locale)}</td>
                  <td className="doc-cell-money">{formatMoney(invoice.amount_due, locale)}</td>
                  <td><StatusPill status={invoice.status} /></td>
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
        onPageChange={(p) => fetchInvoices(p)}
      />
    </div>
  );
}
