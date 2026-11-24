import { CANONICAL_HR_FIELDS, detectCanonicalField, resolveCanonicalFieldKey } from './institutional-returns.registry';

describe('institutional returns field registry', () => {
  it('maps semantic aliases to canonical staff fields', () => {
    expect(detectCanonicalField('NRC No.')?.field.key).toBe('staff.nrcNumber');
    expect(detectCanonicalField('Gender')?.field.key).toBe('staff.gender');
    expect(detectCanonicalField('Substantive Scale')?.field.key).toBe('staff.substantiveScale');
    expect(detectCanonicalField('District Payroll Point')?.field.key).toBe('staff.payrollPoint');
    expect(detectCanonicalField('EMIS Number')?.field.key).toBe('school.emisNumber');
  });

  it('does not depend on a fixed Excel column position', () => {
    const first = detectCanonicalField('Surname')?.field.key;
    const second = detectCanonicalField('Surname')?.field.key;
    expect(first).toBe('staff.surname');
    expect(second).toBe(first);
    expect(CANONICAL_HR_FIELDS.some((field) => field.key === 'school.distanceFromDebOffice')).toBe(true);
  });

  it('maps renamed configured headers to canonical fields', () => {
    expect(resolveCanonicalFieldKey({ columnName: 'field_1', columnLabel: 'Full Name' })).toBe('staff.fullName');
    expect(resolveCanonicalFieldKey({ columnName: 'field_2', columnLabel: 'Email Address' })).toBe('staff.emailAddress');
    expect(resolveCanonicalFieldKey({ columnName: 'field_3', columnLabel: 'Substantive Scale' })).toBe('staff.substantiveScale');
    expect(resolveCanonicalFieldKey({ columnName: 'field_4', columnLabel: 'District Payroll Point', validationRules: { source: 'school.district' } })).toBe('staff.payrollPoint');
  });
});
