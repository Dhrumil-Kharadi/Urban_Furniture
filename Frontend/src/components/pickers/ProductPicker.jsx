'use client';

import React from 'react';
import BasePicker from './BasePicker';
import { formatMoney } from '@/utils/format';
import { useLocale } from 'next-intl';

/**
 * ProductPicker
 * Server-searched picker for products, displaying SKU, category, and sales/cost price.
 *
 * @param {object} props
 * @param {string|object} props.value
 * @param {function} props.onChange
 * @param {string} [props.priceType='salesPrice'] - 'salesPrice' | 'costPrice'
 * @param {boolean} [props.disabled=false]
 */
export default function ProductPicker({
  value,
  onChange,
  priceType = 'salesPrice',
  disabled = false,
}) {
  const locale = useLocale();

  return (
    <BasePicker
      endpoint="/products"
      value={value}
      onChange={onChange}
      placeholder="Select product / item…"
      disabled={disabled}
      getOptionLabel={(p) => p.name}
      renderOption={(p) => {
        const price = priceType === 'costPrice' ? p.cost_price : p.sales_price;
        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</span>
              {p.sku && (
                <span
                  style={{
                    fontFamily: "'Orbitron', monospace",
                    fontSize: '0.7rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  SKU: {p.sku}
                </span>
              )}
            </div>
            {price !== undefined && (
              <span
                style={{
                  fontFamily: "'Orbitron', monospace",
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: 'var(--accent-primary)',
                }}
              >
                {formatMoney(price, locale)}
              </span>
            )}
          </div>
        );
      }}
    />
  );
}
