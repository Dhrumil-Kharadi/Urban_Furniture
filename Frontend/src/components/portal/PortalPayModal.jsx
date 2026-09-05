'use client';

/**
 * @file PortalPayModal Component
 * @spec Doc/project.md §2.2, §5.3, Doc/phase.md Phase 13
 * 
 * PROMPT & IMPLEMENTATION GUIDELINES:
 * - Self-service Card payment modal for Customer Contact portal.
 * - Simulates / integrates payment gateway card processing.
 * - On success: creates payment record (method='card') and posts to clearing account.
 */

export default function PortalPayModal({ isOpen, onClose, invoice, onPaymentSuccess }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
        <h3 className="text-lg font-bold">Pay Invoice Online</h3>
        <p className="text-sm text-gray-500 mt-1">Amount to pay: ₹{invoice?.total_amount}</p>
      </div>
    </div>
  );
}
