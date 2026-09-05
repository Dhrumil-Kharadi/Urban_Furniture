'use client';

/**
 * @file Sales Order Detail
 * @route /dashboard/sales-orders/[id]
 * @spec Doc/project.md §5.2.2, §5.2.3, Doc/phase.md Phase 9, Doc/strict.md
 *
 * Actions follow the lifecycle: a draft can be confirmed, a confirmed order
 * can become an invoice, and either can be cancelled. An invoiced order offers
 * nothing — cancel its invoice instead, which reverses the ledger entry.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, FileText, CheckCircle, Receipt, XCircle } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter, Link } from '@/i18n/navigation';
import {
  StatusPill, ErrorState, ConfirmDialog, useToast, DocumentTotals,
} from '@/components/shared';
import SalesOrderForm from '@/components/sales-orders/SalesOrderForm';
import JournalPicker from '@/components/pickers/JournalPicker';
import { salesOrdersService } from '@/services/sales.service';
import { formatDate } from '@/utils/format';

export default function SalesOrderDetailPage() {
  const t = useTranslations('salesOrders');
  const tc = useTranslations('common');
  const { id } = useParams();
  const router = useRouter();
  const locale = useLocale();
  const { showSuccess, showError } = useToast();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const [confirmAction, setConfirmAction] = useState(null);
  const [invoiceJournalId, setInvoiceJournalId] = useState('');
  const [showInvoicePanel, setShowInvoicePanel] = useState(false);

  const fetchOrder = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { salesOrder } = await salesOrdersService.get(id);
      setOrder(salesOrder);
    } catch (err) {
      setError(err.message || tc('states.errorBody'));
    } finally {
      setLoading(false);
    }
  }, [id, tc]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  const run = async (fn, successMessage) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      showSuccess(successMessage);
      await fetchOrder();
    } catch (err) {
      showError(err.message || tc('toast.error'));
    } finally {
      setBusy(false);
      setConfirmAction(null);
    }
  };

  const handleCreateInvoice = async () => {
    if (!invoiceJournalId) {
      showError(t('toast.journalRequired'));
      return;
    }

    setBusy(true);
    try {
      const { invoice } = await salesOrdersService.createInvoice(id, {
        journal_id: invoiceJournalId,
        invoice_date: new Date().toISOString().slice(0, 10),
      });
      showSuccess(t('toast.invoiceCreated'));
      router.push(`/dashboard/customer-invoices/${invoice.id}`);
    } catch (err) {
      showError(err.message || tc('toast.error'));
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="doc-loading">{tc('states.loading')}</div>;
  }

  if (error || !order) {
    return (
      <div className="doc-page doc-page-narrow">
        <ErrorState message={error || tc('states.notFound')} onRetry={fetchOrder} />
      </div>
    );
  }

  const isDraft = order.status === 'draft';
  const isConfirmed = order.status === 'confirmed';

  return (
    <div className="doc-page">
      <div className="doc-page-head">
        <div className="doc-page-head-left">
          <Link
            href="/dashboard/sales-orders"
            className="doc-btn doc-btn-icon"
            aria-label={tc('actions.back')}
          >
            <ArrowLeft size={15} aria-hidden="true" />
          </Link>
          <div>
            <h1 className="doc-page-title">
              <FileText size={19} className="doc-icon-accent" aria-hidden="true" />
              {order.so_number}
            </h1>
            <p className="doc-page-sub">
              {order.customer_name} · {formatDate(order.order_date, locale)}
            </p>
          </div>
        </div>

        <div className="doc-page-actions">
          <StatusPill status={order.status} />

          {isDraft && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmAction('confirm')}
              className="doc-btn doc-btn-primary"
            >
              <CheckCircle size={15} aria-hidden="true" />
              {t('actions.confirm')}
            </button>
          )}

          {isConfirmed && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setShowInvoicePanel((v) => !v)}
              className="doc-btn doc-btn-primary"
            >
              <Receipt size={15} aria-hidden="true" />
              {t('actions.createInvoice')}
            </button>
          )}

          {(isDraft || isConfirmed) && (
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

      {showInvoicePanel && isConfirmed && (
        <div className="doc-panel">
          <h3 className="doc-panel-title">{t('invoicePanel.title')}</h3>
          <p className="doc-panel-body">{t('invoicePanel.body')}</p>

          <div className="doc-panel-field">
            <JournalPicker
              value={invoiceJournalId}
              onChange={(journal) => setInvoiceJournalId(journal ? journal.id : '')}
              type="sales"
            />
          </div>

          <div>
            <button
              type="button"
              disabled={busy}
              onClick={handleCreateInvoice}
              className="doc-btn doc-btn-primary"
            >
              {busy ? t('invoicePanel.creating') : t('invoicePanel.action')}
            </button>
          </div>
        </div>
      )}

      <SalesOrderForm initialData={order} isReadOnly onSubmit={() => {}} onCancel={() => {}} />

      <div className="doc-totals-right">
        <DocumentTotals
          untaxedAmount={order.untaxed_amount}
          taxAmount={order.tax_amount}
          totalAmount={order.total_amount}
        />
      </div>

      <ConfirmDialog
        isOpen={confirmAction === 'confirm'}
        title={t('confirmDialog.title')}
        description={t('confirmDialog.body')}
        confirmLabel={t('actions.confirm')}
        cancelLabel={tc('actions.cancel')}
        isSubmitting={busy}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => run(() => salesOrdersService.confirm(id), t('toast.confirmed'))}
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
        onConfirm={() => run(() => salesOrdersService.cancel(id), t('toast.cancelled'))}
      />
    </div>
  );
}
