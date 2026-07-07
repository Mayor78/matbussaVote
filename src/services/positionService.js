import { db } from '../lib/firebase';
import { collection, doc, addDoc, updateDoc, deleteDoc, getDocs, query, where } from 'firebase/firestore';

export const positionService = {
  async getPositionsByElection(electionId) {
    const q = query(
      collection(db, 'positions'),
      where('electionId', '==', electionId)
    );
    const snapshot = await getDocs(q);
    const positions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return positions.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  },

  async createPosition(data) {
    const now = new Date().toISOString();
    const positionData = {
      electionId: data.electionId,
      title: data.title,
      description: data.description || '',
      displayOrder: data.displayOrder || 1,
      createdAt: now,
      updatedAt: now,
    };
    const docRef = await addDoc(collection(db, 'positions'), positionData);
    return { id: docRef.id, ...positionData };
  },

  async updatePosition(id, data) {
    const docRef = doc(db, 'positions', id);
    const updateData = {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.displayOrder !== undefined && { displayOrder: data.displayOrder }),
      updatedAt: new Date().toISOString(),
    };
    await updateDoc(docRef, updateData);
    return { id, ...updateData };
  },

  async deletePosition(id) {
    await deleteDoc(doc(db, 'positions', id));
    return true;
  },
};
