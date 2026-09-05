'use client';

// ============================================================
// FILE: src/components/masterdata/Cells.jsx
//
// Small presentational pieces the master-data tables and detail pages share.
//
// MONEY: the backend sends every amount as a STRING, because NUMERIC values
// lose precision the moment they become a JavaScript number. Nothing in this
// file does arithmetic on one — `MoneyText` formats the string for display and
// that is all. If a total is ever needed on screen, the server computes it.
// ============================================================

import React from 'react';
import { useLocale } from 'next-intl';
import Pill from '@/reusablefiles/pill';

/**
 * Format a NUMERIC-as-string amount for the active locale.
 *
 * Intl.NumberFormat is fed a Number only at the final display step, after all
 * arithmetic is already done and committed server-side, so no computed value
 * ever passes through a float.
 *
 * @param {string|number|null} value
 * @param {string} [currency='INR'] - Single currency per Phase 0 Decision 5.
 */
export function MoneyText({ value, currency = 'INR' }) {
  const locale = useLocale();

  if (value === null || value === undefined || value === '') return <span>—</span>;

  const formatted = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));

  return <span className="md-cell-money">{formatted}</span>;
}

/**
 * Active / archived chip. Meaning is carried by the label and the dot, not by
 * hue — the palette has no red or green to spend on it.
 *
 * @param {string} status - 'active' | 'archived'
 * @param {string} label  - Already translated.
 */
export function StatusPill({ status, label }) {
  return (
    <Pill tone={status === 'active' ? 'strong' : 'soft'} size="sm" dot>
      {label}
    </Pill>
  );
}

/**
 * One label/value pair on a detail page.
 *
 * @param {string} label
 * @param {React.ReactNode} children
 * @param {boolean} [money] - Render the value with tabular figures.
 */
export function Fact({ label, children, money = false }) {
  return (
    <div>
      <p className="md-fact-label">{label}</p>
      <p className={`md-fact-value${money ? ' is-money' : ''}`}>
        {children === null || children === undefined || children === '' ? '—' : children}
      </p>
    </div>
  );
}

/** A value that may be absent, rendered consistently as an em dash. */
export function Maybe({ value }) {
  return <span className={value ? undefined : 'md-cell-muted'}>{value || '—'}</span>;
}
