'use strict';

const express = require('express');
const authMiddleware = require('../auth/auth.middleware');
const { resolveTenant } = require('../shared/tenant.middleware');
const journalsController = require('./journals.controller');

const router = express.Router();

// Middleware chain for all journals routes
router.use(authMiddleware.authenticate, resolveTenant);

// GET /api/journals - List journals (admin, manager)
router.get('/', authMiddleware.authorize('admin', 'manager'), journalsController.listJournals);

// GET /api/journals/:id - Get journal by ID (admin, manager)
router.get('/:id', authMiddleware.authorize('admin', 'manager'), journalsController.getJournalById);

// POST /api/journals - Create journal (admin, manager)
router.post('/', authMiddleware.authorize('admin', 'manager'), journalsController.createJournal);

// PATCH /api/journals/:id/archive - Archive journal (ADMIN ONLY)
router.patch('/:id/archive', authMiddleware.authorize('admin'), journalsController.archiveJournal);

// PATCH /api/journals/:id/unarchive - Unarchive journal (ADMIN ONLY)
router.patch('/:id/unarchive', authMiddleware.authorize('admin'), journalsController.unarchiveJournal);

// PATCH /api/journals/:id - Modify journal (ADMIN ONLY)
router.patch('/:id', authMiddleware.authorize('admin'), journalsController.updateJournal);

module.exports = router;
