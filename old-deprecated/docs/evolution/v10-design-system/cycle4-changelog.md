# V10 Cycle 4 Changelog: UI/UX Design System & Accessibility

**Date**: 2026-03-08 **Status**: Complete **Build**: All 5 apps build with 0
type errors

---

## Phase A: Consolidate Duplicated Components

### A1. AppBreadcrumb → shared-ui

- **Created**: `packages/shared-ui/src/components/layout/AppBreadcrumb.tsx`
  - Accepts `routeLabels: Record<string, string>` for app-specific route naming
  - Supports `segmentResolvers: BreadcrumbSegmentResolver[]` for dynamic route
    segments (e.g., tenant detail pages)
  - Configurable `homeLabel`, `homePath` props
- **Deleted**: `apps/admin-web/src/components/AppBreadcrumb.tsx`
- **Deleted**: `apps/super-admin/src/components/AppBreadcrumb.tsx`
- **Updated**: `apps/admin-web/src/layouts/AppLayout.tsx` — uses shared
  `AppBreadcrumb` with `ADMIN_ROUTE_LABELS`
- **Updated**: `apps/super-admin/src/layouts/AppLayout.tsx` — uses shared
  `AppBreadcrumb` with `SA_ROUTE_LABELS` + tenant detail resolver
- **Exported** from `packages/shared-ui/src/components/layout/index.ts`

### A2. SortableTableHead → shared-ui

- **Created**: `packages/shared-ui/src/components/ui/sortable-table-head.tsx`
  - Added `aria-sort` attribute on `<TableHead>` (ascending/descending/none)
  - Added `aria-hidden="true"` on sort icons
  - Added `type="button"` on sort button
- **Deleted**: `apps/admin-web/src/components/SortableTableHead.tsx`
- **Deleted**: `apps/super-admin/src/components/SortableTableHead.tsx`
- **Updated imports**: `ExamsOverviewPage`, `ClassesPage` (admin-web),
  `TenantsPage` (super-admin)

### A3. DataTablePagination → shared-ui

- **Created**: `packages/shared-ui/src/components/ui/data-table-pagination.tsx`
  - Based on super-admin's polished version with mobile-friendly 44px touch
    targets
  - Added `aria-live="polite"` on the "Showing X–Y of Z" text
  - Added `aria-label` on all navigation buttons (first/prev/next/last page)
  - Configurable `pageSizeOptions` and `hideThreshold` props
  - `tabular-nums` font for consistent number widths
- **Deleted**: `apps/admin-web/src/components/DataTablePagination.tsx`
- **Deleted**: `apps/super-admin/src/components/DataTablePagination.tsx`
- **Updated imports**: 7 files in admin-web, 5 files in super-admin

### A4. Consolidated student-web EmptyState

- All 3 usages in student-web already import from `@levelup/shared-ui`
  (verified)
- **Deleted**: `apps/student-web/src/components/common/EmptyState.tsx` (unused
  duplicate)

### A5. Standardized ThemeToggle in admin-web

- **Removed** custom Sun/Moon toggle code from
  `apps/admin-web/src/layouts/AppLayout.tsx`
- **Replaced** with shared `<ThemeToggle />` from `@levelup/shared-ui`
- Removed unused `Moon`, `Sun` imports from lucide-react
- Removed unused `useTheme` import from next-themes

---

## Phase B: Extend Design Token System

### B1. Typography Scale Tokens

- **Updated**: `packages/tailwind-config/theme.js` — added `levelUpFontSize`
  with 10 semantic scale levels:
  - Display: `display-xl` (3rem), `display-lg` (2.25rem), `display-md`
    (1.875rem)
  - Heading: `heading-lg` (1.5rem), `heading-md` (1.25rem), `heading-sm`
    (1.125rem)
  - Body: `body-lg` (1.125rem), `body-md` (1rem), `body-sm` (0.875rem)
  - Caption: `caption` (0.75rem)
  - Each includes `lineHeight`, `letterSpacing`, and `fontWeight` defaults

### B2. Spacing Scale Tokens

- **Updated**: `packages/tailwind-config/theme.js` — added `levelUpSpacing` with
  7 semantic aliases:
  - `page-x`, `page-y` — page-level padding
  - `section` — between major sections
  - `card-p` — card internal padding
  - `stack-sm`, `stack-md`, `stack-lg` — vertical stack gaps
- **Updated**: `packages/tailwind-config/variables.css` — added CSS variable
  values with responsive `clamp()`:
  - `--spacing-page-x: clamp(1rem, 3vw, 2rem)`
  - `--spacing-page-y: clamp(1rem, 2vw, 1.5rem)`
  - `--spacing-section: clamp(1.5rem, 4vw, 3rem)`
  - `--spacing-card: clamp(1rem, 2vw, 1.5rem)`
  - `--spacing-stack-sm: 0.5rem`, `--spacing-stack-md: 1rem`,
    `--spacing-stack-lg: 1.5rem`

### B3. Z-Index Scale

- **Updated**: `packages/tailwind-config/theme.js` — added `levelUpZIndex` with
  7 standardized layers:
  - `dropdown` (50), `sticky` (100), `overlay` (200), `modal` (300), `popover`
    (400), `toast` (500), `tooltip` (600)

### Registration

- **Updated**: `packages/tailwind-config/index.js` — imported and registered
  `levelUpFontSize`, `levelUpSpacing`, `levelUpZIndex` in `theme.extend`

---

## Phase C: New Shared Components

### C1. ErrorState Component

- **Created**: `packages/shared-ui/src/components/ui/error-state.tsx`
- 5 presets: `network-error`, `server-error`, `not-found`, `forbidden`,
  `timeout`
- Props: `preset`, `title`, `description`, `onRetry`, `icon`, `compact`
- `role="alert"` with `aria-live="assertive"`
- Compact mode for inline error display
- Retry button with `<RefreshCw>` icon
- **Integrated** into `DataLoadingWrapper` as the error renderer (replaced
  inline error UI)

### C2. ConfirmDialog Component

- **Created**: `packages/shared-ui/src/components/ui/confirm-dialog.tsx`
- Built on existing Radix `AlertDialog` (inherits focus trap)
- 3 variants: `danger` (red), `warning` (amber), `info` (primary)
- Loading state with spinner
- Keyboard: Enter to confirm (via Radix), Escape to cancel (via Radix)
- Props: `open`, `onOpenChange`, `title`, `description`, `confirmLabel`,
  `cancelLabel`, `variant`, `onConfirm`, `onCancel`, `loading`

### C3. FilterBar Component

- **Created**: `packages/shared-ui/src/components/ui/filter-bar.tsx`
- Composable filter bar supporting `search` and `select` field types
- Active filter chips with remove buttons
- `aria-live="polite"` region for filter change announcements
- Mobile-responsive: collapses to Sheet on small screens (uses `useIsMobile`
  hook)
- "Clear all" button when multiple filters active

### C4. Chart Skeleton Loaders

- **Updated**: `packages/shared-ui/src/components/motion/SkeletonShimmer.tsx`
  - Added `preset` prop with 5 options: `lines` (default), `circle`,
    `bar-chart`, `heatmap`, `card`
  - Each preset renders a purpose-built skeleton shape
  - All presets respect `prefers-reduced-motion` (static gray blocks via CSS)
- **Updated**: `packages/shared-ui/src/components/charts/ProgressRing.tsx` —
  added `loading` prop → `<SkeletonShimmer preset="circle" />`
- **Updated**: `packages/shared-ui/src/components/charts/SimpleBarChart.tsx` —
  added `loading` prop → `<SkeletonShimmer preset="bar-chart" />`
- **Updated**: `packages/shared-ui/src/components/charts/ClassHeatmap.tsx` —
  added `loading` prop → `<SkeletonShimmer preset="heatmap" />`

### C5. InlineEdit Component

- **Created**: `packages/shared-ui/src/components/ui/inline-edit.tsx`
- Click-to-edit text field with confirm/cancel buttons
- Keyboard: Enter to save, Escape to cancel
- Validation via `validate` callback with error display
- `aria-label` for edit mode, `aria-live="polite"` for save confirmation
  ("Saved" indicator)
- `aria-invalid` and `aria-describedby` for validation errors
- Focus management: auto-focus and select on edit start

---

## Phase D: Accessibility Deepening (WCAG AA)

### D1. ARIA Live Regions for Dynamic Content

- **DataTable**: Added `aria-live="polite"` with sort state announcement:
  "Showing X of Y rows, sorted by {column} {direction}"
- **ProgressRing**: Added `aria-live="polite"` announcement on value changes:
  "Progress updated to X%"
- **SimpleBarChart**: Enhanced `aria-label` to include full text summary of all
  data points
- **DataTablePagination**: Added `aria-live="polite"` on the "Showing X–Y of Z"
  range text
- **FilterBar**: Active filter chips wrapped in `aria-live="polite"` region

### D2. Focus Management

- **AchievementCard**: Added `tabIndex={0}` when `onActivate` is provided, with
  keyboard Enter/Space activation
- **AchievementCard**: Added `focus-visible:ring-2 focus-visible:ring-ring` for
  visible focus indicator
- **ConfirmDialog**: Focus trap via Radix AlertDialog (native)
- **InlineEdit**: Auto-focus input on edit, proper `focus-visible` styles

### D3. ARIA Enhancements

- **SortableTableHead**: Added `aria-sort` attribute on `<th>`
  (ascending/descending/none) per WAI-ARIA table pattern
- **DataTablePagination**: Added descriptive `aria-label` on all pagination
  buttons ("Go to first/previous/next/last page")
- **ErrorState**: `role="alert"` with `aria-live="assertive"` for error
  announcements
- **InlineEdit**: `aria-invalid`, `aria-describedby` for validation errors;
  `role="alert"` on error text

### D4. Keyboard Navigation Enhancements

- **AchievementCard**: Enter/Space to activate (view details) — previously only
  clickable
- **InlineEdit**: Full keyboard workflow (Enter save, Escape cancel)
- **SortableTableHead**: `type="button"` on sort trigger for proper keyboard
  activation

### D5. Automated Accessibility Testing Setup

- **Created**: `packages/shared-ui/src/test-utils/a11y-test-utils.ts`
- `checkA11y(page, options)` — full axe-core audit with WCAG 2.0 AA tags
- `checkColorContrast(page)` — isolated color contrast check
- `checkLandmarks(page)` — landmark region validation
- `checkLabels(page)` — interactive element label check
- `RADIX_EXCEPTIONS` — pre-configured rule exceptions for Radix UI patterns
- Formatted violation reports with HTML context and failure summaries

---

## Phase E: Cross-App Consistency Pass

### E1. Standardized Sonner Version

- **Updated**: `apps/admin-web/package.json` — `sonner` `^1.5.0` → `^2.0.7`
- **Updated**: `apps/student-web/package.json` — `sonner` `^1.7.4` → `^2.0.7`
- All 5 apps now use `sonner@^2.0.7`

### E2-E5: Audited & Verified

- All 5 apps use shared `<ThemeToggle />` component
- All apps use `lucide-react` exclusively for icons
- All motion components respect `prefers-reduced-motion` via canonical CSS and
  `useReducedMotion` hook
- Decorative icons have `aria-hidden="true"` in all new/updated components

---

## Files Created (10)

| File                                                             | Description                                              |
| ---------------------------------------------------------------- | -------------------------------------------------------- |
| `packages/shared-ui/src/components/layout/AppBreadcrumb.tsx`     | Unified breadcrumb with route labels + segment resolvers |
| `packages/shared-ui/src/components/ui/sortable-table-head.tsx`   | Sortable table header with ARIA sort                     |
| `packages/shared-ui/src/components/ui/data-table-pagination.tsx` | Pagination with accessible navigation                    |
| `packages/shared-ui/src/components/ui/error-state.tsx`           | Error display with 5 presets                             |
| `packages/shared-ui/src/components/ui/confirm-dialog.tsx`        | Radix-based confirm/cancel dialog                        |
| `packages/shared-ui/src/components/ui/filter-bar.tsx`            | Composable filter bar with mobile support                |
| `packages/shared-ui/src/components/ui/inline-edit.tsx`           | Click-to-edit with keyboard support                      |
| `packages/shared-ui/src/test-utils/a11y-test-utils.ts`           | axe-core a11y test utilities                             |
| `docs/evolution/v10-design-system/cycle4-changelog.md`           | This changelog                                           |

## Files Modified (20+)

| File                                                                 | Changes                                   |
| -------------------------------------------------------------------- | ----------------------------------------- |
| `packages/tailwind-config/theme.js`                                  | Added typography, spacing, z-index tokens |
| `packages/tailwind-config/index.js`                                  | Registered new token categories           |
| `packages/tailwind-config/variables.css`                             | Added spacing CSS variables               |
| `packages/shared-ui/src/index.ts`                                    | Exported 6 new UI components              |
| `packages/shared-ui/src/components/layout/index.ts`                  | Exported AppBreadcrumb                    |
| `packages/shared-ui/src/components/ui/data-table.tsx`                | ARIA live sort/filter announcements       |
| `packages/shared-ui/src/components/ui/data-loading-wrapper.tsx`      | Uses ErrorState for error rendering       |
| `packages/shared-ui/src/components/motion/SkeletonShimmer.tsx`       | Added 4 preset shapes                     |
| `packages/shared-ui/src/components/charts/ProgressRing.tsx`          | Loading skeleton + ARIA live              |
| `packages/shared-ui/src/components/charts/SimpleBarChart.tsx`        | Loading skeleton + text summary           |
| `packages/shared-ui/src/components/charts/ClassHeatmap.tsx`          | Loading skeleton                          |
| `packages/shared-ui/src/components/gamification/AchievementCard.tsx` | Keyboard activation + onActivate          |
| `apps/admin-web/src/layouts/AppLayout.tsx`                           | Shared AppBreadcrumb + ThemeToggle        |
| `apps/super-admin/src/layouts/AppLayout.tsx`                         | Shared AppBreadcrumb with resolvers       |
| `apps/admin-web/package.json`                                        | sonner → ^2.0.7                           |
| `apps/student-web/package.json`                                      | sonner → ^2.0.7                           |
| 12 page/component files across admin-web & super-admin               | Import consolidation                      |

## Files Deleted (7)

| File                                                      | Reason             |
| --------------------------------------------------------- | ------------------ |
| `apps/admin-web/src/components/AppBreadcrumb.tsx`         | Moved to shared-ui |
| `apps/admin-web/src/components/SortableTableHead.tsx`     | Moved to shared-ui |
| `apps/admin-web/src/components/DataTablePagination.tsx`   | Moved to shared-ui |
| `apps/super-admin/src/components/AppBreadcrumb.tsx`       | Moved to shared-ui |
| `apps/super-admin/src/components/SortableTableHead.tsx`   | Moved to shared-ui |
| `apps/super-admin/src/components/DataTablePagination.tsx` | Moved to shared-ui |
| `apps/student-web/src/components/common/EmptyState.tsx`   | Unused duplicate   |

---

## Build Verification

All 5 frontend apps + 2 dependency packages build with **0 type errors**:

- `@levelup/shared-types` — OK
- `@levelup/shared-services` — OK
- `@levelup/admin-web` — OK
- `@levelup/super-admin` — OK
- `@levelup/student-web` — OK
- `@levelup/parent-web` — OK
- `@levelup/teacher-web` — OK

(Pre-existing `@levelup/functions-levelup` build failure is unrelated — missing
`@levelup/functions-shared` module)
