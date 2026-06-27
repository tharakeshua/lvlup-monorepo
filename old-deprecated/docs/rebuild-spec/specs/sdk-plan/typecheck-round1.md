# SDK Rebuild — Workspace Typecheck Report (Round 1)

Coordinator run. Command per package: `pnpm -F @levelup/<pkg> typecheck`. Run
from monorepo root after `pnpm install`.

> **NOTE — collection only. No source was fixed.** Two environment/scaffold
> issues had to be neutralized just to make `pnpm install` + `tsc` runnable (see
> "Environment fixes applied" below). Those are NOT code bugs.

---

## Result table (per package)

| Package                     | Status | TS error count | Dominant cause                                                                          |
| --------------------------- | ------ | -------------- | --------------------------------------------------------------------------------------- |
| @levelup/domain             | GREEN  | 0              | —                                                                                       |
| @levelup/api-contract       | RED    | 8              | test files pull shared `tests/sdk/**` harness outside `rootDir` (TS6059)                |
| @levelup/api-client         | RED    | 13             | same TS6059 + implicit-any test params + `@levelup/*` unresolved from `tests/sdk/fakes` |
| @levelup/transport-firebase | GREEN  | 0              | —                                                                                       |
| @levelup/transport-http     | GREEN  | 0              | —                                                                                       |
| @levelup/realtime           | GREEN  | 0              | —                                                                                       |
| @levelup/offline            | GREEN  | 0              | —                                                                                       |
| @levelup/repositories       | GREEN  | 0              | — (reference: correctly excludes tests)                                                 |
| @levelup/query              | GREEN  | 0              | —                                                                                       |
| @levelup/services           | RED    | 10             | test/harness pulls `firebase/*` + `tests/sdk/**` outside `rootDir` (TS6059)             |
| @levelup/access             | GREEN  | 0              | —                                                                                       |
| @levelup/ai                 | GREEN  | 0              | —                                                                                       |
| @levelup/functions-shared   | GREEN  | 0              | —                                                                                       |

**GREEN (10):** domain, transport-firebase, transport-http, realtime, offline,
repositories, query, access, ai, functions-shared. **RED (3):** api-contract,
api-client, services.

Total remaining real errors across workspace: **31** (all in 3 packages, all
test-file / tsconfig-include driven — zero in shipped `src` logic).

---

## Environment fixes applied (NOT code bugs — required to run the typecheck at all)

1. **`react`/`react-dom`/`@types/react` pinned to non-existent `^18.3.18`.**
   Latest 18.x is `18.3.1`; `pnpm install` hard-failed
   (`ERR_PNPM_NO_MATCHING_VERSION react-dom@^18.3.18`). Corrected to `^18.3.1`
   in `packages/query/package.json`, `packages/realtime/package.json`,
   `packages/shared-hooks/package.json`. Scaffold typo — should be folded into
   the frozen package.json templates.

2. **`NODE_ENV=production` in this shell ⇒ pnpm skipped ALL `devDependencies`.**
   Every typecheck-critical dep (`typescript`, `vitest`, `react`,
   `@tanstack/react-query`, `@types/react`) lives in `devDependencies`, so they
   were downloaded into the `.pnpm` virtual store but never symlinked into
   per-package `node_modules`. This manufactured ~85 phantom
   `TS2307 Cannot find module 'vitest'/'react'/'@tanstack/react-query'` and
   `TS7016` errors across nearly every package. **Reinstalling with
   `NODE_ENV=development pnpm install` linked the devDeps and those phantom
   errors vanished** (e.g. query went 124 -> 0, domain 27 -> 0). Fixers must run
   typecheck with devDeps linked (unset `NODE_ENV` / `NODE_ENV=development`),
   not in prod mode.

The error counts in the table above are post-environment-fix (the REAL picture).

---

## Per-package error detail (distinct signatures)

### @levelup/api-contract — 8 errors — RED

Root cause: `typecheck` runs bare `tsc --noEmit` against base `tsconfig.json`,
whose `include: ["src/**/*"]` compiles in-package tests
(`src/__tests__/registry-integrity.test.ts`). Those tests import the shared
repo-root harness `tests/sdk/fixtures/**`, which is outside `rootDir: ./src`.

- `TS6059` ×8 — "File
  '<repo>/tests/sdk/fixtures/{index,ordering,levelup.fixtures,identity.fixtures,autograde.fixtures,analytics.fixtures,callable-fixture}.ts'
  is not under 'rootDir' '<pkg>/src'".

Fix knob (config only, no test edit): add
`"exclude": ["node_modules","dist","src/**/*.test.ts","src/__tests__"]` (mirror
`packages/repositories/tsconfig.json`).

### @levelup/api-client — 13 errors — RED

Same `include`-pulls-tests root cause as api-contract, plus the dragged-in
`tests/sdk/fakes/**` files have untyped params and import `@levelup/*` from a
location where they don't resolve.

- `TS6059` ×8 —
  `tests/sdk/fakes/{index,in-memory-repos,fake-transport,fake-api-client,fake-ai-gateway,entity-factories}.ts` +
  `tests/sdk/harness/fixtures-ids.ts` not under `rootDir`.
- `TS7006` ×4 — Parameter `'data'` implicitly has an 'any' type (in
  `src/__tests__/{create-client,validate,call-path}.test.ts`).
- `TS2307` ×2 — `Cannot find module '@levelup/api-client'` / `'@levelup/domain'`
  (from `tests/sdk/fakes/{fake-api-client,entity-factories}.ts`).

Fix knob: same `exclude` block as above. The `@levelup/*` TS2307 and the
implicit-any are entirely inside test/harness files dragged in by the missing
exclude — they disappear once tests are excluded.

### @levelup/services — 10 errors — RED

Same missing-exclude root cause. Dragged-in
`tests/sdk/harness/{emulator,auth-context}.ts` use the `firebase/*` SDK (a dep
the `services` package itself does not declare, by design — no firebase outside
transport-firebase / repository-admin).

- `TS6059` ×5 — `tests/sdk/harness/{auth-context,emulator,fixtures-ids}.ts`,
  `tests/sdk/fakes/{in-memory-repos,fake-ai-gateway}.ts` not under `rootDir`.
- `TS2307` ×5 — `Cannot find module 'firebase/{app,auth,firestore,functions}'`
  (×4 in `emulator.ts`, +1 `firebase/auth` in `auth-context.ts`).

Fix knob: same `exclude` block. (The firebase TS2307s live only in the shared
emulator harness, which should not be compiled by the package typecheck.)

---

## Recommended division of work for the fixer wave

All 3 RED packages share ONE root cause: **base `tsconfig.json` lacks the
test-exclude block, and `typecheck` invokes bare `tsc --noEmit`.** The GREEN
`repositories` package is the reference: it excludes `src/**/*.test.ts` +
`src/__tests__`.

- **Fixer A (single small change, all 3 pkgs):** add
  `"src/**/*.test.ts","src/__tests__"` to `exclude` in
  `packages/{api-contract,api-client,services}/tsconfig.json`. This is a
  config-only change; it does NOT touch any test file and is consistent with
  "tests are typechecked by vitest, not the build typecheck."
- Confirm the 10 GREEN packages stay GREEN after any shared-config edits.
- Persist the environment fixes (react `^18.3.1` pins) into the frozen
  scaffolds; ensure CI runs install/typecheck with devDependencies (not
  `NODE_ENV=production`).

No shipped `src/**` logic produced a single type error in any package.
