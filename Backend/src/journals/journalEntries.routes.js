const express = require('express');
const authMiddleware = require('../auth/auth.middleware');
const { resolveTenant } = require('../shared/tenant.middleware');
const journalEntriesController = require('./journalEntries.controller');

const router = express.Router();

/**
 * Journal Entries Routes
 *
 * Middleware chain on every route:
 *   authenticate → resolveTenant → authorize(...roles)
 *
 * Both roles may read and post entries — project.md §3 lists "Journal Entries
 * – Create (via transactions)" under Admin AND Accountant, and a manual entry
 * is the same act done by hand.
 *
 * THERE IS DELIBERATELY NO PATCH AND NO DELETE ON A POSTED ENTRY.
 * Correction is by reversing entry only (technicalrequirement.md §3.8). The
 * missing verbs are the design, not an omission — and the triggers in
 * migration 028 enforce the same thing one layer down, so adding a route back
 * would simply fail at the database instead.
 */

router.use(authMiddleware.authenticate, resolveTenant);

// ─── Read ───────────────────────────────────────────────
router.get('/', authMiddleware.authorize('business_owner', 'accountant'), journalEntriesController.listEntries);

// ─── Post ───────────────────────────────────────────────
router.post('/', authMiddleware.authorize('business_owner', 'accountant'), journalEntriesController.createEntry);

// Declared before '/:id' so the literal segment is not captured as an id.
// Seeding the opening position is a one-time act of setting up the books.
router.post(
  '/opening-balances',
  authMiddleware.authorize('business_owner'),
  journalEntriesController.postOpeningBalances
);

router.get('/:id', authMiddleware.authorize('business_owner', 'accountant'), journalEntriesController.getEntry);

// ─── Correct ────────────────────────────────────────────
router.post(
  '/:id/reverse',
  authMiddleware.authorize('business_owner', 'accountant'),
  journalEntriesController.reverseEntry
);

module.exports = router;
