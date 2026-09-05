'use client';

// ============================================================
// FILE: src/components/portal/PaymentModal.jsx
//
// Card Payment Modal for Customer Portal (project.md §5.3 · phase.md Phase 12).
// Integrates with pay-intent and verification endpoints.
// Safe simulation mode enabled.
// ============================================================

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { X, CreditCard, ShieldCheck, CheckCircle2, AlertTriangle, Lock } from 'lucide-react';
import Button from '@/reusablefiles/button';
import InputBox from '@/reusablefiles/inputbox';
import { MoneyText } from '@/components/masterdata/Cells';
import portalService from '@/services/portal.service';

export default function PaymentModal({
  isOpen,
  onClose,
  invoice,
  onPaymentSuccess,
}) {
  const t = useTranslations('portal.payment');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [paymentResult, setPaymentResult] = useState(null);

  const [cardForm, setCardForm] = useState({
    name: 'Customer Cardholder',
    number: '4111 2222 3333 4444',
    expiry: '12/28',
    cvv: '123',
  });

  if (!isOpen || !invoice) return null;

  const handlePay = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Step 1: Create pay intent (server reads amount directly from DB)
      const intentRes = await portalService.createPayIntent(invoice.id);
      const intentData = intentRes?.data || intentRes;

      if (!intentData?.gatewayOrderId) {
        throw new Error('Could not initiate payment order with gateway');
      }

      // Step 2: In test/simulation mode, generate simulated payment ID and signature
      const simPaymentId = `pay_sim_${Date.now()}`;
      const simSignature = `sim_sig_${Date.now()}`;

      // Step 3: Verify payment and post double-entry receipt to ledger
      const verifyRes = await portalService.verifyPayment({
        invoiceId: invoice.id,
        gatewayOrderId: intentData.gatewayOrderId,
        gatewayPaymentId: simPaymentId,
        gatewaySignature: simSignature,
      });

      const verifyData = verifyRes?.data || verifyRes;
      setSuccess(true);
      setPaymentResult(verifyData);
      onPaymentSuccess?.(verifyData);
    } catch (err) {
      console.error('Payment failed', err);
      setError(err?.message || t('failure'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in">
      <div className="bg-[var(--card-bg,#181d28)] border border-[var(--border,#2b3245)] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col text-[var(--foreground,#f3f4f6)] my-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border,#2b3245)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-500/10 text-indigo-400 rounded-lg">
              <CreditCard size={18} />
            </div>
            <h2 className="text-base font-bold">
              {t('modalTitle')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--surface-hover,#242c3d)] text-gray-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content */}
        {success ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-14 h-14 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20">
              <CheckCircle2 size={32} />
            </div>
            <h3 className="text-lg font-bold text-gray-100">
              Payment Complete!
            </h3>
            <p className="text-xs text-gray-400 max-w-xs mx-auto">
              {t('success')}
            </p>
            {paymentResult?.paymentNumber && (
              <div className="p-3 bg-[var(--surface,#1f2637)] rounded-xl border border-[var(--border,#2b3245)] text-xs font-mono text-indigo-400">
                Receipt #{paymentResult.paymentNumber}
              </div>
            )}
            <div className="pt-2">
              <Button variant="primary" onClick={onClose} className="w-full">
                {t('close')}
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handlePay} className="p-6 space-y-4">
            {/* Invoice Summary Box */}
            <div className="p-4 bg-[var(--surface,#1f2637)]/60 border border-[var(--border,#2b3245)] rounded-xl space-y-2 text-xs">
              <div className="flex justify-between text-gray-400">
                <span>Invoice #</span>
                <span className="font-mono text-gray-200">{invoice.invoice_number}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>{t('amountToPay')}</span>
                <span className="font-bold text-base text-emerald-400">
                  <MoneyText value={invoice.amount_due} />
                </span>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2">
                <AlertTriangle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Simulated Card Fields */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                {t('nameOnCard')}
              </label>
              <InputBox
                value={cardForm.name}
                onChange={(val) => setCardForm((prev) => ({ ...prev, name: val }))}
                size="sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                {t('cardNumber')}
              </label>
              <InputBox
                value={cardForm.number}
                onChange={(val) => setCardForm((prev) => ({ ...prev, number: val }))}
                size="sm"
                icon={<CreditCard size={14} />}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  {t('expiry')}
                </label>
                <InputBox
                  value={cardForm.expiry}
                  onChange={(val) => setCardForm((prev) => ({ ...prev, expiry: val }))}
                  placeholder="MM/YY"
                  size="sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  {t('cvv')}
                </label>
                <InputBox
                  type="password"
                  maxLength={4}
                  value={cardForm.cvv}
                  onChange={(val) => setCardForm((prev) => ({ ...prev, cvv: val }))}
                  placeholder="123"
                  size="sm"
                  required
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-gray-400 pt-1">
              <Lock size={12} className="text-emerald-400" />
              <span>{t('cardNotice')}</span>
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-[var(--border,#2b3245)] flex items-center justify-end gap-3">
              <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={loading}>
                {t('cancel')}
              </Button>
              <Button type="submit" variant="primary" size="sm" loading={loading}>
                Pay <MoneyText value={invoice.amount_due} />
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
