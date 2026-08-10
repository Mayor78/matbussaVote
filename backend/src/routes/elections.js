import { Router } from 'express';
import { getFirestore } from '../config/firebase.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { getCachedOrSet, invalidate } from '../config/cache.js';
import { TTL_ELECTIONS } from '../middleware/rateLimit.js';

const router = Router();
const db = () => getFirestore();

router.get('/', requireAuth, async (req, res) => {
  try {
    const { status } = req.query;
    const cacheKey = status ? `elections:all:${status}` : 'elections:all';
    const ttl = status ? 60 : TTL_ELECTIONS;

    const data = await getCachedOrSet(cacheKey, ttl, async () => {
      let query = db().collection('elections').orderBy('createdAt', 'desc');
      if (status) query = query.where('status', '==', status);
      const snap = await query.get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const data = await getCachedOrSet(`elections:${req.params.id}`, TTL_ELECTIONS, async () => {
      const snap = await db().collection('elections').doc(req.params.id).get();
      if (!snap.exists) return null;
      return { id: snap.id, ...snap.data() };
    });
    if (!data) return res.status(404).json({ error: 'Election not found' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const now = new Date().toISOString();
    const doc = {
      title: req.body.title,
      description: req.body.description || '',
      academicSession: req.body.academicSession || '',
      electionYear: req.body.electionYear || new Date().getFullYear().toString(),
      startDate: req.body.startDate || '',
      endDate: req.body.endDate || '',
      durationHours: req.body.durationHours || 24,
      closesAt: null,
      levelWindows: req.body.levelWindows || null,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };
    const ref = await db().collection('elections').add(doc);
    invalidate('elections');
    res.status(201).json({ id: ref.id, ...doc });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const update = { ...req.body, updatedAt: new Date().toISOString() };
    delete update.id;
    await db().collection('elections').doc(req.params.id).update(update);
    invalidate('elections');
    invalidate('bundle');
    res.json({ id: req.params.id, ...update });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await db().collection('elections').doc(req.params.id).delete();
    invalidate('elections');
    invalidate('bundle');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/status', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['draft', 'published', 'open', 'closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const ref = db().collection('elections').doc(req.params.id);
    const update = { status, updatedAt: new Date().toISOString() };

    if (status === 'open') {
      const snap = await ref.get();
      if (snap.exists) {
        const hours = snap.data().durationHours || 24;
        update.closesAt = new Date(Date.now() + hours * 3600000).toISOString();
      }
    } else if (status === 'closed') {
      update.closesAt = new Date().toISOString();
    } else {
      update.closesAt = null;
    }

    await ref.update(update);
    invalidate('elections');
    invalidate('bundle');
    invalidate('stats');
    res.json({ id: req.params.id, status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
