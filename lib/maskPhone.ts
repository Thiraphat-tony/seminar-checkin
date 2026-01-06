// lib/maskPhone.ts

/**
 * Mask a phone number by replacing the last 4 characters with 'xxx'.
 * If phone is falsy, returns the provided emptyLabel (defaults to '-')
 */
export function maskPhone(phone?: string | null, emptyLabel = '-') {
  if (!phone) return emptyLabel;
  const s = String(phone).trim();
  if (!s) return emptyLabel;
  if (s.length <= 4) return 'xxx';
  return s.slice(0, s.length - 4) + 'xxx';
}
