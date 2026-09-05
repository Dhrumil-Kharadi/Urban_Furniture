'use client';

import React from 'react';
import BasePicker from './BasePicker';

/**
 * TaxPicker
 * Server-searched picker for tax rates (sales, purchase, or both).
 *
 * @param {object} props
 * @param {string|object} props.value
 * @param {function} props.onChange
 * @param {string} [props.scope] - Optional scope filter ('sales' | 'purchase')
 * @param {boolean} [props.disabled=false]
 */
export default function TaxPicker({
  value,
  onChange,
  scope,
  disabled = false,
}) {
  return (
    <BasePicker
      endpoint="/taxes"
      value={value}
      onChange={onChange}
      placeholder="Select tax rate…"
      extraParams={scope ? { scope } : {}}
      disabled={disabled}
      getOptionLabel={(t) => `${t.name} (${t.rate}%)`}
      renderOption={(t) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{t.name}</span>
          <span
            style={{
              fontFamily: "'Orbitron', monospace",
              fontSize: '0.82rem',
              fontWeight: 600,
              color: 'var(--accent-primary)',
            }}
          >
            {t.rate}%
          </span>
        </div>
      )}
    />
  );
}
