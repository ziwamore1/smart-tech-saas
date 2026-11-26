export const PERMISSIONS = {
  CLASS_VIEW: 'CLASS_VIEW',
  CLASS_MANAGE: 'CLASS_MANAGE',
  CLASS_STUDENT_VIEW: 'CLASS_STUDENT_VIEW',
  RESULTS_VIEW: 'RESULTS_VIEW',
  RESULTS_ENTER: 'RESULTS_ENTER',
  RESULTS_DELEGATED_ENTRY: 'RESULTS_DELEGATED_ENTRY',
  RESULTS_EDIT: 'RESULTS_EDIT',
  RESULTS_APPROVE: 'RESULTS_APPROVE',
  RESULTS_PUBLISH: 'RESULTS_PUBLISH',
  ATTENDANCE_VIEW: 'ATTENDANCE_VIEW',
  ATTENDANCE_MARK: 'ATTENDANCE_MARK',
  REPORT_VIEW: 'REPORT_VIEW',
  REPORT_GENERATE: 'REPORT_GENERATE',
  ANALYTICS_VIEW: 'ANALYTICS_VIEW',
  ASSIGNMENT_VIEW: 'ASSIGNMENT_VIEW',
  ASSIGNMENT_MANAGE: 'ASSIGNMENT_MANAGE',
  CALENDAR_VIEW: 'CALENDAR_VIEW',
  CALENDAR_CREATE: 'calendar:create',
  CALENDAR_UPDATE: 'calendar:update',
  CALENDAR_DELETE: 'calendar:delete',
  CALENDAR_MANAGE: 'CALENDAR_MANAGE',
  CALENDAR_PUBLISH: 'CALENDAR_PUBLISH',
  CALENDAR_EXPORT: 'CALENDAR_EXPORT',
  CALENDAR_IMPORT: 'calendar:import',
  CALENDAR_MANAGE_REMINDERS: 'calendar:manage_reminders',
  CALENDAR_MANAGE_SETTINGS: 'calendar:manage_settings',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const PUBLIC_DATA_PERMISSIONS: Permission[] = [PERMISSIONS.CALENDAR_VIEW];

const PUBLIC_ONLY_ROLES = new Set([
  'ACCOUNTANT',
  'SECRETARY',
  'NONTEACHING',
  'NONTEACHINGSTAFF',
  'STAFF',
  'SCHOOLSTAFF',
]);

const PRIVILEGED_ROLES = new Set([
  'DIRECTOR',
  'DEPUTYDIRECTOR',
  'HEADTEACHER',
  'DEPUTY',
  'SUPERADMIN',
  'HOD',
  'TEACHER',
  'CLASSTEACHER',
  'PRIMARYTEACHER',
  'SUBJECTTEACHER',
  'LOWERPRIMARYSENIORTEACHER',
  'UPPERPRIMARYSENIORTEACHER',
  'SENIORTEACHER',
  'LECTURER',
  'RESEARCHSUPERVISOR',
  'PRINCIPAL',
  'REGISTRAR',
  'DEAN',
  'VICECHANCELLOR',
]);

const TEACHER_PERMISSIONS: Permission[] = [
  PERMISSIONS.CLASS_VIEW,
  PERMISSIONS.CLASS_STUDENT_VIEW,
  PERMISSIONS.RESULTS_VIEW,
  PERMISSIONS.RESULTS_ENTER,
  PERMISSIONS.RESULTS_EDIT,
  PERMISSIONS.ATTENDANCE_VIEW,
  PERMISSIONS.ATTENDANCE_MARK,
  PERMISSIONS.REPORT_VIEW,
  PERMISSIONS.REPORT_GENERATE,
  PERMISSIONS.ANALYTICS_VIEW,
  PERMISSIONS.CALENDAR_VIEW,
];

const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

const ROLE_DEFAULTS: Record<string, Permission[]> = {
  TEACHER: TEACHER_PERMISSIONS,
  'CLASS TEACHER': TEACHER_PERMISSIONS,
  HOD: TEACHER_PERMISSIONS,
  'HEAD TEACHER': TEACHER_PERMISSIONS,
  'PRIMARY TEACHER': TEACHER_PERMISSIONS,
  'SUBJECT TEACHER': TEACHER_PERMISSIONS,
  'LOWER PRIMARY SENIOR TEACHER': TEACHER_PERMISSIONS,
  'UPPER PRIMARY SENIOR TEACHER': TEACHER_PERMISSIONS,
  'SENIOR TEACHER': TEACHER_PERMISSIONS,
  'RESEARCH SUPERVISOR': TEACHER_PERMISSIONS,
  'VICE CHANCELLOR': TEACHER_PERMISSIONS,
  PRIMARYTEACHER: TEACHER_PERMISSIONS,
  SUBJECTTEACHER: TEACHER_PERMISSIONS,
  LOWERPRIMARYSENIORTEACHER: TEACHER_PERMISSIONS,
  UPPERPRIMARYSENIORTEACHER: TEACHER_PERMISSIONS,
  SENIORTEACHER: TEACHER_PERMISSIONS,
  LECTURER: TEACHER_PERMISSIONS,
  RESEARCHSUPERVISOR: TEACHER_PERMISSIONS,
  PRINCIPAL: TEACHER_PERMISSIONS,
  REGISTRAR: TEACHER_PERMISSIONS,
  DEAN: TEACHER_PERMISSIONS,
  VICECHANCELLOR: TEACHER_PERMISSIONS,
  'SCHOOL STAFF': PUBLIC_DATA_PERMISSIONS,
  STAFF: PUBLIC_DATA_PERMISSIONS,
  ACCOUNTANT: PUBLIC_DATA_PERMISSIONS,
  SECRETARY: PUBLIC_DATA_PERMISSIONS,
  NONTEACHING: PUBLIC_DATA_PERMISSIONS,
  NONTEACHINGSTAFF: PUBLIC_DATA_PERMISSIONS,
  HEADTEACHER: [
    ...TEACHER_PERMISSIONS,
    PERMISSIONS.CALENDAR_CREATE,
    PERMISSIONS.CALENDAR_UPDATE,
    PERMISSIONS.CALENDAR_DELETE,
    PERMISSIONS.CALENDAR_MANAGE,
    PERMISSIONS.CALENDAR_PUBLISH,
    PERMISSIONS.CALENDAR_EXPORT,
    PERMISSIONS.CALENDAR_IMPORT,
    PERMISSIONS.CALENDAR_MANAGE_REMINDERS,
    PERMISSIONS.CALENDAR_MANAGE_SETTINGS,
  ],
  DEPUTY: [
    ...TEACHER_PERMISSIONS,
    PERMISSIONS.CALENDAR_CREATE,
    PERMISSIONS.CALENDAR_UPDATE,
    PERMISSIONS.CALENDAR_DELETE,
    PERMISSIONS.CALENDAR_MANAGE,
    PERMISSIONS.CALENDAR_PUBLISH,
    PERMISSIONS.CALENDAR_EXPORT,
    PERMISSIONS.CALENDAR_IMPORT,
    PERMISSIONS.CALENDAR_MANAGE_REMINDERS,
    PERMISSIONS.CALENDAR_MANAGE_SETTINGS,
  ],
  'DEPUTY DIRECTOR': ALL_PERMISSIONS,
  DIRECTOR: ALL_PERMISSIONS,
  SUPERADMIN: ALL_PERMISSIONS,
};

export function normalizeRole(role: string): string {
  const normalized = role.trim().toUpperCase();
  if (normalized === 'DEPUTY HEAD') return 'DEPUTY';
  if (normalized === 'SUPER_ADMIN') return 'SUPERADMIN';
  if (['NON_TEACHING', 'NON-TEACHING', 'NON TEACHING', 'NON-TEACHING STAFF', 'NON TEACHING STAFF'].includes(normalized)) return 'NONTEACHINGSTAFF';
  return normalized;
}

function compactRole(role: string): string {
  return normalizeRole(role).replace(/[^A-Z0-9]/g, '');
}

export function isPublicOnlyRoleSet(roles: string[] = []): boolean {
  const normalized = roles.map(compactRole).filter(Boolean);
  if (!normalized.length) return false;
  if (normalized.some((role) => PRIVILEGED_ROLES.has(role))) return false;
  return normalized.some((role) => PUBLIC_ONLY_ROLES.has(role));
}

export function restrictToPublicData(permissions: Permission[]): Permission[] {
  return permissions.filter((permission) => PUBLIC_DATA_PERMISSIONS.includes(permission));
}

export function getDefaultPermissions(roles: string[] = []): Permission[] {
  const permissions = new Set<Permission>();
  for (const role of roles) {
    for (const permission of ROLE_DEFAULTS[normalizeRole(role)] || []) permissions.add(permission);
  }
  const result = Array.from(permissions);
  return isPublicOnlyRoleSet(roles) ? restrictToPublicData(result) : result;
}

/**
 * Teaching roles may enter results for any class in their school. Assignment
 * rows are still useful for discovery/oversight, but must not block a teacher
 * from saving scores once they are signed in to the school.
 */
export function hasResultsEntryRole(roles: string[] = []): boolean {
  return roles.some(role =>
    (ROLE_DEFAULTS[normalizeRole(role)] || []).includes(PERMISSIONS.RESULTS_ENTER),
  );
}

export const RESULTS_ENTRY_ROLES = [
  'Director',
  'Deputy Director',
  'Deputy Head',
  'Deputy',
  'Head Teacher',
  'HOD',
  'Teacher',
  'Class Teacher',
  'Primary Teacher',
  'Subject Teacher',
  'Lower Primary Senior Teacher',
  'Upper Primary Senior Teacher',
  'Senior Teacher',
  'Lecturer',
  'Research Supervisor',
  'Principal',
  'Registrar',
  'Dean',
  'Vice Chancellor',
  'SuperAdmin',
];
