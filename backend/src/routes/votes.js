import { Router } from 'express';
import { getFirestore, FieldValue } from '../config/firebase.js';
import { requireAuth } from '../middleware/auth.js';
import { invalidate } from '../config/cache.js';

const router = Router();
const db = () => getFirestore();

router.post('/', requireAuth, async (req, res) => {
  try {
    const { candidateId, electionId, positionId, studentId } = req.body;
    if (!candidateId || !electionId || !positionId || !studentId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const voteId = `${req.user.uid}_${studentId}_${electionId}_${positionId}`;

    // check if already voted for this position in this election
    const existing = await db().collection('votes').doc(voteId).get();
    if (existing.exists) {
      return res.status(409).json({ error: 'Already voted for this position' });
    }

    const batch = db().batch();

    const lockRef = db().collection('voteLocks').doc(`${studentId}_${positionId}`);
    batch.set(lockRef, {
      electionId,
      positionId,
      studentId,
      createdAt: new Date().toISOString(),
    });

    const voteRef = db().collection('votes').doc(voteId);
    batch.set(voteRef, {
      candidateId,
      electionId,
      positionId,
      studentId,
      userId: req.user.uid,
      createdAt: new Date().toISOString(),
    });

    const candidateRef = db().collection('candidates').doc(candidateId);
    batch.update(candidateRef, {
      voteCount: FieldValue.increment(1),
    });

    await batch.commit();
    invalidate('candidates');
    invalidate('bundle');
    invalidate('stats');

    res.status(201).json({ id: voteId, success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Check if student has already voted in an election
router.get('/check', requireAuth, async (req, res) => {
  try {
    const { studentId, electionId } = req.query;
    if (!studentId || !electionId) {
      return res.status(400).json({ error: 'studentId and electionId required' });
    }

    const snap = await db()
      .collection('votes')
      .where('studentId', '==', studentId)
      .where('electionId', '==', electionId)
      .get();

    const votes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ hasVoted: votes.length > 0, votes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
