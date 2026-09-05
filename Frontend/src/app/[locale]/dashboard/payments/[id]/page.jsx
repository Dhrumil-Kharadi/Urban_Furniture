'use client';

/**
 * @file Payment Detail
 * @route /dashboard/payments/[id]
 * @spec Doc/project.md §5.1.5, §5.2.5, Doc/phase.md Phase 10, Doc/strict.md
 *
 * Shows what the payment settled and for how much. Cancelling is admin-only
 * and REVERSES the journal entry — the original stays in the ledger with a
 * mirror beside it, and each document's balance is restored exactly.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Wallet, XCircle } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { StatusPill, ErrorState, ConfirmDialog, useToast } from '@/components/shared';
import { useAuth } from '@/context/AuthContext';
import { paymentsService } from '@/services/payments.service';
import { formatMoney, formatDate } from '@/utils/format';

export default function PaymentDetailPage() {
  const t = useTranslations('payments');
  const tc = useTranslations('common');
  const { id } = useParams();
  const locale = useLocale();
  const { showSuccess, showError } = useToast();
  const { role } = useAuth();

  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const fetchPayment = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await paymentsService.get(id);
      setPayment(res.payment);
    } catch (err) {
      setError(err.message || tc('states.errorBody'));
    } finally {
      setLoading(false);
    }
  }, [id, tc]);

  useEffect(() => { fetchPayment(); }, [fetchPayment]);

  const handleCancel = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await paymentsService.cancel(id);
      showSuccess(t('toast.cancelledBody'));
      await fetchPayment();
    } catch (err) {
      showError(err.message || tc('toast.error'));
    } finally {
      setBusy(false);
      setConfirmCancel(false);
    }
  };

  if (loading) {
    return <div className="doc-loading">{tc('states.loading')}</div>;
  }

  if (error || !payment) {
    return (
      <div className="doc-page doc-page-narrow">
        <ErrorState message={error || tc('states.notFound')} onRetry={fetchPayment} />
      </div>
    );
  }

  const inbound = payment.direction === 'inbound';

  return (
    <div className="doc-page">
      <div className="doc-page-head">
        <div className="doc-page-head-left">
          <Link
            href="/dashboard/payments"
            className="doc-btn doc-btn-icon"
            aria-label={tc('actions.back')}
          >
            <ArrowLeft size={15} aria-hidden="true" />
          </Link>
          <div>
            <h1 className="doc-page-title">
              <Wallet size={19} className="doc-icon-accent" aria-hidden="true" />
              {payment.payment_number}
            </h1>
            <p className="doc-page-sub">
              {inbound ? t('directions.inbound') : t('directions.outbound')} ·{' '}
              {payment.contact_name} · {formatDate(payment.payment_date, locale)}
            </p>
          </div>
        </div>

        <div className="doc-page-actions">
          <StatusPill status={payment.status} />

          {role === 'business_owner' && payment.status === 'posted' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmCancel(true)}
              className="doc-btn"
            >
              <XCircle size={15} aria-hidden="true" />
              {tc('actions.cancel')}
            </button>
          )}
        </div>
      </div>

      <div className="doc-summary">
        <div>
          <p className="doc-summary-label">{t('fields.amount')}</p>
          <p className="doc-summary-value is-strong">{formatMoney(payment.amount, locale)}</p>
        </div>
        <div>
          <p className="doc-summary-label">{t('fields.method')}</p>
          <p className="doc-summary-value">{t(`methods.${payment.method}`)}</p>
        </div>
        <div>
          <p className="doc-summary-label">{t('fields.journal')}</p>
          <p className="doc-summary-value">{payment.journal_name || '—'}</p>
        </div>
        <div>
          <p className="doc-summary-label">{t('fields.cashAccount')}</p>
          <p className="doc-summary-value">
            {payment.cash_account_code ? `${payment.cash_account_code} · ` : ''}
            {payment.cash_account_name || '—'}
          </p>
        </div>
        {payment.entry_number && (
          <div>
            <p className="doc-summary-label">{t('fields.journalEntry')}</p>
            <p className="doc-summary-value">
              <Link
                href={`/dashboard/journal-entries/${payment.journal_entry_id}`}
                className="doc-cell-code"
              >
                {payment.entry_number}
              </Link>
            </p>
          </div>
        )}
        {payment.reference && (
          <div>
            <p className="doc-summary-label">{t('fields.reference')}</p>
            <p className="doc-summary-value">{payment.reference}</p>
          </div>
        )}
      </div>

      <div>
        <div className="doc-section-head">
          <h3 className="doc-section-title">{t('allocations.title')}</h3>
        </div>

        <div className="doc-table-wrap">
          <table className="doc-table">
            <thead>
              <tr>
                <th>{t('allocations.document')}</th>
                <th className="doc-th-right">{t('allocations.documentTotal')}</th>
                <th className="doc-th-right">{t('allocations.allocated')}</th>
                <th className="doc-th-right">{t('allocations.stillDue')}</th>
              </tr>
            </thead>
            <tbody>
              {(payment.allocations || []).map((allocation) => {
                const isInvoice = Boolean(allocation.customer_invoice_id);
                const number = allocation.invoice_number || allocation.bill_number;
                const total = allocation.invoice_total || allocation.bill_total;
                const due = allocation.invoice_due ?? allocation.bill_due;
                const href = isInvoice
                  ? `/dashboard/customer-invoices/${allocation.customer_invoice_id}`
                  : `/dashboard/vendor-bills/${allocation.vendor_bill_id}`;

                return (
                  <tr key={allocation.id}>
                    <td>
                      <Link href={href} className="doc-cell-code">{number}</Link>
                    </td>
                    <td className="doc-cell-money">{formatMoney(total, locale)}</td>
                    <td className="doc-cell-money">
                      {formatMoney(allocation.allocated_amount, locale)}
                    </td>
                    <td className="doc-cell-money">{formatMoney(due, locale)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmCancel}
        title={t('cancelDialog.title')}
        description={t('cancelDialog.body')}
        confirmLabel={tc('actions.confirm')}
        cancelLabel={tc('actions.close')}
        isDestructive
        isSubmitting={busy}
        onClose={() => setConfirmCancel(false)}
        onConfirm={handleCancel}
      />
    </div>
  );
}
