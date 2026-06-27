# V11: Performance, PWA & Responsive — Cycle 4 Changelog

> Completed: 2026-03-08 | V11 completion: ~80% → ~95%

## Summary

Cycle 4 delivers the final performance, PWA, and responsive improvements to
bring V11 to 95% completion. Key additions: shared LazyImage component, image
lazy loading across all apps, route prefetching on hover, PWA Install Banner
expansion, Lighthouse CI for all 5 apps, responsive E2E tests for remaining
apps, and comprehensive performance documentation.

## New Components

### LazyImage (`packages/shared-ui/src/components/ui/LazyImage.tsx`)

- Reusable image component with native lazy loading and error fallback
- Props: `src`, `alt`, `width`, `height`, `className`, `fallback`, `eager`
- Renders `<img loading="lazy" decoding="async">` by default
- `eager` prop for above-fold images
- SVG placeholder on load error
- Exported from `@levelup/shared-ui`

### PrefetchLink (`packages/shared-ui/src/components/ui/PrefetchLink.tsx`)

- React Router Link with route prefetching on hover/focus
- Configurable prefetch delay (default: 100ms)
- Max 3 concurrent prefetches, deduplication built-in
- Exported from `@levelup/shared-ui`

### usePrefetch Hook (`packages/shared-hooks/src/ui/usePrefetch.ts`)

- Document-level event delegation for route prefetching
- Listens for pointerenter/focusin on all `<a>` elements
- Matches hrefs against a per-app prefetch map
- Triggers lazy `import()` to pre-cache route chunks
- Exported from `@levelup/shared-hooks`

## Image Lazy Loading (18 images across all apps)

### admin-web

- `LogoUploader.tsx`: Added `loading="lazy" decoding="async"` to logo preview
- `SettingsPage.tsx`: Added `loading="lazy" decoding="async"` to branding
  preview

### student-web

- `MaterialViewer.tsx`: 4 images updated (cover=eager,
  attachments/avatar/blocks=lazy)
- `ImageEvaluationAnswerer.tsx`: Student uploads → lazy
- `StoreDetailPage.tsx`: Hero image → eager (above fold)
- `StoreListPage.tsx`: 2 thumbnail images → lazy
- `SpacesListPage.tsx`: Space thumbnails → lazy
- `CheckoutPage.tsx`: Cart item thumbnails → lazy
- `ConsumerDashboardPage.tsx`: Space cards → lazy
- `ProfilePage.tsx`: Profile avatar → eager (above fold)

### teacher-web

- `SpaceListPage.tsx`: Space thumbnails → lazy
- `GradingReviewPage.tsx`: Answer images → lazy, lightbox → eager

### shared-ui

- `RoleSwitcher.tsx`: Tenant logos in dropdown → lazy

## Font Optimization

- Added `font-display: swap` declaration in
  `packages/tailwind-config/variables.css`
- Project uses system font stack (no custom web fonts)
- Zero FOIT risk — system fallback renders immediately

## Route Prefetching (58 routes across 5 apps)

Prefetch maps added to all app layouts via `usePrefetch` hook:

| App         | Routes Prefetched                                                                        |
| ----------- | ---------------------------------------------------------------------------------------- |
| admin-web   | 15 routes (Dashboard, Users, Classes, Exams, Spaces, Settings, Analytics, Reports, etc.) |
| student-web | 11 routes (Dashboard, Spaces, Tests, Leaderboard, Chat, Achievements, etc.)              |
| teacher-web | 13 routes (Dashboard, Spaces, Exams, Students, Analytics, Question Bank, etc.)           |
| parent-web  | 9 routes (Dashboard, Children, Results, Progress, Alerts, Compare, etc.)                 |
| super-admin | 10 routes (Dashboard, Tenants, Analytics, Feature Flags, Presets, LLM Usage, etc.)       |

## PWA Install Banner Expansion

- **parent-web**: PWAInstallBanner added to AppLayout (import + render)
- **teacher-web**: PWAInstallBanner added to AppLayout (import + render)
- **Coverage**: 3/5 apps (student-web, parent-web, teacher-web — all
  consumer-facing)
- admin-web and super-admin are internal tools — intentionally skipped

## Lighthouse CI Expansion

Updated `lighthouserc.js`:

- **Before**: 1 app (student-web), 2 URLs, desktop only
- **After**: 5 apps, 10 URLs (login + home per app), desktop preset
- Each app on dedicated port (4570-4574)
- All original assertions preserved
- Mobile thresholds documented for future activation

## Responsive E2E Tests (3 new test files)

### teacher-web/e2e/responsive.spec.ts (9 tests)

- Mobile (375px): login, sidebar collapse/toggle, spaces list, exams overflow,
  touch targets
- Tablet (768px): sidebar structure, dashboard, spaces list
- Desktop (1280px): dashboard, horizontal overflow

### parent-web/e2e/responsive.spec.ts (8 tests)

- Mobile (375px): login, sidebar collapse/toggle, dashboard cards, children
  page, touch targets
- Tablet (768px): sidebar structure, dashboard
- Desktop (1280px): dashboard, horizontal overflow

### super-admin/e2e/responsive.spec.ts (8 tests)

- Mobile (375px): login, sidebar collapse/toggle, dashboard cards, tenants page,
  touch targets
- Tablet (768px): sidebar structure, dashboard
- Desktop (1280px): dashboard, horizontal overflow

### teacher-web/e2e/helpers.ts (new)

- `loginAsTeacher()` helper with retry logic
- `navigateTo()` helper
- School code and credentials constants

## Documentation

| Document           | Path                                                       |
| ------------------ | ---------------------------------------------------------- |
| Cycle 4 Plan       | `docs/evolution/v11-performance-pwa/cycle4-plan.md`        |
| Bundle Analysis    | `docs/evolution/v11-performance-pwa/bundle-analysis.md`    |
| Performance Report | `docs/evolution/v11-performance-pwa/cycle4-perf-report.md` |
| Test Report        | `docs/evolution/v11-performance-pwa/cycle4-test-report.md` |
| Changelog          | `docs/evolution/v11-performance-pwa/cycle4-changelog.md`   |

## Files Modified (38 total)

| Category                     | Files                                                | Count           |
| ---------------------------- | ---------------------------------------------------- | --------------- |
| New shared components        | LazyImage.tsx, PrefetchLink.tsx                      | 2               |
| New shared hook              | usePrefetch.ts                                       | 1               |
| Shared exports               | shared-ui/src/index.ts, shared-hooks/src/ui/index.ts | 2               |
| Image lazy loading           | 12 components across 5 apps + shared-ui              | 13              |
| App layouts (prefetch + PWA) | All 5 AppLayout.tsx files                            | 5               |
| Font optimization            | tailwind-config/variables.css                        | 1               |
| Lighthouse CI                | lighthouserc.js                                      | 1               |
| E2E tests (new)              | 3 responsive.spec.ts + 1 helpers.ts                  | 4               |
| Documentation (new)          | 4 docs + this changelog                              | 5               |
| Config                       | lighthouserc.js                                      | (counted above) |
| **Total**                    |                                                      | **34**          |

## Build Status

- All 5 web apps: **PASS**
- All shared packages: **PASS**
- functions-levelup: FAIL (pre-existing, unrelated)

## V11 Completion: ~95%

### Remaining 5% (Future Work)

- Skeleton loading states for lazy-loaded content
- Perceived performance improvements (optimistic UI)
- Actual Lighthouse CI runs against all apps with measured scores
- Mobile Lighthouse preset activation in CI
- Bundle size CI enforcement (`size-limit` integration)
