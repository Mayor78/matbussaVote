import { Router } from 'express';
import { getFirestore } from '../config/firebase.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { invalidate } from '../config/cache.js';

const router = Router();
const db = () => getFirestore();

router.get('/lookup', requireAuth, async (req, res) => {
  try {
    const { email, matric } = req.query;
    if (!email && !matric) {
      return res.status(400).json({ error: 'email or matric query param required' });
    }

    let query;
    if (email) {
      query = db().collection('students').where('email', '==', email.toLowerCase());
    } else {
      query = db().collection('students');
    }

    const snap = await query.get();

    if (matric) {
      const student = snap.docs.find(d => {
        const data = d.data();
        const m = (data.matricNumber || data.matric_number || '').toLowerCase();
        return m === matric.toLowerCase();
      });
      if (student) {
        return res.json({ id: student.id, ...student.data() });
      }
    } else if (!snap.empty) {
      const d = snap.docs[0];
      return res.json({ id: d.id, ...d.data() });
    }

    res.json(null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/lookup/by-matric', requireAuth, async (req, res) => {
  try {
    const { matricNumber } = req.body;
    if (!matricNumber) return res.status(400).json({ error: 'matricNumber required' });

    const snap = await db().collection('students').get();
    const student = snap.docs.find(d => {
      const data = d.data();
      const m = (data.matricNumber || data.matric_number || '').toLowerCase();
      return m === matricNumber.toLowerCase();
    });

    if (student) {
      return res.json({ id: student.id, ...student.data() });
    }
    res.json(null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', requireAuth, async (req, res) => {
  try {
    const snap = await db()
      .collection('students')
      .orderBy('createdAt', 'desc')
      .get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const now = new Date().toISOString();
    const doc = {
      ...req.body,
      createdAt: now,
      updatedAt: now,
    };
    const ref = await db().collection('students').add(doc);
    res.status(201).json({ id: ref.id, ...doc });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const update = { ...req.body, updatedAt: new Date().toISOString() };
    delete update.id;
    await db().collection('students').doc(req.params.id).update(update);
    res.json({ id: req.params.id, ...update });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/ban', requireAdmin, async (req, res) => {
  try {
    await db().collection('students').doc(req.params.id).update({
      banned: true,
      bannedAt: new Date().toISOString(),
      bannedBy: req.user?.email || 'admin',
      updatedAt: new Date().toISOString(),
    });
    invalidate('public:students:list');
    res.json({ success: true, banned: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/unban', requireAdmin, async (req, res) => {
  try {
    await db().collection('students').doc(req.params.id).update({
      banned: false,
      bannedAt: null,
      bannedBy: '',
      updatedAt: new Date().toISOString(),
    });
    invalidate('public:students:list');
    res.json({ success: true, banned: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await db().collection('students').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
