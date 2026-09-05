'use client';

import React from 'react';
import { useLocale } from 'next-intl';
import { formatMoney } from '@/utils/format';

/**
 * MoneyText
 * Renders right-aligned, tabular-figure, locale-formatted monetary values.
 *
 * @param {object} props
 * @param {string|number} props.amount - Numeric or decimal string
 * @param {string} [props.currency='INR']
 * @param {string} [props.className='']
 * @param {object} [props.style]
 */
export default function MoneyText({ amount, currency = 'INR', className = '', style = {} }) {
  const locale = useLocale();
  const formatted = formatMoney(amount, locale, currency);

  return (
    <span
      className={className}
      style={{
        fontFamily: "'Orbitron', monospace",
        fontVariantNumeric: 'tabular-nums',
        textAlign: 'right',
        display: 'inline-block',
        ...style,
      }}
    >
      {formatted}
    </span>
  );
}
