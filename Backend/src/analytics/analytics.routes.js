'use strict';

const express = require('express');
const authMiddleware = require('../auth/auth.middleware');
const { resolveTenant } = require('../shared/tenant.middleware');
const analyticsController = require('./analytics.controller');

const router = express.Router();

// Middleware chain for all analytic accounts routes
router.use(authMiddleware.authenticate, resolveTenant);

// GET /api/analytic-accounts - List analytic accounts (admin, manager)
router.get('/', authMiddleware.authorize('admin', 'manager'), analyticsController.listAnalyticAccounts);

// GET /api/analytic-accounts/:id - Get analytic account by ID (admin, manager)
router.get('/:id', authMiddleware.authorize('admin', 'manager'), analyticsController.getAnalyticAccountById);

// POST /api/analytic-accounts - Create analytic account (admin, manager)
router.post('/', authMiddleware.authorize('admin', 'manager'), analyticsController.createAnalyticAccount);

// PATCH /api/analytic-accounts/:id/archive - Archive analytic account (ADMIN ONLY)
router.patch('/:id/archive', authMiddleware.authorize('admin'), analyticsController.archiveAnalyticAccount);

// PATCH /api/analytic-accounts/:id/unarchive - Unarchive analytic account (ADMIN ONLY)
router.patch('/:id/unarchive', authMiddleware.authorize('admin'), analyticsController.unarchiveAnalyticAccount);

// PATCH /api/analytic-accounts/:id - Modify analytic account (ADMIN ONLY)
router.patch('/:id', authMiddleware.authorize('admin'), analyticsController.updateAnalyticAccount);

module.exports = router;
