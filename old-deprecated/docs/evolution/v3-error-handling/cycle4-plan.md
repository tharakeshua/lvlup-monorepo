# V3: Error Handling & Resource Lifecycle — Cycle 4 Plan

**Vertical**: V3 | **Cycle**: 4 | **Date**: 2026-03-08 **Previous Cycles**:
Cycle 1 (foundation), Cycle 3 (rate-limit completion, exam cascade, recovery
hints)

---

## Context

Cycles 1 and 3 established a comprehensive error handling and resource lifecycle
system:

- 32/32 callable endpoints rate-limited
- Error type system with 9 codes, `useApiError()` hook, recovery hints
- Sonner toast in all 5 apps
- Cascade delete triggers for spaces and exams
- Scheduled cleanup for stale sessions (24h) and inactive chats (7d)

Cycle 4 addresses the remaining structural gaps: disabled cascade triggers
causing orphaned data, unreliable credential cleanup, duplicated utilities, and
inconsistent error boundary coverage.

---

## Remaining Gaps Identified

| #   | Category           | Gap                                                                                                                      | Severity        |
| --- | ------------------ | ------------------------------------------------------------------------------------------------------------------------ | --------------- |
| 1   | Cascade Deletes    | `onClassDeleted` disabled (deployment type conflict) — archived classes leave orphaned `classIds[]` in students/teachers | High            |
| 2   | Cascade Deletes    | `onStudentDeleted` disabled — archived students leave orphaned `childStudentIds[]` in parents, `studentIds[]` in classes | High            |
| 3   | Resource Lifecycle | `bulk-import-students.ts` uses `setTimeout(10min)` for credential file cleanup — unreliable in Cloud Functions           | High (Security) |
| 4   | Code Duplication   | `rate-limit.ts` identical across 4 function modules (analytics, autograde, identity, levelup)                            | Medium          |
| 5   | Code Duplication   | `parse-request.ts` identical across 4 function modules                                                                   | Medium          |
| 6   | Error Boundaries   | Only admin-web has `RouteErrorBoundary` on all routes; teacher-web, parent-web, super-admin lack route-level boundaries  | Medium          |
| 7   | Logging            | Old `LevelUp-App/cloud-functions/src/index.ts` uses `console.log/error/warn` (3 occurrences) instead of `logger`         | Low             |
| 8   | Orphaned Data      | No detection mechanism for existing orphaned references (stale classIds, parentIds in documents)                         | Medium          |

---

## Implementation Plan

### Phase 1: Fix Disabled Cascade Triggers

**Goal**: Re-enable `onClassDeleted` and `onStudentDeleted` triggers to prevent
future orphaned references.

**Root Cause**: Both triggers were deployed as HTTPS-type functions previously,
creating a deployment type conflict with the new Firestore trigger versions.
Firebase does not allow changing a function's trigger type without first
deleting the old deployment.

**Action — Rename to avoid conflict**:

1. **`functions/identity/src/triggers/on-class-deleted.ts`**
   - Rename export from `onClassDeleted` to `onClassArchived` (also more
     accurate — it watches for status → 'archived', not hard deletes)
   - Update `functions/identity/src/index.ts` to export `onClassArchived`
   - Logic is already correct: removes `classId` from students' and teachers'
     `classIds[]` arrays

2. **`functions/identity/src/triggers/on-student-deleted.ts`**
   - Rename export from `onStudentDeleted` to `onStudentArchived`
   - Update `functions/identity/src/index.ts` to export `onStudentArchived`
   - Logic: removes `studentId` from parents' `childStudentIds[]` and classes'
     `studentIds[]`
   - Read the file to verify its implementation is complete before re-enabling

**Files**:

- `functions/identity/src/triggers/on-class-deleted.ts` — rename export
- `functions/identity/src/triggers/on-student-deleted.ts` — rename export,
  verify logic
- `functions/identity/src/index.ts` — update exports

**Acceptance**:

- Both triggers exported and build passes
- onClassArchived: removes classId from student.classIds[] and
  teacher.classIds[]
- onStudentArchived: removes studentId from parent.childStudentIds[] and
  class.studentIds[]

---

### Phase 2: Fix Credential File Cleanup

**Goal**: Replace unreliable `setTimeout` with Cloud Storage object lifecycle
policy for credential file deletion.

**Current Problem**: `bulk-import-students.ts` line 302 uses
`setTimeout(async () => file.delete(), 10 * 60 * 1000)`. If the Cloud Function
instance is terminated before the timeout fires, the credential CSV persists
indefinitely in Cloud Storage.

**Action — Cloud Storage lifecycle + metadata TTL**:

1. Add `customTime` metadata to uploaded credential files set to 10 minutes from
   upload
2. Add `temporaryHold: false` and custom metadata
   `{ deleteAfter: ISO timestamp }`
3. Create a scheduled cleanup function `cleanup-expired-exports.ts` in identity
   module:
   - Runs every 30 minutes
   - Lists files in `exports/` prefix
   - Deletes files where `deleteAfter` metadata timestamp has passed
4. Remove the `setTimeout` call from `bulk-import-students.ts`

**Files**:

- `functions/identity/src/callable/bulk-import-students.ts` — remove setTimeout,
  add metadata
- `functions/identity/src/triggers/cleanup-expired-exports.ts` — new scheduled
  trigger
- `functions/identity/src/index.ts` — export new trigger

**Acceptance**:

- No setTimeout calls remain in functions/ directory
- Credential files get `deleteAfter` metadata with 10-minute TTL
- Scheduled cleanup deletes expired files every 30 minutes
- Build passes

---

### Phase 3: Deduplicate Shared Utilities

**Goal**: Extract duplicated `rate-limit.ts` and `parse-request.ts` into a
shared functions package.

**Action — Create `functions/shared/` package**:

1. Create `functions/shared/src/rate-limit.ts` — single source of truth
2. Create `functions/shared/src/parse-request.ts` — single source of truth
3. Create `functions/shared/src/index.ts` — barrel exports
4. Create `functions/shared/package.json` and `functions/shared/tsconfig.json`
5. Update all 4 function modules to import from `@levelup/functions-shared` (or
   relative path via workspace)
6. Delete the 8 duplicate files (4 × rate-limit.ts + 4 × parse-request.ts)

**Alternative (simpler)**: If creating a new package is too disruptive, use a
symlink or TypeScript path alias approach. Evaluate complexity and choose the
simpler option.

**Files**:

- `functions/shared/src/rate-limit.ts` — new
- `functions/shared/src/parse-request.ts` — new
- `functions/shared/src/index.ts` — new
- `functions/shared/package.json` — new
- `functions/shared/tsconfig.json` — new
- `functions/{analytics,autograde,identity,levelup}/src/utils/rate-limit.ts` —
  delete
- `functions/{analytics,autograde,identity,levelup}/src/utils/parse-request.ts`
  — delete
- `functions/{analytics,autograde,identity,levelup}/tsconfig.json` — add
  reference
- `functions/{analytics,autograde,identity,levelup}/package.json` — add
  dependency

**Acceptance**:

- Single `rate-limit.ts` and `parse-request.ts` source
- All 4 function modules import from shared
- All imports resolve correctly
- Build passes (all 12 tasks)

---

### Phase 4: Route-Level Error Boundaries

**Goal**: Add `RouteErrorBoundary` to teacher-web, parent-web, and super-admin
routes for consistency with admin-web.

**Action**:

1. Move `RouteErrorBoundary` from
   `apps/admin-web/src/components/RouteErrorBoundary.tsx` to
   `packages/shared-ui/src/components/layout/RouteErrorBoundary.tsx`
2. Export from shared-ui
3. Wrap all route `element` props in teacher-web, parent-web, and super-admin
   with `<RouteErrorBoundary>`
4. Update admin-web to import from shared-ui instead of local component
5. Delete admin-web local copy

**Files**:

- `packages/shared-ui/src/components/layout/RouteErrorBoundary.tsx` — new (moved
  from admin-web)
- `packages/shared-ui/src/components/layout/index.ts` — add export
- `packages/shared-ui/src/index.ts` — add export
- `apps/admin-web/src/components/RouteErrorBoundary.tsx` — delete
- `apps/admin-web/src/App.tsx` — update import
- `apps/teacher-web/src/App.tsx` — wrap routes
- `apps/parent-web/src/App.tsx` — wrap routes
- `apps/super-admin/src/App.tsx` — wrap routes

**Acceptance**:

- All 5 apps use RouteErrorBoundary from shared-ui
- Each route in all apps is wrapped
- Build passes

---

### Phase 5: Standardize Logging (Minor)

**Goal**: Replace remaining `console.*` calls with `logger.*` in Cloud
Functions.

**Action**:

1. In `LevelUp-App/cloud-functions/src/index.ts`, replace 3 occurrences:
   - `console.error("aiChat error", e)` → `logger.error("aiChat error", e)`
   - `console.warn(...)` × 2 → `logger.warn(...)`

**Files**:

- `LevelUp-App/cloud-functions/src/index.ts` — 3 replacements

**Acceptance**:

- Zero `console.*` calls in functions/ and LevelUp-App/cloud-functions/
- Build passes

---

## Out of Scope (Future Cycles)

| Item                                        | Reason                                                                                   |
| ------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Correlation IDs / request tracing           | Requires middleware pattern across all callables — larger effort, Cycle 5+               |
| Orphaned data backfill script               | One-time migration script to clean existing orphaned refs — separate task                |
| Cloud Tasks integration                     | No immediate need once scheduled cleanup covers credential files                         |
| Global callable error middleware            | Would reduce boilerplate but requires careful design — Cycle 5+                          |
| Typed error classes (ValidationError, etc.) | HttpsError with AppError codes is sufficient for now                                     |
| useQuery onError callbacks                  | React Query v5 removed onError from useQuery; current error boundary approach is correct |

---

## Dependency Order

```
Phase 1 (cascade triggers)     — independent
Phase 2 (credential cleanup)   — independent
Phase 3 (deduplicate utils)    — independent
Phase 4 (route error bounds)   — independent
Phase 5 (logging)              — independent
```

All phases are independent and can be executed in any order. Recommended order
is 1 → 2 → 3 → 4 → 5 (by severity).

---

## Risk Assessment

| Phase | Risk                                                                    | Mitigation                                                   |
| ----- | ----------------------------------------------------------------------- | ------------------------------------------------------------ |
| 1     | Renamed triggers deploy as new functions; old disabled functions remain | Verify with `firebase functions:list` after deploy           |
| 2     | Scheduled cleanup misses files if metadata format changes               | Add logging for each deleted file; monitor via Cloud Logging |
| 3     | Breaking imports if workspace resolution fails                          | Test with `pnpm build --force` before committing             |
| 4     | RouteErrorBoundary may mask useful error details in production          | Keep dev-mode error display in the component                 |

---

## Build Verification

After all phases, run:

```bash
pnpm build --force
```

Expected: All tasks pass (12/12), 0 errors.
