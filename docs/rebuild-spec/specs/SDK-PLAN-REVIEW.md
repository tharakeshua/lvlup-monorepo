# SDK-PLAN-REVIEW — Consensus Arbitration (FROZEN-CANDIDATE)

> **Role:** Consensus arbiter over the 8 perspective reviews in
> `sdk-plan/review/*.md` (security-trust, correctness-datamodel, dx-ergonomics,
> perf-caching, async-realtime-offline, testability, ui-coverage, migration).
> This doc de-duplicates the 100 raised findings into distinct issues, decides
> ACCEPT-FIX / ACCEPT-DEFER / REJECT for each, gives the exact plan change for
> every ACCEPT-FIX, logs dissent, and issues the gate recommendation.
>
> **Inputs:** `SDK-LAYERS-PLAN.md` (master, §1–§9), `SDK-SERVER-DESIGN.md`,
> `common-api.md`, `status/REVIEW-domain-data-model.md`, all
> `sdk-plan/layers/*.md`, `sdk-plan/domains/*.md`, `sdk-plan/coverage/*.md`,
> `SDK-UI-COVERAGE-MATRIX.md`.

---

## 1. Executive summary

The package layering, trust-cake direction, and contract-as-SSOT thesis are
**sound and worth building**. The non-negotiable principles are mostly _named_
in the right places. But the FROZEN-CANDIDATE is **not yet freezable**: 15
BLOCKER-class findings converge on a small number of real structural holes, and
several "resolved" claims (D6, §9 100%-coverage, "dual-run via versioning",
"every list paginates") are aspirational rather than realized.

The findings collapse into **9 BLOCKER clusters** and a long tail of MAJOR/MINOR
refinements:

1. **Realtime read path has no server authority or projection** (SEC-01/02 +
   PC-1/2 + A4/A5 + T12) — subscriptions read raw fat Firestore docs
   client-side; grading scores leak pre-release; two subs have no source; no
   aggregate doc; Firestore/Storage rules are declared out-of-scope while being
   the _only_ enforcement for the subscribe + Storage surfaces. **The single
   largest cluster.**
2. **§9 C1–C31 are orphaned** (UC-1/UC-2 + SEC-03 + M12) — 24 gap-closing
   callables exist only in §9 and the matrix; absent from CALLABLES,
   INVALIDATION_GRAPH, ACCESS_RULES, every domain plan, and the transport layer.
   C1 (Storage) needs a Transport-contract change and hardened rules. The
   "100%-covering → PASS" verdict is premature.
3. **domain-entities.md does not exist** (CD11 + CD10 + M8) — the authoritative
   entity-schema layer the trust-cake "unblocks everything" on, including the
   `UnifiedItem.payload` discriminated union, is deferred to a file that was
   never written. The union as described cannot bind in Zod.
4. **Transition tables / enums contradict across docs** (CD1/CD2/CD3 + CD9 +
   T10) — testSession, tenant enums are defined 3 ways; 5 of 9 transition
   machines are missing from domain-core; these `satisfies` assertions will fail
   `tsc` — the exact build-time check the plan advertises.
5. **evaluateAnswer leaks the ⚷ cost field** (CD4) — response returns
   `UnifiedEvaluationResult` (carries `costUsd`) in one doc, `StoredEvaluation`
   in another; the strict response that ships is load-bearing and one variant
   violates §6.5.
6. **Idempotency dedupe is non-atomic** (A1 + A2 + CD6) — two-phase begin/commit
   with no transactional claim → double-execution of
   purchase/submission/org-user under retry; the `IDEMPOTENCY_CONFLICT` code is
   never wired; transport UUID vs domain-key dedupe is unreconciled.
7. **DomainName registry can't type-check** (DX-1 + DX-15) — the union omits ~16
   factories the plan needs; `QUERY_KEYS satisfies Record<DomainName,…>` and the
   totality test fail as written.
8. **Async single-writer is asserted, not mechanized** (A3/A7/A8/A14/A15 + T4) —
   "single-writer" conflates single-code-path with serialized-writes; no
   tx/queue on the hot progress/leaderboard docs; submit-vs-expire can
   double-grade; AI fan-out has no finalizer.
9. **Migration has no deploy mechanism** (M1 + M3 + M11) — "dual-run via `v1.*`
   names" has no alias/deploy story; `shared-stores` reactive auth (live
   `onSnapshot`) is entirely unplanned; no consolidated, ordering-aware
   data-backfill runbook for the 8 named at-rest migrations.

A surrounding tier of MAJOR findings (outbox drain, coarse invalidation,
unpaginated lists, save\* overload, repositories/seed having no layer plan,
token-revocation enforcement, impersonation under-spec,
.strict()-vs-legacy-data) must also be fixed or explicitly deferred before
freeze.

**None of the 15 BLOCKERs is rejected. All are ACCEPT-FIX.** The plan is a
strong skeleton with real holes; the holes are addressable with the changes
below, but they are pre-freeze work, not post.

---

## 2. Per-perspective verdicts

| Perspective            | Verdict         | Headline                                                                                                                                               |
| ---------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| security-trust         | **BLOCK**       | Realtime subscribe + Storage read paths have no server authority; rules out-of-scope while being the sole enforcement (SEC-01/02).                     |
| correctness-datamodel  | **BLOCK**       | Enum/transition/response contradictions that fail the very `tsc`/`.strict()` net the plan relies on; domain-entities.md missing (CD1–CD4, CD10, CD11). |
| dx-ergonomics          | **BLOCK**       | DomainName registry can't compile (DX-1); plus save\* overload, raw-client escape hatch, untyped fanout.                                               |
| perf-caching           | **CONDITIONAL** | D6 fat-doc hedges unresolved on the hottest docs; coarse invalidation storms; several lists unpaginated (PC-1/3/4/5/13).                               |
| async-realtime-offline | **CONDITIONAL** | Idempotency non-atomic (A1); single-writer not mechanized; outbox drain unspecified; subscriptions inconsistent.                                       |
| testability            | **CONDITIONAL** | Contract-test fixture mechanism, seed plan, repositories plan, trigger/async tests all absent (T1–T4).                                                 |
| ui-coverage            | **BLOCK**       | §9 closure declared not delivered; C1/C2 hard-blockers unresolved; tallies don't reconcile (UC-1/2).                                                   |
| migration              | **CONDITIONAL** | No live→v1 deploy mechanism; shared-stores unplanned; no backfill runbook (M1/M3/M11).                                                                 |

**Aggregate gate: BLOCK (CONDITIONAL-PASS pending the ACCEPT-FIX worklist).**

---

## 3. Consolidated findings table

Merged-finding id · severity · perspectives that raised it · decision. Severity
is the arbiter's final severity (may differ from a single perspective's).

| Merged id                                                              | Sev         | Raised by                          | Decision                                              |
| ---------------------------------------------------------------------- | ----------- | ---------------------------------- | ----------------------------------------------------- |
| **MERGE-REALTIME-AUTHORITY** (SEC-01, SEC-02, PC-1, PC-2, A4, A5, T12) | BLOCKER     | security, perf, async, testability | ACCEPT-FIX                                            |
| **MERGE-C9-ORPHANED** (UC-1, UC-2, SEC-03, M12)                        | BLOCKER     | ui-coverage, security, migration   | ACCEPT-FIX                                            |
| **MERGE-DOMAIN-ENTITIES** (CD11, CD10, M8)                             | BLOCKER     | correctness, migration             | ACCEPT-FIX                                            |
| **MERGE-TRANSITIONS** (CD1, CD2, CD3, CD9, T10)                        | BLOCKER     | correctness, testability           | ACCEPT-FIX                                            |
| **CD4** evaluateAnswer leaks costUsd                                   | BLOCKER     | correctness                        | ACCEPT-FIX                                            |
| **MERGE-IDEMPOTENCY** (A1, A2, CD6)                                    | BLOCKER     | async, correctness                 | ACCEPT-FIX                                            |
| **MERGE-DOMAINNAME** (DX-1, DX-15)                                     | BLOCKER     | dx                                 | ACCEPT-FIX                                            |
| **MERGE-SINGLE-WRITER** (A7, A3, A8, A14, A15, T4)                     | BLOCKER     | async, testability                 | ACCEPT-FIX                                            |
| **MERGE-MIGRATION-CUTOVER** (M1, M2, M3, M10, M13)                     | BLOCKER     | migration                          | ACCEPT-FIX                                            |
| **T1** contract-test fixture mechanism                                 | BLOCKER     | testability                        | ACCEPT-FIX                                            |
| **T2** seed engine has no plan                                         | BLOCKER     | testability                        | ACCEPT-FIX                                            |
| **MERGE-OUTBOX-DRAIN** (A6, A13)                                       | MAJOR       | async                              | ACCEPT-FIX                                            |
| **MERGE-INVALIDATION-COARSE** (PC-5, DX-9)                             | MAJOR       | perf, dx                           | ACCEPT-FIX                                            |
| **MERGE-PAGINATION** (PC-4, PC-3, PC-12)                               | MAJOR       | perf                               | ACCEPT-FIX                                            |
| **MERGE-D6-FATDOC** (PC-13, CD14)                                      | MAJOR       | perf, correctness                  | ACCEPT-FIX                                            |
| **MERGE-REPOSITORIES-PLAN** (DX-6, T3, DX-14, T6)                      | MAJOR       | dx, testability                    | ACCEPT-FIX                                            |
| **DX-5** save\* overload folds lifecycle                               | MAJOR       | dx                                 | ACCEPT-FIX                                            |
| **DX-8** raw api-client escape hatch ungated                           | MAJOR       | dx                                 | ACCEPT-FIX                                            |
| **MERGE-NOTIF-FACADE** (DX-4, UC-3)                                    | MAJOR       | dx, ui-coverage                    | ACCEPT-FIX                                            |
| **SEC-05** token revocation not mechanized                             | MAJOR       | security                           | ACCEPT-FIX                                            |
| **MERGE-IMPERSONATION** (SEC-04, UC-12)                                | MAJOR       | security, ui-coverage              | ACCEPT-FIX                                            |
| **SEC-09** geminiApiKey inbound path unpinned                          | MAJOR       | security                           | ACCEPT-FIX                                            |
| **MERGE-PARENT-GATE** (UC-6)                                           | MAJOR       | ui-coverage                        | ACCEPT-FIX                                            |
| **UC-7** saveTestAnswer not integrated                                 | MAJOR       | ui-coverage                        | ACCEPT-FIX                                            |
| **UC-8** generateContent quota / assignContent shape                   | MAJOR       | ui-coverage                        | ACCEPT-FIX                                            |
| **UC-4** auth seam C3 mis-severitied                                   | MAJOR       | ui-coverage                        | ACCEPT-FIX                                            |
| **MERGE-MIGRATION-PARITY** (M4, M5, M7, M11)                           | MAJOR       | migration                          | ACCEPT-FIX                                            |
| **T5** authorize per-rule correctness untested                         | MAJOR       | testability                        | ACCEPT-FIX                                            |
| **T7** CI gate / package inventory drift                               | MAJOR       | testability                        | ACCEPT-FIX                                            |
| **A10** duplicate useSubscription + cache reconcile                    | MAJOR       | async, dx (DX-15)                  | ACCEPT-FIX                                            |
| **DX-3** add-a-callable touches 9 edits / 7 pkgs                       | MAJOR       | dx                                 | ACCEPT-DEFER                                          |
| **DX-2** parentKeys defined twice / dup callables                      | MAJOR       | dx                                 | ACCEPT-FIX                                            |
| **CD5** submitTestSession request self-contradicts                     | MAJOR       | correctness                        | ACCEPT-FIX                                            |
| **CD7** effectiveRubric naming inconsistent                            | MAJOR       | correctness                        | ACCEPT-FIX                                            |
| **CD8** Announcement.readBy[] re-introduces drift                      | MAJOR       | correctness                        | ACCEPT-FIX                                            |
| **CD13** recordItemAttempt shapes disagree                             | MINOR→MAJOR | correctness                        | ACCEPT-FIX                                            |
| **PC-6** residual per-child getChildSummary N+1                        | MINOR       | perf                               | ACCEPT-DEFER                                          |
| **PC-7** at-risk teacherUids/parentUids denorm                         | MINOR       | perf                               | ACCEPT-FIX                                            |
| **PC-8** listSubmissions denorm fields unowned                         | MINOR       | perf                               | ACCEPT-FIX                                            |
| **PC-9** platform-summary aggregation undecided                        | MINOR       | perf                               | ACCEPT-FIX                                            |
| **PC-10** getPerformanceTrends on-the-fly scan                         | MINOR       | perf                               | ACCEPT-DEFER                                          |
| **PC-11** uniform 30s staleTime on aggregations                        | MINOR       | perf                               | ACCEPT-FIX                                            |
| **PC-14** view-repo "one call" is N round-trips                        | MINOR       | perf                               | ACCEPT-FIX                                            |
| **PC-15** in-batching is O(N/10) presented as no-N+1                   | MINOR       | perf                               | ACCEPT-FIX                                            |
| **SEC-03** Storage path read-scope predicate                           | MAJOR       | security                           | ACCEPT-FIX (folded into MERGE-C9-ORPHANED resolution) |
| **SEC-06** lookupTenantByCode enumeration oracle                       | MINOR       | security                           | ACCEPT-FIX (doc-only)                                 |
| **SEC-07** tenantOverride audit best-effort                            | MINOR       | security                           | ACCEPT-FIX                                            |
| **SEC-08** badge-decrement touches ⚷ counter                           | MINOR       | security                           | ACCEPT-FIX (doc/test-only)                            |
| **SEC-10** getItemForEdit logout purge                                 | MINOR       | security                           | ACCEPT-FIX                                            |
| **CD12** autograde drops tenantId from entity                          | MINOR       | correctness                        | ACCEPT-FIX                                            |
| **CD15** SDK-SERVER "17 brands" / AuthContext drift                    | MINOR       | correctness                        | ACCEPT-FIX                                            |
| **DX-7** hook-naming exceptions                                        | MINOR       | dx                                 | ACCEPT-DEFER                                          |
| **DX-10** error-handling default surprises                             | MINOR       | dx                                 | ACCEPT-FIX                                            |
| **DX-11** SaveResponse shape inconsistent                              | MINOR       | dx                                 | ACCEPT-FIX                                            |
| **DX-12** ApiProvider ambient-detect hand-wavy                         | MINOR       | dx                                 | ACCEPT-FIX                                            |
| **DX-13** list vs infinite hook ergonomics                             | MINOR       | dx                                 | ACCEPT-DEFER                                          |
| **A9** countdown trusts RTDB offset estimate                           | MINOR       | async                              | ACCEPT-FIX (doc-only)                                 |
| **A11** optimistic recordItemAttempt reconcile                         | MINOR       | async                              | ACCEPT-FIX                                            |
| **A12** offline queue contract / 2-step upload                         | MINOR       | async                              | ACCEPT-DEFER                                          |
| **T8** no-tenantId walker depth blind spot                             | MINOR→MAJOR | testability                        | ACCEPT-FIX                                            |
| **T9** optimistic-allow-list flag name + freshness                     | MINOR       | testability                        | ACCEPT-FIX                                            |
| **T11** RN-purity gate duplicated per-package                          | MINOR       | testability                        | ACCEPT-FIX                                            |
| **UC-5** coverage tally arithmetic inconsistent                        | MAJOR→MINOR | ui-coverage                        | ACCEPT-FIX (doc-only)                                 |
| **UC-9** scanner offline-queue decision open                           | MINOR       | ui-coverage                        | ACCEPT-FIX (decision)                                 |
| **UC-10** registerDeviceToken module ownership                         | MINOR       | ui-coverage                        | ACCEPT-FIX                                            |
| **UC-11** answer-key cache scope (positive control)                    | —           | ui-coverage                        | REJECT (no finding; close open-Q)                     |
| **M9** shared-services decomposition map                               | MINOR       | migration                          | ACCEPT-FIX                                            |

---

## 4. Resolution detail for every ACCEPT-FIX

Exact plan change to apply. (Grouped by cluster; severity in brackets.)

### BLOCKER resolutions

**MERGE-REALTIME-AUTHORITY [BLOCKER]** — _§3.3 SUBSCRIPTIONS,
transport-realtime.md, autograde.md, common-api §1 Non-Goals._ The realtime read
path must become authority-equivalent to the callable read path. Apply: (1)
Every subscription targets a **server-maintained slim projection doc/node**,
never the authoritative fat doc — `gradingStatus`→a `submissions/{id}/live`
mirror that omits `summary.totalScore/grade` until `resultsReleased`;
`examGrading`→a single `tenants/{t}/examGradingProgress/{examId}` aggregate doc
written by `advancePipeline`/`finalizeSubmission` (O(1) per tick, not
O(submissions)); `spaceProgressLive`→a slim live mirror, and the service must
verify `userId∈ctx.studentIds`/self at projection-write time. (2) Drop
`summary`/score/grade/percentage from `SubmissionStatusSchema` — keep
`{pipelineStatus,gradingProgress,updatedAt}`. (3) Add the invariant "**no
subscription may target a fat doc, an unbounded collection of fat docs, or any
doc containing ⚷ fields**" to the subscription-registry checklist, with a
contract+rules test that a non-released submission's score is unreadable by a
student subscriber and that no SUBSCRIPTIONS payload doc contains
answer-key/guidance/cost fields. (4) **Promote the Firestore + Storage
security-rules rewrite from Non-Goal to an in-scope deliverable**: add
`sdk-plan/layers/security-rules.md`, generated from the same key registries
(`TENANT_ROLES`, `ALLOWED_TRANSITIONS`, the §6 authority list, ACCESS_RULES) so
rules and `@levelup/access` cannot drift; deny-by-default; explicit per-path
predicates for every subscription-read doc and every Storage object; answer-key
subcollection `read,write:if false`; emulator rules tests as a required CI gate.
(5) Reconcile SUBSCRIPTIONS (9) with SUBSCRIPTION_SOURCES (7): add
descriptors+named producers for `studentLevelLive` and `achievementUnlock`,
resolve the `leaderboardLive` vs `analytics.leaderboard` name schism to one
canonical name, and make the `⊇` coverage test green (not aspirational). Add
per-source decode tests incl. the RTDB epoch-ms fence and `__tenant__`/`__uid__`
placeholder-resolution-cannot-widen-tenant test (T12).

**MERGE-C9-ORPHANED [BLOCKER]** — _§9 C1–C31; §3.2/§4.1/§4.2/§4.3/§5.4;
domains/\*; transport-realtime.md._ Treat §9 as a worklist, not a closure.
Before freeze: (a) fold every C1–C31 callable into §3.2 CALLABLES with a full
`CallableDef`; (b) add each repo/hook to §4.1/§4.2, each mutating callable to
§4.3 INVALIDATION_GRAPH and §5.4 ACCESS_RULES; (c) write each into its owning
per-domain plan's entity/callable/repo/hook/service tables; (d) add the Storage
seam. **C1 specifically:** extend the `Transport` interface with an explicit
`requestUploadUrl`/`upload` capability (or a `StorageTransport` seam) documented
in transport-realtime.md; pick **signed-PUT-URL** as the canonical mechanism
(server-enforced path scope, REST-ready); specify the exact Storage path grammar
and the **read+write predicate per kind** (answer-sheet
`tenants/{t}/exams/{examId}/submissions/{id}/…` readable only by
teacher-of-class / owning-student-after-release / super-admin; avatar
`tenants/{t}/users/{uid}/avatar` writable only by `uid`);
`requestUploadUrlService` validates `studentId/classId∈ctx` (scanner) and
`uid===ctx.uid` (avatar); pin signed-URL TTL ≤10 min and enforce
contentType/max-bytes at sign time; specify the byte-upload↔`uploadAnswerSheets`
ordering, the shared idempotencyKey, and orphan-path cleanup; write the hardened
Storage rules in the SEC-02 rules layer (this folds SEC-03). Add a contract test
that every callable in §3.2 CALLABLES is present in common-api.md and vice-versa
so this drift can't recur.

**MERGE-DOMAIN-ENTITIES [BLOCKER]** — _domain-core.md §0/§1/§10 (defers to
non-existent domain-entities.md); CD10; M8._ Author
`sdk-plan/layers/domain-entities.md` before freeze with the concrete `.strict()`
Zod for at least: the **two-level** `UnifiedItemSchema.payload`
(`z.discriminatedUnion('type', …)` over the 7 ItemTypes, each member's `payload`
a nested `z.discriminatedUnion` on its own `questionType`/`materialType`/… — OR
flatten so every payload member carries a single normalized `kind` literal; the
master plan's single-key `z.discriminatedUnion('questionType')` is wrong for
non-question items and must be replaced); the answer-bearing fields stripped to
`AnswerKeySchema`; `effectiveRubric`/`rubricId`; `StoredEvaluationSchema` (the
cost-stripped projection, see CD4); and `DigitalTestSessionSchema` with the
`submissions/{itemId}` subcollection boundary. Reconcile its enums against
domain-core so the `satisfies` assertions compile. **M8 read-path leniency:**
add a one-time validation/repair pass over the legacy `items` corpus (which was
written under `z.record(unknown)` and never validated) that reports/quarantines
payloads failing the new union; legacy items that fail must surface as a typed
"needs-migration" state, not crash the editor. Keep the shared Evaluation/Rubric
core schemas unchanged.

**MERGE-TRANSITIONS [BLOCKER]** — _domain-core.md §7.2/§7.5; §3.6; identity.md;
autograde.md; CD9; T10._ (1) Canonicalize one tuple per status enum in
domain-core and make every other doc cite it:
`TEST_SESSION_STATUSES=['in_progress','completed','expired','abandoned']` (drop
submitted/graded; update domain-core §7.2 L511);
`TENANT_STATUSES=['trial','active','suspended','expired','deactivated']` (5
members, update domain-core §7.2 L512 to match identity + the transition table).
(2) Add the **five missing transition machines** to `domain-core/transitions/`
and the `ALLOWED_TRANSITIONS` aggregate: `question-grading.ts`, `tenant.ts`,
`membership.ts`, `announcement.ts`, `entity-status.ts`, each
`satisfies TransitionMap<…>`, with explicit enums (`QUESTION_GRADING_STATUSES`,
`MEMBERSHIP_STATUSES`, `ANNOUNCEMENT_STATUSES`, `ENTITY_STATUSES`); update the
§1 file tree and §7.5 aggregate; widen `TransitionDomain` so identity/autograde
call sites type-check. (3) Resolve the announcement `archived→[]` (master §3.6)
vs `archived→{draft}` (identity §64) schism — adopt `archived→[draft]`, update
master §3.6 L256; and reconcile D5 "announcements truly delete" with the
existence of `archived` status (state once whether `delete?=true` archives or
hard-deletes). (4) Parameterize `transitions.assertion.test.ts` over **all
nine** machines and over the **7** entityStatus-consuming enums (each must
`==={active,archived}`); add a toggle-consistency assertion (no edge references
an excluded `'completed'`/OCR member).

**CD4 [BLOCKER]** — _levelup-content.md L60 vs §3.2 L206 vs §6.5._ Make
`evaluateAnswer` and the per-item projection of `submitTestSession` return
`StoredEvaluation` everywhere; delete the `UnifiedEvaluationResult` response in
levelup-content L60. Define `StoredEvaluationSchema` (answer-stripped,
**cost-stripped**) in domain-entities.md, and add a contract test asserting no
client-facing response schema embeds `UnifiedEvaluationResultSchema` (parallel
to the no-answer-key test).

**MERGE-IDEMPOTENCY [BLOCKER]** — _server-shared §2.7; api-client-core §3.5; A2;
CD6._ (1) Specify `dedupe.begin` as a **Firestore transaction that creates**
`tenants/{t}/idempotency/{uid}_{key}` with status `in_flight`+lease/TTL; on
create-contention return the committed response if `status==committed`, else
throw `IDEMPOTENCY_CONFLICT` if an unexpired in-flight lease exists, else
reclaim a stale lease. `commit` flips `in_flight→committed` in the same doc.
Wire `IDEMPOTENCY_CONFLICT` into `mapError` + `DEFAULT_RETRYABLE`. Strengthen
server-shared §8 test #10: fire two concurrent identical idempotent calls,
assert **exactly one** service-body execution (count side effects). (2) Resolve
the dual dedupe identity: keep the api-client UUIDv7 `__idempotencyKey` as the
_transport-retry_ key, and add a per-callable
`idempotencyKey: 'transport' | 'domain:<fields>'` hint on `CallableDef`
(build-time visible) — submit dedupes on `sessionId`, evaluate on
`(spaceId,itemId,answerHash)`, record on
`(spaceId,storyPointId,itemId,attemptNumber)`; server dedupe key = domain key
when present else UUIDv7. (3) **Remove `idempotencyKey` from every request
_schema_** (it contradicts envelope injection and re-opens forgeable keys under
`.strict()`); rely on `idempotent:true` + the envelope; add a contract test that
no `.strict()` request schema declares `idempotencyKey` (mirror of no-tenantId).
Update all domain tables.

**MERGE-DOMAINNAME [BLOCKER]** — _query-infra §4.1/§4.2; §4.2 master._ Make
`DomainName` the single exhaustive source; add the ~16 missing roots
(`testSessions`, `questionSubmissions`, `deadLetter`, `examAnalytics`,
`gradingReview`, `userSearch`, `summary`, `trends`, `leaderboard`,
`gamification`, `achievements`, `levels`, `studyGoals`, `studySessions`,
`studentSummary`, `enrollment`, plus the C1–C31 roots). Reconcile the §4.2
factory list and the query-infra union in one table. Add the contract test that
`keyof typeof QUERY_KEYS === DomainName` AND every INVALIDATION_GRAPH root ∈
DomainName, and make it pass against the _real_ inventory. Define
`subscriptionKey` as derived from the matching domain key (or require an
explicit `onPayload` targeting a domain key) with a documented
subscription→query-key mapping table; add a test that every SUBSCRIPTIONS entry
has a declared target key factory (DX-15).

**MERGE-SINGLE-WRITER [BLOCKER]** — _§5.3; testsession-progress.md;
analytics.md; A3/A8/A14/A15; T4._ Redefine "single-writer" in §5.3 as
**serialized writes**, and state the mechanism per derived value: (a)
`progressUpdater` performs all aggregate mutations inside `ctx.repos.tx()`
(read-modify-write on the aggregate doc; Firestore aborts+retries on contention)
— covers the A3 N-concurrent-AI-item race; (b) introduce a **session-grading
reducer** (Cloud Tasks handler, decrementing `pendingAiItems` counter on the
session doc) that finalizes status/percentage and fires the single "graded"
outbox notification exactly when the counter hits 0 (mirrors autograde
`advancePipeline`+`finalizeSubmission`); (c) `recomputeOrchestrator` enqueues
with Cloud Tasks `dedupeId=(tenantId,studentId)`+debounce; marker cleared
transactionally at run start, re-checked at end; (d) **submit-vs-expire (A8):**
both `submitTestSessionService` and `expireAndGradeSessionService` claim the
session by transitioning `in_progress→<terminal>` inside a transaction as their
first step — winner grades, loser reads the terminal status and returns the
already-computed result; `cleanupStaleSessions` must skip past-deadline sessions
(A15 precedence); (e) **leaderboard (A14):** designate exactly one writer
(`updateLeaderboardService`, invoked only from `recomputeOrchestrator`'s ordered
step), remove the inline RTDB sync from `progressUpdater` (it sets the recompute
marker instead), use RTDB `runTransaction` on the node. Add
`triggers-async.contract.test.ts` (T4): per reducer — deliver twice→one effect;
out of order→correct final state; two concurrent→no lost update; outbox row iff
state write commits; run the **same** reducer path in emulator that runs in
prod.

**MERGE-MIGRATION-CUTOVER [BLOCKER]** — _common-api §11; §7 build order;
M1/M2/M3/M10/M13._ (1) Add an explicit live→v1 cutover mechanism: **export each
service under BOTH the bare legacy name and the `v1.*` name** from the same
`functions/*` index for one dual-export release, with a contract test that the
legacy-alias map is exhaustive over the live deployed-name list; drop bare names
in a later release. Remove the "dual-run is unnecessary / alias" hand-wave. (2)
Add a migration-sequencing section naming the cutover unit (callable-group,
protected by the dual-export window) so apps adopt v1 hooks one query at a time.
(3) **shared-stores:** add to the migration inventory; either add a
`v1.identity.meLive` subscription (firestore-doc on `/users/{uid}` projecting
`{activeTenantId,status,claimsVersion}`) so reactive revocation/active-tenant
survives, OR explicitly document that live auth-state is dropped and replaced by
`getMe` refetch on `switchActiveTenant`+token-expiry (only with security
sign-off, ties to SEC-05); define how `activeTenantId` flows once the store is
gone (tenant-implicit query root, full `qc.clear()` on switch) and confirm all
teacher-web call sites drop the `tenantId` arg. (4) **Split step 5 (M10)** into
gated sub-phases: 5a extract `onCall`→`fn(input,ctx)` behavior-preserving
(tenantId via ctx shim, emulator asserts identical output); 5b flip
tenantId→claims per callable behind dual-export; 5c introduce
single-writer/outbox/Cloud-Tasks invariants per derived value with double-fire
tests; 5d consolidate the 4 notification senders + 4-writer recompute. Require
the emulator contract suite green per callable before its legacy alias drops.
(5) **Semantically-changed callables (M13):** keep the legacy bare
`evaluateAnswer` alias pointing at a behavior-preserving (no progress-write)
shim; only `v1.levelup.evaluateAnswer` carries the progress write — do NOT alias
semantically-changed callables; document the closed set requiring atomic client
adoption.

**T1 [BLOCKER]** — _contract-test fixture mechanism._ Add a `contract-tests`
section specifying: a per-callable `*.fixture.ts` (valid request sample + named
seed-state precondition); make `registry-integrity.test.ts` fail if any callable
lacks a fixture; a single seeded "contract tenant" (deterministic ids, T2) every
contract test runs against, with documented write-before-read ordering; drive
the loop from `CALLABLE_NAMES`; response validation uses
`def.responseSchema.parse(liveResponse)` on emulator output.

**T2 [BLOCKER]** — _seed engine has no plan._ Author `sdk-plan/layers/seed.md`:
config-keyed deterministic ids (`seedId(kind,key)`→stable branded id, no
randomness); idempotency = upsert-by-stable-id with a re-run=no-op invariant +
`seed.idempotency.test.ts`; **claims built via the shared membership→claims
path** (assert seed claims === `syncMembershipClaims` output for the same
membership — no second claim-builder); injected fixed clock; emulator-vs-prod
env switch sharing one write path; a `seed.determinism.test.ts` snapshotting the
produced Firestore tree.

### MAJOR resolutions

**MERGE-OUTBOX-DRAIN [MAJOR]** (A6, A13) — _server-shared §2.8;
notification.md._ Specify the drain as a concrete worker: `onCreate` on
`tenants/{t}/outbox/{id}` (or 1-min sweep of `status==pending`) → deliver via
consumer service → on success `status=delivered`; on failure increment
`attempts` + reschedule with exponential backoff (Cloud Tasks
`scheduleDelaySec`); after N attempts `status=failed` + outbox dead-letter entry
surfaced to ops. State delivery is at-least-once and consumers dedupe (they do,
via `emitNotificationService`'s key). Add an emulator test: two throws then
success → one delivered effect, `attempts==3`. **Commit platform-announcement
fan-out to Cloud Tasks paginated** (one task per recipient page,
cursor-checkpointed, idempotent on `(announcementId,pageCursor)`); tenant-scope
stays a single outbox-drained fan-out; make master §5.3 and notification.md
agree.

**MERGE-INVALIDATION-COARSE [MAJOR]** (PC-5, DX-9) — _query-infra §5.1/§5.2;
§4.3._ Make `fanout`-present rules **suppress the coarse root** for that root
(invalidate precise keys only); reserve bare-root invalidation for
genuinely-unnarrowable cases. Distinguish `list`/`infinite`/`detail` kinds in
fanout. Add a graph-shape contract test: any rule dirtying a high-churn root
(`analytics`,`progress`,`submissions`) provides a `fanout` and does not also
list that root coarsely. **Promote the typed
`defineRule<N extends CallableName>(name, rule: InvalidationRule<ReqOf<N>>)`
builder from "deferred" to "required"** (removes `vars as any`, gives
compile-time field names); if deferral stands, strengthen the contract test to
drive each fanout with a real `ReqOf<N>` fixture and assert produced keys
reference fields that exist on the request schema, and state explicitly that the
current test does not catch wrong-field reads.

**MERGE-PAGINATION [MAJOR]** (PC-4, PC-3, PC-12) — _common-api §7;
levelup-content.md; autograde.md; api-contract-core §5._ Either add
`PageRequest`/`pageResponse` to every list callable (`listStoryPoints`,
`listQuestions`, `listQuestionSubmissions`, `listEvaluationSettings`,
`listAgents`, `listRubricPresets`) **or** add an explicit bounded-list
allow-list with a documented hard server cap (e.g. ≤200) and a contract test
that every list callable is paginated **or** in the allow-list with a declared
`maxItems`. `getClass`: return counts + first roster page
(`listStudents{classId}` pages the rest). **Chat (PC-3):** decide D6 —
`messages/` always a subcollection (never inline); add `PageRequest` to
`getChatSession` or a `listChatMessages` returning `pageResponse(ChatMessage)`;
keep `messageCount`/`previewMessage` denormalized. **`total` cost contract
(PC-12):** `total` populated only from a maintained counter, never a live
`.count()` per page; add a pagination test that no list service issues
`.count()` per `paginate()`.

**MERGE-D6-FATDOC [MAJOR]** (PC-13, CD14) — _§8 D6; testsession-progress.md;
levelup-content.md._ Convert the hedges to decisions:
`StoryPointProgressDoc.items`→per-item docs (or a hard documented item-count
cap); `SpaceProgress.storyPoints`→keep the summary doc small and bounded (one
numeric per story point, no nested per-item state) and explicitly cap it, with
the live listener targeting a slim projection; chat→always subcollection. Add a
contract/schema assertion that progress/session/chat docs have no unbounded
array/map field. Set a concrete element-count or byte threshold, not "if large";
close levelup-content open-Q #4 before freeze.

**MERGE-REPOSITORIES-PLAN [MAJOR]** (DX-6, T3, DX-14, T6) — _no repositories
layer plan exists._ Author `sdk-plan/layers/repositories.md` fixing: (1)
method-naming convention (`list`/`get`/`getMany`/`save`/`paginate` for IO;
`can*`/`is*` for boolean pre-checks; `compute*`/`resolve*` for derived; no other
verbs); (2) where View types are declared and how apps reach them without
importing `repositories` — recommend View response schemas live in
`api-contract` as the response shape of the view callables, `domain` re-exports
`z.infer`, apps import from `domain` (keeps R7 intact); (3) an explicit
path-scoped lint snippet proving the `views/**` import-siblings exception; (4) a
view-repo field-count cap/review-gate; (5) a `createRepositories(api)`
**fake-ApiClient test seam** and a test matrix (`getMany` chunking at
0/1/10/11/21; `paginate()` cursor threading + `nextCursor:null`; each view-repo
shaping vs a fixed wire fixture; each derived field;
`isSensitiveKey`/editor-cache-scope). **DX-14/PC-15:** client-side `getMany`
calls the batched read callable/view repo; the 10/30-id `in`-chunking lives
**server-side** in repository-admin (state chunks-of-10/30 + `Promise.all` + a
max-ids cap; beyond it the caller paginates); remove the `where('id','in',…)`
Firestore phrasing from the client-repo description (it implies client Firestore
access, contradicting principle 3). **T6:** specify
`createInMemoryRepos()`+`createFakeAiGateway()` in a `repository-admin/testing`
subpath with a **conformance suite run against both the in-memory fake and the
emulator-backed real repos** (same test file, two drivers) so the fake can't
diverge on `tx()`/cursor/brand-strip; name `fixedClock(iso)`.

**DX-5 [MAJOR]** — _save\* overload._ Keep `save*` for create/update of metadata
only and **split lifecycle into explicit verbs** (`publishSpace`,
`archiveSpace`, `publishExam`; `releaseResults` already exists) so the
`ALLOWED_TRANSITIONS` UX pre-check maps 1:1 to a button/callable and
authority-sensitivity tagging + optimistic granularity are clean. (If a fused
form is retained anywhere, model it as a real
`z.discriminatedUnion('op',[Create,Update,Transition])` so create requires its
fields.) Document the decision.

**DX-8 [MAJOR]** — _raw api-client escape hatch._ Remove `api` from the default
`useApi()` surface; expose `useApiClient` only from a separate
`@levelup/query/unsafe` entrypoint forbidden by `no-restricted-imports` in app +
domain-hook code (tiny audited allowlist), OR add a custom lint rule
`no-raw-api-in-hooks` mirroring `no-optimistic-on-authority`. Document the (~0
steady-state) sanctioned uses.

**MERGE-NOTIF-FACADE [MAJOR]** (DX-4, UC-3) — _§3.2; common-api §3.3; §8
open-Qs._ Decide explicit-split (per C2). **Delete `manageNotifications` from
the registry**; keep `listNotifications`/`getNotificationBadge`/
`markNotificationRead`/`getNotificationPreferences`/`saveNotificationPreferences`;
update query-infra §6.2

- the optimistic allow-list to reference `v1.identity.markNotificationRead`
  consistently; remove the line from §8 open questions. **Actually perform the
  C2 reconcile in common-api.md** (add the prefs callables; retire/clarify
  `manageNotifications`) and in domains/identity.md. (If a facade is wanted,
  build it as a `notificationCenterRepo` view method, not a second callable.)

**SEC-05 [MAJOR]** — _token revocation._ (a) Strengthen server-shared §8 test
#11 to assert any service changing `role`/`status`/`isSuperAdmin`/permissions
calls `revokeRefreshTokens(uid)` in the same transaction/outbox unit as the
claim rewrite (static+emulator). (b) Document+enforce a server-side
`auth_time`/`tokensValidAfterTime` check on every authority-sensitive callable
and in the Firestore/Storage rules (folds into the SEC-02 rules layer) so a
revoked user is locked out within the rules layer, not only after ~1h. (c) State
the revocation-lag SLO for the outbox fan-out; gate the most sensitive actions
(super-admin disable, tenant deactivate) on a **synchronous** revoke before
returning success.

**MERGE-IMPERSONATION [MAJOR]** (SEC-04, UC-12) — _§9.3 C28; identity.md._ Give
C28 a full sub-spec in identity.md: (a) use a dedicated `tenantOverride` (not
`tenantId`) field and add the def to the R11 super-admin whitelist explicitly
(or carry the target tenant out-of-band) — document the reconciliation against
the no-tenant-id rule; (b) audit write is **synchronous+transactional with token
mint (fail-closed)** + define the `ImpersonationAudit` record (actor, target,
tenant, reason, issuedAt, expiresAt, sessionId); (c) define the constrained
claim set: `impersonating:true`+`impersonatorUid`, `isSuperAdmin` forced false,
`authorize()` denies `claims.sync`/`membership.write`/all `tenant.*` platform
ops/nested impersonation while present; (d) add an impersonation-session ledger
doc + `endImpersonation`/auto-expiry that calls
`revokeRefreshTokens(targetUid)`, short TTL. Keep C25/C26/C31 as their own
severity tier; design `setUserStatus` (token revoke) and `savePlatformConfig`
(maintenance-mode enforcement points) with ACCESS_RULES + audit-event entries.

**SEC-09 [MAJOR]** — _geminiApiKey inbound._ In `saveTenantService`:
`geminiApiKey` consumed → `secretManager.put(secretNameFor(tenantId))` → field
**deleted from `input.data` before any repo write**, with a test that no
Firestore tenant doc/audit/LLM log ever contains a value matching the key.
Response-schema test that only `geminiKeyRef` (never `geminiApiKey`) is
returned. If C11 lands, gate `geminiApiKey` writes behind a distinct
`tenant.ai.key.write` action with explicit policy + mandatory audit; confirm
cost/quota stays server-enforced regardless of whose key it is.

**MERGE-PARENT-GATE [MAJOR]** (UC-6) — _§9.2 C16/C17/C18._ Specify for each the
exact `authorize()` action

- ownership predicate (`studentId∈ctx.studentIds`) + released/visibility
  predicate as an explicit conjunction, the parent-role projection
  (answer-key/guidance strip), and the canonical not-authorized vs not-found vs
  not-released response. Confirm `submission.readReleased` carries the parent
  ownership check; add a contract test for the parent-ownership × released-gate
  intersection.

**UC-7 [MAJOR]** — _C21 saveTestAnswer._ Integrate into
domains/testsession-progress.md: add the callable/hook to the inventory; define
the idempotency key `(sessionId,itemId,clientRevision)`, rate tier

- client debounce, post-deadline rejection
  (`INVALID_TRANSITION`/`PRECONDITION_FAILED`); confirm it shares the
  single-writer session-claim path (MERGE-SINGLE-WRITER) so a late write-through
  can't clobber a submitted/graded answer; keep on the NEVER-optimistic list and
  add to §4.4's never-optimistic enumeration. Reconcile CD5: `submitTestSession`
  request is `{sessionId,autoSubmitted?}` (write-through model wins); remove the
  `submissions` map from levelup-content's submit request.

**UC-8 [MAJOR]** — _C13/C12._ C13 `generateContent`: add to levelup-content.md
with an explicit AI quota class, cost-logging, moderation gate,
`aiGenerationRepo` (no auto-persist); add to §6.AI row. C12 `assignContent`:
**decide the shape** — denormalized fields on Space/Exam vs a first-class
`Assignment` junction entity (respecting D7); specify
fields/status/indexes/ACCESS_RULES once; do not ship "either/or" (tracker
columns depend on it).

**UC-4 [MAJOR]** — _C3 auth seam._ Reclassify C3 from ENRICH to a **hard
boundary requirement** (only way to keep apps off direct `firebase/auth` under
R7). Add `authRepo` to domains/identity.md and the transport layer explicitly.
Reconcile mobile-family.md's "deliberately confirmed non-gap" to a gap
consistent with parent/scanner, so all 8 audits apply one rule.

**MERGE-MIGRATION-PARITY [MAJOR]** (M4, M5, M7, M11) — (M4) for every
`list*`/`get*` read replacing a direct-Firestore hook, add a parity row: live
hook → live query constraints → live security-rule predicate → new server
`authorize` action + projection + sort/pagination + a parity assertion; hard
gate before deleting the hook (covers role-scoped reads where class/student-id
filtering is load-bearing). (M5) promote D1 item-path to a named data-migration
runbook in repository-admin scope: dual-read (nested-first, flat-fallback)
shipped first; idempotent backfill (Cloud Task/seed BatchWriter) copying
flat→nested incl. `answerKeys` with a per-item marker; verification pass; flip
writes nested-only; delete fallback + flat rules last; keep flat docs N days for
rollback; separate from the D6 decision. (M7) repository-admin read converters
map every D3/D10/D12 legacy field to canonical **before** the strict response
schema runs; run dev-mode `validateResponses` in report-only during migration;
add a legacy-doc test corpus. (M11) add a consolidated, ordering-aware
**data-migration runbook**: enumerate D1/D3/D5/D6/D8/ D10/D11 + `isSuperAdmin`
claim promotion + announcement reads, each with idempotency key, rollback, and
hard ordering vs (functions deploy, rules deploy, client deploy); make "delete
legacy path/rule/field" a separate post-verification step.

**T5 [MAJOR]** — _authorize per-rule correctness._ Add a per-rule policy
table-test driven from `ACCESS_RULES`: each ⚷ action gets a positive (authorized
ctx allowed) and negative (each disqualifying ctx denied with PERMISSION_DENIED)
emulator case, with explicit parent-gating and guidance-leak rows. Add
`system-context.test.ts` asserting `SystemContext` cannot touch a tenant other
than the event's tenant (audited platform rollups the only exception).

**T7 [MAJOR]** — _CI gate / package inventory drift._ Reconcile
platform-infra.md §6/§8/§9 to the §1.1 package set; fold in every named gate
(RN-purity, depcruise, `no-tenant-id-in-request`, `no-optimistic-on-authority`,
`registry-integrity`, `allowed-transitions-enum`, per-layer `__contract__`
suites, seed determinism, lint RuleTester specs) into one canonical CI matrix
generated from the layer plans' required-tests sections.

**A10 [MAJOR]** — _duplicate useSubscription + reconcile._ Collapse to one
`useSubscription` (realtime owns seam+dedupe; query owns an opt-in
`toCacheKey`/`onPayload` binding writing a named existing query key). For each
of the 9 subs, state which query key it writes and the reconciliation rule
(recommend: subscriptions write the same `*.detail(id)` key the REST read
populates; `onSynced` gates the first write). State realtime-vs-optimistic
precedence (server stream wins).

**DX-2 [MAJOR]** — _parentKeys + duplicate callables._ Rename the analytics
parent-children factory to `childrenKeys` so `parentKeys` is unambiguous. For
`getLeaderboard`/`getExamAnalytics`/`dismissInsight` across two modules, pick
one canonical owning module or give distinct op names (`getLeaderboard` vs
`getCrossTenantLeaderboard`); add a contract test forbidding two callables
sharing an operation segment with overlapping request schemas.

**CD5 [MAJOR]** — folded into UC-7 resolution (write-through model; remove
submissions map from submit).

**CD7 [MAJOR]** — _effectiveRubric naming._ Standardize the snapshot field name
to `effectiveRubric?: UnifiedRubric` on every entity persisting a resolved
rubric (`UnifiedItem`, `StoryPoint`, `Space` default, `ExamQuestion`), each
paired with `rubricId?`/`evaluationSettingsId?`; reserve bare `rubric` only for
`RubricPreset.rubric`. Update levelup-content L24/26/27 + the saveItem contract
(server resolves+writes `effectiveRubric`; read projection returns
`effectiveRubric`).

**CD8 [MAJOR]** — _Announcement.readBy[]._ Remove `readBy: UserId[]` from
`AnnouncementSchema` (identity L54); read state lives only in `/reads/{uid}`
subcollection surfaced as derived `isReadByMe`.

**CD13 [MAJOR]** — _recordItemAttempt shapes._ Converge on one request schema in
domain-entities.md; recommend sending raw `answer` (server scores) over client
`score/maxScore/correct` for a clean authority boundary (consistent with
evaluateAnswer); pin one response shape
`{progress: ItemProgressView, completed}`. **A11:** specify `reconcile` reads
the mutation response's authoritative `{progress}` and `setQueryData`s directly
(not invalidate-refetch) so best-score-retention semantics show correctly; add
the test.

### MINOR resolutions (apply now; low cost)

**PC-7** — add `teacherUids`/`parentUids: UserId[]` to
`StudentProgressSummary` + a trigger (`onMembershipWritten`/class-assignment
change) maintaining them as trigger-owned projections; specify chunked-`in`
batching. **PC-8** — declare `studentName`/`rollNumber`/`classId` denormalized
at `uploadAnswerSheets` as either point-in-time snapshots (documented) or
reconciled by `onStudentUpdated`; pick one. **PC-9** — decide: maintain a
`platformMetrics` rollup doc written by a scheduler; serve
`getSummary{scope:'platform'}`+`tenantComparison` from it; `.count()` only as
same-day top-up; cache aggressively. **PC-11** — specify per-domain `staleTime`
overrides (summaries/trends/platform/cost = 5–10 min; exam analytics = until
`resultsReleased` changes); add the convention that 30s is for entity lists
only. **PC-14** — add server composite callables for genuine 1+N dashboard views
(`getSpaceDetail`); state that any view repo issuing O(N) callables is a
violation. **PC-15** — folded into MERGE-REPOSITORIES-PLAN. **SEC-06** —
re-label §6.12 "minimized, residual enumeration accepted"; ensure the public
tier is per-IP with low ceiling+backoff; equalize hit/miss response time/shape.
**SEC-07** — make the tenant-override audit synchronous+fail-closed; derive the
whitelist from a declarative `allowsTenantOverride:true` flag and have R11
assert the biconditional (field iff flag iff super-admin-only rule). **SEC-08**
— add a named closed `OPTIMISTIC_COUNTER_ALLOWLIST` (`unreadCount`,`unseenCount`
only) with a test asserting no progress/score/points/rank/purchase counter is
ever in it. **SEC-10** — add logout to the `qc.clear()` contract (clear on any
auth-state transition); test no `EDIT_ITEM_SCOPE` key survives sign-out;
invariant test that no subscription payload/Storage object contains
answer-key/guidance fields. **CD12** — keep `tenantId` (via `TenantScoped`) on
persisted Exam/Submission/QuestionSubmission as a server-written field (D2
forbids it only in the request body); confirm `staleSubmissionWatchdog` filters
collection-group results by `tenantId`. **CD15** — fix SDK-SERVER §1.1
"17"→"19"; canonicalize `AuthContext.tenantId` (drop `activeTenantId`), update
common-api §4.3. **DX-10** — make the optional-read pattern first-class
(`useOptionalQuery`/`soft:true`) so authors opt _in_ to soft-failure; give
`defineMutation` a default `onError` calling injected `notify.error` unless
`silent:true`; add a one-paragraph "who handles errors" tree. **DX-11** — define
canonical `SaveResponse={id,created:boolean,archived?:boolean}`; every `save*`
returns it; contract test
`name matches /\.save[A-Z]/ ⇒ responseSchema extends SaveResponseSchema`.
**DX-12** — drop "auto-detect"; `ApiProvider` always owns the
`QueryClientProvider` (uses a passed `queryClient` instance); mandate apps
remove their own provider during step-10 migration; do/don't snippet. **A9** —
make streamed server-computed `remainingMs` the authoritative display source,
`useServerTime()` only interpolates; document `/.info/serverTimeOffset` is an
estimate and grading uses only `ctx.now()`; show "submitting…" past
`remainingMs==0`. **T8** — replace the no-tenantId walker's `depth<2` cap with
full recursion + cycle guard; add
`ZodDefault/Catch/Pipeline/Readonly/Branded/Lazy` cases (reject/flag `ZodRecord`
request fields); add a self-test (planted `tenantId` at depth 3 behind
`ZodDefault` must be caught) + a Zod-version pin so an upgrade fails loudly not
vacuously. **T9** — unify the flag name to `authoritySensitive` (update
lint-boundaries.md); add `authority-flag-coverage.test.ts` regenerating
`AUTHORITY_CALLABLES` from live `CALLABLES` asserting byte-equality +
cross-check vs REVIEW §6 ⚷ list. **T11** — make lint-boundaries.md §6 the single
normative RN-purity spec; others reference it; drive the checked-package set
from tiers.json; meta-test that every pure-tier package is covered. **UC-5** —
define one counting unit, re-tally all 8 apps identically, separate route-node
vs shell columns, re-derive the headline so 271/204/67 reconcile (doc-only;
verdict must not rest on figures that don't add up). **UC-9** — make the §9.4
scanner offline-queue decision now (recommend (a) minimal v1 `OfflineQueue`
replaying `useUploadAnswerSheets` with the existing idempotencyKey) and mark
coverage rows accordingly. **UC-10** — assign `registerDeviceToken` to a single
module (recommend `identity`); define `deviceRepo.register/unregister`+hooks;
specify the `emitNotificationService` push fan-out (FCM/Expo resolution, dedup,
prune-on-unregister, per-platform). **M9** — add a `shared-services`
decomposition map (`auth`→authRepo/C3;
`firestore`→transport-firebase+repository-admin; `storage`→C1 storageRepo;
`realtime-db`→transport-firebase subscription sources; `ai`→`@levelup/ai`;
`reports`→services; `*-callables.ts`→delete; inline `*Request`
types→api-contract) so nothing live (RTDB leaderboard, chat stream wiring) is
lost in the "delete."

---

## 5. ACCEPT-DEFER (valid, post-freeze)

- **DX-3** (add-a-callable runbook/codegen) — real DX cost but not a
  correctness/authority gate; ship a CONTRIBUTING-callable.md + optional
  `pnpm new:callable` scaffold after freeze. The contract tests already
  fail-closed on missing steps; the friction is ergonomic, not unsafe.
- **PC-6** (residual per-child getChildSummary N+1) — a `getChildrenSummaries`
  batched endpoint is a clean perf win but 4 parallel callables for a 4-child
  parent is acceptable for v1; defer with a tracked ticket.
- **PC-10** (getPerformanceTrends rollup doc) — on-the-fly is acceptable for v1
  **if** bounded by range/granularity + a server bucket cap + raised staleTime
  (those parts are ACCEPT-FIX under PC-11); the rollup-doc promotion itself
  defers, tracked, with `recomputeOrchestrator` as the eventual maintainer.
- **DX-7** (hook-naming exceptions) — pick the convention (`use<Noun>Live` etc.)
  and apply mechanically; cosmetic, can land during per-domain hook authoring,
  not a freeze blocker.
- **DX-13** (list vs infinite ergonomics) — document that mutations invalidate
  at root (covering both); the speculative `list` vs `infinite` split can be
  simplified later when a consumer needs it.
- **A12** (offline durable queue contract) — v1 ships the `NoopOfflineQueue`
  seam; the _day-1 idempotency keys_ are the only thing that must be right now
  (covered by MERGE-IDEMPOTENCY + C1). The durable queue impl +
  ordering/conflict contract defers with the UC-9 recorded decision.

---

## 6. REJECT

- **UC-11** — Not a finding (the reviewer marked it a positive control). The
  answer-key editor cache scope is correctly specified (`EDIT_ITEM_SCOPE`,
  `gcTime:0`, `isSensitiveKey` persist-rejection). Reject as a _finding_; the
  only action is to flip the levelup-content §216 open-question to a closed
  statement referencing query-infra §4.3 + the contract test (captured under
  SEC-10's invariant test — no separate change needed).

---

## 7. Logged dissent

- **D6 hot-doc strategy (perf vs correctness vs migration).** perf-caching
  (PC-13) and correctness (CD14) both want
  `SpaceProgress.storyPoints`/`StoryPointProgressDoc.items` committed to a
  decided shape now; migration (M5/M11) warns that _any_ shape change to these
  docs is a production backfill that must be sequenced, not just decided.
  **Arbiter ruling:** decide the _target_ shape pre-freeze (ACCEPT-FIX
  MERGE-D6-FATDOC) AND add the backfill runbook (ACCEPT-FIX
  MERGE-MIGRATION-PARITY/M11) — the design decision and its migration are _both_
  required, neither alone. No unresolved disagreement once both land.
- **C3 auth-seam severity (ENRICH vs BLOCKER).** ui-coverage (UC-4) calls C3 a
  hard boundary-blocker (login is the only entry for parent/scanner and maps to
  no SDK capability under R7); §9 classes it ENRICH; mobile-family.md explicitly
  calls the same seam a "non-gap." **Arbiter ruling:** ui-coverage is correct —
  reclassified to a hard requirement (ACCEPT-FIX UC-4). Dissent logged because
  three source docs disagreed; resolved in favor of the boundary argument (R7 is
  non-negotiable).
- **getMany `in`-chunking location (dx vs perf).** dx (DX-14) argues the
  `where('id','in',chunks of 10)` phrasing leaks Firestore into the _client_
  repo and the client has no Firestore access (principle 3), so chunking must be
  server-side; perf (PC-15) treats it as a real but acceptable bounded fan-out
  wherever it lives. **Arbiter ruling:** dx wins on the principle — client
  `getMany` calls a batched callable; chunking lives in repository-admin
  (server). Logged because the two framed the same mechanism differently
  (ergonomics-leak vs perf-cost); both fold into MERGE-REPOSITORIES-PLAN.
- **Severity bump on UC-5 (tally) and T8 (walker).** ui-coverage rated UC-5
  MAJOR; arbiter downgrades to MINOR (the _figures_ are unreliable but the
  _coverage decisions_ don't hinge on the exact count once C1–C31 are folded in
  per UC-1). testability rated T8 MINOR; arbiter upgrades to MAJOR (a
  vacuously-green no-tenantId test undermines the #1 authority assertion — that
  is more than minor). Dissent on severity only, not on the fix.

---

## 8. Gate recommendation

**GATE: BLOCK — do not freeze yet. CONDITIONAL-PASS once the ACCEPT-FIX worklist
(esp. the 15 BLOCKER-cluster items) lands.**

The architecture is sound and the contract-SSOT bet is the right one. But three
"resolved" claims are not realized (§9 100%-coverage, D6,
dual-run-via-versioning), several `tsc`/`.strict()` safety nets the plan _relies
on_ will currently fail to compile (transition enums, DomainName registry), the
realtime+Storage read surfaces have no server authority while the rules that
would enforce them are declared out-of-scope, and the migration has no deploy
mechanism for the only cutover that actually happens now (live→v1).

**Freeze unblocks when:**

1. The 11 BLOCKER resolutions above are applied to the named files
   (MERGE-REALTIME-AUTHORITY, MERGE-C9-ORPHANED, MERGE-DOMAIN-ENTITIES,
   MERGE-TRANSITIONS, CD4, MERGE-IDEMPOTENCY, MERGE-DOMAINNAME,
   MERGE-SINGLE-WRITER, MERGE-MIGRATION-CUTOVER, T1, T2), each with the
   contract/emulator test that proves it.
2. `sdk-plan/layers/{domain-entities,repositories,seed,security-rules}.md` exist
   (currently none do).
3. The MAJOR resolutions are applied or explicitly deferred-with-ticket; the
   ACCEPT-DEFER list is recorded in the master plan's open-questions so it is
   not silently dropped.
4. Re-run the 4 contract-integrity suites (registry, ACCESS_RULES completeness,
   INVALIDATION_GRAPH totality, transitions-enum) against the _real_ inventory —
   they must be green, not aspirational.

Re-review scope after fixes can be narrow: the BLOCKER clusters + the new four
layer plans. The MINOR/DEFER tail does not need a second full pass.

---

## Convergence verdict

**NOT-CONVERGED** (not yet freezable). All 11 BLOCKER-cluster resolutions land
cleanly in the master plan body and are internally consistent: realtime
authority/projections (§3.3), C1–C31 folded into §3.2/§4.1/§4.2/§4.3/§5.4 +
Storage seam (§3.7), domain-entities/repositories/seed/security-rules layer
plans cited (§7), canonical transition enums + 9 machines (§3.6),
`StoredEvaluation` cost-strip (CD4), atomic idempotency dedupe +
no-`idempotencyKey`-in-schema test (§3.1/§5.5), exhaustive `DomainName` (§4.2),
serialized single-writer mechanisms (§5.3), dual-export cutover + 5a–5d (§7.1),
T1/T2 (§7.2). D1–D14 are all addressed in §8. **But the edits introduced one
trust-boundary violation and left several ACCEPT-FIX MAJOR/MINOR resolutions
unapplied while the §10 ledger claims convergence**, so the freeze gate cannot
close yet.

**Freeze-blocking (must fix before freeze):**

1. **CONV-1 (BLOCKER, principle 4 / D2 violation).** §9.3 C28
   `startImpersonation {targetUid, tenantId, reason}` puts **`tenantId` in the
   request body** (line 522). This fails the explicit convergence invariant
   ("tenantId nowhere in a request schema"), the `no-tenant-id-in-request`
   contract test, and principle 4 — and directly contradicts the
   MERGE-IMPERSONATION resolution which mandated a dedicated `tenantOverride`
   field on the R11 super-admin whitelist. Rename the field to `tenantOverride`
   and add `allowsTenantOverride:true` to the def. (Also fix the `meLive`
   reactive-auth note which is fine, but the `tenantId` token in C28 is the one
   concrete schema-level leak.)

2. **CONV-2 (MAJOR, unapplied ACCEPT-FIX).** MERGE-IMPERSONATION (SEC-04/UC-12)
   required a full C28 sub-spec (constrained claim set with `isSuperAdmin`
   forced false + nested-impersonation denial, `ImpersonationAudit` record
   synchronous+transactional with token mint, an impersonation-session ledger,
   `endImpersonation`/auto-expiry calling `revokeRefreshTokens(targetUid)`). The
   plan body still carries only the one-line C28 (plus `endImpersonation` named
   in the §3.2 fold list and a `user.impersonate.start|end` ACCESS_RULES
   action). The hardening sub-spec is absent.

3. **CONV-3 (MAJOR, unapplied ACCEPT-FIX — authority/optimistic boundary).**
   CD13 resolution mandated `recordItemAttempt` send raw `answer` (server
   scores) and pin response `{progress: ItemProgressView, completed}`. The §3.2
   body (line 214) still declares
   `recordItemAttempt {spaceId,storyPointId,itemId, score,maxScore,correct,...}`
   — the **client-supplied score/correct** shape CD13 said to replace. This
   leaves a client-set grading value on an optimistic-allow-listed callable,
   weakening the authority boundary the convergence check exists to protect.
   Converge to the raw-`answer` request + pinned response shape (and reconcile
   with A11's `setQueryData`-from-response reconcile).

4. **CONV-4 (MAJOR, missing test for the optimistic-allow-list guarantee).** T9
   (unify flag to `authoritySensitive` + `authority-flag-coverage.test.ts`
   regenerating `AUTHORITY_CALLABLES` from live `CALLABLES`) and SEC-08
   (`OPTIMISTIC_COUNTER_ALLOWLIST` with a test that no
   progress/score/points/rank/purchase counter is in it) are ACCEPT-FIX but
   appear **nowhere** in the plan: grep finds no `AUTHORITY_CALLABLES`,
   `authority-flag-coverage`, or `OPTIMISTIC_COUNTER_ALLOWLIST`. The flag exists
   on `CallableDef` and the closed allow-list is enumerated in §4.4, but the
   regeneration test that proves the allow-list still excludes
   authority-sensitive writes (the stated convergence criterion) is unspecified.

5. **CONV-5 (MINOR but ledger-integrity).** §10 "Review resolutions applied"
   stops at SEC-09 and omits the ~30 remaining ACCEPT-FIX items
   (MERGE-IMPERSONATION, UC-7, UC-8, UC-4, MERGE-PARENT-GATE, CD7, CD8, CD13,
   A10, DX-2, T5, T7, T8, T9, SEC-06/07/08/10, CD12, CD15, PC-7/8/9/11/14, M9,
   UC-5/9/10). Several of these _are_ reflected in the body (CD7
   effectiveRubric, CD8 readBy removal, DX-2 childrenKeys, parent-gate
   ACCESS_RULES, UC-7/UC-8 via §9, CD15 in §8) but the ledger does not record
   them and the genuinely-missing ones (CONV-2/3/4) are masked by the ledger's
   "convergence" framing. Complete §10 so every ACCEPT-FIX has an
   applied/deferred-with-ticket status; do not let the §10 claim outrun the
   body.

**Not freeze-blocking (verified converged):** trust-layered DAG intact (no
client package imports services/server/firebase); §6 authority list complete;
`UnifiedEvaluationResult` is ⚷ server-internal everywhere a client response is
declared; `manageNotifications` fully deleted; D1–D14 reconciled;
`SubmissionStatusSchema` release-gating present; SUBSCRIPTIONS(9)≡SOURCES(9);
idempotency dedupe atomic.

**Recommendation:** apply CONV-1 (trivial rename, hard blocker), CONV-2/3 (the
two genuinely-unapplied MAJOR authority fixes), CONV-4 (the allow-list
regeneration test), and complete the §10 ledger (CONV-5). CONV-1 alone is
freeze-blocking; CONV-2/3/4 are the residual MAJOR work the first review
demanded. Re-review scope is narrow: C28 schema + impersonation sub-spec,
recordItemAttempt shape, the two allow-list tests, and the §10 ledger. **Freeze
on a one-pass fix of these five.**

---

## Freeze verdict (Phase-2 close)

**CONVERGED — PLAN FROZEN (GATE 2 PASS).** All five CONV-1..CONV-5 fixes landed
cleanly in `SDK-LAYERS-PLAN.md`; the five narrow re-review items pass; no new
contradiction or trust-violation was introduced; the trust-layered DAG is
intact.

**Narrow re-review (the 5 items):**

1. **CONV-1 — no `tenantId` in any request schema: PASS.** Plan-wide grep finds
   no request-body `tenantId` field. C28 now declares
   `startImpersonation {targetUid, tenantOverride, reason}` with
   `allowsTenantOverride:true` (§3.2/§9.3 C28 L536, §3.7.1 L302); the only
   residual `tenantId` tokens are _response_ fields
   (`deactivateTenant`→`{tenantId,status}`), the distinct `targetTenantId`
   (switchActiveTenant) and `tenantIds[]` (super-admin `bulkApplyTenantFeatures`
   cross-tenant target list), and server-written persisted fields (CD12) — none
   is a request-scope override. Principle 4 / D2 / `no-tenant-id-in-request`
   satisfied.

2. **CONV-2 — C28 impersonation hardening sub-spec: PASS.** §3.7.1 (L300–308)
   fully specifies all required elements: constrained claim set with
   `isSuperAdmin` forced FALSE + nested-impersonation denial (1); synchronous +
   transactional `ImpersonationAudit` fail-closed with token mint (2);
   impersonation-session ledger doc keyed by `sessionId` (3);
   `endImpersonation`/auto-expiry calling `revokeRefreshTokens(targetUid)`
   - synchronous-revoke gate + time-box `expiresAt` (4);
     ACCESS_RULES/INVALIDATION wiring (5).

3. **CONV-3 — recordItemAttempt raw `answer` → `{progress,completed}`,
   consistent: PASS.** §3.2 L216 now declares
   `recordItemAttempt {spaceId,storyPointId,itemId,answer,...}` →
   `{progress:ItemProgressView, completed}` with "SERVER scores — never
   `score`/`maxScore`/`correct`"; repo `progressRepo.recordAttempt` sends raw
   answer (§4.1 L316); invalidation `recordItemAttempt→{progress}`+fanout (§4.3
   L338); optimistic recipe reconciles via `setQueryData` from the authoritative
   response, not invalidate-refetch (§4.4 L346 / NEVER-optimistic note L353 /
   A11). No client-set grading value rides the optimistic path. (Non-blocking
   nit: L216/L515/L582 still list a literal `idempotencyKey` token inside the
   request braces, which is in tension with §3.1's "no `.strict()` request
   schema declares `idempotencyKey`" contract test — a pre-existing
   notation/shorthand inconsistency, not newly introduced and not a
   trust/authority violation; resolve as a doc cleanup at build time by treating
   it as the envelope/def-hint, not a schema field.)

4. **CONV-4 — authoritySensitive + AUTHORITY_CALLABLES +
   OPTIMISTIC_COUNTER_ALLOWLIST + their tests: PASS.** §3.1 L189 specifies the
   unified `authoritySensitive` flag, `AUTHORITY_CALLABLES` regenerated from
   live `CALLABLES`, and `authority-flag-coverage.test.ts` (byte-equality +
   every ⚷ callable flagged + allow-list exclusion). §4.4 L355 specifies the
   closed `OPTIMISTIC_COUNTER_ALLOWLIST = ['unreadCount','unseenCount']` with a
   test that no progress/score/points/rank/purchase counter is in it. Both gates
   are folded into the CI matrix (T7 §10 L590).

5. **CONV-5 — §10 ledger complete: PASS.** §10 (L550–623) records every
   ACCEPT-FIX as **APPLIED (section)** or **DEFERRED (ticket SDK-\*)**, the six
   ACCEPT-DEFER items are tracked with tickets, and a closing ledger-integrity
   statement (L623) confirms the ledger no longer outruns the body (CONV-5
   satisfied).

**No new contradiction / DAG integrity: PASS.** Strictly-downward trust edges
intact (apps→only query/realtime/offline/domain; services/firebase-admin
confined to the server seam; RN-purity gate proves domain→query stay
firebase-free); SUBSCRIPTIONS(9)≡SUBSCRIPTION_SOURCES(9) with canonical
`leaderboardLive`; `UnifiedEvaluationResult` ⚷ server-internal;
`manageNotifications` deleted. The only inconsistency found is the pre-existing,
non-trust-bearing `idempotencyKey`-in-request-brace notation nit above —
flagged, not freeze-blocking.

**GATE 2: PASS — PLAN FROZEN.**
