import { Router } from 'express';
import { getFirestore } from '../config/firebase.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { getCachedOrSet, invalidate } from '../config/cache.js';
import { TTL_CANDIDATES } from '../middleware/rateLimit.js';

const router = Router();
const db = () => getFirestore();

router.get('/', requireAuth, async (req, res) => {
  try {
    const { electionId, positionId } = req.query;
    const cacheKey = positionId
      ? `candidates:pos:${positionId}`
      : `candidates:elec:${electionId}`;

    const data = await getCachedOrSet(cacheKey, TTL_CANDIDATES, async () => {
      let query = db().collection('candidates');
      if (electionId) query = query.where('electionId', '==', electionId);
      if (positionId) query = query.where('positionId', '==', positionId);
      const snap = await query.get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const now = new Date().toISOString();
    const doc = {
      electionId: req.body.electionId,
      positionId: req.body.positionId,
      fullName: req.body.fullName,
      level: req.body.level,
      manifesto: req.body.manifesto || '',
      photoUrl: req.body.photoUrl || null,
      cloudinaryPublicId: req.body.cloudinaryPublicId || null,
      voteCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    const ref = await db().collection('candidates').add(doc);
    invalidate('candidates');
    invalidate('bundle');
    res.status(201).json({ id: ref.id, ...doc });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const update = { ...req.body, updatedAt: new Date().toISOString() };
    delete update.id;
    await db().collection('candidates').doc(req.params.id).update(update);
    invalidate('candidates');
    invalidate('bundle');
    res.json({ id: req.params.id, ...update });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await db().collection('candidates').doc(req.params.id).delete();
    invalidate('candidates');
    invalidate('bundle');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/pool', requireAdmin, async (req, res) => {
  try {
    const data = await getCachedOrSet('candidates:pool', 300, async () => {
      const [candSnap, elecSnap, posSnap] = await Promise.all([
        db().collection('candidates').get(),
        db().collection('elections').get(),
        db().collection('positions').get(),
      ]);

      const elections = {};
      elecSnap.docs.forEach(d => { elections[d.id] = { id: d.id, ...d.data() }; });

      const positions = {};
      posSnap.docs.forEach(d => { positions[d.id] = { id: d.id, ...d.data() }; });

      return candSnap.docs.map(d => {
        const c = { id: d.id, ...d.data() };
        c.electionTitle = elections[c.electionId]?.title || 'Unknown Election';
        c.positionTitle = positions[c.positionId]?.title || 'Unknown Position';
        return c;
      });
    });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
