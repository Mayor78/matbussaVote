import { Router } from 'express';
import { getFirestore } from '../config/firebase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const db = () => getFirestore();

router.post('/check', requireAuth, async (req, res) => {
  try {
    const { deviceSignature, studentEmail } = req.body;
    if (!deviceSignature || !studentEmail) {
      return res.status(400).json({ error: 'deviceSignature and studentEmail required' });
    }

    const snap = await db().collection('deviceBindings').doc(deviceSignature).get();

    if (!snap.exists) return res.json({ allowed: true, reason: null });

    const data = snap.data();
    const boundEmail = (data.studentEmail || '').toLowerCase();
    const currentEmail = (studentEmail || '').toLowerCase();

    if (boundEmail === currentEmail) {
      return res.json({ allowed: true, reason: null });
    }

    res.json({
      allowed: false,
      reason: 'This device is already registered to another voter.',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/bind', requireAuth, async (req, res) => {
  try {
    const { deviceSignature, studentId, studentEmail } = req.body;
    if (!deviceSignature || !studentId || !studentEmail) {
      return res.status(400).json({ error: 'deviceSignature, studentId, and studentEmail required' });
    }

    await db().collection('deviceBindings').doc(deviceSignature).set({
      studentId,
      studentEmail: studentEmail.toLowerCase(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
