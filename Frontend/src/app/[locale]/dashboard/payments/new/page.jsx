/**
 * @file Record Vendor Payment Page
 * @route /dashboard/payments/new
 * @spec Doc/project.md §5.1, Doc/phase.md Phase 10
 * 
 * REQUIREMENTS & SPECIFICATION:
 * - Record an outgoing payment to a vendor.
 * - Fields: Vendor, Payment Date, Journal (Cash/Bank), Payment Amount, Outstanding Bills Allocation.
 * - Automatically allocates payment to selected open bill(s) and creates balancing Journal Entry.
 */

export default function NewPaymentPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Record Vendor Payment</h1>
      <p className="text-gray-500 mt-2">Create payment voucher and reconcile with open vendor bills.</p>
    </div>
  );
}
