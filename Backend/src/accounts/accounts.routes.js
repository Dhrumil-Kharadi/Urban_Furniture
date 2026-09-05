'use strict';

const express = require('express');
const authMiddleware = require('../auth/auth.middleware');
const { resolveTenant } = require('../shared/tenant.middleware');
const accountsController = require('./accounts.controller');

const router = express.Router();

// Middleware chain for all accounts routes
router.use(authMiddleware.authenticate, resolveTenant);

// GET /api/accounts/tree - Hierarchical tree (must be before /:id)
router.get('/tree', authMiddleware.authorize('admin', 'manager'), accountsController.getAccountTree);

// GET /api/accounts - List accounts (admin, manager)
router.get('/', authMiddleware.authorize('admin', 'manager'), accountsController.listAccounts);

// GET /api/accounts/:id - Get account by ID (admin, manager)
router.get('/:id', authMiddleware.authorize('admin', 'manager'), accountsController.getAccountById);

// POST /api/accounts - Create account (admin, manager)
router.post('/', authMiddleware.authorize('admin', 'manager'), accountsController.createAccount);

// PATCH /api/accounts/:id/archive - Archive account (ADMIN ONLY)
router.patch('/:id/archive', authMiddleware.authorize('admin'), accountsController.archiveAccount);

// PATCH /api/accounts/:id/unarchive - Unarchive account (ADMIN ONLY)
router.patch('/:id/unarchive', authMiddleware.authorize('admin'), accountsController.unarchiveAccount);

// PATCH /api/accounts/:id - Modify account (ADMIN ONLY)
router.patch('/:id', authMiddleware.authorize('admin'), accountsController.updateAccount);

module.exports = router;
