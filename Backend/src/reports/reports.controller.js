/**
 * Reports Controller
 *
 * Exposes real-time financial reporting endpoints:
 * - GET /api/reports/balance-sheet?asOfDate=
 * - GET /api/reports/profit-loss?fromDate=&toDate=
 * - GET /api/reports/budget?budgetId=&fromDate=&toDate=
 * - GET /api/reports/:type/export?format=csv
 */

const { generateBalanceSheet } = require('./reports.balanceSheet');
const { generateProfitLoss } = require('./reports.profitLoss');
const { generateBudgetReport } = require('./reports.budget');
const { exportBalanceSheetCsv, exportProfitLossCsv, exportBudgetCsv } = require('./reports.export');
const accountingRepository = require('../accounting/accounting.repository');
const { success, error } = require('../utils/response');

const reportsController = {
  async getBalanceSheet(req, res, next) {
    try {
      const { asOfDate } = req.query;
      const data = await generateBalanceSheet(req.organizationId, asOfDate);
      return success(res, 'Balance sheet generated successfully', data);
    } catch (err) {
      next(err);
    }
  },

  async getProfitLoss(req, res, next) {
    try {
      const { fromDate, toDate } = req.query;
      const data = await generateProfitLoss(req.organizationId, fromDate, toDate);
      return success(res, 'Profit and loss report generated successfully', data);
    } catch (err) {
      next(err);
    }
  },

  async getBudgetReport(req, res, next) {
    try {
      const { budgetId, fromDate, toDate } = req.query;
      const data = await generateBudgetReport(req.organizationId, { budgetId, fromDate, toDate });
      return success(res, 'Budget report generated successfully', data);
    } catch (err) {
      next(err);
    }
  },

  async getGeneralLedger(req, res, next) {
    try {
      const data = await accountingRepository.listLedgerLines(null, req.organizationId, req.query);
      return success(res, 'General ledger retrieved successfully', data);
    } catch (err) {
      next(err);
    }
  },

  async exportReport(req, res, next) {
    try {
      const { type } = req.params;
      const { asOfDate, fromDate, toDate, budgetId } = req.query;

      let csvData = '';
      let filename = `report_${type}_${new Date().toISOString().slice(0, 10)}.csv`;

      if (type === 'balance-sheet') {
        const data = await generateBalanceSheet(req.organizationId, asOfDate);
        csvData = exportBalanceSheetCsv(data);
        filename = `balance_sheet_${data.asOfDate}.csv`;
      } else if (type === 'profit-loss') {
        const data = await generateProfitLoss(req.organizationId, fromDate, toDate);
        csvData = exportProfitLossCsv(data);
        filename = `profit_loss_${data.period.fromDate}_to_${data.period.toDate}.csv`;
      } else if (type === 'budget') {
        const data = await generateBudgetReport(req.organizationId, { budgetId, fromDate, toDate });
        csvData = exportBudgetCsv(data);
        filename = `budget_report_${new Date().toISOString().slice(0, 10)}.csv`;
      } else {
        return error(res, `Unknown report type for export: ${type}`, 400);
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.status(200).send(csvData);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = reportsController;
