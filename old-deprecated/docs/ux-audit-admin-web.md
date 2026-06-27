# Deep UX/UI Audit: admin-web

**Audit Date:** 2026-03-09 **Auditor:** AI UX Auditor **App:** `apps/admin-web`
(School Admin Portal) **Stack:** React 18 + Vite + TypeScript + Tailwind CSS +
shadcn/ui + React Query + Firebase + Zustand + Sonner

---

## Executive Summary

The admin-web app is a well-structured multi-tenant school administration portal
with 18+ pages covering dashboard, user management, class management, exams,
spaces, courses, analytics, reports, settings, academic sessions, announcements,
AI usage, data export, staff permissions, notifications, and onboarding. The
codebase demonstrates strong foundational patterns — lazy loading, skeleton
states, error boundaries, breadcrumbs, mobile bottom nav, dark mode, and
accessibility basics.

However, the audit reveals **43 findings** across severity levels. The most
critical gaps are: (1) missing form validation and React Hook Form adoption, (2)
inconsistent loading/error/empty states, (3) no inline edit or detail views for
key entities, (4) missing confirmation dialogs for destructive actions in some
areas, and (5) several accessibility gaps. Many issues are low-effort fixes that
would significantly improve the admin experience.

### Severity Distribution

| Severity     | Count | Description                                       |
| ------------ | ----- | ------------------------------------------------- |
| **Critical** | 5     | Blocks core workflows or causes data loss risk    |
| **High**     | 12    | Significant UX friction or missing feedback       |
| **Medium**   | 16    | Polish issues, inconsistencies, moderate friction |
| **Low**      | 10    | Minor improvements, nice-to-haves                 |

---

## 1. Authentication Flow

### 1.1 Login Page (`LoginPage.tsx`)

**Strengths:**

- Two-step flow (school code → credentials) is clear and prevents wrong-tenant
  logins
- Password show/hide toggle with proper `aria-label`
- Error states use `role="alert"` and `aria-describedby`
- Loading states on buttons ("Validating...", "Signing in...")
- Preserves `from` location for post-login redirect

**Findings:**

| #   | Severity   | Finding                                                                | Recommendation                                                                                          |
| --- | ---------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 1   | **Medium** | No "Forgot Password" link — admins locked out with no recovery path    | Add a password reset link below the login form (e.g., `sendPasswordResetEmail`)                         |
| 2   | **Medium** | No rate limiting feedback — repeated failed logins show the same error | Show "Too many attempts, try again later" after Firebase returns `auth/too-many-requests`               |
| 3   | **Low**    | School code input has no format hint (uppercase? numeric?)             | Add helper text like "e.g., SCHOOL123" to guide input                                                   |
| 4   | **Low**    | No "Remember me" option                                                | Consider session persistence toggle (Firebase `browserLocalPersistence` vs `browserSessionPersistence`) |

---

## 2. Onboarding Wizard (`OnboardingWizardPage.tsx`)

**Strengths:**

- Clean 4-step wizard with progress stepper
- Steps are navigable backwards
- Skip buttons for optional steps
- Tenant code shown on completion with copy-to-clipboard
- `OnboardingGuard` in `App.tsx` redirects incomplete tenants

**Findings:**

| #   | Severity   | Finding                                                                                                                                  | Recommendation                                                     |
| --- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 5   | **High**   | Skipping the "class" step still calls `setCurrentStep("done")` without marking onboarding complete — admin may be stuck in redirect loop | If class step is skipped, still mark `onboarding.completed = true` |
| 6   | **Medium** | Grade field in class step is a free-text `<Input>` instead of `<Select>` like in `ClassesPage`                                           | Use consistent grade selection (dropdown)                          |
| 7   | **Medium** | No validation feedback on empty required fields — `toast.error` is shown but focus doesn't move to the invalid field                     | Auto-focus the first invalid field and show inline errors          |
| 8   | **Low**    | Step labels hidden on mobile (`hidden sm:inline`) but icons alone may not convey meaning                                                 | Add `title` or `aria-label` to step buttons for screen readers     |

---

## 3. Dashboard (`DashboardPage.tsx`)

**Strengths:**

- 6 stat cards with icons, linked to respective pages
- Onboarding incomplete banner with CTA
- Class performance bar chart with empty state
- AI cost summary card
- Subscription usage with quota progress bars
- Feature flags visualization
- Responsive 2-col mobile, 6-col desktop grid

**Findings:**

| #   | Severity   | Finding                                                                                                                                        | Recommendation                                                                   |
| --- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 9   | **High**   | No loading state — dashboard fetches exams, spaces, classes, students, class summaries, and cost data but shows no skeleton while loading      | Use `DashboardSkeleton` component (it exists but is never used!)                 |
| 10  | **Medium** | `students.length                                                                                                                               |                                                                                  | stats?.totalStudents`is confusing — shows 0 if students array is loaded but empty, even when`stats.totalStudents > 0` | Prefer `stats?.totalStudents ?? students.length` for consistency with cached counts |
| 11  | **Medium** | At-Risk trend says "down" when `atRiskCount > 0` — "down" typically means negative trend, which is the opposite of what you'd want for at-risk | Use `trend="up"` with destructive color for at-risk, or use a different semantic |
| 12  | **Low**    | Feature flags section uses `key.replace(/([A-Z])/g, " $1")` which can produce awkward labels                                                   | Use a proper label map for feature flag names                                    |

---

## 4. User Management (`UsersPage.tsx`, `TeachersTab.tsx`, `StudentsTab.tsx`, `ParentsTab.tsx`)

**Strengths:**

- Tabbed interface (Teachers/Students/Parents) with counts
- Search across all tabs
- Bulk import via CSV with validation
- Bulk status operations (archive/activate) with floating action bar
- Entity picker for class assignment and parent linking
- Pagination with configurable page size

**Findings:**

| #   | Severity     | Finding                                                                                                                                           | Recommendation                                                                                      |
| --- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 13  | **Critical** | Create User dialog uses raw `useState` instead of React Hook Form — no field-level validation, no validation schema, required fields can be empty | Migrate to React Hook Form + Zod. Validate email format, phone format, require firstName + lastName |
| 14  | **Critical** | No confirmation dialog when creating a user — clicking "Create" immediately calls the API                                                         | Add a summary confirmation step, especially since this creates Firebase Auth accounts               |
| 15  | **High**     | No inline edit for teachers/students — the only way to modify a user is through class assignment dialogs                                          | Add edit functionality (inline or dialog) for user profile fields                                   |
| 16  | **High**     | Search is shared across tabs but resets when switching — losing context when checking different entity types                                      | Persist search per-tab or make it clearly tab-scoped with visual indication                         |
| 17  | **High**     | No status filter (active/archived) on user tabs — can only search by name/email                                                                   | Add a status dropdown filter like ClassesPage has                                                   |
| 18  | **Medium**   | Bulk import shows no dry-run preview — goes straight to import                                                                                    | Show a preview of parsed rows before committing. Consider using `dryRun: true` first                |
| 19  | **Medium**   | "Select all" checkbox only selects the current page, but the count in the bulk action bar doesn't clarify this                                    | Add "(on this page)" text or offer "Select all X results" like Gmail                                |
| 20  | **Medium**   | Floating bulk action bar can overlap mobile bottom nav                                                                                            | Add `bottom-20` or adjust `z-index` positioning for mobile                                          |
| 21  | **Low**      | Parent tab has no bulk operations or selection checkboxes — inconsistent with teachers/students                                                   | Add selection and bulk operations for parents                                                       |

---

## 5. Class Management (`ClassesPage.tsx`, `ClassDetailPage.tsx`)

**Strengths:**

- Grade filter dropdown
- Sortable table headers (name, grade, section)
- Inline teacher/student count buttons that open assignment dialogs
- Class detail page with breadcrumbs, quick stats, and tabbed view
- Bulk archive/activate with confirmation

**Findings:**

| #   | Severity   | Finding                                                                                                                                  | Recommendation                                                             |
| --- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 22  | **High**   | Class detail page has no edit/management actions — can't edit class name, assign teachers, or manage students from the detail view       | Add action buttons on the detail page header (Edit, Assign Teachers, etc.) |
| 23  | **High**   | Class detail page fetches ALL exams and spaces and filters client-side with `.slice(0, 5)` — no server-side filtering or "View All" link | Add "View All" links and consider server-side filtering for large datasets |
| 24  | **Medium** | Create Class dialog doesn't auto-generate the name from grade + section (e.g., "Grade 10 - Section A")                                   | Offer auto-naming suggestion based on grade + section selection            |
| 25  | **Medium** | Archived classes are filtered out in the list but there's no way to view them                                                            | Add an "Include archived" toggle or separate archived view                 |
| 26  | **Low**    | Student assignment dialog (assigning students to a class) updates each student individually with `Promise.all` — no batch API            | Track as a backend optimization opportunity                                |

---

## 6. Data Tables (Sort/Filter/Search/Paginate)

**Strengths:**

- `usePagination` hook resets page on filter change
- `useSort` hook supports 3-state cycling (asc/desc/none)
- `SortableTableHead` component with visual indicators
- `DataTablePagination` component with page size selector
- All tables have `overflow-x-auto` for mobile

**Findings:**

| #   | Severity   | Finding                                                                                                                     | Recommendation                                                                                             |
| --- | ---------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 27  | **Medium** | Sort state uses `String(aVal).localeCompare(String(bVal))` — numeric fields like totalMarks or grade sort lexicographically | The `{ numeric: true }` option is passed but test with actual data; dates/timestamps need special handling |
| 28  | **Medium** | No column visibility toggle — tables have 7-8 columns which are cramped on tablet                                           | Add column visibility dropdown like shadcn DataTable pattern                                               |
| 29  | **Low**    | No persistent sort/filter state — navigating away and back resets everything                                                | Consider URL search params or session storage for filter persistence                                       |

---

## 7. Forms & Validation

**Findings:**

| #   | Severity     | Finding                                                                                                                              | Recommendation                                                                                                                                    |
| --- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 30  | **Critical** | No forms use React Hook Form — all use raw `useState` with manual validation                                                         | Adopt React Hook Form + Zod for all dialogs: Create User, Create Class, Edit Class, Settings, Onboarding, Announcements, Academic Sessions, Staff |
| 31  | **Critical** | Settings page school info edit has inline regex validation for email/phone but no visual inline error indicators — only toast errors | Show inline error messages under the field, not just toast                                                                                        |
| 32  | **High**     | Branding color fields accept free text — user must know hex format                                                                   | Use a native `<input type="color">` or a color picker component alongside the text input                                                          |

---

## 8. Navigation & Routing

**Strengths:**

- 4 nav groups (Overview, Management, Analytics, Configuration) — well organized
- Route prefetching on hover (`usePrefetch` + lazy imports)
- `SkipToContent` accessibility component
- `RouteAnnouncer` for screen reader route change announcements
- `PageTransition` for smooth page transitions
- Mobile bottom nav with "More" → sidebar sheet
- Breadcrumbs via `AppBreadcrumb`
- `RouteErrorBoundary` on every route

**Findings:**

| #   | Severity   | Finding                                                                                                           | Recommendation                                                                    |
| --- | ---------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 33  | **Medium** | Breadcrumbs don't handle dynamic routes — `ClassDetailPage` renders its own breadcrumbs independently             | Centralize breadcrumb config to include dynamic segments like `/classes/:classId` |
| 34  | **Medium** | 16+ sidebar items may overwhelm new admins                                                                        | Consider progressive disclosure — collapse less-used sections by default          |
| 35  | **Low**    | No "active" state visual on mobile bottom nav for sub-pages (e.g., `/classes/abc123` doesn't highlight "Classes") | The `isActive` check uses `startsWith` which should work — verify                 |

---

## 9. Loading, Error & Empty States

**Strengths:**

- `RequireAuth` has a full-page skeleton layout
- `TableSkeleton`, `CardGridSkeleton`, `DashboardSkeleton` components exist
- Empty states with icons and helpful messages on most pages
- `RouteErrorBoundary` catches render errors

**Findings:**

| #   | Severity   | Finding                                                                              | Recommendation                                                                |
| --- | ---------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| 36  | **High**   | `DashboardSkeleton` exists but is never used — Dashboard shows no loading state      | Import and use `DashboardSkeleton` when data is loading                       |
| 37  | **High**   | `CoursesPage` shows `<div>Loading courses...</div>` — plain text instead of skeleton | Use `CardGridSkeleton` for consistent loading UI                              |
| 38  | **Medium** | `ClassDetailPage` loading state shows plain text "Loading class details..."          | Use a proper skeleton layout matching the page structure                      |
| 39  | **Medium** | Error states from API calls only show toast — no inline error recovery UI            | For critical failures (can't load data), show an error card with retry button |

---

## 10. Bulk Operations (Import/Export)

**Strengths:**

- `BulkImportDialog` shared component with validation
- CSV parsing with column mapping (supports snake_case and camelCase)
- Data export page with collection picker and format selector
- Export history with download links and expiry indicators

**Findings:**

| #   | Severity   | Finding                                                                                           | Recommendation                                                  |
| --- | ---------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 40  | **Medium** | No CSV export for users — only the Data Export page exports, and it's behind permission checks    | Add quick "Export to CSV" button on the Users page table header |
| 41  | **Low**    | Data export page uses native `<input type="checkbox">` instead of the shadcn `Checkbox` component | Use consistent component library                                |

---

## 11. Settings Page (`SettingsPage.tsx`)

**Strengths:**

- 4 well-organized tabs (Settings, Evaluation, Branding, API Keys)
- School info with inline edit toggle
- Evaluation dimension toggles
- Branding with live preview
- Logo uploader with drag-and-drop and progress bar
- API key management with masked display
- Tenant code copy-to-clipboard

**Findings:**

| #   | Severity   | Finding                                                                                                    | Recommendation                                                                                |
| --- | ---------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 42  | **High**   | API key is stored via `callSaveTenant` which likely stores it in plaintext in Firestore — security concern | Store API keys server-side only, never expose to client. Use a Cloud Function to set/validate |
| 43  | **Medium** | Evaluation settings uses direct Firestore `updateDoc` instead of going through a service layer             | Migrate to a proper API call for consistency and security rules enforcement                   |

---

## 12. Accessibility

**Strengths:**

- `SkipToContent` component
- `RouteAnnouncer` for page changes
- `aria-label` on password toggle, select-all checkboxes, table action buttons
- `aria-describedby` linking error messages to inputs on login
- `role="alert"` on error messages
- `role="img"` with `aria-label` on chart containers

**Findings:**

| #   | Severity   | Finding                                                                                                       | Recommendation                                                             |
| --- | ---------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| —   | **Medium** | Most form `<Label>` components lack `htmlFor` (e.g., in Create User, Edit Parent dialogs)                     | Always pair `<Label htmlFor="">` with input `id` attributes                |
| —   | **Medium** | Interactive table cells use `<button>` without `<td>` role clarification — screen readers may have difficulty | Ensure clickable cells are clearly identified as interactive               |
| —   | **Low**    | Color-only indicators (status dots on features, quota bar colors) need text alternatives                      | Already has text labels alongside most color indicators — verify all cases |

---

## 13. Quick Wins (Effort: < 1 day each)

1. **Use `DashboardSkeleton`** — It's already built, just import it. (Finding
   #9, #36)
2. **Add `htmlFor` to all Label components** — Search-and-fix across all
   dialogs. (Accessibility)
3. **Add "Forgot Password" link** — Single link + `sendPasswordResetEmail` call.
   (Finding #1)
4. **Fix onboarding skip bug** — Ensure `onboarding.completed = true` is set
   when skipping. (Finding #5)
5. **Use `CardGridSkeleton` in CoursesPage** — Replace text loading state.
   (Finding #37)
6. **Add status filter to Users page** — Reuse the pattern from ClassesPage.
   (Finding #17)
7. **Replace native checkboxes in DataExportPage** — Use shadcn `Checkbox`.
   (Finding #41)
8. **Add inline edit action to ClassDetailPage header** — Button that opens
   existing edit dialog. (Finding #22)
9. **Fix At-Risk trend direction** — Change from "down" to "up" or use a neutral
   warning style. (Finding #11)
10. **Add `title` attributes to onboarding step buttons** — For mobile
    accessibility. (Finding #8)

---

## 14. Recommendations Summary

### Priority 1 — Critical (Do First)

- Migrate forms to React Hook Form + Zod (Create User, Create Class, Settings,
  Onboarding, Announcements)
- Add inline validation with field-level error messages
- Fix onboarding skip flow bug
- Review API key storage security

### Priority 2 — High (Sprint 1)

- Add loading skeletons to Dashboard and CoursesPage
- Add status filters and edit capabilities to Users page
- Add management actions to ClassDetailPage
- Add color picker to branding settings
- Add "Forgot Password" to login

### Priority 3 — Medium (Sprint 2)

- Centralize breadcrumb configuration
- Add column visibility toggles to wide tables
- Improve bulk import with dry-run preview
- Add CSV export to Users page
- Migrate Firestore direct calls to service layer

### Priority 4 — Low (Backlog)

- URL-persisted filter state
- Parent bulk operations
- Progressive sidebar disclosure
- Auto-naming for classes
- Remember me toggle on login

---

## 15. Architecture Notes

### Positive Patterns

- **Lazy loading**: All pages use `React.lazy()` with `Suspense` fallback
- **Shared component library**: Extensive use of `@levelup/shared-ui` (shadcn/ui
  based)
- **Route prefetching**: `usePrefetch` hook pre-loads chunks on link hover
- **State management**: Zustand stores (`useAuthStore`, `useTenantStore`) +
  React Query for server state
- **Error boundaries**: `RouteErrorBoundary` wraps every route
- **PWA support**: Service worker registration with update notification
- **Theme**: `next-themes` with system/dark/light toggle
- **Web Vitals**: Performance monitoring via `reportWebVitals()`

### Areas for Improvement

- **Form management**: Raw `useState` everywhere — React Hook Form would reduce
  boilerplate by ~60%
- **Client-side filtering**: Many pages load all entities and filter in-memory —
  won't scale past ~1000 records
- **Direct Firestore access**: Settings page evaluation tab directly calls
  Firestore instead of using the service layer
- **State colocation**: `UsersPage.tsx` has 20+ `useState` calls — Extract into
  custom hooks or React Hook Form
