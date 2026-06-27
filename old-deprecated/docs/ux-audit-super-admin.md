# UX Audit: super-admin

**Audited**: Every file in `apps/super-admin/src/` (26 files) **Stack**: React +
Vite + TypeScript + Tailwind + shadcn/ui + Firebase + TanStack Query + Recharts

---

## Executive Summary

The super-admin app is a comprehensive platform management console with strong
operational tooling: tenant CRUD, feature flags, system health monitoring, LLM
usage tracking, analytics, announcements, and global presets. The codebase
demonstrates solid patterns — lazy loading, skeleton states, empty states, error
handling with retry, Zod validation, confirmation dialogs for destructive
actions, and proper breadcrumb navigation. However, there are notable UX gaps
around authentication polish, chart accessibility, mobile experience,
notification absence, and inconsistent interaction patterns across pages.

**Overall Grade: B+**

---

## 1. Authentication Flow

### Strengths

- Split-panel auth layout: branding panel (hidden mobile) + form panel —
  professional, polished
- Mobile logo fallback when branding panel is hidden
- Error states use `role="alert"` with proper styling
- Loading spinner with "Signing in..." text change
- Preserves redirect location (`from` state)

### Issues

| #   | Severity | Issue                                                                                                                                                              | Recommendation                                                                        |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| A1  | High     | **No password visibility toggle** — unlike parent-web which has a show/hide toggle, super-admin's login form has no way to reveal password characters              | Add a show/hide toggle button on the password field                                   |
| A2  | High     | **No forgot password flow** — there is no "Forgot password?" link or mechanism. Super admins locked out must use Firebase Console directly                         | Add forgot password link that calls `sendPasswordResetEmail`                          |
| A3  | Medium   | **No `autoComplete` attributes** — email lacks `autoComplete="email"`, password lacks `autoComplete="current-password"`                                            | Add autoComplete attributes for password manager support                              |
| A4  | Low      | **No rate limiting feedback** — if Firebase rate-limits login attempts, the generic error message doesn't tell the user to wait                                    | Detect `auth/too-many-requests` error and show specific messaging                     |
| A5  | Low      | **RequireAuth "Access Denied" page shows logout button** but no explanation of what role is required — better than parent-web's dead-end, but still lacks guidance | Add message: "This area requires super admin privileges. Contact your administrator." |

---

## 2. Navigation & Information Architecture

### Strengths

- AppShell with 3 sidebar groups: Overview (1), Platform (7), System (2)
- `AppBreadcrumb` with route labels and segment resolvers for tenant detail
- Route prefetching via `usePrefetch` on link hover
- `SkipToContent` and `RouteAnnouncer` for accessibility
- ThemeToggle in header
- `SWUpdateNotification` for service worker updates

### Issues

| #   | Severity | Issue                                                                                                                                                                                                         | Recommendation                                                                                     |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| N1  | High     | **Mobile bottom nav only shows 4 of 10 pages** (Home, Tenants, Health, Settings) — 6 pages are unreachable from mobile bottom nav. Users must find and open the sidebar                                       | Add a "More" menu item in mobile bottom nav to surface remaining pages                             |
| N2  | Medium   | **No notification system** — unlike parent-web which has a NotificationBell, super-admin has no notification mechanism. System health failures, tenant issues, or important events have no push/in-app alerts | Add a notification system for critical platform events (health failures, tenant expirations, etc.) |
| N3  | Medium   | **"Users" nav item uses Search icon** (`Search` from lucide-react) instead of a Users icon — confusing because the page is about user management, not search                                                  | Use `Users` or `UserSearch` icon instead of `Search`                                               |
| N4  | Low      | **Sidebar footer only shows user name/email** — no role indicator, no avatar, no quick logout                                                                                                                 | Add role badge ("Super Admin"), avatar, and quick logout action                                    |
| N5  | Low      | **Breadcrumb only resolves tenant detail routes** — other deep pages (if any) don't have custom resolvers                                                                                                     | Minor — add resolvers as new nested routes are added                                               |

---

## 3. Dashboard

### Strengths

- 4 StatCards (Total Tenants, Active Tenants, Total Users, Active Users 30d)
  with trend formatting
- 3 growth metric cards (New Tenants, Active Users 7d, Engagement Rate) with
  visual sparklines
- Recharts BarChart for top tenants by users (top 8)
- Recharts PieChart for users by plan distribution
- Activity feed from `platformActivityLog` with human-readable descriptions
- Recent tenants list with status badges and navigation links
- 3 Quick Action buttons (New Tenant, Feature Flags, System Health)
- Comprehensive error state with retry button
- Full skeleton loading layout

### Issues

| #   | Severity | Issue                                                                                                                                                                                                                  | Recommendation                                                                      |
| --- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| D1  | High     | **Logout button is in the Dashboard page header** — `PageHeader` has logout as an action. This is architecturally wrong: logout should be in the sidebar footer, settings, or a user menu — not a page-specific action | Move logout to sidebar footer or add a user dropdown menu in the header             |
| D2  | Medium   | **Charts lack accessibility** — Recharts `BarChart` and `PieChart` have no `<desc>` or `aria-label`. Screen readers get no information about chart content                                                             | Add `aria-label` describing chart purpose and a visually-hidden data table fallback |
| D3  | Medium   | **Activity feed has no pagination or "load more"** — if `platformActivityLog` has many entries, they all render                                                                                                        | Add pagination or virtual scrolling for the activity list                           |
| D4  | Low      | **Recent tenants list is limited to 5** with no "View all" link — users must navigate to Tenants page manually                                                                                                         | Add "View all tenants →" link at bottom of the list                                 |
| D5  | Low      | **Growth metric calculations may show misleading percentages** — engagement rate divides `activeUsersLast30d / totalUsers * 100` but total users includes inactive/suspended accounts                                  | Consider using "active tenant users" as denominator                                 |
| D6  | Low      | **Pie chart custom label positioning** can overlap on small screens — the `renderCustomLabel` function calculates static radius offsets                                                                                | Add responsive label positioning or use a legend instead on small screens           |

---

## 4. Tenants Page

### Strengths

- Search by name, code, or contact email
- Status filter pills with count (All, Active, Trial, Suspended)
- Sortable table columns (Name, Code, Status, Users, Created) with visual
  indicators
- Paginated with `DataTablePagination` (configurable page size)
- Create Tenant dialog with Zod validation (`react-hook-form` + `zodResolver`)
- Comprehensive form: name, code (lowercase auto-transform), contact, plan,
  status, max users
- Proper loading skeletons matching table layout
- Empty state with descriptive messaging
- Direct navigation to tenant detail on row click

### Issues

| #   | Severity | Issue                                                                                                                                        | Recommendation                                                      |
| --- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| T1  | Medium   | **Table row click navigates to detail, but there's no visual hover cursor** — rows have `hover:bg-muted/50` but no `cursor-pointer` class    | Add `cursor-pointer` to clickable rows                              |
| T2  | Medium   | **Create form doesn't validate uniqueness** of tenant code before submission — code conflicts will fail server-side with a generic error     | Add client-side uniqueness check or improve server error display    |
| T3  | Low      | **Status filter doesn't include "Expired" or "Deactivated"** — the StatusBadge component supports these statuses, but the filter pills don't | Add filter options for all possible statuses                        |
| T4  | Low      | **No bulk operations** — common admin tasks like "suspend all trial tenants" require individual updates                                      | Consider adding multi-select and bulk action buttons                |
| T5  | Low      | **Sort state resets on page change** — there's no URL persistence for sort/filter/search state                                               | Persist filter state in URL params for shareable/bookmarkable views |

---

## 5. Tenant Detail Page

### Strengths

- Back navigation link to tenants list
- Header with tenant name, status badge, edit and delete buttons
- 4 StatCards (Users, Spaces, Exams, Submissions) from `tenantStats`
- Subscription card with plan, limits, expiry, and edit dialog
- Contact card with email, phone (all from tenant data)
- Features grid showing enabled features with toggle icons
- Settings grid showing tenant configuration
- Lifecycle card with deactivate/reactivate and confirmation dialog
- Data export card with collection selection and format choice (CSV/JSON)
- Audit log card with action filter
- Edit dialog with Zod validation
- Delete (deactivate) dialog with type-to-confirm safety pattern

### Issues

| #   | Severity | Issue                                                                                                                                                                                                                        | Recommendation                                                                                          |
| --- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| TD1 | Medium   | **Audit log has basic pagination** — comment says "For simplicity, only show a load-more approach" but the implementation only shows first page with a "Load More" that fetches another batch. No proper pagination controls | Add full `DataTablePagination` consistent with other pages                                              |
| TD2 | Medium   | **Features grid is read-only on this page** — to toggle features, users must navigate to Feature Flags page. No indication of this is shown                                                                                  | Add link "Manage in Feature Flags →" or make features toggleable inline                                 |
| TD3 | Low      | **Settings grid shows raw config values** — e.g., `gradeScale: "percentage"` without labels or formatting                                                                                                                    | Format settings values for human readability                                                            |
| TD4 | Low      | **Data export triggers download but shows no progress** — the export function calls a cloud function and opens a blob URL, but there's no progress indicator for large exports                                               | Add progress indicator or "preparing export..." state                                                   |
| TD5 | Low      | **Delete dialog uses "deactivate" terminology** but the button says "Delete Tenant" — terminology mismatch could confuse admins                                                                                              | Align terminology: use "Deactivate" consistently since the action is a status change, not data deletion |

---

## 6. Global Users Page

### Strengths

- Debounced search input (300ms) for responsive filtering
- Results table with user name, email, memberships, last login, super admin flag
- Membership badges showing tenant code and role
- Row click navigates to tenant detail (for the first membership)
- Proper empty state and loading skeleton
- `isFirebaseAdmin` badge for super admin users

### Issues

| #   | Severity | Issue                                                                                                                                                   | Recommendation                                                                                          |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| GU1 | Medium   | **Row click only navigates to first membership's tenant** — if a user has multiple memberships, clicking the row takes you to the first one arbitrarily | Show a dropdown or modal to choose which tenant to view, or make individual membership badges clickable |
| GU2 | Medium   | **No pagination** — all matching users render at once, which can be slow for large platforms                                                            | Add `DataTablePagination` consistent with other pages                                                   |
| GU3 | Low      | **"Last Login" shows "Never" for users without `lastLoginAt`** — this could mean the data isn't collected rather than the user never logged in          | Distinguish between "No data" and "Never logged in"                                                     |
| GU4 | Low      | **No user detail page** — clicking a user goes to their tenant, not a user-specific view                                                                | Consider adding a user detail modal or page showing all memberships, activity, and permissions          |

---

## 7. User Analytics Page

### Strengths

- 4 StatCards (Total Users, Active 30d, Active 7d, New This Month) with trend
  calculations
- Users by plan breakdown with progress bars showing percentage
- Per-tenant user table with sortable columns and pagination
- Status badges for tenant status
- Comprehensive loading skeletons

### Issues

| #   | Severity | Issue                                                                                                                                          | Recommendation                                                                          |
| --- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| UA1 | Medium   | **No charts or visualizations** — for an "analytics" page, it only shows numbers and tables. No trend lines, growth charts, or cohort analysis | Add Recharts line/area charts for user growth over time, retention, and activity trends |
| UA2 | Low      | **Plan distribution uses `Record<string, number>` without ordering** — plans appear in arbitrary order                                         | Sort plans by user count (descending) for better scanability                            |
| UA3 | Low      | **No date range picker** — metrics are fixed periods (7d, 30d, this month) with no custom range                                                | Add a date range selector for flexible analysis                                         |
| UA4 | Low      | **Per-tenant table shows "active" count but doesn't define what "active" means** — is it login-based, usage-based?                             | Add tooltip or help text explaining the "active" metric definition                      |

---

## 8. Feature Flags Page

### Strengths

- Overview summary grid showing per-flag adoption (enabled/total with progress
  bars)
- Per-tenant flag toggle cards with visual toggle icons
- Pending changes tracking with ring highlight on modified cards
- Save per-tenant with success confirmation animation
- Search by tenant name or code
- Pagination for tenant cards
- 9 well-documented known flags with labels and descriptions

### Issues

| #   | Severity | Issue                                                                                                                                   | Recommendation                                                                            |
| --- | -------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| FF1 | Medium   | **No bulk toggle** — enabling a flag for all tenants requires clicking each tenant individually                                         | Add "Enable for all" / "Disable for all" per flag in the overview section                 |
| FF2 | Medium   | **No undo capability** — after saving, the only way to revert is to toggle flags back manually                                          | Add undo toast ("Saved. Undo?") with a short timeout                                      |
| FF3 | Low      | **Flag toggles don't show what changed** — the pending state highlights the card but doesn't indicate which specific flags were toggled | Add a subtle diff indicator (dot or color) on changed flags                               |
| FF4 | Low      | **Overview summary updates immediately from backend data** but pending (unsaved) changes aren't reflected in the summary                | Either reflect pending changes in summary or add a note "Save changes to update overview" |

---

## 9. System Health Page

### Strengths

- Real-time health checks for 4 services (Auth, Firestore, Functions, AI
  Pipeline)
- Overall status banner (healthy/degraded/down) with color coding
- Per-service cards with status, latency, last checked timestamp
- 30-day uptime history with daily bars and tooltips
- Platform metrics (avg response time, daily active users, errors 24h)
- Manual "Run Checks" button with loading state
- Automatic check on page load

### Issues

| #   | Severity | Issue                                                                                                                                                                                                                                                                   | Recommendation                                                                                                          |
| --- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| SH1 | High     | **System health probe writes data** — `runHealthChecks` calls `callSaveTenant` with empty data to test Functions, and `setDoc` to write health snapshots. This has side effects: it creates `systemHealthHistory` documents and fires Firestore triggers on every check | Use read-only probe endpoints (e.g., a dedicated `healthCheck` callable function) instead of writing to production data |
| SH2 | Medium   | **AI Pipeline probe calls `callCheckAIHealth`** — if this endpoint doesn't exist or isn't deployed, the health check itself fails and may cause confusion                                                                                                               | Add graceful fallback if AI health endpoint is unavailable                                                              |
| SH3 | Medium   | **No auto-refresh** — health data becomes stale immediately. Admin must manually click "Run Checks"                                                                                                                                                                     | Add auto-refresh interval (e.g., every 60s) with manual override                                                        |
| SH4 | Low      | **Uptime history bars are pure visual** — the width and color encoding isn't explained. No legend or scale                                                                                                                                                              | Add a legend explaining color meaning and what constitutes an "outage"                                                  |
| SH5 | Low      | **"Errors (24h)" metric** shows a count but doesn't link to error details or logs                                                                                                                                                                                       | Add link to error log or show recent error messages on click                                                            |

---

## 10. LLM Usage Page

### Strengths

- Month navigation with chevron buttons and formatted display
- 4 StatCards (Total Cost, API Calls, Input Tokens, Output Tokens) with
  formatted numbers
- Recharts BarChart for daily cost trend across the month
- Cost by purpose breakdown with progress bars and percentage
- Per-tenant usage table with budget tracking
- Budget percentage indicator with red highlighting for over-budget tenants
- "Current month" link to quickly return to present
- Loading skeletons for all sections

### Issues

| #   | Severity | Issue                                                                                                                         | Recommendation                                                                      |
| --- | -------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| LU1 | Medium   | **No export capability** — admins can't download usage data for reporting or billing reconciliation                           | Add CSV/PDF export for usage data                                                   |
| LU2 | Medium   | **Budget percentage calculation** uses `budget` field but there's no UI to set budgets — budgets must be configured elsewhere | Add budget configuration in tenant settings or provide a link to where it's managed |
| LU3 | Low      | **Daily cost chart Y-axis format** shows raw numbers without currency symbol                                                  | Add `$` prefix to Y-axis tick formatter                                             |
| LU4 | Low      | **Per-tenant table has no search** — admins must scroll through all tenants to find specific usage                            | Add search filter for tenant name/code                                              |
| LU5 | Low      | **No comparison view** — can't compare month-over-month or tenant-vs-tenant usage                                             | Add month comparison toggle or overlay previous month data on chart                 |

---

## 11. Global Presets Page

### Strengths

- CRUD for evaluation presets with clean card layout
- Create/edit dialog with name and description fields
- Dimension configuration with checkboxes and weight inputs
- 6 default dimensions (Knowledge, Application, Analysis, Communication,
  Creativity, Effort)
- Delete confirmation dialog
- Loading skeletons and empty state
- Success/error toast feedback

### Issues

| #   | Severity | Issue                                                                                                                                                                      | Recommendation                                                                             |
| --- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| GP1 | Medium   | **No validation on dimension weights** — weights can be any number including 0, negative, or very large values. No constraint that weights should sum to 100 or any target | Add validation: weights must be positive, and optionally show sum with warning if not 100% |
| GP2 | Medium   | **No indication which tenants use a preset** — deleting a preset that's in use could break tenant evaluations                                                              | Show usage count and warn before deleting an in-use preset                                 |
| GP3 | Low      | **Dimension weight input is `type="number"` with `step={0.1}`** but allows free-form input — users can type "abc" (handled by browser) but the UX is unclear               | Add explicit min/max/step attributes and validation message                                |
| GP4 | Low      | **No drag-to-reorder** for dimensions — the order is fixed alphabetically                                                                                                  | Add drag handles if dimension order matters for display                                    |

---

## 12. Announcements Page

### Strengths

- Tabbed status filter (All, Draft, Published, Archived)
- Table with title, status badge, author, created date, expiry
- Create/edit dialog with title, body, and optional expiry date
- Status workflow: Draft → Published → Archived
- Delete confirmation with AlertDialog
- Contextual action buttons per status (Edit/Publish for draft, Archive for
  published)
- Empty state with contextual messaging per filter
- Pagination with DataTablePagination
- Loading skeletons matching table layout

### Issues

| #   | Severity | Issue                                                                                                                                        | Recommendation                                                         |
| --- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| AN1 | Medium   | **No publish confirmation** — clicking "Publish" immediately publishes without preview or confirmation. This is a destructive/visible action | Add confirmation dialog: "This will be visible to all users. Publish?" |
| AN2 | Medium   | **No rich text editor** — body is a plain `<Textarea>`. Announcements can't include links, formatting, or images                             | Add a markdown editor or basic rich text (bold, links, lists)          |
| AN3 | Low      | **Expiry date has no minimum** — users can set past dates as expiry                                                                          | Add `min={new Date().toISOString().split('T')[0]}` to the date input   |
| AN4 | Low      | **No preview** — admins can't see how the announcement will appear to end users before publishing                                            | Add a "Preview" button in the dialog showing rendered output           |
| AN5 | Low      | **Table action buttons overflow on small screens** — the Actions column has multiple buttons that can wrap                                   | Use a dropdown menu (DropdownMenu) for actions on narrow viewports     |

---

## 13. Settings Page

### Strengths

- Platform announcement textarea with save
- Default features section with 7 toggle switches and descriptions
- Maintenance mode toggle with confirmation dialog (AlertDialog)
- Admin account display with email and role
- Individual save buttons per section
- Success/error toast feedback

### Issues

| #   | Severity | Issue                                                                                                                                                               | Recommendation                                                                         |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| SE1 | Medium   | **Read-only admin fields use `<Input disabled>`** — disabled inputs look interactive but can't be edited, causing confusion. No explanation of why they're disabled | Use plain text display with a label, or add "Managed via Firebase Console" helper text |
| SE2 | Medium   | **No unsaved changes warning** — changing feature toggles and navigating away loses changes silently                                                                | Add `beforeunload` listener or visual dirty-state indicator per section                |
| SE3 | Medium   | **Maintenance mode has no scheduling** — it's an immediate on/off toggle. Admins can't schedule maintenance windows                                                 | Add optional start/end datetime fields for scheduled maintenance                       |
| SE4 | Low      | **Feature toggle switches lack individual `aria-label`** — they rely on adjacent text but the `<Switch>` component itself has no accessible name                    | Add `aria-label` to each Switch matching the feature label                             |
| SE5 | Low      | **"Logout" button placement** at the bottom of settings page is unexpected — it's already in the dashboard page header                                              | Remove from settings (consolidate to one location, preferably sidebar footer)          |

---

## 14. Tenant Detail Sub-Components

### TenantSubscriptionCard

| #   | Severity | Issue                                                                                             | Recommendation                     |
| --- | -------- | ------------------------------------------------------------------------------------------------- | ---------------------------------- |
| SC1 | Low      | **Expiry date shows raw ISO string** for `subscription.expiresAt` — not formatted for readability | Format with `toLocaleDateString()` |
| SC2 | Low      | **Edit dialog doesn't validate maxUsers > 0**                                                     | Add min validation                 |

### TenantLifecycleCard

| #   | Severity | Issue                                                                                                                           | Recommendation                            |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| LC1 | Medium   | **Reactivation has no confirmation dialog** — only deactivation does. Reactivation should also confirm since it restores access | Add confirmation for reactivation as well |

### TenantDataExportCard

| #   | Severity | Issue                                                                                                        | Recommendation                                                            |
| --- | -------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| DE1 | Medium   | **Export downloads entire collections** with no size warning — large tenants could have massive data exports | Show estimated size or record count before export, add progress indicator |

### EditTenantDialog

- Well-implemented with Zod validation, proper form state management
- No significant issues

### DeleteTenantDialog

| #   | Severity | Issue                                                                                                                   | Recommendation                                              |
| --- | -------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| DT1 | Low      | **Type-to-confirm uses tenant code** but label says "Type the tenant code to confirm" without showing what code to type | Show the tenant code prominently so users know what to type |

### TenantAuditLogCard

| #   | Severity | Issue                                                                                                             | Recommendation                             |
| --- | -------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| AL1 | Medium   | **Only loads first batch** — "Load more" fetches one more batch but there's no way to go back or know total count | Add proper pagination with total count     |
| AL2 | Low      | **Action filter uses raw action strings** like `tenant.created` — not formatted for readability                   | Use human-readable labels for action types |

---

## 15. Cross-Cutting UX Concerns

| #   | Severity | Issue                                                                                                                                                                                               | Recommendation                                                                            |
| --- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| X1  | High     | **No offline handling** — unlike parent-web which has `OfflineBanner`, super-admin has no offline detection or messaging. Failed fetches show as errors with no offline context                     | Add `OfflineBanner` component (already in shared-ui) and offline-aware error states       |
| X2  | High     | **Recharts charts are not accessible** — all charts (BarChart, PieChart in Dashboard; BarChart in LLM Usage) lack screen reader descriptions, keyboard navigation, and data table alternatives      | Add `aria-label` to chart containers, provide visually-hidden data tables as alternatives |
| X3  | Medium   | **Inconsistent error handling patterns** — some pages use `Alert` with retry (FeatureFlagsPage), some use toast only (SettingsPage), some show inline messages (DashboardPage). No unified approach | Standardize: use `Alert` for page-level errors with retry, toast for action feedback      |
| X4  | Medium   | **No `PWAInstallBanner`** — parent-web has this but super-admin doesn't. While less critical for a admin tool, it could still benefit from PWA install prompts                                      | Add `PWAInstallBanner` if the app is intended for regular use on mobile                   |
| X5  | Medium   | **Theme toggle not accessible on mobile** — ThemeToggle is in header right which collapses. No alternative access path on mobile                                                                    | Add theme toggle to mobile sidebar or settings page                                       |
| X6  | Low      | **Console-style technical data exposed** — tenant codes, user UIDs, raw Firestore timestamps appear in various places                                                                               | Format all technical data for human readability                                           |
| X7  | Low      | **No keyboard shortcuts** — a power-user admin tool would benefit from shortcuts (e.g., `/` to search, `n` for new tenant)                                                                          | Add keyboard shortcut overlay and common shortcuts                                        |

---

## 16. Accessibility Summary

### Good

- `SkipToContent` component for keyboard users
- `RouteAnnouncer` for screen reader page change announcements
- `role="alert"` on error messages
- Breadcrumb navigation with proper labeling
- Loading skeletons provide visual placeholder
- Confirmation dialogs for destructive actions
- `aria-hidden="true"` on decorative icons

### Needs Improvement

- **Charts**: All Recharts visualizations need `aria-label`, `<desc>`, and data
  table alternatives
- **Switches**: Toggle switches (Feature Flags, Settings) need explicit
  `aria-label` attributes
- **Tables**: Sortable column headers should use `aria-sort` attribute
- **Progress bars**: LLM usage and analytics progress bars need `aria-label`
  with value description
- **Color dependence**: Status badges and health status indicators use color
  alone — add icon or text differentiation
- **Focus management**: Dialog open/close doesn't always return focus to trigger
  element
- **Mobile**: Bottom nav items need `aria-current="page"` for active state

---

## Priority Recommendations (Top 5)

1. **Fix system health probes** — replace write-based probes with read-only
   health check endpoints to avoid side effects in production (SH1)
2. **Add chart accessibility** — all Recharts visualizations need screen reader
   support with `aria-label` and data table fallbacks (X2, D2)
3. **Add mobile navigation "More" menu** — 6 of 10 pages are unreachable from
   mobile bottom nav (N1)
4. **Add offline detection** — import `OfflineBanner` from shared-ui and add
   offline-aware error states (X1)
5. **Polish authentication flow** — add password visibility toggle, forgot
   password, and autoComplete attributes to match parent-web quality (A1, A2,
   A3)

---

## Finding Severity Summary

| Severity     | Count | Key Areas                                                                                                           |
| ------------ | ----- | ------------------------------------------------------------------------------------------------------------------- |
| **Critical** | 0     | —                                                                                                                   |
| **High**     | 5     | Login flow gaps (A1, A2), mobile nav (N1), health probes side effects (SH1), chart a11y (X2), offline handling (X1) |
| **Medium**   | 22    | Charts, notifications, pagination, export, validation, error consistency                                            |
| **Low**      | 24    | Formatting, labels, minor UX polish, keyboard shortcuts                                                             |
| **Total**    | 51    |                                                                                                                     |
