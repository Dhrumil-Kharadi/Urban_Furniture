/**
 * @file New Budget Form Page
 * @route /dashboard/budgets/new
 * @spec Doc/project.md §4.7, Doc/phase.md Phase 12
 * 
 * REQUIREMENTS & SPECIFICATION:
 * - Create a new Budget linked to an Analytic Account.
 * - Fields:
 *   - Budget Name
 *   - Start Date & End Date
 *   - Responsible Person (Staff/User)
 *   - Linked Analytic Account (/api/analytic-accounts)
 *   - Planned Amount (NUMERIC)
 * - Validation: End Date >= Start Date; Planned Amount > 0; Analytic Account required.
 */

export default function NewBudgetPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Create New Budget</h1>
      <p className="text-gray-500 mt-2">Define budget period, planned amount, and link to an analytic account.</p>
    </div>
  );
}
