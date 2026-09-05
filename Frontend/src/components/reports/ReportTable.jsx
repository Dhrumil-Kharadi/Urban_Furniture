'use client';

/**
 * @file ReportTable Component
 * @spec Doc/project.md §6, Doc/phase.md Phase 11
 * 
 * PROMPT & IMPLEMENTATION GUIDELINES:
 * - Financial statement tree/hierarchical grid.
 * - Handles nested account groups with collapsible headers.
 * - Highlights subtotals and grand totals with accounting format (₹ 1,23,456.00).
 */

export default function ReportTable({ title, sections = [], grandTotal = null }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
      <div className="p-4 bg-gray-50 border-b font-semibold text-gray-800">{title}</div>
      <div className="p-4 text-gray-400 text-center">No report data generated yet.</div>
    </div>
  );
}
