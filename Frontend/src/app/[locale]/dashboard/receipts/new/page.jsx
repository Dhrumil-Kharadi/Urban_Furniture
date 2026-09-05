/**
 * @file Record Customer Receipt Page
 * @route /dashboard/receipts/new
 * @spec Doc/project.md §5.2, Doc/phase.md Phase 10
 * 
 * REQUIREMENTS & SPECIFICATION:
 * - Record customer receipt and allocate against unpaid customer invoices.
 * - Double-entry posting: Dr Bank/Cash account, Cr Accounts Receivable (Debtors).
 */

export default function NewReceiptPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Record Customer Receipt</h1>
      <p className="text-gray-500 mt-2">Record incoming customer payment and settle outstanding invoice balances.</p>
    </div>
  );
}
