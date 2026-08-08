export function getFriendlyError(err) {
  if (!err) return 'Something went wrong. Please try again or ask for help.';

  const msg = (err.message || String(err)).toLowerCase();

  if (msg.includes('invalid') && msg.includes('token')) return 'Your session has expired. Please log in again.';
  if (msg.includes('auth') && msg.includes('required')) return 'You need to log in first to do this.';
  if (msg.includes('admin')) return 'Only an admin can do this. Ask your admin for help.';
  if (msg.includes('already voted')) return 'You have already voted for this position. You cannot vote twice.';
  if (msg.includes('already registered')) return 'This device or account is already registered to someone else. If you think this is a mistake, contact your admin.';
  if (msg.includes('quota') || msg.includes('resource_exhausted')) return 'The system is very busy right now. Please wait a moment and try again.';
  if (msg.includes('network') || msg.includes('fetch')) return 'No internet connection. Please check your network and try again.';
  if (msg.includes('not found')) return 'The information you are looking for does not exist or has been removed.';
  if (msg.includes('rate limit') || msg.includes('too many')) return 'You are trying too many times. Please wait a moment and try again.';
  if (msg.includes('banned') || msg.includes('suspended')) return 'Your account has been suspended. Contact your department admin for help.';
  if (msg.includes('expired')) return 'Your session has expired. Please log in again to continue.';
  if (msg.includes('password') || msg.includes('wrong password')) return 'Wrong password. Check your password and try again. If you forgot your password, click "Forgot Password".';
  if (msg.includes('user not found') || msg.includes('no account')) return 'No account found with these details. Check your matric number or email and try again.';
  if (msg.includes('device')) return 'This device is already used by another voter. Please use your own device to vote.';

  return 'Something went wrong. Please try again or tap the Help button if the problem continues.';
}

export const getUserFriendlyError = getFriendlyError;
