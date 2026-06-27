# Testability Review — Auto-LevelUp SDK + Server Rebuild (FROZEN-CANDIDATE)

**Perspective:** Testability — can every layer be tested? Contract tests
(per-callable req/res against emulator), the no-tenantId assertion, the
RN-purity bundle check, the optimistic-on-authority lint, the
ALLOWED_TRANSITIONS build-time assertion, services testable via injected
clock/ctx, deterministic + idempotent seed engine, repos testable with a fake
transport, a clear unit/contract/integration split, and coverage of
triggers/schedulers/Cloud Tasks reducers.

**Overall:** The pure layers (`domain`, `api-contract`, `api-client`, `query`)
have genuinely strong, mechanized test plans — the no-tenantId test, registry
integrity, transitions⊆enums, optimistic allow-list, and RN-purity gates are
concrete and durable. The testability story collapses at exactly the two layers
that carry the most authority risk and the most untested live code: **the
per-callable emulator contract test is a one-liner with no fixture mechanism**,
**the seed engine has no spec at all despite being the integration-test
substrate**, **the repositories layer has no test plan or fake-transport seam**,
and **triggers/schedulers/Cloud Tasks reducers have no idempotency/replay test
coverage** even though "single-writer + idempotent + outbox" is a non-negotiable
principle. Findings below, ordered by severity.

---

## T1 — Per-callable emulator contract test has no fixture/representative-request mechanism

- **Severity:** BLOCKER
- **Where:** `platform-infra.md` §9.3 + `common-api.md` §8 (the "durable backend
  gate"); referenced by `SDK-LAYERS-PLAN.md` §7 step 5 and `server-shared.md` §8
  test #6. No layer plan owns it.
- **Problem:** The headline backend gate is specified as a single sentence: "For
  every callable in `api-contract`'s registry: validate a representative request
  and the live response shape against the Zod schema, run under the emulator."
  For ~114 callables (≈90 base + ~24 from C1–C31) this is unimplementable as
  written. There is **no mechanism named for producing the "representative
  request"** per callable, and — critically — **no plan for the
  seed/preconditions each callable needs to return a non-error response**.
  `getSubmission`, `gradeQuestion`, `releaseResults`, `getStoryPointProgress`,
  `getChildSummary` etc. all require specific tenant/role/entity state to exist
  before they will return anything other than `NOT_FOUND`/`PERMISSION_DENIED`.
  Without a fixture+seed contract, the "contract test" degrades to either (a)
  only validating that a request schema accepts a hand-typed sample (no emulator
  round-trip, no response validation), or (b) ~114 bespoke hand-written setups —
  exactly the "island integration suite" the plan says it is killing. The
  req/res-against-emulator gate is the single most-cited testability promise
  across all four source docs and it is the least specified.
- **Resolution:** Add a dedicated `contract-tests` layer/section that specifies:
  (1) a per-callable `fixtures` field (or a sibling `*.fixture.ts` co-located
  with each `*Def`) carrying a valid request sample + the named seed-state
  precondition it depends on; make `registry-integrity.test.ts` fail if any
  callable lacks a fixture. (2) A single seeded "contract tenant" (deterministic
  ids — see T2) that every read/mutation contract test runs against, with a
  documented ordering so writes that create preconditions run before reads. (3)
  Drive the loop from `CALLABLE_NAMES` so adding a callable without a fixture
  fails CI. (4) State explicitly that response validation uses
  `def.responseSchema.parse(liveResponse)` on the emulator output, not just
  request validation.

## T2 — `@levelup/seed` has no plan; determinism + idempotency for integration tests is asserted, never specified

- **Severity:** BLOCKER
- **Where:** `SDK-LAYERS-PLAN.md` §1.1 lists `packages/seed`; §1.2 gives a
  one-line responsibility; `platform-infra.md` §9.5 + §6 "RN-ready foundations"
  assert "Idempotent, one code path env-switched" and "per-suite idempotent
  seeded tenants." There is **no `sdk-plan/layers/seed.md` and no
  `sdk-plan/domains/seed.md`** (confirmed: no seed file in either directory).
- **Problem:** The seed engine is the substrate for the entire integration +
  e2e + contract pyramid (T1 depends on it), yet it is the only package in §1.1
  with no detailed plan. "Idempotent" and "deterministic" are claimed but never
  specified: there is no statement of (a) how entity ids are derived
  deterministically (random vs config-keyed — random ids break re-runnability
  and cross-role consistency checks), (b) what "idempotent" means on re-seed
  (upsert-by-stable-id vs wipe-and-recreate vs skip-if-exists), (c) how
  `ensureAuthUser` + custom-claims seeding stays consistent with the _runtime_
  `syncMembershipClaims` (two claim-builders is exactly the D-class drift the
  rebuild exists to kill — the seed must build claims through the **same**
  `@levelup/access`/membership code, not a copy), (d) how seed time is pinned (a
  fixed clock so `serverDeadline`, `*At`, streak windows are reproducible across
  runs). Without this, "re-enable parallelism via per-suite idempotent seeded
  tenants" (§9.4) and per-callable contract fixtures (T1) have no foundation.
- **Resolution:** Author `sdk-plan/layers/seed.md` specifying: config-keyed
  deterministic ids (`seedId(kind, key)` → stable branded id, no randomness);
  idempotency = upsert-by-stable-id with a documented re-run = no-op invariant +
  a `seed.idempotency.test.ts` that seeds twice and asserts identical doc set;
  claims built via the shared membership→claims path (assert seed claims ===
  `syncMembershipClaims` output for the same membership); an injected fixed
  clock; an emulator-vs-prod env switch that shares one write path; and a
  `seed.determinism.test.ts` snapshotting the produced Firestore tree.

## T3 — `@levelup/repositories` has no layer plan and no fake-transport / fake-api-client test seam

- **Severity:** MAJOR
- **Where:** `SDK-LAYERS-PLAN.md` §4.1 (37 per-entity + 12 view repos), §2.4 of
  `SDK-SERVER-DESIGN.md`. No `sdk-plan/layers/repositories*.md` exists
  (confirmed). Build-order §7 step 6 names the package but no test section.
- **Problem:** Repositories are explicitly "THE CLIENT BRAIN" — shaping, N+1
  collapse, opaque cursor management, `getMany` chunking
  (`where('id','in', chunks of 10)`), derived fields (`canPublish`,
  `remainingMs`, `completionPct`), and the cross-entity view composition
  (`spaceDetailViewRepo`, `gradingReviewRepo`, `parentRepo` child-collapse).
  This is the highest-logic-density client code and it has **zero** named tests
  and **no stated test seam**. `api-client` tests run against a _mocked
  transport_ (`api-client-core.md` §6 line 372), but nothing says repos get a
  _fake `ApiClient`_ (or a fake transport feeding a real client) so their
  shaping/batching/cursor logic can be unit-tested without an emulator. The
  N+1-collapse chunking (10-id `in` batches) and cursor pagination are precisely
  the logic most likely to have off-by-one / chunk-boundary bugs and there is no
  plan to test them.
- **Resolution:** Author `sdk-plan/layers/repositories.md` with a
  `createRepositories(api)` test seam that accepts a hand-stubbed `ApiClient`
  (or `createApiClient(fakeTransport)` reusing the existing api-client test
  fake), and a test matrix: `getMany` chunking at boundaries (0/1/10/11/21 ids),
  `paginate()` cursor threading + `nextCursor:null` termination, each view
  repo's shaping against a fixed wire fixture, and each derived field. Add
  `isSensitiveKey`/editor-item cache-scope assertions for `getItemForEdit` so
  answer-bearing items provably never land in a shared/persisted cache.

## T4 — Triggers, schedulers, and Cloud Tasks reducers have no idempotency/replay/single-writer test coverage

- **Severity:** MAJOR
- **Where:** `SDK-LAYERS-PLAN.md` §5.3 "Async invariants" (single-writer,
  idempotent, outbox, Cloud Tasks); `server-shared.md` §8 contract tests #6–#15.
  The 15 server tests cover **callables/services** only — none exercises
  `makeTrigger`/`makeScheduler`/`makeTaskHandler` paths.
- **Problem:** The principle "async = single-writer + idempotent + outbox +
  Cloud Tasks, triggers/ schedulers thin over services" is non-negotiable, and
  the plan has ~30+ triggers, ~12 schedulers, and the headline reducers
  (`advancePipeline` on `(submissionId,step)`, `progressUpdater`,
  `recomputeOrchestrator` — the single `RecomputeMarker` consumer,
  `emitNotificationService` single badge writer dedupe on
  `(tenantId,recipientUid,entityType,entityId,type)`, `onSubmissionGraded` on
  `(sessionId,itemId,evaluationId)`). The exact failure modes these guard —
  **double-fire**, **out-of-order delivery**, **at-least-once redelivery**,
  **concurrent writers racing the same derived value** — have **no test** named
  anywhere. server-shared §8 #10 tests _callable_ idempotency, and #14 tests
  outbox rollback for a _service_, but the trigger/scheduler/task **shells and
  their reducers** (where the single-writer guarantees actually live) are
  untested. autograde.md §4 even leaves "Tasks in prod, triggers in emulator
  behind the seam" as an open question — meaning the prod path may not be the
  path under test.
- **Resolution:** Add a `triggers-async.contract.test.ts` (emulator) section to
  `server-shared.md` §8: for each reducer, (a) deliver the same event twice →
  exactly one effect (idempotency); (b) deliver out of order → final state
  correct (status-guarded); (c) two concurrent invocations → single-writer wins,
  no lost update; (d) outbox row appears iff the state write commits. Require
  the **same** reducer path run in the emulator that runs in prod (resolve the
  autograde Tasks-vs-trigger open question so the tested path is the deployed
  path).

## T5 — `authorize()` coverage test asserts existence, not per-callable correctness; SystemContext authority is untested

- **Severity:** MAJOR
- **Where:** `server-shared.md` §8 test #8 ("`ACCESS_RULES` has an entry for
  every `Action`; every ⚷ callable calls `authorize` before any write"); §8 #15
  (`buildAuthContext`); §9 note "SystemContext authority … confirm no trigger
  ever operates cross-tenant."
- **Problem:** Two authority gaps. (1) Test #8 proves an action _has a rule_ and
  that `authorize` is _called_, but not that the rule is **correct** — e.g. that
  a parent calling `getChildSummary` for a student **not** in `ctx.studentIds`
  is denied, that a scanner can only `uploadAnswerSheets` for its own tenant,
  that `progress.readOther` actually gates C17/C16/C18 to
  `studentId ∈ ctx.studentIds`. These cross-row policy decisions (the §6.7
  guidance-leak gate, §6.11 link integrity, parent gating) are where access bugs
  cause real leaks, and only "rule exists + is invoked" is tested. (2)
  `SystemContext` (used by every trigger/scheduler/task) grants
  "isSuperAdmin-equivalent authority scoped to the triggering tenant" but
  **bypasses rate-limit/quota**; the _negative_ test — a system actor must NOT
  operate cross-tenant except audited platform rollups — is left as a §9 prose
  "confirm," not a test. A trigger that reads/writes the wrong tenant is a
  silent cross-tenant breach.
- **Resolution:** Add a per-rule policy table-test driven from `ACCESS_RULES`:
  for each ⚷ action, a positive (authorized ctx allowed) and negative (each
  disqualifying ctx denied with `PERMISSION_DENIED`) emulator case, with
  explicit parent-gating and guidance-leak rows. Add a `system-context.test.ts`
  asserting `SystemContext` cannot touch a tenant other than the event's tenant
  (and that platform rollups are the only audited exception).

## T6 — "Service testable via injected clock/ctx with in-memory fakes" is asserted but the fake `Repos`/`AiGateway` are never specified

- **Severity:** MAJOR
- **Where:** `SDK-SERVER-DESIGN.md` §3.2 (`now: () => Timestamp` injected
  clock), `server-shared.md` §2.2 (`ctx.repos`, `ctx.ai` injected),
  `platform-infra.md` §9.1 ("unit-test business services against in-memory fakes
  — eliminate the 30+ hand-rolled `firebase-admin` mocks").
- **Problem:** The architecture is correctly shaped for unit-testing services as
  `fn(input, ctx)` with injected `now/repos/ai` — but no plan delivers the fakes
  that make this real. There is **no `InMemoryRepos` / fake `AiGateway` spec**,
  no statement of which package owns them, and no conformance guarantee that the
  in-memory `Repos` fake stays behavior-compatible with the real
  `@levelup/repository-admin` (transactions, `getMany` chunking, brand
  strip-on-write, cursor encode/decode, the `tx()` atomic state+outbox write).
  Without a shared, conformance-tested fake, teams will hand-roll per-test fakes
  — re-creating the exact "30+ hand-rolled mocks" problem §9.1 promises to
  eliminate, and unit tests will pass against fakes that don't match emulator
  reality (notably `tx()` atomicity and cursor semantics, which a naive
  in-memory fake gets wrong).
- **Resolution:** Specify an `@levelup/repository-admin` (or a `testing`
  subpath) `createInMemoryRepos()`
  - `createFakeAiGateway()` with a deterministic provider, and a **conformance
    suite** run against _both_ the in-memory fake and the emulator-backed real
    repos (same test file, two drivers) so the fake can never silently diverge.
    Name the injected fixed clock helper (`fixedClock(iso)`). Make this the
    single sanctioned service-unit-test harness.

## T7 — The unit / contract / integration split has two conflicting package inventories and CI gate lists

- **Severity:** MAJOR
- **Where:** `platform-infra.md` §6 (CI gates), §8 (workspace packages list:
  `packages/access`, `packages/auth-client`, `packages/shared-firebase`,
  `packages/shared-routing`, `packages/seed`) vs `SDK-LAYERS-PLAN.md` §1.1 (16
  SDK/server packages: `transport-firebase`, `api-client`, `repositories`,
  `query`, `realtime`, `functions-shared`, `repository-admin`, …).
  `lint-boundaries.md` §8.1 lists the _new_ required CI gates (RN-purity,
  depcruise, custom-rule RuleTesters).
- **Problem:** `platform-infra.md` — the doc that actually owns the testing
  strategy, the test pyramid, the CI gate list, and the seeding section — is
  written against the **older** package taxonomy and does **not** mention the
  FROZEN-CANDIDATE's signature test gates by name: the RN-purity bundle check,
  the `no-tenant-id-in-request` contract test, `no-optimistic-on-authority`,
  `registry-integrity`, `allowed-transitions-enum`, the per-layer `__contract__`
  suites, or depcruise. Its CI flow (§6: "lint → typecheck → build → unit →
  integration → contract") omits the lint _rule tests_ (RuleTester specs in
  `eslint-config/test`) and the RN-purity job that `lint-boundaries.md` §8.1
  declares **required status checks**. Result: the authoritative testing/CI doc
  and the authoritative layer plans disagree on what runs and against which
  packages — a reviewer cannot determine the real gate set, and a build session
  following `platform-infra.md` would ship without the headline boundary gates
  wired.
- **Resolution:** Reconcile `platform-infra.md` §6/§8/§9 to the §1.1 package set
  and fold in every named gate from the layer plans (`lint-boundaries.md` §8.1's
  three required checks, each layer's `__contract__`/`__tests__` suites, the
  seed determinism tests from T2) into one canonical CI matrix. Make the layer
  plans' "Contract/lint tests this layer requires" sections the single source
  the CI config is generated from.

## T8 — The no-tenantId contract test's key-walker has depth/shape blind spots it must defend against

- **Severity:** MINOR
- **Where:** `api-contract-core.md` §10.1 (`collectKeys`, `depth < 2` cap) and
  §10.5 (reused for subscriptions); `lint-boundaries.md` R11 ("any nesting under
  the request root").
- **Problem:** The headline #1-boundary test relies on a hand-rolled Zod AST
  walker with a hard `depth < 2` cutoff and explicit handling for only
  `ZodObject/Optional/Nullable/Effects/Union/ DiscriminatedUnion`. A `tenantId`
  smuggled at depth ≥ 2 (e.g. `data.meta.tenantId`), or behind a `ZodRecord`,
  `ZodLazy`, `ZodDefault`, `ZodCatch`, `ZodPipeline`, `ZodReadonly`, or
  `ZodBranded` wrapper, is **not traversed and passes the test** — a
  false-negative on the single most important authority assertion. The walker
  also depends on `_def.typeName` string internals that shift across Zod
  minor/major versions (the codebase shows churn toward Zod v4-style schemas),
  so a Zod upgrade can silently turn every traversal into a no-op (returns
  `[]`), making the test vacuously green.
- **Resolution:** Replace the depth cap with full recursion plus a cycle guard;
  add explicit cases for `ZodDefault/Catch/Pipeline/Readonly/Branded/Lazy` (and
  reject/flag `ZodRecord` request fields as un-walkable). Add a **self-test**: a
  deliberately-planted `tenantId` at depth 3 and behind a `ZodDefault` MUST be
  caught (proves the walker isn't vacuous), and a Zod-version pin/assertion so
  an upgrade that changes `_def` shape fails loudly instead of going green.

## T9 — Optimistic-allow-list lint depends on a build-time-generated `AUTHORITY_CALLABLES` JSON with no freshness test

- **Severity:** MINOR
- **Where:** `lint-boundaries.md` §3 R10 + §4 ("emitted from `api-contract` at
  build → a JSON the rule imports"; authority set =
  `def.authorityWrite === true`); `query-infra.md` §9 test #3 (drift guard vs
  `OPTIMISTIC_ALLOWLIST`). Note the flag is called `authorityWrite` in
  lint-boundaries but `authoritySensitive` in `SDK-LAYERS-PLAN.md` §3.1/§4.4 and
  `query-infra.md` — a naming schism.
- **Problem:** The `no-optimistic-on-authority` rule reads a **generated**
  `AUTHORITY_CALLABLES` JSON artifact. If that artifact is stale (codegen not
  re-run after a new ⚷ callable is added, or the field name mismatch above
  causes the generator to read the wrong flag), the lint silently permits an
  optimistic update on a new grading/purchase callable — the exact
  NON-NEGOTIABLE #5 violation it exists to prevent, with no failure.
  `query-infra.md` test #3 guards that the _query package's_ allow-list matches
  `OPTIMISTIC_ALLOWLIST`, but nothing tests that the _generated lint artifact_
  matches the live `CALLABLES` authority flags, nor that the two flag names are
  unified.
- **Resolution:** Unify the flag name (pick `authoritySensitive`, update
  `lint-boundaries.md`). Add an `authority-flag-coverage.test.ts` (already
  hinted in `lint-boundaries.md` §8.2 step 4) that regenerates
  `AUTHORITY_CALLABLES` from live `CALLABLES` and asserts byte-equality with the
  committed artifact (fails CI if stale), and cross-checks it against REVIEW
  §6's ⚷ list so a new ⚷ callable missing the flag fails.

## T10 — ALLOWED_TRANSITIONS build-time assertion is well-specified, but `entityStatus` reuse and the dropped-enum toggles aren't transition-tested per consuming entity

- **Severity:** MINOR
- **Where:** `domain-core.md` §9 (`transitions.assertion.test.ts`),
  `api-contract-core.md` §10.4, `SDK-LAYERS-PLAN.md` §3.6 (the `entityStatus`
  machine shared by student/teacher/parent/staff/scanner/ class/session;
  `'completed'` exam status dropped; OCR statuses excluded "behind documented
  toggles").
- **Problem:** The transition test asserts each machine's keys/targets ⊆ its
  enum and is otherwise strong. But (a) the single `entityStatus` machine is
  reused across **7 entity types** whose status enums must each equal
  `{active, archived}`; the test as written checks the `entityStatus` table
  against _one_ enum, not that all 7 consuming entities actually share that
  exact enum — a future per-entity status drift (e.g. class gaining a
  `'suspended'`) would not be caught against the shared table. (b) The "dropped
  `'completed'` / excluded OCR statuses behind a documented toggle" means the
  transition table and the enum can be toggled together — but there is no test
  that the **toggle state is consistent** (table re-includes a status the enum
  still excludes, or vice versa) other than the compile-time `satisfies`, which
  only catches the table-references-missing-enum-member direction, not
  enum-member-with-no-table-edge for
  intentionally-terminal-vs-accidentally-orphaned states.
- **Resolution:** Parameterize `transitions.assertion.test.ts` over the **7**
  `entityStatus`-consuming enums (assert each === `{active,archived}`), and add
  a toggle-consistency assertion that when an enum member is excluded
  (OCR/`completed`), no transition edge references it and no other state lists
  it as a target — so flipping the toggle back on is provably a single
  coordinated change.

## T11 — RN-purity bundle check is duplicated per-package with no single source of truth, risking gaps

- **Severity:** MINOR
- **Where:** `lint-boundaries.md` §6 + §8.1 (`runRnPurityCheck().ok`, one
  required CI job), `query-infra.md` §9 #7, `api-client-core.md` §6.7,
  `domain-core.md` §9 ("RN-bundle build (CI)"), `SDK-SERVER-DESIGN.md` §7.2.
- **Problem:** The RN-purity gate — the "mechanical proof that domain→query stay
  pure" — is described independently in at least four layer plans (each says "CI
  bundles this package under an RN resolver and greps for
  firebase/DOM/node/import.meta"). The grep target lists differ slightly between
  plans (`query-infra` greps `import.meta`/`window.`/`'firebase'`; `domain-core`
  says "node-only/DOM transitive dep"; `lint-boundaries` §6 is the canonical
  one). Four near-duplicate descriptions with drifting ban-lists is itself a
  testability smell: a package added later (e.g. `realtime`, `repositories`) may
  not be wired into the gate, and the ban-list a given package is checked
  against is ambiguous. The check is also a transitive-resolution bundle build,
  which is slow/flaky if not centralized.
- **Resolution:** Make `lint-boundaries.md` §6 the single normative spec; have
  every other layer plan _reference_ it rather than re-describe it. Drive the
  set of RN-checked packages from `build-config/tiers.json` (the `t0`–`t4` pure
  tiers) so adding a pure package auto-enrolls it, and assert in a meta-test
  that every pure-tier package is covered by the RN-purity matrix.

## T12 — No test plan for the realtime `subscribe()` seam payload validation or RTDB epoch-ms fenced exception

- **Severity:** MINOR
- **Where:** `transport-realtime.md` §8 (contract tests), `SDK-LAYERS-PLAN.md`
  §3.3 SUBSCRIPTIONS; D4/D6 fenced exception (RTDB badge `createdAt` stays
  epoch-ms while everything else is ISO).
- **Problem:** Nine subscriptions carry strict payload schemas and three sources
  (`firestore-doc`, `firestore-query`, `rtdb-node`).
  `subscriptions-integrity.test.ts` (§10.5) validates the _registry_ shape, and
  `api-client-core.md` §6.8 tests that `subscribe` _forwards_. But there is no
  named test that the transport's per-source decoding actually produces
  schema-valid payloads — in particular the **RTDB epoch-ms→Timestamp fenced
  exception** (`v1.notification.badge`, `v1.levelup.leaderboardLive` are
  `rtdb-node`): the one place the timestamp-trichotomy collapse is deliberately
  _not_ applied. A decoder that forgets this fence yields either an invalid
  payload or a wrong time, and nothing tests the boundary. The
  `__tenant__`/`__uid__` placeholder resolution in `SUBSCRIPTION_SOURCES`
  (claim/uid injection into the wire path) is also security-relevant (wrong
  resolution = cross-tenant snapshot) and untested.
- **Resolution:** Add to `transport-realtime.md` §8: per-source decode tests
  using a fake Firestore/RTDB emitter that the decoded payload
  `responseSchema.parse`-es, an explicit epoch-ms→Timestamp case for the two
  `rtdb-node` subs, and a placeholder-resolution test asserting
  `__tenant__`/`__uid__` resolve from the decoded claim/`currentUser` (and that
  a mismatched claim can never widen the path to another tenant).
