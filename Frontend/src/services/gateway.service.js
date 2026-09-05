// ============================================================
// FILE: src/services/gateway.service.js
//
// Razorpay Standard Checkout — the browser half.
//
// The flow is deliberately three server round trips, not one:
//
//   1. create-order   the SERVER decides the amount and asks Razorpay for an
//                     order id. The browser never states a price the server
//                     then trusts.
//   2. checkout       Razorpay's own modal takes the card details. They never
//                     touch this application, which is the point of using a
//                     gateway at all.
//   3. verify-payment the SERVER re-computes the HMAC signature. Until that
//                     returns success, nothing is paid — a browser saying
//                     "it worked" is not evidence.
//
// The key secret exists only on the server. This file never sees it, and any
// change that gives it a NEXT_PUBLIC_ prefix makes every payment forgeable.
// ============================================================

import api from '@/lib/api';

const CHECKOUT_SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

/** Resolves once the Razorpay script is on the page. Loaded at most once. */
let scriptPromise = null;

/**
 * Load Razorpay's checkout script on demand.
 *
 * On demand rather than in the layout: most people never open a payment
 * screen, and a third-party script on every page is a cost and an attack
 * surface for all of them.
 *
 * @returns {Promise<void>}
 */
export function loadCheckoutScript() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Checkout is only available in the browser'));
  }

  if (window.Razorpay) return Promise.resolve();

  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${CHECKOUT_SCRIPT_SRC}"]`);
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('Checkout failed to load')));
        return;
      }

      const script = document.createElement('script');
      script.src = CHECKOUT_SCRIPT_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        // Allow a later attempt: a failed load is usually a network blip or a
        // blocker, and both can change.
        scriptPromise = null;
        reject(new Error('Checkout failed to load'));
      };
      document.body.appendChild(script);
    });
  }

  return scriptPromise;
}

export const gatewayService = {
  /**
   * The publishable key id and currency.
   *
   * Fetched rather than read from NEXT_PUBLIC_RAZORPAY_KEY_ID so the server
   * stays the single source of truth — a frontend build pinned to a stale key
   * would fail at the modal with nothing useful to say.
   *
   * @returns {Promise<{ keyId: string, currency: string }>}
   */
  async getConfig() {
    const res = await api.get('/gateway/config');
    return res.data;
  },

  /**
   * Ask the server to create an order for an invoice.
   *
   * The invoice id is the ONLY input. The amount comes back from the server,
   * which read it from the invoice — this client cannot state a price, and
   * the server refuses a request that tries to.
   *
   * @param {string} invoiceId
   * @returns {Promise<{ orderId: string, amount: number, currency: string, keyId: string, invoiceNumber: string }>}
   */
  async createOrder(invoiceId) {
    const res = await api.post('/gateway/create-order', { invoice_id: invoiceId });
    return res.data;
  },

  /**
   * Hand the callback back to the server to verify.
   *
   * @param {{ razorpay_order_id: string, razorpay_payment_id: string, razorpay_signature: string }} payload
   * @returns {Promise<{ verified: boolean, paymentId: string, recorded: boolean }>}
   */
  async verifyPayment(payload) {
    const res = await api.post('/gateway/verify-payment', payload);
    return res.data;
  },
};

export default gatewayService;
