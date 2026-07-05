# SDK Review — PHASE 1 (Fat-SDK Architecture + LLD, READ-ONLY)

**Sub-coordinator:** Backend-Lead 🛠️ · **Mode:** READ-ONLY — findings only, **no
code changed, nothing pushed**. **Branch:** `staging` · **Root:**
`/Users/subhang/Desktop/Projects/auto-levleup` · **Date:** 2026-06-27 **Scope:**
the `@levelup` fat-SDK —
`packages/{domain, api-contract, api-client, repositories, transport-firebase, transport-http, query, services, realtime, offline, access, ai, functions-shared}`.
Legacy (`shared-*`, `old-deprecated/`) out of scope except to note leaks.

**Reviewers (4, parallel) and their detail reports:** | Concern | Reviewer |
Detail report | |---|---|---| | R1 · Layering & boundaries | be-sdk |
[`SDK-REVIEW-R1-layering.md`](./SDK-REVIEW-R1-layering.md) | | R2 · Foundation
(domain Zod / api-contract SSOT / types / v2\_ / timestamps) | be-data-seed |
[`SDK-REVIEW-R2-foundation.md`](./SDK-REVIEW-R2-foundation.md) | | R3 · Module
LLD (modularization / function defs / API design / interfaces / abstraction /
repos / transport / query-keys / errors) | be-backend |
[`SDK-REVIEW-R3-module-lld.md`](./SDK-REVIEW-R3-module-lld.md) | | R4 · Quality
(build/typecheck / coverage / dead code / duplication / dep hygiene) |
be-infra-deploy | [`SDK-REVIEW-R4-quality.md`](./SDK-REVIEW-R4-quality.md) |

This report aggregates and de-duplicates across all four. Severity: **P0** =
broken / will break prod / data loss; **P1** = serious design defect or
architecture violation; **P2** = meaningful improvement; **P3** = nit.

---

## Executive summary

**The fat-SDK foundation is fundamentally sound.** The intended layering exists
and is _internally_ clean: the dependency graph is **acyclic and correctly
directed** (`domain ← api-contract ← api-client ← repositories ← query`; cycle
scan = NONE), `domain` is a pure leaf with zero firebase/react/node leakage, the
timestamp trichotomy collapses through a single `toTimestamp()` adapter onto an
ISO-at-rest brand, `zObject` strict-authoring is a real lint-enforced
chokepoint, the error model has bijective transport maps with compile-time
exhaustiveness, the query key factory is principled, and the access policy is
table-driven. **All 13 packages typecheck clean and all 16 build targets pass.**
Dead-code hygiene is genuinely clean (0 TODO/FIXME across `src`).

**The defects are not in the foundation — they cluster at the seams, and almost
all are integration debt from the worktree merge**
(`91b420f chore(staging): capture all unique code from worktrees`). Five themes
dominate, and the most important ones were surfaced **independently by multiple
reviewers** (high confidence):

1. **One P0 data-correctness bug** — `testSessions` in-transaction writes land
   in an orphan collection no read touches → silent data loss (R3 · SVC-1,
   independently verified).
2. **"Canonical type lives in api-contract" is promised everywhere but built
   nowhere** → N hand-copied seams (Transport, wire envelope types, paginate
   kit, subscribe seam, AI-gateway port) that have **already drifted**. (R3 +
   R2 + R1 + R4 all hit facets of this.)
3. **The boundary lint gate is committed RED** — all 8 apps bypass
   `@levelup/query` and import `api-client`/`repositories`/`transport-firebase`
   directly from their composition roots; the guard catches no regressions while
   red. (R1 _and_ R4, same root cause.)
4. **The deferred "cross-domain dedupe wave" never ran** → duplicate callables,
   repos colliding on the same bag key (winner = spread order), duplicate hooks,
   and synonym `DomainName` invalidation roots causing **silent cache
   staleness**. (R3 + R2.)
5. **Test coverage is inverted vs risk** — the two fattest, most
   business-critical packages (`services` = 11.3k LOC / 11 tests;
   `functions-adapters` = 0 tests) are the least covered. ("services is thin" is
   true of its _tests_, not its _code_.) (R4.)

Two foundation-level P1 seams also need a decision before any `v2_` client
deploy: **timestamp wire drift** (~20 fields bare `z.string()` instead of
`zTimestamp`) and the **`v2_` prefix not being applied in `transport-firebase`
subscriptions** (realtime split-brain risk).

**Aggregate finding counts (raw, across the four reports; convergent items
counted per-reviewer):**

|               | P0    | P1     | P2     | P3     | Total   |
| ------------- | ----- | ------ | ------ | ------ | ------- |
| R1 Layering   | 0     | 1      | 2      | 2      | 5       |
| R2 Foundation | 0     | 3      | 7      | 4      | 14      |
| R3 Module LLD | 1     | 22     | 39     | 22     | 84      |
| R4 Quality    | 0     | 3      | 5      | 5      | 13      |
| **Total**     | **1** | **29** | **53** | **33** | **116** |

> No fixes were applied. This phase is human-gated; the consolidated P0/P1 list
> below is the proposed remediation backlog for the gate decision.

---

## Prioritized P0 / P1 list (consolidated & de-duplicated)

### P0 — fix before any further build on this layer

| ID        | Theme            | Location                                                        | Issue → Fix                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------- | ---------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SVC-1** | Data correctness | `services/src/repo-admin/tx.ts:34` vs `repo-admin/index.ts:163` | `FLAT_COLLECTION.testSessions = "testSessions"` but every read binds `entity("digitalTestSessions")`. In-tx upserts (`test-session.ts:104,150,188`; `triggers.ts:38`) write to an orphan collection no read queries → `saveTestAnswer` tracking + single-writer `isLatest` demotion **silently lost**. **Fix:** set `FLAT_COLLECTION.testSessions="digitalTestSessions"` + a parity test asserting `FLAT_COLLECTION` matches the `createRepos` collection map for every entity key. _(R3 · independently verified)_ |

### P1 — serious design defects / architecture violations

**Theme A — Canonical seams promised but never built (hand-copied, drifting).**
_Single highest-leverage structural fix: promote one canonical set into
`@levelup/api-contract` and delete the copies._

| ID              | Location                                                                                                     | Issue                                                                                                                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TR-1            | `transport-firebase/transport-contract.ts:99` vs `transport-http/seam.ts:53` vs `api-client/transport.ts:49` | `Transport` re-declared 3× claiming "byte-identical" but firebase carries `storage`, the others don't → **not swappable**; promised api-contract home doesn't exist.                                                |
| TR-2            | `api-client/{transport.ts:49,types.ts:28,create-client.ts:86}`, `repositories/.../storage.ts:43`             | Storage capability fragmented across 4 mismatched shapes incl. method-name mismatch (`upload(url,body,ct)` vs `uploadImage(input)`); `createApiClient` never wires `transport.storage`, yet `storageRepo` calls it. |
| REPO-4          | `repositories/src/{internal,gamification,testsession-progress,autograde,analytics}/api-types.ts`             | `PageRequest/PageResponse/SaveResponse/Callable` redefined 5× and drifted (`cursor: string` vs `string\|null`; `SaveResponse` with/without `deleted`).                                                              |
| MISC-3          | `functions-shared/context/ports.ts:155` vs `ai/gateway.ts:69`                                                | Injected `AiGateway` port structurally ≠ real `@levelup/ai` gateway (`promptTokens` vs `inputTokens`; no `text`) → `ctx.ai.generate()` typed against a fiction.                                                     |
| MISC-4          | `functions-shared/idempotency/dedupe.ts:25` vs `context/ports.ts:39`                                         | Port declares 4-arg `begin→{cached,inFlight}`; dedupe casts and calls 3-arg `begin→{status,result}`. Typed port is dead, cast hides incompatibility.                                                                |
| MISC-11         | `realtime/seam.ts:14`, `transport-http/seam.ts`, `query/provider/types.ts:9`                                 | Subscribe seam restated 3+× with divergent `SubscriptionStatus` (4-state vs 3-state).                                                                                                                               |
| LB-03 / Q-DUP-1 | `repositories/src/**/api-types.ts`, `query`, `api-client`                                                    | `ApiClientLike` structural views are hand-maintained copies of the api-client surface with **no compile-time link** → silent divergence. _(R1 + R4)_                                                                |

**Theme B — Boundary gate is committed RED (apps leak past `query`).** _Raised
by R1 and R4 independently._

| ID                | Location                                                                                                 | Issue                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LB-01 / Q-GUARD-1 | `lint-boundaries/.../import-graph-boundaries.test.ts` (R7); offenders `apps/*/src/sdk/{api,firebase}.ts` | All **8 apps** import `api-client`+`repositories`+`transport-firebase` from their composition roots. R7 has no composition-root carve-out → **8 failing tests, guard effectively disabled** (can't catch regressions). The wiring is also duplicated 8×. **Fix (pick one, deliberately):** extract a shared `createLevelUpSdk()` composition package so apps import only `query`+`domain`; **or** add a bounded `apps/*/src/sdk/**` R7 carve-out + tighten R2 to enforce transport-only-there. Do not leave it red. |

**Theme C — Deferred dedupe wave never ran (duplicate identities → silent
staleness/shadowing).** _R3 + R2._

| ID     | Location                                                           | Issue                                                                                                                                                                                                                        |
| ------ | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CON-2  | `api-contract/domains.ts:19`                                       | Synonym roots in canonical `DomainName` union (`evalSettings`+`evaluationSettings`, `deadLetter`+`gradingDeadLetter`, `enrollment`+`enrollments`) → invalidating one never refetches the other → **silent cache staleness**. |
| CON-4  | `levelup/gamification.ts:264` vs `analytics/dismiss-insight.ts:11` | `dismissInsight` duplicated in 2 modules, divergent response shapes, both on optimistic allowlist.                                                                                                                           |
| REPO-5 | `views/leaderboard.ts:50` vs `analytics/views/leaderboard.ts:39`   | Two different `LeaderboardRepo` impls collide on bag key `leaderboardRepo`; analytics spreads last → silently shadows gamification's REST+RTDB composer.                                                                     |
| REPO-6 | `views/exam-analytics.ts` vs `analytics/views/exam-analytics.ts`   | Duplicate `ExamAnalyticsRepo` on key `examAnalyticsRepo`; winner = spread order (comment defers it).                                                                                                                         |
| QRY-5  | `query/index.ts:218`                                               | Cross-domain hook-name collisions papered over by aliasing in the barrel (`useExamAnalytics`, leaderboard hooks, `useStudentSummary`…).                                                                                      |

**Theme D — Realtime layer wired to keys nothing reads + dead realtime/offline
runtimes.** _R3._

| ID     | Location                                                                        | Issue                                                                                                                                                                                        |
| ------ | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| QRY-1  | `query/realtime/subscription-keys.ts:44`                                        | `studentLevelLive` writes `levelKeys.detail("me")` but read hook keys on `"self"` → live payload never lands; `achievementUnlock` writes a key nothing reads → unlock events silently no-op. |
| QRY-2  | `query/gamification/keys.ts:45,50`                                              | Inconsistent self-sentinel `"me"` vs `"self"` within one domain (root cause of QRY-1). **Fix:** one exported `SELF` constant.                                                                |
| MISC-1 | `query/realtime/useSubscription.ts:24` vs `realtime/subscription-manager.ts:58` | `@levelup/realtime` runtime is **dead** — query ships its own `useSubscription` calling `transport.subscribe` directly; the refcount/dedupe/warm-replay manager is off the live path.        |
| MISC-2 | `offline/offline-queue.ts:28` vs `api-client/offline.ts:23`                     | `@levelup/offline` package is **dead** and duplicated by a divergent copy in api-client (ISO vs numeric `enqueuedAt`, `execute` vs `deliver`, `"syncing"` vs `"flushing"`).                  |

**Theme E — Authority/services layer: fake transactions + read-side mutation.**
_R3._

| ID    | Location                                         | Issue                                                                                                                                                                                                                                    |
| ----- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SVC-2 | `repo-admin/extended.ts:139,321,370,401,548,558` | `enroll`/`testSubmissions.put`/`awardAchievement`/`applyLevelDelta`/impersonation take `tx: TxHandle` but `void tx` it and do direct non-tx writes swallowed by `.catch(()=>undefined)`. Callers believe writes are atomic; they aren't. |
| SVC-3 | `repo-admin/index.ts:142`                        | "fail-closed" `writeInTx` ignores `_tx`, fire-and-forget `void auditRepo.write(...)` with hardcoded tenant → non-atomic, drops failures, can't write to the impersonated tenant. Opposite of fail-closed.                                |
| SVC-4 | `autograde/reads.ts:340`                         | A **list/read** endpoint calls `outbox.drain()` (marks rows delivered) then re-enqueues → flips delivery state, races the drain worker, duplicates rows every call.                                                                      |

**Theme F — Foundation seams (decide before any `v2_` client deploy).** _R2._

| ID        | Location                                                                                            | Issue                                                                                                                                                                                                                                                                                                                         |
| --------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-NS-01   | `transport-firebase/subscribe/subscription-sources.ts:87-134`                                       | Subscription paths hardcode `tenants/${T}/…` with **zero** prefix awareness (no `collectionPrefix` in the package). Under `LVLUP_COLLECTION_PREFIX=v2_`, writes go to `v2_tenants/…` but live subscriptions read `tenants/…` → **realtime split-brain**. Untested by the paths mirror test.                                   |
| F-TS-01   | `identity/*`, `subscriptions/*`, `autograde/*`, `levelup/gamification.ts` (~20 fields)              | Wire timestamp drift: ~20 `*At`/deadline fields are bare `z.string()` (one `z.string().datetime()` — a 3rd flavor) instead of canonical `zTimestamp`. `autograde/_shared.ts` proves the correct pattern; the rest is demonstrably inconsistent; `timestamp.zod.ts` header claims `zTimestamp` is used (doc-vs-reality drift). |
| F-SSOT-04 | `levelup/{evaluate-answer.ts:17,save-test-answer.ts:14,record-item-attempt.ts:21}`, `_shared.ts:96` | The most security-relevant wire field — student `answer` — is `z.unknown()` at the SSOT seam (4 callables). Server **must** re-validate per `questionType`; contract gives no guard.                                                                                                                                          |

**Theme G — Type-system escape hatches at the seams.** _R3._

| ID     | Location                                                                           | Issue                                                                                                                                                                                             |
| ------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SVC-13 | `shared/extended-repos.ts:200`                                                     | `xrepos(ctx) as unknown as ExtendedRepos` over a 25-member god interface → a repo `createRepos` forgets is a runtime `undefined`-crash, not a compile error; unsafe helper is public.             |
| REPO-7 | `levelup-content/{space.ts:46,_kit.ts:25}`                                         | Entire `levelup-content` repo surface returns `Promise<unknown>` (`ApiClientLike = Record<string,(d:unknown)=>Promise<unknown>>`) — no compile-time safety across the content domain.             |
| TR-3   | `transport-http/{invoke-via-http.ts:39,subscribe-via-sse.ts:18,server-time.ts:11}` | transport-http is a stub: `invoke` rejects loudly but `subscribe`/`serverTimeOffset` return inert never-firing handles with **no error surfaced** → swapping transports silently no-ops realtime. |

**Theme H — Coverage inverted vs risk.** _R4._

| ID       | Location                                             | Issue                                                                                                                                                                                                 |
| -------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q-TEST-1 | `services/src/**` (74 files / 11,328 LOC / 11 tests) | The fattest, most business-critical package (grading, analytics aggregation, repo-admin writes, idempotency) is near-untested — single largest correctness risk. DI-friendly, so fakes are tractable. |
| Q-TEST-2 | `functions-shared/src/**` (21 files / **0 tests**)   | The transport↔services boundary (error mapping, dedupe, on-document/schedule/call adapters) has zero tests; bugs here corrupt every function's contract.                                              |

---

## Cross-cutting recommendation (resolves ~25 findings at once)

Create a single canonical seam home — `packages/api-contract/src/transport/` (or
a zero-dep `@levelup/seam` leaf) — holding the **one** `Transport`,
`SubscriptionHandle`, `SubscriptionCallbacks`, `SubscriptionStatus`, and wire
envelope types `PageRequest`/`PageResponse`/`SaveResponse`/`Callable`. Have
`transport-firebase`, `transport-http`, `api-client`, every
`repositories/**/api-types.ts`, `query/provider/types.ts`, `realtime/seam.ts`,
and `functions-shared` import from it. This single move resolves **TR-1, TR-2,
REPO-4, MISC-3, MISC-11, LB-03/Q-DUP-1** and de-risks the 4× paginate / 3×
`SaveResponseSchema` duplications. It is the highest-leverage structural fix in
the entire review.

---

## Per-concern summary (full detail in the linked reports)

### R1 · Layering & boundaries — _CLEAN internally; gate RED at the app seam_

- **PASS:** acyclic + correctly directed (cycle scan NONE); `domain` pure leaf;
  `api-contract`→only `domain`; Firestore confined to `services/repo-admin` +
  `transport-firebase`; `query` is the only React binding; no deep cross-package
  `/src|/dist|/internal` imports.
- **P1:** LB-01 boundary gate RED (8 apps bypass `query`). **P2:** LB-02
  tier-check silently skips `functions-adapters` (stale name in TIERS table —
  future upward dep would pass undetected); LB-03 declared-vs-actual dep drift
  (`repositories` declares `api-client` but never imports it; `query` declares
  `offline`/`realtime` unused). **P3:** LB-04 dir/name mismatch; LB-05 comments
  cite non-existent `@levelup/repositories-admin` (canonical =
  `@levelup/services/repo-admin`).

### R2 · Foundation — _domain is excellent; drift is at the wire boundary_

- **PASS:** `zObject` strict everywhere (no `.passthrough()`/`.catchall()`),
  branded-id system (~45 ids), real discriminated unions for every polymorphic
  payload, single `toTimestamp()` edge adapter, no `z.date()` in domain, no
  `tenantId` leak in requests, `AUTHORITY_CALLABLES` regenerated, error/enum
  exhaustiveness, `v2_` prefix centralized **for server+seed** with a mirror
  test (repo-admin↔seed).
- **P1:** F-NS-01 (transport-firebase subscriptions ignore `v2_` prefix →
  split-brain), F-TS-01 (~20 bare-`z.string()` timestamp wire fields), F-SSOT-04
  (`answer` is `z.unknown()` at the seam). **P2:** F-SSOT-01 branded ids not
  used in `levelup`/`identity`/`subscriptions` requests (but are in `autograde`
  — inconsistent SSOT); F-SSOT-02 bounded lists bypass `pageResponse` (no
  `nextCursor`); F-SSOT-03 read-projection schemas re-declare entity fields (the
  drift mechanism behind F-TS-01); F-NS-02 hardcoded `tenants/` storage paths.

### R3 · Module LLD — _sound spine; worktree-merge integration debt at the seams_

- **PASS:** `CallableDef`/`SubscriptionDef` parallel pattern, registry with
  compile-time `_AssertAllDefs`, query key factory (finite
  `list/infinite/detail/sub` hierarchy enabling prefix-invalidation;
  answer-bearing editor keys isolated), invalidation graph derived from contract
  hints + totality test, access policy table, the four adapter shells.
- 1 P0 (SVC-1) + 22 P1 + 39 P2 + 22 P3 across all 13 packages. Dominant root
  causes: (1) canonical seams promised-not-built (Theme A); (2) deferred dedupe
  wave (Theme C); (3) type-system escape casts at the seams (Theme G); plus
  authority-layer fake-tx (Theme E), realtime key mismatches (Theme D), and
  path/`v2_` centralization gaps (SVC-6 ~15 inline paths outside `paths.ts`,
  SVC-7 `_rateLimits` bypasses `topLevel()`). Full 12-item prioritized list in
  the R3 report.

### R4 · Quality — _builds green; tests inverted vs risk; gate red_

- **PASS:** all 13 typecheck clean; 16/16 build targets pass; unit tests green
  under `NODE_ENV=development`; **0 TODO/FIXME**; `dist/` gitignored; no
  circular deps; no missing deps; peerDeps correct.
- **P1:** Q-GUARD-1 (= LB-01), Q-TEST-1 (`services` 11.3k LOC/11 tests),
  Q-TEST-2 (`functions-adapters` 0 tests). **P2:** Q-BUILD-1 inconsistent
  typecheck strategy (4 source-mapped vs 9 tsc-against-dist → "typecheck passed
  but against stale dist" footgun); Q-BUILD-3 `query` vitest non-hermetic —
  **false-RED** under `NODE_ENV=production` (`act() not supported`; 99/99 pass
  under `development`); Q-DEP-1 `query` declares `offline`+`realtime` but
  imports neither (possible missing integration); Q-TEST-3 thin coverage on
  `ai`/`offline`/`transport-http`/`access`. **P3:** Q-BUILD-2 dir/name mismatch;
  Q-DEP-2 `firebase-admin` drift (`^12.7.0` vs `^12.0.0`); Q-DUP-1
  structural-view drift risk.

---

## Recommended remediation sequencing (for the gate decision)

1. **SVC-1 (P0)** — testSessions collection fix + parity test. _Data
   correctness, smallest diff._
2. **Promote one canonical seam into `@levelup/api-contract`** (Theme A) —
   resolves ~25 findings; unblocks honest typing of transport/wire/subscribe.
3. **Run the deferred cross-domain dedupe wave** (Theme C) — kills silent cache
   staleness + repo shadowing.
4. **Decide & make the boundary gate green** (Theme B) — shared
   `createLevelUpSdk()` factory _or_ bounded carve-out; restores regression
   protection.
5. **Foundation seam decisions before any `v2_` client deploy** (Theme F) —
   `transport-firebase` prefix contract + timestamp sweep + `answer`
   re-validation guarantee.
6. **Make authority "tx" honest + stop read-side mutation** (Theme E) —
   durability of grading/enrollment/audit.
7. **Fix realtime key mismatches; delete dead `realtime`/`offline` runtimes**
   (Theme D).
8. **Remove type-system escape hatches** (Theme G) so the compiler proves the
   seams.
9. **Raise coverage on `services` + `functions-adapters`** (Theme H); pin
   `query` vitest `NODE_ENV`; standardize typecheck strategy.
10. **Hygiene:** rename `functions-shared`→`functions-adapters`, register it in
    the TIERS map, align `firebase-admin`, reconcile/document declared-vs-actual
    deps.

_End of Phase 1 aggregated report. Read-only; no code changed, nothing pushed.
Detail evidence (every finding as file:line) lives in the four linked R1–R4
reports._
