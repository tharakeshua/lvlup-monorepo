# UX Audit: parent-web

**Audited**: Every file in `apps/parent-web/src/` (28 files) **Stack**: React +
Vite + TypeScript + Tailwind + shadcn/ui + Firebase + TanStack Query

---

## Executive Summary

The parent-web app is a well-structured portal for parents to monitor their
children's academic progress. It has strong foundations: proper lazy loading,
error boundaries, skeleton loading states, empty states, PWA support,
mobile-first navigation, and accessibility basics (ARIA roles, labels,
skip-to-content). However, there are meaningful UX gaps around navigation
clarity, data staleness awareness, feedback granularity, and mobile
responsiveness.

---

## 1. Authentication Flow

### Strengths

- Two-step login (school code -> credentials) reduces errors and scopes access
  correctly
- Password show/hide toggle with proper `aria-label`
- Forgot password inline with clear messaging
- Error states use `role="alert"` and `aria-invalid` / `aria-describedby`
- Loading spinners with text change ("Validating..." / "Signing in...")
- Preserves `from` location for redirect after login

### Issues

| #   | Severity | Issue                                                                                                                                                                                | Recommendation                                                              |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| A1  | Medium   | **No password requirements hint** — user sees no guidance on password format                                                                                                         | Add helper text below password field or show requirements on failed attempt |
| A2  | Low      | **Forgot password message uses same visual style for success and error** — both are `text-muted-foreground`, making it hard to distinguish a failed reset from a successful one      | Use `text-success` for success, `text-destructive` for error                |
| A3  | Low      | **No loading indicator on school code lookup on slow connections** — the `codeLoading` flag exists but `finally` block may fire before visual feedback registers on fast connections | Consider debouncing or minimum display time for the loader                  |
| A4  | Medium   | **Login form does not set `autoComplete` attributes** — email input lacks `autoComplete="email"`, password lacks `autoComplete="current-password"`                                   | Add `autoComplete` attributes for password manager support                  |
| A5  | Low      | **School code step has no "back" or "cancel" option** if user accidentally navigates to login while already authenticated                                                            | Add redirect check at top of LoginPage                                      |

---

## 2. Navigation & Information Architecture

### Strengths

- AppShell with sidebar, mobile bottom nav, breadcrumb-equivalent through route
  groups
- Route prefetching on hover for instant navigation feel
- SkipToContent, RouteAnnouncer for screen reader navigation
- Notification bell with unread count badge
- RoleSwitcher for parents with children in multiple schools
- Tenant branding support (useTenantBranding)

### Issues

| #   | Severity | Issue                                                                                                                                                                                                                                                                                                   | Recommendation                                                                                                                                            |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N1  | High     | **Confusing navigation hierarchy** — "Children", "Space Progress", "Child Progress", "Exam Results", "Alerts", and "Compare Children" are all top-level items under "My Children". Parents must understand the difference between "Space Progress" and "Child Progress" which isn't immediately obvious | Restructure: make "Child Progress" the primary drill-down from "Children" page; fold "Space Progress" and "Exam Results" as tabs within child detail view |
| N2  | Medium   | **Mobile bottom nav only shows 4 items** (Home, Children, Results, Alerts) — but there are 9 pages. Important pages like "Child Progress", "Compare", "Space Progress" are hidden                                                                                                                       | Add a "More" menu item in mobile bottom nav to surface remaining items, or reduce total page count by consolidating                                       |
| N3  | Medium   | **No visual indicator of which child is currently selected** across pages — navigating from Dashboard to Child Progress via `?student=X` works, but switching between children on separate pages requires URL manipulation                                                                              | Add a persistent child selector component or breadcrumb showing active child                                                                              |
| N4  | Low      | **"Compare Children" page is always shown** even if parent has only one child, where it just shows an empty state                                                                                                                                                                                       | Hide the nav item when `linkedStudents.length < 2`                                                                                                        |
| N5  | Low      | **No page-level breadcrumbs** — parent-web doesn't use `AppBreadcrumb` unlike super-admin                                                                                                                                                                                                               | Add breadcrumb trail for better orientation, especially on deep pages like child progress                                                                 |

---

## 3. Dashboard

### Strengths

- DataFreshnessIndicator with "Updated X ago" and manual refresh
- Well-structured ScoreCards with meaningful metrics
- Quick action cards for common tasks
- AnimatedList with stagger animation for children overview
- Proper empty state when no children are linked
- DashboardSkeleton with realistic placeholder layout

### Issues

| #   | Severity | Issue                                                                                                                                                                                     | Recommendation                                                                   |
| --- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| D1  | Medium   | **"School" ScoreCard shows tenantCode** (e.g., "SPRINGFIELD-HS") instead of the human-readable school name                                                                                | Use the resolved tenant name from `useTenantNames` or `useTenantStore`           |
| D2  | Low      | **Avg Performance shows "--" when summaries are loading** but there's no distinction between "loading" and "no data"                                                                      | Show a skeleton or spinner inside the ScoreCard while summaryResults are loading |
| D3  | Low      | **"At-Risk Alerts" card shows trend "down"** with "Needs attention" — this is misleading because "down" trend typically implies a negative change over time, but here it's a static count | Remove the `trend` prop or use a neutral indicator                               |
| D4  | Low      | **Exam title truncation at 140px** may cut off important information on larger screens                                                                                                    | Use responsive max-width or tooltip on hover for full title                      |

---

## 4. Children Page

### Strengths

- Detailed per-child cards with avatar, status badge, at-risk badge
- ProgressRing for visual overall score
- 3-column stat grid (Exam Average, Space Completion, Streak)
- Recent exam results with color-coded scores
- Direct action links to Full Progress and Exam Results per child

### Issues

| #   | Severity | Issue                                                                                                                  | Recommendation                                               |
| --- | -------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| C1  | Low      | **No sorting or filtering** — if a parent has many children, there's no way to sort by performance or filter by status | Add sort dropdown (by score, name, at-risk status)           |
| C2  | Low      | **Cards are not keyboard-navigable** as interactive units — the card itself isn't a link, only the CTAs at bottom are  | Make the entire card clickable to navigate to child progress |

---

## 5. Child Progress Page

### Strengths

- Child selector tabs with avatar initials when multiple children exist
- Comprehensive stats grid (5 ScoreCards)
- At-risk alert banner with specific reasons
- Strengths/Weaknesses as pill badges
- Improvement recommendations that are contextual (adapt based on scores)
- Performance trends chart with time range selector
- Subject breakdown charts for both exams and spaces
- Recent exam results with progress bars and color coding
- PDF report download capability

### Issues

| #   | Severity | Issue                                                                                                                                                                                                                                                                                              | Recommendation                                                                                                                  |
| --- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| CP1 | Medium   | **Child selector doesn't highlight the default** — when no `studentFromUrl` is set, `selectedStudentId` is null and the first child is implicitly selected, but the `isSelected` check uses `selectedStudentId ?? summaries[0]?.studentId` which may not match the button's visual state correctly | Set `selectedStudentId` to the first student's UID on mount if null                                                             |
| CP2 | Medium   | **PerformanceTrendsChart SVG is custom-built** — the MiniLineChart lacks interactive tooltips (only SVG `<title>` which isn't visible on mobile), has no zoom/pan, and `preserveAspectRatio="none"` distorts the chart                                                                             | Consider using Recharts (already a dependency in super-admin) for richer interactivity, or at least add touch-friendly tooltips |
| CP3 | Low      | **Improvement recommendations are generic** — they always suggest "Practice more [subject]" without linking to specific spaces or resources                                                                                                                                                        | If available, link to specific LevelUp spaces for each weak subject                                                             |
| CP4 | Low      | **"Recent Activity" section shows raw action codes** like `completed_story_point` with `replace(/_/g, " ")` which is functional but not user-friendly                                                                                                                                              | Create human-readable labels for activity types                                                                                 |

---

## 6. Exam Results Page

### Strengths

- Search with icon across student name, roll number, exam title, subject
- Accordion for drill-down into per-question feedback
- Score color coding (green/amber/red) at 70%/40% thresholds
- Per-question breakdown with rubric, strengths/weaknesses, mistake
  classification
- Progress bars with proper ARIA attributes
- PDF download per exam result
- Improvement recommendations for low scores

### Issues

| #   | Severity | Issue                                                                                                                                                           | Recommendation                                                        |
| --- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| E1  | Medium   | **No sorting** — results are in creation order (descending). Parents can't sort by score, date, or subject                                                      | Add sort options for percentage, date, subject                        |
| E2  | Medium   | **No pagination** — if a parent has many children with many exams, all results load at once                                                                     | Add pagination or virtual scrolling for large result sets             |
| E3  | Low      | **QuestionFeedbackSection loads lazily per accordion open** — good for performance, but shows "Loading question details..." with no skeleton, which feels plain | Add a proper skeleton layout matching the question feedback structure |
| E4  | Low      | **Student filter via URL param** (`?student=X`) is not surfaced in UI — there's no way for users to add/remove this filter from the page itself                 | Add a student filter dropdown to the page                             |

---

## 7. Space Progress Page

### Strengths

- Grouped by student for clear hierarchy
- Progress bars with proper ARIA progressbar roles
- Story point completion count
- Space names resolved from Firestore

### Issues

| #   | Severity | Issue                                                                                                                          | Recommendation                                                 |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| S1  | Medium   | **No sorting, filtering, or search** — all progress items for all students are shown in a flat grid                            | Add subject/status filters and search                          |
| S2  | Medium   | **`studentNameFromMembership` fallback** shows `Student ${uid.slice(0,8)}` which is a technical ID fragment, not user-friendly | Use "Child 1", "Child 2" pattern or require names at all times |
| S3  | Low      | **No pagination for spaces** — a student with many spaces will have a very long page                                           | Add "show more" or pagination within each student's section    |
| S4  | Low      | **No visual progress summary per student** — just individual space cards with no aggregate stat                                | Add a summary row per student showing overall completion       |

---

## 8. Performance Alerts Page

### Strengths

- Per-child alert sections with summary stats
- Three alert severity levels (danger/warning/info) with distinct colors
- Dark mode support with conditional classes
- "No alerts — everything looks good!" positive state
- Contextual alerts derived from actual data (low scores, zero streak, low
  completion)

### Issues

| #   | Severity | Issue                                                                                                                                         | Recommendation                                                        |
| --- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| PA1 | Medium   | **No actionable links from alerts** — alerts say "Scored 32% on Math Exam" but don't link to the exam result or child progress page           | Add "View Result" or "View Progress" links in alert items             |
| PA2 | Low      | **Loading state uses simple Skeleton blocks** without aria-label on the parent wrapper                                                        | Add `role="status"` and `aria-label="Loading alerts"`                 |
| PA3 | Low      | **Alert thresholds are hardcoded** (40% for low scores, 20% for low completion, 0 for streak) — these may not match school-specific standards | Consider making thresholds configurable or relative to class averages |

---

## 9. Compare Children Page

### Strengths

- Side-by-side cards with ProgressRing
- "Best" metric highlighted with star
- Bar chart comparison for overall scores
- Proper handling of single-child edge case

### Issues

| #   | Severity | Issue                                                                                                   | Recommendation                                            |
| --- | -------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| CC1 | Low      | **Limited to 4 children** (`slice(0, 4)`) — while unlikely to be an issue, there's no explanation why   | If intentional, add a note; if not, allow all children    |
| CC2 | Low      | **No metric selection** — all metrics are always shown. Parents might want to focus on specific metrics | Add checkboxes or tabs to select which metrics to compare |

---

## 10. Settings Page

### Strengths

- Read-only profile fields with clear "Contact admin to update" message
- Notification preferences with channels and types
- Dirty state tracking with "Save Changes" button that only appears when changed
- Toast feedback on save success/failure
- LogoutButton component

### Issues

| #   | Severity | Issue                                                                                                                                       | Recommendation                                                |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| ST1 | Medium   | **No unsaved changes warning** — navigating away from dirty settings loses changes without warning                                          | Add `beforeunload` listener or `useBlocker` from react-router |
| ST2 | Low      | **Switch components lack individual labels** for screen readers — they rely on adjacent text, but the `<Switch>` itself has no `aria-label` | Add `aria-label` to each Switch                               |
| ST3 | Low      | **No description for what "Push Notifications" does** when browser notifications are not supported or denied                                | Detect permission state and show status/prompt                |

---

## 11. Notifications Page

### Strengths

- Delegates to shared `NotificationsPageUI` component for consistency
- Filter toggle (all/unread)
- Mark-read on click, mark-all-read action
- Action URL navigation on click

### Issues

| #   | Severity | Issue                                                                                                   | Recommendation                                        |
| --- | -------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| NO1 | Low      | **Hardcoded limit of 50** — no "load more" or pagination for notifications                              | Add infinite scroll or "Load more" button             |
| NO2 | Low      | **No notification timestamps visible in the delegated component** (depends on shared-ui implementation) | Ensure the shared component shows relative timestamps |

---

## 12. Hooks & Data Layer

### Strengths

- Proper query key hierarchies for cache management
- Batched Firestore queries (in groups of 30 for `where("in", ...)`)
- staleTime configured per use case (1min for active data, 5-10min for static
  data)
- Fallback handling in catch blocks

### Issues

| #   | Severity | Issue                                                                                                                                                                       | Recommendation                                                            |
| --- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| H1  | Medium   | **`useStudentNames` hits `/users/{uid}` individually** via `Promise.all` — N+1 query pattern. For parents with many children this is fine, but it's architecturally fragile | Batch with `documentId()` `in` query like other hooks                     |
| H2  | Medium   | **`useChildSubmissions` has a nested try/catch fallback** that retries individual docs if batch query fails — this is resilient but can mask Firestore permission errors    | Log or surface these errors to the user rather than silently falling back |
| H3  | Low      | **`useChildProgress` query key includes the entire `studentIds` array** — array reference changes can cause unnecessary refetches                                           | Use a sorted, joined string key instead                                   |

---

## 13. Cross-cutting UX Concerns

| #   | Severity | Issue                                                                                                                                                                                              | Recommendation                                                                                                 |
| --- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| X1  | High     | **No offline handling beyond the `OfflineBanner`** — when offline, data fetches will fail with no graceful fallback. Pages show error or empty states with no explanation that the user is offline | Add error states that detect offline status and show "You're offline" messages with cached data when available |
| X2  | Medium   | **No global error toast for failed data fetches** — individual pages handle errors differently (some show empty states, some show nothing)                                                         | Add a consistent error handling pattern with retry capability                                                  |
| X3  | Medium   | **Color-coded scores use same thresholds everywhere** (70%/40%) but these are hardcoded magic numbers                                                                                              | Extract to a shared constants file and consider making them tenant-configurable                                |
| X4  | Low      | **PWAInstallBanner and SWUpdateNotification are only in parent-web** — good PWA support, but the install banner behavior/timing isn't clear from code alone                                        | Ensure install banner doesn't interrupt first-time usage or auth flow                                          |
| X5  | Low      | **No theme toggle in mobile view** — ThemeToggle is in the header right area which collapses on mobile                                                                                             | Ensure theme toggle is accessible in mobile sidebar or settings                                                |

---

## 14. Accessibility Summary

### Good

- `SkipToContent` component
- `RouteAnnouncer` for page changes
- `role="alert"` on error messages
- `aria-label` on progress bars, charts, loading states
- `role="tablist"` on child selector
- `sr-only` text for loading indicators
- `aria-hidden="true"` on decorative icons

### Needs Improvement

- Switch components need explicit `aria-label` attributes
- Feature flag toggles (in settings) need keyboard interaction cues
- Chart tooltips (SVG `<title>`) aren't accessible on mobile/touch
- Score cards and comparison cards need more descriptive `aria-label` attributes
- Color-coded scores rely solely on color without text alternatives for
  color-blind users (partially mitigated by showing percentage text)

---

## Priority Recommendations (Top 5)

1. **Consolidate navigation** — merge Space Progress and Exam Results into Child
   Progress as tabs to reduce cognitive load (N1)
2. **Add offline-aware error states** — detect offline and show appropriate
   messaging instead of empty/broken states (X1)
3. **Add actionable links in alerts** — connect alert items to relevant detail
   pages (PA1)
4. **Add sorting/filtering to data-heavy pages** — Exam Results, Space Progress
   need basic sort/filter controls (E1, S1)
5. **Fix mobile navigation gaps** — add "More" menu to mobile bottom nav to
   surface hidden pages (N2)
