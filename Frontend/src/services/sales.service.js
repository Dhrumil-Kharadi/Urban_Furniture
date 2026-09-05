import api from '@/lib/api';
import { toQueryString } from './masterdata.service';

export const salesOrdersService = {
  async list(params = {}, signal) {
    const res = await api.get(`/sales-orders${toQueryString(params)}`, { signal });
    return res.data;
  },

  async get(id, signal) {
    const res = await api.get(`/sales-orders/${id}`, { signal });
    return res.data;
  },

  async create(data) {
    const res = await api.post('/sales-orders', data);
    return res.data;
  },

  async update(id, data) {
    const res = await api.patch(`/sales-orders/${id}`, data);
    return res.data;
  },

  async confirm(id) {
    const res = await api.post(`/sales-orders/${id}/confirm`, {});
    return res.data;
  },

  async createInvoice(id, journalId) {
    const res = await api.post(`/sales-orders/${id}/create-invoice`, { journal_id: journalId });
    return res.data;
  },

  async cancel(id) {
    const res = await api.post(`/sales-orders/${id}/cancel`, {});
    return res.data;
  },
};

export const customerInvoicesService = {
  async list(params = {}, signal) {
    const res = await api.get(`/customer-invoices${toQueryString(params)}`, { signal });
    return res.data;
  },

  async get(id, signal) {
    const res = await api.get(`/customer-invoices/${id}`, { signal });
    return res.data;
  },

  async create(data) {
    const res = await api.post('/customer-invoices', data);
    return res.data;
  },

  async update(id, data) {
    const res = await api.patch(`/customer-invoices/${id}`, data);
    return res.data;
  },

  async post(id) {
    const res = await api.post(`/customer-invoices/${id}/post`, {});
    return res.data;
  },

  async send(id) {
    const res = await api.post(`/customer-invoices/${id}/send`, {});
    return res.data;
  },

  async cancel(id) {
    const res = await api.post(`/customer-invoices/${id}/cancel`, {});
    return res.data;
  },
};
