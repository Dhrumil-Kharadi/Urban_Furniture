/**
 * Reports Routes
 *
 * Middleware chain:
 *   authenticate → resolveTenant → authorize('business_owner', 'accountant')
 *
 * Contacts (customer / vendor) have zero access to financial reports (project.md §3).
 */

const express = require('express');
const authMiddleware = require('../auth/auth.middleware');
const { resolveTenant } = require('../shared/tenant.middleware');
const reportsController = require('./reports.controller');

const router = express.Router();

router.use(authMiddleware.authenticate, resolveTenant, authMiddleware.authorize('business_owner', 'accountant'));

router.get('/balance-sheet', reportsController.getBalanceSheet);
router.get('/profit-loss', reportsController.getProfitLoss);
router.get('/budget', reportsController.getBudgetReport);
router.get('/general-ledger', reportsController.getGeneralLedger);
router.get('/trial-balance', reportsController.getTrialBalance);
router.get('/aged-receivables', reportsController.getAgedReceivables);
router.get('/aged-payables', reportsController.getAgedPayables);
router.get('/:type/export', reportsController.exportReport);

module.exports = router;
