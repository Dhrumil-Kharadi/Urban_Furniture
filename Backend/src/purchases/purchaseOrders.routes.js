const express = require('express');
const authMiddleware = require('../auth/auth.middleware');
const { resolveTenant } = require('../shared/tenant.middleware');
const purchasesController = require('./purchases.controller');

const router = express.Router();

/**
 * Purchase Orders Routes
 *
 * Middleware chain on every route:
 *   authenticate → resolveTenant → authorize(...roles)
 *
 * Phase 8 Security:
 * - authorize('admin', 'manager') on read, create, update, confirm, create-bill
 * - cancel is admin-only
 */

router.use(authMiddleware.authenticate, resolveTenant);

router.get('/', authMiddleware.authorize('admin', 'manager'), purchasesController.listPurchaseOrders);
router.post('/', authMiddleware.authorize('admin', 'manager'), purchasesController.createPurchaseOrder);

router.get('/:id', authMiddleware.authorize('admin', 'manager'), purchasesController.getPurchaseOrder);
router.patch('/:id', authMiddleware.authorize('admin', 'manager'), purchasesController.updatePurchaseOrder);

router.post('/:id/confirm', authMiddleware.authorize('admin', 'manager'), purchasesController.confirmPurchaseOrder);
router.post('/:id/create-bill', authMiddleware.authorize('admin', 'manager'), purchasesController.createBillFromPO);
router.post('/:id/cancel', authMiddleware.authorize('admin'), purchasesController.cancelPurchaseOrder);

module.exports = router;
