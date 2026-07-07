const FIREBASE_AUTH_ERRORS = {
  'auth/invalid-credential': 'Invalid email or password. Please try again.',
  'auth/invalid-email': 'The email address is not valid.',
  'auth/user-disabled': 'This account has been disabled. Contact an administrator.',
  'auth/user-not-found': 'No account found with this email.',
  'auth/wrong-password': 'Invalid email or password. Please try again.',
  'auth/email-already-in-use': 'This email is already registered.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  'auth/network-request-failed': 'Network error. Please check your internet connection.',
  'auth/operation-not-allowed': 'This login method is not enabled. Contact an administrator.',
  'auth/requires-recent-login': 'Please log out and log in again before retrying.',
  'auth/invalid-action-code': 'The authorization code has expired or is invalid.',
  'auth/expired-action-code': 'The authorization code has expired.',
  'auth/popup-closed-by-user': 'Login popup was closed. Please try again.',
  'auth/cancelled-popup-request': 'Login cancelled. Please try again.',
  'auth/popup-blocked': 'Login popup was blocked by your browser. Please allow popups.',
  'auth/internal-error': 'An unexpected error occurred. Please try again.',
};

const FIRESTORE_ERRORS = {
  'permission-denied': 'You do not have permission to perform this action.',
  'unauthenticated': 'Please log in to continue.',
  'not-found': 'The requested resource was not found.',
  'already-exists': 'This resource already exists.',
  'resource-exhausted': 'Too many requests. Please wait a moment.',
  'failed-precondition': 'Operation cannot be completed at this time.',
  'aborted': 'Operation was aborted. Please try again.',
  'out-of-range': 'This operation is out of the allowed range.',
  'unimplemented': 'This operation is not supported.',
  'internal': 'An internal error occurred. Please try again.',
  'unavailable': 'Service is temporarily unavailable. Please try again.',
  'data-loss': 'A data loss occurred. Please contact support.',
};

const VOTE_ERRORS = {
  ALREADY_VOTED: 'You have already voted for this position.',
  VOTE_LOCK_FAILED: 'Vote processing failed. Please try again.',
};

export function getUserFriendlyError(error) {
  if (!error) return 'An unexpected error occurred. Please try again.';

  if (typeof error === 'string') return error;

  if (error.message && VOTE_ERRORS[error.message]) {
    return VOTE_ERRORS[error.message];
  }

  if (error.code && FIREBASE_AUTH_ERRORS[error.code]) {
    return FIREBASE_AUTH_ERRORS[error.code];
  }

  if (error.code && FIRESTORE_ERRORS[error.code]) {
    return FIRESTORE_ERRORS[error.code];
  }

  if (error.code && error.code.startsWith('auth/')) {
    return 'Authentication failed. Please check your credentials and try again.';
  }

  if (import.meta.env.DEV) {
    console.debug('[Error]', error.code, error.message);
  }

  return 'An unexpected error occurred. Please try again.';
}
