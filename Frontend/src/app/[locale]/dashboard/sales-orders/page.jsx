/**
 * @file Sales Orders List Page
 * @route /dashboard/sales-orders
 * @spec Doc/project.md §5.2, Doc/phase.md Phase 9
 * 
 * REQUIREMENTS & SPECIFICATION:
 * - List all customer Sales Orders (SO).
 * - Columns: SO Number (e.g. SO/2026/00001), Date, Customer Name, Total Amount, Status, Actions.
 * - Status Lifecycle: Draft -> Confirmed -> Invoiced -> Cancelled.
 * - Actions: Create SO, View Detail, Confirm, Convert to Customer Invoice.
 */

export default function SalesOrdersPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Sales Orders</h1>
      <p className="text-gray-500 mt-2">Manage customer quotes, sales orders, and invoice generation.</p>
    </div>
  );
}
