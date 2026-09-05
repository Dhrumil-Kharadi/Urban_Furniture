const express = require('express');
const authMiddleware = require('../auth/auth.middleware');
const { resolveTenant } = require('../shared/tenant.middleware');
const purchasesController = require('./purchases.controller');

const router = express.Router();

/**
 * Vendor Bills Routes
 *
 * Middleware chain on every route:
 *   authenticate → resolveTenant → authorize(...roles)
 *
 * Phase 8 Security:
 * - authorize('admin', 'manager') on read, create, update, post
 * - cancel is admin-only (reverses journal entry if posted)
 */

router.use(authMiddleware.authenticate, resolveTenant);

router.get('/', authMiddleware.authorize('admin', 'manager'), purchasesController.listVendorBills);
router.post('/', authMiddleware.authorize('admin', 'manager'), purchasesController.createVendorBill);

router.get('/:id', authMiddleware.authorize('admin', 'manager'), purchasesController.getVendorBill);
router.patch('/:id', authMiddleware.authorize('admin', 'manager'), purchasesController.updateVendorBill);

router.post('/:id/post', authMiddleware.authorize('admin', 'manager'), purchasesController.postVendorBill);
router.post('/:id/cancel', authMiddleware.authorize('admin'), purchasesController.cancelVendorBill);

module.exports = router;
