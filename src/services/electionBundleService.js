import { db } from '../lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { positionService } from './positionService';
import { candidateService } from './candidateService';

export const bundleService = {
  async buildBundle(electionId) {
    if (!electionId) return null;

    const positions = await positionService.getPositionsByElection(electionId);
    const candidates = await candidateService.getCandidatesByElection(electionId);

    const bundled = positions.map(p => ({
      id: p.id,
      title: p.title,
      description: p.description || '',
      displayOrder: p.displayOrder || 0,
      candidates: candidates
        .filter(c => c.positionId === p.id)
        .map(c => ({
          id: c.id,
          fullName: c.fullName,
          level: c.level,
          manifesto: c.manifesto || '',
          photoUrl: c.photoUrl || null,
        })),
    }));

    await setDoc(doc(db, 'electionBundles', electionId), {
      positions: bundled,
      electionId,
      updatedAt: new Date().toISOString(),
    });

    return bundled;
  },

  async getBundle(electionId) {
    if (!electionId) return null;
    const snap = await getDoc(doc(db, 'electionBundles', electionId));
    if (!snap.exists()) return null;
    return snap.data();
  },
};
