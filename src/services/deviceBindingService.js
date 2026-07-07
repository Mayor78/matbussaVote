import { db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export const deviceBindingService = {
  async checkBinding(deviceSignature, studentEmail) {
    const ref = doc(db, 'deviceBindings', deviceSignature);
    const snap = await getDoc(ref);

    if (!snap.exists()) return { allowed: true, reason: null };

    const data = snap.data();
    const boundEmail = (data.studentEmail || '').toLowerCase();
    const currentEmail = (studentEmail || '').toLowerCase();

    if (boundEmail === currentEmail) {
      return { allowed: true, reason: null };
    }

    return {
      allowed: false,
      reason: 'This device is already registered to another voter. Please use your own device to vote.',
    };
  },

  async bindDevice(deviceSignature, studentId, studentEmail) {
    const ref = doc(db, 'deviceBindings', deviceSignature);
    await setDoc(ref, {
      studentId,
      studentEmail: studentEmail.toLowerCase(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    return true;
  },
};
