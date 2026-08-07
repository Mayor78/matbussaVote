import { Router } from 'express';
import { getFirestore } from '../config/firebase.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { getCachedOrSet, invalidate } from '../config/cache.js';
import { TTL_BUNDLE } from '../middleware/rateLimit.js';

const router = Router();
const db = () => getFirestore();

router.get('/:electionId', requireAuth, async (req, res) => {
  try {
    const { electionId } = req.params;
    const cacheKey = `bundle:${electionId}`;

    const data = await getCachedOrSet(cacheKey, TTL_BUNDLE, async () => {
      const [positionsSnap, candidatesSnap] = await Promise.all([
        db().collection('positions')
          .where('electionId', '==', electionId)
          .orderBy('displayOrder', 'asc')
          .get(),
        db().collection('candidates')
          .where('electionId', '==', electionId)
          .get(),
      ]);

      const positions = positionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const candidates = candidatesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      return positions.map(p => ({
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
            voteCount: c.voteCount || 0,
          })),
      }));
    });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:electionId/build', requireAdmin, async (req, res) => {
  try {
    invalidate(`bundle:${req.params.electionId}`);

    const [positionsSnap, candidatesSnap] = await Promise.all([
      db().collection('positions')
        .where('electionId', '==', req.params.electionId)
        .orderBy('displayOrder', 'asc')
        .get(),
      db().collection('candidates')
        .where('electionId', '==', req.params.electionId)
        .get(),
    ]);

    const positions = positionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const candidates = candidatesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

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

    await db().collection('electionBundles').doc(req.params.electionId).set({
      positions: bundled,
      electionId: req.params.electionId,
      updatedAt: new Date().toISOString(),
    });

    res.json(bundled);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
