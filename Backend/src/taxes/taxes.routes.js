'use strict';

const express = require('express');
const authMiddleware = require('../auth/auth.middleware');
const { resolveTenant } = require('../shared/tenant.middleware');
const taxesController = require('./taxes.controller');

const router = express.Router();

// Middleware chain for all taxes routes
router.use(authMiddleware.authenticate, resolveTenant);

// GET /api/taxes - List taxes (admin, manager)
router.get('/', authMiddleware.authorize('admin', 'manager'), taxesController.listTaxes);

// GET /api/taxes/:id - Get tax by ID (admin, manager)
router.get('/:id', authMiddleware.authorize('admin', 'manager'), taxesController.getTaxById);

// POST /api/taxes - Create tax (admin, manager)
router.post('/', authMiddleware.authorize('admin', 'manager'), taxesController.createTax);

// PATCH /api/taxes/:id/archive - Archive tax (ADMIN ONLY)
router.patch('/:id/archive', authMiddleware.authorize('admin'), taxesController.archiveTax);

// PATCH /api/taxes/:id/unarchive - Unarchive tax (ADMIN ONLY)
router.patch('/:id/unarchive', authMiddleware.authorize('admin'), taxesController.unarchiveTax);

// PATCH /api/taxes/:id - Modify tax (ADMIN ONLY)
router.patch('/:id', authMiddleware.authorize('admin'), taxesController.updateTax);

module.exports = router;
