'use client';

// ============================================================
// FILE: src/components/contacts/ContactForm.jsx
//
// Create / edit form for a Contact (project.md §4.1).
//
// Validation here is for the reader's benefit — it catches a mistyped pincode
// before a round trip. It is NOT the security boundary: the server validates
// every field again and is the only thing that decides what gets stored.
// ============================================================

import React, { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import InputBox from '@/reusablefiles/inputbox';
import FormShell from '@/components/masterdata/FormShell';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PINCODE_PATTERN = /^[1-9][0-9]{5}$/;

/**
 * @param {object}   [props.contact]  - Existing record when editing.
 * @param {boolean}  [props.isEdit]
 * @param {Function} props.onSubmit   - Receives the payload; may throw.
 * @param {string}   props.cancelHref
 * @param {string[]} [props.serverErrors]
 * @param {boolean}  [props.submitting]
 */
export default function ContactForm({
  contact = null,
  isEdit = false,
  onSubmit,
  cancelHref,
  serverErrors = [],
  submitting = false,
}) {
  const t = useTranslations('contacts');
  const tShared = useTranslations('masterData');

  const [form, setForm] = useState({
    name: contact?.name ?? '',
    contact_type: contact?.contact_type ?? 'customer',
    email: contact?.email ?? '',
    mobile: contact?.mobile ?? '',
    city: contact?.city ?? '',
    state: contact?.state ?? '',
    pincode: contact?.pincode ?? '',
    // Phase 0 Decision 2 provisions a login for any contact reachable by
    // email; §2.2 keeps the opt-out for one-off counterparties. The box
    // therefore starts ticked and can be cleared.
    portal_access_enabled: contact ? Boolean(contact.portal_access_enabled) : true,
  });
  const [localErrors, setLocalErrors] = useState([]);

  const set = (field) => (value) => setForm((current) => ({ ...current, [field]: value }));

  const typeOptions = useMemo(
    () => [
      { value: 'customer', label: t('types.customer') },
      { value: 'vendor', label: t('types.vendor') },
      { value: 'both', label: t('types.both') },
    ],
    [t],
  );

  const validate = () => {
    const errors = [];

    if (!form.name.trim()) errors.push(`${t('fields.name')} — ${tShared('form.required')}`);
    if (form.email.trim() && !EMAIL_PATTERN.test(form.email.trim())) {
      errors.push(t('fields.email'));
    }
    if (form.pincode.trim() && !PINCODE_PATTERN.test(form.pincode.trim())) {
      errors.push(`${t('fields.pincode')} — ${t('pincodeHint')}`);
    }

    setLocalErrors(errors);
    return errors.length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    const payload = {
      name: form.name.trim(),
      contact_type: form.contact_type,
      email: form.email.trim() || null,
      mobile: form.mobile.trim() || null,
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      pincode: form.pincode.trim() || null,
    };

    // The portal flag is only meaningful at creation. Afterwards, granting or
    // revoking a login is its own deliberate action on its own endpoint.
    if (!isEdit) payload.portal_access_enabled = Boolean(form.email.trim() && form.portal_access_enabled);

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
          as="select"
          label={t('fields.type')}
          value={form.contact_type}
          onChange={set('contact_type')}
          options={typeOptions}
        />

        <InputBox
          type="email"
          label={t('fields.email')}
          value={form.email}
          onChange={set('email')}
          placeholder={t('placeholders.email')}
        />

        <InputBox
          label={t('fields.mobile')}
          value={form.mobile}
          onChange={set('mobile')}
          placeholder={t('placeholders.mobile')}
        />

        <InputBox
          label={t('fields.city')}
          value={form.city}
          onChange={set('city')}
          placeholder={t('placeholders.city')}
        />

        <InputBox
          label={t('fields.state')}
          value={form.state}
          onChange={set('state')}
          placeholder={t('placeholders.state')}
        />

        <InputBox
          label={t('fields.pincode')}
          value={form.pincode}
          onChange={set('pincode')}
          placeholder={t('placeholders.pincode')}
          inputMode="numeric"
          maxLength={6}
        />
      </div>

      {!isEdit ? (
        <label className="md-check">
          <input
            type="checkbox"
            checked={form.portal_access_enabled}
            onChange={(event) => set('portal_access_enabled')(event.target.checked)}
            disabled={!form.email.trim()}
          />
          <span>
            <span className="md-check-label">{t('fields.portalAccess')}</span>
            <p className="md-check-hint">
              {form.email.trim() ? t('portal.description') : t('portal.needsEmail')}
            </p>
          </span>
        </label>
      ) : null}
    </FormShell>
  );
}
