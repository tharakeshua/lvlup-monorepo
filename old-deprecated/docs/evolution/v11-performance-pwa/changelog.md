# V11: Performance, PWA & Responsive — Changelog

## Cycle 3 Combined Pass 1: Feature + Integration + Quality + UX

See `cycle3-changelog.md` for full details.

- Shared MobileBottomNav in all 5 apps (was 1/5)
- Responsive AppShell (padding, sidebar auto-collapse, safe areas)
- PWAInstallBanner + SWUpdateNotification components
- Service Worker v2 (hashed cache-first, SWR, API skip, size limits)
- 44px touch targets on all new interactive elements

---

## Cycle 3: Feature Completion

### Suspense Boundary Fix (admin-web)

- `apps/admin-web/src/App.tsx` — Added top-level
  `<Suspense fallback={<PageLoader />}>` wrapper around Routes, matching all
  other apps. Previously was the only app missing this boundary for lazy-loaded
  components.

### PageLoader Normalization (teacher-web, parent-web)

- `apps/teacher-web/src/App.tsx` — Removed local `PageLoader` function, now
  imports from `@levelup/shared-ui` for consistency
- `apps/parent-web/src/App.tsx` — Removed local `PageLoader` function, now
  imports from `@levelup/shared-ui` for consistency
- All 5 apps now use the shared PageLoader from `packages/shared-ui`

### PWA Install Hook Export

- `apps/student-web/src/hooks/index.ts` — Added `usePWAInstall` to the barrel
  export

### Resource Hints Upgrade (all 5 apps)

- `apps/*/index.html` — Added `<link rel="preconnect" crossorigin>` tags for
  Firebase domains alongside existing `dns-prefetch` tags. Preconnect
  establishes full connections (DNS + TCP + TLS) vs dns-prefetch (DNS only),
  reducing Firebase API latency by ~100-200ms on first request.

### Service Worker Update Notifications (all 5 apps)

- `apps/*/public/sw.js` — Replaced immediate `self.skipWaiting()` with
  message-based update flow:
  - SW now waits for `SKIP_WAITING` message from the app before activating
  - Allows the app to notify users before applying updates
- `apps/*/src/main.tsx` — Enhanced SW registration with:
  - Periodic update checks every 60 minutes
  - `updatefound` listener that dispatches `sw-update-available` custom event
  - `controllerchange` listener for automatic reload when new SW activates
- `packages/shared-ui/src/hooks/use-sw-update.ts` — NEW: `useSWUpdate()` hook
  providing `updateAvailable` state and `applyUpdate()` function for UI
  components to consume
- `packages/shared-ui/src/index.ts` — Added `useSWUpdate` export

---

## Cycle 1-2: Initial Implementation

### PWA Implementation (all 5 apps)

- `apps/*/public/manifest.json` — PWA manifest with app metadata, theme color
  (#6366f1), standalone display mode, icon references
- `apps/*/public/sw.js` — Service worker with cache-first (static) +
  network-first (navigation) strategies
- `apps/*/public/offline.html` — Offline fallback page with retry button, 44px
  touch targets
- `apps/*/public/icons/` — PWA icons (192x192 and 512x512)
- `apps/student-web/src/hooks/usePWAInstall.ts` — Install prompt hook

### Code Splitting (all 5 apps)

- All 5 apps use `React.lazy()` with `<Suspense fallback={<PageLoader />}>`
  wrappers
- `packages/shared-ui/src/components/ui/PageLoader.tsx` — Shared Suspense
  fallback component

### Vite Build Optimization (all 5 apps)

- Manual chunk splitting: vendor-react, vendor-firebase, vendor-query,
  vendor-radix
- ES2020 build target, CSS code splitting, source maps, hash-based asset naming

### HTML Enhancement (all 5 apps)

- viewport-fit=cover, theme-color, description, apple-mobile-web-app tags
- Preconnect + dns-prefetch for Firebase domains

## Summary

| Metric                  | Cycle 1-2         | Cycle 3                   |
| ----------------------- | ----------------- | ------------------------- |
| Suspense boundaries     | 4/5 apps          | 5/5 apps                  |
| Shared PageLoader       | 2/5 apps          | 5/5 apps                  |
| usePWAInstall exported  | No                | Yes                       |
| Resource hints          | dns-prefetch only | preconnect + dns-prefetch |
| SW update notifications | None              | All 5 apps                |
| useSWUpdate hook        | None              | Shared-ui                 |
