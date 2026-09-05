'use client';

import React from 'react';
import BasePicker from './BasePicker';

/**
 * ContactPicker
 * Server-searched picker for customers, vendors, and partners.
 *
 * @param {object} props
 * @param {string|object} props.value
 * @param {function} props.onChange
 * @param {string} [props.type] - Optional filter by type ('customer' | 'vendor')
 * @param {boolean} [props.disabled=false]
 */
export default function ContactPicker({
  value,
  onChange,
  type,
  disabled = false,
}) {
  return (
    <BasePicker
      endpoint="/contacts"
      value={value}
      onChange={onChange}
      placeholder="Select partner / contact…"
      extraParams={type ? { type } : {}}
      disabled={disabled}
      getOptionLabel={(c) => `${c.name}${c.city ? ` (${c.city})` : ''}`}
      renderOption={(c) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</span>
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
              {c.type}
            </span>
          </div>
          {c.email && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {c.email}
            </span>
          )}
        </div>
      )}
    />
  );
}
