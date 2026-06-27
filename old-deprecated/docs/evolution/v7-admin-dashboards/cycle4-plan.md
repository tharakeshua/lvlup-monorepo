# V7 Admin Dashboards — Cycle 4 Plan

## Current State: ~85% (post Cycle 3)

### Completed in Previous Cycles

- Super-admin: 10 pages — Dashboard, Tenants, TenantDetail, SystemHealth,
  LLMUsage, UserAnalytics, FeatureFlags, GlobalPresets, Settings, Login
- Admin-web: 15 pages — Dashboard, Classes, Users, AcademicSessions, Staff,
  Courses, SpacesOverview, ExamsOverview, Analytics, Reports, Settings, AIUsage,
  Notifications, OnboardingWizard, Login
- Tenant CRUD with create/edit/deactivate/reactivate/export
- TenantDetailPage decomposed into 5 sub-components
- N+1 query fix on LLMUsagePage (Promise.all parallelization)
- Sortable table headers, breadcrumb navigation, mobile bottom nav
- Bulk student import from CSV with validation and credential export
- Pagination (configurable 10/25/50/100), sorting, search/filter on all list
  pages
- Loading skeletons, empty states, error handling with toast notifications
- Staff permissions (8 granular toggles per teacher)
- Academic session CRUD with "set current" management
- Zod form validation, confirmation dialogs for destructive ops

### Identified Gaps

#### Super-Admin

1. **Dashboard metrics are static counts only** — No growth trends, no
   time-series comparisons (week-over-week, month-over-month), no engagement
   metrics (active users), no real-time activity feed. Dashboard gives a
   snapshot but not actionable intelligence.

2. **No global user search** — Super-admin cannot search for a user across all
   tenants. Support scenarios (e.g., "find user X who reported a bug") require
   manually browsing each tenant. No user impersonation capability for
   debugging.

3. **System health has placeholder metrics** — Error Rate shows "N/A — No
   logging system yet". No historical health data or uptime tracking. No
   alerting or notification when services degrade. Health checks are
   point-in-time only.

4. **No tenant activity audit trail** — No log of admin actions (who changed
   what, when) on a tenant. Important for compliance and support debugging.

5. **No announcement management system** — Platform announcement is a single
   text field in Settings. No CRUD, no targeting (specific tenants, roles), no
   scheduling, no history, no read tracking.

#### Admin-Web (School Admin)

6. **No bulk teacher import** — Students have CSV bulk import; teachers do not.
   Schools onboarding 20+ teachers must create them one by one.

7. **No bulk status operations** — Cannot archive/activate multiple students or
   teachers at once. End-of-year operations (archiving graduating students) are
   tedious one-by-one.

8. **No session rollover tooling** — When a new academic session starts, admins
   must manually recreate classes and reassign students/teachers. No "copy
   structure from previous session" capability.

9. **School-level announcements missing** — School admin has no way to send
   announcements to teachers, students, or parents. Only super-admin has a
   single platform-wide announcement text.

10. **Class detail view missing** — Clicking a class in ClassesPage only shows
    edit/archive/assign options. No class detail page showing roster,
    performance summary, linked exams/spaces.

---

## Cycle 4 Tasks

### Phase 1: Super-Admin Intelligence (Dashboard & Health)

#### T1: Dashboard Growth Metrics & Activity Feed [M]

**Files**:

- `apps/super-admin/src/pages/DashboardPage.tsx` — Add growth metrics section,
  activity feed
- `functions/analytics/src/callable/get-summary.ts` — Add `scope: 'platform'`
  with growth stats
- `packages/shared-types/src/callable-types.ts` — Add `PlatformSummaryResponse`
  type
- `packages/shared-services/src/reports/index.ts` — Add `callGetPlatformSummary`
  wrapper

**What**: Extend the DashboardPage with:

- **Growth cards**: New tenants this month, new users this week, growth % vs
  previous period (computed from `tenant.createdAt` and
  `UserMembership.joinedAt` timestamps)
- **Engagement metric**: Active users in last 7 days (users with `lastLoginAt`
  within 7 days, sourced from `UnifiedUser.lastLoginAt`)
- **Activity feed**: Last 10 admin actions from a new `platformActivityLog`
  collection showing recent tenant creations, deactivations, user operations
  (written by existing callable functions)

Backend `getSummary` with `scope: 'platform'` aggregates growth stats from
Firestore. Activity feed reads from `platformActivityLog` (top-level collection,
ordered by timestamp desc, limit 10).

**Acceptance**:

- Dashboard shows growth cards with this-month vs last-month comparison
- Active users (7d) metric displays with count
- Activity feed shows last 10 platform events with timestamp, actor, action
- All cards have loading skeletons and empty states
- `pnpm build` passes

#### T2: Platform Activity Logging [S]

**Files**:

- `functions/identity/src/callable/save-tenant.ts` — Write activity log on
  create/update
- `functions/identity/src/callable/deactivate-tenant.ts` — Write activity log on
  deactivation
- `functions/identity/src/callable/reactivate-tenant.ts` — Write activity log on
  reactivation
- `functions/identity/src/callable/create-org-user.ts` — Write activity log on
  user creation
- `functions/identity/src/callable/bulk-import-students.ts` — Write activity log
  on bulk import
- `packages/shared-types/src/analytics/activity-log.ts` (new) —
  `PlatformActivityLog` type

**What**: Add a `writePlatformActivity(action, actorUid, metadata)` helper that
writes to `/platformActivityLog/{autoId}`. Integrate into tenant and user
management callables. Each log entry:
`{ action, actorUid, actorEmail, tenantId?, metadata, createdAt }`. Actions:
`tenant_created`, `tenant_deactivated`, `tenant_reactivated`, `user_created`,
`users_bulk_imported`, `tenant_updated`.

**Acceptance**:

- Activity log entries written on tenant create/update/deactivate/reactivate
- Activity log entries written on user create and bulk import
- Log entries include actor info and relevant metadata
- New `PlatformActivityLog` type defined in shared-types

#### T3: System Health — Historical Metrics & Error Rate [M]

**Files**:

- `apps/super-admin/src/pages/SystemHealthPage.tsx` — Add uptime chart, error
  rate from logs
- `functions/analytics/src/callable/get-summary.ts` — Add `scope: 'health'`
  handler
- `packages/shared-types/src/analytics/health.ts` (new) — `HealthSnapshot`,
  `HealthHistoryResponse` types

**What**: Extend SystemHealthPage with:

- **Uptime history**: Store health check results in
  `/platformHealthSnapshots/{date}` collection (written by a scheduled function
  or on-demand). Display 30-day uptime bar chart (green/amber/red per day).
- **Error rate**: Count `gradingDeadLetter` entries and failed function
  invocations logged in `llmCallLogs` where `status === 'error'` over the last
  24 hours. Replace the "N/A" placeholder with an actual computed error rate.
- **Health check history**: On each manual health check, write the results to
  the snapshot collection so trends build over time.

Backend: `getSummary({ scope: 'health' })` returns last 30 snapshots + 24h error
count. Frontend renders a day-by-day status bar and error rate card.

**Acceptance**:

- Error Rate card shows real value instead of "N/A"
- Uptime history shows 30-day status bar (green = all healthy, amber = degraded,
  red = down)
- Health check results persisted for historical tracking
- Loading and empty states handled

### Phase 2: Global User Management & Audit

#### T4: Global User Search Page [M]

**Files**:

- `apps/super-admin/src/pages/GlobalUsersPage.tsx` (new)
- `apps/super-admin/src/App.tsx` — Add route `/users`
- `apps/super-admin/src/layouts/AppLayout.tsx` — Add sidebar nav item under
  "Platform"
- `functions/identity/src/callable/search-users.ts` (new) — Cross-tenant user
  search callable
- `packages/shared-types/src/callable-types.ts` — Add
  `SearchUsersRequest/Response`
- `packages/shared-services/src/auth/identity-callables.ts` — Add
  `callSearchUsers`

**What**: New super-admin page for searching users across all tenants. Search by
email, display name, or UID. Results show: display name, email, role(s),
tenant(s), last login, account status. Click user row to navigate to their
tenant's detail page. Backend callable queries `/users` collection with
Firestore text matching (prefix match on email and displayName).

**Acceptance**:

- Super-admin can search users by email or name across all tenants
- Results display user info with tenant associations
- Clicking a result navigates to relevant tenant detail
- Search is debounced (300ms) with loading state
- Empty state when no results match
- `pnpm build` passes

#### T5: Tenant Audit Log Tab [S]

**Files**:

- `apps/super-admin/src/components/tenant-detail/TenantAuditLogCard.tsx` (new)
- `apps/super-admin/src/pages/TenantDetailPage.tsx` — Add audit log card

**What**: New card on TenantDetailPage showing filtered activity log for that
specific tenant. Reads from `platformActivityLog` (from T2) filtered by
`tenantId`. Shows timeline of actions: who did what, when. Paginated with 20
entries per page. Filters: action type, date range.

**Acceptance**:

- Tenant detail page shows chronological audit log for that tenant
- Entries show actor, action, timestamp, and metadata
- Pagination and action type filter work
- Empty state when no audit entries exist

### Phase 3: Announcement Management System

#### T6: Announcement Data Model & Backend [M]

**Files**:

- `packages/shared-types/src/notification/announcement.ts` (new) —
  `Announcement` type
- `packages/shared-types/src/schemas/announcement.schema.ts` (new) — Zod schema
- `packages/shared-types/src/callable-types.ts` — Add
  `SaveAnnouncementRequest/Response`, `ListAnnouncementsRequest/Response`
- `functions/identity/src/callable/save-announcement.ts` (new) —
  Create/update/delete callable
- `functions/identity/src/callable/list-announcements.ts` (new) — List with
  filtering callable
- `packages/shared-services/src/auth/identity-callables.ts` — Add
  `callSaveAnnouncement`, `callListAnnouncements`

**What**: Announcement type with fields:
`{ id, tenantId?, title, body, authorUid, authorName, scope: 'platform' | 'tenant', targetRoles?: Role[], targetClassIds?: ClassId[], status: 'draft' | 'published' | 'archived', publishedAt?, expiresAt?, readBy: UserId[], createdAt, updatedAt }`.

Storage: Platform-wide announcements at `/announcements/{id}` (scope=platform,
superAdmin only). Tenant announcements at
`/tenants/{tenantId}/announcements/{id}` (scope=tenant, tenantAdmin).

`saveAnnouncement`: SuperAdmin can create platform announcements. TenantAdmin
can create tenant-scoped announcements with optional role/class targeting.
`listAnnouncements`: Returns paginated announcements filtered by scope, status,
date. For students/teachers, returns only published announcements matching their
role/class.

**Acceptance**:

- Announcement type and Zod schema defined with compile-time compatibility
  checks
- Platform announcements writable by superAdmin, tenant announcements by
  tenantAdmin
- List endpoint filters by scope, status, and respects role/class targeting
- Draft/published/archived lifecycle supported
- `pnpm build` passes

#### T7: Super-Admin Announcements Page [S]

**Files**:

- `apps/super-admin/src/pages/AnnouncementsPage.tsx` (new)
- `apps/super-admin/src/App.tsx` — Add route `/announcements`
- `apps/super-admin/src/layouts/AppLayout.tsx` — Add sidebar nav item under
  "Platform"

**What**: CRUD page for platform-wide announcements. List view with status tabs
(All, Draft, Published, Archived). Create/edit dialog: title, body (textarea),
target tenants (optional multi-select), expiry date (optional). Publish/archive
actions. Replace the single announcement text in SettingsPage with a link to
this new page.

**Acceptance**:

- Super-admin can create, edit, publish, archive platform announcements
- Status tabs filter the announcement list
- Create/edit form validates required fields (title, body)
- Published announcements show publish date, archived show archive date
- Pagination for announcement list

#### T8: Admin-Web Announcements Page [S]

**Files**:

- `apps/admin-web/src/pages/AnnouncementsPage.tsx` (new)
- `apps/admin-web/src/App.tsx` — Add route `/announcements`
- `apps/admin-web/src/layouts/AppLayout.tsx` — Add sidebar nav item

**What**: School-admin view for managing tenant-scoped announcements. Same CRUD
pattern as T7 but scoped to current tenant. Additional targeting options: target
roles (teacher, student, parent) and target classes (multi-select from tenant's
classes). Also displays platform-wide announcements from super-admin in a
read-only "Platform Notices" section at the top.

**Acceptance**:

- School admin can create/edit/publish/archive tenant announcements
- Can target by role and/or class
- Platform-wide announcements shown as read-only notices
- Pagination and status filtering work

### Phase 4: Admin-Web Bulk Operations & Session Rollover

#### T9: Bulk Teacher Import [S]

**Files**:

- `apps/admin-web/src/pages/UsersPage.tsx` — Add "Import Teachers" button to
  Teachers tab
- `apps/admin-web/src/components/users/BulkTeacherImportDialog.tsx` (new)
- `functions/identity/src/callable/bulk-import-teachers.ts` (new) — Bulk teacher
  import callable
- `packages/shared-types/src/callable-types.ts` — Add
  `BulkImportTeachersRequest/Response`
- `packages/shared-services/src/auth/identity-callables.ts` — Add
  `callBulkImportTeachers`

**What**: Mirror the existing `bulkImportStudents` pattern for teachers. CSV
format: firstName, lastName, email, subjects, designation. Same validation,
dry-run, credential export, and batch processing (50 at a time). Max 200
teachers per import. Reuse the CSV import dialog pattern from the student
import.

**Acceptance**:

- School admin can import teachers from CSV
- Dry-run validates before committing
- Credential CSV generated with temporary passwords
- Error report shows row-level issues
- Import respects subscription quota for teachers

#### T10: Bulk Status Operations (Archive/Activate) [S]

**Files**:

- `apps/admin-web/src/pages/UsersPage.tsx` — Add checkbox selection + bulk
  action bar
- `apps/admin-web/src/pages/ClassesPage.tsx` — Add checkbox selection + bulk
  action bar
- `functions/identity/src/callable/bulk-update-status.ts` (new) — Bulk status
  update callable
- `packages/shared-types/src/callable-types.ts` — Add
  `BulkUpdateStatusRequest/Response`
- `packages/shared-services/src/auth/identity-callables.ts` — Add
  `callBulkUpdateStatus`

**What**: Add checkbox selection to student, teacher, and class tables. When
items selected, show a floating action bar with "Archive Selected" and "Activate
Selected" buttons. Backend callable accepts
`{ entityType: 'student' | 'teacher' | 'class', entityIds: string[], newStatus: 'active' | 'archived' }`
and processes in batches of 50 with Firestore batch writes. Confirmation dialog
with count before executing.

**Acceptance**:

- Checkboxes on student, teacher, and class tables with "select all on page"
- Floating action bar appears when items selected showing count and actions
- Confirmation dialog: "Archive 15 students?"
- Backend processes batch status updates atomically
- Success toast with count of updated entities
- Tables refresh after operation

#### T11: Academic Session Rollover [M]

**Files**:

- `apps/admin-web/src/pages/AcademicSessionPage.tsx` — Add "Rollover" button on
  sessions
- `apps/admin-web/src/components/sessions/SessionRolloverDialog.tsx` (new)
- `functions/identity/src/callable/rollover-session.ts` (new) — Session rollover
  callable
- `packages/shared-types/src/callable-types.ts` — Add
  `RolloverSessionRequest/Response`
- `packages/shared-services/src/auth/identity-callables.ts` — Add
  `callRolloverSession`

**What**: "Rollover to New Session" action on academic sessions. Opens dialog
with options:

- New session name, start date, end date
- Checkboxes: "Copy classes" (creates same class structure), "Copy teacher
  assignments" (assigns same teachers to new classes), "Promote students"
  (optional: advance grade by 1, reassign to matching classes in new session)
- Preview summary before execution

Backend: Creates new academic session, optionally duplicates class structure
with same grade/section names, copies teacher assignments, and optionally
promotes students (increment grade, reassign to matching classes). Sets new
session as current.

**Acceptance**:

- Rollover dialog shows source session info and configuration options
- Preview summary shows what will be created (N classes, M teacher assignments,
  K student promotions)
- Backend creates new session with duplicated structure
- Student grade promotion works correctly (Grade 5 → Grade 6)
- Students not matching any class in new session are listed as "unassigned"
- New session set as current after rollover
- Original session unchanged

### Phase 5: Class Detail & Polish

#### T12: Class Detail Page for Admin-Web [S]

**Files**:

- `apps/admin-web/src/pages/ClassDetailPage.tsx` (new)
- `apps/admin-web/src/App.tsx` — Add route `/classes/:classId`
- `apps/admin-web/src/pages/ClassesPage.tsx` — Make class names clickable links

**What**: Dedicated class detail page showing:

- **Header**: Class name, grade, section, status badge, academic session
- **Roster tabs**: Students tab (list with roll numbers), Teachers tab (list
  with subjects)
- **Quick stats**: Student count, teacher count, exams in this class, spaces
  assigned
- **Recent activity**: Last 5 exams and spaces for this class (from Firestore
  queries filtered by classId)
- Back navigation via breadcrumb

**Acceptance**:

- Class names in ClassesPage are clickable links to detail page
- Detail page shows student roster and teacher roster in tabs
- Quick stats show correct counts
- Recent exams and spaces listed (or empty state)
- Breadcrumb: Dashboard > Classes > Class Name

---

## Implementation Order

| Order | Task                                   | Size | Priority | Deps |
| ----- | -------------------------------------- | ---- | -------- | ---- |
| 1     | T2: Platform activity logging          | S    | HIGH     | —    |
| 2     | T1: Dashboard growth metrics & feed    | M    | HIGH     | T2   |
| 3     | T3: System health history & error rate | M    | HIGH     | —    |
| 4     | T4: Global user search                 | M    | MEDIUM   | —    |
| 5     | T5: Tenant audit log tab               | S    | MEDIUM   | T2   |
| 6     | T6: Announcement data model & backend  | M    | MEDIUM   | —    |
| 7     | T7: Super-admin announcements page     | S    | MEDIUM   | T6   |
| 8     | T8: Admin-web announcements page       | S    | MEDIUM   | T6   |
| 9     | T9: Bulk teacher import                | S    | MEDIUM   | —    |
| 10    | T10: Bulk status operations            | S    | MEDIUM   | —    |
| 11    | T11: Academic session rollover         | M    | MEDIUM   | —    |
| 12    | T12: Class detail page                 | S    | LOW      | —    |

**Parallel tracks**:

- T2 runs first (logging foundation), then T1 and T5 can use it
- T3 is independent, can run parallel with T2
- T4 is independent, can run parallel with T1/T3
- T6 runs before T7+T8 (backend before frontend)
- T9, T10, T11, T12 are all independent and can run in parallel

## Target Completion: ~96%

After Cycle 4, remaining items for 100%:

- Billing integration (Stripe/payment gateway for subscription management)
- Real-time WebSocket dashboard updates (live user count, live health)
- Advanced RBAC (custom role definitions beyond the fixed role set)
- Tenant comparison analytics (compare metrics across tenants)
- White-label tenant portals (full branding customization with custom domains)
- Data retention policies and automated archival
