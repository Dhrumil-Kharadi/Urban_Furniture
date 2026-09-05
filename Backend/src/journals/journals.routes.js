const express = require('express');
const authMiddleware = require('../auth/auth.middleware');
const { resolveTenant } = require('../shared/tenant.middleware');
const journalsController = require('./journals.controller');

const router = express.Router();

/**
 * Journals Routes
 *
 * Middleware chain on every route:
 *   authenticate → resolveTenant → authorize(...roles)
 *
 * Both roles read and create; modify, archive and unarchive are the business
 * owner's alone (project.md §3 as finalised by §10 Decision 1).
 *
 * Phase 7 mounts the journal-ENTRY endpoints separately at
 * /api/journal-entries. This router is the journal master only.
 */

router.use(authMiddleware.authenticate, resolveTenant);

// ─── Read ───────────────────────────────────────────────
router.get('/', authMiddleware.authorize('admin', 'manager'), journalsController.listJournals);
router.get('/:id', authMiddleware.authorize('admin', 'manager'), journalsController.getJournal);

// ─── Create — both roles ────────────────────────────────
router.post('/', authMiddleware.authorize('admin', 'manager'), journalsController.createJournal);

// ─── Modify / archive — admin only ──────────────────────
router.patch('/:id', authMiddleware.authorize('admin'), journalsController.updateJournal);
router.patch('/:id/archive', authMiddleware.authorize('admin'), journalsController.archiveJournal);
router.patch('/:id/unarchive', authMiddleware.authorize('admin'), journalsController.unarchiveJournal);

module.exports = router;
