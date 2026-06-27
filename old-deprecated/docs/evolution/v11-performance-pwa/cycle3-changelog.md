# V11: Performance, PWA & Responsive — Cycle 3 Combined Pass 1 Changelog

## Theme 1: Feature Completion

### Shared MobileBottomNav Component (NEW)

- `packages/shared-ui/src/components/layout/MobileBottomNav.tsx` — Generic
  configurable bottom navigation for mobile. Accepts `items` array with icon,
  label, to, badge, isActive. Uses 44px minimum touch targets. Supports safe
  area insets via `env(safe-area-inset-bottom)`. Hidden on md+ breakpoints.
- Replaces the app-specific `apps/parent-web/src/components/MobileBottomNav.tsx`
  with a shared, reusable version.

### MobileBottomNav Added to All 5 Apps

- `apps/student-web/src/layouts/AppLayout.tsx` — Bottom nav: Home, Spaces,
  Tests, Board, Chat
- `apps/student-web/src/layouts/ConsumerLayout.tsx` — Bottom nav: Home, Store,
  Cart (conditional), Profile
- `apps/admin-web/src/layouts/AppLayout.tsx` — Bottom nav: Home, Users, Classes,
  Analytics, Settings
- `apps/teacher-web/src/layouts/AppLayout.tsx` — Bottom nav: Home, Spaces,
  Exams, Students, Analytics
- `apps/parent-web/src/layouts/AppLayout.tsx` — Bottom nav: Home, Children,
  Results, Alerts (with badge)
- `apps/super-admin/src/layouts/AppLayout.tsx` — Bottom nav: Home, Tenants,
  Health, Settings

### Responsive AppShell

- `packages/shared-ui/src/components/layout/AppShell.tsx` — Major responsive
  improvements:
  - Padding: `p-3 sm:p-4 md:p-6` (was fixed `p-6`)
  - Breadcrumb hidden on screens below `md` breakpoint
  - Header separator hidden on small screens
  - SidebarTrigger has 44px minimum touch target
  - Safe area inset for header top: `env(safe-area-inset-top)`
  - New `hasBottomNav` prop adds `pb-20 md:pb-6` to main content
  - Sidebar auto-collapses on mobile (via `useIsMobile`)

### PWA Install Banner Component (NEW)

- `packages/shared-ui/src/components/layout/PWAInstallBanner.tsx` — Smart
  install banner:
  - Only shows when `beforeinstallprompt` fires (installable PWA)
  - Dismissible (persists via sessionStorage)
  - Shows after 3+ page views for non-intrusive timing
  - 44px touch targets on Install and Dismiss buttons
  - Positioned above bottom nav on mobile, bottom-right on desktop

### SW Update Notification Component (NEW)

- `packages/shared-ui/src/components/layout/SWUpdateNotification.tsx` — Update
  notification:
  - Uses `useSWUpdate` hook to detect service worker updates
  - Non-intrusive banner at top of viewport
  - "Refresh" button triggers `applyUpdate()` → `SKIP_WAITING` → reload
  - 44px touch target on refresh button

## Theme 2: Integration

### PWA Install Banner Wired into Student-Web

- `apps/student-web/src/layouts/AppLayout.tsx` — PWAInstallBanner rendered
- `apps/student-web/src/layouts/ConsumerLayout.tsx` — PWAInstallBanner rendered

### SW Update Notification Wired into All 5 Apps

- All 5 `AppLayout.tsx` files and `ConsumerLayout.tsx` now render
  `<SWUpdateNotification />`
- Users across all apps now see update notifications when new versions deploy

### Parent-Web Migrated to Shared MobileBottomNav

- `apps/parent-web/src/layouts/AppLayout.tsx` — Now imports from
  `@levelup/shared-ui` instead of local component
- Local `MobileBottomNav` component remains for backwards compatibility but is
  no longer used by layout

### Shared-UI Layout Exports Updated

- `packages/shared-ui/src/components/layout/index.ts` — Added exports:
  `MobileBottomNav`, `MobileBottomNavProps`, `MobileNavItem`,
  `PWAInstallBanner`, `SWUpdateNotification`

## Theme 3: Quality

### Service Worker Cache v2 (all 5 apps)

- `apps/*/public/sw.js` — Upgraded from v1 to v2 with improvements:
  - **Hashed asset detection**: Regex identifies Vite-hashed assets (e.g.,
    `index-abc12345.js`) and uses cache-first (immutable, never revalidate)
  - **Stale-while-revalidate**: Non-hashed static assets use SWR pattern — serve
    cached, update in background
  - **Firebase API exclusion**: 6 Firebase/Google API domains explicitly skipped
    from caching to prevent stale auth/data
  - **Cache size limits**: `trimCache()` function caps cache at 60 entries,
    evicting oldest first
  - **Version bump**: All caches bumped to v2, old v1 caches auto-cleaned on
    activate

### Sidebar Auto-Collapse on Mobile

- `packages/shared-ui/src/components/layout/AppShell.tsx` — `defaultOpen` now
  defaults to `!isMobile` instead of `true`, so sidebar is collapsed by default
  on mobile viewports (< 768px)

## Theme 4: UX Polish

### Safe Area Handling

- `packages/shared-ui/src/components/layout/AppShell.tsx` — Header respects
  `env(safe-area-inset-top)` for notched devices
- `packages/shared-ui/src/components/layout/MobileBottomNav.tsx` — Bottom nav
  respects `env(safe-area-inset-bottom)` for notched devices

### Touch-Friendly Targets

- All new components use `min-h-[44px] min-w-[44px]` on interactive elements
- MobileBottomNav items have 44px minimum height
- SidebarTrigger in AppShell has 44px minimum touch target
- PWAInstallBanner and SWUpdateNotification buttons are 44px touch targets

### Responsive Content Padding

- Main content padding scales: 12px → 16px → 24px across breakpoints
- Bottom padding automatically added when bottom nav is present

## Files Changed Summary

| Category                 | Files  | Details                                                     |
| ------------------------ | ------ | ----------------------------------------------------------- |
| New shared-ui components | 3      | MobileBottomNav, PWAInstallBanner, SWUpdateNotification     |
| Modified shared-ui       | 2      | AppShell (responsive), layout/index.ts (exports)            |
| App layouts modified     | 7      | 5 AppLayout.tsx + ConsumerLayout.tsx + parent-web migration |
| Service workers upgraded | 5      | All apps sw.js v1→v2                                        |
| Documentation            | 3      | cycle3-plan.md, cycle3-changelog.md, cycle3-test-report.md  |
| **Total**                | **20** |                                                             |

## Metrics

| Metric                       | Before            | After                                     |
| ---------------------------- | ----------------- | ----------------------------------------- |
| Apps with MobileBottomNav    | 1/5               | 5/5                                       |
| Responsive AppShell padding  | Fixed p-6         | p-3/p-4/p-6                               |
| Safe area support            | None              | Header + bottom nav                       |
| Sidebar auto-collapse mobile | No                | Yes                                       |
| PWA install banner           | None              | Student-web                               |
| SW update notification       | Hook only         | All 5 apps                                |
| SW cache strategy            | Basic cache-first | Hashed=cache-first, others=SWR, APIs=skip |
| SW cache size limit          | None              | 60 entries max                            |
| 44px touch targets on nav    | Partial           | Complete                                  |
