/**
 * Normalize a Zambian phone number to E.164-style +260 numbers.
 *
 * Entries may contain several numbers separated by '/', ',' or ';' (e.g.
 * "0772233412/0971324561"). Rather than rejecting the whole entry, the FIRST
 * valid number is returned so SMS and other channels can keep working without
 * manual editing.
 */
export function normalizeZambianPhone(value?: string | null): string | null {
  if (value == null) return null;

  const candidates = value
    .split(/[/,;]/)
    .map((part) => part.trim())
    .filter(Boolean);

  for (const candidate of candidates) {
    const normalized = normalizeSingle(candidate);
    if (normalized) return normalized;
  }

  return null;
}

function normalizeSingle(value: string): string | null {
  if (value.trim() === '') return null;

  const compact = value.trim().replace(/[\s().-]/g, '');
  if (compact.startsWith('+') && !compact.startsWith('+260')) return compact;

  let digits = compact.replace(/^\+/, '');
  if (digits.startsWith('00260')) digits = digits.slice(5);
  if (digits.startsWith('260')) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);

  return digits.length === 9 ? `+260${digits}` : compact;
}
