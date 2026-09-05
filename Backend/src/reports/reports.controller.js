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
const dashboardRepository = require('../dashboard/dashboard.repository');
const { pool } = require('../config/db');
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

  async getTrialBalance(req, res, next) {
    try {
      const targetDate = req.query.asOfDate || new Date().toISOString().slice(0, 10);
      const rows = await accountingRepository.getAccountBalances(null, req.organizationId, targetDate);

      let totalDebit = 0;
      let totalCredit = 0;

      const items = rows.map((r) => {
        const debit = parseFloat(r.total_debit || 0);
        const credit = parseFloat(r.total_credit || 0);
        const balance = parseFloat(r.balance || 0);
        totalDebit += debit;
        totalCredit += credit;

        return {
          accountId: r.account_id,
          code: r.code,
          name: r.name,
          accountType: r.account_type,
          openingBalance: parseFloat(r.opening_balance || 0).toFixed(2),
          totalDebit: debit.toFixed(2),
          totalCredit: credit.toFixed(2),
          balance: balance.toFixed(2),
        };
      });

      const isBalanced = Math.abs(totalDebit - totalCredit) < 0.005;

      return success(res, 'Trial balance retrieved successfully', {
        asOfDate: targetDate,
        isBalanced,
        totalDebit: totalDebit.toFixed(2),
        totalCredit: totalCredit.toFixed(2),
        items,
      });
    } catch (err) {
      next(err);
    }
  },

  async getAgedReceivables(req, res, next) {
    try {
      const summary = await dashboardRepository.getReceivableAging(null, req.organizationId);
      const invoicesRes = await pool.query(
        `SELECT ci.id, ci.invoice_number, ci.invoice_date, ci.due_date,
                ci.total_amount, ci.amount_paid, ci.amount_due,
                c.name AS customer_name,
                CASE
                  WHEN CURRENT_DATE - ci.due_date <= 30 THEN '0-30 days'
                  WHEN CURRENT_DATE - ci.due_date BETWEEN 31 AND 60 THEN '31-60 days'
                  WHEN CURRENT_DATE - ci.due_date BETWEEN 61 AND 90 THEN '61-90 days'
                  ELSE '90+ days'
                END AS aging_bucket
           FROM customer_invoices ci
           JOIN contacts c ON c.id = ci.customer_contact_id
          WHERE ci.organization_id = $1 AND ci.status IN ('posted', 'partially_paid')
          ORDER BY ci.due_date ASC`,
        [req.organizationId]
      );

      return success(res, 'Aged receivables retrieved successfully', {
        buckets: summary,
        items: invoicesRes.rows,
      });
    } catch (err) {
      next(err);
    }
  },

  async getAgedPayables(req, res, next) {
    try {
      const summaryRes = await pool.query(
        `SELECT
           COALESCE(SUM(CASE WHEN CURRENT_DATE - due_date <= 30 THEN amount_due ELSE 0 END), 0) AS bucket_0_30,
           COALESCE(SUM(CASE WHEN CURRENT_DATE - due_date BETWEEN 31 AND 60 THEN amount_due ELSE 0 END), 0) AS bucket_31_60,
           COALESCE(SUM(CASE WHEN CURRENT_DATE - due_date BETWEEN 61 AND 90 THEN amount_due ELSE 0 END), 0) AS bucket_61_90,
           COALESCE(SUM(CASE WHEN CURRENT_DATE - due_date > 90 THEN amount_due ELSE 0 END), 0) AS bucket_90_plus
          FROM vendor_bills
         WHERE organization_id = $1
           AND status IN ('posted', 'partially_paid')`,
        [req.organizationId]
      );

      const r = summaryRes.rows[0] || {};
      const buckets = [
        { bucket: '0-30 days', amount: r.bucket_0_30 || '0.00' },
        { bucket: '31-60 days', amount: r.bucket_31_60 || '0.00' },
        { bucket: '61-90 days', amount: r.bucket_61_90 || '0.00' },
        { bucket: '90+ days', amount: r.bucket_90_plus || '0.00' },
      ];

      const billsRes = await pool.query(
        `SELECT vb.id, vb.bill_number, vb.bill_date, vb.due_date,
                vb.total_amount, vb.amount_paid, vb.amount_due,
                c.name AS vendor_name,
                CASE
                  WHEN CURRENT_DATE - vb.due_date <= 30 THEN '0-30 days'
                  WHEN CURRENT_DATE - vb.due_date BETWEEN 31 AND 60 THEN '31-60 days'
                  WHEN CURRENT_DATE - vb.due_date BETWEEN 61 AND 90 THEN '61-90 days'
                  ELSE '90+ days'
                END AS aging_bucket
           FROM vendor_bills vb
           JOIN contacts c ON c.id = vb.vendor_contact_id
          WHERE vb.organization_id = $1 AND vb.status IN ('posted', 'partially_paid')
          ORDER BY vb.due_date ASC`,
        [req.organizationId]
      );

      return success(res, 'Aged payables retrieved successfully', {
        buckets,
        items: billsRes.rows,
      });
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
