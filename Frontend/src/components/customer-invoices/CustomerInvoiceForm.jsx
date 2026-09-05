'use client';

import React, { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import ContactPicker from '@/components/pickers/ContactPicker';
import JournalPicker from '@/components/pickers/JournalPicker';
import { DocumentLineGrid, DocumentTotals, FormField, FormActions } from '@/components/shared';

/**
 * CustomerInvoiceForm
 *
 * SPECIFICATION (Doc/project.md §5.2, Doc/phase.md Phase 9):
 * - Customer, invoice date, due date, sales journal, and lines.
 * - `showAccount` is TRUE here and false on the sales order: an invoice line
 *   must name the income account it will credit, because posting it writes to
 *   the ledger. A quote need not.
 *
 * REUSE: the same line grid, totals and field/action wrappers as Phase 8's
 * vendor bill — configured for the sales side rather than duplicated.
 */
export default function CustomerInvoiceForm({
  initialData = null,
  onSubmit,
  onCancel,
  isSubmitting = false,
  isReadOnly = false,
}) {
  const t = useTranslations('customerInvoices');
  const tc = useTranslations('common');

  // Lazily initialised for the same reason as the sales order form: the detail
  // page mounts this only after the record has loaded.
  const [formData, setFormData] = useState(() => ({
    customer_contact_id: initialData?.customer_contact_id || '',
    journal_id: initialData?.journal_id || '',
    invoice_date: initialData?.invoice_date
      ? initialData.invoice_date.slice(0, 10)
      : new Date().toISOString().slice(0, 10),
    due_date: initialData?.due_date ? initialData.due_date.slice(0, 10) : '',
    notes: initialData?.notes || '',
    lines: initialData?.lines?.length
      ? initialData.lines.map((l) => ({
          ...l,
          quantity: parseFloat(l.quantity) || 1,
          unit_price: parseFloat(l.unit_price) || 0,
          tax_rate: parseFloat(l.tax_rate) || 0,
        }))
      : [
          {
            product_id: null,
            description: '',
            quantity: 1,
            unit_price: 0,
            tax_id: null,
            tax_rate: 0,
            untaxed_amount: '0.00',
            tax_amount: '0.00',
            total_amount: '0.00',
            analytic_account_id: null,
            income_account_id: null,
          },
        ],
  }));

  const [errors, setErrors] = useState({});

  // Preview only. The server recomputes and is the authority.
  const { untaxedTotal, taxTotal, grandTotal } = useMemo(() => {
    const untaxed = formData.lines.reduce((acc, l) => acc + (parseFloat(l.untaxed_amount) || 0), 0);
    const tax = formData.lines.reduce((acc, l) => acc + (parseFloat(l.tax_amount) || 0), 0);
    return {
      untaxedTotal: untaxed.toFixed(2),
      taxTotal: tax.toFixed(2),
      grandTotal: (untaxed + tax).toFixed(2),
    };
  }, [formData.lines]);

  const validate = () => {
    const next = {};
    if (!formData.customer_contact_id) next.customer_contact_id = t('errors.customer');
    if (!formData.journal_id) next.journal_id = t('errors.journal');
    if (!formData.invoice_date) next.invoice_date = t('errors.invoiceDate');
    if (formData.due_date && formData.due_date < formData.invoice_date) {
      next.due_date = t('errors.dueDate');
    }

    if (!formData.lines.length) next.lines = t('errors.lines');
    else if (formData.lines.some((l) => !l.product_id && !l.description?.trim())) {
      next.lines = t('errors.lineProduct');
    } else if (formData.lines.some((l) => !(parseFloat(l.quantity) > 0))) {
      next.lines = t('errors.lineQuantity');
    } else if (formData.lines.some((l) => !l.income_account_id)) {
      // Caught here so it is not a surprise at posting time, when the ledger
      // has nowhere to credit.
      next.lines = t('errors.lineAccount');
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (isSubmitting || !validate()) return;

    onSubmit({
      customer_contact_id: formData.customer_contact_id,
      journal_id: formData.journal_id,
      invoice_date: formData.invoice_date,
      due_date: formData.due_date || null,
      notes: formData.notes || null,
      lines: formData.lines.map((l) => ({
        product_id: l.product_id || null,
        description: l.description || '',
        quantity: String(l.quantity),
        unit_price: String(l.unit_price),
        tax_id: l.tax_id || null,
        tax_rate: l.tax_rate === undefined || l.tax_rate === null ? undefined : String(l.tax_rate),
        analytic_account_id: l.analytic_account_id || null,
        income_account_id: l.income_account_id || null,
      })),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="app-form doc-form-stack" noValidate>
      <div className="app-form-grid">
        <FormField label={t('fields.customer')} required error={errors.customer_contact_id}>
          <ContactPicker
            value={formData.customer_contact_id}
            onChange={(contact) =>
              setFormData((prev) => ({ ...prev, customer_contact_id: contact ? contact.id : '' }))
            }
            type="customer"
            disabled={isReadOnly}
          />
        </FormField>

        <FormField label={t('fields.journal')} required error={errors.journal_id}>
          <JournalPicker
            value={formData.journal_id}
            onChange={(journal) =>
              setFormData((prev) => ({ ...prev, journal_id: journal ? journal.id : '' }))
            }
            type="sales"
            disabled={isReadOnly}
          />
        </FormField>

        <FormField label={t('fields.invoiceDate')} required error={errors.invoice_date}>
          <input
            type="date"
            className="form-input"
            value={formData.invoice_date}
            onChange={(e) => setFormData((prev) => ({ ...prev, invoice_date: e.target.value }))}
            disabled={isReadOnly}
          />
        </FormField>

        <FormField label={t('fields.dueDate')} error={errors.due_date}>
          <input
            type="date"
            className="form-input"
            value={formData.due_date}
            onChange={(e) => setFormData((prev) => ({ ...prev, due_date: e.target.value }))}
            disabled={isReadOnly}
          />
        </FormField>

        <FormField label={t('fields.notes')}>
          <textarea
            rows={2}
            className="form-textarea"
            value={formData.notes}
            onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
            disabled={isReadOnly}
          />
        </FormField>
      </div>

      <div>
        <div className="doc-section-head">
          <h3 className="doc-section-title">{t('linesTitle')}</h3>
          {errors.lines && <span className="doc-section-error">{errors.lines}</span>}
        </div>

        <DocumentLineGrid
          lines={formData.lines}
          onChange={(newLines) => setFormData((prev) => ({ ...prev, lines: newLines }))}
          config={{
            priceField: 'salesPrice',
            taxScope: 'sales',
            // An invoice posts, so each line must name the account it credits.
            showAccount: true,
            accountField: 'income_account_id',
            readOnly: isReadOnly,
          }}
        />

        <div className="doc-totals-right">
          <DocumentTotals
            untaxedAmount={untaxedTotal}
            taxAmount={taxTotal}
            totalAmount={grandTotal}
          />
        </div>
      </div>

      {!isReadOnly && (
        <FormActions
          onCancel={onCancel}
          isSubmitting={isSubmitting}
          submitLabel={initialData ? t('submit.update') : t('submit.create')}
          submittingLabel={tc('actions.submitting')}
          cancelLabel={tc('actions.cancel')}
        />
      )}
    </form>
  );
}
