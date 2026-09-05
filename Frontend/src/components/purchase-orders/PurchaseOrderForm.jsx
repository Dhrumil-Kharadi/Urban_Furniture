'use client';

/**
 * @file PurchaseOrderForm Component
 * @spec Doc/project.md §5.1, Doc/phase.md Phase 8
 * 
 * PROMPT & IMPLEMENTATION GUIDELINES:
 * - Form for creating & editing Purchase Orders.
 * - Header Section:
 *   - Vendor Selector (Async ResourcePicker for Contacts where contact_type IN ('vendor', 'both'))
 *   - Order Date, Expected Date, Reference Number.
 * - Dynamic Lines Grid:
 *   - Product Selector (Async ProductPicker)
 *   - Quantity, Unit Cost Price (pre-populated from product.cost_price, editable)
 *   - Purchase Tax Selector (default from product.purchase_tax_id)
 *   - Analytic Account Selector (cost-center allocation for budgets §8)
 *   - Calculated line subtotal and line tax.
 * - Footer Summary:
 *   - Subtotal, Total Tax, Grand Total computed via exact decimal arithmetic.
 * - Actions: Save Draft, Confirm Order, Print, Cancel.
 */

export default function PurchaseOrderForm({ initialData = null, onSubmit, isReadOnly = false }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <h2 className="text-xl font-semibold mb-4">Purchase Order Form</h2>
      <p className="text-gray-500">Purchase order line items and vendor selection interface.</p>
    </div>
  );
}
