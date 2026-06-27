# Status Report — admin-web (Tenant / Academy Admin Portal)

**App:** `apps/admin-web` **Audience:** Users with the `tenantAdmin` role
(school / academy administrators) **Stack:** Vite + React 18 + TypeScript, React
Router v7, TanStack Query v5, Zustand (via `@levelup/shared-stores`), Firebase
Auth + Firestore (callable Cloud Functions), Tailwind, shadcn-style UI from
`@levelup/shared-ui`. **Date:** 2026-06-19 **Cross-referenced:**
`docs/ADMIN-WEB-AUDIT-REPORT.md` (2026-03-01),
`requirements/admin-web/requirements.md` (v1.0, 2026-03-22)

---

## 1. What Exists & How It's Architected

admin-web is the tenant administrator console. It is a thin presentation layer:
nearly all data reads go through shared TanStack Query hooks
(`@levelup/shared-hooks/queries`) and all mutations go through callable Cloud
Function wrappers (`@levelup/shared-services/auth`). Local app code is mostly
page composition, dialog state, and table/filter glue.

### Bootstrapping & shell

- `apps/admin-web/src/main.tsx` mounts the app; `src/App.tsx` defines routes
  with `lazy()` + `Suspense`.
- `src/App.tsx` wires two cross-cutting effects: `useAuthStore.initialize()`
  (Firebase auth-state subscription) and
  `useTenantStore.subscribe(currentTenantId)` (live tenant doc subscription that
  resets when there is no active tenant).
- `src/layouts/AppLayout.tsx` is the authenticated shell: `AppShell` +
  `AppSidebar` (4 nav groups: Overview / Management / Analytics /
  Configuration), `NotificationBell` (live via
  `useNotifications`/`useUnreadCount`/`useMarkRead`/`useMarkAllRead`),
  `RoleSwitcher`, `ThemeToggle`, mobile `MobileBottomNav`, `QuotaWarningBanner`,
  breadcrumb, route announcer, page transitions, and a route-prefetch map
  (`ADMIN_PREFETCH_MAP`) that prefetches lazy chunks on link hover via
  `usePrefetch`.
- `src/layouts/AuthLayout.tsx` wraps the login route.

### Auth & guards

- `src/guards/RequireAuth.tsx` gates all non-login routes to
  `allowedRoles={["tenantAdmin"]}`. It now correctly asserts
  `currentMembership.tenantId === currentTenantId` (audit issue A1 is fixed),
  shows a full skeleton during `loading`, redirects to `/login` when
  unauthenticated, and renders an "Access Denied" panel on role/tenant mismatch.
- `App.tsx` defines an inline `OnboardingGuard` that redirects `tenantAdmin`
  users with `tenant.onboarding?.completed !== true` to `/onboarding`, while
  `isSuperAdmin` bypasses it.
- Tenant switching is delegated to `useAuthStore.switchTenant()`
  (`packages/shared-stores/src/auth-store.ts:260`), which updates custom claims
  server-side (`switchActiveTenant` callable) and refreshes the token.

### Pages (all under `apps/admin-web/src/pages/`)

| Route                | Page file                                                                 | Primary data source                                                                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/login`             | `LoginPage.tsx`                                                           | `lookupTenantByCode`, `useAuthStore.login`                                                                                                                                                               |
| `/onboarding`        | `OnboardingWizardPage.tsx`                                                | `callSaveTenant`, `callSaveAcademicSession`, `callSaveClass`                                                                                                                                             |
| `/`                  | `DashboardPage.tsx`                                                       | `useTenantStore`, `useClassSummaries`, `useDailyCostSummaries`, notifications                                                                                                                            |
| `/users`             | `UsersPage.tsx` (+ `components/users/{Teachers,Students,Parents}Tab.tsx`) | `useTeachers/useStudents/useParents/useClasses` + `callCreateOrgUser`, `callBulkImportStudents`, `callBulkImportTeachers`, `callBulkUpdateStatus`, `callSaveParent`, `useUpdateStudent/useUpdateTeacher` |
| `/classes`           | `ClassesPage.tsx`                                                         | `useClasses` + `useCreateClass/useUpdateClass/useDeleteClass`, `callBulkUpdateStatus`                                                                                                                    |
| `/classes/:classId`  | `ClassDetailPage.tsx`                                                     | class/teacher/student/exam/space hooks                                                                                                                                                                   |
| `/spaces`            | `SpacesOverviewPage.tsx`                                                  | `useSpaces` (read-only overview)                                                                                                                                                                         |
| `/courses`           | `CoursesPage.tsx`                                                         | space hooks (read-only)                                                                                                                                                                                  |
| `/exams`             | `ExamsOverviewPage.tsx`                                                   | `useExams`, `useTeachers`                                                                                                                                                                                |
| `/academic-sessions` | `AcademicSessionPage.tsx`                                                 | academic-session hooks + `callSaveAcademicSession`, `SessionRolloverDialog` -> `callRolloverSession`                                                                                                     |
| `/staff`             | `StaffPage.tsx` (+ `components/staff/{StaffTab,CreateStaffDialog}.tsx`)   | inline Firestore reads of `teachers` + `userMemberships`, `callSaveTeacher` (teacher permissions), `callSaveStaff`                                                                                       |
| `/announcements`     | `AnnouncementsPage.tsx`                                                   | `callSaveAnnouncement`, `callListAnnouncements`, `useClasses`                                                                                                                                            |
| `/analytics`         | `AnalyticsPage.tsx`                                                       | analytics summary hooks                                                                                                                                                                                  |
| `/reports`           | `ReportsPage.tsx`                                                         | `useExams`, `useClasses`, `callGenerateReport`                                                                                                                                                           |
| `/data-export`       | `DataExportPage.tsx`                                                      | `callExportTenantData`                                                                                                                                                                                   |
| `/ai-usage`          | `AIUsagePage.tsx`                                                         | `useDailyCostSummaries`, `useTenantSettings` + inline read of `gradingDeadLetter`                                                                                                                        |
| `/settings`          | `SettingsPage.tsx` (+ `components/settings/LogoUploader.tsx`)             | inline read of `evaluationSettings`, `callSaveTenant`, `callUploadTenantAsset` (via LogoUploader)                                                                                                        |
| `/notifications`     | `NotificationsPage.tsx`                                                   | `useNotifications/useMarkRead/useMarkAllRead`                                                                                                                                                            |

### Local utilities

- `src/hooks/usePagination.ts`, `src/hooks/useSort.ts` — client-side table
  helpers.
- `src/lib/constants.ts` — `STATUS_VARIANT` / `TYPE_VARIANT` badge maps.
- `src/components/skeletons/*`, `src/components/layout/QuotaWarningBanner.tsx`,
  `src/components/dashboard/QuotaUsageCard.tsx`,
  `src/components/sessions/SessionRolloverDialog.tsx`.

Most CRITICAL/HIGH items in the March audit have since been addressed:
tenantId-match check (A1), `RoleSwitcher` resolves real tenant names via a
batched `tenants` lookup in `AppLayout.tsx:226-248` (A3), Academic Sessions has
a nav entry (N1), Staff & Permissions, Announcements, and Data Export pages now
exist.

---

## 2. Entities / Schemas / Collections / APIs / Routes (with paths)

### Domain types (`packages/shared-types/src`) — source of truth

- `identity/tenant.ts` — `Tenant` (`/tenants/{tenantId}`) with nested
  `subscription`, `features` (`TenantFeatures` flags: autoGrade, levelUp,
  scannerApp, aiChat, aiGrading, analytics, parentPortal, bulkImport,
  apiAccess), `settings`, `stats`, `branding`, `usage`, `onboarding`,
  `deactivation`. Note deprecated top-level `logoUrl`/`bannerUrl` superseded by
  `branding.*`.
- `identity/membership.ts` — `UserMembership`
  (`/userMemberships/{uid}_{tenantId}`), `TenantRole` union
  (`superAdmin|tenantAdmin|teacher|student|parent|scanner|staff`),
  `TeacherPermissions` + `DEFAULT_TEACHER_PERMISSIONS`, `StaffPermissions` +
  `DEFAULT_STAFF_PERMISSIONS`, `MembershipClaimsInput`.
- `identity/user.ts`, `identity/claims.ts`, `identity/tenant-code.ts`.
- `tenant/class.ts` — `Class` (`/tenants/{tenantId}/classes/{classId}`):
  `grade`, `section`, `academicSessionId`, `teacherIds[]`, `studentIds[]`,
  `studentCount`, `status`.
- `tenant/teacher.ts` — `Teacher` (`/tenants/{tenantId}/teachers/{teacherId}`):
  `authUid` (deprecated `uid`), `subjects[]`, `classIds[]`, `status`.
- `tenant/student.ts`, `tenant/parent.ts`, `tenant/academic-session.ts`.
- `callable-types.ts` + `schemas/callable-schemas.ts` (Zod) — request/response
  contracts for all callables.

### Collections referenced by admin-web

- `/tenants/{tenantId}` (live subscription via `useTenantStore`)
- `/tenants/{tenantId}/{teachers,students,parents,classes,staff,spaces,exams,academicSessions,evaluationSettings,notifications,gradingDeadLetter}`
- `/userMemberships/{uid}_{tenantId}` (read directly in `StaffPage.tsx`)

### Callable API surface (`packages/shared-services/src/auth/auth-callables.ts` → `functions/identity/src/callable/`)

Used by admin-web: `createOrgUser`, `saveTenant`, `saveClass`, `saveStudent`,
`saveTeacher`, `saveParent`, `saveAcademicSession`, `saveStaff`,
`bulkImportStudents`, `bulkImportTeachers`, `bulkUpdateStatus`,
`rolloverSession`, `saveAnnouncement`, `listAnnouncements`, `exportTenantData`,
`uploadTenantAsset`, `manageNotifications`, `switchActiveTenant`, plus
report/analytics callables (`callGenerateReport`). Every wrapper is a thin
`httpsCallable` over `getCallable<Req,Res>(name)`.

### Access model (`firestore.rules`)

Helper functions establish the model: `isTenantAdmin(tenantId)` =
`hasRole(tenantId,'tenantAdmin') || isSuperAdmin()` (rules lines ~43). Tenant
subcollections (`students`, `teachers`, `parents`, `classes`, `staff`, `spaces`,
`exams`) grant write to `isTenantAdmin(tenantId)`. `userMemberships` are
role-gated. Indexes in `firestore.indexes.json`.

### Routes

Declared in `src/App.tsx`; nav structure in `src/layouts/AppLayout.tsx`
(`navGroups`, `ADMIN_ROUTE_LABELS`, `ADMIN_PREFETCH_MAP`, `AppMobileBottomNav`).

---

## 3. Strengths Worth Keeping

1. **Clean separation of concerns / shared layer reuse.** Reads via
   `@levelup/shared-hooks/queries`, writes via `@levelup/shared-services/auth`
   callables, UI via `@levelup/shared-ui`, state via `@levelup/shared-stores`.
   App code stays thin. This is exactly the foundation a common API layer +
   React Native apps need.
2. **All writes already go through callable Cloud Functions**
   (`auth-callables.ts`), not direct client Firestore writes. This is a strong,
   RN-portable boundary — the same `httpsCallable` contracts work from any
   client.
3. **Typed request/response contracts** centralized in `shared-types`
   (`callable-types.ts` + Zod `callable-schemas.ts`) — single source of truth
   shared by frontend and functions.
4. **Solid auth model**: two-step school-code login, multi-tenant memberships,
   custom-claims-driven active tenant, `RequireAuth` with role + tenant
   assertion, `OnboardingGuard`, `superAdmin` bypass.
5. **Multi-tenant UX done well**: `RoleSwitcher` with batched tenant-name
   resolution; per-tenant live subscription that resets cleanly.
6. **Performance hygiene**: route-level code splitting, hover prefetch,
   skeletons, page transitions, `MobileBottomNav`, SW update notifications.
7. **Onboarding wizard** (`OnboardingWizardPage.tsx`) with a coherent 4-step
   flow (school → academic session → first class → done) backed by real
   callables.
8. **Bulk operations** (CSV import for students/teachers via `BulkImportDialog`;
   bulk status archive/activate via floating action bar) are genuinely useful
   admin features.
9. **Tenant lifecycle & governance** primitives exist:
   `deactivateTenant`/`reactivateTenant`, `exportTenantData`, quota usage
   (`TenantUsage`/`TenantSubscription`), AI cost summaries, dead-letter
   visibility.

---

## 4. Pain Points / Tech Debt / Inconsistencies

1. **Mixed data-access patterns.** Most pages use shared hooks, but several
   pages bypass the hook layer with inline `getFirebaseServices()` +
   `collection(db, ...)` reads: `SettingsPage.tsx` (`evaluationSettings`),
   `StaffPage.tsx` (`teachers` + `userMemberships`), `AIUsagePage.tsx`
   (`gradingDeadLetter`), `AppLayout.tsx` (tenants name lookup). This duplicates
   query logic, scatters query keys, and is not portable to a non-Firebase / RN
   client.
2. **Direct client Firestore reads break the "common API layer" goal.** Reads
   still couple the web app to the Firebase Web SDK and to Firestore document
   shapes. A RN app or a future REST/GraphQL gateway would have to re-implement
   each of these queries. Reads should move behind the same callable/service
   boundary as writes (or a typed data-service layer).
3. **Spaces vs Courses duplication.** Both `/spaces` (`SpacesOverviewPage.tsx`)
   and `/courses` (`CoursesPage.tsx`) are read-only overviews over the same
   `spaces` collection (audit P4.7). Confusing navigation; one concept, two
   pages.
4. **Local table plumbing duplicated per page.** `usePagination`/`useSort` +
   manual `filteredX` arrays + selection `Set` state are re-implemented in
   `UsersPage`, `ClassesPage`, etc. No shared DataTable abstraction owns
   filtering/sorting/selection/pagination.
5. **Giant page components.** `SettingsPage.tsx` (756 lines), `ClassesPage.tsx`
   (670), `OnboardingWizardPage.tsx` (422) mix data fetching, multiple dialogs,
   forms, and tables in one file. Hard to test and reuse.
6. **Inconsistent form handling.** `react-hook-form` + `@hookform/resolvers` +
   `zod` are dependencies, but `UsersPage`/`SettingsPage`/`OnboardingWizardPage`
   use ad-hoc `useState` form objects with manual validation instead of RHF +
   the existing Zod `callable-schemas`. Validation is duplicated client/server
   with drift risk.
7. **Coarse cache invalidation.** Many mutations call
   `queryClient.invalidateQueries({ queryKey: ["tenants", tenantId] })` (e.g.
   `UsersPage.handleCreate`), invalidating everything under a tenant rather than
   the specific entity collection. Wasteful refetches.
8. **Permissions are defined but partly unenforced in UI.**
   `TeacherPermissions`/`StaffPermissions` exist and `StaffPage` edits them, but
   the admin UI itself exposes all features to any `tenantAdmin`;
   `StaffPermissions` (canManageUsers, canManageBilling, etc.) is not used to
   gate admin-web nav/pages.
9. **Schema drift / deprecations carried forward.** `Tenant.logoUrl`/`bannerUrl`
   deprecated in favor of `branding.*`; `Teacher.uid` deprecated for `authUid`.
   Both still present; pages must defensively read both.
10. **Missing blueprint/requirement features.** No `/billing` subscription
    management UI (despite rich `TenantSubscription`), no scanner-device
    registration UI (despite `scannerAppEnabled` feature flag and `scanner`
    role), feature-flag toggles in Settings are limited, no analytics date-range
    filter / CSV export, no archived-class restore view.
11. **No unit tests** (`"test": "echo 'No unit tests for admin-web'"`). Only e2e
    under `e2e/`.
12. **Login security gaps** (audit A2): unauthenticated school-code enumeration
    via `lookupTenantByCode`, no rate limiting / debounce, no "forgot password".
13. **`StaffPage` reads the global `userMemberships` collection client-side**
    and filters by tenant in memory — both a perf and a rules-surface concern;
    should be a callable.

---

## 5. Recommendations for a Fresh Rebuild

Keep the core concepts (tenant-scoped admin, role/permission model,
callable-backed writes, multi-tenant switching, onboarding wizard, bulk ops,
governance/quota). Improve the architecture so a single API layer serves web +
React Native.

### A. Establish one platform API layer (web + RN portable)

1. **Move ALL reads behind the service layer**, mirroring writes. Replace every
   inline `collection(db, ...)` in `SettingsPage`, `StaffPage`, `AIUsagePage`,
   `AppLayout` with a typed data-service function (callable or a documented
   Firestore-query module in `shared-services`). The web app and RN app should
   import the same `useXxx` hooks and never touch the Firebase SDK directly.
2. **Promote the callable contracts to a versioned API package.**
   `shared-types/callable-types.ts` + Zod `callable-schemas.ts` already define
   the contract — formalize it as the API spec, validate on both ends, and
   generate typed clients. This is the seam a future REST/GraphQL gateway plugs
   into without changing app code.
3. **Make `@levelup/shared-hooks` and `@levelup/shared-services`
   platform-agnostic** (no DOM/web-only deps) so React Native reuses them
   verbatim; keep only presentation in `@levelup/shared-ui` (web) with an
   RN-parallel UI package.

### B. Consolidate UI/data plumbing

4. **Introduce a shared `DataTable` primitive** owning
   search/filter/sort/selection/pagination, and refactor `UsersPage`,
   `ClassesPage`, `StaffPage`, overview pages onto it. Removes the duplicated
   `usePagination`/`useSort`/`Set` boilerplate.
5. **Merge `/spaces` and `/courses`** into one "Content / Spaces" overview; drop
   the duplicate route.
6. **Split large pages** into route + feature-folder structure (e.g.
   `features/users/{UsersPage, useUsersTable, CreateUserDialog, ...}`) so
   dialogs/forms are independently testable.

### C. Forms & validation

7. **Standardize on react-hook-form + zodResolver, reusing the existing Zod
   `callable-schemas`** for client-side validation so client and server validate
   against one schema (no drift). Replace ad-hoc `useState` forms in
   Users/Settings/Onboarding.

### D. Caching correctness

8. **Adopt granular, hierarchical query keys** (`["tenant", id, "students"]`,
   `["tenant", id, "classes"]`) and invalidate the narrowest scope after each
   mutation; centralize key factories in `shared-hooks`.

### E. Permissions & governance

9. **Enforce `StaffPermissions` and `TenantFeatures` in the admin shell**: drive
   nav-group visibility and route guards off
   `currentMembership.staffPermissions` and `tenant.features`, so `staff` users
   and feature-gated tenants see only what they can use. Centralize a
   `useCan(permission)` hook.
10. **Build the missing governance UIs**: `/billing` (subscription/plan/quota
    management over `TenantSubscription`), scanner-device registration (over
    `scannerAppEnabled` + `scanner` role), Settings feature-flag toggles, AI
    budget caps/alerts, analytics date-range + CSV export, archived-class
    restore.

### F. Schema hygiene

11. **Retire deprecated fields** (`Tenant.logoUrl/bannerUrl` → `branding`,
    `Teacher.uid` → `authUid`) via a migration so clients stop dual-reading.
12. **Move `userMemberships` queries server-side** (a `listTenantStaff`
    callable) instead of reading the global collection from the client.

### G. Security & quality

13. **Harden login**: server-side rate limiting / CAPTCHA on
    `lookupTenantByCode`, debounce, add password-reset flow.
14. **Add a unit-test suite** for hooks, services, guards, and form validation;
    keep e2e for journeys.

---

## Appendix — Key File Paths

- Routing: `apps/admin-web/src/App.tsx`
- Shell/nav: `apps/admin-web/src/layouts/AppLayout.tsx`,
  `apps/admin-web/src/layouts/AuthLayout.tsx`
- Guard: `apps/admin-web/src/guards/RequireAuth.tsx`
- Pages: `apps/admin-web/src/pages/*.tsx`
- Feature components:
  `apps/admin-web/src/components/{users,staff,settings,sessions,dashboard,layout,skeletons}/`
- Callable API wrappers: `packages/shared-services/src/auth/auth-callables.ts`
- Backend callables: `functions/identity/src/callable/*.ts`
- Domain types: `packages/shared-types/src/identity/*.ts`,
  `packages/shared-types/src/tenant/*.ts`,
  `packages/shared-types/src/callable-types.ts`,
  `packages/shared-types/src/schemas/callable-schemas.ts`
- Access model: `firestore.rules`, `firestore.indexes.json`
- Auth store: `packages/shared-stores/src/auth-store.ts`
- Prior audit: `docs/ADMIN-WEB-AUDIT-REPORT.md`; Requirements:
  `requirements/admin-web/requirements.md`
