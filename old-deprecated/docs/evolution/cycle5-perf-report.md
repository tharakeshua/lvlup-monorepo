# Cycle 5 Performance Audit Report

**Date:** 2026-03-16 **Auditor:** Performance Auditor Agent **Apps Audited:**
student-web, admin-web, teacher-web, parent-web, super-admin

---

## 1. Bundle Sizes Per App

All builds completed successfully. Sizes include gzip/brotli compressed
variants.

| App             | Total dist | Entry JS | vendor-firebase | vendor-react | vendor-radix | vendor-query | CSS   | Brotli Entry |
| --------------- | ---------- | -------- | --------------- | ------------ | ------------ | ------------ | ----- | ------------ |
| **student-web** | 13 MB      | 693 KB   | 665 KB          | 173 KB       | 186 KB       | 38 KB        | 92 KB | 175 KB       |
| **admin-web**   | 13 MB      | 694 KB   | 802 KB          | 173 KB       | 186 KB       | 42 KB        | 86 KB | 176 KB       |
| **teacher-web** | 14 MB      | 780 KB   | 678 KB          | 173 KB       | 186 KB       | 42 KB        | 90 KB | 197 KB       |
| **parent-web**  | 12 MB      | 688 KB   | 657 KB          | 174 KB       | 185 KB       | 42 KB        | 82 KB | 174 KB       |
| **super-admin** | 14 MB      | 720 KB   | 637 KB          | 173 KB       | 186 KB       | 38 KB        | 86 KB | 184 KB       |

> Note: "Total dist" includes source maps, gzip, and brotli variants alongside
> raw JS. The actual transfer sizes are the brotli numbers.

### Transfer Size Summary (Brotli compressed)

| App             | Entry  | Firebase | React | Radix | Query | CSS   | Total Initial Load |
| --------------- | ------ | -------- | ----- | ----- | ----- | ----- | ------------------ |
| **student-web** | 175 KB | 127 KB   | 49 KB | 45 KB | 10 KB | 13 KB | ~419 KB            |
| **admin-web**   | 176 KB | 152 KB   | 49 KB | 45 KB | 11 KB | 12 KB | ~445 KB            |
| **teacher-web** | 197 KB | 128 KB   | 49 KB | 45 KB | 11 KB | 13 KB | ~443 KB            |
| **parent-web**  | 174 KB | 124 KB   | 49 KB | 45 KB | 11 KB | 12 KB | ~415 KB            |
| **super-admin** | 184 KB | 121 KB   | 49 KB | 45 KB | 10 KB | 12 KB | ~421 KB            |

---

## 2. Code Splitting Coverage

### Vite Configuration (Identical Across All 5 Apps)

All 5 apps share the same optimized vite.config.ts pattern:

- **Build target:** ES2020
- **Minifier:** Terser with `drop_console` and `drop_debugger`
- **CSS code splitting:** Enabled
- **Chunk size warning limit:** 800 KB
- **Compression:** Dual gzip + brotli via `vite-plugin-compression` (threshold:
  1 KB)
- **Bundle analyzer:** Available via `ANALYZE=true` env var
  (`rollup-plugin-visualizer`)
- **Dependency deduplication:** `react`, `react-dom`, `react-router-dom`

### Manual Chunks (Vendor Splitting)

All apps split vendor dependencies into 4 dedicated chunks:

| Chunk             | Contents                       |
| ----------------- | ------------------------------ |
| `vendor-react`    | react, react-dom, react-router |
| `vendor-firebase` | firebase, @firebase            |
| `vendor-query`    | @tanstack/react-query          |
| `vendor-radix`    | @radix-ui                      |

### Lazy-Loaded Routes Per App

| App             | Total Routes | Lazy Routes               | Eager Routes  | Coverage |
| --------------- | ------------ | ------------------------- | ------------- | -------- |
| **student-web** | 20           | 19 (all page components)  | 0             | **100%** |
| **admin-web**   | 18           | 17 (all page components)  | 0             | **100%** |
| **teacher-web** | 24           | 22 (all except LoginPage) | 1 (LoginPage) | **96%**  |
| **parent-web**  | 10           | 8 (all except LoginPage)  | 1 (LoginPage) | **90%**  |
| **super-admin** | 12           | 11 (all page components)  | 0             | **100%** |

All apps wrap routes in `<Suspense fallback={<PageLoader />}>` at the top level.

**Notes:**

- teacher-web and parent-web eagerly import LoginPage. This is acceptable since
  it's typically the first page loaded.
- All other pages use `React.lazy(() => import(...))` for route-level code
  splitting.
- All route components are wrapped in `<RouteErrorBoundary>` for graceful error
  handling.

---

## 3. PWA Readiness Per App

| Feature                                | student-web | admin-web | teacher-web | parent-web | super-admin |
| -------------------------------------- | :---------: | :-------: | :---------: | :--------: | :---------: |
| manifest.json                          |     Yes     |    Yes    |     Yes     |    Yes     |     Yes     |
| Service worker (sw.js)                 |     Yes     |    Yes    |     Yes     |    Yes     |     Yes     |
| SW registration in main.tsx            |     Yes     |    Yes    |     Yes     |    Yes     |     Yes     |
| offline.html                           |     Yes     |    Yes    |     Yes     |    Yes     |     Yes     |
| SWUpdateNotification                   |     Yes     |    Yes    |     Yes     |    Yes     |     N/A     |
| PWAInstallBanner                       |     Yes     |    Yes    |     Yes     |    Yes     |     N/A     |
| OfflineBanner                          |     Yes     |    Yes    |     Yes     |    Yes     |     N/A     |
| `<meta name="theme-color">`            |     Yes     |    Yes    |     Yes     |    Yes     |     Yes     |
| `<meta name="mobile-web-app-capable">` |     Yes     |    Yes    |     Yes     |    Yes     |     Yes     |
| `<link rel="manifest">`                |     Yes     |    Yes    |     Yes     |    Yes     |     Yes     |
| DNS prefetch (Firebase APIs)           |     Yes     |    Yes    |     Yes     |    Yes     |     Yes     |
| Preconnect (Firebase APIs)             |     Yes     |    Yes    |     Yes     |    Yes     |     Yes     |

**Manifest details (consistent across all 5):**

- `display: standalone`
- `orientation: any`
- `categories: ["education", "productivity"]`
- Icons: 192x192 and 512x512 PNG with `purpose: any maskable`

All 5 apps register the service worker in production mode only
(`import.meta.env.PROD`), with automatic update detection and controller change
handling.

---

## 4. Route Prefetching

All 5 apps implement hover-based route prefetching using the shared
`usePrefetch` hook from `@levelup/shared-hooks`:

- **Mechanism:** Event delegation listening for `pointerenter` and `focusin` on
  `<a>` elements
- **Delay:** 100ms debounce before triggering lazy import
- **Concurrency limit:** MAX_CONCURRENT = 3 simultaneous prefetches
- **Deduplication:** Uses a global `Set` to track already-prefetched routes
- **Scope:** Each app defines a `PREFETCH_MAP` mapping routes to their lazy
  import functions

Example (student-web has 7 routes in prefetch map):

```
/ -> DashboardPage
/spaces -> SpacesListPage
/tests -> TestsPage
/leaderboard -> LeaderboardPage
/profile -> ProfilePage
/settings -> SettingsPage
/notifications -> NotificationsPage
```

---

## 5. Image Optimization

### Native `<img>` Tags

| Metric                               | Count                             |
| ------------------------------------ | --------------------------------- |
| Total `<img>` tags across all apps   | 6                                 |
| With `loading="lazy"`                | 5                                 |
| With `loading="eager"` (intentional) | 1 (lightbox in GradingReviewPage) |
| Missing `loading` attribute          | 0                                 |
| With `decoding="async"`              | 6/6 (100%)                        |

### LazyImage Component

A shared `LazyImage` component exists in `@levelup/shared-ui`:

- Provides `loading="lazy"` + `decoding="async"` by default
- Includes error fallback with SVG placeholder
- Supports `eager` prop for above-fold images
- Accepts `width`/`height` to prevent layout shift

**Usage:** The component is exported and available but not currently imported in
any app page. All apps use native `<img>` tags with explicit `loading="lazy"`
and `decoding="async"` attributes instead.

---

## 6. Font Optimization

- **Font strategy:** System font stack (no custom web fonts downloaded)
- **`@font-face` declaration:** Present in
  `packages/tailwind-config/variables.css` with `font-display: swap`
- **FOIT risk:** None -- system fonts are always available
- **Font file downloads:** Zero (no remote font files referenced)

---

## 7. Compression

All apps include dual compression via `vite-plugin-compression`:

| Algorithm | Threshold | Extension |
| --------- | --------- | --------- |
| gzip      | 1 KB      | .gz       |
| brotli    | 1 KB      | .br       |

This ensures optimal transfer sizes when served behind a CDN or web server that
supports content negotiation.

---

## 8. Additional Optimizations Found

| Optimization                                        | Status                 |
| --------------------------------------------------- | ---------------------- |
| Terser minification with console/debugger stripping | All 5 apps             |
| CSS code splitting                                  | All 5 apps             |
| Source maps (for debugging)                         | All 5 apps             |
| `preconnect` to Firebase APIs                       | All 5 apps             |
| `dns-prefetch` to Firebase APIs                     | All 5 apps             |
| `prefers-reduced-motion` support                    | Global (variables.css) |
| High contrast mode support                          | Global (variables.css) |
| Responsive spacing variables (clamp)                | Global (variables.css) |
| PageTransition animations                           | All 5 apps             |
| RouteAnnouncer for a11y                             | All 5 apps             |

---

## 9. Recommendations

### P0 - Critical (None)

No critical performance issues found.

### P1 - High Priority

1. **Entry bundle size is large (688-780 KB raw, 174-197 KB brotli).** The entry
   point includes shared stores, services, and layout code. Consider splitting
   the shared-ui and shared-stores packages into smaller entry points so that
   tree-shaking is more effective. Target: entry bundle under 150 KB brotli.

2. **Firebase vendor chunk is the largest dependency (637-802 KB raw, 121-152 KB
   brotli).** admin-web is especially large at 802 KB because it imports more
   Firebase services. Consider:
   - Using modular Firebase imports (already done based on chunk names)
   - Lazy-loading Firebase Auth/Firestore after initial render
   - Using Firebase's `getAuth()` and `getFirestore()` only when needed

### P2 - Medium Priority

3. **LazyImage component is unused.** The shared `LazyImage` component provides
   better error handling and layout shift prevention than raw `<img>` tags.
   Consider adopting it in place of the 6 native `<img>` usages.

4. **super-admin has an extra large `BarChart` chunk (330 KB raw, 71 KB
   brotli).** This is likely recharts or a similar charting library. Consider
   lazy-loading the charting library only when the dashboard/analytics pages are
   visited.

5. **teacher-web SpaceEditorPage chunk is 141 KB raw (32 KB brotli).** This is
   the largest single page chunk across all apps. Consider splitting the editor
   into sub-components that load on demand (e.g., rich text editor, question
   builder).

### P3 - Low Priority

6. **Adopt the LazyImage component consistently** to get built-in error
   fallbacks and layout shift prevention.

7. **Add `fetchPriority="high"` to above-fold images** (e.g., logos, hero
   images) for faster LCP.

8. **Consider preloading critical chunks** for the most common navigation paths
   (e.g., dashboard -> spaces) using `<link rel="modulepreload">` in index.html.

---

## 10. Summary Scorecard

| Category           | Score  | Notes                                                                             |
| ------------------ | ------ | --------------------------------------------------------------------------------- |
| Code Splitting     | **A**  | 100% lazy routes (except 2 LoginPages, acceptable)                                |
| Vendor Chunking    | **A**  | 4 dedicated vendor chunks, well-separated                                         |
| Compression        | **A**  | Dual gzip + brotli with 1 KB threshold                                            |
| PWA Readiness      | **A**  | manifest + SW + offline.html across all 5 apps                                    |
| Image Optimization | **A-** | All tags have loading="lazy", but LazyImage component unused                      |
| Font Optimization  | **A**  | System fonts only, font-display: swap declared                                    |
| Route Prefetching  | **A**  | Hover-based prefetch with concurrency control                                     |
| Bundle Size        | **B+** | Entry + Firebase chunks are large but within acceptable range for the feature set |
| Overall            | **A-** | Well-optimized across the board with room for entry/firebase chunk reduction      |
