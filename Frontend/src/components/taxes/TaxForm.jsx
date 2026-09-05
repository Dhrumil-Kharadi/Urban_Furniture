'use client';

// ============================================================
// FILE: src/components/taxes/TaxForm.jsx
//
// Create / edit form for a Tax (project.md §7).
//
// The account picker is restricted to liabilities and assets, because that is
// what tax actually is: collected tax is money owed to the government (a
// liability), paid tax is a claim against it (an asset). Pointing a tax at an
// income account instead does not fail loudly — it silently misstates the
// Balance Sheet, which is why the server refuses it too.
//
// RATE: held and submitted as a STRING, never parsed into a float here.
// ============================================================

import React, { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import InputBox from '@/reusablefiles/inputbox';
import FormShell from '@/components/masterdata/FormShell';
import AccountPicker from '@/components/masterdata/AccountPicker';

/** A rate the server will accept: 0–100 with up to 4 decimals. */
const RATE_PATTERN = /^\d{1,3}(\.\d{1,4})?$/;

/** project.md §7: tax posts to its own account — a liability or an asset. */
const TAX_ACCOUNT_TYPES = ['liability', 'asset'];

/**
 * @param {object}   [props.tax]
 * @param {boolean}  [props.isEdit]
 * @param {Function} props.onSubmit
 * @param {string}   props.cancelHref
 * @param {string[]} [props.serverErrors]
 * @param {boolean}  [props.submitting]
 */
export default function TaxForm({
  tax = null,
  isEdit = false,
  onSubmit,
  cancelHref,
  serverErrors = [],
  submitting = false,
}) {
  const t = useTranslations('taxes');
  const tShared = useTranslations('masterData');

  const [form, setForm] = useState({
    name: tax?.name ?? '',
    // Trim the stored 4dp scale for display — "18" reads better than "18.0000".
    rate: tax?.rate != null ? String(tax.rate).replace(/\.?0+$/, '') : '',
    tax_scope: tax?.tax_scope ?? 'both',
    tax_account_id: tax?.tax_account_id ?? '',
  });
  const [localErrors, setLocalErrors] = useState([]);

  const set = (field) => (value) => setForm((current) => ({ ...current, [field]: value }));

  const scopeOptions = useMemo(
    () => [
      { value: 'both', label: t('scopes.both') },
      { value: 'sales', label: t('scopes.sales') },
      { value: 'purchase', label: t('scopes.purchase') },
    ],
    [t],
  );

  const validate = () => {
    const errors = [];

    if (!form.name.trim()) errors.push(`${t('fields.name')} — ${tShared('form.required')}`);

    const rate = String(form.rate).trim();
    if (!rate) {
      errors.push(`${t('fields.rate')} — ${tShared('form.required')}`);
    } else if (!RATE_PATTERN.test(rate) || Number(rate) > 100) {
      errors.push(t('fields.rate'));
    }

    setLocalErrors(errors);
    return errors.length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    onSubmit({
      name: form.name.trim(),
      rate: String(form.rate).trim(),
      tax_scope: form.tax_scope,
      tax_account_id: form.tax_account_id || null,
    });
  };

  return (
    <FormShell
      onSubmit={handleSubmit}
      errors={[...localErrors, ...serverErrors]}
      submitting={submitting}
      submitLabel={isEdit ? tShared('actions.save') : tShared('actions.create')}
      submittingLabel={tShared('actions.saving')}
      cancelLabel={tShared('actions.cancel')}
      cancelHref={cancelHref}
    >
      <div className="md-form-grid">
        <InputBox
          label={t('fields.name')}
          value={form.name}
          onChange={set('name')}
          placeholder={t('placeholders.name')}
          invalid={localErrors.length > 0 && !form.name.trim()}
          required
        />

        <InputBox
          label={t('fields.rate')}
          value={form.rate}
          onChange={set('rate')}
          placeholder={t('placeholders.rate')}
          inputMode="decimal"
          required
        />

        <InputBox
          as="select"
          label={t('fields.scope')}
          value={form.tax_scope}
          onChange={set('tax_scope')}
          options={scopeOptions}
        />

        <AccountPicker
          label={t('fields.account')}
          value={form.tax_account_id}
          onChange={set('tax_account_id')}
          emptyLabel={t('noAccount')}
          allowedTypes={TAX_ACCOUNT_TYPES}
        />
      </div>

      <p className="md-form-hint">{t('accountNote')}</p>
    </FormShell>
  );
}
