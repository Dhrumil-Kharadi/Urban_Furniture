/**
 * Budgets Routes
 *
 * Middleware chain:
 *   authenticate → resolveTenant → authorize(...roles)
 *
 * Role mapping:
 *   admin, manager: list, get, create
 *   admin only: modify, archive
 */

const express = require('express');
const authMiddleware = require('../auth/auth.middleware');
const { resolveTenant } = require('../shared/tenant.middleware');
const budgetsController = require('./budgets.controller');

const router = express.Router();

router.use(authMiddleware.authenticate, resolveTenant);

// Read (admin, manager)
router.get('/', authMiddleware.authorize('business_owner', 'accountant'), budgetsController.listBudgets);
router.get('/:id', authMiddleware.authorize('business_owner', 'accountant'), budgetsController.getBudget);

// Create (admin, manager)
router.post('/', authMiddleware.authorize('business_owner', 'accountant'), budgetsController.createBudget);

// Modify & Archive (admin only)
router.patch('/:id', authMiddleware.authorize('business_owner'), budgetsController.updateBudget);
router.patch('/:id/archive', authMiddleware.authorize('business_owner'), budgetsController.archiveBudget);

module.exports = router;
