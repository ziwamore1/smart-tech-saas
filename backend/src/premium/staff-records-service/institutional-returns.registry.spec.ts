import { CANONICAL_HR_FIELDS, detectCanonicalField } from './institutional-returns.registry';

describe('institutional returns field registry', () => {
  it('maps semantic aliases to canonical staff fields', () => {
    expect(detectCanonicalField('NRC No.')?.field.key).toBe('staff.nrcNumber');
    expect(detectCanonicalField('Gender')?.field.key).toBe('staff.gender');
    expect(detectCanonicalField('EMIS Number')?.field.key).toBe('school.emisNumber');
  });

  it('does not depend on a fixed Excel column position', () => {
    const first = detectCanonicalField('Surname')?.field.key;
    const second = detectCanonicalField('Surname')?.field.key;
    expect(first).toBe('staff.surname');
    expect(second).toBe(first);
    expect(CANONICAL_HR_FIELDS.some((field) => field.key === 'school.distanceFromDebOffice')).toBe(true);
  });
});
