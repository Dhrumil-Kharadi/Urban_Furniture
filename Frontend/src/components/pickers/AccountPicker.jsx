'use client';

import React from 'react';
import BasePicker from './BasePicker';

/**
 * AccountPicker
 * Server-searched picker for Chart of Accounts (GL Accounts).
 *
 * @param {object} props
 * @param {string|object} props.value
 * @param {function} props.onChange
 * @param {string} [props.type] - Optional filter by account type ('asset', 'liability', 'income', 'expense')
 * @param {boolean} [props.disabled=false]
 */
export default function AccountPicker({
  value,
  onChange,
  type,
  disabled = false,
}) {
  return (
    <BasePicker
      endpoint="/accounts"
      value={value}
      onChange={onChange}
      placeholder="Select general ledger account…"
      extraParams={type ? { type } : {}}
      disabled={disabled}
      getOptionLabel={(a) => `${a.code} — ${a.name}`}
      renderOption={(a) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span
              style={{
                fontFamily: "'Orbitron', monospace",
                fontWeight: 600,
                color: 'var(--accent-primary)',
                marginRight: '0.5rem',
              }}
            >
              {a.code}
            </span>
            <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{a.name}</span>
          </div>
          <span
            style={{
              fontSize: '0.7rem',
              padding: '0.1rem 0.4rem',
              borderRadius: '4px',
              backgroundColor: 'var(--dash-badge-bg)',
              color: 'var(--dash-badge-text)',
              textTransform: 'uppercase',
            }}
          >
            {a.type}
          </span>
        </div>
      )}
    />
  );
}
