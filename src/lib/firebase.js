import { initializeApp } from 'firebase/app';
import { getAuth, signOut } from 'firebase/auth';
import { getFirestore, collection } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export const studentsCollection = collection(db, 'students');
export const electionsCollection = collection(db, 'elections');
export const positionsCollection = collection(db, 'positions');
export const candidatesCollection = collection(db, 'candidates');
export const votesCollection = collection(db, 'votes');
export const auditLogsCollection = collection(db, 'auditLogs');

export const getCurrentUser = () => auth.currentUser;

export const isAdmin = async (user) => {
  if (!user) return false;
  const idTokenResult = await user.getIdTokenResult();
  return idTokenResult.claims?.admin === true;
};

export const logout = async () => {
  await signOut(auth);
};
