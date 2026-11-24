import { normalizeStaffReturnSchool } from './school-header.utils';

describe('staff return school headers', () => {
  it('uses the official ADASTRA district and province', () => {
    const school = normalizeStaffReturnSchool({
      name: 'ADASTRA SECONDARY SCHOOL',
      province: 'Central',
      district: 'Kazungula',
      emisNumber: 'wrong',
    });

    expect(school).toMatchObject({
      province: 'Southern',
      district: 'Choma',
      emisNumber: '902003',
      schoolType: 'Secondary',
    });
  });
});
