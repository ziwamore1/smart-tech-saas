# Known Gaps & Future Fixes

> Last updated: 2026-07-17
> All items below have been resolved. This document is kept for historical reference.

---

## All Gaps Resolved (2026-07-17)

| # | Gap | Platform | Priority | Status |
|---|---|---|---|---|
| 1 | Staff Positions Management Screen | Mobile | Medium | ✅ Fixed |
| 2 | Staff Returns Hub Screen | Mobile | Medium | ✅ Fixed |
| 3 | StaffScreen Position Type Display | Mobile | Low | ✅ Fixed |
| 4 | App-Portal Dashboard `router` Import | Web | Low | ✅ Already had import |
| 5 | Mobile Menu Scroll Locking | Web | Low | ✅ Fixed |
| 6 | Responsive Table Overflow | Web | Low | ✅ Verified/Fixed |
| 7 | Mobile Page Padding | Web | Low | ✅ Fixed |
| 8 | Deputy Director in StaffScreen | Mobile | Low | ✅ Fixed (merged with #3) |
| 9 | School Members Mobile Table | Web | Low | ✅ Fixed |
| 10 | Parent Layout Feature Parity | Web | Low | ✅ Fixed |

---

### Changes Made

#### 1. Staff Positions Management Screen (Mobile)
- **Created:** `SmartTechApp/src/screens/director/StaffPositionsScreen.tsx` — Full CRUD for departments and positions with tabs (Departments, Positions, Hierarchy), search, create/edit modals, delete with confirmation
- **Modified:** `SmartTechApp/src/navigation/DirectorTabNavigator.tsx` — Added `StaffPositionsScreen` import and drawer entry
- **Modified:** `SmartTechApp/src/screens/director/StaffScreen.tsx` — Added "Manage Staff Positions" link

#### 2. Staff Returns Hub Screen (Mobile)
- **Created:** `SmartTechApp/src/screens/director/StaffReturnsScreen.tsx` — Full HR profiles management with overview stats, profiles CRUD, returns listing, search
- **Modified:** `SmartTechApp/src/services/api.ts` — Added 10 staff record API endpoints (profiles, returns, analytics, columns, reorder)
- **Modified:** `SmartTechApp/src/navigation/DirectorTabNavigator.tsx` — Added `StaffReturnsScreen` import and drawer entry

#### 3+8. StaffScreen Position Type Display + Deputy Director Role
- **Modified:** `SmartTechApp/src/screens/director/StaffScreen.tsx` — Added position type badge with color coding (Director, Deputy Director, HOD, Head Teacher, Class Teacher, Teacher, Support), horizontal filter chips by position type, visual differentiation between leadership and teaching staff

#### 4. App-Portal Dashboard `router` Import
- **Status:** Already resolved — `useRouter` was already imported on line 4

#### 5. Mobile Menu Scroll Locking
- **Modified:** `frontend/apps/app-portal/app/dashboard/layout.tsx` — Replaced dropdown menu with fixed backdrop overlay + side panel (matching super-admin pattern)
- **Modified:** `frontend/app/dashboard/layout.tsx` — Same fix applied

#### 6. Responsive Table Overflow
- **Verified:** All teacher/student tables already use `overflow-x-auto` wrappers

#### 7. Mobile Page Padding Optimization
- **Modified:** `frontend/apps/app-portal/app/dashboard/layout.tsx` — Added `page-content` class and CSS media query to reduce padding from 32px to 16px on mobile
- **Modified:** `frontend/app/dashboard/layout.tsx` — Same fix applied

#### 9. School Members Mobile Table
- **Modified:** `frontend/app/dashboard/school-members/page.tsx` — Added mobile card view (shown on screens <640px) with avatar, name, email, status badge, role badges, and action buttons; desktop table hidden on mobile
- **Modified:** `frontend/apps/app-portal/app/dashboard/school-members/page.tsx` — Same card view added

#### 10. Parent Layout Feature Parity
- **Modified:** `frontend/app/parent/layout.tsx` — Updated nav items from 3 to 8, matching app-portal version (Dashboard, Timetable, Results, Homework, Reports, Assessments, Attendance, Analytics)
