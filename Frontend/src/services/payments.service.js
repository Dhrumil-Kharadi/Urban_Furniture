// ============================================================
// FILE: src/services/payments.service.js
//
// Registering money against invoices and bills.
//
// The allocations array is the part that matters: every payment says exactly
// which documents it settles and for how much, and those amounts must sum to
// the payment. The server refuses anything else — money allocated to nothing
// still posts to the ledger, with no document to explain it.
// ============================================================

import api from '@/lib/api';
import { toQueryString } from './masterdata.service';

export const paymentsService = {
  /**
   * @param {object} params - direction, method, status, contact_id, page, limit
   * @param {AbortSignal} [signal]
   * @returns {Promise<{ items: Array, meta: object }>}
   */
  async list(params = {}, signal) {
    const res = await api.get(`/payments${toQueryString(params)}`, { signal });
    return res.data;
  },

  /** @returns {Promise<{ payment: object }>} A payment with its allocations. */
  async get(id, signal) {
    const res = await api.get(`/payments/${id}`, { signal });
    return res.data;
  },

  /**
   * Register a payment. Recorded and posted in one server transaction.
   *
   * @param {object} data
   * @param {string} data.contact_id
   * @param {'inbound'|'outbound'} data.direction
   * @param {'cash'|'bank'|'card'} data.method - Must match the journal type.
   * @param {string} data.payment_date - Not in the future.
   * @param {string} data.amount - A STRING; must equal the allocation total.
   * @param {string} data.journal_id
   * @param {string} data.cash_account_id
   * @param {Array} data.allocations - [{ customer_invoice_id | vendor_bill_id, allocated_amount }]
   * @returns {Promise<{ payment: object }>}
   */
  async create(data) {
    const res = await api.post('/payments', data);
    return res.data;
  },

  /**
   * Admin only. Reverses the journal entry and restores each document's
   * balance exactly — it never deletes the payment.
   */
  async cancel(id) {
    const res = await api.post(`/payments/${id}/cancel`, {});
    return res.data;
  },
};

export default paymentsService;
