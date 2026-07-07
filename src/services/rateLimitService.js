import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000;

async function hashIdentifier(identifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(identifier.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getRateLimitDoc(identifierHash) {
  const ref = doc(db, 'rateLimits', identifierHash);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data();
}

async function createRateLimitDoc(identifierHash) {
  const ref = doc(db, 'rateLimits', identifierHash);
  await setDoc(ref, {
    attempts: 1,
    lockedUntil: null,
    lastAttempt: new Date().toISOString(),
  });
}

async function incrementRateLimitDoc(identifierHash, currentAttempts) {
  const ref = doc(db, 'rateLimits', identifierHash);
  const newAttempts = currentAttempts + 1;
  const lockedUntil = newAttempts >= MAX_ATTEMPTS
    ? new Date(Date.now() + LOCKOUT_MS).toISOString()
    : null;

  await updateDoc(ref, {
    attempts: newAttempts,
    lockedUntil,
    lastAttempt: new Date().toISOString(),
  });
}

async function resetRateLimitDoc(identifierHash) {
  const ref = doc(db, 'rateLimits', identifierHash);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  await updateDoc(ref, {
    attempts: 0,
    lockedUntil: null,
    lastAttempt: new Date().toISOString(),
  });
}

export const rateLimitService = {
  async checkRateLimit(identifier) {
    const identifierHash = await hashIdentifier(identifier);
    const doc = await getRateLimitDoc(identifierHash);

    if (!doc) return { allowed: true, remainingAttempts: MAX_ATTEMPTS };

    if (doc.lockedUntil && new Date(doc.lockedUntil) > new Date()) {
      const remainingMin = Math.ceil((new Date(doc.lockedUntil) - Date.now()) / 60000);
      return {
        allowed: false,
        remainingAttempts: 0,
        lockedUntil: doc.lockedUntil,
        remainingMinutes: remainingMin,
      };
    }

    const remainingAttempts = Math.max(0, MAX_ATTEMPTS - doc.attempts);
    return { allowed: true, remainingAttempts };
  },

  async recordFailedAttempt(identifier) {
    const identifierHash = await hashIdentifier(identifier);
    const doc = await getRateLimitDoc(identifierHash);

    if (!doc) {
      await createRateLimitDoc(identifierHash);
      return { attempts: 1, lockedOut: false, remainingAttempts: MAX_ATTEMPTS - 1 };
    }

    await incrementRateLimitDoc(identifierHash, doc.attempts);
    const newAttempts = doc.attempts + 1;
    const lockedOut = newAttempts >= MAX_ATTEMPTS;

    return {
      attempts: newAttempts,
      lockedOut,
      remainingAttempts: Math.max(0, MAX_ATTEMPTS - newAttempts),
      lockoutMinutes: lockedOut ? 5 : 0,
    };
  },

  async resetRateLimit(identifier) {
    const identifierHash = await hashIdentifier(identifier);
    await resetRateLimitDoc(identifierHash);
  },

  async getLockoutInfo(identifier) {
    const identifierHash = await hashIdentifier(identifier);
    const doc = await getRateLimitDoc(identifierHash);
    if (!doc?.lockedUntil) return null;
    if (new Date(doc.lockedUntil) <= new Date()) return null;
    return {
      lockedUntil: doc.lockedUntil,
      remainingMinutes: Math.ceil((new Date(doc.lockedUntil) - Date.now()) / 60000),
    };
  },
};
