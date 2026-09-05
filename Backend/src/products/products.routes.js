const express = require('express');
const authMiddleware = require('../auth/auth.middleware');
const { resolveTenant } = require('../shared/tenant.middleware');
const productsController = require('./products.controller');

const router = express.Router();

/**
 * Products Routes
 *
 * Middleware chain on every route:
 *   authenticate → resolveTenant → authorize(...roles)
 *
 * PATCH is admin-only, and that is the whole point of the split: project.md §3
 * lists Modify under Admin and not under Accountant, so a manager can add a
 * product to the catalogue but cannot change what it sells for.
 */

router.use(authMiddleware.authenticate, resolveTenant);

// ─── Read ───────────────────────────────────────────────
router.get('/', authMiddleware.authorize('business_owner', 'accountant'), productsController.listProducts);
router.get('/:id', authMiddleware.authorize('business_owner', 'accountant'), productsController.getProduct);

// ─── Create — both roles (project.md §3) ────────────────
router.post('/', authMiddleware.authorize('business_owner', 'accountant'), productsController.createProduct);

// ─── Modify / archive — admin only ──────────────────────
router.patch('/:id', authMiddleware.authorize('business_owner'), productsController.updateProduct);
router.patch('/:id/archive', authMiddleware.authorize('business_owner'), productsController.archiveProduct);
router.patch('/:id/unarchive', authMiddleware.authorize('business_owner'), productsController.unarchiveProduct);

module.exports = router;
