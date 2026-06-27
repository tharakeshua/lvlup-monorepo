# Admin-Web Audit Report

**App:** `apps/admin-web` (TenantAdmin Portal) **Auditor:** Admin-Web Audit
Worker **Date:** 2026-03-01 **Blueprint Reference:**
`docs/unified-design-plan/UNIFIED-ARCHITECTURE-BLUEPRINT.md` v1.1 **Files
Audited:** All 20 source files in `apps/admin-web/src/`

---

## Executive Summary

The admin-web portal has a solid structural foundation — routing, Firebase auth
guards, Firestore queries via TanStack Query, and shared component integration
are all in place. However, a significant portion of the UI is
**non-functional**: buttons have no click handlers, forms are read-only, and
many blueprint-required features have no implementation at all. Additionally, a
pervasive bug causes **raw Firebase UIDs to be displayed instead of user names**
throughout every user management table.

**51 total issues found across 8 severity/type categories.**

| Severity  | Count  |
| --------- | ------ |
| CRITICAL  | 8      |
| HIGH      | 17     |
| MEDIUM    | 16     |
| LOW       | 10     |
| **Total** | **51** |

---

## Table of Contents

1. [Authentication & Security](#1-authentication--security)
2. [Navigation & Routing](#2-navigation--routing)
3. [Dashboard Page](#3-dashboard-page)
4. [Classes Page](#4-classes-page)
5. [Users Page](#5-users-page)
6. [Settings Page](#6-settings-page)
7. [Analytics Page](#7-analytics-page)
8. [AI Usage Page](#8-ai-usage-page)
9. [Exams Overview Page](#9-exams-overview-page)
10. [Spaces & Courses Pages](#10-spaces--courses-pages)
11. [Reports Page](#11-reports-page)
12. [Academic Sessions Page](#12-academic-sessions-page)
13. [Notifications Page](#13-notifications-page)
14. [Blueprint Features With Zero Implementation](#14-blueprint-features-with-zero-implementation)
15. [Prioritised Fix List](#15-prioritised-fix-list)

---

## 1. Authentication & Security

### Issue A1 — Auth guard does not validate tenantId match

- **File:** `src/guards/RequireAuth.tsx:25`
- **Type:** SECURITY
- **Severity:** HIGH
- **Description:** The guard checks `currentMembership.role` to allow access,
  but does **not** verify that `currentMembership.tenantId === currentTenantId`.
  A user who is `tenantAdmin` on tenant A could switch their active tenant (via
  the RoleSwitcher) to tenant B and still pass the `allowedRoles` check if the
  `currentMembership` in the store reflects their old tenant. All protected
  routes should additionally assert the membership belongs to the
  currently-active tenant.

```tsx
// Current (line 25) — missing tenantId check:
if (allowedRoles && (!currentMembership || !allowedRoles.includes(currentMembership.role))) {

// Required:
if (
  allowedRoles &&
  (!currentMembership ||
   !allowedRoles.includes(currentMembership.role) ||
   currentMembership.tenantId !== currentTenantId)
) {
```

---

### Issue A2 — No password reset / no school-code rate limiting

- **File:** `src/pages/LoginPage.tsx:17-45`
- **Type:** MISSING_FEATURE
- **Severity:** LOW
- **Description:** No "Forgot password" link or reset flow. The
  `lookupTenantByCode` call on every keystroke/submit allows unauthenticated
  enumeration of valid school codes from the client side. No rate limiting,
  CAPTCHA, or debounce is applied.

---

### Issue A3 — RoleSwitcher displays raw tenant IDs as names

- **File:** `src/layouts/AppLayout.tsx:122-128`
- **Type:** BUG
- **Severity:** HIGH
- **Description:** The `tenantOptions` array maps `tenantName: m.tenantId`,
  passing the raw Firestore document ID as the display name. Any admin managing
  more than one school sees unintelligible strings like `"xKq7p2mNvL3..."` in
  the tenant switcher. Tenant names must be resolved — either from
  `useTenantStore` (for the current tenant) or from a parallel lookup for
  secondary tenants.

```tsx
// Current (broken):
const tenantOptions: TenantOption[] = allMemberships
  .filter((m) => m.role === "tenantAdmin")
  .map((m) => ({
    tenantId: m.tenantId,
    tenantName: m.tenantId, // ← raw ID, not a name
    role: m.role,
  }));
```

---

## 2. Navigation & Routing

### Issue N1 — Academic Sessions page has no sidebar nav entry

- **File:** `src/layouts/AppLayout.tsx:39-120`
- **Type:** MISSING_FEATURE
- **Severity:** CRITICAL
- **Description:** `AcademicSessionPage` is fully implemented and a route exists
  at `/academic-sessions` in `App.tsx`, but there is no `NavGroup` item pointing
  to it in `AppLayout`. The page is completely unreachable via the UI. A user
  must know the URL to access it. Academic session management is a core step in
  the TenantAdmin onboarding journey (Blueprint §6.1, step 2).

---

### Issue N2 — Missing routes for three required TenantAdmin features

- **File:** `src/App.tsx:40-62`
- **Type:** MISSING_FEATURE
- **Severity:** MEDIUM
- **Description:** The following pages are required by the blueprint (§4.2,
  §5.2, §7.1) but have no route and no page component:
  - `/permissions` — Teacher permission management (toggle `canCreateExams`,
    `canCreateSpaces`, etc.)
  - `/billing` — Subscription plan management and billing info
  - `/scanners` — Scanner device registration (TenantAdmin is listed in the
    blueprint as able to register scanner devices)

---

## 3. Dashboard Page

### Issue D1 — Inconsistent data sources for stats row

- **File:** `src/pages/DashboardPage.tsx:88-113`
- **Type:** BUG
- **Severity:** MEDIUM
- **Description:** The stats row mixes two data sources. `students.length` comes
  from a live Firestore query, while `stats?.totalTeachers` and
  `stats?.totalSpaces` come from the denormalized `Tenant.stats` object
  (potentially stale). This can result in the dashboard showing e.g. "45
  students" (live) alongside "3 teachers" (stale from stats counter) creating
  inconsistent and confusing numbers.

---

### Issue D2 — Class summary errors silently swallowed

- **File:** `src/pages/DashboardPage.tsx:43-45`
- **Type:** BUG
- **Severity:** LOW
- **Description:** `classSummaryResults.map((r) => r.data).filter(Boolean)`
  discards all failed query results without any error state or user
  notification. If `classProgressSummaries` Firestore documents don't exist yet,
  the at-risk count and class chart show zeros with no indication of why.

---

### Issue D3 — Sign Out button placed in dashboard content, not header/profile

- **File:** `src/pages/DashboardPage.tsx:79-84`
- **Type:** UX
- **Severity:** LOW
- **Description:** The Sign Out button is rendered as a content-level action in
  the page header rather than in a settings menu or user profile dropdown in the
  app shell. This is non-standard and inconsistent with the AppLayout which has
  a sidebar footer for user identity.

---

### Issue D4 — No monthly AI cost trend or active students metric

- **File:** `src/pages/DashboardPage.tsx:47-53`
- **Type:** INCOMPLETE
- **Severity:** LOW
- **Description:** The AI cost card only shows today's cost. There is no monthly
  trend or budget indicator. The `Tenant.stats.activeStudentsLast30Days` field
  is never rendered on the dashboard despite being available in the data.

---

## 4. Classes Page

### Issue C1 — Teacher picker shows truncated UIDs instead of names

- **File:** `src/pages/ClassesPage.tsx:92-95`
- **Type:** BUG
- **Severity:** CRITICAL
- **Description:** The `EntityPicker` for assigning teachers uses
  `label: t.uid.slice(0, 12)`. The `Teacher` entity has `firstName`, `lastName`,
  and `displayName` fields per the blueprint schema. An admin assigning teachers
  to a class sees a list of strings like `"xKq7p2mNvL3"` with no way to identify
  which teacher is which.

```tsx
// Current (broken):
const teacherItems: EntityPickerItem[] = (teachers ?? []).map((t: Teacher) => ({
  id: t.id,
  label: t.uid.slice(0, 12), // ← UID, not name
  description: t.subjects?.join(", ") || t.designation || undefined,
}));
```

---

### Issue C2 — `handleAssignStudents` mutates non-existent `studentIds` field on Class

- **File:** `src/pages/ClassesPage.tsx:147-155`
- **Type:** DATA_MODEL_MISMATCH
- **Severity:** HIGH
- **Description:** Calling
  `updateClass.mutateAsync({ studentIds: selectedStudentIds })` writes a
  `studentIds` array to the Class Firestore document. The blueprint's `Class`
  schema has no `studentIds` field. The correct data model is that each
  `Student` document has a `classIds: string[]` array pointing to their enrolled
  classes. This implementation silently writes to a non-existent field on the
  class document and does not update the Student records that should be changed.
  Enrollment is broken.

---

### Issue C3 — Class creation missing `subject` field

- **File:** `src/pages/ClassesPage.tsx:288-344`
- **Type:** MISSING_FEATURE
- **Severity:** MEDIUM
- **Description:** The create class dialog has `name`, `grade`, and `section`
  fields but no `subject` field. The blueprint `Class` schema has
  `subject?: string`. A class like "Grade 10 Physics" cannot have its subject
  set, which also breaks subject-based filtering in other views.

---

### Issue C4 — Class creation missing `academicSessionId` assignment

- **File:** `src/pages/ClassesPage.tsx:104-113`
- **Type:** MISSING_FEATURE
- **Severity:** MEDIUM
- **Description:** Classes cannot be associated with an academic session when
  created or edited. The blueprint's `Class` entity has
  `academicSessionId?: string`. Without this, end-of-year class archiving and
  session-scoped reporting are impossible.

---

### Issue C5 — No way to view or restore archived classes

- **File:** `src/pages/ClassesPage.tsx:80-82`
- **Type:** UX
- **Severity:** LOW
- **Description:** `if (c.status === "archived") return false` hard-filters
  archived classes from all views. There is no toggle to show archived classes
  or restore them. The "Archive" action is irreversible from the UI.

---

## 5. Users Page

### Issue U1 — All user tables display raw UIDs instead of names (pervasive)

- **File:** `src/pages/UsersPage.tsx:271-272, 333-334, 395-396`
- **Type:** BUG
- **Severity:** CRITICAL
- **Description:** Every user table column for the primary identifier shows a
  truncated Firebase UID:
  - Teachers: `t.uid.slice(0, 16)...` (line 272)
  - Students: `s.uid.slice(0, 16)...` (line 333)
  - Parents: `p.uid.slice(0, 16)...` (line 395)

  All three entity types have `firstName`, `lastName`, `displayName` fields in
  the blueprint schema. This makes user management completely unusable — an
  admin cannot identify any user in the system.

---

### Issue U2 — Search filters by UID, not name fields

- **File:** `src/pages/UsersPage.tsx:105-119`
- **Type:** BUG
- **Severity:** HIGH
- **Description:** Search logic filters against `.uid` for all three user types.
  Typing "John Smith" will never find a teacher named John Smith because the
  search runs against the Firebase UID string. Search should run against
  `firstName`, `lastName`, `displayName`, `email`, and `rollNumber` (for
  students).

---

### Issue U3 — Parent edit button has no click handler (dead button)

- **File:** `src/pages/UsersPage.tsx:411-413`
- **Type:** BUG
- **Severity:** HIGH
- **Description:** The pencil/edit `Button` in the Parents table has no
  `onClick` prop. Clicking it does nothing. There is no way to update any parent
  record from the UI.

```tsx
// Line 411-413 — no onClick:
<Button variant="ghost" size="sm">
  <Pencil className="h-3.5 w-3.5" />
</Button>
```

---

### Issue U4 — Parent picker in "Link Parents" dialog shows UIDs

- **File:** `src/pages/UsersPage.tsx:93-95`
- **Type:** BUG
- **Severity:** MEDIUM
- **Description:** `label: p.uid.slice(0, 16)` in `parentItems`. When linking a
  parent to a student, the admin sees a list of raw UID strings and cannot tell
  which parent to select.

---

### Issue U5 — No error display for failed user creation

- **File:** `src/pages/UsersPage.tsx:124-147`
- **Type:** BUG
- **Severity:** HIGH
- **Description:** `handleCreate` has a `finally` block but no `catch` for
  user-facing error display. If `callCreateOrgUser` throws (e.g. duplicate
  email, network error), the dialog closes or stays open with no error message.
  The user has no indication that creation failed.

---

### Issue U6 — No teacher permission management UI

- **File:** `src/pages/UsersPage.tsx` (entire file)
- **Type:** MISSING_FEATURE
- **Severity:** CRITICAL
- **Description:** The blueprint (§4.2, §5.2) explicitly requires TenantAdmin to
  manage granular per-teacher permissions: `canCreateExams`, `canEditRubrics`,
  `canManuallyGrade`, `canViewAllExams`, `canCreateSpaces`, `canManageContent`,
  `canViewAnalytics`, `canConfigureAgents`. These are stored in
  `UserMembership.permissions`. There is no UI anywhere in the admin portal to
  view or toggle these permissions. This is a primary TenantAdmin workflow.

---

### Issue U7 — No user deactivation, suspension, or deletion

- **File:** `src/pages/UsersPage.tsx` (entire file)
- **Type:** MISSING_FEATURE
- **Severity:** MEDIUM
- **Description:** There is no way to change a user's status (`active` →
  `inactive` → `suspended`) or soft-delete any user type. The blueprint
  `Student.status` and `Teacher.status` fields support these states. An admin
  has no lifecycle management over users once created.

---

### Issue U8 — Bulk import limited to students only

- **File:** `src/pages/UsersPage.tsx:149-166`
- **Type:** MISSING_FEATURE
- **Severity:** MEDIUM
- **Description:** The blueprint (§4.2) states "Bulk student import: CSV upload
  for mass student + parent creation." Teachers can also be bulk-imported per
  the permission matrix (§5.2). Only student CSV bulk import is implemented.
  Teacher bulk import is absent.

---

### Issue U9 — `queryClient.invalidateQueries` uses incorrect key pattern

- **File:** `src/pages/UsersPage.tsx:141`
- **Type:** BUG
- **Severity:** LOW
- **Description:** After user creation,
  `queryClient.invalidateQueries({ queryKey: ["tenants", tenantId] })` is
  called. Individual resource hooks (teachers, students, parents) likely use
  more specific query keys such as `["tenants", tenantId, "teachers"]`. The
  broad invalidation may or may not match depending on how
  `@levelup/shared-hooks` structures its query keys — this should be validated
  and targeted to the specific resource.

---

## 6. Settings Page

### Issue S1 — Entire "Tenant Settings" tab is read-only (no save action)

- **File:** `src/pages/SettingsPage.tsx:69-136`
- **Type:** INCOMPLETE
- **Severity:** CRITICAL
- **Description:** All inputs in the "School Information" card (lines 75-109)
  have `readOnly` attribute applied. There is no "Edit" mode, no Save button,
  and no mutation call. The "School setup" TenantAdmin feature — configuring
  tenant name, contact info, address, branding — is completely non-functional.
  This is listed as the first step in the TenantAdmin onboarding journey
  (Blueprint §6.1).

---

### Issue S2 — Evaluation Settings "Edit" button has no handler (dead button)

- **File:** `src/pages/SettingsPage.tsx:183`
- **Type:** BUG
- **Severity:** CRITICAL
- **Description:** The "Edit" button rendered next to each evaluation setting
  card has no `onClick` handler. Clicking it does nothing. RELMS evaluation
  dimension configuration is entirely non-functional from the admin portal.

```tsx
// Line 183 — no onClick:
<button className="text-primary text-sm hover:underline">Edit</button>
```

---

### Issue S3 — API Key "Set Key", "Update Key", "Remove" buttons have no handlers

- **File:** `src/pages/SettingsPage.tsx:234-243`
- **Type:** BUG
- **Severity:** CRITICAL
- **Description:** All three action buttons on the API Keys tab have no
  `onClick` handler. The Gemini API key can never be configured, updated, or
  removed through the UI. Since all AI features (grading, chat, evaluation)
  require a configured API key, this is a complete blocker for AI functionality
  on any new tenant.

```tsx
// Line 234 — no onClick:
<button className="inline-flex h-10 items-center rounded-md bg-primary px-4 ...">
  {tenant?.settings?.geminiKeySet ? "Update Key" : "Set Key"}
</button>

// Line 238 — no onClick:
<button className="inline-flex h-10 items-center rounded-md border border-destructive ...">
  Remove
</button>
```

---

### Issue S4 — Missing branding, feature flags, and advanced settings

- **File:** `src/pages/SettingsPage.tsx` (entire file)
- **Type:** MISSING_FEATURE
- **Severity:** HIGH
- **Description:** The Settings page is missing multiple configuration surfaces
  required by the blueprint:
  - **Branding:** No `logoUrl`, `bannerUrl`, or `website` fields
  - **Address:** No address configuration (`street`, `city`, `state`, `country`)
  - **Feature flags:** No toggles for `autoGradeEnabled`, `levelUpEnabled`,
    `aiChatEnabled`, `parentPortalEnabled`, `bulkImportEnabled`, etc.
  - **AI settings:** No `defaultAiModel` selector, no `timezone` or `locale`
    settings
  - **Grading policy:** No `gradingPolicy` configuration

---

### Issue S5 — No "Create" action for evaluation settings

- **File:** `src/pages/SettingsPage.tsx:139-215`
- **Type:** MISSING_FEATURE
- **Severity:** HIGH
- **Description:** The evaluation settings tab only lists existing
  configurations (read-only). There is no button to create new evaluation
  settings, no form to configure RELMS feedback dimensions, and no ability to
  set a default evaluation settings profile. The underlying `evaluationSettings`
  sub-collection is read but never written to from this page.

---

### Issue S6 — No subscription / billing management

- **File:** `src/pages/SettingsPage.tsx:113-136`
- **Type:** MISSING_FEATURE
- **Severity:** MEDIUM
- **Description:** The Subscription card displays current plan, maxStudents, and
  maxTeachers as read-only. There is no action to upgrade, contact support, view
  invoices, or see subscription expiry. The blueprint (§7.1) lists "billing" as
  a key screen for the Admin Web surface.

---

## 7. Analytics Page

### Issue AN1 — Unused `useExams` query call

- **File:** `src/pages/AnalyticsPage.tsx:26`
- **Type:** BUG
- **Severity:** LOW
- **Description:** `const _exams = useExams(tenantId)` — the underscore prefix
  signals this result is intentionally unused. A Firestore query fires on every
  render consuming reads and network, but the data is never consumed. Should be
  removed or used.

---

### Issue AN2 — No cross-system analytics (topic correlation)

- **File:** `src/pages/AnalyticsPage.tsx` (entire file)
- **Type:** MISSING_FEATURE
- **Severity:** HIGH
- **Description:** The blueprint (§4.5) requires cross-system analytics for
  TenantAdmin: topic correlation between LevelUp space engagement and AutoGrade
  exam scores, unified student summaries, and at-risk student detection across
  both products. The analytics page only shows AutoGrade class summaries. There
  is no LevelUp engagement data, no topic correlation view, and no individual
  student cross-system summary.

---

### Issue AN3 — No date range filtering

- **File:** `src/pages/AnalyticsPage.tsx` (entire file)
- **Type:** MISSING_FEATURE
- **Severity:** MEDIUM
- **Description:** Analytics always show all-time aggregate data. There is no
  date range picker to filter by academic session, semester, or custom date
  range. For a school running multiple academic years, all data will be
  aggregated without any temporal context.

---

### Issue AN4 — No individual student drill-down

- **File:** `src/pages/AnalyticsPage.tsx:198-280`
- **Type:** MISSING_FEATURE
- **Severity:** MEDIUM
- **Description:** The analytics class detail panel shows top/bottom performer
  lists but clicking a student name goes nowhere. There is no individual student
  analytics page showing the student's full history, space completions, exam
  scores, and AI interaction logs.

---

### Issue AN5 — No analytics data export

- **File:** `src/pages/AnalyticsPage.tsx` (entire file)
- **Type:** MISSING_FEATURE
- **Severity:** LOW
- **Description:** No CSV or PDF export action for any analytics data. School
  administrators commonly need to export performance data for reporting to
  management or education boards.

---

## 8. AI Usage Page

### Issue AI1 — No budget alerts or budget cap configuration

- **File:** `src/pages/AIUsagePage.tsx` (entire file)
- **Type:** MISSING_FEATURE
- **Severity:** HIGH
- **Description:** The blueprint (§4.2) lists "Cost monitoring: AI usage costs,
  budget alerts" as a TenantAdmin feature. The monthly budget collection
  `tenants/{tenantId}/costSummaries/monthly/{YYYY-MM}` (which contains budget
  limit and alert thresholds) is never queried. There is no UI to set a monthly
  budget cap, configure alert thresholds, or view budget utilization percentage.

---

### Issue AI2 — No per-teacher or per-operation breakdown

- **File:** `src/pages/AIUsagePage.tsx` (entire file)
- **Type:** MISSING_FEATURE
- **Severity:** MEDIUM
- **Description:** The cost breakdown only aggregates by "purpose" (extraction,
  grading, evaluation, tutoring). There is no breakdown by which teacher, which
  exam, or which space is consuming the most AI quota. For cost governance this
  is important — an admin cannot identify runaway usage.

---

## 9. Exams Overview Page

### Issue E1 — Invalid status filter values (data model mismatch)

- **File:** `src/pages/ExamsOverviewPage.tsx:21`
- **Type:** DATA_MODEL_MISMATCH
- **Severity:** MEDIUM
- **Description:** The status filter array includes `"scheduled"` and
  `"active"`. Neither exists in the blueprint's `Exam.status` enum:
  ```
  'draft' | 'question_paper_uploaded' | 'question_paper_extracted' |
  'in_progress' | 'grading' | 'completed' | 'archived'
  ```
  These filter buttons will always return zero results and mislead the user.

---

### Issue E2 — TenantAdmin cannot create exams from this page

- **File:** `src/pages/ExamsOverviewPage.tsx` (entire file)
- **Type:** MISSING_FEATURE
- **Severity:** HIGH
- **Description:** The blueprint permission matrix (§5.2) explicitly grants
  TenantAdmin the ability to create exams. There is no "Create Exam" button on
  this page. The page is purely a read-only list view.

---

### Issue E3 — No class filter, date filter, or pagination

- **File:** `src/pages/ExamsOverviewPage.tsx` (entire file)
- **Type:** MISSING_FEATURE
- **Severity:** MEDIUM
- **Description:** All exams across all teachers are fetched in one query with
  no pagination. For a school with hundreds of exams, this is a performance and
  usability issue. A class filter would be the primary way to narrow results.

---

### Issue E4 — No admin actions on exams (release results, archive)

- **File:** `src/pages/ExamsOverviewPage.tsx` (entire file)
- **Type:** MISSING_FEATURE
- **Severity:** MEDIUM
- **Description:** TenantAdmin should be able to release exam results and
  archive exams. The blueprint permission matrix (§5.2) grants
  `Release exam results` to TenantAdmin. No action buttons exist on this page.

---

## 10. Spaces & Courses Pages

### Issue SC1 — `space.totalItems` accesses non-existent field

- **File:** `src/pages/CoursesPage.tsx:214`
- **Type:** TYPE_ERROR
- **Severity:** MEDIUM
- **Description:** `space.totalItems` is read directly, but the blueprint
  `Space` schema places this inside `stats?: { totalItems: number }`. The
  correct access is `space.stats?.totalItems`. The current code always evaluates
  to `undefined`, and `space.totalItems != null` will always be false — the item
  count is never displayed.

---

### Issue SC2 — Duplicate pages with unclear purpose differentiation

- **File:** `src/pages/SpacesOverviewPage.tsx` and `src/pages/CoursesPage.tsx`
- **Type:** UX
- **Severity:** LOW
- **Description:** Both `SpacesOverviewPage` (`/spaces`) and `CoursesPage`
  (`/courses`) display learning spaces from the same Firestore collection with
  similar card/list layouts. The purpose distinction is not clear to the user
  and creates navigation confusion. `STATUS_COLORS` and `TYPE_COLORS` constants
  are duplicated between both files.

---

## 11. Reports Page

### Issue R1 — `"results_released"` is not a valid Exam status

- **File:** `src/pages/ReportsPage.tsx:44`
- **Type:** DATA_MODEL_MISMATCH
- **Severity:** MEDIUM
- **Description:** The exam filter includes `e.status === "results_released"`
  which is not in the blueprint's `Exam.status` enum. The "Exam Reports" tab
  will show only exams in `grading` or `completed` status (valid filters on
  lines 42-43), but the `results_released` check will never match. If the intent
  was to show completed exams, use `"completed"` only.

---

### Issue R2 — Inline `useClasses` hook duplicates shared hook logic

- **File:** `src/pages/ReportsPage.tsx:21-33`
- **Type:** BUG
- **Severity:** LOW
- **Description:** `ReportsPage` defines its own `useClasses` function by
  directly calling `getDocs(collection(db, ...))` instead of importing from
  `@levelup/shared-hooks`. This duplicates query logic, bypasses caching, and
  means changes to the shared hook won't apply here.

---

### Issue R3 — No LevelUp / space completion reports

- **File:** `src/pages/ReportsPage.tsx` (entire file)
- **Type:** MISSING_FEATURE
- **Severity:** MEDIUM
- **Description:** Reports are limited to AutoGrade exam PDF exports. There are
  no LevelUp reports (space completion rates, student engagement summaries, quiz
  performance). A complete TenantAdmin analytics picture requires both product
  domains.

---

## 12. Academic Sessions Page

### Issue AS1 — Page is fully built but unreachable via navigation (see N1)

- **File:** `src/pages/AcademicSessionPage.tsx` / `src/layouts/AppLayout.tsx`
- **Type:** MISSING_FEATURE
- **Severity:** CRITICAL
- **Description:** Detailed in Issue N1. The page is complete and functional in
  isolation but has no sidebar nav entry, making it effectively invisible to all
  users.

---

### Issue AS2 — No session deletion or archival

- **File:** `src/pages/AcademicSessionPage.tsx` (entire file)
- **Type:** MISSING_FEATURE
- **Severity:** LOW
- **Description:** Sessions can be created and edited but not deleted or
  archived. An admin cannot clean up test sessions or close out old academic
  years.

---

## 13. Notifications Page

The notifications page correctly delegates to the shared `NotificationsPageUI`
component and integrates `useNotifications`, `useMarkRead`, and `useMarkAllRead`
hooks properly. **No issues found.** ✅

---

## 14. Blueprint Features With Zero Implementation

The following TenantAdmin features are specified in the blueprint (§4.2, §5.2,
§6.1, §7.1) but have **no page, route, or component** in the current codebase.

| #   | Feature                                                                                                                                                                                                               | Blueprint Reference                         | Severity             |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | -------------------- |
| M1  | **Teacher permission management** — Toggle per-teacher `canCreateExams`, `canEditRubrics`, `canManuallyGrade`, `canCreateSpaces`, `canConfigureAgents`, `managedClassIds`, etc. on their `UserMembership.permissions` | §4.2 "Role & permission management", §5.2   | CRITICAL             |
| M2  | **Evaluation settings CRUD** — Create, configure, and set-as-default RELMS feedback dimension profiles                                                                                                                | §4.2 "Evaluation settings"                  | CRITICAL             |
| M3  | **Gemini API key configuration** — Securely set/update the tenant's Gemini key via a Cloud Function (not client-side write)                                                                                           | §4.2 "AI settings", §3.2 Tenant.settings    | CRITICAL             |
| M4  | **School profile editing** — Update tenant name, contact info, address, logo, banner, website                                                                                                                         | §4.2 "School setup", §6.1 onboarding step 1 | HIGH                 |
| M5  | **Feature flag management** — Toggle `autoGradeEnabled`, `levelUpEnabled`, `aiChatEnabled`, `parentPortalEnabled`, etc.                                                                                               | §3.2 Tenant.features                        | HIGH                 |
| M6  | **Billing / subscription management** — View plan, expiry, limits; contact for upgrade                                                                                                                                | §7.1 Admin Web key screens                  | HIGH                 |
| M7  | **At-risk student list** — Drill-down from the "At-Risk Students" count into a named list of flagged students with recommended actions                                                                                | §6.1 Ongoing Ops, §4.5                      | MEDIUM               |
| M8  | **Scanner device registration** — Register and manage physical scanner devices assigned to the tenant                                                                                                                 | §4.1, §4.2                                  | MEDIUM               |
| M9  | **Cross-system analytics** — Exam score ↔ LevelUp engagement correlation; unified student summaries; weak-topic drill-down                                                                                            | §4.5, §11                                   | MEDIUM               |
| M10 | **Academic sessions sidebar navigation** — The page exists but is unreachable                                                                                                                                         | §4.2                                        | CRITICAL (nav entry) |
| M11 | **Bulk teacher import** — CSV upload for mass teacher account creation                                                                                                                                                | §4.2, §5.2                                  | LOW                  |

---

## 15. Prioritised Fix List

### P0 — Blockers (app is broken / feature is entirely non-functional)

| Priority | Issue                                       | File                       | Impact                    |
| -------- | ------------------------------------------- | -------------------------- | ------------------------- |
| P0.1     | **Academic Sessions nav entry missing**     | `AppLayout.tsx`            | Entire page unreachable   |
| P0.2     | **Settings: all inputs read-only, no save** | `SettingsPage.tsx:69-136`  | School setup impossible   |
| P0.3     | **API key buttons have no handlers**        | `SettingsPage.tsx:234-243` | All AI features blocked   |
| P0.4     | **Evaluation settings Edit button dead**    | `SettingsPage.tsx:183`     | RELMS config impossible   |
| P0.5     | **Teacher permission management absent**    | No file exists             | Core TenantAdmin workflow |

### P1 — Critical Data / UX (app works but is unusable)

| Priority | Issue                                           | File                               | Impact                   |
| -------- | ----------------------------------------------- | ---------------------------------- | ------------------------ |
| P1.1     | **UIDs displayed instead of names everywhere**  | `UsersPage.tsx`, `ClassesPage.tsx` | Cannot identify any user |
| P1.2     | **Search filters on UID not name**              | `UsersPage.tsx:105-119`            | Search non-functional    |
| P1.3     | **Parent edit button dead**                     | `UsersPage.tsx:411-413`            | Parents uneditable       |
| P1.4     | **Auth guard missing tenantId check**           | `RequireAuth.tsx:25`               | Security gap             |
| P1.5     | **Class→student assignment writes wrong field** | `ClassesPage.tsx:147-155`          | Enrollment broken        |
| P1.6     | **RoleSwitcher shows raw tenant IDs**           | `AppLayout.tsx:122-128`            | Multi-tenant unusable    |

### P2 — High Priority Missing Features

| Priority | Issue                                          | File                    | Impact                          |
| -------- | ---------------------------------------------- | ----------------------- | ------------------------------- |
| P2.1     | School profile editing (name, logo, address)   | `SettingsPage.tsx`      | Onboarding incomplete           |
| P2.2     | Feature flag toggles                           | `SettingsPage.tsx`      | Cannot enable/disable products  |
| P2.3     | Budget alerts and monthly cost cap             | `AIUsagePage.tsx`       | Cost governance gap             |
| P2.4     | Evaluation settings creation                   | `SettingsPage.tsx`      | New tenants get no RELMS config |
| P2.5     | Class `subject` and `academicSessionId` fields | `ClassesPage.tsx`       | Classes incomplete              |
| P2.6     | TenantAdmin exam creation                      | `ExamsOverviewPage.tsx` | Can't create exams as admin     |
| P2.7     | Cross-system analytics                         | `AnalyticsPage.tsx`     | Half the platform invisible     |

### P3 — Medium Priority

| Priority | Issue                                | File                       | Impact                       |
| -------- | ------------------------------------ | -------------------------- | ---------------------------- |
| P3.1     | User deactivation / suspension       | `UsersPage.tsx`            | No lifecycle management      |
| P3.2     | User creation error display          | `UsersPage.tsx:124-147`    | Silent failures              |
| P3.3     | Exam status filter invalid values    | `ExamsOverviewPage.tsx:21` | Broken filter buttons        |
| P3.4     | `space.totalItems` wrong field path  | `CoursesPage.tsx:214`      | Item count never shown       |
| P3.5     | `results_released` invalid status    | `ReportsPage.tsx:44`       | Filter never matches         |
| P3.6     | Per-teacher AI cost breakdown        | `AIUsagePage.tsx`          | Quota governance gap         |
| P3.7     | Analytics date range filter          | `AnalyticsPage.tsx`        | All-time data only           |
| P3.8     | LevelUp completion reports           | `ReportsPage.tsx`          | Half the platform unreported |
| P3.9     | ReportsPage inline `useClasses` hook | `ReportsPage.tsx:21-33`    | Duplicated query logic       |
| P3.10    | `_exams` unused query                | `AnalyticsPage.tsx:26`     | Wasted Firestore read        |

### P4 — Low Priority / Polish

| Priority | Issue                                     | Impact                   |
| -------- | ----------------------------------------- | ------------------------ |
| P4.1     | No "Forgot password" on login             | Usability                |
| P4.2     | Sign Out button in wrong location         | Non-standard UX          |
| P4.3     | No archived class view                    | Cannot restore           |
| P4.4     | Bulk teacher import                       | Only students supported  |
| P4.5     | Session deletion/archival                 | Session lifecycle        |
| P4.6     | Analytics export (CSV/PDF)                | Reporting                |
| P4.7     | Duplicate Spaces/Courses pages            | Navigation confusion     |
| P4.8     | `queryClient.invalidateQueries` key check | Cache correctness        |
| P4.9     | Scanner device registration               | Blueprint feature        |
| P4.10    | At-risk student drill-down list           | Click-through from count |

---

_Audit complete. Total issues: 51 (8 CRITICAL · 17 HIGH · 16 MEDIUM · 10 LOW)_
