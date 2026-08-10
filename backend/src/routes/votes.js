import { Router } from 'express';
import { getFirestore, FieldValue } from '../config/firebase.js';
import { requireAuth } from '../middleware/auth.js';
import { invalidate, getCachedOrSet } from '../config/cache.js';

const router = Router();
const db = () => getFirestore();

const STUDENTS_CACHE_KEY = 'public:students:list';
const STUDENTS_CACHE_TTL = 300;

async function getAllStudents() {
  return getCachedOrSet(STUDENTS_CACHE_KEY, STUDENTS_CACHE_TTL, async () => {
    const snap = await db().collection('students').get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  });
}

async function resolveStudent(user) {
  const email = (user.email || '').toLowerCase().trim();
  const students = await getAllStudents();

  if (email) {
    const found = students.find(
      (s) => (s.email || '').toLowerCase().trim() === email,
    );
    if (found) return found;
  }

  const found = students.find((s) => s.userId === user.uid);
  if (found) return found;

  return null;
}

router.post('/', requireAuth, async (req, res) => {
  try {
    const { candidateId, electionId, positionId } = req.body;
    if (!candidateId || !electionId || !positionId) {
      return res.status(400).json({ error: 'Missing required fields: candidateId, electionId, positionId' });
    }

    const student = await resolveStudent(req.user);
    if (!student) {
      return res.status(403).json({ error: 'Student record not found. Contact your Electoral Committee to verify your registration.' });
    }
    if (student.banned) {
      return res.status(403).json({ error: 'Your account has been suspended. Contact your Electoral Committee.' });
    }

    const studentId = student.id;
    const voteId = `${req.user.uid}_${studentId}_${electionId}_${positionId}`;

    const result = await db().runTransaction(async (tx) => {
      const electionSnap = await tx.get(db().collection('elections').doc(electionId));
      if (!electionSnap.exists) {
        throw { status: 404, message: 'Election not found.' };
      }
      const election = electionSnap.data();
      if (election.status !== 'open') {
        throw { status: 400, message: 'This election is not currently accepting votes.' };
      }
      if (election.closesAt && new Date(election.closesAt) <= new Date()) {
        throw { status: 400, message: 'Voting has closed for this election.' };
      }

      const levelWindows = election.levelWindows;
      if (levelWindows && Array.isArray(levelWindows) && levelWindows.length > 0) {
        const studentLevel = student.level || student.Level || '';
        const now = new Date();
        const window = levelWindows.find(
          (w) => Array.isArray(w.levels) && w.levels.some((l) => l === studentLevel),
        );
        if (!window) {
          throw { status: 403, message: 'Your level is not eligible to vote in this election.' };
        }
        if (window.opensAt && now < new Date(window.opensAt)) {
          throw {
            status: 403,
            message: `Voting for your level opens at ${new Date(window.opensAt).toLocaleString()}.`,
          };
        }
        if (window.closesAt && now > new Date(window.closesAt)) {
          throw {
            status: 403,
            message: 'Voting for your level has closed.',
          };
        }
      }

      const positionSnap = await tx.get(db().collection('positions').doc(positionId));
      if (!positionSnap.exists) {
        throw { status: 404, message: 'Position not found.' };
      }
      const position = positionSnap.data();
      if (position.electionId !== electionId) {
        throw { status: 400, message: 'Position does not belong to this election.' };
      }

      const candidateSnap = await tx.get(db().collection('candidates').doc(candidateId));
      if (!candidateSnap.exists) {
        throw { status: 404, message: 'Candidate not found.' };
      }
      const candidate = candidateSnap.data();
      if (candidate.positionId !== positionId) {
        throw { status: 400, message: 'Candidate does not belong to this position.' };
      }
      if (candidate.electionId !== electionId) {
        throw { status: 400, message: 'Candidate does not belong to this election.' };
      }

      const voteSnap = await tx.get(db().collection('votes').doc(voteId));
      if (voteSnap.exists) {
        throw { status: 409, message: 'Already voted for this position.' };
      }

      const existingVotes = await tx.get(
        db()
          .collection('votes')
          .where('studentId', '==', studentId)
          .where('electionId', '==', electionId)
          .where('positionId', '==', positionId)
          .limit(1),
      );
      if (!existingVotes.empty) {
        throw { status: 409, message: 'Already voted for this position.' };
      }

      tx.set(db().collection('votes').doc(voteId), {
        candidateId,
        electionId,
        positionId,
        studentId,
        userId: req.user.uid,
        createdAt: new Date().toISOString(),
      });

      tx.update(db().collection('candidates').doc(candidateId), {
        voteCount: FieldValue.increment(1),
      });

      return { id: voteId };
    });

    invalidate('candidates');
    invalidate('bundle');
    invalidate('stats');

    res.status(201).json({ id: result.id, success: true });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Vote error:', err);
    res.status(500).json({ error: 'Failed to record vote. Please try again.' });
  }
});

router.get('/check', requireAuth, async (req, res) => {
  try {
    const { electionId } = req.query;
    if (!electionId) {
      return res.status(400).json({ error: 'electionId query param required' });
    }

    const student = await resolveStudent(req.user);
    if (!student) {
      return res.json({ hasVoted: false, votes: [] });
    }

    const snap = await db()
      .collection('votes')
      .where('studentId', '==', student.id)
      .where('electionId', '==', electionId)
      .get();

    const votes = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json({ hasVoted: votes.length > 0, votes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
