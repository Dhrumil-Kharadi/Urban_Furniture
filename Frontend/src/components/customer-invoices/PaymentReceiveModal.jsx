'use client';

/**
 * @file PaymentReceiveModal Component
 * @spec Doc/project.md §5.2, Doc/phase.md Phase 10
 * 
 * Modal to record payment receipt against an outstanding customer invoice.
 * Wraps RegisterPaymentModal with inbound direction.
 */

import React from 'react';
import RegisterPaymentModal from '@/components/payments/RegisterPaymentModal';

export default function PaymentReceiveModal({ isOpen, onClose, invoice, onReceiveComplete }) {
  if (!isOpen) return null;
  return (
    <RegisterPaymentModal
      isOpen={isOpen}
      onClose={onClose}
      document={invoice}
      direction="inbound"
      onRecorded={onReceiveComplete}
    />
  );
}
