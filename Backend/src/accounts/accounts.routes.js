const express = require('express');
const authMiddleware = require('../auth/auth.middleware');
const { resolveTenant } = require('../shared/tenant.middleware');
const accountsController = require('./accounts.controller');

const router = express.Router();

/**
 * Accounts Routes (Chart of Accounts)
 *
 * Middleware chain on every route:
 *   authenticate → resolveTenant → authorize(...roles)
 *
 * Both roles read and create; modify, archive and unarchive are the business
 * owner's alone (project.md §3 as finalised by §10 Decision 1).
 */

router.use(authMiddleware.authenticate, resolveTenant);

// ─── Read ───────────────────────────────────────────────
router.get('/', authMiddleware.authorize('business_owner', 'accountant'), accountsController.listAccounts);

// Declared before '/:id' so the literal segment is not captured as an id.
router.get('/tree', authMiddleware.authorize('business_owner', 'accountant'), accountsController.getAccountTree);

router.get('/:id', authMiddleware.authorize('business_owner', 'accountant'), accountsController.getAccount);

// ─── Create — both roles ────────────────────────────────
router.post('/', authMiddleware.authorize('business_owner', 'accountant'), accountsController.createAccount);

// ─── Modify / archive — admin only ──────────────────────
router.patch('/:id', authMiddleware.authorize('business_owner'), accountsController.updateAccount);
router.patch('/:id/archive', authMiddleware.authorize('business_owner'), accountsController.archiveAccount);
router.patch('/:id/unarchive', authMiddleware.authorize('business_owner'), accountsController.unarchiveAccount);

module.exports = router;
