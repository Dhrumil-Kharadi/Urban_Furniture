'use client';

import React, { useState, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import JournalPicker from '@/components/pickers/JournalPicker';
import AccountPicker from '@/components/pickers/AccountPicker';
import { Modal, FormField, FormActions, useToast } from '@/components/shared';
import { paymentsService } from '@/services/payments.service';
import { formatMoney } from '@/utils/format';

/**
 * RegisterPaymentModal
 *
 * SPECIFICATION (Doc/project.md §5.1.5, §5.2.5, Doc/phase.md Phase 10):
 * Records a payment against ONE document, from that document's detail page.
 *
 * Two rules are mirrored here for fast feedback and enforced by the server:
 *
 *   1. The amount cannot exceed what is outstanding. The server re-checks it
 *      under a row lock, which is the only place it can be checked safely —
 *      two people paying the same invoice at once would both pass a check
 *      made anywhere else.
 *
 *   2. The journal type must match the method: cash through a cash journal,
 *      bank and card through a bank journal. Getting it wrong credits the
 *      wrong asset account, and nothing notices until a reconciliation.
 *
 * Allocation is implicit here — one document, so the allocated amount IS the
 * payment amount. The API takes an array because a payment may settle several
 * documents at once.
 */
export default function RegisterPaymentModal({
  isOpen,
  onClose,
  document: doc,
  direction = 'inbound',
  onRecorded,
}) {
  const t = useTranslations('payments');
  const tc = useTranslations('common');
  const locale = useLocale();
  const { showSuccess, showError } = useToast();

  const outstanding = doc?.amount_due ?? '0.00';

  const [form, setForm] = useState({
    method: 'bank',
    payment_date: new Date().toISOString().slice(0, 10),
    amount: outstanding,
    journal_id: '',
    cash_account_id: '',
    reference: '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  // Cash pays through a cash journal; bank and card through a bank journal.
  const journalType = form.method === 'cash' ? 'cash' : 'bank';

  const remaining = useMemo(() => {
    const due = parseFloat(outstanding) || 0;
    const paying = parseFloat(form.amount) || 0;
    return (due - paying).toFixed(2);
  }, [outstanding, form.amount]);

  const set = (field) => (value) => setForm((prev) => ({ ...prev, [field]: value }));

  const validate = () => {
    const next = {};
    const amount = parseFloat(form.amount);

    if (!form.amount || Number.isNaN(amount) || amount <= 0) {
      next.amount = t('errors.amount');
    } else if (amount > parseFloat(outstanding)) {
      next.amount = t('errors.exceeds', { amount: formatMoney(outstanding, locale) });
    } else if (!/^\d+(\.\d{1,2})?$/.test(String(form.amount).trim())) {
      next.amount = t('errors.decimals');
    }

    if (!form.payment_date) next.payment_date = t('errors.date');
    else if (form.payment_date > new Date().toISOString().slice(0, 10)) {
      next.payment_date = t('errors.futureDate');
    }

    if (!form.journal_id) next.journal_id = t('errors.journal');
    if (!form.cash_account_id) next.cash_account_id = t('errors.cashAccount');

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading || !validate()) return;

    setLoading(true);
    try {
      const contactId = direction === 'inbound' ? doc.customer_contact_id : doc.vendor_contact_id;
      const allocation = direction === 'inbound'
        ? { customer_invoice_id: doc.id, allocated_amount: String(form.amount) }
        : { vendor_bill_id: doc.id, allocated_amount: String(form.amount) };

      await paymentsService.create({
        contact_id: contactId,
        direction,
        method: form.method,
        payment_date: form.payment_date,
        // A string all the way to the server. Parsing to a Number here would
        // be the one float in the path.
        amount: String(form.amount),
        journal_id: form.journal_id,
        cash_account_id: form.cash_account_id,
        reference: form.reference || null,
        allocations: [allocation],
      });

      showSuccess(t('toast.recordedBody'));
      if (onRecorded) onRecorded();
    } catch (err) {
      showError(err.message || tc('toast.error'));
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('register.title')} maxWidth={620}>
      <form onSubmit={handleSubmit} className="app-form doc-form-stack" noValidate>
        <div className="doc-summary">
          <div>
            <p className="doc-summary-label">{t('register.outstanding')}</p>
            <p className="doc-summary-value is-strong">{formatMoney(outstanding, locale)}</p>
          </div>
        </div>

        <div className="app-form-grid">
          <FormField label={t('fields.method')} required>
            <select
              className="form-select"
              value={form.method}
              onChange={(e) => {
                // Changing the method invalidates the journal: the two must
                // agree, so the picker is cleared rather than left stale.
                setForm((prev) => ({ ...prev, method: e.target.value, journal_id: '' }));
              }}
            >
              <option value="bank">{t('methods.bank')}</option>
              <option value="cash">{t('methods.cash')}</option>
              <option value="card">{t('methods.card')}</option>
            </select>
          </FormField>

          <FormField label={t('fields.paymentDate')} required error={errors.payment_date}>
            <input
              type="date"
              className="form-input"
              max={new Date().toISOString().slice(0, 10)}
              value={form.payment_date}
              onChange={(e) => set('payment_date')(e.target.value)}
            />
          </FormField>

          <FormField
            label={journalType === 'cash' ? t('register.cashJournal') : t('register.bankJournal')}
            required
            error={errors.journal_id}
          >
            <JournalPicker
              value={form.journal_id}
              onChange={(journal) => set('journal_id')(journal ? journal.id : '')}
              type={journalType}
            />
          </FormField>

          <FormField label={t('fields.cashAccount')} required error={errors.cash_account_id}>
            <AccountPicker
              value={form.cash_account_id}
              onChange={(account) => set('cash_account_id')(account ? account.id : '')}
              type="asset"
            />
          </FormField>

          <FormField label={t('fields.amount')} required error={errors.amount}>
            <input
              type="text"
              inputMode="decimal"
              className="form-input"
              value={form.amount}
              onChange={(e) => set('amount')(e.target.value)}
            />
          </FormField>

          <FormField label={t('fields.reference')}>
            <input
              type="text"
              className="form-input"
              value={form.reference}
              onChange={(e) => set('reference')(e.target.value)}
            />
          </FormField>
        </div>

        <p className="doc-panel-body">
          {parseFloat(remaining) > 0
            ? t('register.remaining', { amount: formatMoney(remaining, locale) })
            : t('register.settles')}
        </p>

        <FormActions
          onCancel={onClose}
          isSubmitting={loading}
          submitLabel={t('register.action')}
          submittingLabel={t('register.recording')}
          cancelLabel={tc('actions.cancel')}
        />
      </form>
    </Modal>
  );
}
