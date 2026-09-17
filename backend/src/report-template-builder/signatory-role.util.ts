export type CanonicalSignatoryRole =
  | 'CLASS_TEACHER'
  | 'HEAD_TEACHER'
  | 'DEPUTY_HEAD_TEACHER'
  | null;

/**
 * Canonicalises a signatory role/label so the many spellings a school might
 * use ("Head Teacher", "HEAD_TEACHER", "headteacher", "Principal", "Deputy
 * Head") all resolve to the same slot key. Role and label are both inspected
 * because older rows only stored one of them.
 */
export function canonicalSignatoryRole(
  role?: string | null,
  label?: string | null,
): CanonicalSignatoryRole {
  const source = `${role || ''} ${label || ''}`
    .toLowerCase()
    .replace(/[_\-/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!source) return null;

  // Deputy must be checked before head: "deputy head teacher" also contains
  // "head teacher".
  if (/\bdeputy\b|\bvice (head|principal)\b|\bassistant head\b/.test(source)) {
    return 'DEPUTY_HEAD_TEACHER';
  }
  if (/\bhead teacher\b|\bheadteacher\b|\bhead master\b|\bheadmistress\b|\bprincipal\b|\bdirector\b/.test(source)) {
    return 'HEAD_TEACHER';
  }
  if (/\bclass teacher\b|\bform (mistress|master)\b|\bclass (mistress|master)\b|\bclass advisor\b|\bclass tutor\b/.test(source)) {
    return 'CLASS_TEACHER';
  }
  return null;
}
