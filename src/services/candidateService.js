import * as api from '../lib/api';
import { cloudinaryService } from './cloudinaryService';

export const candidateService = {
  async getCandidatesByElection(electionId) {
    try {
      return await api.fetchCandidates({ electionId });
    } catch (error) {
      console.error('Error getting candidates:', error);
      return [];
    }
  },

  async getCandidatesByPosition(positionId) {
    try {
      return await api.fetchCandidates({ positionId });
    } catch (error) {
      console.error('Error getting candidates by position:', error);
      return [];
    }
  },

  async getCandidateById(id) {
    const pool = await api.fetchCandidatePool();
    return pool.find(c => c.id === id) || null;
  },

  convertFileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  },

  async createCandidate(candidateData, photoFile = null) {
    try {
      let photoUrl = candidateData.photoUrl || null;
      let cloudinaryPublicId = null;

      if (photoFile) {
        try {
          const folder = `candidates/${candidateData.electionId}/${candidateData.positionId}`;
          const uploadResult = await cloudinaryService.uploadImage(photoFile, folder);
          photoUrl = uploadResult.url;
          cloudinaryPublicId = uploadResult.publicId;
        } catch {
          if (!photoUrl) {
            photoUrl = await this.convertFileToBase64(photoFile);
          }
        }
      }

      return api.createCandidate({
        ...candidateData,
        photoUrl,
        cloudinaryPublicId,
      });
    } catch (error) {
      console.error('Error creating candidate:', error);
      throw error;
    }
  },

  async updateCandidate(id, candidateData, photoFile = null) {
    try {
      let photoUrl = candidateData.photoUrl || null;
      let cloudinaryPublicId = null;

      if (photoFile) {
        try {
          const folder = `candidates/${candidateData.electionId}/${candidateData.positionId}`;
          const uploadResult = await cloudinaryService.uploadImage(photoFile, folder);
          photoUrl = uploadResult.url;
          cloudinaryPublicId = uploadResult.publicId;
        } catch {
          if (!photoUrl) {
            photoUrl = await this.convertFileToBase64(photoFile);
          }
        }
      }

      return api.updateCandidate(id, {
        ...candidateData,
        photoUrl,
        ...(cloudinaryPublicId ? { cloudinaryPublicId } : {}),
      });
    } catch (error) {
      console.error('Error updating candidate:', error);
      throw error;
    }
  },

  async deleteCandidate(id) {
    return api.deleteCandidate(id);
  },
};
