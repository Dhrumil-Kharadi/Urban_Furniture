'use client';

/**
 * @file Payments List
 * @route /dashboard/payments
 * @spec Doc/project.md §5.1.5, §5.2.5, Doc/phase.md Phase 10, Doc/strict.md
 *
 * Both directions in one list: money received from customers and money paid to
 * vendors. They share a lifecycle and an allocation model, so splitting them
 * would mean maintaining the same page twice.
 *
 * There is no delete. A payment that reached the ledger is cancelled, which
 * reverses its entry and restores each document's balance.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, RefreshCw, Wallet, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { paymentsService } from '@/services/payments.service';
import { formatMoney, formatDate } from '@/utils/format';
import { Pagination, StatusPill, EmptyState, ErrorState } from '@/components/shared';

export default function PaymentsPage() {
  const t = useTranslations('payments');
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();

  const [payments, setPayments] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [directionFilter, setDirectionFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');

  const fetchPayments = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await paymentsService.list({
        page,
        limit: 10,
        direction: directionFilter || undefined,
        method: methodFilter || undefined,
      });
      setPayments(res.items || []);
      setPagination(res.meta || { page: 1, limit: 10, total: 0, totalPages: 1 });
    } catch (err) {
      setError(err.message || tc('states.errorBody'));
    } finally {
      setLoading(false);
    }
  }, [directionFilter, methodFilter, tc]);

  useEffect(() => {
    fetchPayments(1);
  }, [fetchPayments]);

  const isFiltered = Boolean(directionFilter || methodFilter);

  return (
    <div className="doc-page">
      <div className="doc-page-head">
        <div>
          <h1 className="doc-page-title">
            <Wallet size={19} className="doc-icon-accent" aria-hidden="true" />
            {t('title')}
          </h1>
          <p className="doc-page-sub">{t('subtitle')}</p>
        </div>

        <Link href="/dashboard/payments/new" className="doc-btn doc-btn-primary">
          <Plus size={15} aria-hidden="true" />
          {t('newAction')}
        </Link>
      </div>

      <div className="doc-filters">
        <select
          className="form-select"
          aria-label={t('directions.all')}
          value={directionFilter}
          onChange={(e) => setDirectionFilter(e.target.value)}
        >
          <option value="">{t('directions.all')}</option>
          <option value="inbound">{t('directions.inbound')}</option>
          <option value="outbound">{t('directions.outbound')}</option>
        </select>

        <select
          className="form-select"
          aria-label={t('allMethods')}
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value)}
        >
          <option value="">{t('allMethods')}</option>
          <option value="cash">{t('methods.cash')}</option>
          <option value="bank">{t('methods.bank')}</option>
          <option value="card">{t('methods.card')}</option>
        </select>

        <button
          type="button"
          onClick={() => fetchPayments(pagination.page)}
          className="doc-btn doc-btn-icon"
          aria-label={tc('actions.refresh')}
        >
          <RefreshCw size={15} aria-hidden="true" />
        </button>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={() => fetchPayments(1)} />
      ) : !loading && payments.length === 0 ? (
        <EmptyState
          isFiltered={isFiltered}
          title={t('empty.title')}
          description={t('empty.body')}
          onClearFilters={() => {
            setDirectionFilter('');
            setMethodFilter('');
          }}
        />
      ) : (
        <div className="doc-table-wrap">
          <table className="doc-table">
            <thead>
              <tr>
                <th>{t('table.number')}</th>
                <th>{t('table.date')}</th>
                <th>{t('table.contact')}</th>
                <th>{t('table.method')}</th>
                <th className="doc-th-right">{t('table.amount')}</th>
                <th>{t('table.status')}</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => {
                const inbound = payment.direction === 'inbound';
                const DirectionIcon = inbound ? ArrowDownLeft : ArrowUpRight;

                return (
                  <tr
                    key={payment.id}
                    className="is-clickable"
                    onClick={() => router.push(`/dashboard/payments/${payment.id}`)}
                  >
                    <td className="doc-cell-code">
                      <DirectionIcon
                        size={13}
                        aria-label={inbound ? t('directions.inbound') : t('directions.outbound')}
                      />
                      {' '}
                      {payment.payment_number}
                    </td>
                    <td className="doc-cell-muted">{formatDate(payment.payment_date, locale)}</td>
                    <td>{payment.contact_name || '—'}</td>
                    <td>{t(`methods.${payment.method}`)}</td>
                    <td className="doc-cell-money">{formatMoney(payment.amount, locale)}</td>
                    <td><StatusPill status={payment.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={pagination.page}
        limit={pagination.limit}
        total={pagination.total}
        totalPages={pagination.totalPages}
        onPageChange={(p) => fetchPayments(p)}
      />
    </div>
  );
}
