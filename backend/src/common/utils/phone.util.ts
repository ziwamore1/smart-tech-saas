/** Normalize local Zambian numbers to E.164-style +260 numbers. */
export function normalizeZambianPhone(value?: string | null): string | null {
  if (value == null || value.trim() === '') return null;

  const compact = value.trim().replace(/[\s().-]/g, '');
  if (compact.startsWith('+') && !compact.startsWith('+260')) return compact;

  let digits = compact.replace(/^\+/, '');
  if (digits.startsWith('00260')) digits = digits.slice(5);
  if (digits.startsWith('260')) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);

  return digits.length === 9 ? `+260${digits}` : compact;
}
