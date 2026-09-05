'use client';

/**
 * @file CustomerInvoiceForm Component
 * @spec Doc/project.md §5.2, §7.1, Doc/phase.md Phase 9
 * 
 * PROMPT & IMPLEMENTATION GUIDELINES:
 * - Customer Invoice form generating immutable double-entry journal entries.
 * - On Post:
 *   - Debit: Accounts Receivable (Debtors asset)
 *   - Credit: Sales Income Account
 *   - Credit: Output Tax Payable (tax liability)
 * - Output tax is NEVER folded into sales income.
 */

export default function CustomerInvoiceForm({ initialData = null, onSubmit, isReadOnly = false }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <h2 className="text-xl font-semibold mb-4">Customer Invoice Form</h2>
      <p className="text-gray-500">Create invoice and post accounts receivable double-entry transactions.</p>
    </div>
  );
}
