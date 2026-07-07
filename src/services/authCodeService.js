import { db } from '../lib/firebase';
import { collection, addDoc, getDocs, query, where, updateDoc, doc, deleteDoc } from 'firebase/firestore';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateCode() {
  const array = new Uint8Array(8);
  crypto.getRandomValues(array);
  let code = '';
  for (let i = 0; i < array.length; i++) {
    code += CHARS[array[i] % CHARS.length];
  }
  return code;
}

export const authCodeService = {
  async generateCode(superAdminEmail, action, target = '') {
    const code = generateCode();
    await addDoc(collection(db, 'authCodes'), {
      code,
      action,
      target: target || '',
      createdBy: superAdminEmail,
      used: false,
      usedBy: '',
      usedAt: null,
      createdAt: new Date().toISOString(),
    });
    return code;
  },

  async validateAndConsume(code, action) {
    const q = query(
      collection(db, 'authCodes'),
      where('code', '==', code),
      where('used', '==', false)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      return { valid: false, error: 'Invalid or expired code. Request a new one from the super admin.' };
    }

    const codeDoc = snap.docs[0];
    const codeData = codeDoc.data();

    if (codeData.action !== action) {
      return { valid: false, error: `This code is for "${codeData.action}", not "${action}".` };
    }

    await updateDoc(doc(db, 'authCodes', codeDoc.id), {
      used: true,
      usedAt: new Date().toISOString(),
    });

    return { valid: true, codeId: codeDoc.id, data: codeData };
  },

  async getUnusedCodes() {
    const q = query(collection(db, 'authCodes'), where('used', '==', false));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async getAllCodes() {
    const snap = await getDocs(collection(db, 'authCodes'));
    const codes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    codes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return codes;
  },

  async deleteCode(id) {
    await deleteDoc(doc(db, 'authCodes', id));
  },
};
