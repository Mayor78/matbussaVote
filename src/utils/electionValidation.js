import { db } from '../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export const validateElectionReady = async (electionId) => {
  const errors = [];

  try {
    const positionsQuery = query(
      collection(db, 'positions'),
      where('electionId', '==', electionId)
    );
    const positionsSnapshot = await getDocs(positionsQuery);

    if (positionsSnapshot.empty) {
      errors.push('The election must have at least one position.');
      return { isValid: false, errors };
    }

    const positions = positionsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    const candidatesQuery = query(
      collection(db, 'candidates'),
      where('electionId', '==', electionId)
    );
    const candidatesSnapshot = await getDocs(candidatesQuery);
    const candidates = candidatesSnapshot.docs.map(doc => doc.data());

    for (const position of positions) {
      const positionCandidates = candidates.filter(c => c.positionId === position.id);
      if (positionCandidates.length === 0) {
        errors.push(`Position "${position.title}" must have at least one candidate.`);
      }
    }
  } catch (error) {
    console.error('Error during election validation:', error);
    errors.push('An error occurred while validating. Please try again.');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};
