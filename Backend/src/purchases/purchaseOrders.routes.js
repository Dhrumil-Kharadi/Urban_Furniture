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
 * - authorize('business_owner', 'accountant') on read, create, update, confirm, create-bill
 * - cancel is admin-only
 */

router.use(authMiddleware.authenticate, resolveTenant);

router.get('/', authMiddleware.authorize('business_owner', 'accountant'), purchasesController.listPurchaseOrders);
router.post('/', authMiddleware.authorize('business_owner', 'accountant'), purchasesController.createPurchaseOrder);

router.get('/:id', authMiddleware.authorize('business_owner', 'accountant'), purchasesController.getPurchaseOrder);
router.patch('/:id', authMiddleware.authorize('business_owner', 'accountant'), purchasesController.updatePurchaseOrder);

router.post('/:id/confirm', authMiddleware.authorize('business_owner', 'accountant'), purchasesController.confirmPurchaseOrder);
router.post('/:id/create-bill', authMiddleware.authorize('business_owner', 'accountant'), purchasesController.createBillFromPO);
router.post('/:id/cancel', authMiddleware.authorize('business_owner'), purchasesController.cancelPurchaseOrder);

module.exports = router;
