/**
 * @file Contact Portal - Vendor Bills (Statement of Account) Page
 * @route /portal/bills
 * @spec Doc/project.md §5.3, Doc/phase.md Phase 13
 * 
 * REQUIREMENTS & SPECIFICATION:
 * - Self-service view for logged-in Vendor Contact.
 * - Shows statement of account: all bills raised against this vendor historically.
 * - No 'Pay Now' button (vendors only view statement; payments are made by the business).
 */

export default function PortalBillsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Statement of Account</h1>
      <p className="text-gray-500 mt-2">View all bills and payments on your vendor account.</p>
    </div>
  );
}
