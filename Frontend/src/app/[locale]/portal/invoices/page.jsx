/**
 * @file Contact Portal - Customer Invoices & Online Payment Page
 * @route /portal/invoices
 * @spec Doc/project.md §2.2, §5.3, Doc/phase.md Phase 13
 * 
 * REQUIREMENTS & SPECIFICATION:
 * - Self-service view for logged-in Customer Contact.
 * - Shows list of only their own invoices (isolated by contact_id).
 * - Columns: Invoice #, Date, Due Date, Total, Outstanding Amount, Status.
 * - Action: 'Pay Now' button on unpaid/partially paid invoices opening Card Payment modal.
 * - Integration: Card payment registers receipt to payment gateway clearing account and updates invoice status.
 */

export default function PortalInvoicesPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">My Invoices</h1>
      <p className="text-gray-500 mt-2">View and pay your outstanding invoices online.</p>
    </div>
  );
}
