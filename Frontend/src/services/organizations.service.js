import api from '@/lib/api';

export const organizationsService = {
  async getCurrent() {
    return api.get('/organizations/current');
  },

  async updateCurrent(payload) {
    return api.patch('/organizations/current', payload);
  },
};

export default organizationsService;
