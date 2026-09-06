'use client';

// ============================================================
// FILE: src/components/journal-entries/EntryTotals.jsx
//
// The running totals footer.
//
// It states three numbers — total debit, total credit, and the difference —
// and says plainly whether the entry can be posted. Showing only the two
// totals and leaving the reader to subtract them is how a one-paisa error
// survives to the ledger.
//
// The arithmetic is exact integer paise (see lib/minorUnits.js). The server
// re-checks it through decimal.js and the database re-checks it again in a
// deferrable trigger, so this is fast feedback, not the rule.
// ============================================================

import React from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { fromMinorUnits } from '@/lib/minorUnits';

/**
 * @param {number} props.totalDebitMinor
 * @param {number} props.totalCreditMinor
 * @param {boolean} [props.showState=true]
 */
export default function EntryTotals({ totalDebitMinor, totalCreditMinor, showState = true }) {
  const t = useTranslations('journalEntries');
  const locale = useLocale();

  const differenceMinor = totalDebitMinor - totalCreditMinor;
  const balanced = differenceMinor === 0;

  const bcpLocale = locale === 'hi' ? 'hi-IN' : locale === 'gu' ? 'gu-IN' : 'en-IN';

  const format = (minor) =>
    new Intl.NumberFormat(bcpLocale, {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(fromMinorUnits(minor)));

  return (
    <div className={`md-entry-totals${balanced ? '' : ' is-unbalanced'}`}>
      <div className="md-total-item">
        <span className="md-total-label">{t('totals.debit')}</span>
        <span className="md-total-value">{format(totalDebitMinor)}</span>
      </div>

      <div className="md-total-item">
        <span className="md-total-label">{t('totals.credit')}</span>
        <span className="md-total-value">{format(totalCreditMinor)}</span>
      </div>

      <div className="md-total-item">
        <span className="md-total-label">{t('totals.difference')}</span>
        <span className={`md-total-value${balanced ? '' : ' is-off'}`}>
          {format(differenceMinor)}
        </span>
      </div>

      {showState ? (
        <span
          className={`md-total-state ${balanced ? 'is-balanced' : 'is-unbalanced'}`}
          role="status"
          aria-live="polite"
        >
          <i className="md-total-dot" aria-hidden="true" />
          {balanced ? t('totals.balanced') : t('totals.unbalanced')}
        </span>
      ) : null}
    </div>
  );
}
