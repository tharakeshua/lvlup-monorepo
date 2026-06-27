# V11: Bundle Size Analysis — Cycle 4

> Generated: 2026-03-08 | Build: production (Vite + terser)

## Bundle Size Summary (Raw JS)

| App         | Entry Bundle | Firebase | React  | Radix UI | TanStack Query | CSS   | Total JS (raw) |
| ----------- | ------------ | -------- | ------ | -------- | -------------- | ----- | -------------- |
| admin-web   | 696 KB       | 804 KB   | 176 KB | 188 KB   | 44 KB          | 88 KB | ~1.9 MB        |
| student-web | 696 KB       | 668 KB   | 176 KB | 188 KB   | 40 KB          | 92 KB | ~1.8 MB        |
| teacher-web | 780 KB       | 680 KB   | 176 KB | 188 KB   | 44 KB          | 92 KB | ~2.0 MB        |
| parent-web  | 688 KB       | 660 KB   | 176 KB | 188 KB   | 44 KB          | 84 KB | ~1.8 MB        |
| super-admin | 720 KB       | 640 KB   | 176 KB | 188 KB   | 40 KB          | 88 KB | ~2.1 MB        |

## Compressed Sizes (Brotli)

| App         | Entry (br) | Firebase (br) | Total JS (br est.) |
| ----------- | ---------- | ------------- | ------------------ |
| admin-web   | 175 KB     | 152 KB        | ~450 KB            |
| student-web | ~175 KB    | ~130 KB       | ~430 KB            |
| teacher-web | 196 KB     | 128 KB        | ~460 KB            |
| parent-web  | ~170 KB    | ~125 KB       | ~420 KB            |
| super-admin | 184 KB     | 121 KB        | ~480 KB            |

## Vendor Chunk Breakdown

### Common across all apps

- **vendor-react**: ~176 KB raw / ~49 KB brotli (React + ReactDOM +
  react-router-dom)
- **vendor-radix**: ~188 KB raw / ~45 KB brotli (Radix UI primitives for
  shadcn/ui)
- **vendor-query**: ~40-44 KB raw / ~11 KB brotli (TanStack Query)
- **vendor-firebase**: 640-804 KB raw / 121-152 KB brotli (Firebase Auth +
  Firestore + Storage)

### App-specific large chunks

- **teacher-web/SpaceEditorPage**: 140 KB raw / 32 KB brotli (rich content
  editor)
- **super-admin/BarChart**: 332 KB raw / 71 KB brotli (Recharts for analytics)

## Code Splitting Effectiveness

All apps use `React.lazy()` + `Suspense` for route-level code splitting:

- admin-web: 18 lazy-loaded pages
- student-web: 22 lazy-loaded pages
- teacher-web: 23 lazy-loaded pages
- parent-web: 9 lazy-loaded pages
- super-admin: 12 lazy-loaded pages

Initial load (login page) requires only: entry bundle + vendor-react +
vendor-radix + CSS Firebase loaded on-demand after auth initialization.

## Optimization Status

| Optimization                       | Status                           |
| ---------------------------------- | -------------------------------- |
| Tree shaking (Tailwind CSS purge)  | Active                           |
| Terser minification                | Active                           |
| Gzip compression                   | Active (vite-plugin-compression) |
| Brotli compression                 | Active (vite-plugin-compression) |
| Chunk splitting (vendor isolation) | Active                           |
| Route-level code splitting         | Active (React.lazy)              |
| Route prefetching on hover         | Active (cycle 4)                 |
| Image lazy loading                 | Active (cycle 4)                 |

## Recommendations

1. **Firebase bundle** is the largest vendor chunk (640-804 KB raw). Consider:
   - Using modular Firebase imports (already done)
   - Dynamic import of Firebase Storage (only needed in teacher-web/admin-web)
   - Firebase tree-shaking verification

2. **Recharts** in super-admin adds 332 KB. Consider lazy-loading chart
   components.

3. **Entry bundles** (688-780 KB) contain shared-ui + app code. The shared-ui
   component library is large due to shadcn/ui inclusion — consider selective
   imports.

## CI Thresholds (Recommended)

Set initial thresholds at 120% of current baseline for CI enforcement:

| App         | Max Entry (raw) | Max Total JS (raw) |
| ----------- | --------------- | ------------------ |
| admin-web   | 840 KB          | 2.3 MB             |
| student-web | 840 KB          | 2.2 MB             |
| teacher-web | 940 KB          | 2.4 MB             |
| parent-web  | 830 KB          | 2.2 MB             |
| super-admin | 870 KB          | 2.5 MB             |
