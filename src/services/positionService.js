import * as api from '../lib/api';

export const positionService = {
  async getPositionsByElection(electionId) {
    return api.fetchPositions(electionId);
  },

  async createPosition(data) {
    return api.createPosition(data);
  },

  async updatePosition(id, data) {
    return api.updatePosition(id, data);
  },

  async deletePosition(id) {
    return api.deletePosition(id);
  },
};
