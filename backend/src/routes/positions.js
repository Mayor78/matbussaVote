import { Router } from 'express';
import { getFirestore } from '../config/firebase.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { getCachedOrSet, invalidate } from '../config/cache.js';
import { TTL_POSITIONS } from '../middleware/rateLimit.js';

const router = Router();
const db = () => getFirestore();

router.get('/', requireAuth, async (req, res) => {
  try {
    const electionId = req.query.electionId;
    if (!electionId) return res.status(400).json({ error: 'electionId query param required' });

    const data = await getCachedOrSet(`positions:${electionId}`, TTL_POSITIONS, async () => {
      const snap = await db()
        .collection('positions')
        .where('electionId', '==', electionId)
        .orderBy('displayOrder', 'asc')
        .get();
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
      title: req.body.title,
      description: req.body.description || '',
      displayOrder: req.body.displayOrder || 1,
      createdAt: now,
      updatedAt: now,
    };
    const ref = await db().collection('positions').add(doc);
    invalidate(`positions:${req.body.electionId}`);
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
    await db().collection('positions').doc(req.params.id).update(update);
    invalidate('positions');
    invalidate('bundle');
    res.json({ id: req.params.id, ...update });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await db().collection('positions').doc(req.params.id).delete();
    invalidate('positions');
    invalidate('bundle');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
