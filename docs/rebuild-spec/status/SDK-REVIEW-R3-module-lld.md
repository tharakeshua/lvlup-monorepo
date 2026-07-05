# SDK Review R3 — Module LLD Audit (per-package internal design)

**Reviewer:** be-backend (worker `sess_1782552587708_5gjggf77o`) · **Mode:**
READ-ONLY, findings only — no code changed. **Branch:** staging · **Root:**
`/Users/subhang/Desktop/Projects/auto-levleup` **Date:** 2026-06-27 **Scope:**
the `@levelup` fat-SDK packages only —
`packages/{domain, api-contract, api-client, repositories, transport-firebase, transport-http, query, services, realtime, offline, access, ai, functions-shared}`.
Legacy (`shared-*`, `old-deprecated/`) out of scope except to note leaks.
**Lenses (per Program-Lead):** Modularization & cohesion · Public surface
(index.ts) · Function definitions · API design & interfaces · Query layer ·
Error handling & retries · Abstraction.

---

## Severity counts

| Severity                    | Count  |
| --------------------------- | ------ |
| P0 (broken/blocking)        | 1      |
| P1 (serious design flaw)    | 22     |
| P2 (meaningful improvement) | 39     |
| P3 (minor/nit)              | 22     |
| **Total**                   | **84** |

Per package: domain+api-contract (3×P1, 7×P2, 3×P3) · repositories (7×P1, 5×P2,
2×P3) · transport+api-client (3×P1, 5×P2, 6×P3) · query (2×P1, 5×P2, 6×P3) ·
services (1×P0, 3×P1, 9×P2, 1×P3) · realtime/offline/access/ai/functions-shared
(4×P1, 8×P2, 4×P3).

---

## Executive summary — the three dominant themes

The fat-SDK layering is fundamentally sound: the
query→repositories→api-client→api-contract→domain chain exists, the key factory
is principled, the access table is table-driven, the error model has bijective
transport maps, and the `zObject` strict-authoring chokepoint is real. The
defects cluster into **three recurring root causes**, almost all of which are
_integration debt from the worktree merge_
(`91b420f chore(staging): capture all unique code from worktrees`), not new
design errors:

1. **"Canonical type lives in api-contract" is promised everywhere but built
   nowhere → N hand-copied seams that have already DRIFTED.** The `Transport`
   contract is maintained as 3 independent copies that disagree on `storage`;
   the realtime subscribe seam is restated in ≥3 packages with divergent status
   enums; the `PageRequest/PageResponse/SaveResponse/Callable` wire types are
   redefined in 5 repository `api-types.ts` files with `cursor: string` vs
   `string|null` drift; `paginate.ts` is copy-pasted across 4 domains with
   behavioral divergence; `SaveResponseSchema` exists in 3 places in
   api-contract; the AI gateway port in `functions-shared` structurally does
   **not** match the real `@levelup/ai` gateway; backoff retry and
   `secretNameFor` are each implemented twice. **This is the single
   highest-leverage fix: promote the canonical seams into
   `@levelup/api-contract` and delete the copies.**

2. **The cross-domain dedupe wave was deferred and never run.** Multiple in-code
   comments literally say "left for the cross-domain typecheck/fix wave."
   Result: duplicate callables (`dismissInsight`, `getExamAnalytics` in two
   modules with divergent shapes), duplicate repos colliding on the same bag key
   (`leaderboardRepo`, `examAnalyticsRepo` — winner decided by spread order),
   duplicate hooks aliased in the query barrel, and synonym roots in the
   `DomainName` invalidation union (`evalSettings`+`evaluationSettings`) that
   cause silent cache staleness.

3. **Casts that defeat the type system at exactly the seams the architecture
   depends on.** `xrepos(ctx) as unknown as ExtendedRepos` (25-member god
   interface, missing repo = runtime crash), `dedupe.ts` double-casts the
   idempotency repo against a port it contradicts, `create-client.ts` ships
   `as unknown as ApiClient`, the public `Repositories` type is widened by
   `& Record<string, Repo>` erasing per-repo typing, and the entire
   `levelup-content` repo surface returns `Promise<unknown>`.

One genuine **P0 data-correctness bug** surfaced (services SVC-1):
in-transaction test-session writes land in an orphan collection no read touches.

---

## P0 — must fix before further build

### SVC-1 · `testSessions` tx writes go to an orphan collection (silent data loss)

- **Severity:** P0
- **Location:** `packages/services/src/repo-admin/tx.ts:34` vs
  `packages/services/src/repo-admin/index.ts:163`
- **Issue:** Reads bind `testSessions: entity("digitalTestSessions")`
  (index.ts:163), but the tx handle's
  `FLAT_COLLECTION.testSessions = "testSessions"` (tx.ts:34, consumed at
  tx.ts:56,79). Every in-transaction `tx.upsert("testSessions", …)` —
  demote-prior-`isLatest` (`test-session.ts:104`), the start/active-session
  writes (`test-session.ts:150,188`), and the abandon trigger (`triggers.ts:38`)
  — writes to `tenants/{t}/testSessions/{id}`, a collection no read ever
  queries. The non-tx path (`ctx.repos.testSessions.upsert`, lines 99/257)
  correctly hits `digitalTestSessions`, so the two writers split the entity
  across two collections. `saveTestAnswer` visited/answered tracking and
  single-writer `isLatest` demotion are silently lost.
- **Verified:** confirmed by direct read of both files this session.
- **Recommendation:** Set
  `FLAT_COLLECTION.testSessions = "digitalTestSessions"`, and add a unit test
  asserting `FLAT_COLLECTION` agrees with the `createRepos` collection map for
  every entity key.

---

## Cross-cutting recommendation (addresses ~25 findings at once)

Create `packages/api-contract/src/transport/` (or a sibling `@levelup/seam` leaf
with zero deps) holding the **one** canonical `Transport`, `SubscriptionHandle`,
`SubscriptionCallbacks`, `SubscriptionStatus`, and the wire envelope types
`PageRequest/PageResponse/SaveResponse/Callable`. Have transport-firebase,
transport-http, api-client, repositories (all `api-types.ts`), query
(`provider/types.ts`), realtime (`seam.ts`), and functions-shared import from
it. This single move resolves: TR-1, TR-2, REPO-4, MISC-3, MISC-11, and de-risks
the 4× paginate / 3× SaveResponseSchema duplications.

---

## packages/domain + packages/api-contract

### CON-1 · Callable schemas unreachable from the barrel; subscription schemas reachable (asymmetric public surface)

- **Severity:** P1 · **Location:** `api-contract/src/index.ts:10-58` +
  `api-contract/package.json` exports
- **Issue:** `index.ts` re-exports registry/errors/pagination/transitions/meta
  and `export * from "./subscriptions/index"` (surfacing every channel payload
  schema), but never re-exports `./callables/*`. With `exports` closed to the
  barrel, downstream cannot import named callable VIEW schemas
  (`TestSubmissionResultViewSchema`, `ExamListViewSchema`), value-objects
  (`ParentAlertSchema`), or enum consts (`DAYS_OF_WEEK`, `zTrendGranularity`) —
  only indirectly via `CALLABLES[name].requestSchema`.
- **Recommendation:** Re-export the four callable module barrels from `index.ts`
  (mirror the subscriptions treatment) or add explicit subpath `exports`.

### CON-2 · Synonym roots in the canonical `DomainName` invalidation union → silent cache staleness

- **Severity:** P1 · **Location:** `api-contract/src/domains.ts:19-86`
  (`evalSettings`+`evaluationSettings`, `deadLetter`+`gradingDeadLetter`,
  `enrollment`+`enrollments`)
- **Issue:** `DOMAIN_NAMES` is the closed set of canonical query-key roots, yet
  carries synonym pairs. A mutation invalidating `"evaluationSettings"` will
  never refetch a query keyed on `"evalSettings"`. Reads as a worktree-merge
  artifact.
- **Recommendation:** Collapse each synonym pair to one canonical root; add a
  test asserting no two roots are aliases.

### CON-3 · `leaderboardLive` subscription name↔module contradiction outside the documented allow-list

- **Severity:** P1 · **Location:**
  `api-contract/src/callables/subscriptions/leaderboard-live.ts:37-38`
  (`name: "v1.levelup.leaderboardLive"`, `module: "analytics"`); invariant at
  `subscriptions/registry.ts:9-14`
- **Issue:** The integrity invariant asserts the name's `<module>` segment
  equals `def.module`, with only `notification→identity` allow-listed.
  `leaderboardLive` is named under `levelup` but deploys in `analytics` —
  undocumented carve-out; clients subscribe via `levelup` while the server
  produces it in `analytics`.
- **Recommendation:** Rename to `v1.analytics.leaderboardLive` (or set
  `module: "levelup"`) and document any fold in the allow-list.

### CON-4 · Duplicate `dismissInsight` callable in two modules with divergent response shapes

- **Severity:** P2 · **Location:**
  `api-contract/src/callables/levelup/gamification.ts:264-281` vs
  `api-contract/src/callables/analytics/dismiss-insight.ts:11-31`
- **Issue:** `v1.levelup.dismissInsight` (`{id, dismissed:true}`) and
  `v1.analytics.dismissInsight` (`{id, dismissedAt}`) implement the same op,
  both invalidate `"insights"`, both on `OPTIMISTIC_ALLOWLIST`
  (registry.ts:95-96). Ambiguous ownership, divergent wire contracts.
- **Recommendation:** Pick one owning module, delete the other.

### CON-5 · Duplicate `getExamAnalytics` read with re-declared vs domain response schema

- **Severity:** P2 · **Location:**
  `api-contract/src/callables/analytics/get-exam-analytics.ts:17` (domain
  `ExamAnalyticsSchema`) vs
  `api-contract/src/callables/autograde/_shared.ts:298-313`
- **Issue:** Both `v1.analytics.getExamAnalytics` and
  `v1.autograde.getExamAnalytics` read exam analytics; autograde re-declares a
  hand-written view schema while analytics returns the canonical entity — two
  shapes that can drift.
- **Recommendation:** Project from one shared schema (or collapse to one
  callable).

### CON-6 · Untyped `z.record(z.string(), z.unknown())` `data` bags defeat the wire SSOT

- **Severity:** P2 · **Location:**
  `api-contract/src/callables/levelup/gamification.ts:131,197`;
  `api-contract/src/callables/identity/_shared.ts:39` (`looseRecord`)
- **Issue:** `saveAchievementDefinition`/`saveStudyGoal` accept an opaque
  untyped record, unlike `saveSpace`'s fully typed `SaveSpaceDataSchema`
  (`save-space.ts:11-39`). Strictness is uneven across the registry.
- **Recommendation:** Replace untyped `data` bags with explicit `.strict()`
  field schemas.

### CON-7 · `SaveResponseSchema` forked in three places (acknowledged-but-deferred fold)

- **Severity:** P2 · **Location:**
  `api-contract/src/callables/core/_shared.ts:9-15`, `identity/_shared.ts:26-33`
  (comment admits "byte-identical… folds them onto the core versions"),
  `autograde/_shared.ts:78-88`
- **Issue:** The canonical upsert response is copied in identity
  (self-documented deferred fold) and re-shaped in autograde — violates
  canonical-in-one-place.
- **Recommendation:** Import `SaveResponseSchema` from `core/_shared` in
  identity and autograde; delete the copies.

### CON-8 · 38 branded-ID `as*()` factories are unchecked casts, inconsistent with validating primitive factories

- **Severity:** P2 · **Location:** `domain/src/primitives/brand.ts:77-127` (all
  `(id) => id as XId`) vs `timestamp.ts:20` (`asTimestamp` throws),
  `iso-date.ts:14` (`asIsoDate` throws)
- **Issue:** Branded-ID "trust-boundary" factories validate nothing while other
  primitive `as*()` factories throw — "crossing the trust boundary" means
  different things per primitive; 38 near-identical one-liners are pure
  copy-paste a generic `brander<T>()` eliminates.
- **Recommendation:** Generate ID factories from `BRAND_TAGS` via one
  `brander<Tag>()` helper.

### CON-9 · Two callable-def authoring styles on a false import-cycle justification

- **Severity:** P2 · **Location:** `autograde/save-exam.ts:55-67`
  (`as const satisfies CallableDef`) vs `levelup/save-space.ts:52` /
  `autograde/fold.ts:31` (`defineCallable<>()`); justification at
  `autograde/_shared.ts:14-18`
- **Issue:** autograde cites "import cycle" for using `satisfies` over
  `defineCallable`, but `fold.ts`/`gamification.ts` — same registry spread — use
  `defineCallable` (which imports nothing from `registry.ts`). No cycle exists;
  two conventions coexist within one folder.
- **Recommendation:** Standardize on `defineCallable()`; drop the `satisfies`
  variant.

### CON-10 · Subscription channel defs live under `callables/` though subscriptions aren't callables

- **Severity:** P2 · **Location:** `api-contract/src/callables/subscriptions/*`
  consumed by `subscriptions/registry.ts:17`
- **Issue:** The subscription frame lives in `src/subscriptions/` but the
  channel defs live in `src/callables/subscriptions/`; the registry reaches into
  a sibling tree named for a different concept. Folder name misleads.
- **Recommendation:** Move channel def files under
  `src/subscriptions/channels/`.

### CON-11 · Inconsistent file granularity; identity barrel doc-comment is false

- **Severity:** P2 · **Location:** `identity/entities.ts` (~400 LOC, ~15
  callables), `identity/tenant.ts` (386 LOC) vs one-callable-per-file in
  `levelup/*`, `autograde/*`; claim at `identity/index.ts:9` ("One callable per
  source file")
- **Issue:** Same package, two organizing conventions; identity barrel's comment
  asserts the convention it violates.
- **Recommendation:** Pick one granularity; fix the misleading comment.

### CON-12 · `AnyId` / `BRAND_TAGS` cover only 19 of ~50 brands — misleading name

- **Severity:** P3 · **Location:** `domain/src/primitives/brand.ts:132-178`
- **Issue:** `AnyId` reads as "any branded id" but excludes `TestSessionId`,
  `ChatSessionId`, `PurchaseId`, ~30 more; consumers using it as a catch-all
  silently exclude the majority.
- **Recommendation:** Rename to `CoreId`/`CORE_BRAND_TAGS` or extend to all
  brands.

### CON-13 · SSOT doc-comment drifts from its own schema shape

- **Severity:** P3 · **Location:** `identity/entities.ts:4` (documents
  `{id,created,archived?}`) vs actual
  `SaveResponseSchema = {id, created?, deleted?}` (`core/_shared.ts:9-15`)
- **Recommendation:** Fix the comment to `{id, created?, deleted?}`.

> **Solid (preserve):** the `CallableDef`/`SubscriptionDef` parallel pattern,
> registry assembly with compile-time `_AssertAllDefs`, regenerated
> `AUTHORITY_CALLABLES`, the bijective error maps with exhaustiveness checks,
> the `toTimestamp` adapter collapsing the Firestore/epoch/ISO trichotomy onto
> the ISO-at-rest brand, the `zObject` strict chokepoint, and the two-level
> discriminated `ItemPayloadSchema`.

---

## packages/repositories

### REPO-1 · Pagination kit duplicated 4× with silent behavioral drift

- **Severity:** P1 · **Location:** `autograde/paginate.ts:30-75`,
  `testsession-progress/paginate.ts:30-69`, `analytics/paginate.ts:30-69`,
  `internal/paginate.ts:28-70`
- **Issue:** `paginate`/`listOnce`/`toBag` copy-pasted and diverged: autograde
  normalizes via `listOnce` (`items ?? []`, conditional `total`);
  testsession/analytics call the raw `fetcher` directly (line 48) and set
  `total: page.total` unconditionally (line 35) → surfaces `total: undefined`
  keys, no `items` fallback. `internal` is a third variant using
  `listPage`/`ListFn`.
- **Recommendation:** Hoist one canonical `paginate.ts` into a shared module;
  every domain re-exports it (as gamification already does).

### REPO-2 · A second, incompatible pagination abstraction in `_kit.ts`

- **Severity:** P1 · **Location:** `levelup-content/_kit.ts:62-108` vs
  `autograde/paginate.ts:14-21`
- **Issue:** levelup-content's `PageBag.fetchNextPage` is **required**; every
  other domain's is **optional** (omitted at end-of-stream). Two structurally
  different iterator contracts under the same name.
- **Recommendation:** Collapse `_kit`'s paginator onto the shared `paginate.ts`.

### REPO-3 · `makePaginator` re-issues a wire call past the end-of-stream sentinel (contradicts its own doc)

- **Severity:** P2 · **Location:** `levelup-content/_kit.ts:101-104` (doc at
  88-92)
- **Issue:** When `nextCursor === null` the bound `fetchNextPage` still calls
  `fetch({…, cursor: null})` — a real `invoke` — though the doc promises it
  "never re-issues past it" and siblings omit `fetchNextPage` at end-of-stream.
- **Recommendation:** Make `fetchNextPage` optional and absent once
  `nextCursor === null`.

### REPO-4 · `PageRequest/PageResponse/SaveResponse/Callable` redefined in every `api-types.ts` with drift

- **Severity:** P1 · **Location:** `internal/api-types.ts:48-53`,
  `gamification/api-types.ts:38-54`, `testsession-progress/api-types.ts:35-46`,
  `autograde/api-types.ts:49-65`, `analytics/api-types.ts:45-57`
- **Issue:** Each domain hand-rolls the envelope types and they drifted:
  `PageRequest.cursor` is `string|null` in autograde/analytics but `string` in
  internal/gamification/testsession; `SaveResponse` is `{id;created?;deleted?}`
  in autograde/internal but `{id;created}` (no `deleted`) in gamification;
  `Callable<Req,Res>` re-declared 5× identically.
- **Recommendation:** One shared `wire-types.ts` imported by all domains (see
  cross-cutting rec).

### REPO-5 · Two distinct `LeaderboardRepo` implementations collide on bag key `leaderboardRepo`

- **Severity:** P1 · **Location:** `views/leaderboard.ts:50-79`
  (`getPage`/`assignRanks`/`mergeLive`) vs
  `analytics/views/leaderboard.ts:39-56`
  (`get`/`getLive`/`computeRankWithTier`); assembled at `index.ts:173-180`
- **Issue:** gamification (`index.ts:49`) and analytics (`index.ts:50`) both set
  `leaderboardRepo` to different interfaces; analytics spreads last and silently
  shadows gamification's REST+RTDB board composer.
- **Recommendation:** Distinct bag keys (`leaderboardBoardRepo` vs
  `leaderboardAnalyticsRepo`) or merge.

### REPO-6 · Duplicate `ExamAnalyticsRepo` collision, acknowledged but unresolved

- **Severity:** P1 · **Location:** `views/exam-analytics.ts` vs
  `analytics/views/exam-analytics.ts`; `index.ts:123-126,178-180`
- **Issue:** Two `createExamAnalyticsRepo` keyed `examAnalyticsRepo`; comment
  defers dedupe ("left for the cross-domain typecheck/fix wave"); winner picked
  by spread order.
- **Recommendation:** Pick one canonical view repo; delete/rename the other.

### REPO-7 · `levelup-content` repo surface entirely untyped (`unknown`)

- **Severity:** P1 · **Location:** `levelup-content/space.ts:46-66`,
  `levelup-content/_kit.ts:25-49`
- **Issue:** Unlike every other domain's typed `Callable<Req,Res>` client,
  `_kit`'s `ApiClientLike = Record<string, (data:unknown)=>Promise<unknown>>`,
  forcing `lv["listSpaces"]!(filter)` and making `get/list/save/getMany` return
  `Promise<unknown>` — no compile-time safety across the whole content domain.
- **Recommendation:** Define a typed `levelup` namespace seam (per-op
  `Callable<Req,Res>`) like the others.

### REPO-8 · `list` means different things across domains (PageBag vs single page)

- **Severity:** P1 · **Location:** `identity/student.ts:21,34` (`PageBag`),
  `autograde/exam.ts:54` (`PageResponse`),
  `testsession-progress/test-session.ts:62` (`PageResponse`),
  `levelup-content/space.ts:47` (`Page`)
- **Issue:** `list()` is an auto-draining iterator in identity but a single-page
  envelope elsewhere; identity also makes `list` and `paginate` identical
  aliases. Same name, incompatible return contracts.
- **Recommendation:** Standardize: `list()` → one page envelope, `paginate()` →
  the `PageBag` walker, everywhere.

### REPO-9 · `getMany` reimplemented inline instead of using the shared `batchGetMany`

- **Severity:** P2 · **Location:** `identity/student.ts:37-41`, `staff.ts:30`,
  `teacher.ts:31` vs helper at `autograde/paginate.ts:87-96` and
  `levelup-content/_kit.ts:120-129`
- **Issue:** `batchGetMany` exists in two places but not in
  `internal/paginate.ts` (used by identity), so identity repos hand-roll the
  empty-short-circuit + `.items` extraction — a third copy.
- **Recommendation:** Add `batchGetMany` to the shared paginate module; route
  all `getMany` through it.

### REPO-10 · Three different transition pre-check wrappers over the same table

- **Severity:** P2 · **Location:** `internal/transitions.ts:17` (`can`),
  `levelup-content/_kit.ts:142-146` (`canTransition`, re-derives the lookup),
  direct `import { canTransition } from "@levelup/domain"` in
  `autograde/exam.ts:18` / `testsession-progress/test-session.ts:18`
- **Issue:** The same "may from→to" check exposed three ways with two names;
  `_kit` reimplements the table walk instead of calling the contract's
  `canTransition`.
- **Recommendation:** Standardize on the single `@levelup/api-contract`
  `canTransition`.

### REPO-11 · Page-walker helper has three names for one concept

- **Severity:** P3 · **Location:** `listOnce` (autograde/analytics/testsession),
  `listPage` (`internal/paginate.ts:28`), `makePaginator`
  (`levelup-content/_kit.ts:93`)
- **Recommendation:** One canonical pair (`listOnce` + `paginate`) when
  consolidating.

### REPO-12 · Public `Repositories` type defeated by an open index signature

- **Severity:** P2 · **Location:** `index.ts:146,149-156`
- **Issue:** `Repositories = (domain intersection) & Record<string, Repo>` with
  `Repo = Record<string,(...args:never[])=>unknown>`; the index signature means
  any key (incl. typos) resolves to the permissive `Repo`, erasing per-repo
  typing.
- **Recommendation:** Drop the `& Record<string, Repo>` tail now that all
  factories exist.

### REPO-13 · Inconsistent public surface — only some domains export repo types; only one `PageBag`/`ApiClient`

- **Severity:** P2 · **Location:** `index.ts:58-138`
  (identity/autograde/analytics/views export repo types) vs no individual
  exports for gamification/testsession/levelup-content; `index.ts:72-73` exports
  `internal`'s `ApiClient`+`PageBag` as canonical though 5 variants exist
- **Recommendation:** Export per-repo types uniformly; export a single shared
  `PageBag`/wire-type set.

### REPO-14 · Leaky positional, transport-detail params on the storage seam

- **Severity:** P3 · **Location:** `views-and-storage-auth/seam.ts:62-65`
- **Issue:** `StorageCapability.upload(uploadUrl, body, contentType)` — 3
  positional args threading a raw signed URL through the repo surface (vs
  param-object style elsewhere). (Compounds TR-2.)
- **Recommendation:** Single param object; hide the signed-URL handoff inside
  the repo.

---

## packages/transport-firebase + transport-http + api-client

### TR-1 · The "byte-identical" `Transport` contract is 3 copies that have already DRIFTED on `storage`

- **Severity:** P1 · **Location:**
  `transport-firebase/src/transport-contract.ts:99-100` vs
  `transport-http/src/seam.ts:53-73` vs `api-client/src/transport.ts:49-71`
- **Issue:** All three re-declare `Transport` and claim "byte-for-byte
  identical," but firebase's carries `storage: StorageTransport` while http's
  seam and api-client's have no storage member. The two impls are **not**
  swappable; the claim is false. The promised canonical home in
  `@levelup/api-contract` does not exist (no transport dir).
- **Recommendation:** Promote one canonical `Transport` into
  `@levelup/api-contract`; all three import it. (Cross-cutting rec.)

### TR-2 · Storage capability orphaned across four mismatched shapes (incl. method-name mismatch)

- **Severity:** P1 · **Location:** `api-client/src/transport.ts:49-71`,
  `api-client/src/types.ts:28-37`, `api-client/src/create-client.ts:86-90`,
  `repositories/src/views-and-storage-auth/storage.ts:43-47`
- **Issue:** api-client never surfaces storage (seam lacks it, `ApiClient`
  mapped type lacks it, `createApiClient` never wires `transport.storage`), yet
  `storageRepo` calls `api.storage.requestUploadUrl(...)` and
  `api.storage.upload(url,body,ct)` — while the firebase impl exposes
  `uploadImage(UploadBytesInput)`, not `upload(url,body,ct)`. Contract
  fragmented across four shapes with a name+signature mismatch.
- **Recommendation:** Define storage once on the canonical Transport; have
  `createApiClient` expose it with matching method names.

### TR-3 · transport-http is a STUB whose failure modes are inconsistent (invoke loud, subscribe silent)

- **Severity:** P1 · **Location:**
  `transport-http/src/invoke/invoke-via-http.ts:39-50`,
  `subscribe/subscribe-via-sse.ts:18-28`, `server-time/server-time.ts:11-17`,
  `create-http-transport.ts:33-57`
- **Issue:** transport-http is entirely unimplemented in v1: `invokeViaHttp`
  returns a rejected Promise, but `subscribeViaSSE` and `httpServerTimeOffset`
  return inert never-firing handles with **no error surfaced**. Swapping to
  `createHttpTransport` makes `invoke` fail loudly while
  `subscribe`/`serverTimeOffset` silently no-op forever — a partly-hidden gap.
- **Recommendation:** Make the stub subscribe/serverTimeOffset paths throw (or
  `cb.error`) like invoke does, so "not implemented" fails loudly on every
  method.

### TR-4 · Dead/misleading config options on the firebase transport

- **Severity:** P2 · **Location:**
  `transport-firebase/src/create-firebase-transport.ts:35-39`
  (`region`/`emulator`), `config/region.ts:35` (`resolveRegion`)
- **Issue:** `FirebaseTransportOptions` declares `region`/`emulator` but
  `createFirebaseTransport` reads neither (only `validatePayloads`);
  `resolveRegion`/`RegionOptions`/`EmulatorConfig` are exported but called
  nowhere.
- **Recommendation:** Remove the unused options (or actually apply them).

### TR-5 · Resource leak — no transport teardown for the auth listener

- **Severity:** P2 · **Location:**
  `transport-firebase/src/create-firebase-transport.ts:49,59-67` +
  `path-context.ts:72-88`
- **Issue:** `createPathContextHolder` attaches `onIdTokenChanged` and exposes
  `dispose()`, but `createFirebaseTransport` never calls it and the returned
  Transport has no teardown — the auth listener leaks for the transport's
  lifetime.
- **Recommendation:** Add `dispose()`/`close()` to the Transport that calls
  `ctxHolder.dispose()`.

### TR-6 · Storage error bypasses the normalization funnel

- **Severity:** P2 · **Location:**
  `transport-firebase/src/storage/storage-transport.ts:51-55`
- **Issue:** `uploadImage` throws a raw `new Error(...)` on non-2xx signed-PUT,
  bypassing the `ApiErrorDetails`/`ApiError` taxonomy every other error path
  feeds; callers get an untyped error with no code/retryable.
- **Recommendation:** Throw a typed `ApiErrorDetails`-shaped error (e.g.
  `NETWORK_ERROR`).

### TR-7 · Silently swallowed realtime error on server-time offset

- **Severity:** P2 · **Location:**
  `transport-firebase/src/server-time/server-time-offset.ts:23-26`
- **Issue:** `onValue` registered with no error callback (unlike
  `subscribe-via-rtdb`); a permission/connection error on
  `/.info/serverTimeOffset` is dropped, leaving the offset silently stale.
- **Recommendation:** Pass an error handler to `onValue`, or document the
  channel cannot error.

### TR-8 · Hidden RN crypto dependency vs the repeated "byte-identical web + RN" claim

- **Severity:** P2 · **Location:** `api-client/src/idempotency.ts:12,25-26`
- **Issue:** Idempotency keys use `uuid` v7 → `crypto.getRandomValues`, absent
  in bare React Native without a polyfill, contradicting the "zero platform
  difference" claims in `index.ts`/`create-client.ts`.
- **Recommendation:** Document the required RN polyfill (or inject a key
  factory) and soften the claim.

### TR-9 · transport-firebase barrel over-exposes internals for test convenience

- **Severity:** P2 · **Location:** `transport-firebase/src/index.ts:45-61`
- **Issue:** Re-exports units explicitly labelled "NOT app consumption"
  (`invokeViaCallable`, `toDeployedCallableId`, `subscribeViaFirestore`,
  `subscribeViaRTDB`, `validatePayload`, `toTransportError`,
  `SUBSCRIPTION_SOURCES`) purely so tests can import them.
- **Recommendation:** Have tests import deep paths; keep the barrel to factory +
  contract types + auth handle.

### TR-10 · Dead WS export (subscribe always uses SSE)

- **Severity:** P3 · **Location:**
  `transport-http/src/subscribe/subscribe-via-ws.ts:17` + `index.ts:14`;
  `create-http-transport.ts:45`
- **Recommendation:** Drop the WS export until selectable, or add a routing
  option.

### TR-11 · Dead `unwrapCallableError` — a "normalize" file that normalizes nothing

- **Severity:** P3 · **Location:**
  `transport-firebase/src/invoke/normalize-callable-error.ts:18-24` +
  `invoke-via-callable.ts:44-46`
- **Issue:** `invokeViaCallable` rethrows the `FunctionsError` unchanged;
  `unwrapCallableError` is unused outside tests.
- **Recommendation:** Use it on the invoke path or remove it.

### TR-12 · Injected clock not threaded into the offline enqueue

- **Severity:** P3 · **Location:** `api-client/src/offline.ts:71` (`Date.now`) +
  `create-client.ts:41` (`opts.now`)
- **Issue:** `create-client` injects `now = opts.now ?? Date.now` for
  testability, but `routeThroughQueue` stamps `enqueuedAt: Date.now()` directly.
- **Recommendation:** Pass the injected `now` into `routeThroughQueue`.

### TR-13 · Unused parameters / signature noise

- **Severity:** P3 · **Location:** `api-client/src/envelope.ts:21-30` (`_def`),
  `idempotency.ts:33-43` (`_name`, `_def`)
- **Recommendation:** Drop unused params so signatures reflect actual inputs.

### TR-14 · `as unknown as ApiClient` defeats structural checking of the client surface

- **Severity:** P3 · **Location:** `api-client/src/create-client.ts:86-90`
- **Issue:** `{ ...namespaces, subscribe, call } as unknown as ApiClient` — the
  runtime namespace surface is never structurally checked against the mapped
  type; a contract module literally named `subscribe`/`call` would silently
  collide.
- **Recommendation:** Type `buildNamespaces`' return against the mapped
  `ApiClient` (or nest namespaces) so the cast is unnecessary. (api-client
  barrel over-exposure — `index.ts:27-63` re-exports `fromZodError`,
  `computeBackoff`, `withRetry`, `routeThroughQueue`, `buildNamespaces` — folds
  in here; restrict to factory + types + `ApiError`/`normalizeError`.)

---

## packages/query

### QRY-1 · Realtime subscriptions write to cache keys no read hook renders

- **Severity:** P1 · **Location:** `realtime/subscription-keys.ts:44-45`
- **Issue:** `studentLevelLive` writes `levelKeys.detail("me")`, but the read
  hook keys level at `levelKeys.detail(self(userId))` → `"self"`
  (`gamification/keys.ts:45`) — live payload never lands. `achievementUnlock`
  writes `achievementKeys.list({})`, read by nothing (reads use `.infinite(...)`
  and `.sub("me","earned")`) — unlock events silently no-op.
- **Recommendation:** Make each subscription target key identical to the exact
  factory call its read hook uses.

### QRY-2 · Inconsistent self-sentinel (`"me"` vs `"self"`) within one domain (root cause of QRY-1)

- **Severity:** P1 · **Location:** `gamification/keys.ts:45`
  (`self(userId)`→`"self"`) vs `:50` (`"me"` hardcoded); subscription map uses
  `"me"` again
- **Recommendation:** One exported `SELF = "me"` constant used for every
  current-user key (keys + subscriptions).

### QRY-3 · Fanout invalidation is strictly redundant; the documented "precise-only" goal is unmet & unenforced

- **Severity:** P2 · **Location:** `invalidation/invalidate.ts:29-40`,
  `invalidation/graph.ts:28-39`
- **Issue:** `invalidateForCallable` always invalidates the coarse `[root]`
  prefix AND the fanout keys, but a `[root]` prefix-match subsumes every fanout
  key under that root — fanout adds zero churn reduction. The
  `MERGE-INVALIDATION-COARSE` intent (graph.ts:9-13) is unmet; the contract test
  only asserts "fanout present," never that the coarse root is omitted.
- **Recommendation:** When a fanout exists for a high-churn root, drop that root
  from `roots` so the precise machinery actually narrows refetch.

### QRY-4 · Optimistic `onMutate` cancels every in-flight query app-wide

- **Severity:** P2 · **Location:** `mutation/define-mutation.ts:65`
- **Issue:** `await qc.cancelQueries()` with no filter aborts all in-flight
  queries across all domains, not just the keys it touches.
- **Recommendation:** Scope cancellation to the keys the recipe patches.

### QRY-5 · Unresolved cross-domain hook-name collisions papered over in the barrel

- **Severity:** P2 · **Location:** `index.ts:218-294`
- **Issue:** `useExamAnalytics` exported from autograde while analytics owns a
  duplicate; leaderboard appears as `useLeaderboard`/`useLeaderboardLive`
  (analytics) plus `useLeaderboardSnapshot`/`useGamificationLeaderboardLive`
  (gamification); `useStudentSummary`/`useDismissInsight`/`useNotificationBadge`
  duplicated. A TODO admits "the typecheck/fix wave dedupes the conceptual
  overlaps."
- **Recommendation:** One owning domain per concept; delete duplicate hooks
  rather than aliasing.

### QRY-6 · Synthetic ids packed into the `detail` id slot risk collision with real entity ids

- **Severity:** P2 · **Location:** `gamification/keys.ts:42,50`,
  `keys/key-factory.ts:26`
- **Issue:** `sub("home","summary")`/`sub("me","earned")` reuse
  `[domain,'detail',id,…]` with non-entity ids; a real entity id
  `"home"`/`"me"`/`"self"` aliases the same slot. `sub`'s `kind` param is
  unconstrained `string`, so read↔fanout typos aren't caught.
- **Recommendation:** Reserve a distinct kind (`composed`/`derived`) for
  synthetic singletons; type `kind` as a per-domain union.

### QRY-7 · Optimistic-recipe shape not validated at the build-time guard

- **Severity:** P2 · **Location:** `mutation/define-mutation.ts:39`
- **Issue:** The guard only checks `spec.optimistic` truthiness vs the
  allowlist; a malformed recipe missing `apply`/`rollback` is accepted and
  throws at runtime in `onMutate`/`onError`.
- **Recommendation:** Assert the recipe exposes `apply` and `rollback` at
  construction.

### QRY-8 · Filter normalization differs across domains

- **Severity:** P3 · **Location:** `autograde/keys.ts:35,43,56` vs
  `gamification/keys.ts:31-35`, `testsession-progress/keys.ts:25-29`
- **Issue:** gamification/testsession strip `undefined` into a stable params
  object; autograde passes raw filters relying on `JSON.stringify` dropping
  `undefined` — any non-JSON value (Date, instance) gives unstable keys in
  autograde only.
- **Recommendation:** One shared `stableParams()` normalizer in the key factory.

### QRY-9 · `MutationSpec` accepts both `callable` and `name` for the same field

- **Severity:** P3 · **Location:** `mutation/types.ts:43-46`,
  `mutation/define-mutation.ts:21-25`
- **Recommendation:** Keep one (`callable`); remove/deprecate the alias.

### QRY-10 · Named convenience factories are a hand-maintained parallel list to the generated registry

- **Severity:** P3 · **Location:** `keys/registry.ts:32-84`
- **Issue:** `QUERY_KEYS` is generated from `DOMAIN_NAMES` (total) but the ~50
  named exports (`spaceKeys`, `examKeys`…) are hand-listed; a new `DomainName`
  silently gets no named export.
- **Recommendation:** Generate the named factories from `DOMAIN_NAMES`, or drop
  them for `keysFor(domain)`.

### QRY-11 · `onSettled` fires invalidation as fire-and-forget `void`

- **Severity:** P3 · **Location:** `mutation/define-mutation.ts:79`
- **Issue:** `void invalidateForCallable(...)` not awaited; rejections
  swallowed, mutation reports settled before refetch begins.
- **Recommendation:** Return the promise from `onSettled` so failures surface
  and `isPending` covers refetch.

### QRY-12 · Single global cache policy with no per-hook tuning

- **Severity:** P3 · **Location:** `provider/createQueryClient.ts:21-22`
- **Issue:** Defaults (30s stale / 5min gc) are sane and editor items correctly
  override to 0/0 (`levelup-content/queries.ts:137-138`), but near-static reads
  (`tenants`, achievement catalog) use the same 30s as volatile data → needless
  refetch.
- **Recommendation:** Allow per-hook `staleTime`/`gcTime` overrides for clearly
  static vs volatile domains.

### QRY-13 · `useSubscription` default writer overwrites cache wholesale

- **Severity:** P3 · **Location:** `realtime/useSubscription.ts:41`
- **Issue:** Default `qc.setQueryData(key, payload)` replaces whatever the REST
  read populated; for list/`infinite` keys a single streamed payload clobbers
  the page structure unless every caller supplies `onPayload`.
- **Recommendation:** Merge into the existing cache value, or restrict the
  default writer to `detail` keys.

> **Solid (preserve):** the key factory (root = `DomainName`, tenant implicit,
> finite `list/infinite/detail/sub` hierarchy enabling prefix-invalidation,
> branded IDs stringified at the boundary, answer-bearing editor keys isolated
> under `items:edit` and excluded from every factory); invalidation graph
> derived from contract `invalidates` hints + guarded totality test; the closed
> optimistic allowlist enforced at build time + drift tests.

---

## packages/services

(SVC-1 — the P0 — listed above.)

### SVC-2 · `tx` parameter is a lie across authority repos (non-atomic writes presented as transactional)

- **Severity:** P1 · **Location:**
  `repo-admin/extended.ts:139,321,370,401,548,558`; consumers
  `test-session.ts:131,224`
- **Issue:** `enroll`, `testSubmissions.put`, `awardAchievement`,
  `applyLevelDelta`, `impersonation.openSession/endSession` take `tx: TxHandle`
  but `void tx` it and do a direct non-transactional write swallowed by
  `.catch(() => undefined)`. Callers wrap them in `ctx.repos.tx(async tx => …)`
  believing writes are atomic; they are neither — the documented "write-through
  crash-resume" and submit single-writer guarantees don't hold.
- **Recommendation:** Either route subcollection writes through a real
  `Transaction` ref, or drop the fake `tx` param + `.catch` and make them
  honestly async non-tx.

### SVC-3 · `writeInTx` impersonation audit ignores its tx and tenant, fails open

- **Severity:** P1 · **Location:** `repo-admin/index.ts:142-150`
- **Issue:** The "fail-closed" `writeInTx` ignores `_tx`, does fire-and-forget
  `void auditRepo.write("__platform__", …)` (swallowed promise, hardcoded
  tenant) — non-atomic, silently drops failures, can never write to the
  impersonated tenant. The opposite of fail-closed.
- **Recommendation:** Stage the audit row inside the passed transaction and
  await/propagate failure.

### SVC-4 · A "list" read drains and mutates the outbox (single-responsibility abuse + races the worker)

- **Severity:** P1 · **Location:** `autograde/reads.ts:340-356`
- **Issue:** `listDeadLetterService` calls `ctx.repos.outbox.drain(tenantId)` —
  which marks every pending row `delivered` (`authority.ts:168-178`) — then
  re-enqueues them as new docs. A read endpoint flips delivery state of the
  whole outbox, races the real drain worker, and duplicates rows on every call.
- **Recommendation:** Give the DLQ a read-only query repo (`where status==…`)
  instead of overloading `outbox.drain`.

### SVC-5 · Copy-paste across entity/item/tenant repos (divergent pagination)

- **Severity:** P2 · **Location:** `repo-admin/entity-repo.ts:79-118`,
  `item-repo.ts:81-117`, `tenant-repo.ts:82-99`
- **Issue:** `getMany` (chunk-of-10), `upsert` (id-or-generate + created flag +
  merge), `list` (where-loop + over-fetch-by-1 + cursor encode) re-implemented
  3× with divergence (item-repo paginates in-memory on `id`; tenant-repo only
  `orderBy(documentId())`).
- **Recommendation:** Extract shared
  `paginateQuery`/`upsertDoc`/`getManyChunked` helpers; compose with a path
  resolver.

### SVC-6 · `extended.ts` hardcodes ~15 paths outside `paths.ts` (centralization invariant broken)

- **Severity:** P2 · **Location:**
  `repo-admin/extended.ts:170,184-186,233-235,266,288,315,347,356,431,473,499,538`;
  `index.ts:99-129`
- **Issue:** `paths.ts` is documented as "the ONLY place collection paths live,"
  yet the entire extended authority + AI surface builds inline template strings
  (`${tenantDoc(t)}/notifications`, `/students/${uid}`, `/leaderboard`,
  `/digitalTestSessions/${sid}/submissions`, `/llmCallLogs`,
  `/costSummaries/daily_…`). Centralization only holds for content + top-level
  collections.
- **Recommendation:** Move every subcollection path builder into `paths.ts`.

### SVC-7 · `v2_` prefix not centralized — rate-limit/id-gen paths bypass `topLevel()`

- **Severity:** P3 · **Location:** `repo-admin/authority.ts:190`
  (`_rateLimits/${id}`), `item-repo.ts:62` (`_ids`)
- **Issue:** `_rateLimits` is a hardcoded top-level collection not flowing
  through `collectionPrefix()`/`topLevel()`, so under
  `LVLUP_COLLECTION_PREFIX=v2_` rate-limit counters are shared/unprefixed across
  deployments.
- **Recommendation:** Route `_rateLimits` (and `_ids`) through `topLevel()` in
  `paths.ts`.

### SVC-8 · Inconsistent `(uid,tenantId)` vs `(tenantId,uid)` param ordering (transposition compiles)

- **Severity:** P2 · **Location:** `repo-admin/extended.ts:88,172,290`
  (uid-first) vs `:188,358,431,473` (tenant-first)
- **Issue:** Same two `string` params ordered differently across repos; a
  transposition compiles cleanly and writes to the wrong doc.
  `DeviceRepo.register(uid,tenantId,token,platform,appKey,now)` = 6 positional
  strings.
- **Recommendation:** Standardize on `(tenantId, uid, …)`; convert 4+ param
  methods to a param object.

### SVC-9 · `createdBy` clobbered on every story-point/item update

- **Severity:** P2 · **Location:** `levelup/content.ts:390-391,423-424` vs
  `:367`
- **Issue:** `saveStoryPointService`/`saveItemService` set `createdBy: ctx.uid`
  unconditionally before merge-upsert (overwrites original author);
  `saveSpaceService` correctly preserves via
  `existing?.["createdBy"] ?? ctx.uid`. Three sibling writers inconsistent.
- **Recommendation:** Load existing and preserve `createdBy` (or omit on update)
  in the story-point/item writers.

### SVC-10 · `_kind`-discriminated overloaded collections (filtering pushed to app code, breaks paging)

- **Severity:** P2 · **Location:** `autograde/reads.ts:38-39,91,348,319`;
  `tenant-repo.ts:39-44,67-70`
- **Issue:** Exams, exam-questions, evaluation-settings, dead-letters,
  `analytics_{id}` all share one `exams` collection filtered in-memory by
  `_kind`/id-prefix on every read; tenant repo multiplexes a `_generic` store.
  Filtered-out rows consume page budget; schema obscured. (Dedicated
  `evaluationSettings`/`examAnalytics` entities already exist in
  `extended-repos.ts:226-231`.)
- **Recommendation:** Split `examQuestions`/`evaluationSettings`/`examAnalytics`
  into their own collections.

### SVC-11 · `content.ts` god-file mixes CRUD, auth, and a migration engine

- **Severity:** P2 · **Location:** `levelup/content.ts:36-269` within a 656-LOC
  file
- **Issue:** ~230 lines of legacy-vocabulary migration (`QUESTION_TYPE_MAP`,
  `MATERIAL_TYPE_MAP`, `buildQuestionData/MaterialData`, `normalizeItemPayload`,
  `projectItem/Space/StoryPoint`) interleaved with 6 write + 6 read services —
  authorization and one-off seed-drift coercion in one module.
- **Recommendation:** Extract projection/normalization into
  `shared/projections.ts` (or `content-projection.ts`); leave `content.ts` thin
  auth+CRUD.

### SVC-12 · `submitTestSession` splits session state + outbox across separate transactions

- **Severity:** P2 · **Location:** `levelup/test-session.ts:187-271`
- **Issue:** Runs 4+ independent `ctx.repos.tx(...)` calls plus a non-tx
  `testSessions.upsert` (`:257`) and a separate outbox-enqueue tx (`:261`).
  Session finalize and the `test.session.graded` outbox row are not in one
  transaction, violating the "write state + outbox atomically" principle
  (`side-effects.ts:1-5`); a crash between them yields a finalized session with
  no notification.
- **Recommendation:** Finalize the session doc and enqueue the outbox row inside
  a single tx body. (Compounds SVC-1.)

### SVC-13 · `xrepos` blind cast over a 25-member god interface (re-exported publicly)

- **Severity:** P2 · **Location:** `shared/extended-repos.ts:200-241`, exported
  at `index.ts:31-49`
- **Issue:** `ExtendedRepos` is a 25-member superset; `xrepos(ctx)` does
  `ctx.repos as unknown as ExtendedRepos`, so any repo `createRepos` forgets is
  a runtime `undefined`-crash, not a compile error — and the unsafe helper is on
  the public surface.
- **Recommendation:** Have `createRepos` return a value typed as `ExtendedRepos`
  (compiler proves completeness); drop `xrepos`/the cast or keep it
  internal-only.

### SVC-14 · Inconsistent injected-clock threading (per-method optional `ts` vs captured `now`)

- **Severity:** P3 · **Location:** `repo-admin/extended.ts:106,123` (take
  `ts = now()`) vs `:53,177,245` (call `now()` directly)
- **Recommendation:** Always thread the caller's `ctx.now()`; drop the per-repo
  captured `now`.

---

## packages/realtime + offline + access + ai + functions-shared

### MISC-1 · `@levelup/realtime` runtime is dead — its dedupe layer is off the live path

- **Severity:** P1 · **Location:** `query/src/realtime/useSubscription.ts:24-52`
  and `query/src/levelup-content/subscriptions.ts:40-46` vs
  `realtime/src/use-subscription.ts` + `subscription-manager.ts`
- **Issue:** Apps/query never import `@levelup/realtime`'s runtime (only
  doc-comment references exist); query ships its own `useSubscription` calling
  `transport.subscribe` directly with **no** `SubscriptionManager` and its own
  `useServerTime`. The refcount/dedupe/warm-replay manager
  (`subscription-manager.ts:58-132`) and `server-time-store.ts` are not on the
  real path.
- **Recommendation:** Route query's hooks through the manager, or delete the
  unused realtime React layer and keep only the seam types.

### MISC-2 · `@levelup/offline` package is dead and duplicated by a divergent copy in api-client

- **Severity:** P1 · **Location:** `offline/src/offline-queue.ts:28-72` +
  `noop-offline-queue.ts:17` vs `api-client/src/offline.ts:23-41`
- **Issue:** api-client defines/uses its own
  `OfflineQueue`/`QueuedCall`/`NoopOfflineQueue` (numeric `enqueuedAt`,
  `deliver` thunk, status `"flushing"`) structurally diverging from
  `@levelup/offline`'s (ISO `enqueuedAt`, `execute` param, status `"syncing"`);
  the standalone package is referenced only in lint-boundaries tests.
- **Recommendation:** Delete `@levelup/offline` or make api-client consume it;
  pick one `QueuedCall` shape.

### MISC-3 · `functions-shared` AI gateway port structurally diverges from the real `@levelup/ai` gateway

- **Severity:** P1 · **Location:**
  `functions-shared/src/context/ports.ts:155-192` vs `ai/src/gateway.ts:69-82`
- **Issue:** The injected `AiGateway`/`AiResponse`/`TokenUsage`/`CostBreakdown`
  ports use `{promptTokens,completionTokens}`,
  `cost:{inputCost,outputCost,totalCost,currency}`, and an `AiResponse` with
  **no `text`** — but the actual gateway returns `{inputTokens,outputTokens}`,
  `cost:{inputCostUsd,…,model}`, and `text`. The real gateway does not satisfy
  this port; `ctx.ai.generate(...)` is typed against a fiction.
- **Recommendation:** Replace the local port with
  `import type { AiGateway } from "@levelup/ai"` (the reconciliation the file's
  own comment promises).

### MISC-4 · `dedupe.ts` double-cast contradicts the `IdempotencyRepo` port

- **Severity:** P1 · **Location:**
  `functions-shared/src/idempotency/dedupe.ts:25-29,41,57,65` vs
  `context/ports.ts:39-62`
- **Issue:** The port declares 4-arg
  `begin(tenantId,uid,name,key) → {cached,inFlight}`, but dedupe casts
  `ctx.repos.idempotency as unknown as AdminIdempotencyRepo` and calls a 3-arg
  `begin(...) → {status,result}`. The contracts are mutually incompatible; the
  typed port is dead and the cast hides it.
- **Recommendation:** Make `IdempotencyRepo` in `ports.ts` match the real
  `status`-based 3-arg repo; drop the cast.

### MISC-5 · `@levelup/ai` public surface over-exposes the entire internal machinery

- **Severity:** P2 · **Location:** `ai/src/index.ts:30-102` (gateway claim at
  `gateway.ts:11`: "nothing below it is exported to clients")
- **Issue:** index re-exports providers, secret resolver, cost tables, quota,
  `withRetry`, circuit breaker, moderation internals, repos-seam — though
  intended consumption is `createAiGateway` + errors. Broad surface invites
  services to bypass the gateway.
- **Recommendation:** Export only `createAiGateway`/types/errors (+
  `createStubProvider` for tests); keep the rest internal.

### MISC-6 · `fallback-handler.ts` contains a circuit breaker and no fallback (misnamed seam)

- **Severity:** P2 · **Location:** `ai/src/reliability/fallback-handler.ts`
  (whole file)
- **Issue:** File name implies provider fallback but only implements
  `createCircuitBreaker`/`classifyError`; no alternate-provider fallback exists
  anywhere.
- **Recommendation:** Rename to `circuit-breaker.ts` (or add the actual
  fallback).

### MISC-7 · Two near-identical, casing-only-distinct `Log…CallParams` types both exported

- **Severity:** P2 · **Location:** `ai/src/cost/llm-logger.ts:12`
  (`LogLLMCallParams`) vs `ai/src/repos-seam.ts:31` (`LogLlmCallParams`), both
  via `index.ts:57,102`
- **Issue:** Logger DTO (branded ids, `usage`/`cost` objects) and wire DTO (flat
  `inputTokens`/`costUSD`) differ only by `LLM`↔`Llm` casing — a real footgun.
- **Recommendation:** Rename one (e.g. `LlmLogInput` for the wire shape); don't
  export the internal logger param type.

### MISC-8 · Moderation-blocked input reported as `FEATURE_DISABLED`

- **Severity:** P2 · **Location:** `ai/src/gateway.ts:125` (`aiDisabled` →
  `FEATURE_DISABLED`, `errors.ts:44`)
- **Issue:** A prompt blocked by moderation throws `FEATURE_DISABLED`,
  conflating "AI turned off for tenant" with "this input rejected" — callers
  can't distinguish.
- **Recommendation:** Use a dedicated code (e.g.
  `VALIDATION_ERROR`/`CONTENT_BLOCKED`).

### MISC-9 · `authorize()` throws `PERMISSION_DENIED` for unauthenticated callers; `UNAUTHENTICATED` helper is dead

- **Severity:** P2 · **Location:** `access/src/policy.ts:253` vs `errors.ts:40`
- **Issue:** Missing `ctx.uid` yields `denied(...)` (`PERMISSION_DENIED`)
  instead of `UNAUTHENTICATED`; unauthenticated is indistinguishable from
  forbidden, and `unauthenticated()` is unused.
- **Recommendation:** Throw `unauthenticated(...)` at the step-4 auth gate.

### MISC-10 · Ownership gate is a silent no-op for `self`/`space-enrolled` when the resource omits the owner

- **Severity:** P2 · **Location:** `access/src/policy.ts:199-215`
- **Issue:** `case "self"` returns `true` when `resource.ownerUid` absent;
  `case "space-enrolled"` always returns `true`. For self-scoped actions
  (`testSession.submit`, `answer.evaluate`, `chat.send`) the gate enforces
  nothing unless every call site passes `ownerUid` — the table advertises
  ownership it may not check.
- **Recommendation:** Require the owner field for `self` actions (fail-closed);
  resolve `space-enrolled` against repos.

### MISC-11 · The realtime `Transport`/`SubscriptionHandle`/`SubscriptionCallbacks` seam restated in 3+ packages (drifting)

- **Severity:** P2 · **Location:** `realtime/src/seam.ts:14-53`,
  `transport-http/src/seam.ts`, `query/src/provider/types.ts:9-47` (canonical
  claimed to live in `@levelup/api-contract`)
- **Issue:** Each package hand-copies the subscribe/serverTimeOffset half "until
  promotion to the api-contract barrel"; realtime's 4-state `SubscriptionStatus`
  vs query's 3-state already show drift.
- **Recommendation:** Promote the canonical seam into `@levelup/api-contract`;
  all consumers import it. (Cross-cutting rec.)

### MISC-12 · Exponential-backoff retry implemented twice with the same shape

- **Severity:** P2 · **Location:** `ai/src/reliability/retry.ts:22-42` vs
  `api-client/src/retry.ts:114-152`
- **Issue:** Both implement bounded jittered exponential backoff (`base*2^n`,
  cap, injected sleep/rng) named `withRetry`; jitter/cap semantics already
  differ slightly.
- **Recommendation:** Extract one shared backoff primitive; layer the def-aware
  decision on top in api-client.

### MISC-13 · `renderPrompt` returns a `template` the gateway discards and re-looks-up

- **Severity:** P3 · **Location:** `ai/src/gateway.ts:113,147` vs
  `prompts/registry.ts:127-143`
- **Issue:** `renderPrompt` returns `{system,user,template}`, but the gateway
  ignores the returned `template` and re-does `PROMPTS[req.promptKey]` at line
  113 — double lookup, unused return field.
- **Recommendation:** Consume the returned `template` (or drop it).

### MISC-14 · Inconsistent tenant-key defaults across otherwise-parallel adapters

- **Severity:** P3 · **Location:**
  `functions-shared/src/adapters/on-document.ts:43` (default `"t"`) vs
  `adapters/on-task.ts:37` (default `"tenantId"`)
- **Issue:** The four adapters are deliberately uniform, but the
  tenant-extraction default key silently differs — an easy source of null-tenant
  `SystemContext` bugs.
- **Recommendation:** Centralize the default key constants so divergence is
  intentional and visible.

### MISC-15 · Dead no-op spread in the Cloud Tasks enqueue

- **Severity:** P3 · **Location:**
  `functions-shared/src/outbox/cloud-tasks.ts:42-44`
- **Issue:** `...(REGION ? {} : {})` spreads an empty object in both branches —
  noise that reads like region handling but does nothing.
- **Recommendation:** Delete the line.

### MISC-16 · `secretNameFor` defined twice across the two server packages

- **Severity:** P3 · **Location:** `functions-shared/src/config/config.ts:29`
  and `ai/src/secrets/secret-manager.ts:15` (comment admits it "mirrors
  functions-shared config.ts")
- **Issue:** The per-tenant Gemini secret-name pattern — a security-relevant key
  path — lives in two packages that can drift.
- **Recommendation:** Export it from one package (likely `@levelup/ai`) and
  import in the other.

> **Solid (preserve):** the access policy table (`policy.ts:54-141`), moderation
> regex filter, outbox/audit helpers, and the four adapter shells are clean,
> consistent, table-driven abstractions.

---

## Prioritized improvement list (highest leverage first)

1. **Fix SVC-1 (P0) now** —
   `FLAT_COLLECTION.testSessions → "digitalTestSessions"` + a tx/repo
   collection-map parity test. Live data correctness.
2. **Run the deferred "cross-domain dedupe wave"** (CON-2/4/5, REPO-5/6, QRY-5)
   — resolve duplicate callables, repos colliding on bag keys, hook aliases, and
   synonym `DomainName` roots. These are the worktree-merge integration debt and
   cause _silent_ staleness/shadowing.
3. **Promote one canonical `Transport` + wire-type + subscribe-seam into
   `@levelup/api-contract`** (TR-1/2, REPO-4, MISC-3/11) and delete the 3–5
   hand-copied/drifted seams. Single biggest structural lever.
4. **Make the "fake tx" honest** (SVC-2/3/12) — either real transactions or no
   `tx` param; stop swallowing write failures with `.catch(()=>undefined)`.
   Authority-layer durability.
5. **Stop the read-side mutation** (SVC-4) — DLQ list must not drain/re-enqueue
   the outbox.
6. **Consolidate the 4× paginate / 3× repo-admin CRUD copy-paste**
   (REPO-1/2/3/9/11, SVC-5) into shared kits; standardize `list()` vs
   `paginate()` semantics (REPO-8).
7. **Fix the realtime key mismatches** (QRY-1/2) — one `SELF` sentinel;
   subscription target keys identical to read-hook keys. Live updates currently
   no-op.
8. **Remove the type-system escape hatches** (SVC-13 `xrepos`, MISC-4 dedupe
   cast, REPO-7/12 unknown/open-index, TR-14 client cast) so the compiler proves
   the seams.
9. **Tighten error taxonomy** (MISC-8/9, TR-6) — distinct codes for
   moderation-block, unauthenticated, and storage failure; route all through the
   normalization funnel.
10. **Delete dead packages/exports** (MISC-1 realtime runtime, MISC-2 offline,
    TR-4/10/11 dead config/WS/normalize) — reduce surface and confusion.
11. **Centralize remaining paths + `v2_` prefix** (SVC-6/7) so `paths.ts` is
    genuinely the only path source.
12. **Narrow public surfaces** (CON-1 under-export callables; TR-9, MISC-5,
    TR-14, REPO-13 over-export internals) — each `index.ts` should be minimal
    and intentional.

---

_End of R3 Module LLD audit. 84 findings (1 P0 / 22 P1 / 39 P2 / 22 P3). All
file:line evidence cited inline; SVC-1 (P0) independently verified this
session._
