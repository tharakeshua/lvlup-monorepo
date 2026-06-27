# Backend / Functions Audit — levelup, analytics, autograde

Read-only audit. Branch: `feat/teacher-portal-latex-rendering`. No commits made.

## BUILD-HEALTH (tsc --noEmit via pnpm)

| Package                        | Typecheck | Notes                             |
| ------------------------------ | --------- | --------------------------------- |
| `@levelup/functions-levelup`   | ✅ PASS   | clean                             |
| `@levelup/functions-analytics` | ❌ FAIL   | 2× TS2307 — missing workspace dep |
| `@levelup/functions-autograde` | ✅ PASS   | clean                             |

Env warning across all packages (non-blocking):
`Unsupported engine: wanted node 20, current v25.6.1` — local Node mismatch
only; functions pin `node:20` for deploy.

## BLOCKERS

**1. analytics — missing `@levelup/functions-shared` dependency (BUILD
BLOCKER)**

- `functions/analytics/src/utils/parse-request.ts:1` →
  `export { parseRequest } from '@levelup/functions-shared';`
- `functions/analytics/src/utils/rate-limit.ts:1` →
  `export { enforceRateLimit } from '@levelup/functions-shared';`
- Both fail `tsc` with `TS2307: Cannot find module '@levelup/functions-shared'`.
- Root cause: `functions/analytics/package.json` does **not** declare
  `@levelup/functions-shared` in `dependencies` (it only lists
  `@levelup/shared-types`, firebase-admin/functions, pdfkit). Consequently pnpm
  only symlinked `shared-types` into
  `functions/analytics/node_modules/@levelup/` — `functions-shared` is absent.
- By contrast, `functions/levelup` and `functions/autograde` both declare
  `"@levelup/functions-shared": "workspace:*"` and typecheck cleanly.
- The shared package exists and is built: `functions/shared` (name
  `@levelup/functions-shared`, `lib/` compiled with parse-request + rate-limit).
  The import target is valid — only the dependency declaration is missing.
- Likely also a **runtime** risk: compiled `functions/analytics/lib/utils/*.js`
  will `require('@levelup/functions-shared')` which won't resolve at deploy
  unless the dep is added.
- FIX (not applied — read-only): add
  `"@levelup/functions-shared": "workspace:*"` to
  `functions/analytics/package.json` dependencies, then `pnpm install`.

## NEEDS-REVIEW

- **Naming collision risk:** `packages/functions-shared/` is named
  `@levelup/functions-adapters` (NOT `@levelup/functions-shared`). The real
  `@levelup/functions-shared` lives at `functions/shared/`. The directory/name
  mismatch is confusing and worth confirming intentional — does not currently
  break the 3 audited packages.
- 2 minor TODOs (non-blocking):
  - `functions/analytics/src/triggers/on-space-progress-updated.ts:114` —
    `streakDays: 0 // TODO compute from RTDB`
  - `functions/autograde/src/utils/llm.ts:7` — TODO replace local types with
    `@levelup/shared-services` imports

## DONE / state of code

- **levelup**: 23 exports (15 callables, 3 doc triggers, 2 scheduled), full
  `__tests__` suite present. Typecheck clean. New untracked file
  `src/callable/get-item-for-edit.ts` (+compiled lib) — wired into
  `index.ts:11`.
- **analytics**: 12 exports (2 callables, 7 triggers, 3 schedulers), full test
  suite. Code complete; blocked only by the missing-dep build failure above.
- **autograde**: 13 exports (4 callables, 7 triggers, 1 scheduler) + full
  grading pipeline (`pipeline/`, `prompts/`, `utils/llm`, secret-manager).
  Typecheck clean. New untracked `__tests__/e2e-pipeline.test.ts` and
  `CONTRACT_REPORT.md`.

## UNCOMMITTED CHANGES (reported, NOT committed)

Extensive working-tree changes across all three packages — both `src/*.ts` and
committed `lib/*.js`+`.js.map` build artifacts are modified (lib is tracked in
this repo). Untracked additions: levelup `get-item-for-edit.*`, autograde
`e2e-pipeline.test.ts` + `CONTRACT_REPORT.md`. No deletions. Nothing committed
by this audit.

## RECOMMENDATION

One real blocker: analytics will not build or deploy until
`@levelup/functions-shared` is added to its `package.json`. levelup and
autograde are build-healthy.
