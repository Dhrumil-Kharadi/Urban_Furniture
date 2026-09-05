/**
 * @file New Sales Order Form Page
 * @route /dashboard/sales-orders/new
 * @spec Doc/project.md §5.2, Doc/phase.md Phase 9
 * 
 * REQUIREMENTS & SPECIFICATION:
 * - Create a new customer Sales Order.
 * - Header Fields: Customer (/api/contacts?type=customer|both), Order Date, Expiration/Delivery Date, Payment Terms.
 * - Dynamic Line Items: Product (/api/products), Qty, Sales Price (prefilled), Tax Rate, Analytic Tag.
 * - Real-time totals with strict rounding rules (round per line after tax).
 */

export default function NewSalesOrderPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">New Sales Order</h1>
      <p className="text-gray-500 mt-2">Create a sales order for products or services to a customer.</p>
    </div>
  );
}
