# SDK Review R1 — Layering & Boundaries Audit (READ-ONLY)

**Reviewer:** be-sdk (worker) · **Date:** 2026-06-27 · **Branch:** staging
**Scope:**
`packages/{domain,api-contract,api-client,repositories,transport-firebase,transport-http,query,realtime,offline,access,ai,services,functions-shared}`
(the `@levelup` fat-SDK). Legacy `shared-*` out of scope except where SDK leaks
into apps. **Method:** ran `@levelup/lint-boundaries` vitest suite + independent
grep of ACTUAL import statements across `packages/*/src` and `apps/*/src` +
manifest dep-graph cycle detection.

---

## Verdict

The **SDK internal layering is clean**: the package dependency graph is
**acyclic and correctly directed**. `domain` is a pure leaf, the 5-tier spine
(`domain ← api-contract ← api-client ← repositories ← query`) holds, transport
is never imported below the app root, Firestore is confined to the two allowed
sites, and `domain`/`api-contract` carry zero firebase/react/node/firestore. R3,
R4, R5, R8, R9, R12, R13, R14 all **PASS** for SDK packages.

**However the boundary gate is RED on `staging`:** `lint-boundaries` reports **8
failing tests / 140** — all `R7 apps-import-only-query-and-domain`. Every app
reaches **past `@levelup/query` into `api-client`, `repositories`, and
`transport-firebase`** from a per-app `src/sdk/` composition root. Plus two
manifest/lint coverage drifts found by independent inspection.

| Check                                                          | Result                              |
| -------------------------------------------------------------- | ----------------------------------- |
| Declared dep graph acyclic                                     | ✅ PASS (cycle scan: NONE)          |
| Spine direction `domain←contract←client←repos←query`           | ✅ PASS                             |
| `domain` zero upper-layer deps                                 | ✅ PASS (leaf)                      |
| `api-contract` → only `domain`                                 | ✅ PASS (58 imports, all domain)    |
| `query` does NOT import transport/services                     | ✅ PASS                             |
| transport not imported below root                              | ✅ PASS (R2)                        |
| Firestore only in `services/repo-admin` + `transport-firebase` | ✅ PASS                             |
| No raw Firestore types in domain/contract/repos                | ✅ PASS (duck-typed timestamp)      |
| **R7 apps import only query+domain**                           | ❌ **FAIL (8 apps)**                |
| Manifest tier check covers all server pkgs                     | ⚠️ GAP (functions-adapters skipped) |

---

## Findings

### LB-01 · Boundary lint gate is RED: every app bypasses `@levelup/query` to import `api-client`, `repositories`, and `transport-firebase` directly

- **concern:** Layering / R7 apps-import-only-query-and-domain
- **severity:** **P1** (architecture-contract violation + failing CI gate;
  pattern itself is defensible, see rec)
- **location:** all 8 apps' `src/sdk/` composition roots. Representative
  offenders (file:line):
  - `apps/student-web/src/sdk/api.ts:12`
    `import { createApiClient } from "@levelup/api-client"`
  - `apps/student-web/src/sdk/api.ts:13`
    `import { createRepositories } from "@levelup/repositories"`
  - `apps/student-web/src/sdk/api.ts:19` `from "@levelup/transport-firebase"`
  - `apps/student-web/src/sdk/firebase.ts:23`
    `import type { FirebaseTransportServices } from "@levelup/transport-firebase"`
  - identical pattern in
    `apps/{admin-web,parent-web,teacher-web,super-admin,mobile-student,mobile-admin,mobile-teacher}/src/sdk/{api.ts,firebase.ts,session.tsx}`
  - `apps/teacher-web/src/sdk/session.tsx:21`
    `import { createFirebaseAuthHandle } from "@levelup/transport-firebase"`
- **issue:** The intended contract is
  `apps -> @levelup/query -> repositories -> api-client -> ...`; apps must
  consume hooks + domain types ONLY. Instead each app carries a hand-rolled
  composition root in `src/sdk/` that imports the full lower wiring chain
  (transport → api-client → repositories). `lint-boundaries` R7
  (`import-graph-boundaries.test.ts:445-458`) flags these as forbidden — **8
  failing tests**. The companion R2 app check (`:407`) is currently soft-gated
  (`APP_MIGRATION_PENDING`), so transport-at-non-root is not yet enforced, but
  R7 is hard and now fails.
- **why this is real-but-nuanced:** A composition root legitimately MUST touch
  every layer to wire `transport → apiClient → repos → queryClient`. So the
  _code_ is acceptable DI-at-the-edge; the _violation_ is (a) R7 has no
  carve-out for an app composition-root directory, so the gate is red, and (b)
  the ~40-line wiring is duplicated across 8 apps (drift risk: each app can wire
  a slightly different SDK).
- **recommendation:** Pick one and make the gate green deliberately, do not
  leave it red:
  1. **Preferred** — extract the wiring into a single shared composition package
     (e.g. `@levelup/app-runtime` / `createLevelUpSdk(transport)`) that apps
     import once; apps then import only that + `@levelup/query` +
     `@levelup/domain`. Removes duplication and restores R7.
  2. Or add an explicit, narrow R7 carve-out for a recognized composition-root
     path (e.g. `apps/*/src/sdk/**` matching the R2 root-bootstrap allowance)
     AND tighten R2 to actually enforce transport-only-in-that-dir, so the
     relaxation is bounded and intentional rather than an open red gate.

### LB-02 · `tier-graph-acyclic` manifest check silently skips `functions-adapters` (stale package name in TIERS table)

- **concern:** Lint rule coverage gap
- **severity:** **P2**
- **location:**
  `packages/lint-boundaries/src/__tests__/tier-graph-acyclic.test.ts:37`
  (`"@levelup/functions-shared": "t-server"`) vs actual
  `packages/functions-shared/package.json` name `@levelup/functions-adapters`
- **issue:** The dir is `functions-shared` but the published package name is
  `@levelup/functions-adapters`. The manifest tier-conformance test keys on
  `pkg.name` (`tier-graph-acyclic.test.ts:71` `TIERS[pkg.name]`);
  `TIERS["@levelup/functions-adapters"]` is `undefined`, so `levelupPackages()`
  drops the package and its declared `@levelup/*` deps are **never** checked
  against `allowedTiers`. (`exports-and-manifest.test.ts:71` already uses the
  correct `functions-adapters` name, and `import-graph-boundaries.test.ts:278`
  keys on the _dir_ name so R12 still scans it — hence the inconsistency is
  internal to the lint suite.) Today the package's deps
  (`access, ai, api-contract, domain, services`) are all legal, so nothing is
  broken — but a future upward dep in `functions-adapters` would pass
  undetected.
- **recommendation:** Add `"@levelup/functions-adapters": "t-server"` to the
  TIERS map (or rename the dir/package to be consistent). Add an assertion that
  every `@levelup/*` package under `packages/` is present in TIERS so a name
  drift fails loudly instead of silently dropping coverage.

### LB-03 · Declared-dep vs actual-import drift — phantom deps + duplicated structural views

- **concern:** Manifest accuracy / drift risk (not a direction violation)
- **severity:** **P2**
- **location:**
  - `packages/repositories/package.json` declares `@levelup/api-client`, but
    **no source file imports it** — repos instead re-declare a minimal
    `ApiClientLike` structural view per slice, e.g.
    `packages/repositories/src/internal/api-types.ts`,
    `.../analytics/api-types.ts`, `.../autograde/api-types.ts`,
    `.../gamification/api-types.ts`, `.../testsession-progress/api-types.ts`
    (the `@levelup/api-client` references in `repositories/src` are all in
    comments).
  - `packages/query/package.json` declares `@levelup/offline` and
    `@levelup/realtime`, but `query/src` imports only `api-contract`, `domain`,
    `repositories`.
  - `packages/api-client/package.json` declares `@levelup/domain`, but
    `api-client/src` imports only `api-contract` (18×), never `domain` directly.
- **issue:** The injected-`ApiClient` decoupling (repos depend on a structural
  shape, not the concrete package) is a sound design — it lets repos build
  concurrently with api-client and keeps the seam thin. But the duplicated
  `ApiClientLike` views are hand-maintained copies of the real `api-client`
  public surface with **no compile-time link** back to it; if `api-client`'s
  surface changes, the structural views can silently diverge (the type system
  won't catch it). The phantom manifest deps (`api-client` in repos,
  `offline`/`realtime` in query, `domain` in api-client) also make the declared
  graph claim edges that the source doesn't exercise.
- **recommendation:** Either (a) have each `api-types.ts` derive from the real
  type, e.g.
  `type ApiClientLike = Pick<import("@levelup/api-client").ApiClient, ...>`
  (type-only import keeps runtime decoupling while making divergence a compile
  error), or (b) add a contract test asserting the structural view is assignable
  from the real `ApiClient`. Reconcile manifest deps with actual imports (drop
  or use the phantom edges) so the declared graph is the source of truth
  depcruise relies on.

### LB-04 · Dir/name mismatch: `packages/functions-shared` publishes `@levelup/functions-adapters`

- **concern:** Naming consistency (root cause of LB-02)
- **severity:** **P3**
- **location:**
  `packages/functions-shared/package.json:name = "@levelup/functions-adapters"`
- **issue:** Directory name and package name disagree, which is what let the
  TIERS table drift (LB-02) and makes grep/navigation error-prone (the SDK
  identity docs and several lint tables still say `functions-shared`).
- **recommendation:** Settle on one name across dir, `package.json`, TIERS
  table, and reference plans.

### LB-05 · Comments reference a non-existent package `@levelup/repositories-admin`

- **concern:** Doc accuracy
- **severity:** **P3**
- **location:** `packages/functions-shared/src/context/ports.ts:4,10,137`;
  `packages/functions-shared/src/adapters/runtime.ts:8`
- **issue:** JSDoc says
  `import type { Repos } from '@levelup/repositories-admin'`, but no such
  package exists. The canonical admin adapter ships as the subpath
  `@levelup/services/repo-admin` (the rebuild also has no standalone
  `repository-admin` package — confirmed by
  `import-graph-boundaries.test.ts:236`). These are comments only (not real
  imports), so no build impact, but they misdirect readers about the admin seam.
- **recommendation:** Update the comments to `@levelup/services/repo-admin`.

---

## What is CORRECT (verified, no action)

- **Acyclic + directed:** manifest cycle scan = NONE. Edges: `domain`=leaf;
  `api-contract→domain`; `api-client→{contract,domain}`;
  `repositories→{api-client,contract,domain}`;
  `query→{contract,domain,offline,realtime,repositories}`;
  `transport-{firebase,http}→{contract,domain}`; `access/ai→{contract,domain}`;
  `services→{access,ai,contract,domain}`;
  `functions-adapters→{access,ai,contract,domain,services}`. All strictly
  downward.
- **`domain` & `api-contract` are pure** — zero
  firebase/react/node/firestore/secrets (R3 PASS). Timestamp sharp-edge handled
  correctly: `packages/domain/src/primitives/timestamp.ts` uses a **duck-typed**
  `FirestoreTimestamp` (`{seconds,nanoseconds}`) with an explicit "NO firebase
  import" contract; persistence is ISO strings via `zTimestamp`. No raw
  `Timestamp`/`DocumentSnapshot`/`FieldValue` leaks into domain/contract/repos.
- **No direct Firestore in the client brain** (R4/R8 PASS).
  `firebase-admin/firestore` appears ONLY under
  `packages/services/src/repo-admin/*` (the admin adapter site).
  `firebase/firestore` client SDK is confined to `packages/transport-firebase`.
  Zero firestore in `services` logic outside `repo-admin`.
- **`firebase-functions` confined to the deploy-adapter tier** — only
  `packages/functions-shared/src/adapters/*` and `request/map-error.ts`; never
  in `services/access/ai` (R9 PASS).
- **Transport injected at root only** below the SDK — no t0..t4 package imports
  `@levelup/transport-*` (R2 PASS for packages).
- **`query` is the only React binding**;
  `domain/api-contract/api-client/repositories/offline` carry no react/@tanstack
  (R5 PASS).
- **No deep `/src|/dist|/internal` cross-package imports** (R13 PASS); no
  secret-manager in any client tier (R14 PASS); server packages never import the
  client brain (R12 PASS).

---

## Prioritized improvement list (my concern)

1. **(P1) Make the boundary gate green deliberately** — resolve the 8 R7
   failures: extract a shared `createLevelUpSdk()` composition package OR add a
   bounded `apps/*/src/sdk/**` carve-out to R7 + tighten R2 to enforce it.
   Leaving CI red erodes the gate's value.
2. **(P2) Close the tier-check coverage gap** — register
   `@levelup/functions-adapters` in the TIERS table and assert every
   `@levelup/*` package is tier-mapped, so name drift fails loud.
3. **(P2) Eliminate declared-vs-actual dep drift** — link the `ApiClientLike`
   structural views to the real `api-client` type (type-only
   `Pick`/assignability test) and reconcile phantom manifest deps (`api-client`
   in repos; `offline`/`realtime` in query; `domain` in api-client).
4. **(P3) Fix `functions-shared`↔`functions-adapters` naming** across
   dir/manifest/TIERS/docs, and correct the `@levelup/repositories-admin`
   comments to `@levelup/services/repo-admin`.

---

## Raw evidence

- `lint-boundaries` run: **1 file failed / 6 passed / 2 skipped; 8 tests failed
  / 128 passed / 4 skipped** (the 8 failures are exactly
  `R7 > apps/<each> imports no forbidden @levelup/* (R7)`).
- Cycle scan over `packages/*/package.json` `@levelup/*` edges: **NONE**.
- Per-package actual `@levelup/*` import counts (grep of `packages/*/src`):
  domain=0; api-contract→domain(58); api-client→api-contract(18);
  repositories→{domain(40),api-contract(3)} (NO api-client import);
  query→{repositories(15),api-contract(15),domain(6)};
  transport-firebase→api-contract(12); transport-http→api-contract(1);
  realtime→api-contract(2); offline→api-contract(2);
  access→{domain(4),api-contract(2)}; ai→{domain(7),api-contract(1)};
  services→{access(26),api-contract(23),domain(6)}.
