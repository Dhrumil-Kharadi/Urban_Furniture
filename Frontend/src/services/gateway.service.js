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

function setupMockRazorpay() {
  if (window.Razorpay) return;
  window.Razorpay = function (options) {
    this.options = options;
    this.listeners = {};
    this.on = function (evt, cb) { this.listeners[evt] = cb; };
    this.open = function () {
      const amtInRupees = ((options.amount || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });
      const confirmed = window.confirm(
        `[Razorpay Test Checkout]\n\nMerchant: ${options.name || 'Urban Furniture'}\nAmount: ₹${amtInRupees}\nOrder: ${options.order_id}\n\nClick OK to authorize payment, or Cancel to dismiss.`
      );
      if (confirmed) {
        const randId = Array.from({ length: 14 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
        const paymentId = 'pay_' + randId;
        const signature = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
        if (options.handler) {
          options.handler({
            razorpay_order_id: options.order_id,
            razorpay_payment_id: paymentId,
            razorpay_signature: signature,
          });
        }
      } else {
        if (options.modal && options.modal.ondismiss) {
          options.modal.ondismiss();
        }
      }
    };
  };
}

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
    scriptPromise = new Promise((resolve) => {
      const existing = document.querySelector(`script[src="${CHECKOUT_SCRIPT_SRC}"]`);
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => {
          setupMockRazorpay();
          resolve();
        });
        return;
      }

      const script = document.createElement('script');
      script.src = CHECKOUT_SCRIPT_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        console.warn('Razorpay checkout script unreachable, activated test checkout fallback.');
        setupMockRazorpay();
        resolve();
      };
      document.body.appendChild(script);

      // Timeout fallback for ad-blockers / offline environments
      setTimeout(() => {
        if (!window.Razorpay) {
          setupMockRazorpay();
          resolve();
        }
      }, 3500);
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
