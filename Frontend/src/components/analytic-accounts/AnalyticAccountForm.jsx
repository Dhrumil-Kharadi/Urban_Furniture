'use client';

// ============================================================
// FILE: src/components/analytic-accounts/AnalyticAccountForm.jsx
//
// Create / edit form for an Analytic Account (project.md §4.6, §8).
//
// These are the cost centres transactions get tagged with. The Budget Report
// compares a budget's planned amount against the journal lines carrying the
// tag, so the name is what an operator will be reading in a report months
// from now — worth spelling deliberately.
// ============================================================

import React, { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import InputBox from '@/reusablefiles/inputbox';
import FormShell from '@/components/masterdata/FormShell';

/**
 * @param {object}   [props.analyticAccount]
 * @param {boolean}  [props.isEdit]
 * @param {Function} props.onSubmit
 * @param {string}   props.cancelHref
 * @param {string[]} [props.serverErrors]
 * @param {boolean}  [props.submitting]
 */
export default function AnalyticAccountForm({
  analyticAccount = null,
  isEdit = false,
  onSubmit,
  cancelHref,
  serverErrors = [],
  submitting = false,
}) {
  const t = useTranslations('analyticAccounts');
  const tShared = useTranslations('masterData');

  const [form, setForm] = useState({
    code: analyticAccount?.code ?? '',
    name: analyticAccount?.name ?? '',
    analytic_type: analyticAccount?.analytic_type ?? 'income',
    department: analyticAccount?.department ?? '',
  });
  const [localErrors, setLocalErrors] = useState([]);

  const set = (field) => (value) => setForm((current) => ({ ...current, [field]: value }));

  const typeOptions = useMemo(
    () => [
      { value: 'income', label: t('types.income') },
      { value: 'expense', label: t('types.expense') },
    ],
    [t],
  );

  const handleSubmit = () => {
    const errors = [];
    if (!form.name.trim()) errors.push(`${t('fields.name')} — ${tShared('form.required')}`);

    setLocalErrors(errors);
    if (errors.length > 0) return;

    onSubmit({
      code: form.code.trim() || null,
      name: form.name.trim(),
      analytic_type: form.analytic_type,
      department: form.department.trim() || null,
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
        <div className="is-full">
          <InputBox
            label={t('fields.name')}
            value={form.name}
            onChange={set('name')}
            placeholder={t('placeholders.name')}
            invalid={localErrors.length > 0 && !form.name.trim()}
            required
          />
        </div>

        <InputBox
          label={t('fields.code')}
          value={form.code}
          onChange={set('code')}
          placeholder={t('placeholders.code')}
        />

        <InputBox
          as="select"
          label={t('fields.type')}
          value={form.analytic_type}
          onChange={set('analytic_type')}
          options={typeOptions}
        />

        <div className="is-full">
          <InputBox
            label={t('fields.department')}
            value={form.department}
            onChange={set('department')}
            placeholder={t('placeholders.department')}
          />
        </div>
      </div>

      <p className="md-form-hint">{t('purposeNote')}</p>
    </FormShell>
  );
}
