'use client';

/**
 * @file ReportFilterBar Component
 * @spec Doc/project.md §6, Doc/phase.md Phase 11
 * 
 * Unified filter bar for financial reports with Frozen Lake neumorphic styling.
 */

import React from 'react';
import { Calendar } from 'lucide-react';

export default function ReportFilterBar({
  dates = { fromDate: '', toDate: '' },
  onChange,
  showRange = true,
  extraActions = null,
}) {
  return (
    <div className="report-toolbar">
      <div className="report-date-input">
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Calendar size={12} /> {showRange ? 'From Date' : 'As of Date'}
        </span>
        <input
          type="date"
          value={dates.fromDate}
          onChange={(e) => onChange?.({ ...dates, fromDate: e.target.value })}
        />
      </div>

      {showRange && (
        <>
          <span style={{ fontFamily: 'Sora, sans-serif', fontSize: '0.8rem', color: 'var(--text-secondary)', alignSelf: 'center', marginTop: '16px' }}>
            to
          </span>
          <div className="report-date-input">
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Calendar size={12} /> To Date
            </span>
            <input
              type="date"
              value={dates.toDate}
              onChange={(e) => onChange?.({ ...dates, toDate: e.target.value })}
            />
          </div>
        </>
      )}

      {extraActions}
    </div>
  );
}
