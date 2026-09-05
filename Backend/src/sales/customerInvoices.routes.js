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
 * RBAC:
 * - authorize('business_owner', 'accountant') on read, create, update, post, send
 * - cancel is admin-only (reverses journal entry if posted)
 */

router.use(authMiddleware.authenticate, resolveTenant);

router.get('/', authMiddleware.authorize('business_owner', 'accountant'), salesController.listCustomerInvoices);
router.post('/', authMiddleware.authorize('business_owner', 'accountant'), salesController.createCustomerInvoice);

router.get('/:id', authMiddleware.authorize('business_owner', 'accountant'), salesController.getCustomerInvoice);
router.patch('/:id', authMiddleware.authorize('business_owner', 'accountant'), salesController.updateCustomerInvoice);

router.post('/:id/post', authMiddleware.authorize('business_owner', 'accountant'), salesController.postCustomerInvoice);
router.post('/:id/send', authMiddleware.authorize('business_owner', 'accountant'), salesController.sendCustomerInvoice);
router.post('/:id/cancel', authMiddleware.authorize('business_owner'), salesController.cancelCustomerInvoice);

module.exports = router;
