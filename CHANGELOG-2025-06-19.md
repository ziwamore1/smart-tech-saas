# Changelog — 2025-06-19

## Permission System (Web + Mobile)

### Web
- **Permission types & defaults** (`lib/permissions.ts`): 50+ permissions (manage/view per module), role defaults (Director/Deputy = full, Head Teacher/Deputy Head/HOD = view-only + limited write, Teacher/Class Teacher = job-specific), utility functions (`can`, `canAny`, `canAll`, `isReadOnly`)
- **Permission context** (`lib/permission-context.tsx`): React context merging role defaults with Director-defined overrides from `localStorage`
- **PermissionGuard components** (`components/permissions/`): `PermissionGuard`, `AnyPermissionGuard`, `AllPermissionsGuard`, `ReadOnlyWrapper`, `EditButton`, `DeleteButton`, `ManageButton`, `PermissionBadge`
- **ReadOnlyBanner** (`components/permissions/ReadOnlyBanner.tsx`): Amber banner "Read-only — Contact Director for edit access"
- **Role Permissions page** (`dashboard/permissions/`): Director-only UI with per-role toggle, category grouping, Grant All / View Only / Reset buttons
- **Integration**: Wired `PermissionProvider` in `providers.tsx`, added `ReadOnlyBanner` to staff-positions, settings, grading-policies, assessment-config, students, users pages. Added "Role Permissions" nav item in `layout.tsx`.

### Mobile
- **Permission types & defaults** (`utils/permissions.ts`): Same schema as web
- **Zustand store** (`utils/usePermissions.ts`): MMKV-persisted overrides, `usePermissions()` hook with `can`, `isReadOnly`, `isRestricted`
- **PermissionGuard components** (`components/PermissionGuard.tsx`): `PermissionGuard`, `ReadOnlyOverlay`
- **DirectorTabNavigator**: Filtered drawer items by permission (Students, Staff, Users, Exams, Templates), added "🔒 Restricted Access" badge in header
- **AppNavigator**: Gated 13 management stack screens behind permission checks (templates, stamps, communications, exams)

## Teacher Performance Page (Web)
- New page at `dashboard/teacher-performance/` with Overview (completion/scores/pass-rate table) and Effectiveness tabs
- Fetches from `analyticsApi.getTeacherPerformance()` + `intelligenceApi.getTeacherEffectiveness()`
- Term filter with auto-select current term, CSV export, skeleton loading

## Assessment Oversight (Web)
- New page at `dashboard/assessment-oversight/` with term filter, CSV export, Print report, skeleton loading, error retry
- **TeacherDetailDialog**: fade-in/scale-in animations, escape-key dismiss, "Enter Scores" link

## HOD Supervision (Mobile)
- **SupervisorTabNavigator** (new): Dedicated drawer for HODs with Departments, Pending Assessments, etc.
- **MonitoringDashboardScreen**: "Assessments" tab with per-teacher completion bars, pending counts, rates; API optimized (`getPendingAssessments()` called once)
- **TeacherAssessmentDetailScreen** (new): Drill-down into a specific teacher's pending assessments with stats row + progress cards

## Bug Fixes
- Replaced `colors.danger` → `colors.error` in SuperAdmin MonitoringScreen and DashboardScreen
- Optimized API calls in monitoring dashboard (N+1 → 2)
