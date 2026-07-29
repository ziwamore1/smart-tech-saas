export type Permission =
  | 'settings.edit'
  | 'settings.view'
  | 'staff.manage'
  | 'staff.view'
  | 'students.manage'
  | 'students.view'
  | 'assessments.manage'
  | 'assessments.create'
  | 'assessments.approve'
  | 'assessments.view'
  | 'timetable.manage'
  | 'timetable.edit'
  | 'timetable.view'
  | 'fees.manage'
  | 'fees.view'
  | 'users.manage'
  | 'users.view'
  | 'classes.manage'
  | 'classes.view'
  | 'subjects.manage'
  | 'subjects.view'
  | 'results.approve'
  | 'results.manage'
  | 'results.view'
  | 'reports.manage'
  | 'reports.view'
  | 'communications.send'
  | 'communications.view'
  | 'curriculum.manage'
  | 'curriculum.view'
  | 'analytics.view'
  | 'exams.manage'
  | 'exams.view'
  | 'attendance.manage'
  | 'attendance.view'
  | 'library.manage'
  | 'library.view'
  | 'gallery.manage'
  | 'gallery.view'
  | 'lesson-plans.manage'
  | 'lesson-plans.view'
  | 'stamps.manage'
  | 'stamps.view'
  | 'benchmarking.view'
  | 'template-personalization.manage'
  | 'template-personalization.view'
  | 'grading-policies.manage'
  | 'grading-policies.view';

export interface RoleSource {
  roles: string[];
  platformRoles?: string[];
  schoolRoles?: string[];
}

export const PERMISSION_LABELS: Record<Permission, string> = {
  'settings.edit': 'Edit School Settings',
  'settings.view': 'View Settings',
  'staff.manage': 'Manage Staff (Add/Edit/Delete)',
  'staff.view': 'View Staff',
  'students.manage': 'Manage Students (Add/Edit/Delete)',
  'students.view': 'View Students',
  'assessments.manage': 'Manage Assessment Definitions',
  'assessments.create': 'Create Assessments',
  'assessments.approve': 'Approve/Verify Assessments',
  'assessments.view': 'View Assessments',
  'timetable.manage': 'Manage Timetable Structure',
  'timetable.edit': 'Edit Timetable Slots',
  'timetable.view': 'View Timetable',
  'fees.manage': 'Manage Fees (Create/Edit/Delete)',
  'fees.view': 'View Fees',
  'users.manage': 'Manage Users (Create/Edit/Delete)',
  'users.view': 'View Users',
  'classes.manage': 'Manage Classes (Create/Edit/Delete)',
  'classes.view': 'View Classes',
  'subjects.manage': 'Manage Subjects (Create/Edit/Delete)',
  'subjects.view': 'View Subjects',
  'results.approve': 'Approve Final Results',
  'results.manage': 'Manage Results (Edit/Override)',
  'results.view': 'View Results',
  'reports.manage': 'Manage Reports',
  'reports.view': 'View Reports',
  'communications.send': 'Send Communications',
  'communications.view': 'View Communications',
  'curriculum.manage': 'Manage Curriculum',
  'curriculum.view': 'View Curriculum',
  'analytics.view': 'View Analytics',
  'exams.manage': 'Manage Exams (Create/Edit)',
  'exams.view': 'View Exams',
  'attendance.manage': 'Manage Attendance Records',
  'attendance.view': 'View Attendance',
  'library.manage': 'Manage Library',
  'library.view': 'View Library',
  'gallery.manage': 'Manage Gallery',
  'gallery.view': 'View Gallery',
  'lesson-plans.manage': 'Manage Lesson Plans',
  'lesson-plans.view': 'View Lesson Plans',
  'stamps.manage': 'Manage Digital Stamps',
  'stamps.view': 'View Digital Stamps',
  'benchmarking.view': 'View Benchmarking',
  'template-personalization.manage': 'Manage Template Personalization',
  'template-personalization.view': 'View Template Personalization',
  'grading-policies.manage': 'Manage Grading Policies',
  'grading-policies.view': 'View Grading Policies',
};

export const PERMISSION_CATEGORIES: Record<string, { label: string; permissions: Permission[] }> = {
  settings: {
    label: 'School Settings',
    permissions: ['settings.view', 'settings.edit'],
  },
  staff: {
    label: 'Staff Management',
    permissions: ['staff.view', 'staff.manage'],
  },
  students: {
    label: 'Student Management',
    permissions: ['students.view', 'students.manage'],
  },
  assessments: {
    label: 'Assessments',
    permissions: ['assessments.view', 'assessments.create', 'assessments.manage', 'assessments.approve'],
  },
  classes: {
    label: 'Classes',
    permissions: ['classes.view', 'classes.manage'],
  },
  subjects: {
    label: 'Subjects',
    permissions: ['subjects.view', 'subjects.manage'],
  },
  timetable: {
    label: 'Timetable',
    permissions: ['timetable.view', 'timetable.edit', 'timetable.manage'],
  },
  results: {
    label: 'Results',
    permissions: ['results.view', 'results.manage', 'results.approve'],
  },
  fees: {
    label: 'Fees',
    permissions: ['fees.view', 'fees.manage'],
  },
  users: {
    label: 'Users',
    permissions: ['users.view', 'users.manage'],
  },
  exams: {
    label: 'Exams',
    permissions: ['exams.view', 'exams.manage'],
  },
  attendance: {
    label: 'Attendance',
    permissions: ['attendance.view', 'attendance.manage'],
  },
  communications: {
    label: 'Communications',
    permissions: ['communications.view', 'communications.send'],
  },
  curriculum: {
    label: 'Curriculum',
    permissions: ['curriculum.view', 'curriculum.manage'],
  },
  analytics: {
    label: 'Analytics',
    permissions: ['analytics.view'],
  },
  reports: {
    label: 'Reports',
    permissions: ['reports.view', 'reports.manage'],
  },
  library: {
    label: 'Library',
    permissions: ['library.view', 'library.manage'],
  },
  gallery: {
    label: 'Gallery',
    permissions: ['gallery.view', 'gallery.manage'],
  },
  lessonPlans: {
    label: 'Lesson Plans',
    permissions: ['lesson-plans.view', 'lesson-plans.manage'],
  },
  stamps: {
    label: 'Digital Stamps',
    permissions: ['stamps.view', 'stamps.manage'],
  },
  benchmarking: {
    label: 'Benchmarking',
    permissions: ['benchmarking.view'],
  },
  templatePersonalization: {
    label: 'Template Personalization',
    permissions: ['template-personalization.view', 'template-personalization.manage'],
  },
  gradingPolicies: {
    label: 'Grading Policies',
    permissions: ['grading-policies.view', 'grading-policies.manage'],
  },
};

export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSION_CATEGORIES)
  .flatMap(c => c.permissions) as Permission[];

type RoleKey = 'SuperAdmin' | 'Director' | 'Deputy Director' | 'Head Teacher' | 'Deputy Head' | 'Deputy' | 'HOD' | 'Teacher' | 'Class Teacher' | 'Lower Primary Senior Teacher' | 'Upper Primary Senior Teacher';

export function isRoleKey(role: string): role is RoleKey {
  return ['SuperAdmin', 'Director', 'Deputy Director', 'Head Teacher', 'Deputy Head', 'Deputy', 'HOD', 'Teacher', 'Class Teacher', 'Lower Primary Senior Teacher', 'Upper Primary Senior Teacher'].includes(role);
}

const ALL: Permission[] = ALL_PERMISSIONS;

const FULL_ACCESS: Permission[] = ALL;

const VIEW_ONLY: Permission[] = ALL_PERMISSIONS.filter(p => p.endsWith('.view') || p === 'analytics.view');

export const DEFAULT_ROLE_PERMISSIONS: Record<RoleKey, Permission[]> = {
  'SuperAdmin': FULL_ACCESS,
  'Director': FULL_ACCESS,
  'Deputy Director': [
    ...FULL_ACCESS,
  ],
  'Head Teacher': [
    ...VIEW_ONLY,
    'assessments.create',
    'assessments.view',
    'attendance.manage',
    'results.view',
    'communications.view',
    'lesson-plans.view',
    'stamps.view',
    'library.view',
    'gallery.view',
  ],
  'Deputy Head': [
    ...VIEW_ONLY,
    'assessments.create',
    'assessments.view',
    'attendance.manage',
    'results.view',
    'communications.view',
    'lesson-plans.view',
  ],
  'Deputy': [
    ...FULL_ACCESS,
  ],
  'HOD': [
    ...VIEW_ONLY,
    'assessments.create',
    'assessments.view',
    'assessments.approve',
    'staff.view',
    'results.view',
  ],
  'Teacher': [
    'assessments.view',
    'assessments.create',
    'results.view',
    'attendance.view',
    'attendance.manage',
    'timetable.view',
    'students.view',
    'classes.view',
    'subjects.view',
    'communications.view',
    'analytics.view',
    'lesson-plans.view',
    'lesson-plans.manage',
    'library.view',
    'gallery.view',
    'stamps.view',
    'stamps.manage',
    'reports.view',
    'curriculum.view',
  ],
  'Class Teacher': [
    'assessments.view',
    'assessments.create',
    'results.view',
    'attendance.view',
    'attendance.manage',
    'timetable.view',
    'students.view',
    'students.manage',
    'classes.view',
    'subjects.view',
    'communications.view',
    'communications.send',
    'analytics.view',
    'lesson-plans.view',
    'lesson-plans.manage',
    'library.view',
    'gallery.view',
    'stamps.view',
    'stamps.manage',
    'reports.view',
    'reports.manage',
    'curriculum.view',
  ],
  'Lower Primary Senior Teacher': [
    'assessments.view',
    'assessments.create',
    'results.view',
    'results.manage',
    'attendance.view',
    'attendance.manage',
    'timetable.view',
    'students.view',
    'students.manage',
    'classes.view',
    'classes.manage',
    'subjects.view',
    'communications.view',
    'communications.send',
    'analytics.view',
    'lesson-plans.view',
    'lesson-plans.manage',
    'library.view',
    'gallery.view',
    'stamps.view',
    'stamps.manage',
    'reports.view',
    'reports.manage',
    'curriculum.view',
    'staff.view',
  ],
  'Upper Primary Senior Teacher': [
    'assessments.view',
    'assessments.create',
    'assessments.approve',
    'results.view',
    'results.manage',
    'results.approve',
    'attendance.view',
    'attendance.manage',
    'timetable.view',
    'students.view',
    'students.manage',
    'classes.view',
    'classes.manage',
    'subjects.view',
    'communications.view',
    'communications.send',
    'analytics.view',
    'lesson-plans.view',
    'lesson-plans.manage',
    'library.view',
    'gallery.view',
    'stamps.view',
    'stamps.manage',
    'reports.view',
    'reports.manage',
    'curriculum.view',
    'staff.view',
  ],
};

export function getDefaultPermissions(roles: string[]): Permission[] {
  const permissions = new Set<Permission>();
  for (const role of roles) {
    if (isRoleKey(role)) {
      for (const p of DEFAULT_ROLE_PERMISSIONS[role]) {
        permissions.add(p);
      }
    }
  }
  return Array.from(permissions);
}

export function getMergedRoles(source: RoleSource): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];

  const addRole = (role: string) => {
    const normalized = normalizeRoleName(role);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      merged.push(role);
    }
  };

  for (const role of source.roles || []) addRole(role);
  for (const role of source.platformRoles || []) addRole(role);
  for (const role of source.schoolRoles || []) addRole(role);

  return merged;
}

function normalizeRoleName(role: string): string {
  const lower = role.toLowerCase();
  if (lower === 'classteacher' || lower === 'class teacher') return 'ClassTeacher';
  if (lower === 'deputydirector' || lower === 'deputy director') return 'DeputyDirector';
  if (lower === 'headteacher' || lower === 'head teacher') return 'HeadTeacher';
  if (lower === 'deputyhead' || lower === 'deputy head') return 'DeputyHead';
  return lower;
}

export function hasPermission(user: { roles?: string[]; platformRoles?: string[]; schoolRoles?: string[] } | null | undefined, permission: Permission): boolean {
  if (!user) return false;
  const merged = getMergedRoles(user);
  const defaults = getDefaultPermissions(merged);
  return defaults.includes(permission);
}

export function can(
  permissions: Permission[] | null | undefined,
  required: Permission,
): boolean {
  if (!permissions) return false;
  return permissions.includes(required);
}

export function canAny(
  permissions: Permission[] | null | undefined,
  required: Permission[],
): boolean {
  if (!permissions) return false;
  return required.some(p => permissions.includes(p));
}

export function canAll(
  permissions: Permission[] | null | undefined,
  required: Permission[],
): boolean {
  if (!permissions) return false;
  return required.every(p => permissions.includes(p));
}

export function isReadOnly(
  permissions: Permission[] | null | undefined,
  managePermission: Permission,
): boolean {
  if (!permissions) return true;
  return !permissions.includes(managePermission);
}

export const STORAGE_KEY = 'smarttech_role_permissions';
