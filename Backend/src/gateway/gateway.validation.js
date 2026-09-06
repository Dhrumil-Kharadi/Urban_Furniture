/**
 * Payment Gateway Validation
 *
 * Pure functions returning { isValid, errors, data? }.
 */

/** Razorpay ids: order_XXXX / pay_XXXX, alphanumeric and underscores after the prefix. */
const ORDER_ID_REGEX = /^order_[A-Za-z0-9_]{6,50}$/;
const PAYMENT_ID_REGEX = /^pay_[A-Za-z0-9_]{6,50}$/;

/** The signature is a hex SHA-256 HMAC (or test signature). */
const SIGNATURE_REGEX = /^[a-f0-9]{64}$|^mock_sig_[A-Za-z0-9_]+$/i;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** @private */
function optionalText(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
}

const gatewayValidation = {
  /**
   * Validate an order request.
   *
   * `invoice_id` is the ONLY thing an order needs, and the only thing it may
   * supply. There is deliberately no amount field: the server reads the
   * outstanding balance from the invoice. An amount accepted here — however
   * carefully range-checked — would let a caller pay ₹1 for a ₹50,000
   * invoice, which is the whole risk this integration has to close.
   *
   * @param {object} body
   * @returns {{ isValid: boolean, errors: string[], data?: object }}
   */
  validateCreateOrder(body) {
    if (!body || typeof body !== 'object') {
      return { isValid: false, errors: ['Request body must be a JSON object'] };
    }

    const errors = [];

    const invoiceId = optionalText(body.invoice_id);
    if (!invoiceId) {
      errors.push('An invoice is required');
    } else if (!UUID_REGEX.test(invoiceId)) {
      errors.push('Invoice id must be a valid id');
    }

    // Sent by an older client, or by someone trying it on. Either way it is
    // refused rather than quietly dropped, so nobody is left believing they
    // set the price.
    if (body.amount !== undefined) {
      errors.push('An amount cannot be supplied — it is taken from the invoice');
    }

    if (errors.length > 0) return { isValid: false, errors };

    return { isValid: true, errors: [], data: { invoiceId } };
  },

  /**
   * Validate a verification callback.
   *
   * All three fields are mandatory. A request missing any of them cannot be
   * verified, and "cannot be verified" is never treated as "probably fine".
   *
   * @param {object} body
   * @returns {{ isValid: boolean, errors: string[], data?: object }}
   */
  validateVerifyPayment(body) {
    if (!body || typeof body !== 'object') {
      return { isValid: false, errors: ['Request body must be a JSON object'] };
    }

    const errors = [];

    const orderId = optionalText(body.razorpay_order_id);
    const paymentId = optionalText(body.razorpay_payment_id);
    const signature = optionalText(body.razorpay_signature);

    if (!orderId) errors.push('razorpay_order_id is required');
    else if (!ORDER_ID_REGEX.test(orderId)) errors.push('razorpay_order_id is malformed');

    if (!paymentId) errors.push('razorpay_payment_id is required');
    else if (!PAYMENT_ID_REGEX.test(paymentId)) errors.push('razorpay_payment_id is malformed');

    if (!signature) errors.push('razorpay_signature is required');
    else if (!SIGNATURE_REGEX.test(signature)) errors.push('razorpay_signature is malformed');

    if (errors.length > 0) return { isValid: false, errors };

    return {
      isValid: true,
      errors: [],
      data: { orderId, paymentId, signature },
    };
  },
};

module.exports = gatewayValidation;
