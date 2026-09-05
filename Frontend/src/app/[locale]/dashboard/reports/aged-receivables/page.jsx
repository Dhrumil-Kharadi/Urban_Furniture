/**
 * @file Aged Receivables (Debtors Aging) Report Page
 * @route /dashboard/reports/aged-receivables
 * @spec Doc/project.md §6, Doc/phase.md Phase 11
 * 
 * REQUIREMENTS & SPECIFICATION:
 * - Outstanding customer invoice balances grouped by aging buckets:
 *   - Current (0-30 days)
 *   - 31-60 days
 *   - 61-90 days
 *   - 90+ days overdue
 */

export default function AgedReceivablesReportPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Aged Receivables</h1>
      <p className="text-gray-500 mt-2">Customer overdue balances categorized by aging buckets.</p>
    </div>
  );
}
