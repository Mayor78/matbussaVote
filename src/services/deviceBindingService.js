import * as api from '../lib/api';

export const deviceBindingService = {
  async checkBinding(deviceSignature, studentEmail, electionId) {
    const result = await api.checkDevice(deviceSignature, studentEmail, electionId);
    return result;
  },

  async bindDevice(deviceSignature, studentId, studentEmail, electionId) {
    await api.bindDevice(deviceSignature, studentId, studentEmail, electionId);
    return true;
  },

  async resetBinding(deviceSignature, electionId) {
    return api.resetDeviceBinding(deviceSignature, electionId);
  },
};
