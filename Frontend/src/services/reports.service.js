// ============================================================
// FILE: src/services/reports.service.js
//
// API client for Financial Reports: Balance Sheet, Profit & Loss, Budget Analysis.
// ============================================================

import api from '@/lib/api';
import { toQueryString } from '@/services/masterdata.service';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export const reportsService = {
  async getBalanceSheet(params = {}) {
    const qs = toQueryString(params);
    return api.get(`/reports/balance-sheet${qs}`);
  },

  async getProfitLoss(params = {}) {
    const qs = toQueryString(params);
    return api.get(`/reports/profit-loss${qs}`);
  },

  async getBudgetReport(params = {}) {
    const qs = toQueryString(params);
    return api.get(`/reports/budget${qs}`);
  },

  exportCsvUrl(type, params = {}) {
    const qs = toQueryString(params);
    return `${BASE_URL}/reports/${type}/export${qs}`;
  },
};

export default reportsService;
