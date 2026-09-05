'use client';

/**
 * @file PortalPayModal Component
 * @spec Doc/project.md §2.2, §5.3, Doc/phase.md Phase 13
 * 
 * Self-service online payment modal for customer portal.
 * Uses Frozen Lake Neumorphic styling tokens and RazorpayCheckoutButton.
 */

import React from 'react';
import RazorpayCheckoutButton from '@/components/payment/RazorpayCheckoutButton';
import Button from '@/reusablefiles/button';
import { X, CreditCard } from 'lucide-react';

export default function PortalPayModal({ isOpen, onClose, invoice, onPaymentSuccess }) {
  if (!isOpen || !invoice) return null;

  return (
    <div className="nm-dialog-scrim">
      <div className="nm-dialog-box" style={{ maxWidth: '440px', width: '90%' }}>
        <div className="nm-dialog-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CreditCard size={18} color="var(--accent-primary)" />
            <h3 className="nm-dialog-title">Pay Invoice Online</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="doc-btn doc-btn-icon"
            style={{ padding: '4px', border: 'none', background: 'transparent' }}
          >
            <X size={16} />
          </button>
        </div>

        <div className="nm-dialog-body" style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <p style={{ fontFamily: 'Sora, sans-serif', fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
            Invoice: <strong style={{ color: 'var(--text-primary)', fontFamily: 'Orbitron, monospace' }}>{invoice.invoice_number}</strong>
          </p>
          <p style={{ fontFamily: 'Sora, sans-serif', fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
            Outstanding Balance: <strong style={{ color: '#10b981', fontFamily: 'Orbitron, monospace' }}>₹{Number(invoice.amount_due || invoice.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
          </p>
          <p style={{ fontFamily: 'Sora, sans-serif', fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
            Pay securely with Razorpay (UPI, Credit/Debit Cards, NetBanking).
          </p>
        </div>

        <div className="nm-dialog-footer" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <RazorpayCheckoutButton
            invoiceId={invoice.id}
            label="Proceed to Payment"
            onPaid={() => {
              onPaymentSuccess?.();
              onClose?.();
            }}
          />
        </div>
      </div>
    </div>
  );
}
