# V11: Performance, PWA & Responsive — Cycle 3 Combined Pass 1 Plan

## Current State Assessment

### Features (70% complete)

- ✅ PWA: manifests, service workers, offline pages across all 5 apps
- ✅ Code splitting: React.lazy() + Suspense in all 5 apps
- ✅ Vite optimization: chunk splitting, compression, terser
- ✅ HTML meta tags: viewport, preconnect, theme-color
- ✅ SW update flow with user control
- ❌ Mobile bottom nav only in parent-web, missing from other 4 apps
- ❌ No responsive padding in AppShell (fixed p-6 everywhere)
- ❌ No safe area handling (env(safe-area-inset-\*))
- ❌ SW caching incomplete — no versioned cache busting for hashed assets
- ❌ No route prefetching

### Integration (60% complete)

- ✅ Shared PageLoader across all apps
- ✅ Shared useSWUpdate hook
- ❌ useIsMobile not used in layouts for responsive behavior
- ❌ MobileBottomNav hardcoded in parent-web, not shared
- ❌ No PWA install UI integration (hook exists but no banner)

### Quality (50% complete)

- ✅ Build passes, lint passes
- ❌ AppShell padding not responsive (p-6 on all screens)
- ❌ Header breadcrumb takes space on mobile
- ❌ Touch targets inconsistent across apps
- ❌ No cache versioning strategy for SW

### UX (40% complete)

- ✅ PageTransition, FadeIn, AnimatedCard components exist
- ✅ useReducedMotion hook available
- ❌ No PWA install banner/prompt UI
- ❌ No SW update notification banner UI
- ❌ Sidebar doesn't auto-collapse on mobile
- ❌ No route prefetching for instant transitions

## Target State (80% complete)

1. **MobileBottomNav** shared component in shared-ui, used by student-web,
   teacher-web, admin-web, parent-web
2. **Responsive AppShell**: padding adjusts for mobile (`p-3 sm:p-4 md:p-6`),
   breadcrumb hidden on mobile
3. **Safe area** insets via CSS for notched devices
4. **PWA install banner** component in shared-ui, shown in student-web
5. **SW update banner** component in shared-ui, usable by all apps
6. **Service worker** with proper versioned caching and stale-while-revalidate
   for hashed assets
7. **Route prefetching** via router link preloading
8. **Sidebar auto-collapse** on mobile viewport

## Ordered Task List

### T1: Shared MobileBottomNav Component [Feature] — M

Move parent-web's MobileBottomNav to shared-ui, make it configurable.

- **Files**: `packages/shared-ui/src/components/layout/MobileBottomNav.tsx`,
  `packages/shared-ui/src/components/layout/index.ts`
- **Accept**: Generic MobileBottomNav accepting configurable nav items, exported
  from shared-ui

### T2: Responsive AppShell [Feature] — S

Make AppShell responsive: mobile padding, hide breadcrumb on sm, auto-collapse
sidebar on mobile.

- **Files**: `packages/shared-ui/src/components/layout/AppShell.tsx`
- **Accept**: p-3 sm:p-4 md:p-6 padding, breadcrumb hidden below md,
  bottomNavPadding prop

### T3: Add MobileBottomNav to All Consumer Apps [Feature] — M

Wire MobileBottomNav into student-web, teacher-web, admin-web, consumer layout.
Update parent-web to use shared version.

- **Files**: All 5 `AppLayout.tsx` files, `ConsumerLayout.tsx`
- **Accept**: Each app has mobile bottom nav with relevant 4-5 items, content
  has pb-16 on mobile

### T4: Safe Area Handling [Feature] — S

Add CSS safe area insets to header, bottom nav, and main content for notched
devices.

- **Files**: `packages/shared-ui/src/components/layout/AppShell.tsx`,
  `packages/shared-ui/src/components/layout/MobileBottomNav.tsx`
- **Accept**: `env(safe-area-inset-*)` applied to header top and bottom nav
  bottom

### T5: PWA Install Banner Component [Feature/UX] — S

Create a smart install banner that shows after 3 page views, dismissible, shown
only on mobile.

- **Files**: `packages/shared-ui/src/components/layout/PWAInstallBanner.tsx`,
  export from index
- **Accept**: Banner shows when canInstall is true, dismissible, calls install()

### T6: SW Update Toast Component [Feature/UX] — S

Create a toast/banner component that uses useSWUpdate to show "Update available"
with refresh button.

- **Files**:
  `packages/shared-ui/src/components/layout/SWUpdateNotification.tsx`, export
  from index
- **Accept**: Non-intrusive notification shown when updateAvailable, click
  triggers applyUpdate

### T7: Integrate PWA Install + SW Update in Apps [Integration] — M

Wire PWAInstallBanner into student-web. Wire SWUpdateNotification into all 5
apps.

- **Files**: All 5 App.tsx or AppLayout.tsx files
- **Accept**: Install banner in student-web, update notification in all apps

### T8: Service Worker Cache Improvements [Quality] — M

Improve SW caching: stale-while-revalidate for hashed assets, proper cache size
limits, skip caching API calls.

- **Files**: All 5 `public/sw.js`
- **Accept**: Hashed assets use stale-while-revalidate, Firebase API calls skip
  cache, max 50 entries per cache

### T9: Sidebar Auto-Collapse on Mobile [Quality/UX] — S

AppShell sidebar defaults to collapsed on mobile using useIsMobile.

- **Files**: `packages/shared-ui/src/components/layout/AppShell.tsx`
- **Accept**: Sidebar collapses by default when viewport < 768px

### T10: Build Verification & Test Report [Quality] — S

Run pnpm build, verify all apps compile, write test report.

- **Files**: `docs/evolution/v11-performance-pwa/cycle3-test-report.md`
- **Accept**: All apps build, no regressions

## Files Modified Summary

| Category                   | Files                                                      | Count   |
| -------------------------- | ---------------------------------------------------------- | ------- |
| shared-ui (new components) | MobileBottomNav, PWAInstallBanner, SWUpdateNotification    | 3       |
| shared-ui (modified)       | AppShell, layout/index.ts, src/index.ts                    | 3       |
| App layouts (modified)     | All 5 AppLayout.tsx + ConsumerLayout.tsx                   | 6       |
| parent-web (modified)      | Remove local MobileBottomNav                               | 1       |
| Service workers            | All 5 sw.js                                                | 5       |
| Documentation              | cycle3-plan.md, cycle3-changelog.md, cycle3-test-report.md | 3       |
| **Total**                  |                                                            | **~21** |
