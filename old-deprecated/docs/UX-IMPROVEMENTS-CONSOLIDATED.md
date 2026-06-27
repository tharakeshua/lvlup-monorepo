# Consolidated UX Improvements Plan — Auto-LevelUp Platform

**Date:** 2026-03-09 **Source:** 5 parallel UX audit workers analyzed all 5
apps + shared-ui (6 reports, ~147KB of findings) **Total Findings:** ~120+
individual issues across all apps

---

## Executive Summary

The Auto-LevelUp platform has **strong engineering fundamentals** — lazy
loading, error boundaries, PWA support, accessibility basics (ARIA,
SkipToContent, RouteAnnouncer), and consistent navigation via shared
AppShell/AppSidebar. However, the audit reveals **systemic UX gaps** that span
across all apps, plus app-specific issues in critical user flows.

### Platform-Wide Health

| Area                       | Grade  | Notes                                                                        |
| -------------------------- | ------ | ---------------------------------------------------------------------------- |
| Navigation/Layout          | **A-** | All 5 apps correctly use AppShell + AppSidebar + MobileBottomNav             |
| Accessibility              | **A-** | ARIA roles, reduced motion, focus-visible, screen reader support             |
| Auth Flow UX               | **C+** | 4+ different login implementations; shared auth components completely unused |
| Form Patterns              | **C**  | Only 1/5 apps uses React Hook Form; rest use raw useState                    |
| Loading/Error/Empty States | **C**  | DataLoadingWrapper + ErrorState exist in shared-ui but ZERO apps use them    |
| Cross-App Consistency      | **C+** | Major divergences despite having shared components                           |
| Component Library          | **A**  | 93+ components, but many high-value ones are unused                          |

---

## TIER 1: Critical Issues (Fix Immediately)

These issues cause data loss, block core workflows, or create significant user
frustration.

### 1. No Forgot Password Flow (Affects 4/5 apps)

- **Apps:** student-web, teacher-web, admin-web, super-admin (only parent-web
  has it)
- **Impact:** Users locked out permanently with no self-service recovery
- **Fix:** Add "Forgot Password?" link using Firebase's
  `sendPasswordResetEmail()` to all login forms
- **Effort:** Low (2-4 hours total)

### 2. SpaceEditorPage Monolith with No Autosave (teacher-web)

- **Impact:** Teachers risk losing extensive content work on browser
  crash/navigation
- **Current:** ~800-line single component, no autosave, no unsaved changes
  warning
- **Fix:** Add debounced autosave (2s delay), `beforeunload` listener,
  `useBlocker` guard, and decompose into sub-components
- **Effort:** Medium (1-2 days)

### 3. Dashboard Blank Screen During Load (student-web)

- **Impact:** Students see a blank page after login — terrible first impression
- **Current:** Renders `null` while `summaryLoading` is true
- **Fix:** Show skeleton cards matching the summary grid layout
- **Effort:** Low (1-2 hours)

### 4. No Form Validation Across Admin-Web

- **Impact:** Create User dialog accepts empty/invalid data, creating Firebase
  Auth accounts with missing info
- **Current:** All forms use raw `useState` with no field-level validation
- **Fix:** Migrate to React Hook Form + Zod; add confirmation step before user
  creation
- **Effort:** High (3-5 days for full migration)

### 5. TimedTestPage Fragility (student-web)

- **Impact:** Highest-stakes flow (exams) in a single 500+ line component with
  no `beforeunload` guard
- **Current:** Students can accidentally navigate away during timed tests,
  losing all progress
- **Fix:** Add `beforeunload` handler, `useBlocker` guard, decompose into
  sub-components
- **Effort:** Medium (1-2 days)

### 6. Auth Components Built But Never Used (All apps)

- **Impact:** 200+ LOC duplicated per app; inconsistent UX across platform
- **Current:** `SchoolCodeLoginForm`, `DirectLoginForm`, `CredentialsStep` exist
  in shared-ui but ALL 5 apps have custom implementations
- **Fix:** Migrate all apps to shared auth components (see Tier 2 R1)
- **Effort:** High (full sprint)

---

## TIER 2: High Priority (Next Sprint)

### 7. Adopt DataLoadingWrapper Across All Apps

- **Status:** Component exists in shared-ui, zero apps use it
- **Impact:** Unified loading/error/empty UX across entire platform
- **Replace:** 5 different loading patterns, 3+ error patterns, inconsistent
  empty states
- **Effort:** Medium per app

### 8. RequireAuth Loading/Access-Denied Dead-End (teacher-web)

- **Current:** Bare `<p>Loading...</p>` text; access-denied has no
  logout/redirect
- **Fix:** Full-page branded skeleton; access-denied with logout + redirect
  suggestion
- **Effort:** Low (2-3 hours)

### 9. StudentsPage is a Dead-End (teacher-web)

- **Current:** Read-only list with no links to student reports, no CRUD
- **Fix:** Make rows clickable → `/students/{id}/report`; add edit/import
  actions
- **Effort:** Medium (1 day)

### 10. No Pagination on List Pages (teacher-web)

- **Current:** Spaces, Exams, Questions all load everything client-side
- **Fix:** Add pagination (20-50 per page) using existing `usePagination` hook
  from admin-web
- **Effort:** Medium (1 day)

### 11. Mobile Navigation Gaps (super-admin, parent-web)

- **Current:** Bottom nav shows only 4 items out of 9-10 pages; rest
  inaccessible
- **Fix:** Add "More" menu item that opens sidebar sheet
- **Effort:** Low (2-3 hours)

### 12. Confusing Parent Navigation Hierarchy (parent-web)

- **Current:** "Children", "Space Progress", "Child Progress", "Exam Results"
  all top-level — unclear distinctions
- **Fix:** Restructure: "Children" → child detail view with tabs for Progress,
  Exams, Spaces
- **Effort:** Medium (2-3 days)

### 13. Drag-and-Drop Lacks Visual Feedback (teacher-web)

- **Current:** dnd-kit reordering has minimal visual cues — no drop zones, no
  ghost/placeholder
- **Fix:** Add highlighted drop zones, ghost preview, smooth animations using
  dnd-kit built-in features
- **Effort:** Low (half day)

### 14. Exam Creation — Comma-Separated Class IDs (teacher-web)

- **Current:** Teachers must type exact class IDs separated by commas
- **Fix:** Replace with searchable multi-select from available classes
- **Effort:** Low (half day)

### 15. Charts Lack Accessibility (super-admin)

- **Current:** Recharts BarChart/PieChart have no `aria-label`, no screen reader
  alternative
- **Fix:** Add aria-labels and visually-hidden data table fallbacks
- **Effort:** Low (2-3 hours)

---

## TIER 3: Medium Priority (Future Sprints)

### Form System Migration

| #   | Issue                                      | App         | Effort |
| --- | ------------------------------------------ | ----------- | ------ |
| 16  | Migrate all forms to React Hook Form + Zod | admin-web   | High   |
| 17  | Migrate all forms to React Hook Form + Zod | student-web | Medium |
| 18  | Migrate all forms to React Hook Form + Zod | teacher-web | Medium |
| 19  | Migrate all forms to React Hook Form + Zod | parent-web  | Medium |

### Loading/Error/Empty State Standardization

| #   | Issue                                                   | App                    | Effort |
| --- | ------------------------------------------------------- | ---------------------- | ------ |
| 20  | Replace custom loading patterns with DataLoadingWrapper | All 5                  | Medium |
| 21  | Replace custom error patterns with ErrorState           | All 5                  | Medium |
| 22  | Standardize empty states using EmptyState presets       | admin-web, super-admin | Low    |

### Content & Data UX

| #   | Issue                                            | App         | Effort |
| --- | ------------------------------------------------ | ----------- | ------ |
| 23  | Add autosave indicator to SpaceEditorPage        | teacher-web | Medium |
| 24  | Make dashboard stat cards clickable → list pages | teacher-web | Low    |
| 25  | Make at-risk student entries clickable → reports | teacher-web | Low    |
| 26  | Add "Resume Learning" sort by lastAccessedAt     | student-web | Low    |
| 27  | Add practice completion summary view             | student-web | Medium |
| 28  | Class detail page — add edit/manage actions      | admin-web   | Medium |
| 29  | Column visibility toggle on data tables          | admin-web   | Medium |
| 30  | Bulk upload for answer sheets                    | teacher-web | High   |
| 31  | Add progress toward locked achievements          | student-web | Medium |
| 32  | Study goals — wire to actual completion data     | student-web | Medium |

### Cross-App Consistency

| #   | Issue                                                           | Effort |
| --- | --------------------------------------------------------------- | ------ |
| 33  | Unify ScoreCard and StatCard into single MetricCard             | Medium |
| 34  | Remove duplicate ConfirmDialog from teacher-web                 | Low    |
| 35  | Consolidate dual toast system (remove Radix Toast, keep Sonner) | Low    |
| 36  | Create shared PageLayout component                              | Medium |
| 37  | Create shared ManagedDataTable (sort+filter+paginate)           | High   |
| 38  | Standardize breadcrumb implementation across all apps           | Medium |

---

## TIER 4: Polish & Nice-to-Have

| #   | Issue                                                | App                      | Effort |
| --- | ---------------------------------------------------- | ------------------------ | ------ |
| 39  | Google Sign-In button missing Google icon            | student-web              | Low    |
| 40  | Consumer login ignores `location.state.from`         | student-web              | Low    |
| 41  | Logout button too prominent on dashboard             | student-web, super-admin | Low    |
| 42  | Space creation always produces "Untitled Space"      | teacher-web              | Low    |
| 43  | Keyboard shortcuts not discoverable                  | teacher-web              | Low    |
| 44  | School code input — no format hint                   | teacher-web, admin-web   | Low    |
| 45  | Add "Remember me" toggle on login                    | admin-web                | Low    |
| 46  | Week calendar strip — add prev/next navigation       | student-web              | Low    |
| 47  | Password visibility toggle missing                   | admin-web, super-admin   | Low    |
| 48  | Filter persistence via URL params or session storage | admin-web                | Medium |
| 49  | Add notification system to super-admin               | super-admin              | Medium |
| 50  | Session timeout warning dialog                       | All apps                 | Medium |

---

## Quick Wins Summary (< 1 day effort each)

These can be done immediately with minimal risk:

1. Add "Forgot Password?" link to all login forms
2. Add dashboard loading skeleton (student-web)
3. Add `beforeunload` guard to TimedTestPage (student-web)
4. Replace `window.location.href` with React Router navigate (teacher-web)
5. Make dashboard stat cards clickable (teacher-web)
6. Link at-risk students to their reports (teacher-web)
7. Add "More" menu to mobile bottom nav (super-admin, parent-web)
8. Add aria-labels to Recharts charts (super-admin)
9. Replace comma-separated class IDs with multi-select (teacher-web)
10. Remove duplicate ConfirmDialog from teacher-web
11. Remove Radix Toast (keep Sonner only)
12. Add password visibility toggle to admin-web and super-admin login
13. Add RequireAuth branded loading skeleton (teacher-web)
14. Add Access-Denied page with logout + redirect (teacher-web)
15. Hide "Compare Children" nav when parent has only 1 child (parent-web)

---

## Architectural Improvements (Longer Term)

### A1: Shared Auth Migration

Migrate all 5 apps from custom login implementations to shared
`SchoolCodeLoginForm`/`DirectLoginForm`. Add missing props:
`showPasswordToggle`, `onForgotPassword`, `showOAuth`, `oauthProviders`.

### A2: Form System Unification

Migrate all apps to React Hook Form + Zod. Create shared Zod schemas in
`@levelup/shared-types`. Ensure `FormMessage` for inline errors with proper
ARIA.

### A3: State Management Pattern

Adopt `DataLoadingWrapper` for all data-fetching components. Define 3 error
recovery tiers: inline (fields), section (data fetch), page (route-level).

### A4: Design Token System

Document typography scale, spacing conventions, z-index layers, transition
durations. Consider Storybook for component documentation.

### A5: Accessibility CI Pipeline

Integrate axe-core tests (shared-ui already has `a11y-test-utils.ts`). Run in CI
for all 5 apps.

---

## Individual Audit Reports

Detailed findings for each area:

- [`docs/ux-audit-student-web.md`](./ux-audit-student-web.md) — 27KB, full
  student flow analysis
- [`docs/ux-audit-teacher-web.md`](./ux-audit-teacher-web.md) — 30KB, content
  creation & grading flows
- [`docs/ux-audit-admin-web.md`](./ux-audit-admin-web.md) — 19KB, 43 findings
  across all admin flows
- [`docs/ux-audit-parent-web.md`](./ux-audit-parent-web.md) — 18KB, parent
  portal analysis
- [`docs/ux-audit-super-admin.md`](./ux-audit-super-admin.md) — 28KB, platform
  management console
- [`docs/ux-audit-shared-crossapp.md`](./ux-audit-shared-crossapp.md) — 26KB,
  design system & cross-app patterns

---

_Generated by 5 parallel UX audit agents coordinated by Maestro_
