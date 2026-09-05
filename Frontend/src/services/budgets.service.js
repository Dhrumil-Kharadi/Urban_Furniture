// ============================================================
// FILE: src/services/budgets.service.js
//
// API client for Budgets management.
// ============================================================

import api from '@/lib/api';
import { toQueryString } from '@/services/masterdata.service';

export const budgetsService = {
  async list(params = {}) {
    const qs = toQueryString(params);
    return api.get(`/budgets${qs}`);
  },

  async get(id) {
    return api.get(`/budgets/${id}`);
  },

  async create(payload) {
    return api.post('/budgets', payload);
  },

  async update(id, payload) {
    return api.patch(`/budgets/${id}`, payload);
  },

  async archive(id) {
    return api.patch(`/budgets/${id}/archive`);
  },

  async getLines(id, params = {}) {
    const qs = toQueryString(params);
    return api.get(`/budgets/${id}/lines${qs}`);
  },
};

export default budgetsService;
