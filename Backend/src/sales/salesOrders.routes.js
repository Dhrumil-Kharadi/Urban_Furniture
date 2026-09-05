const express = require('express');
const authMiddleware = require('../auth/auth.middleware');
const { resolveTenant } = require('../shared/tenant.middleware');
const salesController = require('./sales.controller');

const router = express.Router();

/**
 * Sales Orders Routes
 *
 * Middleware chain on every route:
 *   authenticate → resolveTenant → authorize(...roles)
 *
 * RBAC:
 * - authorize('business_owner', 'accountant') on read, create, update, confirm, create-invoice
 * - cancel is admin-only
 */

router.use(authMiddleware.authenticate, resolveTenant);

router.get('/', authMiddleware.authorize('business_owner', 'accountant'), salesController.listSalesOrders);
router.post('/', authMiddleware.authorize('business_owner', 'accountant'), salesController.createSalesOrder);

router.get('/:id', authMiddleware.authorize('business_owner', 'accountant'), salesController.getSalesOrder);
router.patch('/:id', authMiddleware.authorize('business_owner', 'accountant'), salesController.updateSalesOrder);

router.post('/:id/confirm', authMiddleware.authorize('business_owner', 'accountant'), salesController.confirmSalesOrder);
router.post('/:id/create-invoice', authMiddleware.authorize('business_owner', 'accountant'), salesController.createInvoiceFromSO);
router.post('/:id/cancel', authMiddleware.authorize('business_owner'), salesController.cancelSalesOrder);

module.exports = router;
