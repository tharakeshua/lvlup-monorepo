# V3: Error Handling & Resource Lifecycle — Cycle 4 Changelog

**Vertical**: V3 | **Cycle**: 4 | **Team**: Foundation Architect **Date**:
2026-03-08

---

## Phase 1: Re-enabled Cascade Delete Triggers

### Changed

- **`functions/identity/src/triggers/on-class-deleted.ts`** — Renamed export
  `onClassDeleted` → `onClassArchived` to avoid Firebase deployment type
  conflict with previously deployed HTTPS version
- **`functions/identity/src/triggers/on-student-deleted.ts`** — Renamed export
  `onStudentDeleted` → `onStudentArchived` for the same reason
- **`functions/identity/src/index.ts`** — Re-enabled both triggers with new
  export names (`onClassArchived`, `onStudentArchived`), removed disabled
  comments

### Effect

- `onClassArchived`: when a class status changes to 'archived', removes
  `classId` from all linked students' and teachers' `classIds[]` arrays
- `onStudentArchived`: when a student status changes to 'archived', removes
  `studentId` from parents' `childStudentIds[]` and classes' `studentIds[]`,
  decrements `studentCount`

---

## Phase 2: Fixed Credential File Cleanup

### Changed

- **`functions/identity/src/callable/bulk-import-students.ts`** — Removed
  unreliable `setTimeout(10min)` for credential file deletion; added
  `deleteAfter` metadata (ISO timestamp, 10-minute TTL) to uploaded CSV files

### Added

- **`functions/identity/src/triggers/cleanup-expired-exports.ts`** (NEW) —
  Scheduled Cloud Function running every 30 minutes that:
  - Lists all files in `exports/` prefix
  - Deletes files where `deleteAfter` metadata timestamp has passed
  - Logs each deletion for audit trail
- **`functions/identity/src/index.ts`** — Added `cleanupExpiredExports` export

### Effect

- Credential files are now reliably cleaned up via scheduled function,
  regardless of Cloud Function instance lifecycle
- Zero `setTimeout` calls remain in the functions/ directory

---

## Phase 3: Deduplicated Shared Utilities

### Added

- **`functions/shared/`** (NEW package `@levelup/functions-shared`) — Single
  source of truth for:
  - `rate-limit.ts` — Firestore-based sliding window rate limiter
  - `parse-request.ts` — Zod schema validation with Firebase HttpsError mapping
  - Barrel `index.ts` with both exports

### Changed

- **`functions/{analytics,autograde,identity,levelup}/src/utils/rate-limit.ts`**
  — Replaced duplicate implementations with re-exports from
  `@levelup/functions-shared`
- **`functions/{analytics,autograde,identity,levelup}/src/utils/parse-request.ts`**
  — Replaced duplicate implementations with re-exports from
  `@levelup/functions-shared`
- **`functions/{analytics,autograde,identity,levelup}/package.json`** — Added
  `@levelup/functions-shared` workspace dependency

### Effect

- Single source of truth for `enforceRateLimit` and `parseRequest`
- All existing import paths continue to work (re-export pattern)
- 8 duplicate files reduced to thin re-export wrappers

---

## Phase 4: Route-Level Error Boundaries (All 5 Apps)

### Added

- **`packages/shared-ui/src/components/layout/RouteErrorBoundary.tsx`** (NEW) —
  Moved from admin-web to shared-ui for cross-app reuse
- **`packages/shared-ui/src/components/layout/index.ts`** — Added
  `RouteErrorBoundary` export

### Changed

- **`apps/admin-web/src/App.tsx`** — Updated import to use `@levelup/shared-ui`
  instead of local component
- **`apps/teacher-web/src/App.tsx`** — Wrapped all 20 routes with
  `<RouteErrorBoundary>`
- **`apps/parent-web/src/App.tsx`** — Wrapped all 8 routes with
  `<RouteErrorBoundary>`
- **`apps/super-admin/src/App.tsx`** — Wrapped all 9 routes with
  `<RouteErrorBoundary>`
- **`apps/student-web/src/App.tsx`** — Wrapped all 25 routes (B2B + B2C) with
  `<RouteErrorBoundary>`

### Deleted

- **`apps/admin-web/src/components/RouteErrorBoundary.tsx`** — Replaced by
  shared-ui version

### Effect

- All 5 apps now have route-level error boundaries
- Errors in any route are caught and display a user-friendly recovery UI instead
  of crashing the entire app

---

## Phase 5: Standardized Logging

### Changed

- **`LevelUp-App/cloud-functions/src/index.ts`** — Replaced 3 `console.*` calls
  with `logger.*`:
  - `console.error("aiChat error", e)` → `logger.error(...)`
  - `console.warn("Failed to fetch question meta...")` → `logger.warn(...)`
  - `console.warn("Failed updating leaderboard...")` → `logger.warn(...)`
  - Added `import { logger } from "firebase-functions/v2"`

### Effect

- Zero `console.*` calls remain in Cloud Functions source
- All logging now uses structured Firebase `logger` for proper Cloud Logging
  integration

---

## Build Verification

- **13/13 tasks pass**, 0 errors
- `pnpm build --force` completes successfully

## Summary

| Phase     | Gap Addressed                               | Files Changed        |
| --------- | ------------------------------------------- | -------------------- |
| 1         | Disabled cascade triggers → orphaned data   | 3                    |
| 2         | Unreliable `setTimeout` credential cleanup  | 3 (1 new)            |
| 3         | 8 duplicated utility files across 4 modules | 13 (5 new)           |
| 4         | Missing route error boundaries in 4 apps    | 8 (1 new, 1 deleted) |
| 5         | `console.*` instead of `logger.*`           | 1                    |
| **Total** | **8 gaps closed**                           | **28 files**         |
