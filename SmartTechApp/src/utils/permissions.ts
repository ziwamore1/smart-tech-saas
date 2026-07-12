export type Permission =
  | 'settings.edit'
  | 'staff.manage'
  | 'students.manage'
  | 'students.view'
  | 'assessments.manage'
  | 'assessments.create'
  | 'assessments.approve'
  | 'timetable.manage'
  | 'timetable.edit'
  | 'fees.manage'
  | 'users.manage'
  | 'classes.manage'
  | 'subjects.manage'
  | 'results.approve'
  | 'results.manage'
  | 'results.view'
  | 'reports.manage'
  | 'communications.send'
  | 'curriculum.manage'
  | 'exams.manage'
  | 'attendance.manage'
  | 'library.manage'
  | 'gallery.manage'
  | 'lesson-plans.manage'
  | 'stamps.manage'
  | 'analytics.view'
  | 'settings.view'
  | 'staff.view'
  | 'classes.view'
  | 'subjects.view'
  | 'timetable.view'
  | 'fees.view'
  | 'users.view'
  | 'communications.view'
  | 'curriculum.view'
  | 'exams.view'
  | 'attendance.view'
  | 'library.view'
  | 'gallery.view'
  | 'lesson-plans.view'
  | 'stamps.view'
  | 'reports.view'
  | 'template-personalization.manage'
  | 'benchmarking.manage'
  | 'grading-policies.manage'
  ;

const ALL_PERMISSIONS: Permission[] = [
  'settings.edit', 'staff.manage', 'students.manage', 'students.view',
  'assessments.manage', 'assessments.create', 'assessments.approve',
  'timetable.manage', 'timetable.edit', 'fees.manage', 'users.manage',
  'classes.manage', 'subjects.manage', 'results.approve', 'results.manage', 'results.view',
  'reports.manage', 'communications.send', 'curriculum.manage', 'exams.manage',
  'attendance.manage', 'library.manage', 'gallery.manage', 'lesson-plans.manage',
  'stamps.manage', 'analytics.view',
  'settings.view', 'staff.view', 'classes.view', 'subjects.view', 'timetable.view',
  'fees.view', 'users.view', 'communications.view', 'curriculum.view', 'exams.view',
  'attendance.view', 'library.view', 'gallery.view', 'lesson-plans.view', 'stamps.view',
  'reports.view',
  'template-personalization.manage',
  'benchmarking.manage',
  'grading-policies.manage',
];

export type RoleKey = 'Director' | 'Deputy Director' | 'Head Teacher' | 'Deputy Head' | 'HOD' | 'Teacher' | 'Class Teacher' | 'Lower Primary Senior Teacher' | 'Upper Primary Senior Teacher';

const VIEW_ONLY: Permission[] = ALL_PERMISSIONS.filter(p => p.endsWith('.view') || p === 'analytics.view');

export const DEFAULT_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  Director: [...ALL_PERMISSIONS],
  'Deputy Director': [...ALL_PERMISSIONS],
  'Head Teacher': [
    ...VIEW_ONLY,
    'assessments.create', 'assessments.view', 'attendance.manage',
    'results.view', 'communications.view', 'lesson-plans.view',
    'stamps.view', 'library.view', 'gallery.view',
  ],
  'Deputy Head': [
    ...VIEW_ONLY,
    'assessments.create', 'assessments.view', 'attendance.manage',
    'results.view', 'communications.view', 'lesson-plans.view',
  ],
  HOD: [
    ...VIEW_ONLY,
    'assessments.create', 'assessments.view', 'assessments.approve',
    'staff.view', 'results.view',
  ],
  Teacher: [
    'assessments.view', 'assessments.create', 'results.view',
    'attendance.view', 'attendance.manage', 'timetable.view',
    'students.view', 'classes.view', 'subjects.view',
    'communications.view', 'analytics.view', 'lesson-plans.view', 'lesson-plans.manage',
    'library.view', 'gallery.view', 'stamps.view', 'stamps.manage',
    'reports.view', 'curriculum.view',
  ],
  'Class Teacher': [
    'assessments.view', 'assessments.create', 'results.view',
    'attendance.view', 'attendance.manage', 'timetable.view',
    'students.view', 'students.manage', 'classes.view', 'subjects.view',
    'communications.view', 'communications.send', 'analytics.view',
    'lesson-plans.view', 'lesson-plans.manage',
    'library.view', 'gallery.view', 'stamps.view', 'stamps.manage',
    'reports.view', 'reports.manage', 'curriculum.view',
  ],
  'Lower Primary Senior Teacher': [
    'assessments.view', 'assessments.create', 'results.view', 'results.manage',
    'attendance.view', 'attendance.manage', 'timetable.view',
    'students.view', 'students.manage', 'classes.view', 'classes.manage',
    'subjects.view', 'communications.view', 'communications.send',
    'analytics.view', 'lesson-plans.view', 'lesson-plans.manage',
    'library.view', 'gallery.view', 'stamps.view', 'stamps.manage',
    'reports.view', 'reports.manage', 'curriculum.view', 'staff.view',
  ],
  'Upper Primary Senior Teacher': [
    'assessments.view', 'assessments.create', 'assessments.approve',
    'results.view', 'results.manage', 'results.approve',
    'attendance.view', 'attendance.manage', 'timetable.view',
    'students.view', 'students.manage', 'classes.view', 'classes.manage',
    'subjects.view', 'communications.view', 'communications.send',
    'analytics.view', 'lesson-plans.view', 'lesson-plans.manage',
    'library.view', 'gallery.view', 'stamps.view', 'stamps.manage',
    'reports.view', 'reports.manage', 'curriculum.view', 'staff.view',
  ],
};

export function getDefaultPermissions(roles: string[]): Permission[] {
  const perms = new Set<Permission>();
  for (const role of roles) {
    const defaults = DEFAULT_ROLE_PERMISSIONS[role];
    if (defaults) defaults.forEach(p => perms.add(p));
  }
  return Array.from(perms);
}

export function can(permissions: Permission[], required: Permission): boolean {
  return permissions.includes(required);
}

export function canAny(permissions: Permission[], required: Permission[]): boolean {
  return required.some(p => permissions.includes(p));
}

export function isReadOnly(permissions: Permission[], managePermission: Permission): boolean {
  return !permissions.includes(managePermission);
}
