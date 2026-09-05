import api from '@/lib/api';
import { toQueryString } from './masterdata.service';

export const purchaseOrdersService = {
  async list(params = {}, signal) {
    const res = await api.get(`/purchase-orders${toQueryString(params)}`, { signal });
    return res.data;
  },

  async get(id, signal) {
    const res = await api.get(`/purchase-orders/${id}`, { signal });
    return res.data;
  },

  async create(data) {
    const res = await api.post('/purchase-orders', data);
    return res.data;
  },

  async update(id, data) {
    const res = await api.patch(`/purchase-orders/${id}`, data);
    return res.data;
  },

  async confirm(id) {
    const res = await api.post(`/purchase-orders/${id}/confirm`, {});
    return res.data;
  },

  async createBill(id, journalId) {
    const res = await api.post(`/purchase-orders/${id}/create-bill`, { journal_id: journalId });
    return res.data;
  },

  async cancel(id) {
    const res = await api.post(`/purchase-orders/${id}/cancel`, {});
    return res.data;
  },
};

export const vendorBillsService = {
  async list(params = {}, signal) {
    const res = await api.get(`/vendor-bills${toQueryString(params)}`, { signal });
    return res.data;
  },

  async get(id, signal) {
    const res = await api.get(`/vendor-bills/${id}`, { signal });
    return res.data;
  },

  async create(data) {
    const res = await api.post('/vendor-bills', data);
    return res.data;
  },

  async update(id, data) {
    const res = await api.patch(`/vendor-bills/${id}`, data);
    return res.data;
  },

  async post(id) {
    const res = await api.post(`/vendor-bills/${id}/post`, {});
    return res.data;
  },

  async cancel(id) {
    const res = await api.post(`/vendor-bills/${id}/cancel`, {});
    return res.data;
  },
};
