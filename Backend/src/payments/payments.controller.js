const { success, created, error } = require('../utils/response');
const paymentsValidation = require('./payments.validation');
const paymentsService = require('./payments.service');

/**
 * Payments Controller
 *
 * Reads the request, validates, delegates, responds. No SQL, no rules.
 *
 * There is deliberately no DELETE handler: a payment that has reached the
 * ledger is cancelled and reversed, never removed.
 */

const paymentsController = {
  /** GET /api/payments */
  async listPayments(req, res, next) {
    try {
      const validation = paymentsValidation.validateListQuery(req.query);
      if (!validation.isValid) {
        return error(res, 'Validation failed', 400, validation.errors);
      }

      const result = await paymentsService.listPayments(req.organizationId, {
        ...req.query,
        ...validation.data,
      });
      return success(res, 'Payments retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  },

  /** GET /api/payments/:id */
  async getPayment(req, res, next) {
    try {
      const payment = await paymentsService.getPaymentById(req.organizationId, req.params.id);
      return success(res, 'Payment retrieved successfully', { payment });
    } catch (err) {
      next(err);
    }
  },

  /** POST /api/payments — registers and posts in one transaction */
  async createPayment(req, res, next) {
    try {
      const validation = paymentsValidation.validateCreate(req.body);
      if (!validation.isValid) {
        return error(res, 'Validation failed', 400, validation.errors);
      }

      const payment = await paymentsService.createPayment(
        req.organizationId, req.user.id, validation.data
      );
      return created(res, 'Payment recorded successfully', { payment });
    } catch (err) {
      next(err);
    }
  },

  /** POST /api/payments/:id/cancel — admin only; reverses, never deletes */
  async cancelPayment(req, res, next) {
    try {
      const payment = await paymentsService.cancelPayment(
        req.organizationId, req.user.id, req.params.id
      );
      return success(res, 'Payment cancelled and reversed', { payment });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = paymentsController;
