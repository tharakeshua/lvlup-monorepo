# UI/UX Audit: Admin-Web Application

**Date:** March 2026 **Auditor:** UI/UX Designer Agent **App Path:**
`apps/admin-web/` **Tech Stack:** React 18, Vite, Tailwind CSS, shadcn/ui
(shared-ui), Firebase, React Router v7, TanStack React Query, Lucide Icons,
react-hook-form, zod

---

## Executive Summary

The Admin-Web application serves as the **school administration dashboard** for
the LevelUp educational platform. It provides tenant administrators with tools
to manage users, classes, exams, learning spaces, academic sessions, analytics,
AI usage monitoring, reports, notifications, and settings.

### Overall Assessment: **6.5/10**

The app is **functional and well-structured** with a clean sidebar-based layout
pattern, consistent page headers, and good use of the shared component library.
However, it suffers from **significant UX gaps** that reduce admin efficiency,
accessibility compliance shortfalls, inconsistent component usage across pages,
missing dark mode support, no pagination on data tables, and limited feedback
mechanisms.

### Key Strengths

- Clean sidebar navigation with 4 logical groups (Overview, Management,
  Analytics, Configuration)
- Good use of shared-ui components (Table, Dialog, Badge, EntityPicker,
  BulkImportDialog)
- Consistent page header pattern (title + description + action button)
- Multi-tenant support with RoleSwitcher component
- Real-time notification system with bell icon and full page

### Critical Issues

1. **No dark mode support** — `index.css` only defines `:root` light theme; no
   `.dark` class
2. **No pagination** — All data tables load entire dataset; will not scale
3. **Mixed component usage** — Some pages use shared-ui `<Table>`, others use
   raw `<table>`
4. **Missing loading states** — Text-only "Loading..." with no skeleton screens
5. **No error boundaries per-page** — Single top-level ErrorBoundary, but no
   per-route error handling
6. **Accessibility gaps** — Missing ARIA labels on charts, custom buttons lack
   focus indicators, forms missing field descriptions

---

## 1. Architecture & Routing Analysis

### Router Configuration (`App.tsx`)

```
/login          → LoginPage (AuthLayout)
/               → DashboardPage (AppLayout, RequireAuth[tenantAdmin])
/users          → UsersPage
/classes        → ClassesPage
/exams          → ExamsOverviewPage
/spaces         → SpacesOverviewPage
/courses        → CoursesPage
/analytics      → AnalyticsPage
/reports        → ReportsPage
/ai-usage       → AIUsagePage
/academic-sessions → AcademicSessionPage
/settings       → SettingsPage
/notifications  → NotificationsPage
*               → NotFoundPage
```

**Issues Found:**

- **No nested routes** — All pages are flat siblings under AppLayout. Pages like
  `/users/:id` for user detail views don't exist.
- **No lazy loading** — All 13 page components are eagerly imported in
  `App.tsx`. Should use `React.lazy()` for code splitting.
- **No route-level error boundaries** — A crash on any page crashes the entire
  app shell.
- **RequireAuth loading state is bare** — Shows only "Loading..." text centered
  on screen. Should show a branded loading screen or the app shell with a
  skeleton.

### Recommendations:

1. Add `React.lazy()` + `Suspense` for all page imports with skeleton fallbacks
2. Add route-level `ErrorBoundary` wrappers per page/section
3. Add detail routes: `/users/:id`, `/classes/:id`, `/exams/:id`, `/spaces/:id`
4. Add breadcrumb support using the AppShell `pageTitle` prop (currently unused)

---

## 2. Layout & Navigation (`AppLayout.tsx`)

### Current State

The app uses the shared `AppShell` + `AppSidebar` pattern with 4 navigation
groups:

| Group         | Items                                  |
| ------------- | -------------------------------------- |
| Overview      | Dashboard                              |
| Management    | Users, Classes, Exams, Spaces, Courses |
| Analytics     | Analytics, Reports, AI Usage           |
| Configuration | Academic Sessions, Settings            |

**Header:** Contains a `NotificationBell` component with popover dropdown.

**Sidebar Footer:** Contains `RoleSwitcher` (multi-tenant switcher) and a user
info line showing `displayName` or `email`.

### Issues Found:

| #   | Severity | Issue                                                                                                                                                           | Location                  |
| --- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| 1   | Major    | **No user avatar or profile link** — Sidebar footer shows only a plain text name with no avatar, dropdown, or link to profile/settings                          | `AppLayout.tsx:170-172`   |
| 2   | Major    | **No logout in sidebar** — Logout button is on the Dashboard page instead of the sidebar/header. Admin has to navigate to Dashboard to sign out                 | `DashboardPage.tsx:80-85` |
| 3   | Minor    | **No active indicator animation** — Active nav items use `isActive` boolean but no visual transition or left-border indicator                                   | `AppLayout.tsx:48-52`     |
| 4   | Minor    | **Notification bell has no empty state** — When there are 0 notifications, bell popover opens to a list with no items; should show "All caught up!" empty state | `AppLayout.tsx:186-200`   |
| 5   | Minor    | **Tenant name fetching is N+1** — Each non-current tenant name is fetched individually with `getDoc()`; should use batch or `getDocs`                           | `AppLayout.tsx:144-151`   |
| 6   | Info     | **AppShell `pageTitle` prop unused** — Breadcrumb navigation is available but not configured                                                                    | `AppLayout.tsx:204`       |

### Recommendations:

1. **Move Logout to sidebar footer** with a user dropdown menu (avatar, name,
   email, settings link, logout)
2. **Add breadcrumbs** by passing route-derived `pageTitle` to AppShell
3. **Add keyboard shortcuts** for common admin actions (Ctrl+K for search, etc.)
4. **Add a command palette** (the shared-ui already includes `cmdk`) for
   power-user navigation

---

## 3. Page-by-Page Analysis

### 3.1 Login Page (`LoginPage.tsx`)

**Flow:** Two-step login — (1) Enter school code → (2) Enter credentials.

**Current State:**

- Manual HTML `<input>` elements with inline Tailwind classes instead of
  shared-ui `<Input>` component
- Manual `<button>` instead of shared-ui `<Button>` component
- No "Forgot Password" link
- No input validation feedback beyond basic error banner
- No password visibility toggle
- No auto-focus on first input
- No branding (logo, school name, colors)

**Issues:**

| #   | Severity | Issue                                                                                                     |
| --- | -------- | --------------------------------------------------------------------------------------------------------- |
| 1   | Critical | **Uses raw HTML inputs** instead of shared-ui `<Input>` component — inconsistent styling with rest of app |
| 2   | Critical | **No "Forgot Password" flow** — Admin cannot reset password                                               |
| 3   | Major    | **No branding** — Generic "School Admin" title with no logo or school-specific theming                    |
| 4   | Major    | **No password visibility toggle** — Password field has no show/hide button                                |
| 5   | Minor    | **No auto-focus** — User must click into first input                                                      |
| 6   | Minor    | **Error messages are not associated** with specific fields via `aria-describedby`                         |
| 7   | Minor    | **No loading skeleton** during school code validation — just button text change                           |

**Recommendations:**

1. Replace all `<input>` with shared-ui `<Input>` and `<button>` with `<Button>`
2. Add school logo display after code validation (step 2)
3. Add "Forgot Password" link with reset flow
4. Add password visibility toggle using an `Eye`/`EyeOff` icon button
5. Add `autoFocus` to first input in each step
6. Add proper form validation with `react-hook-form` + `zod`

---

### 3.2 Dashboard Page (`DashboardPage.tsx`)

**Current State:**

- 6-column ScoreCard grid (Students, Teachers, Classes, Spaces, Exams, At-Risk)
- Class Performance bar chart
- AI Cost summary card (today's spend and calls)
- Tenant Info card (code, plan, status, contact)
- Features toggle grid

**Issues:**

| #   | Severity | Issue                                                                                                                                                            |
| --- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Critical | **LogoutButton is on the Dashboard** — Should be in the sidebar/header globally, not on a specific page                                                          |
| 2   | Major    | **No time-range selector** for dashboard data — Shows only "today" for AI costs; no weekly/monthly trend                                                         |
| 3   | Major    | **6-column ScoreCard grid on mobile** — `md:grid-cols-3 lg:grid-cols-6` means on mobile all 6 cards stack vertically; too many cards                             |
| 4   | Major    | **Class Performance chart conditional** — `{classChartData.length > 0 && ...}` means the chart section disappears entirely when no data; should show empty state |
| 5   | Minor    | **Hardcoded green/gray colors for features** — `bg-green-500` and `bg-gray-300` not theme-aware                                                                  |
| 6   | Minor    | **No links to drill-down pages** — ScoreCard values are not clickable to navigate to Users, Classes, etc.                                                        |
| 7   | Minor    | **No refresh/last-updated indicator** — Admin cannot tell how fresh the data is                                                                                  |

**Recommendations:**

1. Move LogoutButton to sidebar footer dropdown
2. Make ScoreCards clickable links (Students → /users, Classes → /classes, etc.)
3. Add date range picker for AI cost trends (7d/30d/custom)
4. Add "Quick Actions" section: "Add Teacher", "Create Class", "View Reports"
5. Add empty states for chart sections
6. Add 2-column grid on mobile for ScoreCards instead of single column

---

### 3.3 Users Page (`UsersPage.tsx`)

**Current State:**

- Tabbed view: Teachers / Students / Parents (with counts)
- Search input per tab
- Data tables with columns per user type
- Create User dialog (role-dependent fields)
- Bulk Import dialog (students only)
- Assign Class dialog (EntityPicker)
- Link Parent dialog (EntityPicker)
- Edit Parent dialog

**This is the most complex page in the app (660 lines).** It handles 3 entity
types, 5 dialogs, and multiple CRUD operations.

**Issues:**

| #   | Severity | Issue                                                                                              |
| --- | -------- | -------------------------------------------------------------------------------------------------- |
| 1   | Critical | **No pagination** — All teachers/students/parents loaded at once. Will break with 1000+ students   |
| 2   | Critical | **No column sorting** — Tables cannot be sorted by name, status, etc.                              |
| 3   | Major    | **Monolithic component** — 660 lines with 15+ state variables. Should be split into sub-components |
| 4   | Major    | **No user detail view** — Can only see table row data; no profile page for individual users        |
| 5   | Major    | **No delete/deactivate user** — Can only create and edit; no way to remove users                   |
| 6   | Major    | **No error handling in CRUD** — `handleCreate` catches error but doesn't display it to user        |
| 7   | Major    | **Unused `_studentItems`** variable — Declared but prefixed with underscore; dead code             |
| 8   | Minor    | **Teachers tab: Pencil button only opens Assign Class** — Misleading; should open full edit dialog |
| 9   | Minor    | **No export functionality** — Cannot export user lists to CSV                                      |
| 10  | Minor    | **No bulk actions** — Cannot select multiple users for bulk operations (assign class, deactivate)  |
| 11  | Minor    | **Search resets on tab change** — Intentional but may confuse users who expect persistent search   |

**Recommendations:**

1. Add server-side pagination (or virtualized lists with
   `@tanstack/react-virtual`)
2. Add sortable column headers using shared-ui `Table` with sort indicators
3. Extract to sub-components: `TeachersTab`, `StudentsTab`, `ParentsTab`,
   `CreateUserDialog`, etc.
4. Add user detail pages: `/users/teachers/:id`, `/users/students/:id`
5. Add deactivate/archive functionality
6. Add toast notifications for CRUD success/failure using `sonner`
7. Add bulk selection with checkbox column and bulk actions bar

---

### 3.4 Classes Page (`ClassesPage.tsx`)

**Current State:**

- Search + Grade filter
- Table with Name, Grade, Section, Teachers count, Students count, Status,
  Actions
- Create/Edit/Archive dialogs
- Assign Teachers/Students dialogs (EntityPicker)

**Issues:**

| #   | Severity | Issue                                                                                                                     |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------- |
| 1   | Major    | **No class detail view** — Cannot see student roster, assigned spaces, or exam results per class                          |
| 2   | Major    | **No pagination** on classes table                                                                                        |
| 3   | Major    | **handleAssignStudents N+1** — Updates each student individually with `mutateAsync` in a loop; should use batch operation |
| 4   | Minor    | **Student count shows `cls.studentCount`** — May be stale; should derive from actual student data or show both            |
| 5   | Minor    | **Archive action has no undo** — Once archived, no way to restore from this page                                          |
| 6   | Minor    | **Grade filter uses string values "1"-"12"** — No "Kindergarten" or "Pre-K" option                                        |

**Recommendations:**

1. Add class detail page `/classes/:id` with student roster, teacher list,
   assigned spaces, and exam results
2. Add pagination for the classes table
3. Batch student assignment updates into a single Cloud Function call
4. Add "Restore" capability for archived classes (or a separate "Archived" tab)

---

### 3.5 Exams Overview Page (`ExamsOverviewPage.tsx`)

**Current State:**

- Search + Status filter (pills)
- Raw HTML `<table>` instead of shared-ui `<Table>` component
- Raw HTML `<input>` instead of shared-ui `<Input>` component
- Columns: Title, Subject, Total Marks, Status, Created By
- Status pills with hardcoded color maps

**Issues:**

| #   | Severity | Issue                                                                                                                         |
| --- | -------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1   | Critical | **Uses raw `<table>` and `<input>`** instead of shared-ui components — breaks design consistency                              |
| 2   | Major    | **Read-only overview** — Admin cannot manage exams (no edit, no status change, no detail view)                                |
| 3   | Major    | **"Created By" shows truncated UID** — `exam.createdBy?.slice(0, 8)` shows a meaningless hash; should resolve to teacher name |
| 4   | Major    | **No pagination**                                                                                                             |
| 5   | Minor    | **Status colors hardcoded** — `bg-gray-100 text-gray-700` etc. not theme-aware for dark mode                                  |
| 6   | Minor    | **No exam statistics** — No summary cards showing total exams by status, average scores, etc.                                 |

**Recommendations:**

1. Replace raw HTML with shared-ui `<Table>`, `<Input>`, `<Badge>` components
2. Add exam detail view `/exams/:id` showing results, student submissions,
   statistics
3. Resolve `createdBy` UID to teacher display name
4. Add summary stats at top (total exams, by status breakdown, avg score across
   completed)
5. Add date column (created date, scheduled date)

---

### 3.6 Spaces Overview Page (`SpacesOverviewPage.tsx`)

**Current State:**

- Search + Status filter pills
- Card grid layout (3 columns on large screens)
- Cards show: title, status badge, description (2 lines), type badge, subject
  badge, class/teacher counts

**Issues:**

| #   | Severity | Issue                                                                                          |
| --- | -------- | ---------------------------------------------------------------------------------------------- |
| 1   | Major    | **Uses raw `<input>` and `<button>`** — Same as Exams page; inconsistent with shared-ui        |
| 2   | Major    | **No detail view** — Cannot drill into a space to see content, progress, or student engagement |
| 3   | Minor    | **Status/Type colors hardcoded** — Not theme-aware                                             |
| 4   | Minor    | **No sort options** — Can only filter by status; cannot sort by title, date, etc.              |
| 5   | Minor    | **No admin actions** — Admin can only view; cannot archive, publish, or reassign spaces        |

**Recommendations:**

1. Replace raw elements with shared-ui components
2. Add space detail page with content tree, student progress, and class
   assignments
3. Add sort dropdown (by title, date created, status)
4. Add admin actions: archive, change status, reassign to classes

---

### 3.7 Courses Page (`CoursesPage.tsx`)

**Current State:**

- Subject overview cards (summary counts)
- Search + Class filter + Status filter
- List layout with course cards showing: title, status/type badges, description,
  assigned classes, metadata

**Issues:**

| #   | Severity | Issue                                                                                                                                                                                |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Minor    | **Overlaps significantly with Spaces Overview** — Both show the same data (spaces). The "Courses" page adds class filtering and subject grouping but is essentially a duplicate view |
| 2   | Minor    | **No progress metrics** — Unlike Analytics page, doesn't show completion rates per course                                                                                            |
| 3   | Minor    | **Status/Type color maps duplicated** — Same `STATUS_COLORS` and `TYPE_COLORS` objects defined in both `SpacesOverviewPage` and `CoursesPage`                                        |

**Recommendations:**

1. **Consolidate Spaces and Courses into one page** or clearly differentiate
   their purpose (e.g., Spaces = teacher view, Courses = curriculum view)
2. Extract `STATUS_COLORS` and `TYPE_COLORS` into shared constants
3. Add progress metrics (completion %, student engagement)

---

### 3.8 Analytics Page (`AnalyticsPage.tsx`)

**Current State:**

- 4 ScoreCards: Avg Exam Score, Avg Space Completion, At-Risk Students, Total
  Students
- 2 bar charts: Exam Performance by Class, Space Completion by Class
- At-Risk Students by Class bar chart
- Class Detail drill-down: class selector pills, then detail cards showing
  ProgressRing, student count, at-risk count, completion rate, top/bottom
  performers

**This is the best-designed page in the app.** Good data visualization,
drill-down capability, and visual hierarchy.

**Issues:**

| #   | Severity | Issue                                                                                            |
| --- | -------- | ------------------------------------------------------------------------------------------------ |
| 1   | Major    | **No date range filtering** — Shows all-time data; admin cannot compare time periods             |
| 2   | Major    | **Top/Bottom performer lists use hardcoded colors** — `bg-green-50`, `bg-red-50` not theme-aware |
| 3   | Minor    | **`_exams` variable unused** — Line 26: `const _exams = useExams(tenantId)` — dead code          |
| 4   | Minor    | **No data export** — Cannot export analytics data to CSV/PDF                                     |
| 5   | Minor    | **ProgressRing lacks ARIA attributes** — Not accessible to screen readers                        |
| 6   | Minor    | **SimpleBarChart lacks ARIA attributes** — Not accessible to screen readers                      |

**Recommendations:**

1. Add date range picker (this week / this month / this semester / custom)
2. Add comparison view (compare two classes side-by-side)
3. Remove unused `_exams` import
4. Add export to PDF/CSV
5. Add trend lines (how has performance changed over time?)

---

### 3.9 AI Usage Page (`AIUsagePage.tsx`)

**Current State:**

- Month selector (< current month >)
- 4 ScoreCards: Monthly Cost, Total Calls, Input Tokens, Output Tokens
- Daily Cost Trend bar chart
- Cost by Task Type bar chart
- Daily Breakdown table (Date, Calls, Input Tokens, Output Tokens, Cost)

**Well-designed page with good data drill-down.** The month navigation is
intuitive.

**Issues:**

| #   | Severity | Issue                                                                                    |
| --- | -------- | ---------------------------------------------------------------------------------------- |
| 1   | Major    | **Uses raw `<table>`** instead of shared-ui `<Table>` — inconsistent                     |
| 2   | Major    | **Purpose chart uses hardcoded hex colors** — `#3b82f6`, `#22c55e`, etc. not theme-aware |
| 3   | Minor    | **Month navigation arrows are raw `<button>`** — Inconsistent with shared-ui `<Button>`  |
| 4   | Minor    | **No budget/threshold alerts** — Admin cannot set spending limits or get warnings        |
| 5   | Minor    | **No cost comparison** — Cannot compare this month vs. last month                        |
| 6   | Minor    | **Cost precision varies** — ScoreCard shows 2 decimal places, table shows 4              |

**Recommendations:**

1. Replace raw table with shared-ui `<Table>`
2. Add budget threshold settings and visual alert when approaching limit
3. Add month-over-month comparison indicator
4. Add cost per student metric
5. Consistent cost formatting (2 or 4 decimal places, not both)

---

### 3.10 Reports Page (`ReportsPage.tsx`)

**Current State:**

- Tab switcher: Exam Reports / Class Reports
- Card list with exam/class name and "Download PDF" button
- Uses custom `useClasses` hook (duplicated from shared-hooks)

**Issues:**

| #   | Severity | Issue                                                                                                       |
| --- | -------- | ----------------------------------------------------------------------------------------------------------- |
| 1   | Major    | **Duplicated `useClasses` hook** — Defined locally instead of using `@levelup/shared-hooks/queries`         |
| 2   | Major    | **Tab component is custom HTML** — Uses raw `<button>` with border-bottom instead of shared-ui `<Tabs>`     |
| 3   | Major    | **No report preview** — Only download option; cannot preview before downloading                             |
| 4   | Minor    | **No batch download** — Cannot download multiple reports at once                                            |
| 5   | Minor    | **No report generation history** — Cannot see previously generated reports                                  |
| 6   | Minor    | **Limited report types** — Only exam summary and class report; no student progress report, attendance, etc. |

**Recommendations:**

1. Remove local `useClasses` hook; import from `@levelup/shared-hooks/queries`
2. Replace custom tabs with shared-ui `<Tabs>`
3. Add report preview modal before download
4. Add report generation history/queue
5. Add more report types: student progress, attendance, grade distribution

---

### 3.11 Settings Page (`SettingsPage.tsx`)

**Current State:**

- Custom tab switcher (Tenant Settings / Evaluation Settings / API Keys)
- Tenant Settings: inline-edit form for school name, code, email, phone;
  subscription display
- Evaluation Settings: list of rubric configs with dimension toggles
- API Keys: Gemini API key management (set/update/remove)

**Issues:**

| #   | Severity | Issue                                                                                                                                                                             |
| --- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Major    | **Uses raw HTML inputs and buttons** — Not using shared-ui components                                                                                                             |
| 2   | Major    | **Custom tabs instead of shared-ui `<Tabs>`** — Inconsistent styling                                                                                                              |
| 3   | Major    | **No form validation** — Email field accepts any text; phone field has no format validation                                                                                       |
| 4   | Major    | **API key handling** — Dynamic import of `firebase/firestore` inside `handleSaveEval` is a code smell; eval settings editing directly writes to Firestore bypassing service layer |
| 5   | Minor    | **No success toast** — No confirmation after saving settings                                                                                                                      |
| 6   | Minor    | **Tenant code is read-only** — This is correct, but no copy-to-clipboard button                                                                                                   |
| 7   | Minor    | **No danger zone** — No section for destructive actions (delete tenant, export data, etc.)                                                                                        |

**Recommendations:**

1. Replace all raw inputs with shared-ui `<Input>`, `<Label>`, `<Button>`
2. Replace custom tabs with shared-ui `<Tabs>`
3. Add `react-hook-form` + `zod` validation for settings forms
4. Add toast notifications for save success/failure
5. Add copy-to-clipboard for tenant code
6. Move Firestore write to a service function

---

### 3.12 Academic Sessions Page (`AcademicSessionPage.tsx`)

**Current State:**

- "Current Session" highlight card with Calendar icon
- Sessions table: Name, Start Date, End Date, Current, Status, Actions
- Create/Edit dialogs with name, dates, and "set as current" switch

**Best use of shared-ui components among all pages.** Uses Card, Table, Dialog,
Button, Input, Label, Switch, Badge — all from shared-ui.

**Issues:**

| #   | Severity | Issue                                                                                                             |
| --- | -------- | ----------------------------------------------------------------------------------------------------------------- |
| 1   | Minor    | **No delete session** — Can only create and edit; cannot remove sessions                                          |
| 2   | Minor    | **Date formatting** — Custom `formatDate` function handles Firestore Timestamps but doesn't use locale formatting |
| 3   | Minor    | **No end date validation** — Can set end date before start date                                                   |
| 4   | Minor    | **No term/semester sub-divisions** — Only supports top-level sessions; no nested terms                            |

**Recommendations:**

1. Add delete/archive for sessions
2. Use `Intl.DateTimeFormat` for locale-aware date formatting
3. Add date validation (end > start)
4. Add support for terms within academic sessions

---

### 3.13 Notifications Page (`NotificationsPage.tsx`)

**Current State:**

- Thin wrapper around shared-ui `<NotificationsPageUI>` component
- Passes notifications, filters, and callbacks

**Clean delegation to shared component.** This is the ideal pattern — page
handles data fetching and routing, shared component handles UI.

**Issues:**

| #   | Severity | Issue                                                                                        |
| --- | -------- | -------------------------------------------------------------------------------------------- |
| 1   | Minor    | **No "load more" callback wired up** — `data?.hasMore` is passed but no `onLoadMore` handler |
| 2   | Minor    | **No notification preferences** — Admin cannot configure which notifications to receive      |

**Recommendations:**

1. Implement `onLoadMore` for pagination
2. Add notification preferences in Settings page

---

## 4. Cross-Cutting Issues

### 4.1 Component Consistency

**Pages using shared-ui components correctly:**

- UsersPage, ClassesPage, AcademicSessionPage, NotificationsPage, CoursesPage

**Pages using raw HTML instead of shared-ui:**

- LoginPage (all inputs and buttons)
- ExamsOverviewPage (table and input)
- SpacesOverviewPage (input and buttons)
- SettingsPage (inputs, buttons, tabs)
- AIUsagePage (table and buttons)
- ReportsPage (tabs)
- DashboardPage (feature status dots)

**Impact:** Inconsistent styling, missed dark mode support, duplicated CSS,
harder maintenance.

**Recommendation:** Enforce a lint rule or code review checklist: "No raw
`<input>`, `<button>`, `<table>` elements — always use shared-ui."

### 4.2 Dark Mode

**Current state: NOT SUPPORTED.**

`index.css` defines only `:root` light theme variables. There is no `.dark`
class with dark-mode color values.

**Impact:** Many admin users prefer dark mode for long sessions. The platform
feels incomplete without it.

**Recommendation:**

1. Add `.dark` theme variables to `index.css`
2. Add theme toggle to sidebar/header using `next-themes`
3. Replace all hardcoded colors (`bg-green-500`, `bg-red-50`, `#3b82f6`) with
   theme-aware CSS variables

### 4.3 Loading States

**Current pattern:** Most pages show plain text "Loading..." centered in the
content area.

**Issues:**

- No visual skeleton screens
- Layout shifts when data loads (cards appear, table appears, etc.)
- RequireAuth guard shows only "Loading..." text

**Recommendation:**

1. Create `PageSkeleton` component with header + card/table skeleton
2. Create `TableSkeleton` component with animated rows
3. Create `CardGridSkeleton` component with card placeholders
4. Use these in each page's loading state

### 4.4 Error Handling

**Current pattern:** Most async operations use `try/finally` but don't display
errors to the user.

**Issues:**

- `handleCreate` in UsersPage catches but doesn't display error
- `handleBulkImport` doesn't handle errors at all
- No toast notifications for success/failure
- No per-page error boundaries

**Recommendation:**

1. Add `sonner` toast notifications for all CRUD operations
2. Wrap each route in an error boundary component
3. Add error display to all dialogs (show error message above footer buttons)

### 4.5 Pagination

**No page in the admin app implements pagination.** All data is fetched at once.

**Impact:** Performance degradation with large datasets:

- Schools with 500+ students will see slow Users page
- AI Usage daily breakdown for a full month = 31 rows (manageable)
- Exams and Spaces could grow to hundreds

**Recommendation:**

1. Add server-side pagination for Users, Classes, Exams, Spaces
2. Use `@tanstack/react-virtual` for client-side virtualization as an
   alternative
3. Add pagination controls to the shared-ui `<Table>` component

### 4.6 Responsive Design

**Current state:** Desktop-focused with basic responsive grid breakpoints.

**Issues:**

- Dashboard 6-column grid becomes single column on mobile (too many stacked
  cards)
- Data tables are not horizontally scrollable
- Dialog widths not constrained on mobile
- No mobile navigation (sidebar is collapsible but may not work well on mobile)

**Recommendation:**

1. Add `overflow-x-auto` wrapper to all tables
2. Test and fix dialog widths on mobile (max-width constraints)
3. Use 2-column grid for ScoreCards on mobile
4. Test sidebar collapse/expand on mobile devices

### 4.7 Accessibility (WCAG 2.1 AA)

**Critical gaps:**

| Issue                                             | Impact                                             | Pages Affected                           |
| ------------------------------------------------- | -------------------------------------------------- | ---------------------------------------- |
| Charts have no ARIA labels                        | Screen readers cannot interpret chart data         | Dashboard, Analytics, AI Usage           |
| Custom buttons lack `aria-label`                  | Purpose unclear to assistive technology            | Exams, Spaces, Settings, AI Usage        |
| Form inputs without `aria-describedby` for errors | Error messages not programmatically linked         | Login, Users, Settings                   |
| Color-only status indicators                      | Color-blind users cannot distinguish states        | Dashboard features, Analytics performers |
| No skip-to-content link                           | Keyboard users must tab through sidebar every page | All pages                                |
| No focus management on dialog open                | Focus may not move to dialog                       | All dialog-using pages                   |
| Custom tab components not using `role="tablist"`  | Tab semantics lost                                 | Settings, Reports                        |

**Recommendations:**

1. Add `aria-label` to all chart containers describing the data
2. Add `aria-describedby` linking form errors to inputs
3. Add text alongside color indicators (checkmark for enabled, X for disabled)
4. Add skip-to-content link in AppShell
5. Replace all custom tab implementations with shared-ui `<Tabs>` (which has
   proper ARIA)

---

## 5. Design System Compliance

### Shared-UI Component Usage Report

| Component             | Used By                                   | Unused By (should use)                                      |
| --------------------- | ----------------------------------------- | ----------------------------------------------------------- |
| `<Button>`            | Users, Classes, AcademicSessions          | Login, Dashboard, Exams, Spaces, Settings, AIUsage, Reports |
| `<Input>`             | Users, Classes, AcademicSessions, Courses | Login, Exams, Spaces, Settings, AIUsage                     |
| `<Table>`             | Users, Classes, AcademicSessions          | Exams, AIUsage                                              |
| `<Tabs>`              | Users                                     | Settings, Reports (custom implementations)                  |
| `<Badge>`             | Users, Classes, AcademicSessions, Courses | Exams (custom pill), Dashboard (custom dot)                 |
| `<Dialog>`            | Users, Classes, AcademicSessions          | Settings (inline editing)                                   |
| `<Card>`              | AcademicSessions                          | Dashboard, Settings (custom border divs)                    |
| `<Select>`            | Users, Classes, Courses                   | Exams (could add sort/filter)                               |
| `<Switch>`            | AcademicSessions                          | Settings (uses raw checkbox)                                |
| `<ScoreCard>`         | Dashboard, Analytics, AIUsage             | —                                                           |
| `<SimpleBarChart>`    | Dashboard, Analytics, AIUsage             | —                                                           |
| `<ProgressRing>`      | Analytics                                 | —                                                           |
| `<EntityPicker>`      | Users, Classes                            | —                                                           |
| `<BulkImportDialog>`  | Users                                     | —                                                           |
| `<AlertDialog>`       | Classes                                   | Users (should confirm deletes)                              |
| `<DownloadPDFButton>` | Reports                                   | —                                                           |

### Color Usage Issues

**Hardcoded colors found across pages (not theme-aware):**

```
bg-green-500, bg-gray-300          → DashboardPage features
bg-green-100, text-green-700       → Multiple pages (status, performers)
bg-red-50, text-red-600/700        → AnalyticsPage performers
bg-gray-100, text-gray-700         → ExamsOverviewPage, SpacesOverviewPage
bg-blue-100, text-blue-700         → ExamsOverviewPage, SpacesOverviewPage
bg-yellow-100, text-yellow-700     → ExamsOverviewPage
bg-purple-100, text-purple-700     → ExamsOverviewPage, SpacesOverviewPage
bg-orange-100, text-orange-700     → SpacesOverviewPage
bg-teal-100, text-teal-700         → SpacesOverviewPage
bg-pink-100, text-pink-700         → SpacesOverviewPage
#3b82f6, #22c55e, #f59e0b, #8b5cf6 → AIUsagePage chart colors
```

**Recommendation:** Create a semantic color map in the Tailwind config:

```
--status-active, --status-draft, --status-completed, --status-archived
--chart-1, --chart-2, --chart-3, --chart-4, --chart-5
--performer-top, --performer-bottom
```

---

## 6. Redesign Recommendations

### Priority 1: Critical (Do First)

1. **Add dark mode support**
   - Add `.dark` class CSS variables to `index.css`
   - Add theme toggle button in sidebar footer
   - Replace all hardcoded colors with theme variables

2. **Standardize component usage**
   - Replace all raw `<input>`, `<button>`, `<table>` with shared-ui components
   - Replace all custom tab implementations with `<Tabs>`
   - Enforce via ESLint rule

3. **Add pagination to data tables**
   - Start with Users page (most critical for scale)
   - Add to Classes, Exams, Spaces

4. **Move logout to global location**
   - Add user dropdown in sidebar footer: avatar, name, email, settings, logout
   - Remove LogoutButton from DashboardPage

### Priority 2: Major (Next Sprint)

5. **Add skeleton loading states**
   - Create `DashboardSkeleton`, `TableSkeleton`, `CardGridSkeleton`
   - Apply to all pages

6. **Add toast notifications**
   - Integrate `sonner` for success/error toasts
   - Apply to all CRUD operations

7. **Add detail pages**
   - `/users/teachers/:id` — Teacher profile with classes, subjects
   - `/users/students/:id` — Student profile with grades, progress
   - `/classes/:id` — Class detail with roster, performance
   - `/exams/:id` — Exam detail with submissions, statistics

8. **Add breadcrumbs**
   - Wire `pageTitle` prop in AppShell
   - Add route-aware breadcrumb component

9. **Fix login page**
   - Use shared-ui components
   - Add forgot password flow
   - Add school branding after code validation
   - Add password visibility toggle

### Priority 3: Enhancement (Backlog)

10. **Add command palette** (Ctrl+K) for power-user navigation
11. **Add keyboard shortcuts** for common admin actions
12. **Consolidate Spaces and Courses** pages (or clearly differentiate purpose)
13. **Add data export** (CSV) for all tables
14. **Add bulk actions** for user management (multi-select + assign/deactivate)
15. **Remove duplicated code** (useClasses hook in ReportsPage,
    STATUS_COLORS/TYPE_COLORS maps)
16. **Add route-level code splitting** with React.lazy
17. **Add error boundaries per route**
18. **Add budget alerts** to AI Usage page

---

## 7. Admin Dashboard Best Practices Checklist

| Practice                            | Status  | Notes                                                    |
| ----------------------------------- | ------- | -------------------------------------------------------- |
| Sidebar navigation with groups      | Done    | 4 groups, clear labels                                   |
| Dashboard with KPI cards            | Done    | 6 ScoreCards                                             |
| Data tables with sort/filter/search | Partial | Search works; no sort or column filter                   |
| Pagination for large datasets       | Missing | No pagination anywhere                                   |
| CRUD dialogs with confirmation      | Partial | Create/Edit work; no delete confirmation on all entities |
| Bulk operations                     | Partial | Only bulk import for students                            |
| Role-based access control           | Done    | RequireAuth with role check                              |
| Multi-tenant support                | Done    | RoleSwitcher component                                   |
| Notification system                 | Done    | Bell + full page                                         |
| Dark mode                           | Missing | Only light theme                                         |
| Skeleton loading                    | Missing | Text-only loading states                                 |
| Error recovery                      | Missing | No per-page error handling                               |
| Responsive design                   | Partial | Basic breakpoints; not mobile-optimized                  |
| Accessibility                       | Partial | Some ARIA; many gaps in charts and custom elements       |
| Search/Command palette              | Missing | No global search                                         |
| Keyboard shortcuts                  | Missing | No shortcuts defined                                     |
| Data export                         | Missing | Only PDF reports                                         |
| Audit trail                         | Missing | No activity log for admin actions                        |

---

## 8. Implementation Roadmap

### Phase 1: Foundation (1-2 weeks)

- [ ] Add dark mode CSS variables and theme toggle
- [ ] Replace all raw HTML with shared-ui components (Login, Exams, Spaces,
      Settings, AI Usage, Reports)
- [ ] Move LogoutButton to sidebar user dropdown
- [ ] Add `sonner` toast notifications to all CRUD operations
- [ ] Add breadcrumb navigation

### Phase 2: Data & Scale (2-3 weeks)

- [ ] Add pagination to Users, Classes, Exams, Spaces tables
- [ ] Add sortable columns to all data tables
- [ ] Add skeleton loading components and apply to all pages
- [ ] Add route-level error boundaries
- [ ] Add React.lazy code splitting

### Phase 3: Detail Views (2-3 weeks)

- [ ] Build Teacher detail page
- [ ] Build Student detail page
- [ ] Build Class detail page
- [ ] Build Exam detail page
- [ ] Add drill-down navigation from Dashboard ScoreCards

### Phase 4: Power Features (2-3 weeks)

- [ ] Add command palette (Ctrl+K)
- [ ] Add bulk selection and bulk actions in Users page
- [ ] Add CSV export for all data tables
- [ ] Add date range filtering on Analytics and AI Usage pages
- [ ] Add budget alerts for AI Usage
- [ ] Consolidate Spaces and Courses pages

### Phase 5: Polish & Accessibility (1-2 weeks)

- [ ] Full WCAG 2.1 AA accessibility audit and fixes
- [ ] Add skip-to-content link
- [ ] Add ARIA labels to all charts and custom components
- [ ] Replace all hardcoded colors with semantic theme variables
- [ ] Add focus management to dialogs
- [ ] Mobile responsive testing and fixes

---

## Appendix: File Inventory

| File                            | Lines | Components Used from shared-ui                                                           |
| ------------------------------- | ----- | ---------------------------------------------------------------------------------------- |
| `App.tsx`                       | 66    | NotFoundPage                                                                             |
| `main.tsx`                      | 37    | ErrorBoundary                                                                            |
| `index.css`                     | 47    | —                                                                                        |
| `layouts/AppLayout.tsx`         | 208   | AppShell, AppSidebar, RoleSwitcher, NotificationBell                                     |
| `layouts/AuthLayout.tsx`        | 11    | —                                                                                        |
| `guards/RequireAuth.tsx`        | 44    | —                                                                                        |
| `lib/utils.ts`                  | 7     | —                                                                                        |
| `pages/LoginPage.tsx`           | 166   | _None (raw HTML)_                                                                        |
| `pages/DashboardPage.tsx`       | 207   | ScoreCard, SimpleBarChart, LogoutButton                                                  |
| `pages/UsersPage.tsx`           | 659   | Button, Input, Label, Badge, Tabs, Dialog, Table, Select, EntityPicker, BulkImportDialog |
| `pages/ClassesPage.tsx`         | 507   | Button, Input, Label, Badge, Dialog, Table, Select, AlertDialog, EntityPicker            |
| `pages/ExamsOverviewPage.tsx`   | 130   | _None (raw HTML)_                                                                        |
| `pages/SpacesOverviewPage.tsx`  | 125   | _None (raw HTML)_                                                                        |
| `pages/CoursesPage.tsx`         | 229   | Badge, Input, Select                                                                     |
| `pages/AnalyticsPage.tsx`       | 292   | ScoreCard, SimpleBarChart, ProgressRing                                                  |
| `pages/AIUsagePage.tsx`         | 239   | ScoreCard, SimpleBarChart                                                                |
| `pages/ReportsPage.tsx`         | 156   | DownloadPDFButton                                                                        |
| `pages/SettingsPage.tsx`        | 524   | _None (raw HTML)_                                                                        |
| `pages/AcademicSessionPage.tsx` | 315   | Button, Input, Label, Badge, Switch, Dialog, Table, Card                                 |
| `pages/NotificationsPage.tsx`   | 41    | NotificationsPage (shared-ui)                                                            |

**Total:** 21 files, ~3,700 lines of source code
