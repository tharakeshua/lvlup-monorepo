# Fat-SDK Audit — packages/\* (read-only)

Branch: `feat/teacher-portal-latex-rendering` · Scope: domain, api-contract,
api-client, repositories, query, services

## BUILD-HEALTH

| Package               | Build          | Typecheck       | Lint            | Tests (files) |
| --------------------- | -------------- | --------------- | --------------- | ------------- |
| @levelup/domain       | ✅ PASS        | ✅ PASS         | N/A (no script) | 10            |
| @levelup/api-contract | ✅ PASS        | ✅ PASS         | N/A             | 7             |
| @levelup/api-client   | ✅ PASS        | ✅ PASS         | N/A             | 10            |
| @levelup/repositories | ✅ PASS (warn) | ✅ PASS         | N/A             | 11            |
| @levelup/query        | ✅ PASS        | ✅ PASS         | N/A             | 9             |
| @levelup/services     | ✅ PASS        | ❌ FAIL (1 err) | N/A             | 1             |

### Build — PASS (turbo: 10 successful / 10 total incl. deps ai, access, offline, realtime)

Two non-fatal unused-import warnings:

- `repositories/src/autograde/api-types.ts` — `SubmissionSummary` imported from
  `@levelup/domain`, never used.
- `services/src/repo-admin/firestore.ts` — `Timestamp` imported from
  `firebase-admin/firestore`, never used.

### Typecheck — 5/6 PASS, services FAILS

```
@levelup/services:typecheck: src/repo-admin/extended.ts(16,26): error TS2305:
  Module '"firebase-admin/firestore"' has no exported member 'Auth'.
 ELIFECYCLE  Command failed with exit code 2.
Failed: @levelup/services#typecheck
```

Root cause: line 16
`import { FieldPath, type Auth, type Firestore } from 'firebase-admin/firestore'`
— `Auth` is exported from `firebase-admin/auth`, not `.../firestore`. Used at
lines 37/49/57 as the `adminAuth: Auth` param type. Build passes because tsup
strips type-only imports without type-checking; only `tsc --noEmit` catches it.
Fix (one line): `import type { Auth } from 'firebase-admin/auth';` and keep
`{ FieldPath, type Firestore }` from `firebase-admin/firestore`.

### Lint — N/A

None of the 6 packages define a `lint` script; turbo `lint` ran only `^build`
deps (no package-level ESLint task). No lint signal available at the package
level.

## STATUS

- **DONE** — domain, api-contract, api-client, repositories, query: build +
  typecheck green, substantial test suites present.
- **NEEDS-REVIEW** — services: typecheck broken (below); only 1 `__tests__` file
  vs 7–11 in siblings — thin coverage for the largest service surface (75 src
  files, identity/levelup/autograde/notification/triggers).
- **PENDING (git)** — All 6 packages are **entirely untracked** (0 tracked
  files, 477 untracked `.ts`; not gitignored). The whole fat-SDK is uncommitted
  WIP on this branch — nothing has been committed yet.

## BLOCKERS

1. **services typecheck** — TS2305 `Auth` import (one-line fix above). Blocks
   `turbo typecheck` and any consumer relying on services type-correctness.

## Cleanups (non-blocking)

- Remove unused imports in `repositories/.../autograde/api-types.ts` and
  `services/.../repo-admin/firestore.ts`.
- Add `lint` scripts (or confirm intentional) so SDK packages get ESLint
  coverage.
- Raise services test coverage toward sibling parity.
