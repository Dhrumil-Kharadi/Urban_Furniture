'use client';

/**
 * @file ReportFilterBar Component
 * @spec Doc/project.md §6, Doc/phase.md Phase 11
 * 
 * PROMPT & IMPLEMENTATION GUIDELINES:
 * - Unified filter bar across all financial reports.
 * - Controls:
 *   - Date Mode: 'As of Date' (for Balance Sheet) or 'Date Range' (for P&L / General Ledger).
 *   - Quick presets: 'This Fiscal Year', 'Last Fiscal Year', 'This Month', 'This Quarter', 'Custom Range'.
 *   - Compare with Previous Period toggle.
 *   - Analytic Account / Department filter.
 */

export default function ReportFilterBar({ filters, onFilterChange, showRange = true }) {
  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200 mb-6 flex flex-wrap gap-4 items-center justify-between shadow-sm">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-gray-700">Period:</span>
        <input type="date" className="border rounded px-3 py-1.5 text-sm" />
      </div>
    </div>
  );
}
