'use client';

// ============================================================
// FILE: src/components/product-categories/CategoryForm.jsx
//
// Create / edit form for a product category.
// ============================================================

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';

import InputBox from '@/reusablefiles/inputbox';
import FormShell from '@/components/masterdata/FormShell';

/**
 * @param {object}   [props.category]
 * @param {boolean}  [props.isEdit]
 * @param {Function} props.onSubmit
 * @param {string}   props.cancelHref
 * @param {string[]} [props.serverErrors]
 * @param {boolean}  [props.submitting]
 */
export default function CategoryForm({
  category = null,
  isEdit = false,
  onSubmit,
  cancelHref,
  serverErrors = [],
  submitting = false,
}) {
  const t = useTranslations('productCategories');
  const tShared = useTranslations('masterData');

  const [form, setForm] = useState({
    name: category?.name ?? '',
    description: category?.description ?? '',
  });
  const [localErrors, setLocalErrors] = useState([]);

  const set = (field) => (value) => setForm((current) => ({ ...current, [field]: value }));

  const handleSubmit = () => {
    const errors = [];
    if (!form.name.trim()) errors.push(`${t('fields.name')} — ${tShared('form.required')}`);

    setLocalErrors(errors);
    if (errors.length > 0) return;

    onSubmit({
      name: form.name.trim(),
      description: form.description.trim() || null,
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

        <div className="is-full">
          <InputBox
            label={t('fields.description')}
            value={form.description}
            onChange={set('description')}
            placeholder={t('placeholders.description')}
          />
        </div>
      </div>
    </FormShell>
  );
}
