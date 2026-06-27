# UX Audit: shared-ui Component Library & Cross-App Patterns

**Date:** 2026-03-09 (Updated — Deep Audit v2) **Scope:** `packages/shared-ui`,
`packages/shared-hooks`, `packages/shared-stores`, and all 5 apps **Apps
Audited:** admin-web, student-web, teacher-web, parent-web, super-admin

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Part 1: shared-ui Component Library Audit](#part-1-shared-ui-component-library-audit)
3. [Part 2: Cross-App UX Pattern Audit](#part-2-cross-app-ux-pattern-audit)
4. [Design System Recommendations](#design-system-recommendations)
5. [Priority Matrix](#priority-matrix)

---

## Executive Summary

The Auto-LevelUp design system is **well-architected** with a strong foundation:

- **91+ shared components** built on Radix UI primitives with Tailwind CSS + CVA
- **Consistent HSL-based design token system** via CSS custom properties
- **Solid accessibility baseline** with ARIA attributes, keyboard navigation,
  and reduced-motion support
- **8 Framer Motion components** with `useReducedMotion()` fallbacks
- **React Hook Form + Zod integration** for forms (inconsistently adopted)
- **4 Zustand stores** (Auth, Tenant, UI, Consumer) with real-time Firebase
  subscriptions
- **45+ TanStack Query hooks** for data fetching

However, the audit reveals **significant inconsistencies across apps** and
**gaps in the shared library** that create fragmented user experiences,
duplicated code, and maintenance overhead.

### Top-Level Ratings

| Area                            | Rating | Summary                                                                                    |
| ------------------------------- | ------ | ------------------------------------------------------------------------------------------ |
| Component Quality               | 4/5    | Strong Radix+CVA foundation, well-typed props, good variant system                         |
| Design Tokens                   | 4/5    | Comprehensive HSL variables, but missing semantic spacing/typography/motion tokens         |
| Form Components                 | 4/5    | Excellent RHF+Zod integration, 13 input types, good validation UX                          |
| Layout Components               | 5/5    | AppShell is excellent — responsive, cookie-persisted sidebar, mobile bottom nav, safe area |
| Data Display                    | 4/5    | DataTable with TanStack is solid, but sort/pagination hooks duplicated in apps             |
| Feedback (Toasts/Alerts/Modals) | 3/5    | **Dual toast systems** (Sonner + custom useToast) creates confusion                        |
| Animations (Framer Motion)      | 5/5    | Excellent — reduced-motion support, spring physics, celebration effects                    |
| Accessibility                   | 4/5    | Strong ARIA, keyboard nav, skip links, route announcer — some gaps remain                  |
| Cross-App Consistency           | 3/5    | Auth flows diverge, loading states inconsistent, duplicated components                     |
| Responsive Design               | 4/5    | Mobile-first with bottom nav, but tables are scroll-only (no card fallback)                |
| Shared Hooks and Stores         | 5/5    | 58+ hooks, well-organized Zustand stores, React Query patterns                             |

---

## Part 1: shared-ui Component Library Audit

### 1.1 Component Inventory

| Category      | Count    | Key Components                                                                                                                                                                                    |
| ------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Form Controls | 13       | Button, Input, Textarea, Checkbox, RadioGroup, Select, Switch, Slider, InputOTP, SearchInput, InlineEdit, Label, Form system                                                                      |
| Data Display  | 13       | Card, Table, DataTable, Badge, StatusBadge (20+ variants), StatCard, Avatar, Skeleton, EmptyState (16 presets), ErrorState, Pagination, SortableTableHead, DataTablePagination                    |
| Layout        | 5        | AppShell, AppSidebar, MobileBottomNav, Sidebar (compound), PageHeader                                                                                                                             |
| Feedback      | 13       | Dialog, AlertDialog, Alert, Toast (custom), Sonner, ConfirmDialog, Drawer, RetryErrorCard, OfflineBanner, SWUpdateNotification, PWAInstallBanner                                                  |
| Navigation    | 12       | Breadcrumb, AppBreadcrumb, Tabs, NavigationMenu, DropdownMenu, ContextMenu, Menubar, Command (cmdk), NotificationBell, NotificationDropdown, NotificationsPage, RoleSwitcher                      |
| Animation     | 8        | FadeIn, AnimatedCard, PageTransition, CountUp, CelebrationBurst, Pressable, AnimatedList/Item, SkeletonShimmer                                                                                    |
| Gamification  | 6        | AchievementCard, AchievementBadge, LevelBadge, StreakWidget, MilestoneCard, StudyGoalCard                                                                                                         |
| Charts        | 6        | ProgressRing, ScoreCard, SimpleBarChart, ClassHeatmap, AtRiskBadge, Chart (Recharts)                                                                                                              |
| Auth          | 7        | DirectLoginForm, SchoolCodeLoginForm, SchoolCodeStep, CredentialsStep, OrgSwitcher, OrgPickerDialog, LogoutButton                                                                                 |
| Utility       | 13       | SkipToContent, RouteAnnouncer, ThemeToggle, PrefetchLink, LazyImage, Loading, PageLoader, FilterBar, DataLoadingWrapper, EntityPicker, BulkImportDialog, DownloadPDFButton, RichTextEditor/Viewer |
| Helpers       | 13       | Popover, HoverCard, Tooltip, Collapsible, Accordion, Toggle/ToggleGroup, Progress, Carousel, Resizable, ScrollArea, Separator, AspectRatio                                                        |
| **Total**     | **~91+** |                                                                                                                                                                                                   |

### 1.2 Design Tokens Analysis

#### Strengths

- **HSL-based CSS custom properties** enable runtime theming and tenant branding
- **Comprehensive color palette**: primary, secondary, destructive, muted,
  accent, card, popover, sidebar (all with foreground variants)
- **Gamification tier colors**: silver, gold, platinum, diamond with dedicated
  glow shadows
- **State colors** for progress tracking: locked, available, progress, completed
- **Dark mode** fully supported via `darkMode: ["class"]` with CSS variable
  switching
- **Gradient and shadow tokens** for premium effects (cosmic, space, progress,
  glow)
- **7 custom keyframe animations**: accordion, glow, float, pulse-glow,
  slide-up, cosmic-spin

#### Gaps

| Gap                                     | Impact                                                      | Recommendation                                                              |
| --------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------- |
| **No semantic spacing scale**           | Apps use ad-hoc `gap-2`, `gap-4`, `gap-6` with no rationale | Define `--space-xs` through `--space-2xl`                                   |
| **No typography scale tokens**          | Font sizes default to Tailwind's arbitrary scale            | Define semantic typography: `--font-size-body`, `--font-size-heading-sm/lg` |
| **No elevation/shadow scale**           | Only specific shadows (card, glow, tier)                    | Add general `--shadow-sm`, `--shadow-md`, `--shadow-lg`                     |
| **Border radius limited**               | Single `var(--radius)` with calc() derivatives              | Consider `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-full`       |
| **Success/warning colors undocumented** | Used in apps but not formally tokenized                     | Add `--success`, `--warning` with foregrounds                               |
| **No motion duration tokens**           | Durations hardcoded per component (0.2s, 0.5s, 2s)          | Define `--duration-fast: 150ms`, `--duration-normal`, `--duration-slow`     |

### 1.3 Form Components Assessment

#### Strengths

- React Hook Form + Zod validation is the correct architecture
- `FormField > FormItem > FormLabel > FormControl > FormMessage` is clean and
  composable
- 13 input types cover most use cases
- `SearchInput` standardizes search UX
- `InlineEdit` enables efficient editing without modals
- `FormControl` properly wires `aria-describedby` and `aria-invalid`

#### Gaps

| Gap                                                                            | Recommendation                                             |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| **No shared form schemas** — each app re-defines Zod schemas for same entities | Create `@levelup/shared-schemas` package                   |
| **No DatePicker component** — apps needing dates build custom solutions        | Add shared DatePicker (react-day-picker or Radix Calendar) |
| **No FileUpload component** — LogoUploader is admin-only                       | Extract generic FileUpload/FileDropzone                    |
| **No ComboBox/Autocomplete** — EntityPicker is custom, no generic              | Add Combobox (Command-based or Radix Popover + Input)      |
| **No NumberInput** with locale-aware formatting                                | Add for currency/quantity fields                           |
| **No character count on Textarea**                                             | Add optional `showCharCount` prop                          |

### 1.4 Layout Components Assessment

#### Strengths

- **AppShell** is excellent: responsive sidebar, cookie persistence, bottom nav,
  safe area insets
- **AppSidebar** well-designed: grouped nav, footer content, role switcher,
  active detection
- **MobileBottomNav** with 4-5 items follows mobile best practices
- **AppBreadcrumb** with segment resolvers handles dynamic URLs

#### Gaps

| Gap                                                                 | Recommendation                             |
| ------------------------------------------------------------------- | ------------------------------------------ |
| **No PageContainer** — apps use inconsistent `max-w-*`              | Create with standard max-width and padding |
| **No Section/SectionHeader** — apps repeat heading+content patterns | Create composable section components       |
| **No DetailLayout** — detail pages build custom two-column grids    | Create with sidebar panel + main area      |
| **No ResponsiveGrid** — grid column patterns repeated everywhere    | Create with column presets                 |

### 1.5 Data Display Assessment

#### Strengths

- **DataTable** with TanStack: sorting, filtering, pagination, search, ARIA
- **StatusBadge** with 20+ status variants covers most entity states
- **EmptyState** with 16+ presets provides consistent empty UX
- **Skeleton** is simple and composable
- **DataTable accessibility**: `aria-sort` on headers, `aria-live="polite"` on
  pagination

#### Gaps

| Gap                                                             | Recommendation                                               |
| --------------------------------------------------------------- | ------------------------------------------------------------ |
| **`usePagination` and `useSort` in super-admin, not shared**    | Move to `@levelup/shared-hooks`                              |
| **No shared skeleton presets** for common layouts               | Add `TableSkeleton`, `DashboardSkeleton`, `CardGridSkeleton` |
| **Table responsiveness is scroll-only** — no card-view fallback | Consider `ResponsiveTable` that renders cards on mobile      |
| **No DataList component** for key-value displays                | Create `DataList` / `DescriptionList`                        |
| **SkeletonShimmer presets disconnected from app skeletons**     | Unify skeleton preset system                                 |

### 1.6 Feedback Components Assessment — CRITICAL ISSUE

#### Dual Toast System

Both `sonner` (Toaster/sonnerToast) **AND** a custom `useToast` hook exist in
shared-ui. Additionally, UIStore has its own toast state with 5-second
auto-dismiss timer. This creates:

- **API confusion**: Which toast to use?
- **Dead code**: UIStore toast logic is unused (apps use Sonner)
- **Bundle bloat**: Two toast libraries shipped

**Resolution**: Remove custom `useToast`/`Toast` system. Standardize on Sonner
exclusively. Clean UIStore toast logic. Document usage:

- `toast.success()` — Transient feedback
- `Alert` — Persistent inline message
- `AlertDialog` — Blocking confirmation

#### Other Feedback Gaps

| Gap                                       | Recommendation                                                 |
| ----------------------------------------- | -------------------------------------------------------------- |
| **No standardized error display pattern** | Document: toast (transient), Alert (inline), Dialog (blocking) |
| **No loading overlay component**          | For inline section loading without navigation                  |
| **No undo-capable toast**                 | Sonner supports undo-action toasts                             |

### 1.7 Animation Assessment — EXCELLENT (5/5)

- **Every motion component checks `useReducedMotion()`** — best-in-class
  accessibility
- **FadeIn** supports directional animations with configurable delay/duration
- **AnimatedCard** provides hover lift with spring physics
  (`stiffness: 400, damping: 25`)
- **PageTransition** uses `AnimatePresence` for route transitions
- **CountUp** uses `requestAnimationFrame` (not Framer) — performant
- **CelebrationBurst** with confetti/stars/sparkle variants (24 particles,
  10-color palettes)
- **Pressable** provides micro-interactions with keyboard support (Enter/Space)
- **SkeletonShimmer** with 5 presets (lines, circle, bar-chart, heatmap, card)

#### Minor Gaps

| Gap                                            | Recommendation                                   |
| ---------------------------------------------- | ------------------------------------------------ |
| No staggered list animation                    | Add `staggerDelay` prop to `AnimatedList`        |
| No shared transition presets                   | Create `motionPresets.ts` with named transitions |
| CelebrationBurst particle count not responsive | Reduce on mobile viewports                       |

### 1.8 Accessibility Assessment

#### Strengths

- **SkipToContent** for keyboard users
- **RouteAnnouncer** with `aria-live` for screen reader page changes
- **All Radix components** provide built-in ARIA (Dialog, Select, Tabs, etc.)
- **Focus ring** consistent:
  `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`
- **DataTable** has `aria-sort`, `aria-live` for pagination, `aria-label` on
  search
- **Gamification** has excellent ARIA: `role="article"`, `role="progressbar"`,
  `role="status"`
- **Test utilities** (`a11y-test-utils.ts`) with axe-core integration
- **Semantic HTML** used properly: `<nav>`, `<main>`, `<header>`, `<table>`

#### Gaps

| Gap                                                  | Severity | Recommendation                                        |
| ---------------------------------------------------- | -------- | ----------------------------------------------------- |
| No focus trap utility for non-Radix modals           | MEDIUM   | ChatTutorPanel needs manual focus management          |
| Inconsistent `aria-label` on icon-only buttons       | MEDIUM   | Enforce labels for `Button size="icon"` (dev warning) |
| No error summary for forms                           | MEDIUM   | Announce all errors to screen readers at form submit  |
| Color-only status in some indicators                 | LOW      | Add text/icon differentiation                         |
| No automated a11y in CI                              | MEDIUM   | Integrate existing `a11y-test-utils.ts` into pipeline |
| Missing `aria-describedby` on some login form errors | LOW      | Standardize across all apps                           |

### 1.9 Shared Hooks and Stores Assessment

#### Hooks (shared-hooks) — 58+ Total

| Category       | Count | Key Hooks                                                                                                                                                 |
| -------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UI Hooks       | 7     | `useDebounce`, `useMediaQuery`, `useIsMobile/Tablet/Desktop`, `useClickOutside`, `useLocalStorage`, `useOnlineStatus`, `usePrefetch`, `useTenantBranding` |
| Auth Hooks     | 3     | `useAuth` (React Query + Firebase listener), `useUserId`, `useUserEmail`                                                                                  |
| Data Hooks     | 3     | `useFirestoreDoc`, `useFirestoreCollection`, `useRealtimeDB`                                                                                              |
| Error Handling | 1     | `useApiError` (Sonner toast + Firebase error mapping)                                                                                                     |
| Tenant Hooks   | 1     | `useQuotaStatus` (quota warning levels: none/amber/red/expired)                                                                                           |
| Query Hooks    | 45+   | Spaces, Exams, Items, Students, Classes, Notifications, Achievements, Chat, Analytics, Cost, etc.                                                         |

**Quality**: Excellent. Consistent query key patterns
(`['tenants', tenantId, 'resource']`), enabled checks prevent stale queries,
sensible stale times (5min lists, 30s notifications, 1min user data).

#### Stores (shared-stores) — 4 Zustand Stores

| Store             | Purpose                                      | Persistence                 | Issue                                    |
| ----------------- | -------------------------------------------- | --------------------------- | ---------------------------------------- |
| **AuthStore**     | Firebase auth, memberships, tenant switching | None (real-time)            | Clean                                    |
| **TenantStore**   | Settings, features, branding, usage          | None (real-time)            | Clean                                    |
| **UIStore**       | Sidebar, modal, toasts                       | localStorage (sidebar only) | **Toast code is dead** — apps use Sonner |
| **ConsumerStore** | Shopping cart, purchases                     | localStorage (cart only)    | Clean                                    |

### 1.10 Export Structure

Clean barrel export:

```
src/index.ts
├── components/ui/*           (50+ primitives)
├── components/auth/          (7 via index.ts)
├── components/layout/        (14 via index.ts)
├── components/charts/        (6 via index.ts)
├── components/gamification/  (6 via index.ts)
├── components/motion/        (9 via index.ts)
├── components/feedback/      (1 component)
├── components/editor/        (2 components)
├── EntityPicker, BulkImportDialog, DownloadPDFButton
├── hooks/                    (6 core + 6 metrics)
└── lib/utils                 (cn utility)
```

**Recommendation**: Add `"sideEffects": false` to package.json for tree-shaking.

---

## Part 2: Cross-App UX Pattern Audit

### 2.1 Auth Flow Consistency

| Pattern                    | admin-web       | student-web    | teacher-web     | parent-web                 | super-admin     |
| -------------------------- | --------------- | -------------- | --------------- | -------------------------- | --------------- |
| School Code -> Credentials | Yes             | Yes            | Yes             | Yes                        | No (direct)     |
| Google OAuth               | No              | Yes (consumer) | No              | No                         | No              |
| Forgot Password            | No              | No             | No              | **Yes**                    | No              |
| Password Visibility Toggle | Yes             | Yes            | Yes             | Yes                        | Yes             |
| Error Display              | Inline red text | Inline red box | Inline red text | **Alert+AlertCircle**      | Alert component |
| ARIA on Errors             | No              | No             | No              | **Yes (aria-describedby)** | Partial         |
| Loading Spinner Icon       | No              | No             | No              | **Yes (Loader2)**          | No              |
| Consumer Path (B2C)        | No              | Yes            | No              | No                         | No              |

#### Issues

1. **Error display inconsistent**: Parent-web uses `Alert` + `AlertCircle`
   icon + proper ARIA — best pattern. Others use basic red text.
2. **Forgot Password only in parent-web**: Should be in all school-code flows.
3. **ARIA on errors inconsistent**: Only parent-web has `aria-describedby` +
   `aria-invalid`.
4. **Auth layout differs**: Super-admin has branded two-column; others centered
   card.

**Recommendation**: Standardize on parent-web's approach (Alert errors, ARIA,
forgot password, Loader2). Create unified `SharedAuthForm` in shared-ui.

### 2.2 Navigation Patterns

| Pattern            | admin-web | student-web | teacher-web | parent-web | super-admin |
| ------------------ | --------- | ----------- | ----------- | ---------- | ----------- |
| AppShell + Sidebar | Yes       | Yes         | Yes         | Yes        | Yes         |
| Mobile Bottom Nav  | Yes (5)   | Yes (5)     | Yes (5)     | Yes (4)    | Yes (4)     |
| Breadcrumbs        | **Yes**   | No          | No          | No         | **Yes**     |
| Route Prefetching  | Yes       | Yes         | Yes         | No         | No          |
| Notification Bell  | Yes       | Yes         | Yes         | No         | No          |
| Tenant Branding    | No        | **Yes**     | **Yes**     | No         | No          |
| Role Switcher      | Yes       | Yes         | Yes         | Yes        | No          |
| Theme Toggle       | Yes       | Yes         | Yes         | Yes        | Yes         |

#### Issues

1. **Breadcrumbs only in 2 of 5 apps**: Teacher, student, parent lack breadcrumb
   navigation.
2. **Route prefetching missing in parent-web and super-admin**: Inconsistent
   performance.
3. **Notification bell missing in parent-web**: Parents should get progress
   notifications.
4. **Tenant branding not in admin-web and parent-web**: Inconsistent school
   identity.

### 2.3 Loading States Consistency

| Pattern            | admin-web         | student-web | teacher-web | parent-web        | super-admin |
| ------------------ | ----------------- | ----------- | ----------- | ----------------- | ----------- |
| Suspense Fallback  | PageLoader        | PageLoader  | PageLoader  | PageLoader        | PageLoader  |
| Custom Skeletons   | **3 presets**     | Minimal     | Minimal     | 1 preset          | Inline      |
| Auth Guard Loading | **Full skeleton** | Spinner     | Spinner     | Spinner           | Spinner     |
| Loading ARIA       | No                | Partial     | No          | **role="status"** | Partial     |
| Button Loading     | Text change       | Text change | Text change | **Text+Loader2**  | Text change |

#### Issues

1. **Auth guard loading diverges**: Admin-web shows full sidebar + content
   skeleton (best). Others show spinner.
2. **Skeleton layouts ad-hoc per app**: No shared presets for dashboard, table,
   detail pages.
3. **Loading ARIA inconsistent**: Only parent-web has `role="status"` + sr-only
   text.
4. **DataLoadingWrapper exists in shared-ui but appears underused**.

### 2.4 Error Handling Consistency

| Pattern                    | admin-web           | student-web         | teacher-web         | parent-web          | super-admin         |
| -------------------------- | ------------------- | ------------------- | ------------------- | ------------------- | ------------------- |
| Root Error Boundary        | Yes                 | Yes                 | Yes                 | Yes                 | Yes                 |
| Route Error Boundary       | Yes                 | Yes                 | Yes                 | Yes                 | Yes                 |
| **Section Error Boundary** | No                  | **Yes**             | No                  | No                  | No                  |
| Inline Error Style         | Red border          | AlertTriangle+Retry | Red border          | Alert component     | Alert component     |
| Toast Errors               | sonnerToast.error() | sonnerToast.error() | sonnerToast.error() | sonnerToast.error() | sonnerToast.error() |
| useApiError                | Yes                 | Yes                 | Yes                 | Yes                 | Yes                 |
| Access Denied Page         | Yes                 | Yes                 | Yes                 | Yes                 | No                  |
| 404 Page                   | Yes                 | Yes                 | Yes                 | Yes                 | Yes                 |

#### Issues

1. **SectionErrorBoundary only in student-web**: Prevents full-page crash from
   widget errors. Should be in shared-ui.
2. **Inline error display inconsistent**: Admin/teacher use red border;
   parent/super-admin use Alert. Alert is better.
3. **ErrorState and RetryErrorCard exist in shared-ui but are UNUSED**: Apps
   build ad-hoc error UIs.

### 2.5 Empty States Consistency

| Pattern                | admin-web | student-web | teacher-web | parent-web | super-admin |
| ---------------------- | --------- | ----------- | ----------- | ---------- | ----------- |
| Uses shared EmptyState | Partial   | Partial     | Partial     | Yes        | Yes         |
| Context-aware messages | Yes       | No          | No          | No         | Yes         |
| Action button (CTA)    | No        | No          | No          | No         | **Yes**     |
| Dashed border          | Yes       | Partial     | Yes         | Yes        | Yes         |

#### Issues

1. **16+ EmptyState presets exist but apps often create custom empty states**.
2. **No CTA on most empty states**: Only super-admin includes actionable "Create
   first..." buttons.
3. **Context messages inconsistent**: Search-no-results vs. genuinely-empty
   should differ.

### 2.6 Form Patterns Consistency

| Pattern                  | admin-web          | student-web        | teacher-web | parent-web | super-admin |
| ------------------------ | ------------------ | ------------------ | ----------- | ---------- | ----------- |
| React Hook Form + Zod    | Partial (useState) | Partial (useState) | **Yes**     | Partial    | **Yes**     |
| Form + FormField pattern | Partial            | No                 | **Yes**     | No         | **Yes**     |
| Dialog-based forms       | Yes                | No                 | Yes         | No         | Yes         |
| Inline validation        | Yes                | No                 | Yes         | No         | Yes         |
| FormDescription usage    | No                 | No                 | No          | No         | **Yes**     |
| Submit loading state     | Yes                | Yes                | Yes         | Yes        | Yes         |

#### Issues

1. **Form management inconsistent**: Only teacher-web and super-admin use proper
   RHF+Zod+Form. Others use raw useState.
2. **FormDescription only in super-admin**: Other apps lack field-level helper
   text.
3. **No shared entity forms**: Creating student/teacher/class uses similar
   fields but built independently.

### 2.7 Theme and Responsive Consistency

**Theme**: All apps use same Tailwind preset, all support light/dark. Only
student-web and teacher-web apply tenant branding.

**Responsive**: All apps mobile-first with 768px breakpoint and bottom nav.
Tables scroll-only on mobile. Grid columns vary without standard presets.

### 2.8 Components That Should Be Shared But Are Not

| Component                | Currently In | Reason to Share                    |
| ------------------------ | ------------ | ---------------------------------- |
| `SectionErrorBoundary`   | student-web  | Best granular error recovery       |
| `ConfirmDialog`          | teacher-web  | Deduplicate with shared-ui version |
| `ProgressBar` (animated) | student-web  | Common progress visualization      |
| `NetworkStatusBanner`    | student-web  | Online/offline for all apps        |
| `CountdownTimer`         | student-web  | Timer with `role="timer"`          |
| `FeedbackPanel`          | student-web  | Evaluation display                 |
| `usePagination`          | super-admin  | Table pagination logic             |
| `useSort`                | super-admin  | Table sorting logic                |
| `PerformanceTrendsChart` | parent-web   | Reusable chart                     |
| `QuotaUsageCard`         | admin-web    | Quota visualization                |
| `DashboardSkeleton`      | admin-web    | Common loading layout              |
| `TableSkeleton`          | admin-web    | Common loading layout              |
| `CardGridSkeleton`       | admin-web    | Common loading layout              |

---

## Design System Recommendations

### R1: Eliminate Dual Toast System

**Impact: HIGH | Effort: LOW**

Remove custom `useToast` hook and Toast components. Standardize on Sonner.
Remove dead UIStore toast code. Document:

- `toast.success()` — Action completed
- `toast.error()` — Action failed
- `Alert` — Persistent inline message
- `AlertDialog` — Blocking confirmation

### R2: Create Shared Skeleton Presets

**Impact: HIGH | Effort: LOW**

```tsx
<TableSkeleton columns={5} rows={8} />
<DashboardSkeleton statCards={4} charts={2} />
<CardGridSkeleton columns={3} rows={2} />
<DetailPageSkeleton hasSidebar />
```

### R3: Standardize Form Patterns

**Impact: HIGH | Effort: MEDIUM**

All apps should use RHF + Zod + Form system. Create migration guide. Create
shared entity schemas.

### R4: Unify Auth Error UX

**Impact: MEDIUM | Effort: LOW**

Adopt parent-web's pattern: Alert+AlertCircle, `aria-describedby`, forgot
password, Loader2 spinner.

### R5: Move Utility Hooks and Components to Shared

**Impact: MEDIUM | Effort: LOW**

- `usePagination`, `useSort` -> shared-hooks
- `SectionErrorBoundary` -> shared-ui
- Skeleton presets -> shared-ui
- Consolidate `ConfirmDialog` versions

### R6: Add Missing Design Tokens

**Impact: MEDIUM | Effort: LOW**

```css
--space-1: 0.25rem; --space-2: 0.5rem; --space-4: 1rem;
--space-6: 1.5rem; --space-8: 2rem; --space-12: 3rem;
--duration-fast: 150ms; --duration-normal: 250ms; --duration-slow: 400ms;
--shadow-sm/md/lg; --success; --warning;
```

### R7: Improve Accessibility Consistency

**Impact: MEDIUM | Effort: MEDIUM**

1. Enforce `aria-label` for `Button size="icon"`
2. Add `aria-describedby` to all form errors
3. Add `role="status"` to all loading states
4. Automated a11y tests in CI
5. Audit landmark regions

### R8: Enable Breadcrumbs Everywhere

**Impact: LOW | Effort: LOW**

Add route labels to teacher-web, student-web, parent-web. `AppBreadcrumb`
already exists.

### R9: Apply Tenant Branding Consistently

**Impact: LOW | Effort: LOW**

Add `useTenantBranding()` to admin-web and parent-web AppLayouts.

### R10: Add Missing Form Components

**Impact: MEDIUM | Effort: HIGH**

Priority: DatePicker, FileUpload, Combobox/Autocomplete, NumberInput.

---

## Priority Matrix

### P0 — Critical (Fix Now)

| #   | Issue                                                                               | Impact | Effort | Apps   |
| --- | ----------------------------------------------------------------------------------- | ------ | ------ | ------ |
| 1   | **Dual toast system (Sonner + custom)** — confusing API, dead code, bundle bloat    | HIGH   | LOW    | All 5  |
| 2   | **Form pattern inconsistency (useState vs RHF+Zod)** — validation gaps, a11y issues | HIGH   | MEDIUM | 3 apps |
| 3   | **Auth error UX divergence** — different quality per app                            | HIGH   | LOW    | All 5  |

### P1 — High (This Quarter)

| #   | Issue                                                                        | Impact | Effort | Apps          |
| --- | ---------------------------------------------------------------------------- | ------ | ------ | ------------- |
| 4   | **Shared skeleton presets missing** — every app reinvents loading UX         | MEDIUM | LOW    | All 5         |
| 5   | **usePagination/useSort not shared** — duplicated logic                      | MEDIUM | LOW    | 3 apps        |
| 6   | **SectionErrorBoundary not shared** — only student-web has granular recovery | MEDIUM | LOW    | 4 apps        |
| 7   | **Empty state presets underused** — ad-hoc empty states dominate             | MEDIUM | LOW    | All 5         |
| 8   | **ARIA inconsistency in loading states** — screen reader gaps                | MEDIUM | LOW    | 4 apps        |
| 9   | **Success/warning color tokens undocumented**                                | LOW    | LOW    | shared-ui     |
| 10  | **UIStore toast dead code** — unused timer/queue logic                       | LOW    | LOW    | shared-stores |

### P2 — Medium (Next Quarter)

| #   | Issue                                        | Impact | Effort | Apps           |
| --- | -------------------------------------------- | ------ | ------ | -------------- |
| 11  | **No DatePicker in shared-ui**               | MEDIUM | MEDIUM | admin, teacher |
| 12  | **No FileUpload in shared-ui**               | MEDIUM | MEDIUM | admin          |
| 13  | **Missing spacing/typography/motion tokens** | MEDIUM | MEDIUM | All 5          |
| 14  | **Breadcrumbs only in 2 apps**               | LOW    | LOW    | 3 apps         |
| 15  | **Tenant branding not in admin/parent**      | LOW    | LOW    | 2 apps         |
| 16  | **Automated a11y testing in CI**             | MEDIUM | MEDIUM | All 5          |
| 17  | **Route prefetching missing in 2 apps**      | LOW    | LOW    | 2 apps         |
| 18  | **No notification bell in parent-web**       | LOW    | LOW    | parent         |

### P3 — Low (Backlog)

| #   | Issue                                       | Impact | Effort | Apps      |
| --- | ------------------------------------------- | ------ | ------ | --------- |
| 19  | **Table mobile responsiveness (card view)** | MEDIUM | HIGH   | All 5     |
| 20  | **Shared form schemas package**             | MEDIUM | MEDIUM | All 5     |
| 21  | **PageContainer/Section components**        | LOW    | LOW    | All 5     |
| 22  | **Tree-shaking (sideEffects: false)**       | LOW    | LOW    | shared-ui |
| 23  | **Staggered list animation**                | LOW    | LOW    | shared-ui |
| 24  | **ComboBox/Autocomplete component**         | MEDIUM | MEDIUM | shared-ui |
| 25  | **Login page pre-auth branding**            | LOW    | MEDIUM | 4 apps    |

---

## Appendix: Component Usage Matrix

| Component            |  admin  | student | teacher | parent | super-admin |
| -------------------- | :-----: | :-----: | :-----: | :----: | :---------: |
| AppShell             |   Yes   |   Yes   |   Yes   |  Yes   |     Yes     |
| AppSidebar           |   Yes   |   Yes   |   Yes   |  Yes   |     Yes     |
| AppBreadcrumb        |   Yes   |   No    |   No    |   No   |     Yes     |
| SkipToContent        |   Yes   |   Yes   |   Yes   |  Yes   |     Yes     |
| RouteAnnouncer       |   Yes   |   Yes   |   Yes   |  Yes   |     Yes     |
| ThemeToggle          |   Yes   |   Yes   |   Yes   |  Yes   |     Yes     |
| NotificationBell     |   Yes   |   Yes   |   Yes   |   No   |     No      |
| MobileBottomNav      |   Yes   |   Yes   |   Yes   |  Yes   |     Yes     |
| RoleSwitcher         |   Yes   |   Yes   |   Yes   |  Yes   |     No      |
| PageLoader           |   Yes   |   Yes   |   Yes   |  Yes   |     Yes     |
| PageTransition       |   Yes   |   Yes   |   Yes   |  Yes   |     Yes     |
| RouteErrorBoundary   |   Yes   |   Yes   |   Yes   |  Yes   |     Yes     |
| NotFoundPage         |   Yes   |   Yes   |   Yes   |  Yes   |     Yes     |
| EmptyState           | Partial |   Yes   | Partial |  Yes   |     Yes     |
| ErrorState           |   No    |   No    |   No    |   No   |     No      |
| RetryErrorCard       |   No    |   No    |   No    |   No   |     No      |
| StatusBadge          |   Yes   |   No    |   No    |   No   |     Yes     |
| StatCard             |   Yes   |   No    |   No    |   No   |     Yes     |
| DataTable            |   Yes   |   No    |   Yes   |   No   |     Yes     |
| FadeIn               |   Yes   |   Yes   |   Yes   |  Yes   |     Yes     |
| AnimatedCard         |   Yes   |   Yes   |   Yes   |  Yes   |     Yes     |
| Pressable            |   No    |   Yes   |   No    |   No   |     No      |
| CelebrationBurst     |   No    |   Yes   |   No    |   No   |     No      |
| LevelBadge           |   No    |   Yes   |   No    |   No   |     No      |
| AchievementBadge     |   No    |   Yes   |   No    |   No   |     No      |
| StreakWidget         |   No    |   Yes   |   No    |   No   |     No      |
| ProgressRing         |   No    |   No    |   No    |  Yes   |     No      |
| SimpleBarChart       |   Yes   |   No    |   Yes   |   No   |     No      |
| ClassHeatmap         |   No    |   No    |   Yes   |   No   |     No      |
| LogoutButton         |   Yes   |   Yes   |   Yes   |  Yes   |     Yes     |
| PWAInstallBanner     |   No    |   Yes   |   Yes   |  Yes   |     No      |
| OfflineBanner        |   No    |   Yes   |   Yes   |  Yes   |     No      |
| SWUpdateNotification |   No    |   Yes   |   Yes   |  Yes   |     No      |
| useTenantBranding()  |   No    |   Yes   |   Yes   |   No   |     No      |
| usePrefetch()        |   Yes   |   Yes   |   Yes   |   No   |     No      |

---

## Appendix: Technology Stack

| Layer          | Technology                                     |
| -------------- | ---------------------------------------------- |
| UI Framework   | React 18+ with TypeScript                      |
| Styling        | Tailwind CSS + CVA + CSS Variables             |
| Primitives     | Radix UI                                       |
| Animation      | Framer Motion                                  |
| Forms          | React Hook Form + Zod (inconsistently adopted) |
| Data Tables    | TanStack React Table                           |
| State (Global) | Zustand (4 stores)                             |
| State (Server) | TanStack Query v5 (45+ hooks)                  |
| Backend        | Firebase (Auth, Firestore, RTDB, Functions)    |
| Icons          | lucide-react                                   |
| Toasts         | Sonner (+unused custom system)                 |
| Router         | React Router (lazy-loaded)                     |
| Command        | cmdk                                           |
| PWA            | Service Worker + custom banners                |

---

_Generated by UX Audit Agent — Auto-LevelUp Platform — 2026-03-09_
