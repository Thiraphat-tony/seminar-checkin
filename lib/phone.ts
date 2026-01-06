// lib/phone.ts

/** Remove all non-digit characters */
export function normalizePhone(phone?: string | null) {
  if (!phone) return '';
  return String(phone).replace(/\D/g, '');
}

/** Return true if phone (string) contains exactly 10 digits after normalization */
export function isValidPhone(phone?: string | null) {
  const n = normalizePhone(phone);
  return n.length === 10;
}

/** Normalize or return null when phone is empty/invalid
 * - returns normalized 10-digit string when valid
 * - returns null when empty or invalid
 */
export function phoneForStorage(phone?: string | null) {
  const n = normalizePhone(phone);
  return n.length === 10 ? n : null;
}
