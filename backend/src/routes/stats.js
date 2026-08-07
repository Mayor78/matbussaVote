import { Router } from 'express';
import { getFirestore } from '../config/firebase.js';
import { requireAuth } from '../middleware/auth.js';
import { getCachedOrSet } from '../config/cache.js';
import { TTL_STATS } from '../middleware/rateLimit.js';

const router = Router();
const db = () => getFirestore();

router.get('/', requireAuth, async (req, res) => {
  try {
    const { electionId } = req.query;
    const cacheKey = electionId ? `stats:${electionId}` : 'stats:all';

    const data = await getCachedOrSet(cacheKey, TTL_STATS, async () => {
      const [electionsSnap, studentsSnap, votesSnap, candidatesSnap] = await Promise.all([
        db().collection('elections').get(),
        db().collection('students').get(),
        db().collection('votes').get(),
        db().collection('candidates').get(),
      ]);

      const elections = electionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const students = studentsSnap.docs;
      const votes = votesSnap.docs;
      const candidates = candidatesSnap.docs;

      const totalVotes = votes.length;
      const registeredVoters = students.length;
      const votedStudents = new Set(votes.map(v => v.data().studentId)).size;
      const turnout = registeredVoters > 0
        ? Math.round((votedStudents / registeredVoters) * 100)
        : 0;

      let electionStats = [];
      if (electionId) {
        const election = elections.find(e => e.id === electionId);
        if (election) {
          const electionVotes = votes.filter(v => v.data().electionId === electionId);
          const electionCandidates = candidates.filter(c => c.data().electionId === electionId);
          electionStats = [{
            election,
            totalVotes: electionVotes.length,
            candidates: electionCandidates.length,
          }];
        }
      }

      return {
        totalElections: elections.length,
        activeElections: elections.filter(e => e.status === 'open').length,
        registeredVoters,
        votedStudents,
        totalVotes,
        turnout,
        electionStats,
      };
    });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
