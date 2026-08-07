import { getAuth } from '../config/firebase.js';

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = header.split('Bearer ')[1];
  try {
    const decoded = await getAuth().verifyIdToken(token);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export async function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = header.split('Bearer ')[1];
  try {
    const decoded = await getAuth().verifyIdToken(token);
    req.user = decoded;
  } catch {
    req.user = null;
  }
  next();
}

export async function requireAdmin(req, res, next) {
  await requireAuth(req, res, () => {
    if (req.user?.admin === true) {
      return next();
    }
    return res.status(403).json({ error: 'Admin access required' });
  });
}
