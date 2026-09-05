/**
 * @file Outgoing Payments (Vendor Payments) List Page
 * @route /dashboard/payments
 * @spec Doc/project.md §5.1, §5.3, Doc/phase.md Phase 10
 * 
 * REQUIREMENTS & SPECIFICATION:
 * - List all outgoing payments made to vendors (Dr Creditors, Cr Cash/Bank).
 * - Columns: Payment # (e.g. PAY/2026/00001), Date, Vendor, Payment Method (Cash/Bank), Amount, Allocated Bill, Status.
 * - Actions: Record Payment, View Voucher, Print Receipt.
 */

export default function PaymentsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Vendor Payments</h1>
      <p className="text-gray-500 mt-2">Record and reconcile vendor payments against outstanding bills.</p>
    </div>
  );
}
