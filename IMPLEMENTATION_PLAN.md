# SmartTech SaaS — Implementation Plan

> **Last Updated:** 12 July 2026  
> **Branch:** `main` (HEAD `fd462bc`)  
> **Stack:** NestJS (backend) + Next.js 16 (web) + React Native (mobile) + PostgreSQL + Prisma  
> **Production:** `api.smarttechsaas.com` / `app.smarttechsaas.com` (Railway)

---

## Status Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Complete and deployed |
| 🟡 | In progress / partially done |
| 🔲 | Not started |
| ❌ | Blocked or failed |

---

## 1. Original Bug Fixes (All Complete)

| # | Issue | Status | Commit |
|---|-------|--------|--------|
| 1.1 | Primary school pupils not displaying on Students page | ✅ | — |
| 1.2 | Class assignment for Primary school teachers not working | ✅ | — |
| 1.3 | ECZ Grade 7 Grading System corrected (Four: 40-49%, Five: 0-39%) | ✅ | `2cbef33` |

---

## 2. Identity & Authorization Redesign

### 2.1 Phase 1 — Foundation (✅ Complete)

| Task | Status | Commit | Files |
|------|--------|--------|-------|
| Create 6 new Prisma models | ✅ | `11c1307` | `schema.prisma` |
| Add reverse relations to User, School, Class, Department, AcademicYear | ✅ | `11c1307` | `schema.prisma` |
| `SchoolMembershipService` + controller + module | ✅ | `11c1307` | `backend/src/school-membership/` |
| `PlatformRoleService` + controller + module | ✅ | `11c1307` | `backend/src/platform-role/` |
| `ClassTeacherAssignmentService` + controller + module | ✅ | `11c1307` | `backend/src/class-teacher-assignment/` |
| Register 3 new modules in `app.module.ts` | ✅ | `11c1307` | `backend/src/app.module.ts` |
| Data migration script | ✅ | `11c1307` | `backend/prisma/migrate-identity.ts` |
| Prisma migration SQL | ✅ | `11c1307` | `backend/prisma/migrations/20260712160000_*` |

**New Prisma models created:**
- `SchoolRoleAssignment` — School-level role (Director, Teacher, HOD, etc.)
- `PlatformRoleAssignment` — Platform-wide role (SuperAdmin)
- `ClassTeacherAssignment` — Teacher assigned as class teacher
- `DepartmentAssignment` — Teacher assigned to department
- `ClubAssignment` — Teacher assigned to club
- `CommitteeAssignment` — Teacher assigned to committee

### 2.2 Phase 2 — Backend Integration (✅ Complete)

| Task | Status | Commit | Files |
|------|--------|--------|-------|
| JWT payload includes `platformRoles`, `schoolRoles`, merged `allRoles` | ✅ | `4d9014a` | `auth.service.ts` |
| `RolesGuard` checks 4 sources (UserRole, PlatformRole, SchoolRole JWT, SchoolRole DB) | ✅ | `4d9014a` | `roles.guard.ts` |
| `createDirector` auto-creates Teacher + SchoolUser + SchoolRoleAssignment | ✅ | `4d9014a` | `auth.service.ts` |
| `registerInstitution` auto-creates Teacher + SchoolUser + SchoolRoleAssignment | ✅ | `4d9014a` | `institution-registration.service.ts` |
| `teacher.service.ts` `create()` auto-creates SchoolUser + SchoolRoleAssignment | ✅ | `4d9014a` | `teacher.service.ts` |
| Director exclusion removed from `getTeacherPerformance` | ✅ | `4d9014a` | `analytics.service.ts` |
| Hardcoded role list updated (added Deputy Director, SuperAdmin, HOD) | ✅ | `4d9014a` | `role.controller.ts` |
| `Express` auth middleware exposes new fields on `req.user` | ✅ | — | `main.ts` |

### 2.3 Phase 3 — Frontend Integration (✅ Complete)

| Task | Status | Commit | Files |
|------|--------|--------|-------|
| Add `schoolMembershipApi`, `platformRoleApi`, `classTeacherAssignmentApi` to API client | ✅ | `f4d3618` | `apps/app-portal/lib/api.ts` + `lib/api.ts` |
| Auth context exposes `platformRoles` and `schoolRoles` from JWT | ✅ | `f4d3618` | `apps/app-portal/lib/auth-context.tsx` + `lib/auth-context.tsx` |
| Teachers page fetches from school-membership teaching staff endpoint | ✅ | `f4d3618` | `teachers/page.tsx` (both copies) |
| Add Deputy Director + HOD to AVAILABLE_ROLES | ✅ | `4d9014a` | `users/page.tsx` (both copies) |

### 2.4 Production Deployment (✅ Complete)

| Task | Status | Commit / Action | Notes |
|------|--------|-----------------|-------|
| Dockerfile CMD fix (operator precedence) | ✅ | `1ebb410` | `node` always starts even if migration fails |
| `/health/migrate-identity` endpoint added | ✅ | `dbe42cf` | Remote trigger for data migration |
| Prisma migration applied on production | ✅ | Auto via Dockerfile CMD | `prisma migrate deploy` on startup |
| Fix missing `schoolId` column on `SchoolRoleAssignment` | ✅ | `fd462bc` | New migration `20260712180000` |
| Data migration executed on production | ✅ | Hit `/health/migrate-identity` | 5 SchoolRoleAssignments + 1 ClassTeacherAssignment created |

---

## 3. Remaining Work

### 3.1 Phase 4 — Frontend Permission Gating ✅

Currently, frontend pages use legacy `user.roles` array for permission checks. They need to be updated to use the new `platformRoles` and `schoolRoles` from the auth context.

| Task | Status | Files to Modify |
|------|--------|-----------------|
| Create `hasPermission(user, permission)` utility that checks all 4 role sources | ✅ | `frontend/apps/app-portal/lib/permissions.ts` |
| Update `PermissionsGate` / role-check components to use new utility | ✅ | `permissions.ts`, `permission-context.tsx` |
| Update Dashboard page to use new role fields for conditional rendering | ✅ | `dashboard/page.tsx` |
| Update Teachers page role-based filtering | ✅ | `teachers/page.tsx` |
| Update Users page to show platform roles and school roles separately | ✅ | `users/page.tsx` |
| Update Student Enrollments page | ✅ | Already uses `isClassTeacher` from auth context |
| Update Class Management page | ✅ | `classes/page.tsx` |
| Update all duplicate `frontend/app/dashboard/` copies | ✅ | Same files in `frontend/app/dashboard/` |

### 3.1a Phase 4a — Add Lower Primary Senior Teacher & Upper Primary Senior Teacher ✅

| Task | Status | Commit | Files |
|------|--------|--------|-------|
| Add both roles to backend seed files | ✅ | `7411c5e` | `seed-roles.ts`, `seed.ts`, `seed_production.sql` |
| Add to backend school roles whitelist | ✅ | `7411c5e` | `role.controller.ts`, `health.controller.ts`, `migrate-identity.ts` |
| Add RoleKey + DEFAULT_ROLE_PERMISSIONS | ✅ | `7411c5e` | `permissions.ts` (frontend + mobile) |
| Add to UserRole types (role-guard, useRole) | ✅ | `7411c5e` | Both copies |
| Add to user/teacher dropdowns for PRIMARY_SCHOOL | ✅ | `7411c5e` | users/page.tsx, teachers/page.tsx (both copies) |
| Add to primary/teachers page, institution-types, dashboard ROLE_MAP | ✅ | `7411c5e` | Multiple files |
| Add to supervisor/admin role lists (performance, assessment, staff) | ✅ | `7411c5e` | 4 pages (both copies) |
| Add to permissions/page.tsx MANAGED_ROLES | ✅ | `7411c5e` | permissions/page.tsx |
| Add to shared types + constants | ✅ | `7411c5e` | shared/types, shared/constants |
| Mobile: AppNavigator.tsx navigation fix | ✅ | `7411c5e` | Critical navigation fix |
| Mobile: ExamDetailScreen.tsx, usePermissions.ts | ✅ | `7411c5e` | Role checks |

### 3.2 Phase 5 — School Membership Management UI 🟡

| Task | Status | Files to Create/Modify |
|------|--------|----------------------|
| "School Members" page — list all members with roles | ✅ | New page at `dashboard/school-members/page.tsx` |
| "Add Member" — search users and assign to school | ✅ | Modal on school-members page using `schoolMembershipApi` |
| "Assign School Role" — dropdown to assign/remove roles | ✅ | Inline dropdown + role removal on school-members page |
| "Remove Member" — remove user from school | ✅ | Confirmation dialog on school-members page |
| "Manage Teaching Staff" — assign classes, departments | 🔲 | Extension of teachers page |

### 3.3 Phase 6 — Platform Role Management UI 🔲

| Task | Status | Files to Create/Modify |
|------|--------|----------------------|
| SuperAdmin panel — list all platform role assignments | 🔲 | New admin page |
| Assign/Revoke platform roles | 🔲 | UI controls on admin page |
| View users by platform role | 🔲 | Filtered list view |

### 3.4 Phase 7 — Class Teacher Assignment UI 🔲

| Task | Status | Files to Create/Modify |
|------|--------|----------------------|
| Assign class teacher from Class Management page | 🔲 | `classes/page.tsx` |
| View class teacher assignment history | 🔲 | New tab or section |
| Auto-populate ClassTeacherAssignment from existing Class.classTeacherId | 🔲 | Data migration (done ✅) |

---

## 4. Data Migration Status

| Source Table | Target Table | Records Migrated | Status |
|-------------|-------------|-----------------|--------|
| `User` (with schoolId) | `SchoolUser` | 0 (already existed) | ✅ |
| `UserRole` (school-level) | `SchoolRoleAssignment` | 5 created | ✅ |
| `UserRole` (SuperAdmin) | `PlatformRoleAssignment` | 0 (none found) | ✅ |
| `Class.classTeacherId` | `ClassTeacherAssignment` | 1 created | ✅ |
| `Teacher.departmentId` | `DepartmentAssignment` | 0 (pending) | ✅ (none found) |

**Re-run safe:** Endpoint `/api/v1/health/migrate-identity` is idempotent — skips existing records.

---

## 5. Architecture Reference

### 5.1 New Prisma Models (ERD)

```
User ──< SchoolUser ──< SchoolRoleAssignment
  │                        │
  ├──< PlatformRoleAssignment
  │
  ├──< ClassTeacherAssignment >── Class
  │         │
  │         └──> AcademicYear
  │
  ├──< DepartmentAssignment >── Department
  │
  ├──< ClubAssignment
  │
  └──< CommitteeAssignment
```

### 5.2 Role Resolution Order (4 Sources)

When checking if a user has a role, the system checks in this order:

1. **Legacy `UserRole`** — Direct role assignment via `UserRole` table
2. **`PlatformRoleAssignment`** — Platform-wide roles (e.g., SuperAdmin)
3. **`SchoolRoleAssignment` (from JWT)** — School roles embedded in JWT at login
4. **`SchoolRoleAssignment` (from DB)** — School roles queried from database (fallback)

### 5.3 JWT Payload Shape

```json
{
  "sub": "user-id",
  "schoolId": "school-id",
  "teacherId": "teacher-id",
  "classTeacherOf": "class-id",
  "institutionType": "PRIMARY_SCHOOL",
  "roles": ["Director"],
  "platformRoles": ["SuperAdmin"],
  "schoolRoles": ["Director", "Teacher"],
  "allRoles": ["Director", "SuperAdmin", "Teacher"]
}
```

### 5.4 Key API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/school-membership/members` | GET | List all school members |
| `/api/v1/school-membership/teaching-staff` | GET | List teaching staff with assignments |
| `/api/v1/school-membership/roles` | POST | Assign school role |
| `/api/v1/platform-roles/assign` | POST | Assign platform role |
| `/api/v1/class-teacher-assignments` | POST | Assign class teacher |
| `/api/v1/health/migrate-identity` | GET | Run identity data migration |
| `/api/v1/health/fix-ecz-g7-grading` | GET | Fix ECZ G7 grading data |

---

## 6. File Inventory

### Backend — New Files

| File | Purpose |
|------|---------|
| `backend/src/school-membership/school-membership.service.ts` | CRUD for SchoolUser + SchoolRoleAssignment |
| `backend/src/school-membership/school-membership.controller.ts` | REST endpoints |
| `backend/src/school-membership/school-membership.module.ts` | NestJS module |
| `backend/src/platform-role/platform-role.service.ts` | CRUD for PlatformRoleAssignment |
| `backend/src/platform-role/platform-role.controller.ts` | REST endpoints |
| `backend/src/platform-role/platform-role.module.ts` | NestJS module |
| `backend/src/class-teacher-assignment/class-teacher-assignment.service.ts` | CRUD for ClassTeacherAssignment |
| `backend/src/class-teacher-assignment/class-teacher-assignment.controller.ts` | REST endpoints |
| `backend/src/class-teacher-assignment/class-teacher-assignment.module.ts` | NestJS module |
| `backend/prisma/migrate-identity.ts` | Data migration script |
| `backend/prisma/migrations/20260712160000_add_identity_authorization_models/migration.sql` | Schema migration |
| `backend/prisma/migrations/20260712180000_add_schoolid_to_school_role_assignment/migration.sql` | Fix migration |

### Backend — Modified Files

| File | Changes |
|------|---------|
| `backend/src/auth/auth.service.ts` | JWT includes new fields; `createDirector` auto-creates membership |
| `backend/src/auth/guards/roles.guard.ts` | Checks 4 role sources |
| `backend/src/institution/institution-registration.service.ts` | Auto-creates membership on registration |
| `backend/src/teacher/teacher.service.ts` | `create()` auto-creates SchoolUser + SchoolRoleAssignment |
| `backend/src/analytics/analytics.service.ts` | Director exclusion removed |
| `backend/src/role/role.controller.ts` | Hardcoded list updated |
| `backend/src/common/health.controller.ts` | Added `/migrate-identity` endpoint |
| `backend/src/main.ts` | Express middleware exposes new JWT fields |
| `backend/src/app.module.ts` | 3 new modules registered |
| `backend/prisma/schema.prisma` | 6 new models + reverse relations |
| `backend/Dockerfile` | CMD operator precedence fix |

### Frontend — Modified Files

| File | Changes |
|------|---------|
| `frontend/apps/app-portal/lib/api.ts` | Added 3 new API clients |
| `frontend/apps/app-portal/lib/auth-context.tsx` | User interface + JWT parsing for new fields |
| `frontend/apps/app-portal/app/dashboard/teachers/page.tsx` | School-membership query added |
| `frontend/apps/app-portal/app/dashboard/users/page.tsx` | Deputy Director + HOD in role list |
| `frontend/lib/api.ts` | Added 3 new API clients (duplicate) |
| `frontend/lib/auth-context.tsx` | User interface + JWT parsing for new fields (duplicate) |
| `frontend/app/dashboard/teachers/page.tsx` | School-membership query added (duplicate) |
| `frontend/app/dashboard/users/page.tsx` | Deputy Director + HOD in role list (duplicate) |

---

## 7. Known Issues

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | Login endpoint times out on Railway cold starts | Low | 🟡 Railway infrastructure — not a code issue |
| 2 | Frontend permission checks still use legacy `user.roles` only | Medium | ✅ Phase 4 |
| 3 | Duplicate frontend copies (`apps/app-portal/` vs `app/`) need syncing | Low | 🟡 Ongoing — both copies updated each time |
| 4 | `DepartmentAssignment` migration found 0 records — may need re-check after teachers get departments assigned | Low | 🔲 |
| 5 | No `SchoolUser` records created by migration (all users already had them) | Info | ✅ Expected |

---

## 8. Next Session Quick Start

```
1. Open this file: IMPLEMENTATION_PLAN.md
2. Check "Remaining Work" section (Section 3)
3. Start with Phase 5: School Membership Management UI
4. Run `git log --oneline -5` to verify current HEAD
5. Create a new branch if needed: git checkout -b feat/phase-5-membership-ui
6. Test login at https://app.smarttechsaas.com
7. Verify JWT payload includes platformRoles + schoolRoles in browser DevTools
```
