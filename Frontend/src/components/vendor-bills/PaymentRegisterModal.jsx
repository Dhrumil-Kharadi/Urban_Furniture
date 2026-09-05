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
    <div className="tx-modal-overlay">
      <div className="tx-modal-dialog">
        <h3 className="tx-modal-title">Register Payment</h3>
        <p className="tx-modal-desc">Record outgoing payment for bill {bill?.bill_number}.</p>
      </div>
    </div>
  );
}
