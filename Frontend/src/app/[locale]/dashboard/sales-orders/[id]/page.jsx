/**
 * @file Sales Order Detail Page
 * @route /dashboard/sales-orders/[id]
 * @spec Doc/project.md §5.2, Doc/phase.md Phase 9
 * 
 * REQUIREMENTS & SPECIFICATION:
 * - View full SO details and line items.
 * - Action buttons based on lifecycle:
 *   - 'Confirm Order' -> moves to 'confirmed'
 *   - 'Create Invoice' -> generates draft Customer Invoice
 *   - 'Cancel Order'
 * - Print / Send Quote via email to customer.
 */

export default function SalesOrderDetailPage({ params }) {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Sales Order Details</h1>
      <p className="text-gray-500 mt-2">View sales order details and convert to customer invoice.</p>
    </div>
  );
}
