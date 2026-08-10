import { Router } from 'express';
import { getFirestore } from '../config/firebase.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
const db = () => getFirestore();

router.post('/check', requireAuth, async (req, res) => {
  try {
    const { deviceSignature, studentEmail, electionId } = req.body;
    if (!deviceSignature || !studentEmail) {
      return res.status(400).json({ error: 'deviceSignature and studentEmail required' });
    }

    const docId = electionId
      ? `${electionId}_${deviceSignature}`
      : deviceSignature;

    const snap = await db().collection('deviceBindings').doc(docId).get();

    if (!snap.exists) return res.json({ allowed: true, reason: null });

    const data = snap.data();
    const boundEmail = (data.studentEmail || '').toLowerCase();
    const currentEmail = (studentEmail || '').toLowerCase();

    if (boundEmail === currentEmail) {
      return res.json({ allowed: true, reason: null });
    }

    res.json({
      allowed: false,
      reason:
        'This device is already associated with another student account for this election.',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/bind', requireAuth, async (req, res) => {
  try {
    const { deviceSignature, studentId, studentEmail, electionId } = req.body;
    if (!deviceSignature || !studentId || !studentEmail) {
      return res
        .status(400)
        .json({ error: 'deviceSignature, studentId, and studentEmail required' });
    }

    const docId = electionId
      ? `${electionId}_${deviceSignature}`
      : deviceSignature;

    await db()
      .collection('deviceBindings')
      .doc(docId)
      .set(
        {
          studentId,
          studentEmail: studentEmail.toLowerCase(),
          electionId: electionId || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/reset-by-student', requireAdmin, async (req, res) => {
  try {
    const { studentEmail, electionId } = req.body;
    if (!studentEmail) {
      return res.status(400).json({ error: 'studentEmail required' });
    }

    const searchEmail = studentEmail.toLowerCase().trim();
    const snap = await db().collection('deviceBindings').get();
    let deleted = 0;

    const batch = db().batch();
    snap.docs.forEach((d) => {
      const data = d.data();
      const docEmail = (data.studentEmail || '').toLowerCase().trim();
      if (docEmail === searchEmail) {
        if (!electionId || data.electionId === electionId || !data.electionId) {
          batch.delete(d.ref);
          deleted++;
        }
      }
    });

    if (deleted > 0) {
      await batch.commit();
    }

    res.json({
      success: true,
      message:
        deleted > 0
          ? `${deleted} device binding(s) reset. The student can log in from a new device.`
          : 'No device bindings found for this student.',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
