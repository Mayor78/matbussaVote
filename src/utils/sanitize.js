/**
 * Sanitizes user input to prevent XSS, injection, and malformed data.
 * All user-facing form inputs should pass through these functions.
 */

const SANITIZE_REGEX = /[<>{}]/g;

export function sanitizeText(value, maxLength = 500) {
  if (typeof value !== 'string') return '';
  return value
    .replace(SANITIZE_REGEX, '')
    .trim()
    .substring(0, maxLength);
}

export function sanitizeLongText(value, maxLength = 2000) {
  if (typeof value !== 'string') return '';
  return value
    .replace(SANITIZE_REGEX, '')
    .trim()
    .substring(0, maxLength);
}

export function sanitizeMatric(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/[^a-zA-Z0-9/-]/g, '').trim().substring(0, 30);
}

export function sanitizeEmail(value) {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase().substring(0, 255);
}

export function sanitizeName(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[<>{}[\]\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 100);
}

export function sanitizeLevel(value) {
  const allowed = ['ND1', 'ND2', 'HND1', 'HND2'];
  return allowed.includes(value) ? value : '';
}

export function sanitizeStatus(value) {
  const allowed = ['draft', 'published', 'open', 'closed'];
  return allowed.includes(value) ? value : 'draft';
}

export function sanitizeRole(value) {
  const allowed = ['admin', 'super_admin'];
  return allowed.includes(value) ? value : 'admin';
}

export function isValidFileType(file) {
  if (!file) return false;
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  return allowed.includes(file.type);
}

export function isValidFileSize(file, maxMB = 2) {
  if (!file) return false;
  return file.size <= maxMB * 1024 * 1024;
}
