const { success, created, error } = require('../utils/response');
const gatewayValidation = require('./gateway.validation');
const gatewayService = require('./gateway.service');

/**
 * Payment Gateway Controller
 *
 * Reads the request, validates, delegates, responds. No SQL, no crypto.
 */

const gatewayController = {
  /**
   * GET /api/gateway/config
   * The public key id the checkout script needs. Never the secret.
   */
  async getConfig(req, res, next) {
    try {
      return success(res, 'Gateway configuration retrieved', gatewayService.getPublicConfig());
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/gateway/create-order
   * Body: { invoice_id }
   *
   * The amount is NOT a parameter. It is read from the invoice server-side.
   */
  async createOrder(req, res, next) {
    try {
      const validation = gatewayValidation.validateCreateOrder(req.body);
      if (!validation.isValid) {
        return error(res, 'Validation failed', 400, validation.errors);
      }

      const order = await gatewayService.createOrder({
        organizationId: req.organizationId,
        actorUserId: req.user.id,
        // The role decides whose invoices are reachable: a Contact sees only
        // their own. Taken from the verified session, never the request.
        actorRole: req.user.role,
        invoiceId: validation.data.invoiceId,
      });

      return created(res, 'Order created', order);
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/gateway/verify-payment
   * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
   *
   * A failed verification returns 400 and the payment is NOT marked as paid.
   */
  async verifyPayment(req, res, next) {
    try {
      const validation = gatewayValidation.validateVerifyPayment(req.body);
      if (!validation.isValid) {
        return error(res, 'Validation failed', 400, validation.errors);
      }

      const result = await gatewayService.confirmPayment({
        organizationId: req.organizationId,
        actorUserId: req.user.id,
        orderId: validation.data.orderId,
        paymentId: validation.data.paymentId,
        signature: validation.data.signature,
      });

      return success(res, 'Payment verified', result);
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/gateway/public/create-order
   * Body: { invoice_id }
   */
  async createPublicOrder(req, res, next) {
    try {
      const validation = gatewayValidation.validateCreateOrder(req.body);
      if (!validation.isValid) {
        return error(res, 'Validation failed', 400, validation.errors);
      }

      const order = await gatewayService.createPublicOrder({
        invoiceId: validation.data.invoiceId,
      });

      return created(res, 'Order created', order);
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/gateway/public/verify-payment
   * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
   */
  async verifyPublicPayment(req, res, next) {
    try {
      const validation = gatewayValidation.validateVerifyPayment(req.body);
      if (!validation.isValid) {
        return error(res, 'Validation failed', 400, validation.errors);
      }

      const result = await gatewayService.confirmPublicPayment({
        orderId: validation.data.orderId,
        paymentId: validation.data.paymentId,
        signature: validation.data.signature,
      });

      return success(res, 'Payment verified', result);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = gatewayController;
