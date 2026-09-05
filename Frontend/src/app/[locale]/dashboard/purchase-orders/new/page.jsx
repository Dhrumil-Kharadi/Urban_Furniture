/**
 * @file New Purchase Order Form Page
 * @route /dashboard/purchase-orders/new
 * @spec Doc/project.md §5.1, Doc/phase.md Phase 8
 * 
 * REQUIREMENTS & SPECIFICATION:
 * - Create a new Purchase Order in 'draft' status.
 * - Header Fields:
 *   - Vendor (required, picker from /api/contacts?type=vendor|both)
 *   - Order Date (default today)
 *   - Expected Delivery Date
 *   - Reference / Memo
 * - Dynamic Line Grid:
 *   - Product Picker (/api/products)
 *   - Description
 *   - Quantity (positive number)
 *   - Unit Price (default from product cost_price, overrideable)
 *   - Tax Rate (from product purchase_tax or tax picker)
 *   - Analytic Account Tag (/api/analytic-accounts for budget tracking)
 *   - Line Subtotal & Tax computed via exact decimal arithmetic.
 * - Live Totals: Untaxed Subtotal, Tax Total, Grand Total.
 * - Validation: At least one line item required; vendor required; quantity > 0.
 */

export default function NewPurchaseOrderPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">New Purchase Order</h1>
      <p className="text-gray-500 mt-2">Create a purchase order for goods or services from a vendor.</p>
    </div>
  );
}
