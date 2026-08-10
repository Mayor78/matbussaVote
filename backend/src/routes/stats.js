import { Router } from 'express';
import { getFirestore } from '../config/firebase.js';
import { requireAuth } from '../middleware/auth.js';
import { getCachedOrSet } from '../config/cache.js';
import { TTL_STATS } from '../middleware/rateLimit.js';

const router = Router();
const db = () => getFirestore();

async function fetchAllData() {
  const [electionsSnap, studentsSnap, votesSnap, candidatesSnap, positionsSnap] =
    await Promise.all([
      db().collection('elections').get(),
      db().collection('students').get(),
      db().collection('votes').get(),
      db().collection('candidates').get(),
      db().collection('positions').get(),
    ]);

  return {
    elections: electionsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    students: studentsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    votes: votesSnap.docs.map((d) => d.data()),
    candidates: candidatesSnap.docs.map((d) => d.data()),
    positions: positionsSnap.docs.map((d) => d.data()),
  };
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const { electionId } = req.query;
    const cacheKey = electionId ? `stats:${electionId}` : 'stats:all';

    const data = await getCachedOrSet(cacheKey, TTL_STATS, async () => {
      const { elections, students, votes, candidates, positions } =
        await fetchAllData();

      const totalVotes = votes.length;
      const registeredVoters = students.filter((s) => s.registeredStatus).length;
      const votedStudents = new Set(votes.map((v) => v.studentId)).size;
      const turnout =
        registeredVoters > 0
          ? Math.round((votedStudents / registeredVoters) * 100)
          : 0;

      const perElection = elections.map((e) => {
        const eid = e.id;
        return {
          id: eid,
          title: e.title,
          description: e.description || '',
          academicSession: e.academicSession || e.academic_session || '',
          status: e.status,
          createdAt: e.createdAt,
          updatedAt: e.updatedAt,
          positionCount: positions.filter((p) => p.electionId === eid).length,
          candidateCount: candidates.filter((c) => c.electionId === eid).length,
          voteCount: votes.filter((v) => v.electionId === eid).length,
        };
      });

      return {
        totalStudents: students.length,
        registeredVoters,
        totalVotesCast: totalVotes,
        votedStudents,
        turnout,
        totalPositions: positions.length,
        totalCandidates: candidates.length,
        totalElections: elections.length,
        activeElections: elections.filter((e) => e.status === 'open').length,
        elections: perElection,
      };
    });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
