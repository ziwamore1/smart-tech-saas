export function normalizeStaffReturnSchool<T extends Record<string, any>>(school: T): T {
  const schoolName = String(school.name || '').replace(/\s+/g, ' ').trim().toUpperCase();
  if (schoolName !== 'ADASTRA SECONDARY SCHOOL') return school;

  return {
    ...school,
    province: 'Southern',
    district: 'Choma',
    emisNumber: '902003',
    schoolType: 'Secondary',
  };
}
