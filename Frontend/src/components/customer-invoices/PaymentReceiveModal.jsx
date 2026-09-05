'use client';

/**
 * @file PaymentReceiveModal Component
 * @spec Doc/project.md §5.2, Doc/phase.md Phase 10
 * 
 * PROMPT & IMPLEMENTATION GUIDELINES:
 * - Modal to record payment receipt against an outstanding customer invoice.
 * - Posts: Debit Cash/Bank, Credit Debtors.
 */

export default function PaymentReceiveModal({ isOpen, onClose, invoice, onReceiveComplete }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
        <h3 className="text-lg font-bold">Receive Customer Payment</h3>
        <p className="text-sm text-gray-500 mt-1">Record incoming payment for invoice {invoice?.invoice_number}.</p>
      </div>
    </div>
  );
}
