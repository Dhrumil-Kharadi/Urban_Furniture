'use client';

import React from 'react';
import BasePicker from './BasePicker';

/**
 * JournalPicker
 * Server-searched picker for accounting journals (Sales, Purchase, Bank, Cash, General).
 *
 * @param {object} props
 * @param {string|object} props.value
 * @param {function} props.onChange
 * @param {string} [props.type] - Optional filter by journal type ('sales' | 'purchase' | 'bank' | 'cash')
 * @param {boolean} [props.disabled=false]
 */
export default function JournalPicker({
  value,
  onChange,
  type,
  disabled = false,
}) {
  return (
    <BasePicker
      endpoint="/journals"
      value={value}
      onChange={onChange}
      placeholder="Select accounting journal…"
      extraParams={type ? { type } : {}}
      disabled={disabled}
      getOptionLabel={(j) => `${j.code} — ${j.name}`}
      renderOption={(j) => (
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
              {j.code}
            </span>
            <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{j.name}</span>
          </div>
          <span
            style={{
              fontSize: '0.7rem',
              padding: '0.1rem 0.4rem',
              borderRadius: '4px',
              backgroundColor: 'var(--dash-badge-bg)',
              color: 'var(--dash-badge-text)',
              textTransform: 'capitalize',
            }}
          >
            {j.type}
          </span>
        </div>
      )}
    />
  );
}
