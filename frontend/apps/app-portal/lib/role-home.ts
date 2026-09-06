const STAFF_ROLES = [
  'Director',
  'Deputy Director',
  'Head Teacher',
  'Deputy Head',
  'Deputy',
  'HOD',
  'Accountant',
  'Secretary',
  'Teacher',
  'Class Teacher',
  'Lower Primary Senior Teacher',
  'Upper Primary Senior Teacher',
  'Primary Teacher',
  'Principal',
  'Registrar',
  'Lecturer',
  'Vice Chancellor',
  'Dean',
  'Research Supervisor',
];

export function normalizeRole(role: string): string {
  return String(role || '')
    .toLowerCase()
    .replace(/\s+/g, '');
}

export function isStaff(user: any): boolean {
  const roles = user?.roles || [];
  return roles.some((role: string) =>
    STAFF_ROLES.some((staffRole) => normalizeRole(staffRole) === normalizeRole(role)),
  );
}

export function isParent(user: any): boolean {
  return (user?.roles || []).some((role: string) => normalizeRole(role) === 'parent');
}

export function isStudentOrLearner(user: any): boolean {
  return (user?.roles || []).some((role: string) => {
    const normalized = normalizeRole(role);
    return normalized === 'student' || normalized === 'learner';
  });
}

export function getDefaultHomePath(user: any): string {
  if (!user) return '/login';
  if (isStaff(user)) return '/dashboard';
  if (isParent(user)) return '/parent';
  if (isStudentOrLearner(user)) return '/student';
  return '/dashboard';
}