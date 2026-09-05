/**
 * @file Customer Invoices List Page
 * @route /dashboard/customer-invoices
 * @spec Doc/project.md §5.2, §7.1, Doc/phase.md Phase 9
 * 
 * REQUIREMENTS & SPECIFICATION:
 * - List all Customer Invoices (Accounts Receivable).
 * - Columns: Invoice # (e.g. INV/2026/00001), Date, Due Date, Customer, Amount, Tax, Balance Due, Status.
 * - Status Lifecycle: Draft -> Posted -> Partially Paid -> Paid -> Overdue.
 * - Double-Entry Integration: Posting creates Dr Debtors, Cr Sales Income, Cr Output Tax Payable.
 * - Actions: New Invoice, Receive Payment, Send Portal Link.
 */

export default function CustomerInvoicesPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Customer Invoices</h1>
      <p className="text-gray-500 mt-2">Manage customer invoices, output tax, and accounts receivable.</p>
    </div>
  );
}
