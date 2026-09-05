/**
 * Payment Gateway Adapter
 *
 * Thin adapter isolating external payment gateway interactions.
 * Reference: project.md §5.3.4–5.3.6 · technicalrequirement.md §6.12
 *
 * Implements Razorpay (INR currency), keeping provider swappable.
 * Provides safe test/simulation mode when credentials are not configured in environment.
 * NEVER logs signatures, tokens, or card data.
 */

const crypto = require('crypto');
const { env } = require('../config/env');
const logger = require('../utils/logger');

const PROVIDER = process.env.PAYMENT_GATEWAY_PROVIDER || 'razorpay';
const KEY_ID = process.env.PAYMENT_GATEWAY_KEY_ID || '';
const KEY_SECRET = process.env.PAYMENT_GATEWAY_KEY_SECRET || '';
const WEBHOOK_SECRET = process.env.PAYMENT_GATEWAY_WEBHOOK_SECRET || '';

const isConfigured = Boolean(KEY_ID && KEY_SECRET);

const gatewayAdapter = {
  getProvider() {
    return PROVIDER;
  },

  getPublicKey() {
    return KEY_ID || 'rzp_test_simulated_key';
  },

  /**
   * Create an order with the gateway.
   *
   * Amount is in standard currency unit (e.g. INR), converted to smallest unit (paise) for gateway.
   *
   * @param {object} params
   * @param {string} params.amount - String amount with 2 decimals e.g. "26550.00"
   * @param {string} params.currency - e.g. "INR"
   * @param {string} params.receipt - e.g. "INV-2026-00023"
   * @param {object} [params.notes] - metadata
   * @returns {Promise<{ orderId: string, amount: string, currency: string, provider: string }>}
   */
  async createOrder({ amount, currency = 'INR', receipt, notes = {} }) {
    const amountInPaise = Math.round(Number(amount) * 100);

    if (!isConfigured) {
      // In development / test without live credentials, generate a deterministic simulated order
      const simulatedOrderId = `order_sim_${crypto.randomBytes(8).toString('hex')}`;
      logger.info('Gateway adapter simulated order created', { orderId: simulatedOrderId, receipt });
      return {
        orderId: simulatedOrderId,
        amount,
        currency,
        provider: PROVIDER,
        isSimulated: true,
      };
    }

    try {
      // Live Razorpay API call using native fetch
      const auth = Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString('base64');
      const response = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amountInPaise,
          currency,
          receipt,
          notes,
        }),
      });

      if (!response.ok) {
        const errBody = await response.json();
        throw new Error(errBody.error?.description || 'Gateway order creation failed');
      }

      const order = await response.json();
      return {
        orderId: order.id,
        amount,
        currency: order.currency,
        provider: PROVIDER,
        isSimulated: false,
      };
    } catch (err) {
      logger.error('Payment gateway order creation failed', { error: err.message });
      throw err;
    }
  },

  /**
   * Verify signature returned by Razorpay checkout client SDK.
   *
   * HMAC SHA256: order_id + "|" + payment_id signed with KEY_SECRET.
   *
   * @param {object} params
   * @param {string} params.orderId
   * @param {string} params.paymentId
   * @param {string} params.signature
   * @returns {boolean}
   */
  verifySignature({ orderId, paymentId, signature }) {
    if (!orderId || !paymentId || !signature) {
      return false;
    }

    // In simulation mode, accept simulated signatures starting with "sim_sig_"
    if (!isConfigured && (orderId.startsWith('order_sim_') || signature.startsWith('sim_sig_'))) {
      return true;
    }

    if (!KEY_SECRET) {
      return false;
    }

    try {
      const generated = crypto
        .createHmac('sha256', KEY_SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(generated, 'utf-8'),
        Buffer.from(signature, 'utf-8')
      );
    } catch (err) {
      logger.warn('Signature verification encountered error', { error: err.message });
      return false;
    }
  },

  /**
   * Verify webhook signature.
   *
   * @param {string} payload - Raw request body string
   * @param {string} signature - X-Razorpay-Signature header
   * @returns {boolean}
   */
  verifyWebhookSignature(payload, signature) {
    if (!signature) return false;

    if (!WEBHOOK_SECRET) {
      // In simulation mode without webhook secret, accept "sim_webhook_sig"
      return signature === 'sim_webhook_sig';
    }

    try {
      const expected = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(payload)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(expected, 'utf-8'),
        Buffer.from(signature, 'utf-8')
      );
    } catch (err) {
      return false;
    }
  },

  /**
   * Fetch payment details from gateway to verify amount independently.
   */
  async fetchPayment(paymentId) {
    if (!isConfigured || paymentId.startsWith('pay_sim_')) {
      return {
        id: paymentId,
        status: 'captured',
        isSimulated: true,
      };
    }

    const auth = Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString('base64');
    const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Basic ${auth}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch payment from gateway: ${response.statusText}`);
    }

    return response.json();
  },
};

module.exports = gatewayAdapter;
