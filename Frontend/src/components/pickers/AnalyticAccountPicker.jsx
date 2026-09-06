'use client';

import React from 'react';
import BasePicker from './BasePicker';

/**
 * AnalyticAccountPicker
 * Server-searched picker for cost centers and projects.
 *
 * @param {object} props
 * @param {string|object} props.value
 * @param {function} props.onChange
 * @param {boolean} [props.disabled=false]
 */
export default function AnalyticAccountPicker({
  value,
  onChange,
  disabled = false,
}) {
  return (
    <BasePicker
      endpoint="/analytic-accounts"
      value={value}
      onChange={onChange}
      placeholder="Select analytic account / cost center…"
      disabled={disabled}
      getOptionLabel={(a) => (a.code ? `${a.code} — ${a.name}` : a.name)}
      renderOption={(a) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            {a.code && (
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
            )}
            <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{a.name}</span>
          </div>
          {a.department && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {a.department}
            </span>
          )}
        </div>
      )}
    />
  );
}
