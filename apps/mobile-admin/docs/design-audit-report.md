# Mobile-Admin vs Design System — Audit Report

**Date:** 2026-07-19  
**App:** `apps/mobile-admin` (Expo/RN)  
**Design source:**
`lvlup-full-design-system/app/mobile-staff/App-MobileStaff.card.html` (admin
role sections) + `prototypes/admin/*.card.html`  
**Method:** 19 parallel Haiku subagents — one per screen — judged on functional
coverage, not pixel fidelity.

**Scope note:** 12 of the 31 `prototypes/admin/` screens are super-admin /
platform-level (tenant provisioning, system health, billing, LLM usage,
cross-tenant users, feature flags, global presets, super-admin
announcements/billing/settings, platform overview, platform analytics). These
are intentionally OUT OF SCOPE for the tenant-admin mobile app and are not
listed below.

---

## Counts

| Verdict     | Count  |
| ----------- | ------ |
| Implemented | **1**  |
| Partial     | **20** |
| Missing     | **0**  |
| **Total**   | **21** |

---

## Missing (0 screens)

_None — every admin screen from App-MobileStaff has a corresponding route in
mobile-admin._

---

## Partial (20 screens)

### 1. Admin Dashboard / Home

- **Design spec:** `prototypes/admin/admin-dashboard.card.html`
- **App file:** `apps/mobile-admin/src/screens/home/AdminDashboardScreen.tsx`
- **Reason:** Has KPI grid, AI cost card, and tenant info card; missing
  class-performance bar chart, subscription quota meters (5 quota progress
  bars), and features list (8 feature chips).
- **Missing sections:**
  - Class Performance bar chart (avg exam scores by class)
  - Subscription usage panel (5 quota meters: Students, Teachers, Spaces,
    Exams/month, AI calls/month)
  - Features list (8 feature chips showing enabled/disabled state)

---

### 2. User Management (People Hub)

- **Design spec:** `prototypes/admin/user-management.card.html`
- **App file:** `apps/mobile-admin/src/screens/people/UserManagementScreen.tsx`
- **Reason:** Basic list/search/tabs implemented, but missing add/import
  actions, status/class filters, row action menus, bulk selection, pagination,
  create user modal, CSV import dialog, and confirm modals.
- **Missing sections:**
  - Add/Import action buttons and modals
  - Status and class filter dropdowns
  - Row action menus (Edit, Assign classes, Link parents, Resend invite,
    Archive/Reactivate)
  - Bulk selection checkboxes and floating bulk action bar
  - Pagination controls
  - Create User modal (role-adaptive fields)
  - CSV Import dialog (two-phase validation)
  - Confirm Archive dialog with consequences
  - Permission-gated UI (view-only banner + hidden actions)

---

### 3. User Detail

- **Design spec:** `prototypes/admin/user-management.card.html` (UserDetailModal
  section)
- **App file:** `apps/mobile-admin/src/screens/people/UserDetailScreen.tsx`
- **Reason:** Shows profile, role badge, contact, and class/children sections;
  missing Edit modal, Archive/Reactivate actions, and audit-log notice.
- **Missing sections:**
  - Edit button and edit modal
  - Archive/Reactivate action buttons
  - Audit-logged consequence alert

---

### 4. Staff Management

- **Design spec:** `prototypes/admin/staff-management.card.html`
- **App file:** `apps/mobile-admin/src/screens/people/StaffManagementScreen.tsx`
- **Reason:** Basic list and invite form present; missing two-tab interface
  (Teachers|Staff), status badges, per-person permission count, permissions
  editor, actions menu, quota warning, and confirm dialogs.
- **Missing sections:**
  - Two-tab switching (Teachers / Staff cohorts)
  - Status badges (Active/Inactive/Suspended) and avatar dimming
  - Permission count display per person (x/6)
  - Permissions editor button and dialog (with toggles and no-escalation guard)
  - Actions menu (ellipsis) per row: deactivate / reactivate / copy invite link
  - Phone field in invite form
  - Quota warning banner for seat limits
  - Deactivate/Reactivate confirmation dialog
  - Toast notifications

---

### 5. Roles & Permissions

- **Design spec:** `prototypes/admin/memberships-roles-permissions.card.html`
- **App file:**
  `apps/mobile-admin/src/screens/people/RolesPermissionsScreen.tsx`
- **Reason:** Implements only the read-only permission matrix and role
  distribution stats (~35% of spec); entire member management system (tab,
  table, drawer editor, bulk actions, audit log) is absent.
- **Missing sections:**
  - Members tab with searchable directory table
  - Member editor drawer (role change + permission toggles)
  - Tabbed interface (Members | Roles & Permissions)
  - Bulk actions bar (multi-select suspend/reactivate)
  - Confirmation dialogs for role changes / suspension
  - Audit log ("Recent access changes" timeline)
  - Per-member status badges and row menu actions
  - Self-lockout guard

---

### 6. Parent Linking

- **Design spec:** `prototypes/admin/parent-linking.card.html`
- **App file:** `apps/mobile-admin/src/screens/people/ParentLinkingScreen.tsx`
- **Reason:** Core link management (list, picker, save) is implemented; missing
  confirmation modal, parent portal warning banner, tab navigation,
  status/linked filters, row actions, and bulk import.
- **Missing sections:**
  - Confirmation modal (review & confirm step before saving links)
  - Parent portal feature-flag warning alert
  - Tab navigation (Teachers/Students/Parents tabs with counts)
  - Status filter and Linked? filter dropdowns
  - Per-parent more-actions menu
  - Bulk CSV import button

---

### 7. Class Management

- **Design spec:** `prototypes/admin/class-management.card.html`
- **App file:**
  `apps/mobile-admin/src/screens/academics/ClassManagementScreen.tsx`
- **Reason:** Implements basic list, 4 KPI tiles, and create-class modal
  (~15–20% of spec); missing filters, row actions, assign dialogs, bulk ops,
  confirm dialogs, and pagination.
- **Missing sections:**
  - Advanced filters (term/grade/teacher dropdowns and filter chips)
  - Per-row actions menu (Assign Teachers, Assign Students, Archive, View
    Detail)
  - Assign teachers dialog (teacher picker)
  - Assign students dialog (student picker)
  - Bulk selection checkboxes and floating bulk action bar
  - Quota alert banner (plan limit enforcement)
  - Archive confirmation dialog
  - Pagination
  - RBAC read-only restrictions for staff

---

### 8. Class Detail

- **Design spec:** `prototypes/admin/class-detail.card.html`
- **App file:** `apps/mobile-admin/src/screens/academics/ClassDetailScreen.tsx`
- **Reason:** Intentional mobile simplification — shows summary KPIs and
  progress metrics; all tabbed roster/teacher/exam/spaces management deferred to
  web with explicit "Manage class" CTA.
- **Missing sections (deferred to web by design):**
  - Tabbed interface (Students, Teachers, Exams, Spaces, Settings)
  - Student roster table with bulk management
  - Teacher assignment management
  - Exam and space linking
  - Settings editor (class metadata edit)
  - Archive/restore modals

---

### 9. Spaces / Content Overview

- **Design spec:** `prototypes/admin/spaces-overview.card.html`
- **App file:**
  `apps/mobile-admin/src/screens/academics/SpacesOverviewScreen.tsx`
- **Reason:** Read-only list with search and basic filters implemented;
  lifecycle actions (publish/archive/restore), advanced filters
  (status/type/class), view toggle, and role-gated affordances are absent.
- **Missing sections:**
  - Status, type, and class filter dropdowns
  - Grid/table view toggle
  - Per-space overflow menu with lifecycle actions (Publish, Archive, Restore)
  - Role-based affordance hiding (read-only warning + hidden actions)
  - Confirmation dialog for publish/archive/restore
  - Completion progress bar per space
  - Toast notifications

---

### 10. Courses

- **Design spec:** `prototypes/admin/courses.card.html`
- **App file:** `apps/mobile-admin/src/screens/academics/CoursesScreen.tsx`
- **Reason:** Discovery (subject coverage, KPIs, dual-tab list) implemented;
  missing search/filter UI, table grid, row context menus, bulk ops, and confirm
  modal.
- **Missing sections:**
  - Search input and filter UI (status/type/class dropdowns)
  - Table grid view with sortable columns
  - Items count, story points, completion bars, teacher count, timestamps in
    rows
  - Row context menu (3-dot: Publish/Archive/Reassign)
  - Bulk selection and bulk action bar
  - Archive confirm modal

---

### 11. Exams Overview

- **Design spec:** `prototypes/admin/exams-overview.card.html`
- **App file:**
  `apps/mobile-admin/src/screens/academics/ExamsOverviewScreen.tsx`
- **Reason:** Implements only 3 of 8 design sections (header, KPI tiles, stacked
  list); missing toolbar, filters, full data table with grading-progress bars
  and confidence badges, pagination, and contextual alerts.
- **Missing sections:**
  - Search and Status/Subject/Class/Session filter toolbar
  - Active filter chips
  - Sortable data table with grading-progress bars, confidence badges, results
    pills
  - Pagination
  - Partial-data banner, KPI-degrade alert, feature-gated alerts, answer-key
    guard
  - Export CSV button

---

### 12. Academic Sessions

- **Design spec:** `prototypes/admin/academic-sessions.card.html`
- **App file:**
  `apps/mobile-admin/src/screens/academics/AcademicSessionsScreen.tsx`
- **Reason:** Create, list, and rollover flow present; missing edit button on
  current session, row-level actions, "Set as current" per row, rollover
  consequence preview, two-step rollover confirmation, and RBAC read-only state.
- **Missing sections:**
  - Edit button on current session card
  - Per-row actions (rollover & edit icons)
  - "Set as current" action on non-current session rows
  - Rollover consequence preview (5-line live preview alert)
  - Two-modal rollover confirmation gate (design is 2-step; app is 1-step)
  - Read-only RBAC state (permission-gated alert)

---

### 13. Analytics / Insights Hub

- **Design spec:** `prototypes/admin/analytics.card.html`
- **App file:** `apps/mobile-admin/src/screens/insights/AnalyticsScreen.tsx`
- **Reason:** Trend metrics, column chart with granularity toggle, and insights
  feed implemented; class-level bar charts, mastery distribution, drill-down,
  and export deferred to web.
- **Missing sections:**
  - 4-up KPI row (exam score, space completion, at-risk, total students) — only
    2 headline cards
  - Exam/Space/At-risk class-level bar charts
  - Mastery distribution segmented bar + legend
  - Class detail drill-down (top/bottom performers, at-risk roster)
  - Export (PDF, audited, 1-hour expiry)

---

### 14. Reports

- **Design spec:** `prototypes/admin/reports.card.html`
- **App file:** `apps/mobile-admin/src/screens/insights/ReportsScreen.tsx`
- **Reason:** Shows read-only catalog of report types and defers interactive
  builder to web; design spec specifies a full mobile builder with type
  selection, parameters, generation, and download.
- **Missing sections:**
  - Report type radio selection UI
  - Dynamic parameters form (exam/class/student/session pickers)
  - Export format selector
  - Generate button with loading state
  - Success strip with result metadata and PDF download
  - Quick-pick tables (Reportable exams & Classes)
  - Rate-limit warning and permission-denied states

---

### 15. AI Usage & Cost

- **Design spec:** `prototypes/admin/ai-usage-cost.card.html`
- **App file:** `apps/mobile-admin/src/screens/insights/AiUsageCostScreen.tsx`
- **Reason:** KPI strip, budget panel, and daily trend chart solid; missing
  sortable purpose/model tables, daily breakdown table with pagination, failed
  grading DLQ, month navigation, and export.
- **Missing sections:**
  - Purpose breakdown as sortable data table (currently horizontal bars only)
  - Daily breakdown paginated table
  - Failed grading attempts DLQ (dead-letter queue with retry tracking) —
    critical ops feature
  - Month navigation (prev/next picker)
  - Export functionality (PDF/CSV with signed links)
  - Over-budget / on-track budget state variants

---

### 16. Announcements

- **Design spec:** `prototypes/admin/announcements.card.html`
- **App file:** `apps/mobile-admin/src/screens/more/AnnouncementsScreen.tsx`
- **Reason:** Barebones list stub with status filter tabs; missing platform
  notices band, row actions, audience targeting in compose modal, confirm
  dialogs, quota enforcement, and toast system.
- **Missing sections:**
  - Platform notices band (read-only system notices from super-admin)
  - Table layout with row actions (Edit, Publish, Archive, Delete, Restore)
  - Pagination
  - Compose modal: Write/Preview tabs, expiry date, audience targeting (roles +
    classes)
  - Confirm dialogs for Publish/Archive/Delete
  - Quota-blocked publish warning
  - Permission-gated view-only alert
  - Toast notifications

---

### 17. Notifications

- **Design spec:** `prototypes/admin/notifications.card.html`
- **App file:** `apps/mobile-admin/src/screens/more/NotificationsScreen.tsx`
- **Reason:** Basic inbox with mark-all CTA present; missing filter tabs
  (All/Unread), date-grouped sections, per-row mark-read, tone-based visual
  badges, deep-link navigation, and load-more pagination.
- **Missing sections:**
  - Filter tabs (All / Unread with count chip)
  - Grouped list by date (Today / Yesterday / Earlier section headers)
  - Per-row mark-read button
  - Type-based tonal icon badges (warn/err/success/info/brand)
  - Unread dot visual indicator
  - Deep-link navigation to related screens
  - Load-more pagination button
  - Toast on mark-all success
  - Tenant-scoped info banner

---

### 18. Tenant Settings / Branding

- **Design spec:** `prototypes/admin/tenant-settings-branding.card.html`
- **App file:** `apps/mobile-admin/src/screens/more/TenantSettingsScreen.tsx`
- **Reason:** General tab (school info, subscription stats, API key)
  implemented; Evaluation tab (feedback policy, dimension toggles) and Features
  tab (7 feature flag toggles) entirely absent; color picker reduced to hex
  input only.
- **Missing sections:**
  - Evaluation tab: feedback policy, dimension toggles
    (Clarity/Depth/Structure/Relevance), strengths/takeaway summary toggles
  - Features tab: 7 feature toggles (autograde, AI chat, parent portal,
    leaderboard, custom branding, proctor, webhooks) with plan-gating
  - Full swatch color picker with AA contrast validation
  - Logo upload (deferred to web)
  - Settings preview shell

---

### 19. Data Export

- **Design spec:** `prototypes/admin/data-export.card.html`
- **App file:** `apps/mobile-admin/src/screens/more/DataExportScreen.tsx`
- **Reason:** Basic export flow (scope selection + format + trigger) present;
  missing export history audit table, sensitive-data confirmation dialog,
  per-row action buttons, disabled collections, and edge-case states.
- **Missing sections:**
  - Export history audit table (scope, format, size, status, expiry, actions per
    row)
  - Sensitive-data confirmation dialog (for Submissions/Analytics exports)
  - Per-row action buttons (Copy Link, Download, Re-export, Try Again)
  - Disabled collections for restricted tenants (with tooltip)
  - Tenant-scoping guarantee info alert
  - Edge-case states (empty history, permission denied, quota exceeded, tenant
    suspended)

---

### 20. Onboarding Wizard

- **Design spec:** `prototypes/admin/onboarding-wizard.card.html`
- **App file:** `apps/mobile-admin/src/screens/more/OnboardingWizardScreen.tsx`
- **Reason:** Simplified 4-step wizard (welcome → first user → roster → done);
  missing school branding step, academic session setup, first class creation,
  per-field validation, and governance banners.
- **Missing sections:**
  - School branding step (logo upload + color selection)
  - Academic session step (start/end date configuration)
  - First class creation step (grade/section form)
  - Per-field validation with inline error messages
  - Governance banners and completion consequence notes
  - Resume banner (if wizard was previously interrupted)
  - Loading skeleton during step transitions

---

## Implemented (1 screen)

### 21. More Menu

- **Design spec:** `app/mobile-staff/App-MobileStaff.card.html` (View_AdminMore,
  line 4911)
- **App file:** `apps/mobile-admin/src/screens/more/MoreMenuScreen.tsx`
- **Reason:** All primary sections present — account header
  (avatar/name/email/role), Communications (Announcements, Notifications),
  Configuration (Settings, Data Export, Onboarding); tenant switching routed to
  dedicated switcher.

---

## Notes

- **Deliberate web-deference pattern**: Many "partial" screens are intentionally
  lighter on mobile — they defer heavy authoring (class detail roster, spaces
  authoring, report builder, analytics drill-down) to the web admin app via
  explicit "Continue on web" / "Open on web" CTAs. These are valid product
  decisions, not missed implementations.
- **Super-admin screens excluded**: 12 of the 31 `prototypes/admin/` specs are
  platform-level (tenant-provisioning, system-health, billing, LLM usage,
  cross-tenant users, feature-flags, global-presets, and super-admin-prefixed
  screens). These are out of scope for the tenant-admin mobile role and were
  correctly not implemented.
- **Highest-priority gaps for functional completeness:**
  1. Roles & Permissions member management (currently a read-only reference
     card)
  2. Staff Management permission editor and action menus
  3. AI Usage DLQ (dead-letter queue for failed grading — production ops
     critical)
  4. Tenant Settings missing Evaluation + Features tabs
  5. Announcements audience targeting and confirm flows
