# SDK Review R4 — QUALITY Audit (READ-ONLY)

**Auditor:** be-infra-deploy (🚀) · **Concern:** Quality · **Mode:** READ-ONLY
(no fixes applied) **Date:** 2026-06-27 · **Branch:** staging · **Root:**
`/Users/subhang/Desktop/Projects/auto-levleup`

**Scope:** the `@levelup` fat-SDK packages ONLY —
`packages/{domain, api-contract, api-client, repositories, transport-firebase, transport-http, query, services, realtime, offline, access, ai, functions-shared}`.
Legacy (`shared-*`, `old-deprecated/`) out of scope except to NOTE leaks.

> Note on package naming: `packages/functions-shared` is published as
> **`@levelup/functions-adapters`** (see Q-BUILD-2).
> `pnpm -F @levelup/functions-shared` resolves to `functions/shared` (a
> different codebase), NOT this SDK package.

---

## Executive summary

| Area                          | Verdict                                                                                 |
| ----------------------------- | --------------------------------------------------------------------------------------- |
| Typecheck (13 pkgs)           | ✅ All pass (`tsc --noEmit`)                                                            |
| Build (16 build targets)      | ✅ All pass (`turbo run build`, 16/16)                                                  |
| Unit tests (with correct env) | ✅ All in-scope pkgs green                                                              |
| Architecture-guard test       | ❌ **RED** — 8 boundary failures (committed)                                            |
| Test coverage distribution    | ⚠️ Heavily skewed — `services` & `functions-adapters` are the fat, near-untested layers |
| Dead code                     | ✅ Clean — 0 TODO/FIXME, no commented-out code blocks                                   |
| Duplication                   | ⚠️ Hand-maintained structural-view duplication (by design; drift risk)                  |
| Dependency hygiene            | ⚠️ Several declared-but-unused workspace deps; 1 version drift; circulars clean         |

**Counts by severity:** P0: 0 · P1: 3 · P2: 5 · P3: 5 (+ 4 positive
confirmations)

**Top 3:**

1. **Q-GUARD-1 (P1)** — `import-graph-boundaries.test.ts` is RED in committed
   code: all 8 apps import forbidden lower SDK layers from their composition
   roots. A red guard catches no regressions.
2. **Q-TEST-1 (P1)** — `@levelup/services` = 74 src files / **11,328 LOC** but
   only **2 test files / 11 tests**. The fat server-side business-logic layer is
   essentially untested.
3. **Q-TEST-2 (P1)** — `@levelup/functions-adapters` = 21 src files / **0
   tests**. The entire function-adapter layer (error mapping, idempotency,
   on-document/schedule/call adapters) is untested.

---

## A. Build / Typecheck health

All 13 in-scope packages **typecheck clean** (`pnpm -F <pkg> typecheck` →
exit 0) and all **16 build targets succeed**
(`pnpm -w turbo run build --filter=./packages/*` → 16/16 successful, 33s). No
type errors anywhere in scope.

### Q-BUILD-1 — Inconsistent typecheck strategy across packages (P2)

- **concern:** Build/typecheck reliability
- **location:**
  `packages/{transport-http,query,realtime,offline}/tsconfig.typecheck.json` vs
  the plain `tsc --noEmit` used by the other 9 packages.
- **issue:** 4 packages typecheck via a dedicated `tsconfig.typecheck.json` that
  path-maps deps to **source**
  (`"@levelup/api-contract": ["../api-contract/src/index.ts"]`), so they
  typecheck against live source. The other 9 packages run bare `tsc --noEmit`
  against `tsconfig.json`, which has **no path mappings** — they resolve
  workspace deps via the **built `dist/`** in `node_modules`. That means
  typecheck on those 9 only reflects the _last build_ of their dependencies; a
  source change in `domain` not yet rebuilt would be invisible to
  `api-contract`'s typecheck. Reliability silently depends on build
  freshness/order.
- **recommendation:** Standardize one strategy. Either give every package the
  source-mapped `tsconfig.typecheck.json`, or rely on `turbo`'s `^build`
  ordering uniformly and document it. The split is a footgun for "typecheck
  passed but against stale dist."

### Q-BUILD-2 — Package dir/name mismatch: `functions-shared` (P3)

- **concern:** Tooling ergonomics / error-prone targeting
- **location:** `packages/functions-shared/package.json:2` →
  `"name": "@levelup/functions-adapters"`; collides conceptually with
  `functions/shared` → `"name": "@levelup/functions-shared"`.
- **issue:** The directory `packages/functions-shared` does not match its
  package name. `pnpm -F @levelup/functions-shared <script>` runs against
  `functions/shared`, not this SDK package — easy to audit/deploy the wrong
  thing. (Hit during this audit.)
- **recommendation:** Rename the directory to `packages/functions-adapters` (or
  rename the package to `@levelup/functions-shared` and rename
  `functions/shared`). Pick one canonical name.

### Q-BUILD-3 — `query` test suite is non-hermetic w.r.t. `NODE_ENV` (P2)

- **concern:** Test/CI health
- **location:** `packages/query/vitest.config.ts` (no NODE_ENV pin); failures
  surface in `packages/query/src/__tests__/error-policy.test.ts:95` and
  `hooks-over-fake-repos.test.ts:137`.
- **issue:** With `NODE_ENV=production` in the environment,
  `pnpm -F @levelup/query test` produces **5 failures** —
  `Error: act(...) is not supported in production builds of React.` React
  Testing Library loads React's production build and `act` is stripped.
  Confirmed env-only: `NODE_ENV=development pnpm -F @levelup/query test` →
  **99/99 pass**. The suite gives a false RED on any machine/CI that exports
  `NODE_ENV=production` (a documented gotcha in this repo).
- **recommendation:** Pin `NODE_ENV` in `query`'s vitest config
  (`test.env: { NODE_ENV: 'test' }` or set `mode`), so the suite is
  deterministic regardless of ambient env.

---

## B. Architecture guard / boundary tests (test health)

`@levelup/lint-boundaries` enforces the SDK import graph. Results
(`NODE_ENV=development`):

- ✅ `tier-graph-acyclic.test.ts` — 6/6 (no circular workspace deps)
- ✅ `boundary-presets.table.test.ts` — 22/22
- ✅ in-graph rules: no `firebase/*` in client layers, no react/@tanstack in
  domain/contract/client, no deep-internal subpath imports, every subpath import
  targets a declared export — all green
- ❌ `import-graph-boundaries.test.ts` — **8 failures**

### Q-GUARD-1 — Boundary guard RED in committed code: apps reach past `query` into lower SDK layers (P1)

- **concern:** Architecture integrity + dead guard
- **location:**
  `packages/lint-boundaries/src/__tests__/import-graph-boundaries.test.ts` →
  rule "R7 apps-import-only-query-and-domain". Example evidence (admin-web):
  - `apps/admin-web/src/sdk/api.ts` imports `@levelup/api-client`
  - `apps/admin-web/src/sdk/api.ts` imports `@levelup/repositories`
  - `apps/admin-web/src/sdk/firebase.ts` imports `@levelup/transport-firebase`
  - Same pattern fails for all 8 apps:
    `admin-web, parent-web, student-web, super-admin, teacher-web, mobile-admin, mobile-student, mobile-teacher`.
- **issue:** The intended layering is
  `apps → @levelup/query → repositories → api-client → api-contract → domain`,
  with apps importing only `query` + `domain`. In reality every app's
  **composition root** (`apps/*/src/sdk/{api,firebase}.ts`) wires the concrete
  stack and therefore imports `api-client`, `repositories`, `transport-firebase`
  directly. The R7 rule has **no composition-root exception**, so the test has
  been left failing. A guard that is committed-red can no longer catch _new_
  regressions — it's effectively disabled. This is the SDK seam leaking into
  apps (NOTE per scope: apps are otherwise out of scope).
- **recommendation:** Decide the contract and make the guard green: (a) carve
  out `apps/*/src/sdk/**` (the DI/composition root) as an allowed boundary for
  wiring lower layers, OR (b) hide all wiring behind a `query`-exported factory
  so apps truly import only `query` + `domain`. Then the test guards regressions
  again. Leaving it red is the worst option.

---

## C. Test coverage & testability

Authoritative test counts (from `vitest` "Test Files / Tests", correct env), vs
source size:

| Package                | Test files | Tests  | Src files (non-test) | Assessment           |
| ---------------------- | ---------- | ------ | -------------------- | -------------------- |
| domain                 | 10         | 278    | ~70                  | ✅ strong            |
| api-contract           | 7          | 136    | ~96                  | ✅ strong            |
| api-client             | 10         | 118    | ~13                  | ✅ strong            |
| query                  | 9          | 99     | ~61                  | ✅ strong            |
| repositories           | 11         | 45     | ~69                  | ⚠️ broad-but-shallow |
| transport-firebase     | 5          | 20     | ~13                  | ⚠️ moderate          |
| realtime               | 3          | 16     | ~9                   | ⚠️ moderate          |
| access                 | 1          | 6      | ~8                   | ⚠️ thin              |
| transport-http         | 1          | 5      | ~8                   | ⚠️ thin              |
| ai                     | 1          | 4      | ~14                  | ⚠️ thin              |
| offline                | 1          | 4      | ~3                   | ⚠️ thin              |
| **services**           | **2**      | **11** | **74 (11,328 LOC)**  | ❌ **critical gap**  |
| **functions-adapters** | **0**      | **0**  | **21**               | ❌ **none**          |

### Q-TEST-1 — `@levelup/services` is fat and near-untested (P1)

- **concern:** Coverage of the most business-critical server layer
- **location:** `packages/services/src/**` — 74 source files, **11,328 LOC**,
  only `packages/services/src/__tests__` (2 files / 11 tests). Untested critical
  paths include `levelup/test-session.ts`, `analytics/cost-and-report.ts`,
  `repo-admin/index.ts`, grading flows.
- **issue:** The "thin function shells over `@levelup/services`" architecture
  means _functions_ are thin — but `services` itself holds the real logic
  (grading, analytics aggregation, repo-admin writes, idempotency). 11k LOC
  behind 11 tests is the single largest correctness risk in the SDK.
  (Coordinator hypothesis "services is known-thin": thin in _tests_, NOT thin in
  _code_.)
- **recommendation:** Treat `services` as the top coverage priority. The package
  already uses injected ports (DI-friendly per `shared/ai.ts`, `repo-admin`), so
  unit-testing with fakes is tractable — add suites for grading, analytics
  aggregation, and idempotent writes first.

### Q-TEST-2 — `@levelup/functions-adapters` has zero tests (P1)

- **concern:** Untested adapter/error-handling surface
- **location:** `packages/functions-shared/src/**` (21 files, 0 test files).
  Includes `request/map-error.ts`, `idempotency/dedupe.ts`,
  `adapters/{on-document,on-schedule,runtime}.ts`, `context/ports.ts`.
- **issue:** This is the transport↔services boundary: error mapping
  (ServiceError → callable error), idempotency/dedupe, and the
  on-document/on-schedule/on-call adapters. Bugs here corrupt every function's
  contract, yet there is no test at all.
  `pnpm -F @levelup/functions-adapters test` → "No test files found, exiting
  with code 1".
- **recommendation:** Add adapter tests: error-mapping table (each ServiceError
  code → expected HttpsError), dedupe idempotency key behavior, and adapter
  param extraction. These are pure-function-ish and cheap to cover.

### Q-TEST-3 — Thin coverage on `ai`, `offline`, `transport-http`, `access` (P2)

- **concern:** Lightly-tested critical paths
- **location:** `ai` (1/4, 16 src — AI grading gateway + secret-manager),
  `offline` (1/4 — mutation queue), `transport-http` (1/5 — HTTP/SSE/WS invoke),
  `access` (1/6 — authz).
- **issue:** AI grading (per-tenant Gemini key, cost logging) and the offline
  mutation queue are high-value, failure-prone paths with minimal coverage.
  `transport-http` invoke/subscribe paths (`invoke-via-http.ts`,
  `subscribe-via-{sse,ws}.ts`, `stub-handle.ts`) are barely exercised.
- **recommendation:** Prioritize `ai` (grade-request validation, cost-log shape,
  secret resolution failure) and `offline` (enqueue/replay/dedupe ordering) next
  after services/adapters.

### Q-TEST-4 — `repositories` coverage is broad-but-shallow (P3)

- **concern:** Coverage depth
- **location:** `packages/repositories/src/**` — 45 tests across ~69 src files
  (11 test files).
- **issue:** Roughly one test per ~1.5 source files; many per-domain repos
  (gamification, analytics, autograde, testsession-progress) have a single
  happy-path test. Invalidation/error/edge paths under-covered.
- **recommendation:** Add error + empty-result + pagination cases per repo
  family; the fake-client harness already exists.

---

## D. Dead code

### Q-DEAD-1 — Codebase is clean of dead markers (P3, positive)

- **location:** all 13 in-scope packages.
- **issue/finding:** **0** TODO/FIXME/HACK/XXX across every in-scope `src`
  (excluding tests). No multi-line commented-out code blocks found (the one
  `//`-heavy hit, `services/src/levelup/test-session.ts:247`, is an explanatory
  comment, not dead code). `dist/` is correctly gitignored (not tracked). This
  is a genuinely clean result — no action needed.
- **recommendation:** None. Maintain the bar.

---

## E. Duplication

### Q-DUP-1 — Hand-maintained "structural-view" duplication (P3)

- **concern:** Drift risk from copied type slices
- **location:** 5× `api-types.ts` in repositories —
  `repositories/src/{testsession-progress,autograde,gamification,internal,analytics}/api-types.ts`;
  plus 3× `seam.ts` (`transport-http/src/seam.ts`, `realtime/src/seam.ts`,
  `repositories/src/views-and-storage-auth/seam.ts`).
- **issue:** To break build-order coupling, each repo family re-declares a
  "minimal structural view" of the `@levelup/api-client` surface it consumes
  (documented intent in those files). This is deliberate decoupling, but it
  means a single `api-client` signature change must be mirrored by hand across N
  structural views; nothing fails fast if a view drifts from the real client
  (it'll just silently type-mismatch at the injection site).
- **recommendation:** Consider deriving these views from the real `ApiClient`
  type via `Pick`/`Parameters` utility types imported `import type` from
  `@levelup/api-client` (type-only, no runtime/build coupling), or codegen them.
  At minimum, add a typecheck assertion that each structural view is assignable
  from the real client.

---

## F. Dependency hygiene

**Circular deps:** none — `tier-graph-acyclic.test.ts` passes (6/6). ✅
**Missing deps:** none in SDK packages — every `@levelup/transport-firebase`
reference in `realtime`/`repositories`/`api-client` src is a **comment**; the
concrete transport is injected at the app composition root (DI), so no
undeclared runtime import. ✅ **peerDependencies:** correctly declared — `query`
(`react`, `@tanstack/react-query`) and `realtime` (`react`). ✅

### Q-DEP-1 — Declared-but-not-imported workspace deps; `query`→`offline`/`realtime` is a functional gap (P2)

- **concern:** Dep graph vs reality mismatch + possible missing integration
- **location (precise import scan, `^(import|export) … from '@levelup/…'`,
  excluding comments):**
  - `query`: declares `@levelup/offline`, `@levelup/realtime`, `@levelup/domain`
    — **imports none of the three** (only `api-contract`, `repositories`).
    `realtime`/`offline` are referenced only in a comment
    (`query/src/realtime/useSubscription.ts:9`).
  - `api-client`, `transport-firebase`, `transport-http`, `realtime`, `offline`:
    each declares `@levelup/domain` but imports only `@levelup/api-contract`
    (domain types come through api-contract's re-export).
  - `transport-http`: declares `@levelup/api-contract` + `@levelup/domain` but
    imports neither (no `@levelup/*` import in src).
  - `repositories`→`@levelup/api-client`, `services`→`@levelup/ai`,
    `functions-adapters`→`@levelup/services`: declared, used only structurally
    (not imported).
- **issue:** Two sub-cases. (1) **Build-ordering deps** (most of the above):
  these declared-but-unused deps are _load-bearing_ for `turbo`'s `^build`
  topological ordering and for logical-contract documentation — removing them
  would break build order. Not "delete me," but the dep graph no longer reflects
  actual imports, which misleads readers and tooling like `knip`/`depcheck`. (2)
  **`query` → `offline` + `realtime`** stands out: per the SDK plan, `query` is
  the layer that integrates offline + realtime, yet it imports neither — the
  realtime binding is purely structural and offline appears unwired. This is
  either dead declared deps or a **missing integration**.
- **recommendation:** Verify `query`'s offline/realtime wiring is actually
  complete (vs. structural stub). For the build-ordering category, document the
  convention explicitly (a comment in each `package.json` or a repo note:
  "workspace dep declared for build order / structural contract, not direct
  import") so future `depcheck` runs don't false-flag them.

### Q-DEP-2 — `firebase-admin` version drift (P3)

- **concern:** Version skew
- **location:** `packages/services/package.json` (`firebase-admin: ^12.7.0`) vs
  `packages/functions-shared/package.json` (`firebase-admin: ^12.0.0`).
- **issue:** Two different caret ranges for the same major across the
  server-side packages that share a runtime. Minor, but can resolve to divergent
  installed versions.
- **recommendation:** Align both to `^12.7.0` (or pin via a root pnpm
  catalog/override). All other shared deps — `zod ^4.3.6`, `typescript ^5.3.0`,
  `tsup ^8.0.0`, `vitest ^4.0.18`, `react ^18` — are already consistent across
  packages. ✅

---

## Prioritized improvement list (quality)

1. **(P1) Make the boundary guard green again** — add a composition-root
   exception (or factory-hide wiring) so `import-graph-boundaries.test.ts`
   guards regressions instead of sitting red [Q-GUARD-1].
2. **(P1) Cover `@levelup/services`** — top correctness risk: 11k LOC / 11
   tests. Start with grading, analytics aggregation, idempotent repo-admin
   writes [Q-TEST-1].
3. **(P1) Cover `@levelup/functions-adapters`** — error-mapping table, dedupe
   idempotency, adapter param extraction (0 tests today) [Q-TEST-2].
4. **(P2) Pin `NODE_ENV` in `query` vitest config** — eliminate the false-RED
   under `NODE_ENV=production` [Q-BUILD-3].
5. **(P2) Verify `query`→offline/realtime integration** is wired, not just
   declared [Q-DEP-1].
6. **(P2) Standardize typecheck strategy** — one tsconfig approach across all
   packages [Q-BUILD-1].
7. **(P2) Cover `ai` + `offline`** — AI grading gateway and offline mutation
   queue [Q-TEST-3].
8. **(P3) Rename `packages/functions-shared`** to match
   `@levelup/functions-adapters` [Q-BUILD-2].
9. **(P3) Derive/assert structural views** against the real `ApiClient` type to
   kill drift risk [Q-DUP-1].
10. **(P3) Align `firebase-admin` ranges** and document the build-order dep
    convention [Q-DEP-2, Q-DEP-1].

---

## Appendix — commands run (all READ-ONLY)

- `pnpm -F @levelup/<pkg> typecheck` (all 13) → all exit 0
- `pnpm -w turbo run build --filter=./packages/*` → 16/16 successful
- `pnpm -F @levelup/<pkg> test` (all 13) → green with `NODE_ENV=development`;
  `query` red only under `NODE_ENV=production`; `functions-adapters` "No test
  files"
- `NODE_ENV=development pnpm -F @levelup/lint-boundaries test` → 128 pass / 8
  fail (R7) / 4 skip
- Precise import vs declared-dep cross-check via
  `grep -E '^(import|export).*from ' + package.json` diff
- Version drift, peer-dep, circular-dep, TODO-density, dist-gitignore scans
