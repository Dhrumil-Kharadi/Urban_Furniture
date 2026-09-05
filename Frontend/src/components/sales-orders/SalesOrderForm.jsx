'use client';

import React, { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import ContactPicker from '@/components/pickers/ContactPicker';
import { DocumentLineGrid, DocumentTotals, FormField, FormActions } from '@/components/shared';

/**
 * SalesOrderForm
 *
 * SPECIFICATION (Doc/project.md §5.2.1, Doc/phase.md Phase 9):
 * - Customer + products + quantity + unit price + TAX (§5.2.1 lists tax on
 *   the Sales Order explicitly, which is why the grid shows a tax column).
 * - Lifecycle: draft → confirmed → invoiced → cancelled.
 *
 * REUSE: the line grid, the totals block and the field/action wrappers are all
 * Phase 8's. Only the config differs — salesPrice instead of costPrice, the
 * sales tax scope, and a customer rather than a vendor. A second line grid
 * here is the failure mode phase.md Phase 8 warns about.
 *
 * The totals shown are a PREVIEW. The server recomputes every amount from the
 * lines and ignores anything sent from here.
 */
export default function SalesOrderForm({
  initialData = null,
  onSubmit,
  onCancel,
  isSubmitting = false,
  isReadOnly = false,
}) {
  const t = useTranslations('salesOrders');
  const tc = useTranslations('common');

  // Initialised lazily rather than synced by an effect: the detail page mounts
  // this form only once the record has loaded, and the new page never has one.
  const [formData, setFormData] = useState(() => ({
    customer_contact_id: initialData?.customer_contact_id || '',
    order_date: initialData?.order_date
      ? initialData.order_date.slice(0, 10)
      : new Date().toISOString().slice(0, 10),
    expected_date: initialData?.expected_date ? initialData.expected_date.slice(0, 10) : '',
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

  // Preview only — the server is the authority on every one of these.
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
    if (!formData.order_date) next.order_date = t('errors.orderDate');

    if (!formData.lines.length) next.lines = t('errors.lines');
    else if (formData.lines.some((l) => !l.product_id && !l.description?.trim())) {
      next.lines = t('errors.lineProduct');
    } else if (formData.lines.some((l) => !(parseFloat(l.quantity) > 0))) {
      next.lines = t('errors.lineQuantity');
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (isSubmitting || !validate()) return;

    // Totals are deliberately not sent: the server recomputes them.
    onSubmit({
      customer_contact_id: formData.customer_contact_id,
      order_date: formData.order_date,
      expected_date: formData.expected_date || null,
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
            /* Only customers and 'both' — a vendor-only contact must never
               appear on a sales document. The server refuses it too. */
            type="customer"
            disabled={isReadOnly}
          />
        </FormField>

        <FormField label={t('fields.orderDate')} required error={errors.order_date}>
          <input
            type="date"
            className="form-input"
            value={formData.order_date}
            onChange={(e) => setFormData((prev) => ({ ...prev, order_date: e.target.value }))}
            disabled={isReadOnly}
          />
        </FormField>

        <FormField label={t('fields.expectedDate')}>
          <input
            type="date"
            className="form-input"
            value={formData.expected_date}
            onChange={(e) => setFormData((prev) => ({ ...prev, expected_date: e.target.value }))}
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
            showAccount: false,
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
