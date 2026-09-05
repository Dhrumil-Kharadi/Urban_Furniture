/**
 * @file Debit Notes List Page
 * @route /dashboard/debit-notes
 * @spec Doc/project.md §3, Doc/technicalrequirement.md §3.5
 * 
 * REQUIREMENTS & SPECIFICATION:
 * - List vendor debit notes (DN prefix) for purchase returns and adjustments.
 * - Reverses purchase expense & input tax against Accounts Payable.
 */

export default function DebitNotesPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Debit Notes</h1>
      <p className="text-gray-500 mt-2">Manage vendor debit notes and purchase return adjustments.</p>
    </div>
  );
}
