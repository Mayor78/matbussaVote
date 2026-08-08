import * as api from '../lib/api';

export const electionService = {
  async getAllElections() {
    return api.fetchElections();
  },

  async getElectionById(id) {
    return api.fetchElection(id);
  },

  async createElection(data) {
    return api.createElection(data);
  },

  async updateElection(id, data) {
    return api.updateElection(id, data);
  },

  async deleteElection(id) {
    return api.deleteElection(id);
  },

  async updateStatus(id, status) {
    return api.updateElectionStatus(id, status);
  },

  async publishElection(id) {
    return this.updateStatus(id, 'published');
  },

  async openElection(id) {
    return this.updateStatus(id, 'open');
  },

  async closeElection(id) {
    return this.updateStatus(id, 'closed');
  },
};
