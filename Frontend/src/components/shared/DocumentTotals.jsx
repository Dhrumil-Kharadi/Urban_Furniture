'use client';

import React from 'react';
import { formatMoney } from '@/utils/format';
import { useLocale } from 'next-intl';

/**
 * DocumentTotals Component
 *
 * Summary calculations card displaying:
 * - Untaxed Amount (Subtotal)
 * - Tax Amount
 * - Total Amount (Grand Total)
 * - Optional: Amount Paid, Amount Due (for Bills / Invoices)
 *
 * Uses Frozen Lake design tokens and pure Vanilla CSS.
 */
export default function DocumentTotals({
  untaxedAmount = 0,
  taxAmount = 0,
  totalAmount = 0,
  amountPaid,
  amountDue,
}) {
  const locale = useLocale();

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '320px',
        marginLeft: 'auto',
        background: 'var(--bg-raised)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '12px',
        padding: '1rem 1.25rem',
        boxShadow: '4px 4px 10px var(--nm-shadow-dark), -2px -2px 6px var(--nm-shadow-light)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.6rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
        <span>Untaxed Subtotal:</span>
        <span style={{ fontFamily: 'Orbitron, monospace', fontWeight: 600, color: 'var(--text-primary)' }}>
          {formatMoney(untaxedAmount, locale)}
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
        <span>Taxes & GST:</span>
        <span style={{ fontFamily: 'Orbitron, monospace', fontWeight: 600, color: 'var(--text-primary)' }}>
          {formatMoney(taxAmount, locale)}
        </span>
      </div>

      <div
        style={{
          borderTop: '2px solid var(--dash-divider)',
          paddingTop: '0.6rem',
          marginTop: '0.2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontFamily: 'Orbitron, monospace',
          fontWeight: 700,
          fontSize: '1.05rem',
          color: 'var(--text-primary)',
        }}
      >
        <span>Total:</span>
        <span style={{ color: 'var(--accent-primary)' }}>
          {formatMoney(totalAmount, locale)}
        </span>
      </div>

      {amountPaid !== undefined && (
        <div style={{ borderTop: '1px solid var(--dash-divider)', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          <span>Amount Paid:</span>
          <span style={{ fontFamily: 'Orbitron, monospace', fontWeight: 600, color: '#10b981' }}>
            {formatMoney(amountPaid, locale)}
          </span>
        </div>
      )}

      {amountDue !== undefined && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', fontWeight: 600, color: '#f59e0b' }}>
          <span>Amount Due:</span>
          <span style={{ fontFamily: 'Orbitron, monospace', fontWeight: 700 }}>
            {formatMoney(amountDue, locale)}
          </span>
        </div>
      )}
    </div>
  );
}
