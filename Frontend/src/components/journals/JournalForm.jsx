'use client';

// ============================================================
// FILE: src/components/journals/JournalForm.jsx
//
// Create / edit form for a Journal (project.md §4.4).
//
// The default accounts are conveniences the posting rules fall back on, not
// constraints — a document can always post elsewhere. Both pickers offer only
// active accounts in this tenant, and the server re-checks that.
// ============================================================

import React, { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import InputBox from '@/reusablefiles/inputbox';
import FormShell from '@/components/masterdata/FormShell';
import AccountPicker from '@/components/masterdata/AccountPicker';

/**
 * @param {object}   [props.journal]
 * @param {boolean}  [props.isEdit]
 * @param {Function} props.onSubmit
 * @param {string}   props.cancelHref
 * @param {string[]} [props.serverErrors]
 * @param {boolean}  [props.submitting]
 */
export default function JournalForm({
  journal = null,
  isEdit = false,
  onSubmit,
  cancelHref,
  serverErrors = [],
  submitting = false,
}) {
  const t = useTranslations('journals');
  const tShared = useTranslations('masterData');

  const [form, setForm] = useState({
    name: journal?.name ?? '',
    journal_type: journal?.journal_type ?? 'sales',
    sequence_prefix: journal?.sequence_prefix ?? '',
    default_debit_account_id: journal?.default_debit_account_id ?? '',
    default_credit_account_id: journal?.default_credit_account_id ?? '',
  });
  const [localErrors, setLocalErrors] = useState([]);

  const set = (field) => (value) => setForm((current) => ({ ...current, [field]: value }));

  const typeOptions = useMemo(
    () => [
      { value: 'sales', label: t('types.sales') },
      { value: 'purchase', label: t('types.purchase') },
      { value: 'bank', label: t('types.bank') },
      { value: 'cash', label: t('types.cash') },
      { value: 'general', label: t('types.general') },
    ],
    [t],
  );

  const handleSubmit = () => {
    const errors = [];
    if (!form.name.trim()) errors.push(`${t('fields.name')} — ${tShared('form.required')}`);

    setLocalErrors(errors);
    if (errors.length > 0) return;

    onSubmit({
      name: form.name.trim(),
      journal_type: form.journal_type,
      sequence_prefix: form.sequence_prefix.trim() || null,
      default_debit_account_id: form.default_debit_account_id || null,
      default_credit_account_id: form.default_credit_account_id || null,
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
          as="select"
          label={t('fields.type')}
          value={form.journal_type}
          onChange={set('journal_type')}
          options={typeOptions}
        />

        <InputBox
          label={t('fields.prefix')}
          value={form.sequence_prefix}
          onChange={set('sequence_prefix')}
          placeholder={t('placeholders.prefix')}
          maxLength={10}
        />

        <div />

        <AccountPicker
          label={t('fields.defaultDebit')}
          value={form.default_debit_account_id}
          onChange={set('default_debit_account_id')}
          emptyLabel={tShared('filters.none')}
        />

        <AccountPicker
          label={t('fields.defaultCredit')}
          value={form.default_credit_account_id}
          onChange={set('default_credit_account_id')}
          emptyLabel={tShared('filters.none')}
        />
      </div>

      <p className="md-form-hint">{t('lastOfTypeNote')}</p>
    </FormShell>
  );
}
