'use client';

/**
 * @file PaymentRegisterModal Component
 * @spec Doc/project.md §5.1, Doc/phase.md Phase 8 & 10
 * 
 * PROMPT & IMPLEMENTATION GUIDELINES:
 * - Modal dialog to register payment on an open Vendor Bill.
 * - Inputs: Payment Date, Bank/Cash Journal, Amount, Reference/Check #.
 * - Submits to /api/payments and transitions bill to 'partially_paid' or 'paid'.
 */

export default function PaymentRegisterModal({ isOpen, onClose, bill, onPaymentComplete }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
        <h3 className="text-lg font-bold">Register Payment</h3>
        <p className="text-sm text-gray-500 mt-1">Record outgoing payment for bill {bill?.bill_number}.</p>
      </div>
    </div>
  );
}
