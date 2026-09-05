'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Calendar } from 'lucide-react';

/**
 * DateRangePicker
 * Date range selector with accounting presets (This Month, This Quarter, This FY, Custom).
 *
 * @param {object} props
 * @param {string} [props.startDate] - YYYY-MM-DD
 * @param {string} [props.endDate] - YYYY-MM-DD
 * @param {function} props.onChange - ({ startDate, endDate, preset }) => void
 */
export default function DateRangePicker({
  startDate = '',
  endDate = '',
  onChange,
}) {
  const t = useTranslations('reports.toolbar');
  const [activePreset, setActivePreset] = useState('thisFY');

  const computePresetDates = (presetKey) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-indexed

    let start = new Date();
    let end = new Date();

    if (presetKey === 'thisMonth') {
      start = new Date(year, month, 1);
      end = new Date(year, month + 1, 0);
    } else if (presetKey === 'thisQuarter') {
      const qStartMonth = Math.floor(month / 3) * 3;
      start = new Date(year, qStartMonth, 1);
      end = new Date(year, qStartMonth + 3, 0);
    } else if (presetKey === 'thisFY') {
      // Indian FY starts April 1 (month index 3)
      const fyStartYear = month >= 3 ? year : year - 1;
      start = new Date(fyStartYear, 3, 1);
      end = new Date(fyStartYear + 1, 2, 31);
    }

    const toYMD = (d) => d.toISOString().split('T')[0];
    return {
      startDate: toYMD(start),
      endDate: toYMD(end),
    };
  };

  const handlePresetClick = (presetKey) => {
    setActivePreset(presetKey);
    if (presetKey !== 'custom') {
      const dates = computePresetDates(presetKey);
      if (onChange) {
        onChange({ ...dates, preset: presetKey });
      }
    }
  };

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem',
          background: 'var(--bg-base)',
          padding: '0.2rem',
          borderRadius: '8px',
          boxShadow: 'inset 1px 1px 3px var(--nm-inset-dark), inset -1px -1px 3px var(--nm-inset-light)',
        }}
      >
        <button
          type="button"
          onClick={() => handlePresetClick('thisMonth')}
          className={`pagination-btn ${activePreset === 'thisMonth' ? 'active' : ''}`}
          style={{ height: '30px', fontSize: '0.75rem', padding: '0 0.6rem' }}
        >
          {t('thisMonth')}
        </button>

        <button
          type="button"
          onClick={() => handlePresetClick('thisQuarter')}
          className={`pagination-btn ${activePreset === 'thisQuarter' ? 'active' : ''}`}
          style={{ height: '30px', fontSize: '0.75rem', padding: '0 0.6rem' }}
        >
          {t('thisQuarter')}
        </button>

        <button
          type="button"
          onClick={() => handlePresetClick('thisFY')}
          className={`pagination-btn ${activePreset === 'thisFY' ? 'active' : ''}`}
          style={{ height: '30px', fontSize: '0.75rem', padding: '0 0.6rem' }}
        >
          {t('thisFY')}
        </button>

        <button
          type="button"
          onClick={() => handlePresetClick('custom')}
          className={`pagination-btn ${activePreset === 'custom' ? 'active' : ''}`}
          style={{ height: '30px', fontSize: '0.75rem', padding: '0 0.6rem' }}
        >
          {t('custom')}
        </button>
      </div>

      {activePreset === 'custom' && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
          <Calendar size={14} style={{ color: 'var(--text-secondary)' }} />
          <input
            type="date"
            className="form-input"
            value={startDate}
            onChange={(e) => onChange && onChange({ startDate: e.target.value, endDate, preset: 'custom' })}
            style={{ width: '130px', height: '30px', padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
          />
          <span style={{ color: 'var(--text-muted)' }}>–</span>
          <input
            type="date"
            className="form-input"
            value={endDate}
            onChange={(e) => onChange && onChange({ startDate, endDate: e.target.value, preset: 'custom' })}
            style={{ width: '130px', height: '30px', padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
          />
        </div>
      )}
    </div>
  );
}
