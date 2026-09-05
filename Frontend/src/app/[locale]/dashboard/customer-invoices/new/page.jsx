/**
 * @file New Customer Invoice Form Page
 * @route /dashboard/customer-invoices/new
 * @spec Doc/project.md §5.2, Doc/phase.md Phase 9
 * 
 * REQUIREMENTS & SPECIFICATION:
 * - Create a Customer Invoice manually or from an approved Sales Order.
 * - Header Fields: Customer, Invoice Date, Due Date, Payment Reference.
 * - Lines Grid: Product, Income Account, Qty, Price, Tax (Output GST), Analytic Account.
 * - Validation: Customer required, balanced pricing, valid accounts.
 */

export default function NewCustomerInvoicePage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">New Customer Invoice</h1>
      <p className="text-gray-500 mt-2">Create customer invoice with automatic output tax calculation.</p>
    </div>
  );
}
