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
        const stock = Number(p.available_qty || 0);
        const taxRate = priceType === 'costPrice' ? p.purchase_tax_rate : p.sales_tax_rate;

        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.15rem' }}>
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
                {p.product_type === 'goods' && (
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      padding: '0.1rem 0.35rem',
                      borderRadius: '4px',
                      background: stock <= 0 ? 'rgba(239, 68, 68, 0.15)' : stock <= 5 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                      color: stock <= 0 ? '#ef4444' : stock <= 5 ? '#f59e0b' : '#10b981',
                    }}
                  >
                    {stock <= 0 ? 'Out of Stock (0)' : `Stock: ${stock}`}
                  </span>
                )}
                {taxRate !== undefined && taxRate !== null && (
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    GST: {taxRate}%
                  </span>
                )}
              </div>
            </div>
            {price !== undefined && (
              <span
                style={{
                  fontFamily: "'Orbitron', monospace",
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: 'var(--accent-primary)',
                  whiteSpace: 'nowrap',
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
