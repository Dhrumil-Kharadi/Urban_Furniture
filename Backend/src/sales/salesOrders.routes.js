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
 * project.md §3: Admin and Accountant both create and edit sales orders;
 * a Contact never touches one. Cancel is admin-only, matching Phase 8.
 */

router.use(authMiddleware.authenticate, resolveTenant);

router.get('/', authMiddleware.authorize('admin', 'manager'), salesController.listSalesOrders);
router.post('/', authMiddleware.authorize('admin', 'manager'), salesController.createSalesOrder);

router.get('/:id', authMiddleware.authorize('admin', 'manager'), salesController.getSalesOrder);
router.patch('/:id', authMiddleware.authorize('admin', 'manager'), salesController.updateSalesOrder);

router.post('/:id/confirm', authMiddleware.authorize('admin', 'manager'), salesController.confirmSalesOrder);
router.post('/:id/create-invoice', authMiddleware.authorize('admin', 'manager'), salesController.createInvoiceFromSO);
router.post('/:id/cancel', authMiddleware.authorize('admin'), salesController.cancelSalesOrder);

module.exports = router;
