# Admin-Web Design Surface Audit

**Date:** 2026-07-19  
**Scope:** Tenant-level admin screens only (super-admin screens excluded per
task spec)  
**Design system:** `lvlup-full-design-system/prototypes/admin/*.card.html`  
**App:** `apps/admin-web/src/pages/`  
**Method:** Functional coverage — "implemented" if route/page covers same
functional surface; "partial" if some sections missing; "missing" if no
equivalent route/page at all.

---

## Summary

| Verdict                   | Count                                       |
| ------------------------- | ------------------------------------------- |
| Missing                   | 1                                           |
| Partial                   | 15                                          |
| Implemented               | 5                                           |
| **Total screens audited** | **21** _(20 content screens + 1 app shell)_ |

---

## Missing (1)

### `llm-usage`

- **Design spec:** `prototypes/admin/llm-usage.card.html`
- **File:** `null`
- **Reason:** No platform-level LLM usage page exists in admin-web. The design
  spec defines a cross-tenant usage dashboard with per-tenant table, control bar
  with month/tenant/model filters, and per-tenant budget tracking — this route
  is not implemented. _(Note: the design prototype uses a super-admin shell;
  this screen may belong to the super-admin app rather than tenant-admin — worth
  confirming scope before building.)_

---

## Partial (15)

### `academic-sessions`

- **Design spec:** `prototypes/admin/academic-sessions.card.html`
- **File:** `apps/admin-web/src/pages/AcademicSessionPage.tsx`
- **Reason:** Core functionality implemented (create, edit, rollover dialog,
  all-sessions table with correct columns, current session card with KPIs).
  Missing: pagination UI, explicit error state view, and permission-gated
  read-only view. Rollover consequence preview is delegated to a sub-component
  but the design's full delta display is not present.

### `analytics`

- **Design spec:** `prototypes/admin/analytics.card.html`
- **File:** `apps/admin-web/src/pages/AnalyticsPage.tsx`
- **Reason:** Core KPIs (4 cards), charts (exam performance, space completion,
  at-risk by class), and class drill-down (selector chips, 4-stat block,
  top/bottom performers) are implemented. Missing: mastery distribution
  segmented bar, insights section with 3 insight cards, at-risk roster with
  individual student rows and deep-links, export button/menu, and secondary
  state views (loading, error, permission-gated, empty).

### `notifications`

- **Design spec:** `prototypes/admin/notifications.card.html`
- **File:** `apps/admin-web/src/pages/NotificationsPage.tsx`
- **Reason:** Core surfaces present (page header with "Mark all as read",
  all/unread tabs, grouped reading list, per-row mark-read, empty states,
  load-more pagination). Missing: time-period grouping (Today / Yesterday /
  Earlier headers), per-type icon semantics (warn/err/suc/info/brand tone
  indicators), tenant-scoped info banner, animated spinner on mark-read.

### `class-detail`

- **Design spec:** `prototypes/admin/class-detail.card.html`
- **File:** `apps/admin-web/src/pages/ClassDetailPage.tsx`
- **Reason:** Core route and tabbed structure exist with Students / Teachers /
  Exams / Spaces tabs, breadcrumb navigation, and KPI cards. Missing: Settings
  tab (no inline edit of class details from the detail view), checkbox bulk
  selection in tables, row action menus, and archive/restore modal within the
  detail view.

### `courses`

- **Design spec:** `prototypes/admin/courses.card.html`
- **File:** `apps/admin-web/src/pages/CoursesPage.tsx`
- **Reason:** Core elements present (title, subject overview KPI strip,
  search/status/class filters, course list). Missing: proper data table layout
  (implementation renders card grid instead), pagination, checkbox selection and
  floating bulk action bar, row-detail drawer for class assignment editing,
  create/archive modals, active filter chip strip, grid/table view toggle, and
  comprehensive empty/error states.

### `data-export`

- **Design spec:** `prototypes/admin/data-export.card.html`
- **File:** `apps/admin-web/src/pages/DataExportPage.tsx`
- **Reason:** Core functionality present (collection checkbox grid, format radio
  buttons, export execution, history list). Missing: tenant-isolation info
  alert, client-side validation warning display, "submissions" and "analytics"
  collection options, full history data table (implementation uses simplified
  list vs designed sortable table), confirm dialog for sensitive data, and most
  secondary state examples.

### `exams-overview`

- **Design spec:** `prototypes/admin/exams-overview.card.html`
- **File:** `apps/admin-web/src/pages/ExamsOverviewPage.tsx`
- **Reason:** Basic table with search, status filters, pagination, and
  loading/error/empty states exists. Missing: KPI cards (total exams, awaiting
  grading, needs review, overdue results), advanced filter options (Subject,
  Class, Session), grading progress column, AI confidence column,
  results-released column, and column-level sorting.

### `memberships-roles-permissions`

- **Design spec:** `prototypes/admin/memberships-roles-permissions.card.html`
- **File:** `apps/admin-web/src/pages/StaffPage.tsx`
- **Reason:** StaffPage has permission management for teachers and staff with
  permission dialogs and toggle controls. Missing: unified members data table
  combining all user types with role/permission columns, role selector UI,
  permission matrix view for canonical roles, bulk member selection/actions,
  drawer-based permission editor, access audit log, role-change confirmation
  modal, and self-lockout guards.

### `onboarding-wizard`

- **Design spec:** `prototypes/admin/onboarding-wizard.card.html`
- **File:** `apps/admin-web/src/pages/OnboardingWizardPage.tsx`
- **Reason:** 3 of 4 steps implemented (School Info → Academic Session → Create
  Class → Done). Missing the Branding step (logo upload + primary color picker).
  Stepper UI, form validation, and join code copy on the Done screen are all
  present.

### `parent-linking`

- **Design spec:** `prototypes/admin/parent-linking.card.html`
- **File:** `apps/admin-web/src/pages/UsersPage.tsx`
- **Reason:** Parents tab exists within the Users page and displays linked
  children. Missing the core parent-linking drawer from the design: the
  search-and-add-student drawer with delta confirmation modal. Only basic parent
  field editing (name/phone) is implemented; the workflow for managing which
  students a parent is linked to is absent.

### `reports`

- **Design spec:** `prototypes/admin/reports.card.html`
- **File:** `apps/admin-web/src/pages/ReportsPage.tsx`
- **Reason:** Basic PDF download exists via a tab-based list (Exam Reports /
  Class Reports). Missing the comprehensive report builder UI: report-type
  selector, dynamic parameter forms, exam/class picker search modals, scope
  selection (whole class vs individual student), academic session filter,
  quick-pick tables for reportable exams/classes, student progress report type,
  and secondary states (rate limiting, analytics disabled, loading).

### `spaces-overview`

- **Design spec:** `prototypes/admin/spaces-overview.card.html`
- **File:** `apps/admin-web/src/pages/SpacesOverviewPage.tsx`
- **Reason:** Basic search, status filter tabs, and card grid view are
  implemented with loading/empty/error states. Missing: grid/table view toggle,
  type filter (Learning/Practice/Assessment/Resource/Hybrid), class filter, card
  action menus (publish/archive/restore/copy space ID/edit assignment), space
  metrics on cards (story points, items count, students count, completion %),
  last-updated timestamp, count summary strip, and RBAC read-only staff variant.

### `staff-management`

- **Design spec:** `prototypes/admin/staff-management.card.html`
- **File:** `apps/admin-web/src/pages/StaffPage.tsx`
- **Reason:** Teacher and staff tabs with search, per-person permission counts,
  and permission editing dialogs are implemented. Missing: staff-seat limit
  warning banner, deactivate/reactivate/soft-deactivate UI flow,
  copy-invite-link feature, no-escalation permission guards, and some dialog
  variants (invite staff as separate modal with fields).

### `tenant-settings-branding`

- **Design spec:** `prototypes/admin/tenant-settings-branding.card.html`
- **File:** `apps/admin-web/src/pages/SettingsPage.tsx`
- **Reason:** Settings page covers general school info, branding (logo upload +
  hex color inputs), evaluation settings, and Gemini API key management.
  Missing: standalone Features tab with plan-gated feature toggles
  (auto-grading, tutor chat, parent portal, leaderboards, proctoring, webhooks),
  live multi-panel preview shell, and richer subscription/plan management UI.

### `app-shell-nav` (App-Admin.card.html)

- **Design spec:** `app/web-admin/App-Admin.card.html`
- **File:** `apps/admin-web/src/layouts/AppLayout.tsx`
- **Reason:** 4 nav groups and most items are present. Group ordering differs:
  design places Notifications in the Configuration group; implementation instead
  puts Academic Sessions in Configuration and Notifications is missing from the
  nav sidebar. Minor structural divergence from the design spec.

---

## Implemented (5)

### `admin-dashboard`

- **Design spec:** `prototypes/admin/admin-dashboard.card.html`
- **File:** `apps/admin-web/src/pages/DashboardPage.tsx`
- **Reason:** All major sections implemented: 6 KPI cards (Students, Teachers,
  Classes, Spaces, Exams, At-Risk), class performance chart, AI cost summary
  card, tenant info card, 5 subscription quota meters, features list, quota
  warning alert, and onboarding incomplete banner.

### `ai-usage-cost`

- **Design spec:** `prototypes/admin/ai-usage-cost.card.html`
- **File:** `apps/admin-web/src/pages/AIUsagePage.tsx`
- **Reason:** All primary sections implemented: KPI strip (4 cards), month
  navigation picker, budget panel with progress bar and projection, daily cost
  trend chart, cost breakdowns (by purpose and model), daily breakdown paginated
  table, failed grading attempts (DLQ table), and state variants (over-budget
  warning, approaching-budget warning, loading, empty).

### `class-management`

- **Design spec:** `prototypes/admin/class-management.card.html`
- **File:** `apps/admin-web/src/pages/ClassesPage.tsx`
- **Reason:** All core functional surfaces present: search/filter bar, sortable
  data table with pagination, checkbox bulk selection, floating bulk action bar
  (archive/activate), and dialogs for
  create/edit/assign-teachers/assign-students/archive. Minor gaps: KPI summary
  cards at top not present, Term filter dropdown missing, View Detail not in row
  action menu.

### `announcements`

- **Design spec:** `prototypes/admin/announcements.card.html`
- **File:** `apps/admin-web/src/pages/AnnouncementsPage.tsx`
- **Reason:** Full implementation with all functional surfaces: page header with
  New Announcement CTA, platform notices read-only band, status filter tabs
  (all/draft/published/archived with counts), data table with all specified
  columns, row action buttons (edit/publish/archive), pagination, editor modal
  with all fields (title/body/expiry/target roles/classes), confirm dialogs,
  toast notifications, empty states, and loading skeleton.

### `user-management`

- **Design spec:** `prototypes/admin/user-management.card.html`
- **File:** `apps/admin-web/src/pages/UsersPage.tsx`
- **Reason:** Full implementation: tabbed user management (Teachers / Students /
  Parents), search/filter, create dialog with role-specific fields, bulk CSV
  import with dry-run validation, checkbox selection with floating bulk action
  bar (archive/activate), class assignment, parent linking, pagination, and
  status badges all present.

---

## Notes

- **`llm-usage`** may actually be a super-admin screen (the prototype uses a
  super-admin app shell) — if confirmed, the true missing count for tenant-admin
  is **0**, and partial becomes the dominant state.
- **`memberships-roles-permissions`** and **`staff-management`** both map to
  `StaffPage.tsx`; the design treats them as one surface, the implementation
  conflates them with different framing.
- **`parent-linking`** maps to the Parents tab inside `UsersPage.tsx`, not a
  standalone page.
