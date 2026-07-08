import { db } from '../lib/firebase';
import { 
  collection, doc, addDoc, updateDoc, deleteDoc, getDocs, 
  getDoc, query, orderBy
} from 'firebase/firestore';

export const electionService = {
  async getAllElections() {
    const q = query(collection(db, 'elections'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async getElectionById(id) {
    const docRef = doc(db, 'elections', id);
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) throw new Error('Election not found');
    return { id: snapshot.id, ...snapshot.data() };
  },

  async createElection(data) {
    const now = new Date().toISOString();
    const electionData = {
      title: data.title,
      description: data.description || '',
      academicSession: data.academicSession || data.academic_session || '',
      electionYear: data.electionYear || data.election_year || new Date().getFullYear().toString(),
      startDate: data.startDate || data.start_date || '',
      endDate: data.endDate || data.end_date || '',
      durationHours: data.durationHours || 24,
      closesAt: null,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };
    const docRef = await addDoc(collection(db, 'elections'), electionData);
    return { id: docRef.id, ...electionData };
  },

  async updateElection(id, data) {
    const docRef = doc(db, 'elections', id);
    const updateData = {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.academicSession !== undefined && { academicSession: data.academicSession }),
      ...(data.electionYear !== undefined && { electionYear: data.electionYear }),
      ...(data.startDate !== undefined && { startDate: data.startDate }),
      ...(data.endDate !== undefined && { endDate: data.endDate }),
      ...(data.durationHours !== undefined && { durationHours: data.durationHours }),
      updatedAt: new Date().toISOString(),
    };
    await updateDoc(docRef, updateData);
    return { id, ...updateData };
  },

  async deleteElection(id) {
    await deleteDoc(doc(db, 'elections', id));
    return true;
  },

  async updateStatus(id, status) {
    const docRef = doc(db, 'elections', id);
    const updateFields = {
      status,
      updatedAt: new Date().toISOString(),
    };

    if (status === 'open') {
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const durationHours = snap.data().durationHours || 24;
        updateFields.closesAt = new Date(Date.now() + durationHours * 3600000).toISOString();
      }
    }

    if (status === 'closed') {
      updateFields.closesAt = new Date().toISOString();
    }

    await updateDoc(docRef, updateFields);
    return { id, status };
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
