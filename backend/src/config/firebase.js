import admin from 'firebase-admin';

let app;

function getServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } catch {
      console.warn('Failed to parse FIREBASE_SERVICE_ACCOUNT env var');
    }
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return undefined;
  }
  throw new Error(
    'Set FIREBASE_SERVICE_ACCOUNT (inline JSON) or GOOGLE_APPLICATION_CREDENTIALS (file path)'
  );
}

export function getFirebaseApp() {
  if (!app) {
    const serviceAccount = getServiceAccount();
    app = admin.initializeApp({
      credential: serviceAccount
        ? admin.credential.cert(serviceAccount)
        : admin.credential.applicationDefault(),
      projectId: process.env.FIREBASE_PROJECT_ID || 'election-system-d15fa',
    });
  }
  return app;
}

export function getFirestore() {
  return getFirebaseApp().firestore();
}

export function getAuth() {
  return getFirebaseApp().auth();
}

export const FieldValue = admin.firestore.FieldValue;
