/**
 * Normalize a Zambian phone number to E.164-style +260 numbers.
 *
 * Entries may contain several numbers separated by '/', ',' or ';' (e.g.
 * "0772233412/0971324561"). Rather than rejecting the whole entry, the FIRST
 * valid number is returned so SMS and other channels can keep working without
 * manual editing.
 */
export function normalizeZambianPhone(value?: string | null): string | null {
  return validateZambianPhone(value).normalized;
}

export function validateZambianPhone(value?: string | null): { normalized: string | null; status: 'VALID' | 'MISSING' | 'INVALID'; reason: string | null } {
  if (value == null || value.trim() === '') {
    return { normalized: null, status: 'MISSING', reason: 'No phone number is recorded.' };
  }

  const candidates = value
    .split(/[/,;]/)
    .map((part) => part.trim())
    .filter(Boolean);

  for (const candidate of candidates) {
    const normalized = normalizeSingle(candidate);
    if (normalized) return { normalized, status: 'VALID', reason: null };
  }

  return { normalized: null, status: 'INVALID', reason: 'The phone number is not a valid Zambia or international mobile number.' };
}

function normalizeSingle(value: string): string | null {
  if (value.trim() === '') return null;

  const compact = value.trim().replace(/[\s().-]/g, '');
  if (compact.startsWith('+')) return /^\+[1-9]\d{7,14}$/.test(compact) ? compact : null;

  let digits = compact.replace(/^\+/, '');
  if (digits.startsWith('00260')) digits = digits.slice(5);
  if (digits.startsWith('260')) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);

  return /^\d{9}$/.test(digits) ? `+260${digits}` : null;
}
