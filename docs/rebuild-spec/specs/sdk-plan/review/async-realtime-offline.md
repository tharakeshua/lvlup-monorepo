# Review — Async / Realtime / Offline Soundness

**Perspective:** async / realtime / offline soundness of the FROZEN-CANDIDATE
SDK + server rebuild. **Scope checked:** single-writer enforcement on derived
values; idempotency keys + server dedupe on every create-external-state
callable; outbox for must-deliver side-effects; Cloud Tasks for the grading
reducer + watchdog; trigger/scheduler thinness; realtime `subscribe()` seam
parity with `invoke()` + typed SUBSCRIPTIONS + `useServerTime`; offline seam +
day-1 idempotency; test-session server-authoritative clock/deadline.
**Verdict:** structurally strong (the async invariants are _named_ in the right
places), but several invariants are asserted without an enforcement mechanism,
two subscriptions are typed but have no owning producer/source, the AI-grading
fan-out has an unspecified completion/race contract, and the dedupe primitive
itself has an atomicity gap. Findings below.

---

## A1 — `idempotency.dedupe.begin/commit` is a non-atomic two-phase store with no in-flight fencing (double-execution window)

- **Severity:** BLOCKER
- **Where:** `server-shared.md` §2.7 (`idempotency/dedupe.ts`),
  `SDK-LAYERS-PLAN.md` §5.3 async invariants; consumed by `submitTestSession`,
  `evaluateAnswer`, `recordItemAttempt`, `uploadAnswerSheets`, `purchaseSpace`,
  `createOrgUser`, `bulkImport*`.
- **Problem:** The dedupe contract is `begin(ctx,name): Promise<ResOf|null>`
  (returns cached if committed, "else marks in-flight") then
  `commit(ctx,name,res)`. The `makeCallable` flow (server-shared §2.3) does
  `const cached = await dedupe.begin(...); if (cached) return cached; ... const res = await service(input,ctx); ... await dedupe.commit(...)`.
  Two concurrent retries (Cloud Functions delivers callables at-least-once under
  client retry, and the SDK's own `withRetry` re-fires on `DEADLINE_EXCEEDED`
  while the first invocation is still running server-side) both call `begin`,
  both see "no committed result," both proceed to run the service body, and both
  `commit`. Nothing in the spec says `begin` performs an **atomic transactional
  claim** (e.g. `create` of the idempotency doc failing on contention → treat as
  in-flight → block/poll or reject with `IDEMPOTENCY_CONFLICT`). The
  `IDEMPOTENCY_CONFLICT` error code exists in the vocabulary (api-contract §3.4)
  but is never wired to a code path. Result: the single most important safety
  mechanism for "create-external-state callables" (purchase, submission
  ingestion, org-user creation) can double-execute under exactly the retry
  conditions it exists to defend against.
- **Resolution:** Specify `dedupe.begin` as a Firestore transaction that
  **creates** the `tenants/{t}/idempotency/{uid}_{key}` doc with status
  `in_flight` + a lease/TTL; on `create` contention (doc already exists) it must
  either (a) return the committed response if `status==committed`, or (b) throw
  `IDEMPOTENCY_CONFLICT` (retryable-after) if `status==in_flight` and the lease
  is unexpired, or (c) reclaim a stale lease. Make `commit` flip
  `in_flight→committed` in the same doc. Add an emulator contract test
  (server-shared §8 test #10 must be strengthened): fire two concurrent
  identical idempotent calls and assert **exactly one** service-body execution
  (count side effects), not just "one cached response." Wire
  `IDEMPOTENCY_CONFLICT` into `mapError` and `DEFAULT_RETRYABLE`.

---

## A2 — `evaluateAnswer` idempotency keyed on `answerHash`, but the SDK generates a fresh UUIDv7 key per logical call — the two dedupe identities are incompatible

- **Severity:** MAJOR
- **Where:** `testsession-progress.md` §API (`evaluateAnswerDef` "dedupe on
  `(uid, spaceId, itemId, answerHash)`") and open-Q #4; vs `api-client-core.md`
  §3.5 (key = UUIDv7 generated per logical call) and §0 ("stable across
  retries").
- **Problem:** The api-client unconditionally generates a UUIDv7
  `__idempotencyKey` for every `def.idempotent` callable and the server "dedupes
  on `(uid, key)`" (server-shared §2.7). But the testsession plan says
  `evaluateAnswer`/`submitTestSession`/`recordItemAttempt` dedupe on
  **domain-natural keys** (`answerHash`, `sessionId`, `attemptNumber`). These
  are two different dedupe schemes that cannot both be the dedupe identity. With
  the UUIDv7 scheme, a user who taps "evaluate" twice on the same answer (two
  logical calls, two fresh keys) is **not** deduped — both run the (paid, AI)
  evaluation and both write progress. With the domain-key scheme, the
  api-client's UUIDv7 is dead weight and the server must ignore it. The plan
  never resolves which wins; open-Q #4 in testsession even asks "confirm
  `answerHash` is stable across retries" as if both coexist.
- **Resolution:** Pick one model per callable and state it in the `CallableDef`.
  Recommended: keep the UUIDv7 transport-retry key as the _retry-dedupe_
  identity (defends network retries), and add an explicit **domain idempotency
  key** field where double-submit-from-distinct-user-actions must also be
  deduped (submit on `sessionId`; evaluate on `(spaceId,itemId,answerHash)`;
  record on `(spaceId,storyPointId,itemId,attemptNumber)`). The server dedupe
  table key = the domain key when present, else the UUIDv7. Document this dual
  model in `api-client-core.md` §3.5 and `server-shared.md` §2.7, and add a
  per-callable `idempotencyKey: 'transport' | 'domain:<fields>'` hint to
  `CallableDef` so it is build-time visible, not prose.

---

## A3 — AI-grading fan-out has no specified completion/aggregation contract; `submitTestSession` returns `pending` but nothing is the single-writer of "all items now graded"

- **Severity:** MAJOR
- **Where:** `testsession-progress.md` §Cloud Tasks ("enqueue a Cloud Task per
  pending item → onSubmissionGraded single-writer merge + progress recompute"),
  §triggers `onSubmissionGraded`, open-Q #6; vs autograde's `advancePipeline`
  single reducer.
- **Problem:** For test-session AI grading, the design enqueues **one task per
  pending item**, each flowing through `onSubmissionGraded` which "merges the
  evaluation into the TestSubmission subdoc and re-runs progressUpdaterService
  for that item." This is N independent writers racing on the same parent
  `SpaceProgress`/`StoryPointProgress` aggregate (each item completion bumps the
  same `pointsEarned/totalPoints/completionPct`). `progressUpdaterService` is
  asserted to be "the single transactional progress writer," but N concurrent
  task handlers all _call_ it concurrently — single-writer-by-function-identity
  is not single-writer-by-document unless every call is a Firestore transaction
  on the aggregate doc _and_ they serialize. More seriously, **nothing computes
  "the session is now fully graded"**: there is no reducer that detects the last
  pending item completing, finalizes the session `status`/`percentage`, and
  fires the "your test was graded" notification exactly once. Autograde solved
  this with `advancePipeline` (single reducer) + `finalizeSubmission` (the one
  place final status is computed); the test-session AI path has no equivalent
  finalizer. Open-Q #6 admits "confirm which subscription channel carries the
  backfill" — i.e. the completion contract is unresolved.
- **Resolution:** Mirror autograde: introduce a single **session-grading
  reducer** (Cloud Tasks handler, dedupe id `(sessionId, pendingCount)` or a
  decrementing counter) that each per-item task `enqueuePipelineAdvance`-style
  notifies; the reducer transactionally (a) merges that item's evaluation, (b)
  decrements a `pendingAiItems` counter on the session doc, and (c) when the
  counter hits 0, computes final scores/analytics via `progressUpdater` once and
  enqueues the single "graded" outbox notification. Make
  `progressUpdaterService` writes Firestore transactions on the aggregate doc
  (read-modify-write under `tx`) so concurrent item completions cannot
  lost-update the running totals. State the realtime backfill channel explicitly
  (the `testSessionDeadline` payload already streams `status`; reuse it, or add
  a `sessionGraded` payload) and add an emulator test: submit a 3-AI-item test,
  complete the 3 tasks out of order, assert exactly one finalization + one
  notification + correct summed points.

---

## A4 — Two SUBSCRIPTIONS are typed in the registry but have no owning producer and no source descriptor (`chatStream`, `spaceProgressLive`, `studentLevelLive`, `achievementUnlock`)

- **Severity:** MAJOR
- **Where:** `SDK-LAYERS-PLAN.md` §3.3 SUBSCRIPTIONS table (9 entries) vs
  `transport-realtime.md` §2.2 `SUBSCRIPTION_SOURCES` (7 entries) and §8
  coverage test #1 ("`Object.keys(SUBSCRIPTION_SOURCES)` ⊇
  `Object.keys(SUBSCRIPTIONS)`").
- **Problem:** The master SUBSCRIPTIONS registry lists
  `v1.levelup.testSessionDeadline`, `chatStream`, `spaceProgressLive`,
  `leaderboardLive`, `studentLevelLive`, `achievementUnlock`,
  `v1.autograde.gradingStatus`, `examGrading`, `v1.notification.badge` = **9**.
  `SUBSCRIPTION_SOURCES` in transport-firebase defines descriptors for only
  **7** (`testSessionDeadline`, `chatStream`, `spaceProgressLive`,
  `gradingStatus`, `examGrading`, `notification.badge`,
  `analytics.leaderboard`). Missing: `v1.levelup.studentLevelLive` and
  `v1.levelup.achievementUnlock` (both in the gamification domain's hook list —
  `useStudentLevelLive`, `useAchievementUnlockStream`). Also the registry names
  `v1.levelup.leaderboardLive` while the source table and analytics domain name
  it `v1.analytics.leaderboard` — a name schism, not just a missing entry. The
  §8 coverage test (`⊇`) would **catch the missing two at build time** — which
  means the build is currently red, or the test is aspirational. Either way the
  realtime seam is not internally consistent: a subscription a hook subscribes
  to has nowhere to physically read from, and `subscribe()` would dereference
  `SUBSCRIPTION_SOURCES[name]` = `undefined`.
- **Resolution:** Reconcile the registry and the source table to one list. Add
  `studentLevelLive` (Firestore doc on `__tenant__/studentLevels/__uid__` or
  wherever the gamification domain authors `StudentLevel`) and
  `achievementUnlock` (Firestore query on the student-achievements collection,
  `where seen==false`) descriptors. Resolve `leaderboardLive` vs
  `analytics.leaderboard` to a single canonical name across
  registry/sources/hooks. Confirm every subscription has a named **producer**
  (the trigger/service that writes the doc/node it streams) in the owning domain
  plan — `studentLevelLive` and `achievementUnlock` producers must exist in
  `gamification`/`analytics`, and the §8 ⊇ test must be green, not a future
  hope.

---

## A5 — `examGrading` subscription is a live `submissions where examId==` collection listener — an unbounded fan-out with no maintained aggregate; single-writer/cost contract deferred to "flagged"

- **Severity:** MAJOR
- **Where:** `transport-realtime.md` §SUBSCRIPTION_SOURCES (`examGrading` →
  `collectionPath __tenant__/submissions, where examId==`), §9 risk #4
  ("mitigation belongs server-side… flagged to the autograde domain");
  `autograde.md` §SUBSCRIPTIONS open-Q #5.
- **Problem:** The exam-grading-dashboard live progress subscribes to a
  Firestore **query listener** over every submission of an exam. For a class of
  200 students, that is 200 doc listeners updating continuously through the
  entire grading pipeline (each submission transitions through ~10 pipeline
  statuses, each a snapshot). This is read-cost and client-CPU heavy, and worse,
  it has no single-writer/aggregate doc — the "live count" is computed
  client-side by counting query results, so two clients see different
  intermediate counts and there is no authoritative `ExamGradingProgress`. The
  transport layer says the mitigation (a maintained aggregate doc the
  subscription points at) "belongs server-side — flagged to the autograde
  domain," and the autograde domain's open-Q #5 only confirms `gradingProgress`
  is persisted _per submission_, not aggregated per exam. So the aggregate the
  `examGrading` payload (`ExamGradingProgress`) describes is **not produced by
  anyone**.
- **Resolution:** Make `examGrading` point at a single server-maintained
  aggregate doc (e.g. `tenants/{t}/examGradingProgress/{examId}`) updated by
  `advancePipeline`/`finalizeSubmission` as each submission advances
  (single-writer, transactional counter increments: `graded`, `total`, `failed`,
  `inReview`). The subscription then streams one doc, not N. Assign the producer
  explicitly in the autograde domain plan and the source descriptor becomes
  `{ docPath }` not `{ collectionPath, where }`. This also removes the
  per-client divergence.

---

## A6 — Outbox is defined as a transactional record but the **drain** mechanism (delivery worker, retry/backoff, DLQ, ordering, exactly-once delivery) is never specified

- **Severity:** MAJOR
- **Where:** `server-shared.md` §2.8 (`enqueueOutbox(tx, rec)` "A drain
  trigger/scheduler delivers"), §3.4 ("Outbox for must-deliver: written
  in-transaction, drained reliably"); `notification.md` §triggers ("route
  through a transactional outbox / Firestore-trigger so a transient failure
  retries").
- **Problem:** The outbox _write_ side is well specified (atomic with the state
  change, with a rollback test #14). But "must-deliver" is a property of the
  **delivery** side, and the design only says "a drain trigger/scheduler
  delivers" with no contract: What triggers the drain (a Firestore `onCreate` on
  the outbox collection? a cron sweeping `status==pending`?). What is the retry
  policy and backoff on a failed delivery? What is the max-attempts →
  dead-letter behavior (the `attempts` field exists but no DLQ for outbox is
  named — only the _grading_ DLQ exists)? Is delivery idempotent (the consumer,
  e.g. `emitNotificationService`, dedupes — good — but the outbox record itself
  needs an at-least-once-with-dedupe contract)? Without this, "must-deliver" is
  aspirational: a transient failure on the drain with no retry/DLQ silently
  drops a results-released notification — the exact fire-and-forget failure
  (`common-api §347` / `.catch(log)`) the outbox was introduced to fix.
  `notification.md` even hedges "transactional outbox / Firestore-trigger" as if
  interchangeable, but a plain Firestore trigger with no retry tracking is _not_
  an outbox.
- **Resolution:** Specify the outbox drain as a concrete worker: an `onCreate`
  trigger on `tenants/{t}/outbox/{id}` (or `every 1 minute` sweep of
  `status==pending`) that delivers via the consumer service, on success sets
  `status=delivered`, on failure increments `attempts` and reschedules with
  exponential backoff (Cloud Tasks `scheduleDelaySec`), and after N attempts
  sets `status=failed` and writes an **outbox dead-letter** entry surfaced to
  ops. State that delivery is at-least-once and consumers must dedupe (they do,
  via `emitNotificationService`'s
  `(tenantId,recipientUid,entityType,entityId,type)` key). Add an emulator test:
  a delivery that throws twice then succeeds results in exactly one delivered
  side effect and `attempts==3`.

---

## A7 — `progressUpdaterService` and `recomputeOrchestrator` are called "single-writer" but the mechanism that prevents concurrent invocations from racing the same doc is unspecified

- **Severity:** MAJOR
- **Where:** `testsession-progress.md` §services (`progressUpdaterService`
  "single transactional progress writer"); `analytics.md` §services
  (`recomputeStudentSummaryService` "Single-writer per summary doc…
  Section-scoped transaction merge"), `recomputeOrchestratorService`
  ("Debounced/queued; consumes + clears RecomputeMarker"); `SDK-LAYERS-PLAN.md`
  §5.3 "single-writer per derived value."
- **Problem:** "Single-writer" is used in two distinct senses that the plan
  conflates: (1) _single code path_ (only one function ever writes the doc) —
  true here, and good; (2) _serialized writes_ (no two executions of that path
  race). The async-correctness property requires (2), and (2) is only achieved
  by either (a) a transaction that read-modify-writes the derived doc (so
  Firestore's optimistic concurrency retries on conflict), or (b) a true
  single-consumer queue (one in-flight task per key). The plan asserts (1) and
  _names_ transactions/queues in passing but never states the invariant
  precisely:
  - `progressUpdater` is hit concurrently by `submit` + per-item AI
    `onSubmissionGraded` + `recordItemAttempt` (see A3). If it is not a
    transaction on the aggregate doc, concurrent best-score/points merges
    lost-update.
  - `recomputeOrchestrator` is "debounced/queued" but the dedupe handle is
    `RecomputeMarker.taskId` (an optional field). If two section writers
    (autograde + levelup) both set the marker and both enqueue a task before
    either clears it, two orchestrator runs race the class-summary/leaderboard
    writes. "Debounced" needs a concrete mechanism (Cloud Tasks `dedupeId` =
    `(tenantId,studentId)` with a debounce window, or a queue with concurrency 1
    per key).
- **Resolution:** For every derived value, state the serialization mechanism
  explicitly: (a) `progressUpdater` performs all aggregate mutations inside
  `ctx.repos.tx()` reading the current aggregate and writing the merged result
  (Firestore aborts+retries on contention); add a test driving 5 concurrent
  attempt records and asserting the final points == sum. (b)
  `recomputeOrchestrator` enqueues with Cloud Tasks
  `dedupeId=(tenantId,studentId)` and a debounce delay so a burst of section
  writes collapses to one run; the marker is cleared transactionally at the
  _start_ of the run and re-checked at the end (re-enqueue if a new marker
  arrived during the run). Document both in `SDK-LAYERS-PLAN.md` §5.3 as the
  definition of "single-writer."

---

## A8 — Test-session deadline grace, autosubmit, and the `expireTestSessions` scheduler can double-grade against `submitTestSession`

- **Severity:** MAJOR
- **Where:** `testsession-progress.md` §services (`submitTestSession` "validates
  against serverDeadline (+30s grace)"; `expireAndGradeSessionService`
  idempotent "status guard only in_progress→expired"), §schedulers
  (`expireTestSessions` every 5 min, `serverDeadline + 30s`), §triggers
  `onTestSessionExpired`.
- **Problem:** Two paths grade an expiring session: (1) the client calls
  `submitTestSession({autoSubmitted:true})` at the deadline; (2) the
  `expireTestSessions` scheduler (runs every 5 min, picks up sessions past
  `serverDeadline+30s`) calls `expireAndGradeSessionService`. Both transition
  `in_progress → {completed|expired}` and both invoke grading +
  `progressUpdater`. The plan gives each path its _own_ idempotency/guard:
  submit dedupes on `(uid,sessionId)`; expire guards on `status==in_progress`.
  But these are **different guards on different keys** — there is no shared
  lock. Race: at deadline, the scheduler fires `expireAndGradeSessionService`
  (reads `status==in_progress`, passes guard, begins grading) at the same
  instant the user's autosubmit `submitTestSession` runs (its own dedupe table
  has no entry for this `(uid,sessionId)` yet, passes, begins grading). Both
  grade, both write progress. The `+30s` grace doesn't help — the scheduler's
  window (`>deadline+30s`) and the submit grace (`<=deadline+30s`) are
  _adjacent_, not exclusive, and scheduler granularity is 5 min so a session can
  be picked up well after the user also submits.
- **Resolution:** Make both paths converge on **one** transition writer keyed by
  `sessionId` (not by `(uid,key)` and `status` separately).
  `expireAndGradeSessionService` and `submitTestSessionService` must both, as
  their first transactional step, claim the session by transitioning
  `in_progress→<terminal>` inside a transaction; whichever commits first wins,
  the loser reads the now-terminal status and returns the already-computed
  result (the submit idempotency contract A2). State that grading + progress
  write happen _inside or after_ that winning transition claim. Add an emulator
  test firing submit and expire concurrently on the same session and asserting
  one grade + one progress write.

---

## A9 — `serverDeadline` is server-authoritative, but the live countdown trusts `useServerTime()` over `/.info/serverTimeOffset`, which is an RTDB-client estimate, not the server's grading clock

- **Severity:** MINOR
- **Where:** `transport-realtime.md` §server-time (`serverTimeOffset` over
  `/.info/serverTimeOffset`), §9 risk #2; `testsession-progress.md`
  §subscriptions ("deadline stays server-authoritative… the subscription only
  streams the value") + `useServerTime()` open-Q #5; `REVIEW §6.6`.
- **Problem:** The authority story is correct _for grading_ (the server
  validates `submittedAt <= serverDeadline` with `ctx.now()` — never the client
  clock). But the **UX countdown** uses `useServerTime()` =
  `Date.now() + offsetMs` where `offsetMs` comes from RTDB
  `/.info/serverTimeOffset`. That offset is Firebase's _RTDB-connection_ clock
  skew estimate, which can differ from the Cloud Functions wall clock by network
  jitter / connection age, and drifts if the RTDB socket is stale. This is fine
  for a display countdown (a few seconds of skew is cosmetic), but the plan
  presents `useServerTime()` as _the_ resolution to "never trust the client
  clock" without noting it is an estimate, not the grading clock. The risk is a
  user whose countdown hits 0 while the server (using its own `ctx.now()`) still
  has 2s of grace, or vice-versa — surfacing as "I submitted on time but got
  expired" confusion. The `testSessionDeadline` subscription streams
  `remainingMs?` (server-computed) which would be authoritative, but the plan
  also says repos compute `remainingMs(session, serverNow)` client-side from the
  offset — two sources of "remaining" that can disagree.
- **Resolution:** Make the streamed `remainingMs` (server-computed against
  `ctx.now()` at snapshot time, decremented locally between snapshots) the
  authoritative display source, and use `useServerTime()` only to _interpolate_
  between server snapshots, not as the primary clock. Document that
  `/.info/serverTimeOffset` is an estimate and that the grading decision uses
  neither it nor the client — only `ctx.now()`. Show a "submitting…" state past
  `remainingMs==0` rather than a hard client-side lockout, so the server's grace
  window (not the client estimate) decides acceptance.

---

## A10 — Two different `useSubscription` hooks exist (one in `@levelup/realtime`, one in `@levelup/query`) with different signatures and an unspecified realtime→cache write-back contract

- **Severity:** MAJOR
- **Where:** `transport-realtime.md` §3 (`@levelup/realtime`'s `useSubscription`
  returns `UseSubscriptionResult<P>` and stores payload in component state) vs
  `query-infra.md` §11 (`@levelup/query`'s `useSubscription` writes payload into
  the React Query cache via `qc.setQueryData(subscriptionKey(...), payload)`);
  `query-infra.md` line 80 "thin wrapper over transport.subscribe → cache
  write."
- **Problem:** The plan defines the same exported name `useSubscription` in two
  packages with incompatible contracts: the realtime one returns
  `{data,status,error,synced}` from local state and is deduped via a refcount
  `SubscriptionManager`; the query one writes into the query cache under
  `subscriptionKey(name,params)` and returns `{status}` only. The domain plans
  reference both interchangeably (testsession uses `useTestSessionDeadline` from
  realtime; query-infra claims `useSubscription` "writes into the query cache").
  Critical open question this exposes: **how does a realtime payload reconcile
  with the REST-fetched cache entry?** E.g. `gradingStatus` streams pipeline
  status while `useSubmission(id)` holds the REST submission in
  `submissionKeys.detail(id)` — does the subscription `setQueryData` into that
  same key (so the UI sees live updates through the existing query) or into a
  separate `subscriptionKey` (so the UI must read two hooks and merge)? The two
  `useSubscription` definitions imply _both_ patterns exist and neither domain
  plan says which key a given subscription writes. There is also no specified
  behavior for the live payload superseding an optimistic update or a stale REST
  snapshot (last-writer-wins? merge?).
- **Resolution:** Collapse to one `useSubscription` (realtime owns the seam +
  dedupe; query owns an opt-in `toCacheKey`/`onPayload` binding that writes into
  a _named existing_ query key). For each of the 9 subscriptions, state in its
  owning domain plan **which query key it writes** and the reconciliation rule
  (recommend: subscriptions write into the same `*.detail(id)` key the REST read
  populates, so one cache entry is the single source and the live stream just
  keeps it warm; `onSynced` gates the first write so a cache hydrate isn't
  clobbered). Add the realtime-vs-optimistic precedence rule (server stream
  always wins; it arrives after the optimistic reconcile).

---

## A11 — `recordItemAttempt` is optimistic and idempotent, but its server re-validation of the client-supplied `score` has no defined behavior when the optimistic value and authoritative value diverge mid-flight

- **Severity:** MINOR
- **Where:** `testsession-progress.md` §API `recordItemAttemptDef` (optimistic
  ✅, client sends `score/maxScore/correct`, "authority-sensitive scoring still
  re-validated server-side"); `query-infra.md` §6 optimistic recipes
  (`patchDetail`, "reconcile with authoritative response").
- **Problem:** `recordItemAttempt` is on the optimistic allow-list: the client
  optimistically bumps `questionData/completed` in the cached
  `storyPointProgress`, then the server re-validates the score. But the plan
  also says the server "re-validates the claimed score is consistent with the
  item" and `progressUpdater` enforces **best-score retention**. So three values
  exist: the optimistic cache value (client's claimed score), the server's
  recomputed authoritative score, and the prior best score. If the server's
  authoritative score differs from the client's optimistic patch (e.g. client
  claims correct, server deterministic re-grade says partial), the reconcile
  must replace the optimistic value with the server's — but the recipe's default
  `reconcile` is "trust server, invalidate," which _refetches_ rather than
  reading the mutation's returned `{progress,completed}`. A refetch after a
  best-score write can also return the _prior_ best (if the new attempt scored
  lower), making the UI appear to reject a just-recorded attempt. The
  interaction between optimistic-patch, best-score-monotonicity, and
  invalidate-refetch is not specified.
- **Resolution:** Specify that `recordItemAttempt`'s `reconcile` reads the
  mutation response's authoritative `{progress}` and `setQueryData`s it directly
  (not invalidate-refetch), so the displayed value is exactly what the server
  committed (including best-score retention semantics). Document that the
  optimistic patch is _provisional_ and the UI must visibly reconcile to the
  server's score (including the "your previous best stands" case). Add a test:
  optimistic correct → server partial → cache shows server partial;
  lower-than-best attempt → cache shows retained best, not the new lower score.

---

## A12 — Offline seam routes only `def.idempotent` mutations through the queue, but several offline-critical scanner writes are not idempotent-flagged, and the deferred queue has no ordering/conflict contract even as a stub

- **Severity:** MINOR
- **Where:** `api-client-core.md` §3.6 ("Only `def.idempotent` mutations are
  queue-eligible"); `transport-realtime.md` §4 (`@levelup/offline` no-op);
  `mobile-scanner.md` G3 (durable queue deferred), G1 (Storage byte-upload
  uncovered).
- **Problem:** The offline story hinges on idempotency keys being "in from day
  one" so later replay is safe — good. But (1) the queue is
  `def.idempotent`-gated, and the scanner's real offline write is a **two-step**
  operation: Storage byte-upload (G1 — currently _uncovered_, no callable)
  _then_ `uploadAnswerSheets`. Only the second step is a callable with an
  idempotency key; the Storage PUT is not a callable and is not queue-eligible,
  so an offline capture can't be durably replayed end-to-end through the SDK
  seam regardless of the key. (2) Even as a deferred seam, the plan never states
  the _ordering_ and _conflict_ contract the real queue must honor (FIFO
  per-key? global FIFO? what happens when a queued `uploadAnswerSheets` replays
  after the exam transitioned to `results_released` and now rejects with
  `INVALID_TRANSITION`?). `transport-realtime.md` §9 risk #5 defers this
  entirely ("No v1 work"), but the _contract_ the stub promises should be fixed
  now so the day-1 keys are actually sufficient.
- **Resolution:** (1) Tie the offline seam to the G1 resolution: the byte-upload
  must become a callable-or-typed-repo-seam (`requestUploadUrl` /
  `storageRepo.uploadAnswerSheetImage`) carrying its own idempotency key so the
  _whole_ capture→upload→ingest sequence is replayable, and the queue must
  enqueue the composite job, not just the final callable. (2) Even deferred,
  state the v1 stub's promised contract: per-`idempotencyKey` dedupe +
  FIFO-per-key replay + a defined terminal-failure behavior when a replayed call
  returns a non-retryable `INVALID_TRANSITION`/`PRECONDITION_FAILED` (surface to
  the queue-item-detail UI as "exam closed," drop the job). Record the G3
  decision (promote minimal impl vs app-local) since the scanner is the one app
  whose core value is the durable queue.

---

## A13 — Platform-announcement fan-out is acknowledged as needing Cloud Tasks but is only "recommended," not committed, while the trigger that would do it inline is named

- **Severity:** MINOR
- **Where:** `notification.md` §triggers `onAnnouncementPublished` ("reliable
  fan-out from saveAnnouncementService publish (outbox)"), open-Q #6
  ("super-admin publishes a platform announcement, fan-out to every tenant's
  users is a large job → Recommend Cloud Tasks paginated fan-out… rather than a
  single trigger"); `SDK-LAYERS-PLAN.md` §5.3 lists "platform announcement
  fan-out" under Cloud Tasks.
- **Problem:** A platform-scope announcement targets _every tenant's_ users —
  potentially hundreds of thousands of notification docs + RTDB badge
  increments. The notification plan names a single `onAnnouncementPublished`
  trigger doing the fan-out and only _recommends_ Cloud Tasks "for the one place
  multi-step orchestration may be warranted." A single Firestore trigger
  (default 540s / memory bound) cannot reliably fan out platform-wide; it will
  time out mid-fan-out, and because `emitNotificationService` dedupes
  per-recipient, a retry of the whole trigger re-scans everyone (correct but
  O(N) wasteful) or partially completes (some tenants never notified, since the
  trigger has no resumable cursor). The master plan §5.3 _does_ list it under
  Cloud Tasks, contradicting the notification domain's "recommend." This is an
  unresolved contradiction on a must-deliver path.
- **Resolution:** Commit platform-announcement fan-out to the Cloud Tasks
  paginated pattern (one task per page of recipients, cursor-checkpointed, each
  page idempotent on `(announcementId, pageCursor)`), not a single trigger.
  Tenant-scope announcements (bounded recipient count) may stay a single
  outbox-drained fan-out. Make the master plan and the notification domain
  agree, and state the page size + checkpoint doc so a mid-fan-out failure
  resumes rather than restarts.

---

## A14 — Leaderboard is written by multiple trigger paths (gamification + analytics orchestrator) to the same RTDB nodes with no stated single-writer or last-writer reconciliation

- **Severity:** MINOR
- **Where:** `SDK-LAYERS-PLAN.md` §2.4 gamification triggers
  (`onProgressSummaryWrite_updateLeaderboard`,
  `onStoryPointProgressWrite_updateLeaderboard` "all in functions/analytics") +
  `upsertLeaderboardEntry (internal ⚷)`; `analytics.md` §services
  `updateLeaderboardService` + `recomputeOrchestratorService` ("class-summary →
  leaderboard → milestone-notify"); `transport-realtime.md` leaderboard RTDB
  subscription.
- **Problem:** The leaderboard RTDB nodes
  (`tenantLeaderboard`/`courseLeaderboard`/`storyPointLeaderboard`) are written
  by: (a) `progressUpdaterService` ("RTDB leaderboard sync" — testsession
  §services), (b) the gamification `*_updateLeaderboard` triggers, and (c) the
  analytics `recomputeOrchestrator`'s leaderboard step. That is three writers to
  one derived projection, violating the single-writer invariant the plan
  elsewhere insists on. RTDB has no transactions across multi-node rank
  recomputation, so concurrent rank rewrites can interleave and produce an
  inconsistent ranking (two entries with the same rank, or a stale rank
  surviving). The plan never names _the_ single leaderboard writer;
  `upsertLeaderboardEntry` and `updateLeaderboardService` appear to be the same
  function under two names, and `progressUpdater` also claims to sync it.
- **Resolution:** Designate exactly one leaderboard writer (recommend
  `updateLeaderboardService`, invoked _only_ from `recomputeOrchestrator`'s
  ordered step), and remove the inline "RTDB leaderboard sync" from
  `progressUpdater` (it should instead set the recompute marker that the
  orchestrator consumes). Use RTDB transactions (`runTransaction` on the
  leaderboard node) or a single-entry upsert + periodic rank recompute so
  concurrent score updates don't corrupt ranks. State this in §5.3's
  single-writer list (leaderboards are named there but the multi-trigger reality
  contradicts it).

---

## A15 — `cleanupStaleSessions`, `expireTestSessions`, and `onTestSessionExpired` overlap in responsibility without a stated boundary, risking conflicting terminal transitions

- **Severity:** MINOR
- **Where:** `testsession-progress.md` §schedulers (`expireTestSessions` every 5
  min → `expireAndGradeSessionService`; `cleanupStaleSessions` hourly → marks
  `in_progress >24h` as `abandoned`) + §triggers `onTestSessionExpired`.
- **Problem:** Three mechanisms transition a non-terminal session:
  `expireTestSessions` (past deadline → `expired`+grade), `cleanupStaleSessions`
  (>24h → `abandoned`), and `onTestSessionExpired` (a trigger, but the plan says
  expiry "is a single-writer service so the scheduler and any manual reaper
  share one path" — implying the trigger and scheduler both fire
  `expireAndGradeSessionService`). A session past its deadline _and_ >24h old
  qualifies for both `expireTestSessions` (→expired+graded) and
  `cleanupStaleSessions` (→abandoned). The `testSession` transition table allows
  `in_progress→[completed,expired,abandoned]`, so both are individually valid,
  but they produce **different terminal states with different side effects**
  (expired grades the answers; abandoned presumably does not). Which wins is a
  race on which scheduler runs first; nothing orders them or makes
  `cleanupStaleSessions` skip past-deadline sessions (which should be graded,
  not abandoned).
- **Resolution:** State the precedence: `cleanupStaleSessions` must only abandon
  sessions that are stale **and never had a deadline** (or are past deadline but
  already failed grading); a past-deadline session is always `expired`+graded,
  never `abandoned`. Funnel both schedulers through the one transition-claim
  writer (A8) so the first to claim wins and the second reads the terminal
  status and no-ops. Clarify whether `onTestSessionExpired` is a real Firestore
  trigger (on what event?) or just the shared service name — if it's a trigger,
  name its event; if not, drop it from the trigger list to avoid implying a
  fourth path.

---

## Summary table

| ID  | Severity | Theme                                                                                                           |
| --- | -------- | --------------------------------------------------------------------------------------------------------------- |
| A1  | BLOCKER  | Idempotency dedupe non-atomic → double-execution of create-external-state callables                             |
| A2  | MAJOR    | UUIDv7 transport key vs domain idempotency key — two incompatible dedupe identities                             |
| A3  | MAJOR    | AI-grading fan-out has no completion reducer / single finalizer; progress race                                  |
| A4  | MAJOR    | Two SUBSCRIPTIONS typed with no source descriptor + a name schism (registry≠sources)                            |
| A5  | MAJOR    | `examGrading` live query listener, no maintained aggregate, no single-writer                                    |
| A6  | MAJOR    | Outbox _write_ specified; outbox _drain_ (retry/DLQ/exactly-once) unspecified                                   |
| A7  | MAJOR    | "Single-writer" asserted as single-code-path, not serialized writes; no tx/queue mechanism stated               |
| A8  | MAJOR    | submit vs expire scheduler can double-grade (separate guards, no shared session lock)                           |
| A9  | MINOR    | Countdown trusts RTDB offset estimate; two sources of `remainingMs` can disagree                                |
| A10 | MAJOR    | Duplicate `useSubscription` definitions; realtime→cache reconciliation contract missing                         |
| A11 | MINOR    | Optimistic `recordItemAttempt` vs best-score reconcile/refetch underspecified                                   |
| A12 | MINOR    | Offline queue gated to callables; scanner's 2-step Storage+ingest not replayable; no ordering/conflict contract |
| A13 | MINOR    | Platform-announcement fan-out: single trigger vs Cloud Tasks contradiction on a must-deliver path               |
| A14 | MINOR    | Leaderboard written by 3 paths; no single-writer / RTDB rank-consistency mechanism                              |
| A15 | MINOR    | expire vs cleanup vs onTestSessionExpired overlap → conflicting terminal transitions                            |
