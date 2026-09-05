/**
 * @file Purchase Orders List Page
 * @route /dashboard/purchase-orders
 * @spec Doc/project.md §5.1, Doc/phase.md Phase 8
 * 
 * REQUIREMENTS & SPECIFICATION:
 * - List all Purchase Orders (PO) for the current organization.
 * - Columns: PO Number (e.g. PO/2026/00001), Date, Vendor Name, Total Amount, Status, Actions.
 * - Status Lifecycle: Draft -> Confirmed -> Billed -> Cancelled.
 * - Filter & Search: By Vendor, Status, Date Range, Full-text Search.
 * - Actions: Create New PO (+ Button for Admin/Accountant), View Detail, Print.
 * - Access Control: Admin & Accountant can view/create. Contact has no access.
 * - Standard List Contract: pagination, sorting (?sortBy=order_date&sortOrder=desc).
 */

export default function PurchaseOrdersPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Purchase Orders</h1>
      <p className="text-gray-500 mt-2">Manage vendor purchase orders and conversion to bills.</p>
    </div>
  );
}
