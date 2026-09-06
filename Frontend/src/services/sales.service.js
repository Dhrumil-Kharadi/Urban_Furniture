// ============================================================
// FILE: src/services/sales.service.js
//
// Sales Orders and Customer Invoices — the mirror of purchases.service.js,
// and deliberately the same shape so the two sides read together.
//
// Note what is NOT sent anywhere below: totals. The server recomputes every
// amount from the lines and ignores anything a client claims, so sending them
// would only imply they mattered.
// ============================================================

import api from '@/lib/api';
import { toQueryString } from './masterdata.service';

export const salesOrdersService = {
  /**
   * @param {object} params - status, customer_contact_id, page, limit
   * @param {AbortSignal} [signal]
   * @returns {Promise<{ items: Array, meta: object }>}
   */
  async list(params = {}, signal) {
    const res = await api.get(`/sales-orders${toQueryString(params)}`, { signal });
    return res.data;
  },

  /**
   * @param {string} id
   * @param {AbortSignal} [signal]
   * @returns {Promise<{ salesOrder: object }>}
   */
  async get(id, signal) {
    const res = await api.get(`/sales-orders/${id}`, { signal });
    return res.data;
  },

  /** @param {object} data @returns {Promise<{ salesOrder: object }>} */
  async create(data) {
    const res = await api.post('/sales-orders', data);
    return res.data;
  },

  /** Draft only — the server returns 409 for anything else. */
  async update(id, data) {
    const res = await api.patch(`/sales-orders/${id}`, data);
    return res.data;
  },

  /** Assigns the real SO number and moves the order to 'confirmed'. */
  async confirm(id) {
    const res = await api.post(`/sales-orders/${id}/confirm`, {});
    return res.data;
  },

  /**
   * Convert to a DRAFT customer invoice (project.md §5.2.3). Posting it is a
   * separate, deliberate act.
   *
   * @param {string} id
   * @param {{ journal_id: string, invoice_date?: string, due_date?: string }} payload
   * @returns {Promise<{ invoice: object }>}
   */
  async createInvoice(id, payload) {
    const res = await api.post(`/sales-orders/${id}/create-invoice`, payload);
    return res.data;
  },

  /** Admin only. */
  async cancel(id) {
    const res = await api.post(`/sales-orders/${id}/cancel`, {});
    return res.data;
  },
};

export const customerInvoicesService = {
  /**
   * @param {object} params - status, customer_contact_id, overdue, page, limit
   * @param {AbortSignal} [signal]
   * @returns {Promise<{ items: Array, meta: object }>}
   */
  async list(params = {}, signal) {
    const res = await api.get(`/customer-invoices${toQueryString(params)}`, { signal });
    return res.data;
  },

  /** @returns {Promise<{ invoice: object }>} */
  async get(id, signal) {
    const res = await api.get(`/customer-invoices/${id}`, { signal });
    return res.data;
  },

  /** Public invoice view (no auth required) */
  async getPublic(id, signal) {
    const res = await api.get(`/customer-invoices/public/${id}`, { signal });
    return res.data;
  },

  async create(data) {
    const res = await api.post('/customer-invoices', data);
    return res.data;
  },

  /** Draft only. */
  async update(id, data) {
    const res = await api.patch(`/customer-invoices/${id}`, data);
    return res.data;
  },

  /**
   * Post the invoice — this is what generates the journal entry
   * (Dr Debtors / Cr Sale Income / Cr Output Tax Payable) and makes the
   * amount collectable. It cannot be undone, only reversed.
   */
  async post(id) {
    const res = await api.post(`/customer-invoices/${id}/post`, {});
    return res.data;
  },

  /** Email the invoice to the customer (project.md §9.7). */
  async send(id) {
    const res = await api.post(`/customer-invoices/${id}/send`, {});
    return res.data;
  },

  /** Admin only — reverses the journal entry rather than deleting it. */
  async cancel(id) {
    const res = await api.post(`/customer-invoices/${id}/cancel`, {});
    return res.data;
  },
};

const salesService = { salesOrdersService, customerInvoicesService };
export default salesService;
