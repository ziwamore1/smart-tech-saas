# Known Gaps & Future Fixes

> Last updated: 2026-07-16
> These items are documented but not yet implemented. They can be picked up in future sessions.

---

## 1. Mobile App — Staff Positions Management Screen

**Status:** Not started
**Priority:** Medium

The web app has full CRUD for staff positions (departments, acting positions, custom categories, hierarchy, monitoring chain). The mobile app only has read-only API calls.

### What's missing
- No `StaffPositionsScreen.tsx` exists
- No UI to create, edit, or delete departments
- No UI to create, edit, or delete acting staff positions
- No custom position category management
- No position assignment UI (assigning staff to positions)
- No position type filtering/viewing

### What exists
- Read-only API methods in `api.ts`: `getDepartments()`, `getStaffHierarchy()`, `getMyMonitoringChain()`, `getDepartmentTeachers()`, `getStaffPositions()`
- Write endpoints now added to `api.ts`: `createDepartment()`, `updateDepartment()`, `deleteDepartment()`, `createStaffPosition()`, `updateStaffPosition()`, `deleteStaffPosition()`
- `StaffScreen.tsx` exists but only shows a basic staff list with no position management

### Files to create/modify
- **Create:** `SmartTechApp/src/screens/director/StaffPositionsScreen.tsx`
- **Modify:** `SmartTechApp/src/navigation/DirectorTabNavigator.tsx` — add drawer entry
- **Modify:** `SmartTechApp/src/screens/director/StaffScreen.tsx` — add link to positions management

---

## 2. Mobile App — Staff Returns Hub Screen

**Status:** Not started
**Priority:** Medium

The web app has a full Staff Returns Hub with column reordering, staff records viewing, premium features, and Excel import/export. This entire feature is absent from the mobile app.

### What's missing
- No `StaffReturnsScreen.tsx` exists
- No API endpoints for staff returns/records in `api.ts`
- No column reordering UI
- No staff records viewing/management
- No Excel import/export capability

### Backend endpoints available
- `GET /premium/staff-records` — list records
- `POST /premium/staff-records` — create record
- `PUT /premium/staff-records/:id` — update record
- `DELETE /premium/staff-records/:id` — delete record
- `POST /premium/staff-records/reorder-columns` — reorder columns
- `GET /premium/staff-records/columns` — get column definitions
- `PUT /premium/staff-records/columns` — update column definitions

### Files to create/modify
- **Create:** `SmartTechApp/src/screens/director/StaffReturnsScreen.tsx`
- **Modify:** `SmartTechApp/src/services/api.ts` — add staff records CRUD endpoints
- **Modify:** `SmartTechApp/src/navigation/DirectorTabNavigator.tsx` — add drawer entry

---

## 3. Mobile App — StaffScreen Position Type Display

**Status:** Not started
**Priority:** Low

The `StaffScreen.tsx` shows a basic staff list but does not display position type information (Director, Deputy Director, HOD, Teacher, etc.). Users cannot distinguish staff roles at a glance.

### What's missing
- Position type badge/label on each staff card
- Filtering by position type
- Visual differentiation between leadership and teaching staff

### Files to modify
- **Modify:** `SmartTechApp/src/screens/director/StaffScreen.tsx`

---

## 4. Web Frontend — App-Portal Dashboard Layout Needs `router` Import

**Status:** Not started
**Priority:** Low

The `apps/app-portal/app/dashboard/layout.tsx` mobile logout button calls `router.push('/login')` but the file may not import `useRouter` from `next/navigation`. The main `frontend/app/dashboard/layout.tsx` does import it. Verify and fix if needed.

### Files to check
- `frontend/apps/app-portal/app/dashboard/layout.tsx`

---

## 5. Web Frontend — Mobile Menu Scroll Locking

**Status:** Not started
**Priority:** Low

When the mobile hamburger menu is open on the dashboard layout, the page behind can still scroll. The super-admin layout uses a backdrop overlay that prevents this, but the dashboard layout's dropdown menu does not.

### What's missing
- Body scroll lock when mobile menu is open
- Backdrop overlay behind the dropdown menu

### Files to modify
- `frontend/app/dashboard/layout.tsx`
- `frontend/apps/app-portal/app/dashboard/layout.tsx`

---

## 6. Web Frontend — Responsive Table Overflow on Mobile

**Status:** Not started
**Priority:** Low

Many data tables across the app (students, teachers, school members, assessments, etc.) use `<table>` elements that overflow on mobile screens. While some pages use `overflow-x-auto`, the tables themselves often have too many columns for mobile viewing.

### What's missing
- Consistent `overflow-x-auto` wrapper on all tables
- Card-based responsive layouts for mobile (alternative to tables)
- Column priority system (hide less important columns on mobile)

### Files to review
- All page components under `frontend/app/dashboard/` that render `<table>` elements
- `frontend/app/dashboard/school-members/page.tsx`
- `frontend/app/dashboard/teachers/page.tsx`
- `frontend/app/dashboard/students/page.tsx`

---

## 7. Web Frontend — Mobile Page Padding Optimization

**Status:** Not started
**Priority:** Low

Several dashboard pages use fixed `padding: '32px'` in the main content area, which wastes space on mobile screens. The dashboard layout does not adjust padding for mobile.

### What's missing
- Reduced padding on mobile (16px instead of 32px)
- Full-width content on small screens

### Files to modify
- `frontend/app/dashboard/layout.tsx` — main content padding
- `frontend/apps/app-portal/app/dashboard/layout.tsx`

---

## 8. Mobile App — Deputy Director Role in StaffScreen

**Status:** Not started
**Priority:** Low

The `StaffScreen.tsx` does not show position type information. The `Deputy Director` role is recognized in the monitoring dashboard and org chart, but the staff list does not differentiate between Director, Deputy Director, HOD, and regular teachers.

### Files to modify
- `SmartTechApp/src/screens/director/StaffScreen.tsx`

---

## 9. Web Frontend — School Members Page Mobile Table

**Status:** Not started
**Priority:** Low

The School Members page uses a full-width table with 5 columns (Member, Email, Status, Roles, Actions). On mobile this requires horizontal scrolling. A card-based layout would be more mobile-friendly.

### What's missing
- Responsive card layout for mobile
- Collapsible role badges
- Touch-friendly action buttons

### Files to modify
- `frontend/app/dashboard/school-members/page.tsx`
- `frontend/apps/app-portal/app/dashboard/school-members/page.tsx`

---

## 10. Mobile App — Parent Layout Missing Features

**Status:** Not started
**Priority:** Low

The parent layout in the web app has more nav items (Homework, Reports, Assessments, Attendance, Analytics) than the original parent layout. The app-portal mirror has been updated but verify the main frontend parent layout has all items.

### Files to verify
- `frontend/app/parent/layout.tsx`
- `frontend/apps/app-portal/app/parent/layout.tsx`

---

## Summary Table

| # | Gap | Platform | Priority | Effort |
|---|---|---|---|---|
| 1 | Staff Positions Management Screen | Mobile | Medium | Large |
| 2 | Staff Returns Hub Screen | Mobile | Medium | Large |
| 3 | StaffScreen Position Type Display | Mobile | Low | Small |
| 4 | App-Portal Dashboard `router` Import | Web | Low | Tiny |
| 5 | Mobile Menu Scroll Locking | Web | Low | Small |
| 6 | Responsive Table Overflow | Web | Low | Medium |
| 7 | Mobile Page Padding | Web | Low | Small |
| 8 | Deputy Director in StaffScreen | Mobile | Low | Small |
| 9 | School Members Mobile Table | Web | Low | Medium |
| 10 | Parent Layout Feature Parity | Web | Low | Tiny |
