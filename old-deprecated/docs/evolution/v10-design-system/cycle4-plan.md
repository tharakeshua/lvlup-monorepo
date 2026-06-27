# V10 Cycle 4 Plan: UI/UX Design System & Accessibility

**Vertical**: V10 — UI/UX Design System & Accessibility **Cycle**: 4 **Status**:
Planned **Date**: 2026-03-08

---

## Executive Summary

Cycles 1–3 built a comprehensive design system: canonical CSS variables, 100+
shared-ui components, Framer Motion integration, accessibility primitives
(SkipToContent, RouteAnnouncer, ThemeToggle), and dark/light/high-contrast mode
support. Cycle 4 focuses on **consolidating duplicated patterns**, **extending
the token system for spacing & typography**, **adding missing utility
components**, **deepening WCAG AA compliance**, and **ensuring pixel-perfect
cross-app consistency**.

---

## Current State Audit Summary

### Strengths

- Canonical `variables.css` replaced ~400 lines of duplicated CSS across 5 apps
- 100+ shared-ui components (63 UI + 8 motion + 6 gamification + 5 chart + 12
  layout + 6 auth)
- Framer Motion v11.15 with `useReducedMotion` hook — all 8 motion components
  respect `prefers-reduced-motion`
- Class-based dark mode (`next-themes`) with high-contrast CSS overlays
- TanStack React Table-powered DataTable with sort/filter/paginate
- 23-variant StatusBadge, 10-preset EmptyState, StatCard with trends,
  ProgressRing with ARIA

### Gaps Identified

| #   | Gap                                         | Severity | Details                                                                                                                                                                             |
| --- | ------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1  | Component duplication across apps           | High     | AppBreadcrumb (admin-web, super-admin), SortableTableHead (admin-web, super-admin), DataTablePagination (admin-web, super-admin), EmptyState (student-web has simplified duplicate) |
| G2  | ThemeToggle inconsistency                   | Medium   | admin-web uses custom Sun/Moon toggle instead of shared ThemeToggle                                                                                                                 |
| G3  | Missing spacing & typography tokens         | Medium   | Design tokens cover colors, shadows, gradients, animations — but no standardized spacing scale or typography scale beyond Tailwind defaults                                         |
| G4  | No `ErrorState` component                   | Medium   | DataLoadingWrapper has inline error UI; no reusable standalone ErrorState                                                                                                           |
| G5  | No `ConfirmDialog` component                | Medium   | Alert dialogs exist but no standardized confirm/cancel pattern                                                                                                                      |
| G6  | Limited ARIA live regions                   | Medium   | Only RouteAnnouncer, FormMessage, NotificationBell have `aria-live`; dynamic data updates (charts, tables, filters) are silent                                                      |
| G7  | No automated accessibility testing          | High     | WCAG AA compliance is manually verified; no axe-core or Playwright a11y integration                                                                                                 |
| G8  | Sonner version mismatch                     | Low      | admin-web/student-web: 1.5.0–1.7.4 vs parent-web/teacher-web/super-admin: 2.0.7                                                                                                     |
| G9  | No component documentation site             | Low      | README exists but no Storybook or live component gallery                                                                                                                            |
| G10 | Missing loading patterns for new components | Low      | DataTable, StatCard have loading states; charts and gamification components lack standardized skeleton patterns                                                                     |

---

## Cycle 4 Phases

### Phase A: Consolidate Duplicated Components

**Priority**: High | **Estimated Files**: 12–15

#### A1. Move AppBreadcrumb to shared-ui

- Create `packages/shared-ui/src/components/layout/AppBreadcrumb.tsx`
- Accept a `routeLabels: Record<string, string>` prop for app-specific route
  naming
- Support dynamic segment resolution (e.g., tenant detail names)
- Delete `apps/admin-web/src/components/AppBreadcrumb.tsx`
- Delete `apps/super-admin/src/components/AppBreadcrumb.tsx`
- Update imports in both apps

#### A2. Move SortableTableHead to shared-ui

- Create `packages/shared-ui/src/components/ui/sortable-table-head.tsx`
- Integrate with existing DataTable component or export standalone
- Add ARIA `aria-sort` attributes (ascending/descending/none)
- Delete duplicates from admin-web and super-admin
- Update imports

#### A3. Move DataTablePagination to shared-ui

- Create `packages/shared-ui/src/components/ui/data-table-pagination.tsx`
- Ensure it integrates with existing `DataTable` component
- Delete duplicates from admin-web and super-admin
- Update imports

#### A4. Consolidate student-web EmptyState

- Remove `apps/student-web/src/components/EmptyState.tsx`
- Update all student-web imports to use `@levelup/shared-ui` EmptyState
- Map existing usage to appropriate presets

#### A5. Standardize ThemeToggle in admin-web

- Replace admin-web's custom theme toggle with shared `ThemeToggle` from
  `@levelup/shared-ui`
- Remove inline Sun/Moon icon toggle code
- Verify visual consistency with other 4 apps

---

### Phase B: Extend Design Token System

**Priority**: Medium | **Estimated Files**: 3–5

#### B1. Typography Scale Tokens

Add to `packages/tailwind-config/theme.js`:

```js
levelUpFontSize: {
  'display-xl': ['3rem', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '700' }],
  'display-lg': ['2.25rem', { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '700' }],
  'display-md': ['1.875rem', { lineHeight: '1.25', letterSpacing: '-0.01em', fontWeight: '600' }],
  'heading-lg': ['1.5rem', { lineHeight: '1.3', fontWeight: '600' }],
  'heading-md': ['1.25rem', { lineHeight: '1.4', fontWeight: '600' }],
  'heading-sm': ['1.125rem', { lineHeight: '1.4', fontWeight: '600' }],
  'body-lg': ['1.125rem', { lineHeight: '1.6' }],
  'body-md': ['1rem', { lineHeight: '1.5' }],
  'body-sm': ['0.875rem', { lineHeight: '1.5' }],
  'caption': ['0.75rem', { lineHeight: '1.4' }],
}
```

#### B2. Spacing Scale Tokens

Add semantic spacing aliases:

```js
levelUpSpacing: {
  'page-x': 'var(--spacing-page-x)',    // Horizontal page padding
  'page-y': 'var(--spacing-page-y)',    // Vertical page padding
  'section': 'var(--spacing-section)',  // Between sections
  'card-p': 'var(--spacing-card)',      // Card internal padding
  'stack-sm': 'var(--spacing-stack-sm)', // Small vertical gap
  'stack-md': 'var(--spacing-stack-md)', // Medium vertical gap
  'stack-lg': 'var(--spacing-stack-lg)', // Large vertical gap
}
```

Define CSS variable values in `variables.css` for light/dark (responsive values
via `clamp()`).

#### B3. Z-Index Scale

Add standardized z-index tokens:

```js
levelUpZIndex: {
  'dropdown': '50',
  'sticky': '100',
  'overlay': '200',
  'modal': '300',
  'popover': '400',
  'toast': '500',
  'tooltip': '600',
}
```

---

### Phase C: New Shared Components

**Priority**: Medium | **Estimated Files**: 6–8

#### C1. ErrorState Component

- `packages/shared-ui/src/components/ui/error-state.tsx`
- Props: `title`, `description`, `onRetry`, `icon`, `compact`
- Default retry button with `aria-label`
- Presets: `network-error`, `server-error`, `not-found`, `forbidden`, `timeout`
- `role="alert"` with `aria-live="assertive"`
- Integrates with DataLoadingWrapper as the error renderer

#### C2. ConfirmDialog Component

- `packages/shared-ui/src/components/ui/confirm-dialog.tsx`
- Built on existing AlertDialog (Radix)
- Props: `title`, `description`, `confirmLabel`, `cancelLabel`, `variant`
  (danger/warning/info), `onConfirm`, `onCancel`, `loading`
- Focus trap via Radix AlertDialog
- Destructive variant with red confirm button
- Keyboard: Enter to confirm, Escape to cancel

#### C3. FilterBar Component

- `packages/shared-ui/src/components/ui/filter-bar.tsx`
- Composable filter bar for DataTable integration
- Supports: search input, select dropdowns, date range, active filter chips
- Announces filter changes via `aria-live="polite"` region
- Mobile-responsive: collapses to sheet on small screens

#### C4. Chart Skeleton Loaders

- Add loading skeleton variants to ProgressRing, SimpleBarChart, ClassHeatmap
- Extend `SkeletonShimmer` with preset shapes: `circle`, `bar-chart`, `heatmap`
- Ensure reduced-motion support (static gray blocks instead of shimmer)

#### C5. InlineEdit Component

- `packages/shared-ui/src/components/ui/inline-edit.tsx`
- Click-to-edit text field with confirm/cancel
- Keyboard support: Enter to save, Escape to cancel
- `aria-label` for edit mode, `aria-live` for save confirmation
- Supports validation via callback

---

### Phase D: Accessibility Deepening (WCAG AA)

**Priority**: High | **Estimated Files**: 15–20

#### D1. ARIA Live Regions for Dynamic Content

- **DataTable**: Announce sort changes, filter results count, page changes
  - `aria-live="polite"`: "Showing 1–10 of 42 results, sorted by Name ascending"
- **Charts**: Announce data updates for screen readers
  - ProgressRing: Announce value changes
  - SimpleBarChart: Provide text summary alternative
- **StatCard**: Announce trend changes
- **Gamification**: Announce achievement unlocks, streak updates, level-ups

#### D2. Focus Management Audit

- **Modal/Dialog focus trap**: Verify all dialogs (Dialog, Sheet, Drawer,
  AlertDialog) trap focus correctly (Radix native — verify integration)
- **Dropdown menus**: Verify arrow key navigation in all dropdown/select
  components
- **Toast notifications**: Ensure toasts don't steal focus; verify
  `role="status"` and `aria-live="polite"` on Sonner
- **Route transitions**: Verify focus moves to main content on page navigation
  (integrate with RouteAnnouncer)

#### D3. Color Contrast Verification

- Audit all semantic color pairs against WCAG AA (4.5:1 for text, 3:1 for large
  text/UI)
- Verify in all 4 modes: light, dark, high-contrast light, high-contrast dark
- Known risk areas:
  - `muted-foreground` on `muted` background (light mode: 215.4 16.3% 46.9% on
    210 40% 96.1%)
  - `warning-foreground` on `warning` background
  - Chart colors on card backgrounds
  - Tier colors (silver, gold) on card backgrounds
- Fix any failing pairs by adjusting CSS variables

#### D4. Keyboard Navigation Enhancements

- Add visible keyboard shortcut hints to key actions (e.g., "Press / to search")
- Ensure all interactive gamification components are keyboard-operable:
  - AchievementCard: focusable, Enter to view details
  - MilestoneCard: focusable, keyboard-navigable progress
  - StreakWidget: `role="status"` already exists — verify focus order
- Add `tabindex="0"` where missing on clickable non-button elements

#### D5. Automated Accessibility Testing Setup

- Add `@axe-core/playwright` to dev dependencies
- Create accessibility test utilities:
  - `a11y-test-utils.ts` with `checkA11y()` helper
  - Integration with existing Playwright test setup
- Write baseline a11y tests for critical pages in each app:
  - Login page, dashboard, main feature page per app
  - Test for: violations, color contrast, label presence, landmark regions
- Add `a11y:audit` npm script that runs axe scans

---

### Phase E: Cross-App Consistency Pass

**Priority**: Medium | **Estimated Files**: 10–12

#### E1. Standardize Sonner Version

- Update all apps to `sonner@^2.0.7`
- Verify toast behavior consistency across apps
- Ensure toast container has proper `aria-live` region

#### E2. Page Layout Audit

- Verify all 5 apps use consistent page structure:
  - `AppShell` wrapper → `PageHeader` → content area
  - Consistent padding using new spacing tokens (`page-x`, `page-y`)
  - Consistent max-width and responsive breakpoints
- Identify and fix any apps using ad-hoc layout patterns

#### E3. Loading State Consistency

- Audit all pages for loading state patterns:
  - Use `DataLoadingWrapper` for all async data
  - Use `SkeletonShimmer` for page-level loading
  - Use `Skeleton` for inline loading
- Replace any raw spinner/loading patterns with shared components

#### E4. Icon Usage Audit

- Verify all apps use `lucide-react` exclusively (no mixed icon libraries)
- Ensure all decorative icons have `aria-hidden="true"`
- Ensure all meaningful icons have `aria-label` or adjacent text
- Standardize icon sizes: 16px (inline), 20px (button), 24px (header)

#### E5. Animation Consistency

- Verify all page transitions use shared `PageTransition` component
- Verify all list renders use `AnimatedList` where appropriate
- Ensure no raw CSS animations exist outside the shared token system
- Verify `prefers-reduced-motion` is respected everywhere

---

## Implementation Priority Matrix

| Phase                | Priority | Effort | Impact | Dependencies                     |
| -------------------- | -------- | ------ | ------ | -------------------------------- |
| **A: Consolidate**   | High     | Medium | High   | None                             |
| **D: Accessibility** | High     | High   | High   | A (uses consolidated components) |
| **B: Tokens**        | Medium   | Low    | Medium | None                             |
| **C: Components**    | Medium   | Medium | Medium | B (uses new tokens)              |
| **E: Consistency**   | Medium   | Medium | Medium | A, B, C                          |

**Recommended execution order**: A → B → C → D → E (with D starting in parallel
after A completes)

---

## Success Criteria

1. **Zero component duplication**: All shared patterns live in
   `packages/shared-ui/`
2. **ThemeToggle consistency**: All 5 apps use the shared ThemeToggle component
3. **Typography & spacing tokens**: Standardized scales used across all apps
4. **WCAG AA automated**: axe-core tests pass on all critical pages in all 5
   apps
5. **Color contrast verified**: All color pairs meet 4.5:1 ratio in all 4 theme
   modes
6. **ARIA live regions**: Dynamic content (tables, charts, filters) announced to
   screen readers
7. **Keyboard navigation**: All interactive elements operable via keyboard
8. **Sonner standardized**: Single version across all apps
9. **Build**: 11/11 packages build with 0 type errors
10. **Animations**: All animations respect `prefers-reduced-motion`

---

## Files to Create/Modify

### New Files (~10)

- `packages/shared-ui/src/components/layout/AppBreadcrumb.tsx`
- `packages/shared-ui/src/components/ui/sortable-table-head.tsx`
- `packages/shared-ui/src/components/ui/data-table-pagination.tsx`
- `packages/shared-ui/src/components/ui/error-state.tsx`
- `packages/shared-ui/src/components/ui/confirm-dialog.tsx`
- `packages/shared-ui/src/components/ui/filter-bar.tsx`
- `packages/shared-ui/src/components/ui/inline-edit.tsx`
- `packages/shared-ui/src/test-utils/a11y-test-utils.ts`
- Baseline a11y test files per app

### Modified Files (~25)

- `packages/tailwind-config/theme.js` — typography, spacing, z-index tokens
- `packages/tailwind-config/variables.css` — spacing CSS variables
- `packages/tailwind-config/index.js` — register new token categories
- `packages/shared-ui/src/components/ui/data-table.tsx` — ARIA live
  announcements
- `packages/shared-ui/src/components/ui/data-loading-wrapper.tsx` — integrate
  ErrorState
- `packages/shared-ui/src/components/charts/ProgressRing.tsx` — skeleton +
  aria-live
- `packages/shared-ui/src/components/charts/SimpleBarChart.tsx` — skeleton +
  text alt
- `packages/shared-ui/src/components/charts/ClassHeatmap.tsx` — skeleton
- `packages/shared-ui/src/components/motion/SkeletonShimmer.tsx` — preset shapes
- `packages/shared-ui/src/components/gamification/*.tsx` — keyboard + aria
  enhancements
- `packages/shared-ui/src/index.ts` — export new components
- `apps/admin-web/` — remove duplicates, update imports, use shared ThemeToggle
- `apps/super-admin/` — remove duplicates, update imports
- `apps/student-web/` — remove duplicate EmptyState, update imports
- All 5 `apps/*/package.json` — standardize sonner version

### Deleted Files (~6)

- `apps/admin-web/src/components/AppBreadcrumb.tsx`
- `apps/admin-web/src/components/SortableTableHead.tsx`
- `apps/admin-web/src/components/DataTablePagination.tsx`
- `apps/super-admin/src/components/AppBreadcrumb.tsx`
- `apps/super-admin/src/components/SortableTableHead.tsx`
- `apps/super-admin/src/components/DataTablePagination.tsx`
- `apps/student-web/src/components/EmptyState.tsx`

---

## Risk Mitigation

| Risk                                              | Mitigation                                                                        |
| ------------------------------------------------- | --------------------------------------------------------------------------------- |
| Breaking app imports during consolidation         | Run full monorepo build after each Phase A task                                   |
| Color contrast failures in high-contrast mode     | Test with browser DevTools forced-colors emulation                                |
| Framer Motion bundle size growth                  | Tree-shake unused motion components; monitor bundle with `vite-plugin-visualizer` |
| axe-core false positives                          | Configure rule exceptions for known Radix UI patterns                             |
| Spacing token migration disrupts existing layouts | Introduce tokens as aliases alongside raw Tailwind values; migrate incrementally  |
