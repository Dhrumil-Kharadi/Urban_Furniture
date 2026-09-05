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
    <div className="tx-legacy-table-wrap">
      <table className="tx-legacy-table">
        <thead className="tx-legacy-thead">
          <tr>
            <th className="tx-legacy-th">Product</th>
            <th className="tx-legacy-th">Quantity</th>
            <th className="tx-legacy-th">Unit Price</th>
            <th className="tx-legacy-th">Tax</th>
            <th className="tx-legacy-th">Analytic Account</th>
            <th className="tx-legacy-th">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={6} className="tx-legacy-empty-cell">No items added yet.</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
