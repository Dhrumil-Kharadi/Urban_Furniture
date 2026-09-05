'use client';

/**
 * @file PurchaseOrderLines Component
 * @spec Doc/project.md §5.1
 * 
 * PROMPT & IMPLEMENTATION GUIDELINES:
 * - Line grid table for PO items.
 * - Supports keyboard navigation: Tab across Qty -> Price -> Tax -> Add Line.
 * - 'Add Line' button appends new row.
 * - Delete row button with recalculation of running totals.
 */

export default function PurchaseOrderLines({ lines = [], onChange, isReadOnly = false }) {
  return (
    <div className="mt-4 border rounded-md overflow-hidden">
      <table className="w-full text-left border-collapse">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="p-3 text-sm font-semibold">Product</th>
            <th className="p-3 text-sm font-semibold">Quantity</th>
            <th className="p-3 text-sm font-semibold">Unit Price</th>
            <th className="p-3 text-sm font-semibold">Tax</th>
            <th className="p-3 text-sm font-semibold">Analytic Account</th>
            <th className="p-3 text-sm font-semibold">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={6} className="p-4 text-center text-gray-400">No items added yet.</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
