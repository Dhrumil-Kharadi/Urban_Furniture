// ============================================================
// FILE: src/services/portal.service.js
//
// API client for Contact Portal: self-service invoices, bills statement, and card payments.
// ============================================================

import api from '@/lib/api';
import { toQueryString } from '@/services/masterdata.service';

export const portalService = {
  async getSummary() {
    return api.get('/portal/summary');
  },

  async listInvoices(params = {}) {
    const qs = toQueryString(params);
    return api.get(`/portal/invoices${qs}`);
  },

  async getInvoice(id) {
    return api.get(`/portal/invoices/${id}`);
  },

  async listBills(params = {}) {
    const qs = toQueryString(params);
    return api.get(`/portal/bills${qs}`);
  },

  async createPayIntent(invoiceId) {
    return api.post(`/portal/invoices/${invoiceId}/pay-intent`, {});
  },

  async verifyPayment(payload) {
    return api.post('/portal/payments/verify', payload);
  },
};

export default portalService;
