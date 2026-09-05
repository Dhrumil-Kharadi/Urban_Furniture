'use client';

/**
 * @file ReportTable Component
 * @spec Doc/project.md §6, Doc/phase.md Phase 11
 * 
 * Financial statement table card with Frozen Lake neumorphic styling.
 */

import React from 'react';
import { MoneyText } from '@/components/masterdata/Cells';

export default function ReportTable({ title, rows = [], grandTotal = null, emptyText = 'No report data available for this period.' }) {
  return (
    <div className="report-sheet-card">
      {title && (
        <div className="report-section-bar">
          <h2 className="report-section-title">{title}</h2>
        </div>
      )}

      <div className="report-table-wrap">
        <table className="report-table">
          <thead>
            <tr>
              <th className="report-code-col">Account Code</th>
              <th className="report-name-col">Account Name</th>
              <th className="report-amount-col">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="report-empty-cell" style={{ padding: '2rem', textAlign: 'center' }}>
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((r, idx) => (
                <tr key={r.code || idx}>
                  <td className="report-code-col">{r.code || '—'}</td>
                  <td className="report-name-col">{r.name || r.account_name}</td>
                  <td className="report-amount-col">
                    <MoneyText value={r.amount || r.balance || 0} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {grandTotal !== null && (
        <div className="report-totals-footer">
          <span>Total {title}</span>
          <span style={{ color: 'var(--accent-primary)' }}>
            ₹{Number(grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>
      )}
    </div>
  );
}
