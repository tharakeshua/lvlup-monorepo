# Review — Performance / N+1 / Caching / Pagination

> Reviewer perspective: **perf-caching**. Scope: does the FROZEN-CANDIDATE plan
> actually kill the flagged N+1 fan-outs, use server-side aggregations instead
> of client fan-out, apply pagination to every list endpoint with opaque
> cursors, scope invalidation narrowly, and address the realtime listener /
> fat-doc / 1MB-doc costs (D6). Findings only — no praise.
>
> Sources read: `SDK-LAYERS-PLAN.md` (all 9 sections), `SDK-SERVER-DESIGN.md`,
> `status/REVIEW-domain-data-model.md`,
> `sdk-plan/layers/{query-infra,api-contract-core,transport-realtime}.md`,
> `sdk-plan/domains/{analytics,autograde,levelup-content,testsession-progress,identity,gamification}.md`,
> `sdk-plan/coverage/{web-parent,web-super-admin}.md`, `common-api.md §7`.

---

## PC-1 — `examGrading` realtime subscription streams full submission docs (fat-doc fan-out on every grading tick)

- **Severity:** MAJOR
- **Where:** `transport-realtime.md §SUBSCRIPTION_SOURCES`
  (`v1.autograde.examGrading`), `autograde.md §SUBSCRIPTIONS` lines 192–198.

**Problem.** The `examGrading` subscription resolves to a raw Firestore
collection listener:
`collectionPath: __tenant__/submissions, where: examId == examId`. There is **no
projection layer on a realtime collection listener** — Firestore `onSnapshot`
returns the _entire_ submission document for every doc in the result set, and
every time any one of them changes the client re-reads the changed doc(s) in
full. Submission docs are exactly the heavy ones: `AnswerSheetData`,
`ScoutingResult`, `SubmissionSummary`, per-question state. For a 200-student
exam mid-grading, that is 200 fat docs on first paint plus a re-stream of each
doc on each pipeline transition — the teacher grading dashboard will pull
megabytes and re-render continuously. The plan's stated intent (autograde.md
L197) is that `examGrading` "aggregates `stats` + per-submission status counts,"
but the wire reality is a full-doc collection listener — there is no server-side
aggregation doc backing it. This re-introduces the same class of client fan-out
the plan claims to kill, just over the realtime channel where the projection
discipline (`listSubmissions` denormalizes `studentName`, strips answer keys)
does **not** apply.

**Resolution.** Back `examGrading` with a **single server-maintained aggregate
doc** per exam (e.g. `tenants/{t}/exams/{examId}/gradingProgress` or a field on
`Exam.stats`) written by the pipeline reducer / `recomputeExamAnalytics`, and
point the subscription at that one doc
(`backend:'firestore', docPath: .../gradingProgress`). The realtime payload then
carries only `{graded,total,byStatus, batchIndex,updatedAt}` — O(1) reads per
tick instead of O(submissions). Alternatively project the counts into an RTDB
node like the leaderboard/badge nodes already do. Document that **no realtime
subscription may target an unbounded collection of fat docs** — add it to the
subscription-registry review checklist alongside the `__tenant__`/`__uid__`
rule.

---

## PC-2 — `gradingStatus` and `spaceProgressLive`/`testSessionDeadline` listen on full authoritative docs, not slim live-projections

- **Severity:** MINOR
- **Where:** `transport-realtime.md §SUBSCRIPTION_SOURCES` (`gradingStatus`,
  `spaceProgressLive`, `testSessionDeadline`).

**Problem.** These three are single-doc listeners, so cardinality is fine, but
each targets the _authoritative fat doc_ directly: `submissions/{id}` (carries
`AnswerSheetData`/`ScoutingResult`), `spaceProgress/{userId}_{spaceId}` (the
very doc D6 flags as a 1MB-growth/full-rewrite risk), and
`digitalTestSessions/{sessionId}`. The realtime payload schemas
(`SubmissionStatusSchema`, `SpaceProgressLive`, `TestSessionLive`) are slim, but
`onSnapshot` delivers the **whole doc** over the wire regardless of the Zod
payload shape — `validatePayload` parses a slim view _after_ the full doc
already crossed the network. So every progress write (which D6 says is a
full-doc rewrite) re-pushes the entire fat doc to every live listener. There is
also a latent answer-key/guidance exposure: a client subscribed to
`submissions/{id}` receives whatever fields the doc holds, and the answer-key
projection that `getSubmission` applies server-side does **not** exist on a raw
Firestore listener.

**Resolution.** For each live feature, subscribe to a **dedicated slim
live-doc** that the server writes alongside the authoritative doc (a `…/live`
mirror or RTDB node holding only the subscribed fields), rather than the fat
source doc. At minimum, state explicitly in the plan that submission /
test-session / progress fat docs must keep all ⚷ guidance/answer/PII fields out
of the doc the listener targets (i.e. the listener doc is a deliberately
answer-free projection), and add a rules + contract test asserting the
realtime-targeted doc contains no `⚷` fields. This also de-risks the D6 1MB
rewrite amplification on the realtime path.

---

## PC-3 — `getChatSession` returns all messages inline with no pagination; `ChatMessage[]` is an unbounded growing array

- **Severity:** MAJOR
- **Where:** `levelup-content.md §callables` L87
  (`getChatSession {sessionId} → ChatSessionView (with messages)`), L36
  (`ChatSessionSchema.messages: ChatMessage[]` "or messages/ subcollection"),
  `SDK-LAYERS-PLAN.md §3.2`.

**Problem.** `getChatSession` is the one read in the levelup inventory that
returns a child collection **inline and unpaginated**: the response embeds the
full `messages` array. The schema even hedges `messages: ChatMessage[]` (or
`messages/` subcollection) — the storage shape is left undecided, which is
precisely the D6 record-map-vs-subcollection risk the plan claims to resolve
everywhere else. A long AI chat session grows this array unboundedly (each
`sendChatMessage` appends), so both the single-doc read cost and (if stored
inline) the 1MB-doc rewrite-per-message risk are live. The `chatStream`
subscription correctly uses a `messages` subcollection query ordered by
`createdAt` (transport-realtime L216), which contradicts the inline-array
storage option in the entity schema and implies the subcollection is the real
shape — but `getChatSession` then has no `PageRequest` to page it.

**Resolution.** (1) Decide D6 for chat the same way it was decided for
test-session submissions: **always a `messages/` subcollection**, never inline
(kills the 1MB risk + matches `chatStream`). (2) Add `PageRequest` to
`getChatSession` (or split a dedicated
`listChatMessages {sessionId, PageRequest}` returning
`pageResponse(ChatMessage)`) so initial load is the last N and history pages on
scroll. Keep `messageCount`/`previewMessage` denormalized on the session doc for
list views.

---

## PC-4 — `listStoryPoints`, `getSpaceProgress`/`getStoryPointProgress`, `listQuestions`, `listEvaluationSettings`, `listLinkedChildren`-children-rows are unpaginated lists

- **Severity:** MAJOR
- **Where:** `levelup-content.md §callables` L72
  (`listStoryPoints {spaceId} → {items: StoryPointView[]}` — no `PageRequest`),
  `common-api.md §144` (`getSpaceProgress`/`getStoryPointProgress`),
  `autograde.md` (`listQuestions(examId) → ExamQuestionView[]`,
  `listEvaluationSettings → EvaluationSettingsView[]`), `identity.md`
  (`listAnnouncements` has paging but
  `getClass → ClassDetailView{students,teachers}` embeds full roster).

**Problem.** The plan asserts (`SDK-SERVER-DESIGN §5.3`, `api-contract-core §5`,
`common-api §7`) that **"every list endpoint uses the unified pagination
fragment."** That is not true in the actual inventory. Several list-shaped reads
return a bare array with no `PageRequest`/`nextCursor`:

- `listStoryPoints {spaceId} → {items: StoryPointView[]}` — bounded-ish but not
  capped.
- `listQuestions(examId) → ExamQuestionView[]` and
  `listQuestionSubmissions(submissionId) → […][]`.
- `listEvaluationSettings → EvaluationSettingsView[]`, `listAgents`,
  `listRubricPresets` (domain plans show `paginate()` repo wrappers, but the
  **callable** responses are arrays, so the cursor has nothing to ride on).
- `getClass → ClassDetailView{class, students, teachers}` embeds the **entire
  roster** inline — a 60-student class is fine, a 2,000-student "all students"
  class is a fat unbounded response, and it cannot page.
- `StoryPointProgressDoc.items` is "kept but flagged for per-item docs if large"
  (D6) — i.e. an unbounded map returned whole by `getStoryPointProgress`.

`StoryPoint`/`ExamQuestion`/roster counts are usually small, but "usually small"
is not a cap — the contract test `pagination.test.ts` only checks the
_fragment_, not that _every list callable adopted it_. Nothing enforces the
"every list paginates" claim.

**Resolution.** Either (a) add `PageRequest`/`pageResponse(...)` to every
list-returning callable (`listStoryPoints`, `listQuestions`,
`listQuestionSubmissions`, `listEvaluationSettings`, `listAgents`,
`listRubricPresets`), or (b) add an explicit **bounded-list allow-list** in the
contract with a documented hard server cap (e.g. `≤ 200` story points/questions,
enforced server-side) and a contract test that asserts every list callable is
either paginated **or** in the bounded allow-list with a declared `maxItems`.
For `getClass`, page the roster (`getClass` returns counts + first page;
`listStudents{classId,PageRequest}` already exists for the rest). For
`getStoryPointProgress`, split `items` to per-item docs (resolve D6's "if large"
hedge to a decision) or paginate it.

---

## PC-5 — Invalidation graph still fans out to coarse domain _roots_ (`['progress']`, `['analytics']`, `['submissions']`), invalidating every query in the domain

- **Severity:** MAJOR
- **Where:** `query-infra.md §5.1` (`OVERRIDES`), `§5.2`
  (`invalidateForCallable` step 1), `SDK-LAYERS-PLAN.md §4.3`.

**Problem.** The plan correctly kills the _old_ coarse key
`['tenants', tenantId, 'spaces']`, but the **new** invalidation primitive is
still coarse in a different way: `invalidateForCallable` step 1 does
`rule.roots.map(root => qc.invalidateQueries({ queryKey: [root] }))` — i.e. it
invalidates the entire domain by prefix. `submitTestSession` lists roots
`['progress','spaces','storyPoints','analytics']`, so a single practice
submission invalidates **every** spaces list, every story-point list, and every
analytics query in the cache (every student/class/platform summary the user has
open), not just the affected space. The `fanout` resolvers add _precise_ targets
but never _replace_ the coarse roots — step 1 always runs the prefix
invalidation regardless of whether a precise fanout exists. For high-frequency ⚷
writes (`recordItemAttempt`, `submitTestSession`, `gradeQuestion`) on a
dashboard with many cached lists, this is a refetch storm: `gradeQuestion`
invalidates the whole `analytics` root, re-pulling every summary. The §5.3
invariant only checks roots are _real DomainNames_ and that _coverage exists_ —
it does not bound _breadth_.

**Resolution.** Make `fanout`-present rules **suppress the coarse root** for
that root (invalidate the precise keys only) and reserve bare-root invalidation
for the genuinely-can't-be-narrowed cases. Add a graph-shape contract test
asserting that any rule which dirties a high-churn root (`analytics`,
`progress`, `submissions`) provides a `fanout` and does **not** also list that
root coarsely. Where a precise key is unknown, prefer invalidating
`keys.X.list(...)` / `keys.X.detail(id)` sub-trees over the whole `[domain]`
prefix. Also distinguish `list` vs `infinite` vs `detail` kinds in fanout so an
attempt-progress write doesn't blow away unrelated `detail` queries.

---

## PC-6 — `gamificationViewRepo.summary` and `getChildSummary` are good aggregations, but the parent dashboard still issues one `getChildSummary` per child (residual N+1)

- **Severity:** MINOR
- **Where:** `web-parent.md` rows 3/5/6/10 (`useChildSummary(studentId)` per
  child), `analytics.md §parentRepo` L144,
  `gamification.md §gamificationViewRepo` L226.

**Problem.** `listLinkedChildren` correctly collapses the roster into one
server-batched call, and `getChildSummary` collapses `getSummary + listInsights`
into one round-trip — both are genuine wins. But several parent screens
(`child-comparison` row 10 explicitly: "`getChildSummary` (one per child)";
`performance-alerts` row 3 iterates children calling `getChildSummary`;
`children-roster` row 5) still do **one `getChildSummary` round-trip per
child**. For a parent with 4 children, the comparison and alerts screens fire 4
parallel callables instead of one. The plan flagged parent-web N+1 as a headline
fix, yet the _multi-child_ aggregate (the comparison/alerts use case) was not
given a batched endpoint — only the per-child and the roster endpoints exist.

**Resolution.** Add a batched
`getChildrenSummaries {studentIds?: subset} → {summaries: Record<StudentId, ChildSummary>}`
(server reads `ctx.studentIds`, one batched fetch) backing the comparison/alerts
screens, OR enrich `listLinkedChildren` rows to carry the comparison metrics +
at-risk reasons so the comparison/alerts screens need no per-child call. This is
the same `getMany`/batched pattern `listLinkedChildrenService` (L211) already
promises — extend it to the full summary, not just the row.

---

## PC-7 — `nightlyAtRiskDetection` and `recompute*` orchestrator at-risk recipient resolution rely on denormalized `teacherUids`/`parentUids` that are never defined as maintained projections

- **Severity:** MINOR
- **Where:** `analytics.md §schedulers` L270 ("Fixes O(N) student lookup via
  `where(authUid in [...])` / denormalized `teacherUids`/`parentUids` on
  summary"), `§services` notify path.

**Problem.** The fix for the O(N) at-risk student lookup depends on
`teacherUids`/`parentUids` being denormalized **onto the summary doc**, but
those fields are not in the `StudentProgressSummary` schema (entities table
L40), and no trigger is specified to maintain them (the trigger list maintains
`Class.studentIds`/parent arrays via `onStudentArchived`/`onClassArchived`, but
nothing back-fills `parentUids`/`teacherUids` onto summaries when a parent link
or class assignment changes). So either the denormalization doesn't exist (and
the scheduler falls back to the O(N) lookup it claims to fix), or it exists but
is undefined and will silently drift (a re-linked parent stops getting at-risk
notifications). `where(authUid in [...])` also has the Firestore 10-element `in`
cap, so it is itself an N/10 fan-out at scale, not O(1).

**Resolution.** Add `teacherUids: UserId[]` / `parentUids: UserId[]` to
`StudentProgressSummary` and a trigger (`onMembershipWritten` /
`onStudentArchived` / class-assignment change) that maintains them as
trigger-owned projections (D7 discipline). Specify the chunked-`in` batching
(chunks of 10) explicitly, or maintain a precomputed recipient list per summary
so the milestone-notify path is a single read.

---

## PC-8 — `listSubmissions` N+1 collapse depends on denormalized `studentName`/`rollNumber`/`classId` on the submission doc, but no writer/trigger maintains them on student rename/transfer

- **Severity:** MINOR
- **Where:** `autograde.md §submissionRepo` L228–230 ("server pre-joins
  `studentName`/`rollNumber`/`classId` (denormalized) so the repo never fans out
  per student").

**Problem.** The submission-list N+1 collapse (a real, correct win) is built on
denormalized student identity fields **on the submission doc**. The plan does
not say who writes them (presumably `uploadAnswerSheets` at ingest) or what
reconciles them when a student is renamed, gets a corrected roll number, or
transfers class after submission. Without a reconciliation trigger these become
stale (D7: denorm arrays must be trigger-maintained projections, not source of
truth) — the grading list shows the old name/class. This is correctness-adjacent
but it's the cost of the perf optimization, so it must be owned.

**Resolution.** State that `studentName`/`rollNumber`/`classId` are denormalized
at `uploadAnswerSheets` and either (a) declared point-in-time snapshots
(acceptable — "name as submitted"), documented as such, or (b) reconciled by an
`onStudentUpdated` trigger fanning out to that student's submissions. Pick one
and write it; do not leave the denorm unowned.

---

## PC-9 — Platform-summary aggregation cost (super-admin) deferred to `.count()` with no rollup, risking 6+ full-collection scans per dashboard load

- **Severity:** MINOR
- **Where:** `analytics.md §open-questions` Q2 ("Platform metrics cost: today 6
  full-collection count queries … Recommend: `.count()` for v1; rollup doc if
  super-admin dashboard scales"), `web-super-admin.md` rows 1/5 + G5
  (`PlatformSummarySchema` with `tenantComparison[]`, `growthSeries[]`,
  `topTenants[]`).

**Problem.** `getSummary{scope:'platform'}` must produce cross-tenant KPIs, a
per-tenant comparison table, growth series, plan distribution, and top-tenants.
The plan leaves the aggregation strategy as an **open question** (`.count()` vs
rollup doc) rather than a decision, and the super-admin coverage (G5) adds
`tenantComparison: {tenantId,name,users,exams,growthPct}[]` — a per-tenant row
set whose `users`/`exams` counts and `growthPct` are themselves aggregations.
Computed on-the-fly with `.count()` this is O(tenants × metrics) aggregation
queries on **every** super-admin dashboard load (and the overview + analytics +
billing pages all hit it). `.count()` aggregation queries are billed and rate-
limited; this is the one place the plan does a synchronous cross-tenant scan,
and it's left undecided.

**Resolution.** Decide for v1: maintain a **`platformMetrics` rollup doc** (or
`costSummaries`-style daily platform snapshot) written by a scheduler, and serve
`getSummary{scope:'platform'}` and `tenantComparison` from it (O(1) read). Keep
`.count()` only as a freshness top-up for the current day. Cache the platform
summary aggressively (`staleTime` minutes, not the default 30s) since it changes
slowly. Do not ship per-load multi-collection `.count()` fan-out as the steady
state.

---

## PC-10 — `getPerformanceTrends` aggregation source undecided; on-the-fly variant re-aggregates summaries/submissions per parent/teacher dashboard load

- **Severity:** MINOR
- **Where:** `analytics.md §open-questions` Q1 ("aggregate on-the-fly from
  summaries/submissions, or maintain a `performanceTrends` rollup doc …
  Recommend: on-the-fly for v1"), `getPerformanceTrendsService` L209
  ("server-side aggregation over summaries/submissions/spaceProgress").

**Problem.** `getPerformanceTrends` is used on the student dashboard, every
parent `child-progress` screen, and the super-admin platform-analytics growth
charts. The v1 recommendation is **on-the-fly aggregation over
summaries/submissions/spaceProgress**, bucketed by granularity — i.e. a
multi-doc scan per call, per child, per dashboard view, with no rollup and (per
the hook table) standard read caching. For a teacher viewing a class trend or a
parent flipping between children, this re-runs the bucketed aggregation each
time. It's a read (no write storm), but it's an unbounded scan whose cost grows
with history length and is not cached beyond the 30s default.

**Resolution.** Acceptable to defer the rollup doc, but: (1) bound the scan with
the `range`/ `granularity` (already in the request) and a server-side hard cap
on buckets; (2) raise `staleTime` for `trendKeys`/`summaryKeys` well above 30s
(trends change slowly); (3) make the rollup-doc promotion a tracked decision
with a trigger (the `recomputeOrchestrator` already runs on every progress write
and could maintain a per-student `performanceTrends` doc cheaply) rather than an
open question carried into build.

---

## PC-11 — Default `staleTime` 30s + `throwOnError` true is applied uniformly; slow/expensive aggregations and rarely-changing reads get the same refetch cadence as hot lists

- **Severity:** MINOR
- **Where:** `query-infra.md §3.3` (`makeQueryClient` defaults:
  `staleTime 30_000`, `gcTime 5*60_000`), per-domain hook tables (no per-hook
  stale overrides specified for summaries/trends/cost/platform).

**Problem.** The single global cache policy (`staleTime 30s`) is correct for hot
lists but wrong for the expensive, slowly-changing reads: platform summary, cost
summaries, performance trends, exam analytics, gamification summary. With a 30s
stale window these re-fetch on every remount/refocus-equiv within a session,
re-running the very aggregations PC-9/PC-10 flag as costly. The plan specifies
per-hook `gcTime:0/staleTime:0` only for the _answer-key editor_ keys (correct),
but never specifies _raised_ stale times for the expensive aggregations. So the
most expensive reads inherit the most aggressive refetch cadence.

**Resolution.** Specify per-domain `staleTime` overrides in the
analytics/gamification/cost hook tables (e.g. summaries/trends/platform/cost =
5–10 min; exam analytics = until `resultsReleased` changes). Add a convention to
the query-infra doc that aggregation/rollup hooks must declare a stale time and
that 30s is for entity lists only. This is a cheap, high-leverage cost cut once
PC-9/PC-10 land.

---

## PC-12 — `total` is optional and `paginate()` cursor encoding is server-only base64, but no guidance on count cost; UIs needing totals will force a second full scan

- **Severity:** MINOR
- **Where:** `api-contract-core.md §5` (`pageResponse.total` optional; comment
  "`total` only when cheaply known"), super-admin/teacher list screens (tenant
  table, student roster, submissions) that render counts/"showing X of N".

**Problem.** Cursor opacity is correctly handled (base64 server-encoded, never
parsed client-side — this is good). But `total` is optional with the guidance
"only when cheaply known," and several UI surfaces (tenant provisioning table,
student roster, submissions list, llm-usage) display totals or "N results." If
those screens demand `total`, the server must run a separate `.count()` over the
filtered set per page request — an aggregation-per-page cost that is invisible
in the contract (the field just appears). There's no rule that `total` is
computed once and cached, nor a signal to the UI that requesting totals is
expensive.

**Resolution.** Document the `total` cost contract: `total` is populated only
from a maintained counter (e.g. `Class.studentCount`, `Tenant.stats`,
`Exam.stats.totalSubmissions`) — never a live `.count()` per page. Where a true
filtered count is needed, either omit `total` (UI shows "X+ / load more") or
back it with a counter. Add to the pagination contract test that no list service
issues a `.count()` per `paginate()` call.

---

## PC-13 — D6 1MB-doc risk left as a hedge (`StoryPointProgressDoc.items`, `SpaceProgress.storyPoints`, inline chat) rather than a resolved decision

- **Severity:** MAJOR
- **Where:** `SDK-LAYERS-PLAN.md §8 D6` row, `testsession-progress.md §325`,
  `levelup-content.md §36`, `REVIEW-domain-data-model.md D6 / risk #10`.

**Problem.** D6 is the explicit 1MB-doc / full-rewrite-per-write performance
risk. The plan resolves it **only for `DigitalTestSession.submissions`**
(exploded to subcollection — good) but leaves three other flagged fat docs as
hedges:

- `StoryPointProgressDoc.items` — "kept but **flagged for per-item docs if
  large**" (undecided).
- `SpaceProgress.storyPoints` summary map — "kept" (this is the doc
  `spaceProgressLive` listens on per PC-2, rewritten on every progress write).
- `ChatSession.messages` — "`ChatMessage[]` (or `messages/` subcollection)"
  (undecided, per PC-3).

"If large" / "or subcollection" are non-decisions. `SpaceProgress` is written by
`progressUpdater` on **every** attempt/submission and read by a realtime
listener — it is the single hottest write+read doc in the system, and it is left
as an inline summary map that grows with the number of story points. For a
48-story-point space (per MEMORY: real spaces have 48 SP), the per-write
rewrite + per-listener re-push compounds with PC-2 and PC-5.

**Resolution.** Convert the hedges to decisions before freeze: (1)
`StoryPointProgressDoc.items` → per-item docs (or a hard documented cap on
items-per-storypoint), (2) `SpaceProgress.storyPoints` → keep the _summary_ doc
small and bounded (one numeric per story point, no nested per-item state) and
explicitly cap it, with the live listener targeting a slim projection (PC-2),
(3) chat → always subcollection (PC-3). Add a contract/schema assertion that
progress/session/chat docs have no unbounded array/map field. The single-writer
principle protects integrity but not doc-size; size needs its own decided rule.

---

## PC-14 — No request coalescing / dedupe story for the `spaceDetailViewRepo` and view-repo composite reads; "one shaped call" is a repo abstraction over multiple callables, not one network round-trip

- **Severity:** MINOR
- **Where:** `levelup-content.md §spaceDetailViewRepo` L113 ("collapsing what is
  today a `listStoryPoints` + N×`listItems` + `getSpaceProgress` fan-out into
  one batched repo call"), `autograde.md §gradingReviewRepo` L262–267,
  `SDK-LAYERS-PLAN.md §1.2(b)`.

**Problem.** The view repos are described as collapsing fan-out into "one
batched repo call," but the underlying callables remain separate
(`getSubmission` + `listQuestionSubmissions` + `listQuestions` for
`getReviewBundle`; `listStoryPoints` + N×`listItems` + `getSpaceProgress` for
`spaceDetailView`). A repo method that internally issues 3+ callables is still
3+ network round-trips — the N+1 is collapsed at the _call-site ergonomics_
layer, not at the _network_ layer. `spaceDetailViewRepo` specifically still does
**N×`listItems`** (one per story point) inside the repo — that is the exact N+1
it claims to kill, just moved behind the repo boundary. Nothing in the plan
provides a server-side composite endpoint (e.g.
`getSpaceDetail {spaceId} → {space,storyPoints,itemsByStoryPoint,myProgress}`)
or a batch-invoke transport primitive, so "one batched call" is aspirational.

**Resolution.** For the dashboard composites that are genuinely 1+N
(spaceDetailView), add a **server composite callable** that returns the
assembled view in one round-trip (the server does the batched read with
`getAll`, applies projections once). For the others (gradingReviewBundle = 3
fixed reads), either accept 3 parallel round-trips (document it) or add a
composite callable. Clarify in §1.2(b) that "N+1 collapse" means a **single
network call**, and that any view repo issuing O(N) callables is a violation —
back the O(N) ones with server composites.

---

## PC-15 — `searchUsers` and cross-tenant super-admin lists rely on `where('uid','in',...)` batching that silently caps at Firestore's 10-element `in` limit

- **Severity:** MINOR
- **Where:** `identity.md §searchUsersService` L275 ("batched membership
  `where('uid','in',...)`"), L143 (`searchUsers … batched, no N+1`),
  `repository-admin` `getMany` ("`where('id','in',chunks of 10)`").

**Problem.** The N+1-collapse mechanism throughout is
`where('id'|'uid','in', chunk)` — correct, but Firestore caps `in` at 10 (now 30
in newer SDKs, still bounded). The plan's `getMany` says "chunks of 10" (good,
it chunks), but `searchUsersService` and several view repos describe a single
`where('uid','in',...)` without stating the chunking, and the membership join
for a user with many memberships, or a class roster batch of 200 students,
becomes 20 sequential/parallel `in` queries. That's not O(1) — it's O(N/10)
reads. The plan presents these as "no N+1" when they are bounded-fan-out. For
the hot paths (class roster of 200, platform user search) the read amplification
is real and unstated.

**Resolution.** State the chunking + concurrency explicitly for every `in`-based
batch (chunks of 10/30, `Promise.all` the chunks), and cap the batch size (a
`getMany` of 2,000 ids is 200 queries — page it instead). For class rosters
specifically, prefer paginating `listStudents{classId}` over a single `getClass`
roster batch (ties to PC-4). Document `getMany`'s max ids and that beyond it the
caller must paginate.

---

## Summary of severities

| ID    | Severity | Theme                                                                       |
| ----- | -------- | --------------------------------------------------------------------------- |
| PC-1  | MAJOR    | examGrading realtime = full-doc collection listener (fat-doc fan-out)       |
| PC-2  | MINOR    | live listeners target fat authoritative docs, not slim projections          |
| PC-3  | MAJOR    | getChatSession unbounded inline messages, no pagination, D6 undecided       |
| PC-4  | MAJOR    | several list callables unpaginated; "every list paginates" claim unenforced |
| PC-5  | MAJOR    | invalidation still coarse-by-domain-root; refetch storms on hot ⚷ writes    |
| PC-6  | MINOR    | residual per-child getChildSummary N+1 on comparison/alerts screens         |
| PC-7  | MINOR    | at-risk recipient denorm (teacherUids/parentUids) undefined/unmaintained    |
| PC-8  | MINOR    | listSubmissions denorm student fields unowned (stale on rename/transfer)    |
| PC-9  | MINOR    | platform-summary aggregation undecided; per-load multi-collection .count()  |
| PC-10 | MINOR    | getPerformanceTrends on-the-fly scan undecided, uncached                    |
| PC-11 | MINOR    | uniform 30s staleTime applied to expensive slow-changing aggregations       |
| PC-12 | MINOR    | `total` cost contract unspecified; risks .count()-per-page                  |
| PC-13 | MAJOR    | D6 1MB-doc risk left as hedges for hottest doc (SpaceProgress) + chat       |
| PC-14 | MINOR    | view-repo "one batched call" is N round-trips, not a server composite       |
| PC-15 | MINOR    | `in`-batching is O(N/10) bounded fan-out, presented as "no N+1"             |
