'use client';

/**
 * @file BudgetForm Component
 * @spec Doc/project.md §4.7, §8, Doc/phase.md Phase 12
 * 
 * PROMPT & IMPLEMENTATION GUIDELINES:
 * - Form for setting up budgets.
 * - Fields:
 *   - Budget Name
 *   - Start Date & End Date (fiscal year aligned)
 *   - Linked Analytic Account (Picker from /api/analytic-accounts)
 *   - Planned Budget Amount (decimal money string)
 *   - Responsible Person.
 */

export default function BudgetForm({ initialData = null, onSubmit, isReadOnly = false }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <h2 className="text-xl font-semibold mb-4">Budget Configuration Form</h2>
      <p className="text-gray-500">Configure planned budget amounts linked to analytic cost centers.</p>
    </div>
  );
}
