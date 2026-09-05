const express = require('express');
const authMiddleware = require('../auth/auth.middleware');
const { resolveTenant } = require('../shared/tenant.middleware');
const paymentsController = require('./payments.controller');

const router = express.Router();

/**
 * Payments Routes
 *
 * Middleware chain on every route:
 *   authenticate → resolveTenant → authorize(...roles)
 *
 * project.md §3 is explicit that a Contact NEVER records a Cash/Bank payment —
 * those are entered internally by Admin or Accountant when money is received
 * offline. A Contact pays by card through the portal, which is the gateway
 * flow in src/gateway/, not this module. Hence 'user' appears nowhere here.
 *
 * Cancellation is admin-only because it reverses a posted ledger entry.
 */

router.use(authMiddleware.authenticate, resolveTenant);

router.get('/', authMiddleware.authorize('admin', 'manager'), paymentsController.listPayments);
router.post('/', authMiddleware.authorize('admin', 'manager'), paymentsController.createPayment);

router.get('/:id', authMiddleware.authorize('admin', 'manager'), paymentsController.getPayment);

router.post('/:id/cancel', authMiddleware.authorize('admin'), paymentsController.cancelPayment);

module.exports = router;
