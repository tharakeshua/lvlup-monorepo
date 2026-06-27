# Cycle 5 - Cross-App UX Consistency Audit

**Date**: 2026-03-16 **Auditor**: UX Auditor Agent **Apps Audited**: admin-web,
parent-web, student-web, super-admin, teacher-web

---

## Executive Summary

Overall UX consistency across the 5 apps is **strong**. All apps share a unified
architecture pattern using shared-ui components (AppShell, AppSidebar,
ThemeProvider, SonnerToaster, ErrorBoundary, RouteErrorBoundary, PageLoader,
MobileBottomNav, etc.). The main findings are minor inconsistencies and a few
accessibility quick fixes.

**Quick fixes applied**: 8 icon buttons had missing `aria-label` attributes --
all fixed.

---

## 1. Shared Component Usage

### Status: GOOD (1 duplicate found)

All 5 apps consistently import from `@levelup/shared-ui`:

- `AppShell`, `AppSidebar`, `MobileBottomNav` -- used in all 5 apps
- `ThemeToggle` -- used in all 5 apps
- `RouteErrorBoundary` -- wraps every route in all 5 apps
- `PageLoader` -- used as Suspense fallback in all 5 apps
- `NotificationBell` -- used in admin-web, teacher-web, student-web, parent-web
  (not super-admin, which is expected)
- `ProgressRing` -- used in teacher-web, parent-web, admin-web, student-web
- `StatCard` -- used in super-admin
- `DataTablePagination` -- used in super-admin, admin-web
- `ConfirmDialog` (shared-ui) -- NOT used in teacher-web (see below)
- `SkipToContent`, `RouteAnnouncer` -- used in all 5 apps

### Issue: Duplicate ConfirmDialog in teacher-web

**File**: `apps/teacher-web/src/components/shared/ConfirmDialog.tsx`

Teacher-web has a local `ConfirmDialog` that duplicates the shared-ui version.
The local version:

- Uses `variant: "destructive" | "default"` instead of shared
  `variant: "danger" | "warning" | "info"`
- Missing `loading` state support (no spinner)
- Missing `cancelLabel` prop
- Missing `onCancel` callback
- Default `confirmLabel` is "Continue" vs shared's "Confirm"

**Used in**: `RubricPresetsPage.tsx`, `SpaceEditorPage.tsx`

**Recommendation**: Migrate to the shared-ui `ConfirmDialog`. The shared version
is a superset of the local one. Note: the `variant` values differ ("destructive"
-> "danger"), so update call sites accordingly.

### Issue: Local NotFoundPage in teacher-web

**File**: `apps/teacher-web/src/pages/NotFoundPage.tsx`

Teacher-web lazy-imports a local `NotFoundPage` instead of using `NotFoundPage`
from `@levelup/shared-ui` (which admin-web, parent-web, student-web, and
super-admin all use).

**Recommendation**: Replace with
`import { NotFoundPage } from "@levelup/shared-ui"` in `App.tsx`.

---

## 2. Loading / Error / Empty State Standardization

### Status: EXCELLENT

| Feature                        | admin-web | parent-web | student-web | super-admin | teacher-web |
| ------------------------------ | --------- | ---------- | ----------- | ----------- | ----------- |
| ErrorBoundary (root)           | Shared    | Shared     | Shared      | Shared      | Shared      |
| RouteErrorBoundary (per-route) | Shared    | Shared     | Shared      | Shared      | Shared      |
| Suspense + PageLoader          | Yes       | Yes        | Yes         | Yes         | Yes         |
| SonnerToaster                  | Yes       | Yes        | Yes         | Yes         | Yes         |
| SWUpdateNotification           | Yes       | Yes        | Yes         | Yes         | Yes         |

All 5 apps have consistent error handling:

- Root-level `ErrorBoundary` wraps the entire app in `main.tsx`
- `RouteErrorBoundary` wraps every individual route in `App.tsx`
- `Suspense` with `PageLoader` fallback for lazy-loaded pages
- `SonnerToaster` with `richColors` and `position="top-right"` in all apps
- `SWUpdateNotification` for PWA updates

**Toaster placement note**: admin-web places `SonnerToaster` inside
`QueryClientProvider` but outside `BrowserRouter`. Parent-web and student-web
place it inside `BrowserRouter`. No functional impact.

---

## 3. Dark/Light Mode

### Status: EXCELLENT

| Feature               | admin-web   | parent-web  | student-web | super-admin | teacher-web |
| --------------------- | ----------- | ----------- | ----------- | ----------- | ----------- |
| ThemeProvider         | next-themes | next-themes | next-themes | next-themes | next-themes |
| defaultTheme          | system      | system      | system      | system      | system      |
| enableSystem          | Yes         | Yes         | Yes         | Yes         | Yes         |
| ThemeToggle in header | Yes         | Yes         | Yes         | Yes         | Yes         |

All 5 apps use identical ThemeProvider configuration from `next-themes` with
`attribute="class"`, `defaultTheme="system"`, and `enableSystem`.

**No hardcoded hex colors found** (`text-[#...]`, `bg-[#...]`, `border-[#...]`).
All apps consistently use Tailwind CSS semantic tokens (`text-foreground`,
`bg-background`, `text-muted-foreground`, `bg-destructive`, etc.), which
properly adapt to dark/light mode.

---

## 4. Mobile Responsiveness

### Status: GOOD (minor inconsistency)

| Feature              | admin-web             | parent-web    | student-web   | super-admin   | teacher-web           |
| -------------------- | --------------------- | ------------- | ------------- | ------------- | --------------------- |
| MobileBottomNav      | Yes (inside AppShell) | Yes (outside) | Yes (outside) | Yes (outside) | Yes (inside AppShell) |
| hasBottomNav padding | Yes                   | Yes           | Yes           | Yes           | Yes                   |
| SidebarTrigger 44px  | Yes (shared)          | Yes (shared)  | Yes (shared)  | Yes (shared)  | Yes (shared)          |

**MobileBottomNav placement**: admin-web passes `bottomNav` as a prop to
`AppShell` (rendered inside `SidebarProvider`), which allows sidebar toggle from
mobile nav. teacher-web also passes it as a prop. The other 3 apps render
`MobileBottomNav` outside `AppShell`. This is only a functional difference for
admin-web which has a "More" button that toggles the sidebar.

**Tap target sizes**: The shared `SidebarTrigger` enforces
`min-h-[44px] min-w-[44px]` for touch targets. Shared `MobileBottomNav` items
also meet the 44px threshold.

**Responsive data tables**: Apps use `DataTablePagination` from shared-ui with
proper responsive layout. No scrollable tables without horizontal scroll
wrappers were found.

---

## 5. Accessibility

### Status: GOOD (8 fixes applied)

#### Fixes Applied

Added missing `aria-label` attributes to 8 icon-only buttons:

| File                                         | Button                       | aria-label Added   |
| -------------------------------------------- | ---------------------------- | ------------------ |
| `teacher-web/.../QuestionBankEditor.tsx:277` | Trash (remove option)        | "Remove option"    |
| `super-admin/.../GlobalPresetsPage.tsx:360`  | Pencil (edit preset)         | "Edit preset"      |
| `super-admin/.../GlobalPresetsPage.tsx:363`  | Trash (delete preset)        | "Delete preset"    |
| `super-admin/.../LLMUsagePage.tsx:204`       | ChevronLeft (previous month) | "Previous month"   |
| `super-admin/.../LLMUsagePage.tsx:218`       | ChevronRight (next month)    | "Next month"       |
| `student-web/.../ChatTutorPanel.tsx:101`     | Minimize2 (minimize chat)    | "Minimize chat"    |
| `student-web/.../ChatTutorPanel.tsx:104`     | X (close chat)               | "Close chat"       |
| `student-web/.../ChatTutorPanel.tsx:209`     | Send (send message)          | "Send message"     |
| `admin-web/.../OnboardingWizardPage.tsx:400` | Copy (copy tenant code)      | "Copy tenant code" |

#### Already Good

- **Focus traps**: All modals use Radix UI primitives (Dialog, AlertDialog,
  Sheet) which include built-in focus trapping
- **SkipToContent**: Present in all 5 apps
- **RouteAnnouncer**: Present in all 5 apps (announces page changes to screen
  readers)
- **Images**: No `<img>` tags without `alt` attributes found across all apps.
  The shared `LazyImage` component enforces alt text.
- **102 aria-label usages** found across 47 files in the 5 apps

---

## 6. Cross-App Feature Parity

### Breadcrumbs

| App         | AppBreadcrumb | Notes                            |
| ----------- | ------------- | -------------------------------- |
| admin-web   | Yes           | Route labels map                 |
| super-admin | Yes           | Route labels + segment resolvers |
| teacher-web | No            | Missing                          |
| student-web | No            | Missing                          |
| parent-web  | No            | Missing                          |

**Recommendation**: Consider adding `AppBreadcrumb` to teacher-web, student-web,
and parent-web for navigation consistency. Not critical for student/parent
(simpler navigation), but teacher-web with its deep nesting (spaces > story
points > items) would benefit most.

### OfflineBanner

| App                          | OfflineBanner | Notes   |
| ---------------------------- | ------------- | ------- |
| admin-web                    | No            | Missing |
| super-admin                  | No            | Missing |
| teacher-web                  | Yes           | Present |
| student-web                  | Yes           | Present |
| parent-web                   | Yes           | Present |
| student-web (ConsumerLayout) | No            | Missing |

**Recommendation**: Add `OfflineBanner` to admin-web and super-admin for
consistency. Also add it to the ConsumerLayout in student-web.

### PWAInstallBanner

| App         | PWAInstallBanner | Notes                                         |
| ----------- | ---------------- | --------------------------------------------- |
| admin-web   | No               | Admin apps typically aren't installed as PWAs |
| super-admin | No               | Expected                                      |
| teacher-web | Yes              | Present                                       |
| student-web | Yes              | Present                                       |
| parent-web  | Yes              | Present                                       |

This distribution makes sense -- admin/super-admin are typically desktop-only
apps.

---

## 7. Summary of Findings

### Issues Found (not fixed)

| #   | Severity | Issue                                     | Location                                                     |
| --- | -------- | ----------------------------------------- | ------------------------------------------------------------ |
| 1   | Low      | Duplicate ConfirmDialog (local vs shared) | teacher-web/components/shared/ConfirmDialog.tsx              |
| 2   | Low      | Local NotFoundPage instead of shared      | teacher-web/pages/NotFoundPage.tsx                           |
| 3   | Info     | Missing AppBreadcrumb                     | teacher-web, student-web, parent-web                         |
| 4   | Info     | Missing OfflineBanner                     | admin-web, super-admin, student-web ConsumerLayout           |
| 5   | Info     | MobileBottomNav placement inconsistency   | parent-web, student-web, super-admin render outside AppShell |

### Issues Fixed

| #   | Issue                              | Files Changed            |
| --- | ---------------------------------- | ------------------------ |
| 1   | Missing aria-label on icon buttons | 5 files, 9 buttons fixed |

### No Issues Found

- Dark/light mode: All apps use consistent theming
- Hardcoded colors: None found
- Loading states: Consistent across all apps
- Error boundaries: Properly configured in all apps
- Toast configuration: Identical across all apps
- Focus traps: Handled by Radix UI in all modals/dialogs
- Image alt text: No violations found
- Tap targets: 44px minimums enforced by shared components
