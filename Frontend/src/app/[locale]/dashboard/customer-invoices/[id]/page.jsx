'use client';

/**
 * @file Customer Invoice Detail
 * @route /dashboard/customer-invoices/[id]
 * @spec Doc/project.md §5.2.4–§5.2.6, Doc/phase.md Phases 9 and 10, Doc/strict.md
 *
 * Posting is the irreversible step: it writes Dr Debtors / Cr Sale Income /
 * Cr Output Tax Payable to the ledger and assigns the real invoice number.
 * After that the only corrections are a payment or a cancellation, and
 * cancelling REVERSES the entry rather than deleting it.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Receipt, Send, XCircle, CheckCircle, Wallet, AlertTriangle } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import {
  StatusPill, ErrorState, ConfirmDialog, useToast,
} from '@/components/shared';
import CustomerInvoiceForm from '@/components/customer-invoices/CustomerInvoiceForm';
import RegisterPaymentModal from '@/components/payments/RegisterPaymentModal';
import { customerInvoicesService } from '@/services/sales.service';
import { formatMoney, formatDate } from '@/utils/format';

export default function CustomerInvoiceDetailPage() {
  const t = useTranslations('customerInvoices');
  const tc = useTranslations('common');
  const { id } = useParams();
  const locale = useLocale();
  const { showSuccess, showError } = useToast();

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [showPayment, setShowPayment] = useState(false);

  const fetchInvoice = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await customerInvoicesService.get(id);
      setInvoice(res.invoice);
    } catch (err) {
      setError(err.message || tc('states.errorBody'));
    } finally {
      setLoading(false);
    }
  }, [id, tc]);

  useEffect(() => { fetchInvoice(); }, [fetchInvoice]);

  const run = async (fn, successMessage) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      showSuccess(successMessage);
      await fetchInvoice();
    } catch (err) {
      showError(err.message || tc('toast.error'));
    } finally {
      setBusy(false);
      setConfirmAction(null);
    }
  };

  if (loading) {
    return <div className="doc-loading">{tc('states.loading')}</div>;
  }

  if (error || !invoice) {
    return (
      <div className="doc-page doc-page-narrow">
        <ErrorState message={error || tc('states.notFound')} onRetry={fetchInvoice} />
      </div>
    );
  }

  const isDraft = invoice.status === 'draft';
  const isOpen = ['posted', 'partially_paid'].includes(invoice.status);

  return (
    <div className="doc-page">
      <div className="doc-page-head">
        <div className="doc-page-head-left">
          <Link
            href="/dashboard/customer-invoices"
            className="doc-btn doc-btn-icon"
            aria-label={tc('actions.back')}
          >
            <ArrowLeft size={15} aria-hidden="true" />
          </Link>
          <div>
            <h1 className="doc-page-title">
              <Receipt size={19} className="doc-icon-accent" aria-hidden="true" />
              {invoice.invoice_number}
            </h1>
            <p className="doc-page-sub">
              {invoice.customer_name} · {formatDate(invoice.invoice_date, locale)}
              {invoice.so_number ? ` · ${t('fromOrder')} ${invoice.so_number}` : ''}
            </p>
          </div>
        </div>

        <div className="doc-page-actions">
          {invoice.is_overdue && (
            <span className="doc-overdue-flag">
              <AlertTriangle size={13} aria-hidden="true" />
              {t('overdue')}
            </span>
          )}

          <StatusPill status={invoice.status} />

          {isDraft && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmAction('post')}
              className="doc-btn doc-btn-primary"
            >
              <CheckCircle size={15} aria-hidden="true" />
              {t('actions.post')}
            </button>
          )}

          {isOpen && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setShowPayment(true)}
              className="doc-btn doc-btn-primary"
            >
              <Wallet size={15} aria-hidden="true" />
              {t('actions.registerPayment')}
            </button>
          )}

          {!isDraft && invoice.status !== 'cancelled' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => customerInvoicesService.send(id), t('toast.sent'))}
              className="doc-btn"
            >
              <Send size={15} aria-hidden="true" />
              {t('actions.send')}
            </button>
          )}

          {invoice.status !== 'cancelled' && invoice.status !== 'paid' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmAction('cancel')}
              className="doc-btn"
            >
              <XCircle size={15} aria-hidden="true" />
              {t('actions.cancel')}
            </button>
          )}
        </div>
      </div>

      {isOpen && (
        <div className="doc-summary">
          <div>
            <p className="doc-summary-label">{t('summary.total')}</p>
            <p className="doc-summary-value">{formatMoney(invoice.total_amount, locale)}</p>
          </div>
          <div>
            <p className="doc-summary-label">{t('summary.paid')}</p>
            <p className="doc-summary-value">{formatMoney(invoice.amount_paid, locale)}</p>
          </div>
          <div>
            <p className="doc-summary-label">{t('summary.outstanding')}</p>
            <p className="doc-summary-value is-strong">
              {formatMoney(invoice.amount_due, locale)}
            </p>
          </div>
          {invoice.due_date && (
            <div>
              <p className="doc-summary-label">{t('summary.due')}</p>
              <p className="doc-summary-value">{formatDate(invoice.due_date, locale)}</p>
            </div>
          )}
        </div>
      )}

      <CustomerInvoiceForm initialData={invoice} isReadOnly onSubmit={() => {}} onCancel={() => {}} />

      <ConfirmDialog
        isOpen={confirmAction === 'post'}
        title={t('postDialog.title')}
        description={t('postDialog.body')}
        confirmLabel={t('actions.post')}
        cancelLabel={tc('actions.cancel')}
        isSubmitting={busy}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => run(() => customerInvoicesService.post(id), t('toast.posted'))}
      />

      <ConfirmDialog
        isOpen={confirmAction === 'cancel'}
        title={t('cancelDialog.title')}
        description={t('cancelDialog.body')}
        confirmLabel={t('actions.cancel')}
        cancelLabel={tc('actions.close')}
        isDestructive
        isSubmitting={busy}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => run(() => customerInvoicesService.cancel(id), t('toast.cancelled'))}
      />

      {showPayment && (
        <RegisterPaymentModal
          isOpen={showPayment}
          onClose={() => setShowPayment(false)}
          document={invoice}
          direction="inbound"
          onRecorded={() => {
            setShowPayment(false);
            fetchInvoice();
          }}
        />
      )}
    </div>
  );
}
