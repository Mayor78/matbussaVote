import rateLimit from 'express-rate-limit';

export const TTL_ELECTIONS = parseInt(process.env.CACHE_TTL_ELECTIONS, 10) || 1800;
export const TTL_BUNDLE = parseInt(process.env.CACHE_TTL_BUNDLE, 10) || 1800;
export const TTL_STATS = parseInt(process.env.CACHE_TTL_STATS, 10) || 600;
export const TTL_POSITIONS = parseInt(process.env.CACHE_TTL_POSITIONS, 10) || 1800;
export const TTL_CANDIDATES = parseInt(process.env.CACHE_TTL_CANDIDATES, 10) || 1800;

export const authRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.uid || req.ip,
  message: { error: 'Too many requests, please try again later' },
});

export const strictRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});
