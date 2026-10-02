import { normalizeZambianPhone, validateZambianPhone } from './phone.util';

describe('Zambian phone normalization', () => {
  it.each([
    ['0977123456', '+260977123456'],
    ['+260 977 123 456', '+260977123456'],
    ['260977123456', '+260977123456'],
    ['977123456', '+260977123456'],
    ['+254712345678', '+254712345678'],
  ])('normalizes %s', (input, expected) => {
    expect(normalizeZambianPhone(input)).toBe(expected);
  });

  it.each([undefined, null, '', '0977123', 'phone', '+260abc123456'])('rejects missing or malformed phone %s', (input) => {
    expect(normalizeZambianPhone(input)).toBeNull();
  });

  it('classifies missing and malformed entries for phone correction guidance', () => {
    expect(validateZambianPhone(null).status).toBe('MISSING');
    expect(validateZambianPhone('bad number').status).toBe('INVALID');
  });
});
