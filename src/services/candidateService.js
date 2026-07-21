import { db } from '../lib/firebase';
import { 
  collection, doc, addDoc, updateDoc, deleteDoc, getDocs, 
  getDoc, query, where 
} from 'firebase/firestore';
import { cloudinaryService } from './cloudinaryService';

export const candidateService = {
  async getCandidatesByElection(electionId) {
    try {
      const q = query(collection(db, 'candidates'), where('electionId', '==', electionId));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error getting candidates:', error);
      return [];
    }
  },

  async getCandidatesByPosition(positionId) {
    try {
      const q = query(collection(db, 'candidates'), where('positionId', '==', positionId));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error getting candidates by position:', error);
      return [];
    }
  },

  async getCandidateById(id) {
    const docRef = doc(db, 'candidates', id);
    const snapshot = await getDoc(docRef);
    return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
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
      let photoUrl = null;
      let cloudinaryPublicId = null;
      
      if (photoFile) {
        try {
          const folder = `candidates/${candidateData.electionId}/${candidateData.positionId}`;
          const uploadResult = await cloudinaryService.uploadImage(photoFile, folder);
          photoUrl = uploadResult.url;
          cloudinaryPublicId = uploadResult.publicId;
        } catch (uploadError) {
          console.warn('Cloudinary upload failed, falling back to Base64:', uploadError);
          photoUrl = await this.convertFileToBase64(photoFile);
        }
      }

      const now = new Date().toISOString();
      const newCandidate = {
        electionId: candidateData.electionId,
        positionId: candidateData.positionId,
        fullName: candidateData.fullName,
        level: candidateData.level,
        manifesto: candidateData.manifesto || '',
        photoUrl,
        cloudinaryPublicId,
        voteCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      
      const docRef = await addDoc(collection(db, 'candidates'), newCandidate);
      return { id: docRef.id, ...newCandidate };
    } catch (error) {
      console.error('Error creating candidate:', error);
      throw error;
    }
  },

  async updateCandidate(id, candidateData, photoFile = null) {
    try {
      const updateData = {
        ...(candidateData.fullName !== undefined && { fullName: candidateData.fullName }),
        ...(candidateData.level !== undefined && { level: candidateData.level }),
        ...(candidateData.manifesto !== undefined && { manifesto: candidateData.manifesto }),
        updatedAt: new Date().toISOString(),
      };
      
      if (photoFile) {
        try {
          const folder = `candidates/${candidateData.electionId}/${candidateData.positionId}`;
          const uploadResult = await cloudinaryService.uploadImage(photoFile, folder);
          updateData.photoUrl = uploadResult.url;
          updateData.cloudinaryPublicId = uploadResult.publicId;
        } catch (uploadError) {
          console.warn('Cloudinary upload failed, falling back to Base64:', uploadError);
          updateData.photoUrl = await this.convertFileToBase64(photoFile);
          updateData.cloudinaryPublicId = null;
        }
      }
      
      const docRef = doc(db, 'candidates', id);
      await updateDoc(docRef, updateData);
      return { id, ...updateData };
    } catch (error) {
      console.error('Error updating candidate:', error);
      throw error;
    }
  },

  async deleteCandidate(id) {
    await deleteDoc(doc(db, 'candidates', id));
    return true;
  },
};
