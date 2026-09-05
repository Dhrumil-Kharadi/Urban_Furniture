const express = require('express');
const authMiddleware = require('../auth/auth.middleware');
const { resolveTenant } = require('../shared/tenant.middleware');
const taxesController = require('./taxes.controller');

const router = express.Router();

/**
 * Taxes Routes
 *
 * Middleware chain on every route:
 *   authenticate → resolveTenant → authorize(...roles)
 *
 * Both roles read and create; modify, archive and unarchive are the business
 * owner's alone (project.md §3 as finalised by §10 Decision 1).
 *
 * project.md §7 gives tax its own Chart of Accounts account, so a rate
 * change is an accounting decision, not a settings tweak.
 */

router.use(authMiddleware.authenticate, resolveTenant);

// ─── Read ───────────────────────────────────────────────
router.get('/', authMiddleware.authorize('admin', 'manager'), taxesController.listTaxes);

router.get('/:id', authMiddleware.authorize('admin', 'manager'), taxesController.getTax);

// ─── Create — both roles ────────────────────────────────
router.post('/', authMiddleware.authorize('admin', 'manager'), taxesController.createTax);

// ─── Modify / archive — admin only ──────────────────────
router.patch('/:id', authMiddleware.authorize('admin'), taxesController.updateTax);
router.patch('/:id/archive', authMiddleware.authorize('admin'), taxesController.archiveTax);
router.patch('/:id/unarchive', authMiddleware.authorize('admin'), taxesController.unarchiveTax);

module.exports = router;
