'use client';

import React from 'react';
import { useLocale } from 'next-intl';
import { formatDate } from '@/utils/format';

/**
 * DateText
 * Renders localized human-readable dates.
 *
 * @param {object} props
 * @param {string|Date} props.date
 * @param {object} [props.options]
 * @param {string} [props.className='']
 */
export default function DateText({ date, options = {}, className = '' }) {
  const locale = useLocale();
  const formatted = formatDate(date, locale, options);

  return (
    <span
      className={className}
      style={{
        fontFamily: "'Sora', sans-serif",
      }}
    >
      {formatted}
    </span>
  );
}
