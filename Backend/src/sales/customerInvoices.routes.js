const express = require('express');
const authMiddleware = require('../auth/auth.middleware');
const { resolveTenant } = require('../shared/tenant.middleware');
const salesController = require('./sales.controller');

const router = express.Router();

/**
 * Customer Invoices Routes
 *
 * Middleware chain on every route:
 *   authenticate → resolveTenant → authorize(...roles)
 *
 * project.md §3: Admin and Accountant generate invoices and receive payment;
 * a Contact only ever views their own, through the portal. Cancel is
 * admin-only because it reverses a posted ledger entry.
 */

router.use(authMiddleware.authenticate, resolveTenant);

router.get('/', authMiddleware.authorize('admin', 'manager'), salesController.listCustomerInvoices);
router.post('/', authMiddleware.authorize('admin', 'manager'), salesController.createCustomerInvoice);

router.get('/:id', authMiddleware.authorize('admin', 'manager'), salesController.getCustomerInvoice);
router.patch('/:id', authMiddleware.authorize('admin', 'manager'), salesController.updateCustomerInvoice);

router.post('/:id/post', authMiddleware.authorize('admin', 'manager'), salesController.postCustomerInvoice);
router.post('/:id/send', authMiddleware.authorize('admin', 'manager'), salesController.sendCustomerInvoice);
router.post('/:id/cancel', authMiddleware.authorize('admin'), salesController.cancelCustomerInvoice);

module.exports = router;
