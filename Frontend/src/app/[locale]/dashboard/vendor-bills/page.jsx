/**
 * @file Vendor Bills List Page
 * @route /dashboard/vendor-bills
 * @spec Doc/project.md §5.1, §7.2, Doc/phase.md Phase 8
 * 
 * REQUIREMENTS & SPECIFICATION:
 * - List all Vendor Bills (Accounts Payable).
 * - Columns: Bill # (e.g. BILL/2026/00001), Bill Date, Due Date, Vendor, PO Ref, Total, Balance Due, Status.
 * - Status Lifecycle: Draft -> Posted -> Partially Paid -> Paid -> Overdue.
 * - Double-Entry Integration: Posting triggers Journal Entry (Dr Purchase Expense, Dr Input Tax, Cr Creditors).
 * - Filters: Vendor, Status, Date Range, Overdue only toggle.
 * - Actions: New Bill, Register Payment modal for unpaid bills.
 */

export default function VendorBillsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Vendor Bills</h1>
      <p className="text-gray-500 mt-2">Manage vendor invoices, double-entry expense postings, and payments.</p>
    </div>
  );
}
