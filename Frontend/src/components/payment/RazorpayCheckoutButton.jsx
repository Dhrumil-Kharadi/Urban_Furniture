'use client';

// ============================================================
// FILE: src/components/payment/RazorpayCheckoutButton.jsx
//
// Razorpay Standard Checkout button (project.md §5.3).
//
//   <RazorpayCheckoutButton invoiceId={invoice.id} onPaid={…} />
//
// WHAT THIS COMPONENT DOES NOT DECIDE
//
// It does not decide how much is owed. It sends an INVOICE ID and nothing
// else; the server reads the outstanding balance from that invoice and
// refuses any request that tries to name a price. There is no amount prop,
// deliberately — one would only ever be a suggestion the server ignores, and
// having it would imply otherwise.
//
// It does not decide whose invoice this is either. A portal login can only
// reach its own contact's invoices, enforced in the server's lookup.
//
// And it does not decide whether the payment succeeded. Razorpay's modal
// closing successfully is a claim by the browser; only the server's
// verification — which re-fetches the payment from Razorpay and records it
// against the invoice — settles that. Hence `onPaid` fires after
// verification, never before.
//
// Card details never reach this application — they are entered inside
// Razorpay's own modal, which is the point of using a gateway.
// ============================================================

import React, { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';

import Button from '@/reusablefiles/button';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import gatewayService, { loadCheckoutScript } from '@/services/gateway.service';

/**
 * @param {object}   props
 * @param {string}   props.invoiceId - The only input. The server prices it.
 * @param {Function} [props.onPaid]  - Called with the verified, RECORDED result.
 * @param {boolean}  [props.disabled]
 * @param {string}   [props.label]       - Overrides the default button text.
 */
export default function RazorpayCheckoutButton({
  invoiceId,
  onPaid,
  disabled = false,
  label,
}) {
  const t = useTranslations('payment');
  const toast = useToast();
  const { user } = useAuth();

  const [busy, setBusy] = useState(false);

  const handleClick = useCallback(async () => {
    setBusy(true);

    try {
      // The script is fetched only when someone actually intends to pay.
      await loadCheckoutScript();

      const order = await gatewayService.createOrder(invoiceId);

      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: 'Urban Furniture',
        description: t('description'),
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
        },

        /** Razorpay calls this after a successful charge. */
        handler: async (response) => {
          try {
            // Nothing is treated as paid until the SERVER says the signature
            // holds. A response object is not proof.
            const result = await gatewayService.verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            // `duplicate` means a retry or a webhook already recorded it —
            // still a success for the payer, and still only credited once.
            toast.success(t('success'));
            if (onPaid) onPaid(result);
          } catch (err) {
            // A verification failure here is serious: the charge may have gone
            // through at Razorpay while this system refuses to credit it. Say
            // so plainly rather than showing a generic error.
            toast.error(err?.message || t('failed'));
          } finally {
            setBusy(false);
          }
        },

        modal: {
          /** The reader closed the modal without paying. Not an error. */
          ondismiss: () => {
            setBusy(false);
            toast.error(t('cancelled'));
          },
        },
      });

      // A declined card, a failed 3-D Secure step, an expired session.
      checkout.on('payment.failed', (event) => {
        setBusy(false);
        toast.error(event?.error?.description || t('failed'));
      });

      checkout.open();
    } catch (err) {
      setBusy(false);

      // 501 is the honest "invoices do not exist yet" from the server; 503 is
      // "no gateway configured". Both deserve their own message rather than a
      // generic failure.
      const message =
        err?.status === 501 || err?.status === 503
          ? t('unavailable')
          : err?.message || t('failed');

      toast.error(message);
    }
  }, [invoiceId, onPaid, t, toast, user]);

  return (
    <Button
      variant="primary"
      size="sm"
      loading={busy}
      disabled={disabled || busy}
      onClick={handleClick}
    >
      {busy ? t('paying') : label || t('payNow')}
    </Button>
  );
}
