/**
 * @file Reports Hub / Dashboard Page
 * @route /dashboard/reports
 * @spec Doc/project.md §6, Doc/phase.md Phase 11
 * 
 * REQUIREMENTS & SPECIFICATION:
 * - Financial reports center for Admin and Accountant roles.
 * - Quick cards navigating to:
 *   1. Balance Sheet (Assets, Liabilities, Capital as of date)
 *   2. Profit & Loss (Sales Income - Expenses = Net Profit for period)
 *   3. Budget Report (Planned vs Actual variance per Analytic Account)
 *   4. Trial Balance (Debit vs Credit balance per account)
 *   5. General Ledger (Account-wise transaction book)
 *   6. Partner Ledger (Customer & Vendor statements)
 *   7. Aged Receivables & Payables (30/60/90+ days aging buckets)
 */

export default function ReportsHubPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Financial Reports</h1>
      <p className="text-gray-500 mt-2">Access real-time balance sheet, profit & loss, budget analysis, and ledger reports.</p>
    </div>
  );
}
