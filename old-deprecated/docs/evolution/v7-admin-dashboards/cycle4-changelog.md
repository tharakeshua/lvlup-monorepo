# Cycle 4 Changelog — Admin Dashboard Improvements

**Date**: 2026-03-08 **Vertical**: V7 (Admin Dashboards) + V8 (Multi-Tenancy &
Business Logic) **Completion**: ~96% (up from ~85%)

---

## Phase 1: Super-Admin Intelligence

### T1 — Dashboard Growth Metrics

- Rewrote `apps/super-admin/src/pages/DashboardPage.tsx` with real growth
  metrics
- Added `GrowthIndicator` component showing trending arrows with percentage
  change
- Cards: new tenants this/last month, new users this/last week, active users
  (7d), engagement rate
- Activity feed from `platformActivityLog` collection with human-readable labels
- Uses `getSummary({ scope: 'platform' })` callable for live data

### T2 — Platform Activity Logging

- Created `PlatformActivityLog` type and `PlatformActivityAction` union in
  `packages/shared-types/src/analytics/activity-log.ts`
- Created `writePlatformActivity` helper in
  `functions/identity/src/utils/platform-activity.ts`
  - Resolves actor email from Firebase Auth
  - Writes to `/platformActivityLog/{autoId}` collection
  - Wrapped in try/catch to never block the main operation
- Integrated into 5 callables: `save-tenant`, `deactivate-tenant`,
  `reactivate-tenant`, `create-org-user`, `bulk-import-students`
- Exported from `packages/shared-types/src/analytics/index.ts`

### T3 — System Health Enhancements

- Created `HealthSnapshot` and `HealthHistoryResponse` types in
  `packages/shared-types/src/analytics/health.ts`
- Extended `GetSummaryRequestSchema` with `'platform' | 'health'` scopes, made
  `tenantId` optional
- Extended `GetSummaryRequest/Response` interfaces with
  `PlatformSummaryResponse` and `HealthSummaryResponse`
- Added `handlePlatformSummary` and `handleHealthSummary` handlers to
  `functions/analytics/src/callable/get-summary.ts`
  - Platform: counts tenants this/last month, users this/last week, active users
    7d, recent activity
  - Health: reads last 30 `platformHealthSnapshots`, counts errors from
    `gradingDeadLetter` + `llmCallLogs`
- Updated `SystemHealthPage.tsx` with real 30-day uptime history and error rates
- Synced `.local-deps/shared-types` across all function packages for type
  consistency

## Phase 2: Global User Management

### T4 — Global User Search

- Created `SearchUsersRequest/Response` types in `callable-types.ts`
- Created `functions/identity/src/callable/search-users.ts` — cross-tenant user
  search (superAdmin only)
  - Searches by email prefix using Firestore `>=` / `<` range query
  - Joins user memberships to show tenant associations
- Created `apps/super-admin/src/pages/GlobalUsersPage.tsx` with search input,
  results table, membership badges
- Added route `/users` and nav item in super-admin `App.tsx` and `AppLayout.tsx`
- Added `callSearchUsers` callable wrapper in shared-services

### T5 — Tenant Audit Log

- Created `apps/super-admin/src/components/tenant-detail/TenantAuditLogCard.tsx`
  - Queries `platformActivityLog` filtered by `tenantId`
  - Action filter dropdown with human-readable labels
  - Timeline UI with dot indicators and timestamps
  - PAGE_SIZE=20 with "has more" indicator
- Added to `TenantDetailPage.tsx` between lifecycle/export cards and dialogs

## Phase 3: Announcement Management

### T6 — Announcement Backend

- Created `Announcement` type in
  `packages/shared-types/src/notification/announcement.ts`
- Created Zod schemas in
  `packages/shared-types/src/schemas/announcement.schema.ts`
- Created `functions/identity/src/callable/save-announcement.ts` — CRUD with
  soft-delete
- Created `functions/identity/src/callable/list-announcements.ts` — paginated
  list with scope/status filters
- Both callables enforce superAdmin access for platform-scope announcements

### T7 — Super-Admin Announcements Page

- Created `apps/super-admin/src/pages/AnnouncementsPage.tsx`
  - Full CRUD: create, edit, publish, archive, delete announcements
  - Status filter tabs (All/Draft/Published/Archived)
  - Inline create/edit dialog with title, body, expiry date fields
  - Status badges and action buttons per announcement
- Added route `/announcements` and nav item (Megaphone icon)

### T8 — Admin-Web Announcements Page

- Created `apps/admin-web/src/pages/AnnouncementsPage.tsx`
  - Tenant-scoped announcement management
  - Role targeting (select which roles see the announcement)
  - Class targeting (select specific classes)
  - Publish/archive workflow
- Added route `/announcements` and nav item in admin-web

## Phase 4: Bulk Operations

### T9 — Bulk Teacher Import

- Created `TeacherImportRow`, `BulkImportTeachersRequest/Response` types
- Created `functions/identity/src/callable/bulk-import-teachers.ts`
  - Mirrors `bulk-import-students.ts` pattern (batch size 50)
  - Creates Firebase Auth users, teacher documents, and memberships
  - Generates temporary credentials CSV
  - Supports dry-run validation mode
- Created `BulkImportTeachersRequestSchema` in callable-schemas (if not
  pre-existing)
- Added `callBulkImportTeachers` wrapper in shared-services
- Integrated BulkImportTeacherDialog into admin-web `UsersPage.tsx`

### T10 — Bulk Status Operations

- Created `BulkUpdateStatusRequest/Response` types
- Created `functions/identity/src/callable/bulk-update-status.ts`
  - Supports student, teacher, and class entity types
  - Batch updates status field across selected entities
- Added checkbox selection to `StudentsTab`, `TeachersTab`, `ClassesPage`
- Added floating action bar with Archive/Activate buttons when items selected
- Added `callBulkUpdateStatus` wrapper in shared-services

### T11 — Session Rollover

- Created `RolloverSessionRequest/Response` types
- Created `functions/identity/src/callable/rollover-session.ts`
  - Creates new academic session
  - Optionally copies classes with teacher assignments
  - Optionally promotes students (increments grade, moves to new session
    classes)
- Created `apps/admin-web/src/components/sessions/SessionRolloverDialog.tsx`
  - Configuration dialog with checkboxes for copy classes, assignments, promote
    students
  - New session name, start/end date inputs
- Integrated into `AcademicSessionPage.tsx` with rollover button
- Added `callRolloverSession` wrapper in shared-services

## Phase 5: Class Detail

### T12 — Class Detail Page

- Created `apps/admin-web/src/pages/ClassDetailPage.tsx`
  - Class header with name, grade, section, status badge
  - Roster tabs: Students, Teachers with counts
  - Student/teacher lists with basic info
  - Recent activity section
- Added route `/classes/:classId` in admin-web `App.tsx`
- Made class names clickable links in `ClassesPage.tsx`

---

## Build & Export Fixes

- Fixed missing `callSaveAnnouncement` and `callListAnnouncements` exports in
  `packages/shared-services/src/auth/index.ts`
- Synced `shared-types` dist to `.local-deps/` across all function packages
  (analytics, identity, levelup) and ran `pnpm install` to refresh pnpm store
  cache
- All builds pass: `shared-types`, `shared-services`, `functions-analytics`,
  `functions-identity`, `super-admin`, `admin-web`
- Pre-existing `functions-levelup` errors (missing `@levelup/functions-shared`
  module) are unrelated to this cycle

## Files Modified/Created

### New Files (18)

- `packages/shared-types/src/analytics/activity-log.ts`
- `packages/shared-types/src/analytics/health.ts`
- `packages/shared-types/src/notification/announcement.ts`
- `packages/shared-types/src/schemas/announcement.schema.ts`
- `functions/identity/src/utils/platform-activity.ts`
- `functions/identity/src/callable/save-announcement.ts`
- `functions/identity/src/callable/list-announcements.ts`
- `functions/identity/src/callable/search-users.ts`
- `functions/identity/src/callable/bulk-import-teachers.ts`
- `functions/identity/src/callable/bulk-update-status.ts`
- `functions/identity/src/callable/rollover-session.ts`
- `apps/super-admin/src/pages/GlobalUsersPage.tsx`
- `apps/super-admin/src/pages/AnnouncementsPage.tsx`
- `apps/super-admin/src/components/tenant-detail/TenantAuditLogCard.tsx`
- `apps/admin-web/src/pages/AnnouncementsPage.tsx`
- `apps/admin-web/src/pages/ClassDetailPage.tsx`
- `apps/admin-web/src/components/sessions/SessionRolloverDialog.tsx`

### Modified Files (19)

- `packages/shared-types/src/analytics/index.ts`
- `packages/shared-types/src/notification/index.ts`
- `packages/shared-types/src/schemas/index.ts`
- `packages/shared-types/src/schemas/callable-schemas.ts`
- `packages/shared-types/src/callable-types.ts`
- `packages/shared-services/src/auth/auth-callables.ts`
- `packages/shared-services/src/auth/index.ts`
- `packages/shared-services/src/reports/pdf-callables.ts`
- `packages/shared-services/src/reports/index.ts`
- `functions/identity/src/utils/index.ts`
- `functions/identity/src/index.ts`
- `functions/identity/src/callable/save-tenant.ts`
- `functions/identity/src/callable/deactivate-tenant.ts`
- `functions/identity/src/callable/reactivate-tenant.ts`
- `functions/identity/src/callable/create-org-user.ts`
- `functions/identity/src/callable/bulk-import-students.ts`
- `functions/analytics/src/callable/get-summary.ts`
- `apps/super-admin/src/pages/DashboardPage.tsx`
- `apps/super-admin/src/pages/SystemHealthPage.tsx`
- `apps/super-admin/src/pages/TenantDetailPage.tsx`
- `apps/super-admin/src/App.tsx`
- `apps/super-admin/src/layouts/AppLayout.tsx`
- `apps/admin-web/src/App.tsx`
- `apps/admin-web/src/layouts/AppLayout.tsx`
- `apps/admin-web/src/pages/UsersPage.tsx`
- `apps/admin-web/src/pages/ClassesPage.tsx`
- `apps/admin-web/src/pages/AcademicSessionPage.tsx`
