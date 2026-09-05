/**
 * @file New Vendor Bill Form Page
 * @route /dashboard/vendor-bills/new
 * @spec Doc/project.md §5.1, Doc/phase.md Phase 8
 * 
 * REQUIREMENTS & SPECIFICATION:
 * - Create a Vendor Bill manually or pre-populated from a confirmed PO.
 * - Header Fields: Vendor, Bill Date, Accounting Date, Due Date, Vendor Invoice Ref.
 * - Lines Grid: Product, Account (default from product expense account), Qty, Price, Tax, Analytic Account.
 * - On Post: Calls backend posting template §5.3 to generate immutable double-entry journal entry.
 */

export default function NewVendorBillPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">New Vendor Bill</h1>
      <p className="text-gray-500 mt-2">Record a vendor bill with automatic input tax and double-entry ledger posting.</p>
    </div>
  );
}
