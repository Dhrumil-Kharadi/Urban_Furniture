'use client';

// ============================================================
// FILE: src/components/accounts/AccountForm.jsx
//
// Create / edit form for a Chart of Accounts row (project.md §4.3).
//
// Two rules are mirrored here for fast feedback, and enforced for real on the
// server: the parent picker only offers accounts of the same type, and a
// system account's code and type are read-only. THE SERVER REMAINS THE
// AUTHORITY — it re-checks both, plus the ancestor chain for cycles, which
// this form cannot see.
//
// MONEY: the opening balance is held and submitted as a STRING.
// ============================================================

import React, { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import InputBox from '@/reusablefiles/inputbox';
import FormShell from '@/components/masterdata/FormShell';
import AccountPicker from '@/components/masterdata/AccountPicker';

/** A balance the server will accept: up to 13 digits, up to 2 decimals, signed. */
const BALANCE_PATTERN = /^-?\d{1,13}(\.\d{1,2})?$/;

/**
 * @param {object}   [props.account]
 * @param {boolean}  [props.isEdit]
 * @param {Function} props.onSubmit
 * @param {string}   props.cancelHref
 * @param {string[]} [props.serverErrors]
 * @param {boolean}  [props.submitting]
 */
export default function AccountForm({
  account = null,
  isEdit = false,
  onSubmit,
  cancelHref,
  serverErrors = [],
  submitting = false,
}) {
  const t = useTranslations('accounts');
  const tShared = useTranslations('masterData');

  const [form, setForm] = useState({
    code: account?.code ?? '',
    name: account?.name ?? '',
    account_type: account?.account_type ?? 'asset',
    parent_account_id: account?.parent_account_id ?? '',
    opening_balance: account?.opening_balance ?? '0.00',
  });
  const [localErrors, setLocalErrors] = useState([]);

  const set = (field) => (value) => setForm((current) => ({ ...current, [field]: value }));

  const isSystem = Boolean(account?.is_system);

  const typeOptions = useMemo(
    () => [
      { value: 'asset', label: t('types.asset') },
      { value: 'liability', label: t('types.liability') },
      { value: 'expense', label: t('types.expense') },
      { value: 'income', label: t('types.income') },
      { value: 'capital', label: t('types.capital') },
    ],
    [t],
  );

  const handleTypeChange = (value) => {
    // A parent of the old type would no longer be legal, so it is cleared
    // rather than left to fail on submit.
    setForm((current) => ({ ...current, account_type: value, parent_account_id: '' }));
  };

  const validate = () => {
    const errors = [];

    if (!form.code.trim()) errors.push(`${t('fields.code')} — ${tShared('form.required')}`);
    if (!form.name.trim()) errors.push(`${t('fields.name')} — ${tShared('form.required')}`);

    const balance = String(form.opening_balance).trim();
    if (balance && !BALANCE_PATTERN.test(balance)) {
      errors.push(t('fields.openingBalance'));
    }

    setLocalErrors(errors);
    return errors.length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    const payload = {
      name: form.name.trim(),
      parent_account_id: form.parent_account_id || null,
      opening_balance: String(form.opening_balance).trim() || '0',
    };

    // A system account's code and type are fixed; sending them would just earn
    // a 409 that says so.
    if (!isSystem) {
      payload.code = form.code.trim();
      payload.account_type = form.account_type;
    }

    onSubmit(payload);
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
          label={t('fields.code')}
          value={form.code}
          onChange={set('code')}
          placeholder={t('placeholders.code')}
          disabled={isSystem}
          invalid={localErrors.length > 0 && !form.code.trim()}
          required
        />

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
          value={form.account_type}
          onChange={handleTypeChange}
          options={typeOptions}
          disabled={isSystem}
        />

        <AccountPicker
          label={t('fields.parent')}
          value={form.parent_account_id}
          onChange={set('parent_account_id')}
          emptyLabel={t('noParent')}
          allowedTypes={[form.account_type]}
          excludeId={account?.id ?? null}
        />

        <InputBox
          label={t('fields.openingBalance')}
          value={form.opening_balance}
          onChange={set('opening_balance')}
          placeholder={t('placeholders.balance')}
          inputMode="decimal"
        />
      </div>

      <p className="md-form-hint">{t('parentNote')}</p>

      {isSystem ? <p className="md-form-hint">{t('systemNote')}</p> : null}
    </FormShell>
  );
}
