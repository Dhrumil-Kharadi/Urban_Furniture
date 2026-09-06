'use client';

// ============================================================
// FILE: src/components/products/ProductForm.jsx
//
// Create / edit form for a Product (project.md §4.2).
//
// MONEY: prices are held and submitted as STRINGS. They are never parsed into
// a Number here, and nothing on this page adds them up — the server owns every
// computed amount. A price input that quietly becomes a float is how a
// catalogue starts disagreeing with its invoices.
//
// Editing is admin-only on the server (project.md §3: only the business owner
// may change a price). This form is simply not reachable for a manager.
// ============================================================

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import InputBox from '@/reusablefiles/inputbox';
import FormShell from '@/components/masterdata/FormShell';
import TaxPicker from '@/components/pickers/TaxPicker';
import { productCategoriesService } from '@/services/masterdata.service';
import { getCachedRequest } from '@/lib/requestCache';

/** A price the server will accept: up to 13 digits, up to 2 decimals. */
const PRICE_PATTERN = /^\d{1,13}(\.\d{1,2})?$/;

/**
 * @param {object}   [props.product]
 * @param {boolean}  [props.isEdit]
 * @param {Function} props.onSubmit
 * @param {string}   props.cancelHref
 * @param {string[]} [props.serverErrors]
 * @param {boolean}  [props.submitting]
 */
export default function ProductForm({
  product = null,
  isEdit = false,
  onSubmit,
  cancelHref,
  serverErrors = [],
  submitting = false,
}) {
  const t = useTranslations('products');
  const tShared = useTranslations('masterData');

  const [form, setForm] = useState({
    name: product?.name ?? '',
    sku: product?.sku ?? '',
    product_type: product?.product_type ?? 'goods',
    category_id: product?.category_id ?? '',
    description: product?.description ?? '',
    available_qty: product?.available_qty !== undefined ? String(product.available_qty) : '0',
    sales_price: product?.sales_price ?? '0.00',
    cost_price: product?.cost_price ?? '0.00',
    sales_tax_id: product?.sales_tax_id ?? null,
    purchase_tax_id: product?.purchase_tax_id ?? null,
  });
  const [localErrors, setLocalErrors] = useState([]);
  const [categories, setCategories] = useState([]);

  const set = (field) => (value) => setForm((current) => ({ ...current, [field]: value }));

  // The category picker only ever offers active categories in this tenant —
  // the list endpoint is already scoped, so there is nothing to filter here.
  useEffect(() => {
    const controller = new AbortController();
    let ignore = false;

    (async () => {
      try {
        const data = await getCachedRequest(
          'product-form:categories:active:100:name',
          () => productCategoriesService.list({ status: 'active', limit: 100, sortBy: 'name' }),
        );
        if (!ignore) setCategories(data?.items ?? []);
      } catch {
        // A picker that fails to load leaves the field optional and empty,
        // which is a worse form but not a broken page.
      }
    })();

    return () => {
      ignore = true;
      controller.abort();
    };
  }, []);

  const typeOptions = useMemo(
    () => [
      { value: 'goods', label: t('types.goods') },
      { value: 'service', label: t('types.service') },
      { value: 'combo', label: t('types.combo') },
    ],
    [t],
  );

  const categoryOptions = useMemo(
    () => [
      { value: '', label: tShared('filters.none') },
      ...categories.map((category) => ({ value: category.id, label: category.name })),
    ],
    [categories, tShared],
  );

  const validate = () => {
    const errors = [];

    if (!form.name.trim()) errors.push(`${t('fields.name')} — ${tShared('form.required')}`);

    for (const [field, label] of [
      ['sales_price', t('fields.salesPrice')],
      ['cost_price', t('fields.costPrice')],
    ]) {
      const value = String(form[field]).trim();
      if (value && !PRICE_PATTERN.test(value)) errors.push(label);
    }

    if (form.available_qty !== '') {
      const num = Number(form.available_qty);
      if (Number.isNaN(num) || num < 0) {
        errors.push('Available quantity must be a non-negative number');
      }
    }

    setLocalErrors(errors);
    return errors.length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    onSubmit({
      name: form.name.trim(),
      sku: form.sku.trim() || null,
      product_type: form.product_type,
      category_id: form.category_id || null,
      description: form.description.trim() || null,
      available_qty: String(form.available_qty).trim() || '0',
      sales_price: String(form.sales_price).trim() || '0',
      cost_price: String(form.cost_price).trim() || '0',
      sales_tax_id: form.sales_tax_id || null,
      purchase_tax_id: form.purchase_tax_id || null,
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
            as="textarea"
            label={t('fields.description')}
            value={form.description}
            onChange={set('description')}
            placeholder={t('placeholders.description')}
            rows={2}
          />
        </div>

        <InputBox
          label={t('fields.sku')}
          value={form.sku}
          onChange={set('sku')}
          placeholder={t('placeholders.sku')}
        />

        <InputBox
          as="select"
          label={t('fields.type')}
          value={form.product_type}
          onChange={set('product_type')}
          options={typeOptions}
        />

        <InputBox
          as="select"
          label={t('fields.category')}
          value={form.category_id}
          onChange={set('category_id')}
          options={categoryOptions}
        />

        <InputBox
          label="Available Quantity (Stock)"
          value={form.available_qty}
          onChange={set('available_qty')}
          placeholder="0"
          type="number"
          min="0"
          step="any"
        />

        <InputBox
          label={t('fields.salesPrice')}
          value={form.sales_price}
          onChange={set('sales_price')}
          placeholder={t('placeholders.price')}
          inputMode="decimal"
        />

        <InputBox
          label={t('fields.costPrice')}
          value={form.cost_price}
          onChange={set('cost_price')}
          placeholder={t('placeholders.price')}
          inputMode="decimal"
        />

        <div>
          <label className="ui-field-label" style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.82rem', fontWeight: 600 }}>
            {t('fields.salesTax')} (Customer Invoices)
          </label>
          <TaxPicker
            value={form.sales_tax_id}
            onChange={(tax) => set('sales_tax_id')(tax ? tax.id : null)}
            scope="sales"
          />
        </div>

        <div>
          <label className="ui-field-label" style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.82rem', fontWeight: 600 }}>
            {t('fields.purchaseTax')} (Vendor Bills)
          </label>
          <TaxPicker
            value={form.purchase_tax_id}
            onChange={(tax) => set('purchase_tax_id')(tax ? tax.id : null)}
            scope="purchase"
          />
        </div>
      </div>

      <p className="md-form-hint">{t('priceNote')}</p>

      {form.product_type === 'combo' ? (
        <p className="md-form-hint">{t('comboNote')}</p>
      ) : null}
    </FormShell>
  );
}
