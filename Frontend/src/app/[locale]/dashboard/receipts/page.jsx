/**
 * @file Customer Receipts List Page
 * @route /dashboard/receipts
 * @spec Doc/project.md §5.2, §5.3, Doc/phase.md Phase 10
 * 
 * REQUIREMENTS & SPECIFICATION:
 * - List all incoming customer payment receipts (Dr Cash/Bank, Cr Debtors).
 * - Columns: Receipt # (e.g. RCP/2026/00001), Date, Customer, Method (Cash/Bank/Card), Amount, Allocated Invoice.
 * - Supports offline payments recorded by Accountant/Admin and online portal card payments.
 */

export default function ReceiptsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Customer Receipts</h1>
      <p className="text-gray-500 mt-2">View payment receipts from customers across cash, bank, and portal card payments.</p>
    </div>
  );
}
