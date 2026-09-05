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
router.get('/', authMiddleware.authorize('business_owner', 'accountant'), journalsController.listJournals);
router.get('/:id', authMiddleware.authorize('business_owner', 'accountant'), journalsController.getJournal);

// ─── Create — both roles ────────────────────────────────
router.post('/', authMiddleware.authorize('business_owner', 'accountant'), journalsController.createJournal);

// ─── Modify / archive — admin only ──────────────────────
router.patch('/:id', authMiddleware.authorize('business_owner'), journalsController.updateJournal);
router.patch('/:id/archive', authMiddleware.authorize('business_owner'), journalsController.archiveJournal);
router.patch('/:id/unarchive', authMiddleware.authorize('business_owner'), journalsController.unarchiveJournal);

module.exports = router;
