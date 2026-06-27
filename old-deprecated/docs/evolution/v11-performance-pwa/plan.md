# V11: Performance, PWA & Responsive Excellence — Plan

## Overview

Transform Auto-LevelUp from a desktop-centric web app into a mobile-first,
offline-capable, high-performance platform.

## Audit Summary

| Area              | Current        | Target                                |
| ----------------- | -------------- | ------------------------------------- |
| PWA               | 0%             | Full PWA for student-web              |
| Code Splitting    | 60% (3/5 apps) | 100% all apps                         |
| Vite Optimization | None           | Chunk splitting, compression, preload |
| Responsive        | 75%            | 100% with 44px touch targets          |
| Performance       | Unmetered      | FCP < 1.5s, TTI < 3s                  |

## Phase 1: PWA Setup (student-web)

- Create `manifest.json` with app metadata and icons
- Implement service worker with Workbox (cache-first static, network-first API)
- Create offline fallback page
- Add install prompt hook
- Register service worker in `main.tsx`

## Phase 2: Code Splitting

- **student-web**: Convert all 30+ page imports to `React.lazy()` + Suspense
- **super-admin**: Convert all 8 page imports to `React.lazy()` + Suspense
- Standardize PageLoader fallback via shared-ui

## Phase 3: Vite Build Optimization (all 5 apps)

- Manual chunk splitting (vendor, firebase, ui, router)
- Terser minification with console removal
- CSS code splitting enabled
- Source map generation for debugging
- Asset file naming with hashing

## Phase 4: index.html Enhancement (all 5 apps)

- Add theme-color meta tag
- Add description meta
- Add preconnect hints for Firebase domains
- Add apple-touch-icon and favicon references
- Add PWA manifest link (student-web)

## Phase 5: Responsive Improvements

- Ensure 44px minimum touch targets on interactive elements
- Verify responsive behavior at 375/768/1024/1440px breakpoints
- Mobile-first patterns enforced in shared components

## Deliverables

- `docs/evolution/v11-performance-pwa/plan.md` (this file)
- `docs/evolution/v11-performance-pwa/changelog.md`
- `docs/evolution/v11-performance-pwa/test-report.md`

## Files Modified

| File                                                  | Change                |
| ----------------------------------------------------- | --------------------- |
| `apps/*/vite.config.ts`                               | Build optimization    |
| `apps/*/index.html`                                   | Meta tags, preconnect |
| `apps/student-web/public/manifest.json`               | NEW: PWA manifest     |
| `apps/student-web/public/offline.html`                | NEW: Offline fallback |
| `apps/student-web/src/sw.ts`                          | NEW: Service worker   |
| `apps/student-web/src/registerSW.ts`                  | NEW: SW registration  |
| `apps/student-web/src/App.tsx`                        | Code splitting        |
| `apps/super-admin/src/App.tsx`                        | Code splitting        |
| `packages/shared-ui/src/components/ui/PageLoader.tsx` | NEW: Shared loader    |
