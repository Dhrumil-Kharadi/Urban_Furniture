'use client';

/**
 * @file VendorBillForm Component
 * @spec Doc/project.md §5.1, §7.2, Doc/phase.md Phase 8
 * 
 * PROMPT & IMPLEMENTATION GUIDELINES:
 * - Vendor Bill recording form (with double-entry ledger integration).
 * - On Post: Invokes backend posting template §5.3:
 *   - Debit: Purchase Expense Account
 *   - Debit: Input Tax Credit Account (tax asset)
 *   - Credit: Accounts Payable (Creditors liability)
 * - Validation: Validates all selected accounts are active and same-tenant.
 */

export default function VendorBillForm({ initialData = null, onSubmit, isReadOnly = false }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <h2 className="text-xl font-semibold mb-4">Vendor Bill Form</h2>
      <p className="text-gray-500">Record vendor bill lines and accounts payable postings.</p>
    </div>
  );
}
