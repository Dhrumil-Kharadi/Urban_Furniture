'use client';

/**
 * @file SalesOrderForm Component
 * @spec Doc/project.md §5.2, Doc/phase.md Phase 9
 * 
 * PROMPT & IMPLEMENTATION GUIDELINES:
 * - Sales Order creation & quotation form.
 * - Customer selector, shipping address, quotation expiry, payment terms.
 * - Dynamic product lines with sales price, tax calculation, and profit margins.
 */

export default function SalesOrderForm({ initialData = null, onSubmit, isReadOnly = false }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <h2 className="text-xl font-semibold mb-4">Sales Order Form</h2>
      <p className="text-gray-500">Sales order line items and customer quotation interface.</p>
    </div>
  );
}
