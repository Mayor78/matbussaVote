import { Router } from 'express';
import { getFirestore } from '../config/firebase.js';
import { getCachedOrSet } from '../config/cache.js';

const router = Router();
const db = () => getFirestore();

router.post('/students/lookup-by-matric', async (req, res) => {
  try {
    const { matricNumber } = req.body;
    if (!matricNumber) return res.status(400).json({ error: 'matricNumber required' });

    const searchMatric = matricNumber.toLowerCase().trim();

    const students = await getCachedOrSet('public:students:list', 300, async () => {
      const snap = await db().collection('students').get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    });

    const student = students.find(s => {
      const m = (s.matricNumber || s.matric_number || '').toLowerCase().trim();
      return m === searchMatric;
    });

    res.json(student || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/students/lookup', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'email query param required' });

    const searchEmail = email.toLowerCase().trim();

    const snap = await getCachedOrSet(`public:student:email:${searchEmail}`, 300, async () => {
      const result = await db()
        .collection('students')
        .where('email', '==', searchEmail)
        .get();
      if (result.empty) return null;
      const d = result.docs[0];
      return { id: d.id, ...d.data() };
    });

    res.json(snap || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/admin/lookup', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'email query param required' });

    const searchEmail = email.toLowerCase().trim();

    const admin = await getCachedOrSet(`public:admin:email:${searchEmail}`, 300, async () => {
      const result = await db()
        .collection('admin_users')
        .where('email', '==', searchEmail)
        .get();
      if (result.empty) return null;
      const d = result.docs[0];
      return { id: d.id, ...d.data() };
    });

    res.json(admin || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
