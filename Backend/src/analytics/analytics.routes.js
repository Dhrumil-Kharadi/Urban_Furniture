const express = require('express');
const authMiddleware = require('../auth/auth.middleware');
const { resolveTenant } = require('../shared/tenant.middleware');
const analyticsController = require('./analytics.controller');

const router = express.Router();

/**
 * Analytic Accounts Routes
 *
 * Middleware chain on every route:
 *   authenticate → resolveTenant → authorize(...roles)
 *
 * Both roles read and create; modify, archive and unarchive are the business
 * owner's alone (project.md §3 as finalised by §10 Decision 1).
 */

router.use(authMiddleware.authenticate, resolveTenant);

// ─── Read ───────────────────────────────────────────────
router.get('/', authMiddleware.authorize('business_owner', 'accountant'), analyticsController.listAnalyticAccounts);
router.get('/:id', authMiddleware.authorize('business_owner', 'accountant'), analyticsController.getAnalyticAccount);

// ─── Create — both roles ────────────────────────────────
router.post('/', authMiddleware.authorize('business_owner', 'accountant'), analyticsController.createAnalyticAccount);

// ─── Modify / archive — admin only ──────────────────────
router.patch('/:id', authMiddleware.authorize('business_owner'), analyticsController.updateAnalyticAccount);
router.patch('/:id/archive', authMiddleware.authorize('business_owner'), analyticsController.archiveAnalyticAccount);
router.patch('/:id/unarchive', authMiddleware.authorize('business_owner'), analyticsController.unarchiveAnalyticAccount);

module.exports = router;
