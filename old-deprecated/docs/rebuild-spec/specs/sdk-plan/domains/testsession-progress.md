# Domain Plan — Test Sessions + Progress

> **Domain key:** `testsession-progress` **Module:** `levelup` (callables are
> `v1.levelup.*`); functions codebase `functions/levelup`. **Scope:** the
> server-authoritative _runtime_ of digital tests/quizzes/practice
> (`DigitalTestSession`) and the _learning-progress_ aggregation that every
> attempt feeds (`SpaceProgress`, `StoryPointProgress`, item-level progress),
> plus the cross-system materialized summaries (`StudentProgressSummary`,
> `ClassProgressSummary`) and the personalised `LearningInsight` stream read by
> the learner/parent/teacher dashboards.
>
> **Owns the callables:** `startTestSession`, `submitTestSession`,
> `evaluateAnswer`, `recordItemAttempt`, plus the new read endpoints
> `getTestSession` / `listTestSessions` / `getSpaceProgress` /
> `getStoryPointProgress` / `listLearningInsights` / `dismissInsight`. **Does
> NOT own:** space/storyPoint/item authoring
> (`saveSpace`/`saveStoryPoint`/`saveItem`), answer-key write/strip, chat,
> store/purchase, exam grading — those are sibling domains. This domain
> _consumes_ the resolved item + rubric + answer-key those domains produce, and
> _writes_ progress.
>
> Grounded in: `SDK-SERVER-DESIGN.md` (layer cake, §3 service model, §4
> authority table), `common-api.md` (§3.3 levelup inventory, §5 client, §6
> errors, §7 pagination, §5.4 idempotency, §5.5 optimistic, §5.6 realtime),
> `REVIEW-domain-data-model.md` (§6 authority items #5/#6/#9, drift
> D4/D6/D9/D11/D12), and `be-levelup.md` (§1.1 inventory, §3 strengths, §4 pain
> points, §5 recs).

---

## Domain entities (`@levelup/domain`)

All entities are **Zod-first**, authored as `z.object(...).strict()`, with types
via `z.infer`. Every persisted ID is a **branded** ID. Every timestamp is the
domain `Timestamp` = **ISO-8601 string** (`z.string().datetime()` → branded
`IsoTimestamp`) — this collapses the live trichotomy (`FirestoreTimestamp` on
session audit, **epoch-millis number** on
`submittedAt`/`AttemptRecord.timestamp`/ `progress.lastUpdatedAt`, ISO on chat)
into one wire convention (REVIEW D4). The Firestore admin adapter is the single
edge that converts Firestore `Timestamp` ↔ ISO; clients only ever see ISO.

### Branded IDs (in `@levelup/domain/ids`)

- `TestSessionId`, `SpaceId`, `StoryPointId`, `ItemId`, `UserId` (alias
  `StudentId` where the actor is a learner), `TenantId`, `ClassId`, `InsightId`.
- `SpaceProgressId` = composite `{userId}_{spaceId}` (branded; explicit
  `userId`/`spaceId` fields also present so a future `_`-in-id edge can't break
  it — REVIEW §5 composite-key note).

### Enums (exported `as const` + `z.enum`)

- `TestSessionStatus = ['in_progress','completed','expired','abandoned']`.
- `TestSessionType = ['timed_test','quiz','practice']` — **drift
  reconciliation:** the live `StoryPointType` carries both `timed_test` **and**
  `test` as synonyms (be-levelup §4.2 / REVIEW D5-adjacent); the session type
  union is collapsed to **one value per concept** here (`timed_test`, never
  `test`). A `storyPointTypeToSessionType()` helper in repositories maps the
  authoring enum down to this runtime enum.
- `QuestionStatus = ['not_visited','not_answered','answered','marked_for_review','answered_and_marked']`
  (the 5-status model).
- `ProgressStatus = ['not_started','in_progress','completed']`.
- `QuestionProgressStatus = ['pending','correct','incorrect','partial']`.
- `Difficulty = ['easy','medium','hard']` (adaptive) / authoring
  `['easy','medium','hard','expert']` lives in the authoring domain.
- `AtRiskReason = ['low_exam_score','no_recent_activity','low_space_completion','declining_performance','zero_streak']`.
- `InsightType`, `InsightActionType`, `InsightPriority` (see `LearningInsight`).
- `MistakeClassification = ['Conceptual','Silly Error','Knowledge Gap','None']`.

### `DigitalTestSession` (`domain/levelup/test-session.ts`)

- **Collection:** `tenants/{tenantId}/digitalTestSessions/{sessionId}`. Branded
  `id: TestSessionId`.
- Key fields: `userId`, `spaceId`, `storyPointId`,
  `sessionType: TestSessionType`, `attemptNumber:int`, `status`, `isLatest`,
  `startedAt`, `endedAt?`, `durationMinutes`, **`serverDeadline?`** (ISO, server
  clock), `totalQuestions`, `answeredQuestions`, `questionOrder: ItemId[]`.
- **Field-name drift reconciliation (REVIEW D12):** schema↔interface drift
  listed `sessionType/serverDeadline` vs schema `type/deadline`. Canonicalize on
  **`sessionType`** and **`serverDeadline`** (the live interface names); the old
  schema names `type`/`deadline` are deleted.
- **Record-map → subcollection split (REVIEW D6, be-levelup §4.11 / rec #9).**
  Live stores `visitedQuestions`, `submissions`, `markedForReview` as
  `Record<string,…>` maps inside the 1-doc — 1 MB risk + full-doc rewrite per
  answer. The domain models the **parent session doc WITHOUT the heavy
  `submissions` map**, and adds a `TestSubmission` **subcollection** entity:
  - `DigitalTestSession` keeps lightweight
    `visitedQuestions: Record<ItemId,boolean>` and
    `markedForReview: Record<ItemId,boolean>` (small booleans, bounded by
    `questionOrder.length`) — acceptable inline.
  - `TestSubmission` becomes its own entity at
    `…/digitalTestSessions/{sessionId}/submissions/{itemId}`: `itemId`,
    `questionType`, `answer: z.unknown()` (opaque payload), `submittedAt`,
    `timeSpentSeconds`, and **post-grade**
    `evaluation?: UnifiedEvaluationResult`, `correct?`, `pointsEarned?`,
    `totalPoints?`.
  - _Open question carried below:_ whether v1 keeps the inline `submissions` map
    for small tests and only explodes for large ones; recommend
    always-subcollection for a single code path.
- Scores (server-computed on submit): `pointsEarned?`, `totalPoints?`,
  `marksEarned?`, `totalMarks?`, `percentage?`. **Points-model reconciliation
  (be-levelup §4.4 / rec #5):** the live dual points/marks +
  `meta.totalPoints ?? payload.basePoints` fallback is consolidated server-side
  into a single authoritative `pointsEarned/totalPoints` written by the progress
  writer; `marksEarned/totalMarks` becomes an optional derived projection
  (`marks = points * weight`), never client-supplied.
- `sectionMapping?: Record<ItemId,string>`, `lastVisitedIndex?`.
- Adaptive:
  `adaptiveState?: AdaptiveState { currentDifficulty, consecutiveCorrect, consecutiveIncorrect, answeredByDifficulty }`,
  `currentDifficultyLevel?`,
  `difficultyProgression?: { questionIndex, difficulty, correct }[]`.
- `analytics?: TestAnalytics { topicBreakdown, bloomsBreakdown, difficultyBreakdown, sectionBreakdown, timePerQuestion, averageTimePerQuestion }`
  where each breakdown value is
  `AnalyticsBreakdownEntry { correct, total, points?, maxPoints? }`.
- Audit: `submittedAt?`, `autoSubmitted?`, `createdAt`, `updatedAt`.
- **Authority fields (server-only ⚷, REVIEW §6 #6):** `serverDeadline`,
  `isLatest`, `attemptNumber`, all `QuestionStatus`/visited/marked transitions,
  adaptive ordering, and all score fields are **server-written**. The SDK reads
  them; never writes them.

### `TestSubmission` (`domain/levelup/test-submission.ts`)

- Sub-entity of a session (see above). `.strict()`. `answer: z.unknown()` is the
  only intentionally-open field (validated against the item's question type
  **server-side** at grade time, not at the wire boundary, because the union is
  per-question).

### `SpaceProgress` (`domain/levelup/space-progress.ts`)

- **Collection:** `tenants/{tenantId}/spaceProgress/{userId}_{spaceId}`. Branded
  `id: SpaceProgressId`, plus explicit `userId`, `spaceId`.
- **Index/rule field reconciliation (REVIEW D14):** live `spaceProgress` index
  keys `studentId` but the rule reads `userId`. Canonicalize on **`userId`**
  (the entity already uses `userId`); the index must be regenerated to key
  `userId`. Noted in Drift.
- Fields: `status: ProgressStatus`, aggregate `pointsEarned`, `totalPoints`,
  `marksEarned?`, `totalMarks?`, `percentage`, `startedAt?`, `completedAt?`,
  `updatedAt`.
- `storyPoints: Record<StoryPointId, StoryPointProgress>` — **kept as an inline
  summary map** (bounded by storyPoint count, small). The heavy per-item detail
  is **NOT** here.

### `StoryPointProgress` (embedded summary) + `StoryPointProgressDoc` (subcollection)

- `StoryPointProgress` (value object embedded in `SpaceProgress.storyPoints`):
  `storyPointId`, `status`, `pointsEarned`, `totalPoints`, `percentage`,
  `completedItems`, `totalItems`, `completedAt?`.
- `StoryPointProgressDoc` (`domain/levelup/story-point-progress.ts`) at
  `…/spaceProgress/{userId}_{spaceId}/storyPointProgress/{storyPointId}`: same
  summary fields + `updatedAt` + `items: Record<ItemId, ItemProgressEntry>`.
  - **Hot-doc reconciliation (be-levelup §4.11 / rec #9):** the `items` map is
    the growth risk. v1 keeps the map (bounded per storyPoint) but the domain
    marks it as a candidate for per-item docs if a storyPoint exceeds a
    threshold; the repository view never returns the full map to dashboards —
    only the summary fields.

### `ItemProgressEntry` (`domain/levelup/item-progress.ts`)

- `itemId`, `itemType`, `completed`, `completedAt?`, `timeSpent?`,
  `interactions?`, `lastUpdatedAt`.
- Question-specific:
  `questionData?: QuestionProgressData { status, attemptsCount, bestScore, pointsEarned, totalPoints, percentage, solved, latestScore?, latestStatus? }`.
- Material-specific: `progress?`, `score?`, `feedback?`.
- Revisit display: `lastAnswer?: z.unknown()`,
  `lastEvaluation?: StoredEvaluation`, `attempts?: AttemptRecord[]` (capped at
  20).

### `StoredEvaluation` (`domain/content/stored-evaluation.ts`)

- Compact projection of `UnifiedEvaluationResult` for revisit display: `score`,
  `maxScore`, `correctness`, `percentage`, `strengths[]`, `weaknesses[]`,
  `missingConcepts[]`, `summary?: { keyTakeaway, overallComment }`,
  `mistakeClassification?`.
- **`.nullish()` reconciliation:** the live request schema uses `.nullish()`
  because the Firebase callable SDK encodes `undefined → null`. In the domain
  entity these are `.optional()`; the **api-contract request schema** is the
  layer that uses `.nullish()` + a normalizer so the wire null collapses to
  optional. Domain stays clean.
- **Authority note (REVIEW §6 #5):** this is a _grading output_. The SDK may
  read it (released/own-progress projection) but never writes it as
  authoritative score — `recordItemAttempt` accepts it only as display-cache
  data while the server still owns the canonical attempt score.

### `AttemptRecord` (`domain/levelup/attempt-record.ts`)

- `attemptNumber`, `answer: z.unknown()`, `evaluation: StoredEvaluation`,
  `score`, `maxScore`, `timestamp` (ISO — was epoch-millis in live, REVIEW D4).

### `StudentProgressSummary` (`domain/progress/student-summary.ts`)

- **Collection:** `tenants/{tenantId}/studentProgressSummaries/{studentId}`.
  Branded `id`, `studentId`.
- `autograde: StudentAutogradeMetrics { totalExams, completedExams, averageScore, averagePercentage, totalMarksObtained, totalMarksAvailable, subjectBreakdown: Record<string,{avgScore,examCount}>, recentExams: RecentExamEntry[] }`.
- `levelup: StudentLevelupMetrics { totalSpaces, completedSpaces, averageCompletion, totalPointsEarned, totalPointsAvailable, averageAccuracy, streakDays, subjectBreakdown, recentActivity }`.
- Cross-system: `overallScore` (weighted 0-1), `strengthAreas[]`,
  `weaknessAreas[]`, `isAtRisk`, `atRiskReasons[]`, `lastUpdatedAt`.
- **Authority (REVIEW §6 #9):** trigger-maintained denormalized summary; SDK
  reads, never writes. (Authored by the **analytics** domain trigger; surfaced
  here because this domain's reads consume it for learner/parent dashboards.
  Cross-domain ownership noted in Drift.)

### `ClassProgressSummary` (`domain/progress/class-summary.ts`)

- `tenants/{tenantId}/classProgressSummaries/{classId}`. Fields per live:
  `className`, `studentCount`, `autograde: ClassAutogradeMetrics`,
  `levelup: ClassLevelupMetrics`, `atRiskStudentIds[]`, `atRiskCount`,
  `lastUpdatedAt`. Trigger-maintained (analytics). Server-only write.

### `LearningInsight` (`domain/progress/insight.ts`)

- `tenants/{tenantId}/insights/{insightId}`. `studentId`, `type: InsightType`,
  `priority: InsightPriority`, `title`, `description`,
  `actionType: InsightActionType`, `actionEntityId?`, `actionEntityTitle?`,
  `createdAt`, `dismissedAt?`. Generated by the analytics insight engine; this
  domain exposes **read** + **dismiss**.

### ALLOWED_TRANSITIONS state machines (build-time-checked data, in api-contract but authored against these enums)

- `ALLOWED_TRANSITIONS.testSession`:
  - `in_progress → ['completed','expired','abandoned']`
  - `completed → []` (terminal)
  - `expired → []` (terminal)
  - `abandoned → []` (terminal)
  - A build-time assertion checks union members === `TestSessionStatus` enum
    (REVIEW open-Q / risk #5).
- `ALLOWED_TRANSITIONS.progress` (advisory, monotone-ish):
  `not_started → in_progress`, `in_progress → completed`, plus idempotent
  re-entry `completed → completed` (best-score retention re-writes allowed). The
  server enforces best-score monotonicity, not a hard FSM.
- No transition machine for `StoryPointProgress`/summaries (derived projections,
  not lifecycle).

---

## API contract (`@levelup/api-contract`)

All `CallableDef`s. **No request schema contains `tenantId`** (REVIEW #1 / D2 —
derived from claims). `invalidates[]` are query-key roots (hints for hooks).
`rateTier` per `common-api §9`.

### Writes / runtime

**`startTestSessionDef`** — `name: 'v1.levelup.startTestSession'`, module
`levelup`.

- Request: `{ spaceId: SpaceId, storyPointId: StoryPointId }`.
- Response: `{ session: DigitalTestSessionView }` — the **answer-key-free**
  session projection: `id`, `sessionType`, `status`, `questionOrder`,
  `totalQuestions`, `durationMinutes`, `serverDeadline`, `attemptNumber`,
  `isLatest`, plus the per-question item _prompts_ (no answer keys, no rubric
  guidance), `visitedQuestions`, `markedForReview`, and (on resume) prior
  `submissions` answers. Never includes
  `AnswerKey`/`evaluatorGuidance`/`modelAnswer`.
- `authMode: 'authed'`, `rateTier: 'write'`, `idempotent: true` (dedupe on
  `(uid, spaceId, storyPointId)` resume; common-api §5.4).
- `invalidates: ['testSessions','spaceProgress']`.

**`submitTestSessionDef`** — `name: 'v1.levelup.submitTestSession'`.

- Request: `{ sessionId: TestSessionId, autoSubmitted?: boolean }`.
- Response:
  `{ session: DigitalTestSessionResultView, progressUpdated: boolean }` — result
  view = scores, percentage, `analytics` breakdowns, per-question
  `correct`/`pointsEarned`/`evaluation` **(StoredEvaluation projection only)**;
  AI-pending items flagged `evaluation: null, pending: true`.
- `authMode: 'authed'`, `rateTier: 'write'`, `idempotent: true` (dedupe on
  `(uid, sessionId)` — re-submit returns the already-computed result, REVIEW
  open / be-levelup §4.12).
- `invalidates: ['testSessions','spaceProgress','storyPointProgress','studentSummary']`.

**`evaluateAnswerDef`** — `name: 'v1.levelup.evaluateAnswer'`.

- Request:
  `{ spaceId: SpaceId, storyPointId?: StoryPointId, itemId: ItemId, answer: z.unknown(), mediaUrls?: string.url()[] (max 20) }`.
- Response: `{ evaluation: StoredEvaluation, progressRecorded: boolean }` —
  **rebuild change (be-levelup rec #7 / common-api §3.3):** evaluateAnswer now
  **persists progress server-side** in the same call (no second
  `recordItemAttempt` round-trip). The response carries the compact
  `StoredEvaluation`, never the raw `UnifiedEvaluationResult` with cost/internal
  fields.
- `authMode: 'authed'`, `rateTier: 'ai'` (it may invoke Gemini),
  `idempotent: true` (dedupe on `(uid, spaceId, itemId, answerHash)`).
- `invalidates: ['storyPointProgress','spaceProgress']`.

**`recordItemAttemptDef`** — `name: 'v1.levelup.recordItemAttempt'`.

- Request:
  `{ spaceId, storyPointId, itemId, itemType: string, score: number, maxScore: number, correct: boolean, timeSpent?: number, feedback?: string, answer?: z.unknown(), evaluationData?: StoredEvaluationRequestSchema (.nullish-normalized) }`.
  **No deterministic answer-key check here** — this is the _non-test
  practice/standard_ path (auto-evaluated client-readable types only);
  authority-sensitive scoring still re-validated server-side against the item.
- Response: `{ progress: StoryPointProgressView, completed: boolean }`.
- `authMode: 'authed'`, `rateTier: 'write'`, `idempotent: true` (dedupe on
  `(uid, spaceId, storyPointId, itemId, attemptNumber)`).
- `invalidates: ['storyPointProgress','spaceProgress','studentSummary']`.
- **Optimistic allow-list ✅** (common-api §5.5): practice progress / item
  attempt.

**`dismissInsightDef`** — `name: 'v1.levelup.dismissInsight'`.

- Request: `{ insightId: InsightId }`. Response:
  `{ id: InsightId, dismissed: true }`.
- `authMode: 'authed'`, `rateTier: 'write'`, `idempotent: true`.
- `invalidates: ['learningInsights']`. **Optimistic allow-list ✅** (mark-read
  class).

### Reads (replace all direct Firestore reads in student/parent/teacher UI)

**`getSpaceProgressDef`** — `name: 'v1.levelup.getSpaceProgress'`.

- Request: `{ spaceId: SpaceId, userId?: UserId }` (`userId` honored only for
  teacher/parent reading another learner — server authorizes; learner reads own
  when omitted). Response: `{ progress: SpaceProgressView | null }` (aggregate +
  storyPoint summaries; no item maps).
- `authMode: 'authed'`, `rateTier: 'read'`.

**`getStoryPointProgressDef`** — `name: 'v1.levelup.getStoryPointProgress'`.

- Request: `{ spaceId, storyPointId, userId? }`. Response:
  `{ progress: StoryPointProgressDocView | null }` (item-level detail, with
  `lastEvaluation`/`attempts` projected by released/own-data policy).
- `authMode: 'authed'`, `rateTier: 'read'`.

**`getTestSessionDef`** — `name: 'v1.levelup.getTestSession'`.

- Request: `{ sessionId: TestSessionId }`. Response:
  `{ session: DigitalTestSessionView }` (live runtime view — answer-key-free;
  result fields populated if `status !== 'in_progress'`).
- `authMode: 'authed'`, `rateTier: 'read'`.

**`listTestSessionsDef`** — `name: 'v1.levelup.listTestSessions'`.

- Request:
  `PageRequest & { spaceId?: SpaceId, storyPointId?: StoryPointId, userId?: UserId, status?: TestSessionStatus, latestOnly?: boolean }`.
- Response: `pageResponse(DigitalTestSessionSummary)` (id, sessionType, status,
  attemptNumber, percentage, submittedAt — no submissions).
- `authMode: 'authed'`, `rateTier: 'read'`.

**`listLearningInsightsDef`** — `name: 'v1.levelup.listLearningInsights'`.

- Request:
  `PageRequest & { studentId?: UserId, type?: InsightType, includeDismissed?: boolean }`.
- Response: `pageResponse(LearningInsight)`.
- `authMode: 'authed'`, `rateTier: 'read'`.

### SUBSCRIPTIONS (realtime seam — common-api §10 / SDK §5.6)

- **`'v1.levelup.testSessionDeadline'`** — `params: { sessionId }`,
  `payload: TestSessionLiveSchema { status, serverDeadline, answeredQuestions, remainingMs? }`.
  Drives the live countdown; deadline stays **server-authoritative**
  (`serverDeadline` + `/serverTimeOffset`), the subscription only streams the
  authoritative value (REVIEW §6 #6). Paired with a thin `useServerTime()` over
  the RTDB offset doc (SDK §7.1 open-Q resolution).
- **`'v1.levelup.spaceProgressLive'`** _(optional, dashboard)_ —
  `params: { spaceId, userId }`, `payload: SpaceProgressView`. Lets the learner
  home reflect a just-completed attempt without refetch. Marked optional for v1.

---

## Repositories (`@levelup/repositories`)

Per-entity repos + cross-entity "view" repos. Repos own shaping, batching/N+1
collapse, cursor mgmt, and `ALLOWED_TRANSITIONS` pre-checks. They never touch
Firestore — only `api`.

### `testSessionRepo` (`repositories/test-session-repo.ts`)

- `start(input: { spaceId, storyPointId })` → `api.levelup.startTestSession`.
  Maps authoring `StoryPointType → TestSessionType` via
  `storyPointTypeToSessionType()` for UX labelling (server still derives
  authoritatively).
- `submit(input: { sessionId, autoSubmitted? })` →
  `api.levelup.submitTestSession`.
- `get(id: TestSessionId)` → `api.levelup.getTestSession`.
- `list(filter)` →
  `paginate(cursor => api.levelup.listTestSessions({ ...filter, cursor }))` —
  opaque cursor hidden.
- `evaluate(input)` → `api.levelup.evaluateAnswer` (single-answer practice
  eval).
- **Derived/pre-check helpers (UX only, server enforces):**
  - `canSubmit(session)` →
    `ALLOWED_TRANSITIONS.testSession[session.status].includes('completed')`.
  - `isExpired(session, serverNow)` → compares `serverDeadline` to injected
    server time (never client clock — REVIEW §6 #6).
  - `remainingMs(session, serverNow)`, `answeredCount(session)`,
    `progressPct(session)`.
  - `groupBySection(session)` — assembles the section→questions view-model from
    `sectionMapping` once.
- **Shaping:** assembles the test-runtime view-model (question order +
  per-question status from `visitedQuestions`/`markedForReview`/`submissions`)
  the UI renders, shared across web learner + learner-rn.

### `progressRepo` (`repositories/progress-repo.ts`)

- `getSpace(spaceId, userId?)` → `api.levelup.getSpaceProgress`.
- `getStoryPoint(spaceId, storyPointId, userId?)` →
  `api.levelup.getStoryPointProgress`.
- `recordAttempt(input)` → `api.levelup.recordItemAttempt`.
- **Derived fields (computed once, UI never recomputes — SDK §1.2(e)):**
  - `completionPct(spaceProgress)`, `overallScore(spaceProgress)` (points
    blend), `storyPointSummaries(spaceProgress)` (sorted, status-decorated).
  - `isStoryPointComplete(sp)`,
    `nextIncompleteStoryPoint(spaceProgress, storyPoints)`.
  - `attemptHistory(itemProgress)` (caps/sorts the 20-attempt array for
    display).

### `learningInsightRepo` (`repositories/insight-repo.ts`)

- `list(filter)` → `paginate(...)`; `dismiss(insightId)` →
  `api.levelup.dismissInsight`.
- `groupByPriority(insights)` derived.

### `studentSummaryRepo` (cross-entity **view** repo) (`repositories/student-summary-repo.ts`)

- `get(studentId)` → reads `StudentProgressSummary` via analytics read endpoint
  (cross-domain; see analytics plan). Exposed here because learner/parent
  dashboards in this domain consume it.
- **Batching / N+1 collapse (SDK §1.2(b), REVIEW parent fan-out):**
  `getMany(studentIds)` collapses parent-web's per-child fan-out into one
  batched read; `classView(classId)` assembles `ClassProgressSummary` + member
  summaries in one shaped call. Marked a **view repo** — may aggregate across
  domains but not be imported by other repos.

---

## Query hooks (`@levelup/query`)

Query-key factories + invalidation graph. Optimistic allow-list strictly per
common-api §5.5.

### Key factories

```
testSessionKeys = { all:['testSessions'], detail:(id), list:(f) }
progressKeys    = { all:['progress'], space:(spaceId,userId?), storyPoint:(spaceId,spId,userId?) }
insightKeys     = { all:['learningInsights'], list:(f) }
studentSummaryKeys = { all:['studentSummary'], detail:(studentId) }
```

### Hooks

- `useStartTestSession()` — mutation → `repos.testSession.start`; **NOT
  optimistic** (lifecycle/authority). onSuccess → invalidate
  `testSessionKeys.all`, `progressKeys.space(...)`.
- `useSubmitTestSession()` — mutation; **NOT optimistic** (grading authority —
  §4 ⚷). onSuccess → invalidate `testSessionKeys.all`,
  `progressKeys.space/.storyPoint`, `studentSummaryKeys.detail`.
- `useEvaluateAnswer()` — mutation; **NOT optimistic** (server computes score).
  onSuccess → invalidate `progressKeys.storyPoint`, `progressKeys.space`.
- `useRecordItemAttempt()` — mutation; **✅ conservative optimistic** (practice
  progress): optimistically bump the item's `questionData`/`completed` in the
  cached `storyPointProgress`, rollback on error, trust server value on success.
  Invalidate `progressKeys.*`, `studentSummaryKeys.detail`.
- `useDismissInsight()` — mutation; **✅ optimistic** (mark-read class):
  optimistically set `dismissedAt`, rollback on error. Invalidate
  `insightKeys.all`.
- `useSpaceProgress(spaceId, userId?)` — query.
- `useStoryPointProgress(spaceId, spId, userId?)` — query.
- `useTestSession(sessionId)` — query (often paired with the realtime hook).
- `useTestSessions(filter)` — infinite query (`fetchNextPage`, never sees
  cursor).
- `useLearningInsights(filter)` — infinite query.
- `useStudentSummary(studentId)` — query (cross-domain view).
- `useTestSessionDeadline(sessionId)` —
  `useSubscription('v1.levelup.testSessionDeadline', { sessionId })`; paired
  `useServerTime()` over the RTDB offset doc (SDK §7.1).

**Allow-list summary:** optimistic ONLY on `useRecordItemAttempt` and
`useDismissInsight`. Everything session/grading/lifecycle is round-trip (lint
rule flags optimistic config on ⚷ mutations — SDK §7.2).

---

## Server services (`@levelup/services/{shared,server}`)

Every service is `fn(input, ctx: AuthContext): Promise<output>`, never imports
`firebase-functions`. `tenantId` from `ctx`, never input.
`authorize(ctx, policyKey, resource)` from `@levelup/access`.

### `services/server` (server-only — touch answer keys / grading / counters / clock)

- **`startTestSessionService`** —
  `authorize(ctx,'testSession.start',{spaceId,storyPointId})`; loads
  storyPoint + assessmentConfig; enforces **max-attempts + retry-cooldown +
  lock-after-passing**; resumes an active `isLatest` session if present;
  computes **`serverDeadline`** from `ctx.now()` + duration;
  shuffles/adaptive-orders `questionOrder`; **strips answer keys** from the
  returned item prompts. Writes the session via the repository admin adapter.
  Single-writer of `serverDeadline`/`attemptNumber`/`isLatest`. (REVIEW §6 #6.)
- **`submitTestSessionService`** —
  `authorize(ctx,'testSession.submit',{sessionId})`; validates against
  `serverDeadline` (+30s grace) using `ctx.now()`; **batch-loads answer keys**
  with `getAll` (be-levelup rec #8, collapses the per-question N+1);
  deterministic auto-grade for `AUTO_EVALUATABLE_TYPES`; flags
  `AI_EVALUATABLE_TYPES` as pending; computes scores + `computeTestAnalytics`;
  **delegates the canonical progress write to `progressUpdaterService`** (single
  transactional writer); idempotent on `(uid, sessionId)`. Asserts
  `ALLOWED_TRANSITIONS.testSession` `in_progress→completed`.
- **`evaluateAnswerService`** —
  `authorize(ctx,'item.evaluate',{spaceId,itemId})`; deterministic auto-eval if
  the type allows, else resolves rubric+agent and calls `@levelup/ai` (Gemini);
  **wires `mediaUrls` into the multimodal call** (be-levelup rec #10, fixes the
  URLs-as-text placeholder); **persists progress in the same call** via
  `progressUpdaterService` (rec #7); returns compact `StoredEvaluation` only
  (cost/internal fields projected out — REVIEW §6 #5/#7).
- **`recordItemAttemptService`** —
  `authorize(ctx,'item.attempt',{spaceId,itemId})`; re-validates the claimed
  score is consistent with the item server-side (client cannot self-grade
  authority types); delegates to `progressUpdaterService`; idempotent on attempt
  key.
- **`progressUpdaterService`** (the BRAIN of this domain — be-levelup §3.3
  strongest piece, kept) — the **single transactional progress writer**.
  Best-score retention, two-tier aggregation (item → storyPoint → space),
  completion detection, attempt-history cap (20), RTDB leaderboard sync.
  **Single-writer per derived value** (SDK §3 async rules); idempotent handler.
  Called by submit / evaluate / record — never bypassed.
- **`getTestSessionService` / `listTestSessionsService`** — read +
  **answer-key-free / released-projection** shaping (REVIEW §6 #5/#6);
  teacher/parent reading another user gated by
  `authorize(ctx,'progress.readOther',...)`.
- **`getSpaceProgressService` / `getStoryPointProgressService`** — reads with
  role-scoped projection (own-data vs teacher/parent; parent gated on
  `ctx.studentIds` — REVIEW §5 parent linkage, §6 #9).

### `services/shared` (client-safe pure logic — no secrets/keys)

- `storyPointTypeToSessionType(type)` — authoring→runtime enum mapping (drift
  collapse).
- `assertTestSessionTransition(from, to)` — reads
  `ALLOWED_TRANSITIONS.testSession` (also used client-side pre-check).
- `computeTestAnalytics(submissions, items)` — pure breakdown computation
  (shareable; no keys).
- `autoEvaluateDeterministic(item, answer)` — deterministic grading for the 9
  `AUTO_EVALUATABLE_TYPES` **that do not require the secret answer key beyond
  what is server-supplied** (note: the answer-key fetch itself is server-only;
  the pure scoring math is shared).

> **policy keys used:** `testSession.start`, `testSession.submit`,
> `item.evaluate`, `item.attempt`, `progress.readOther`, `insight.list`,
> `insight.dismiss`.

---

## Function shells (callable / trigger / scheduler)

Thin `onCall` adapters: `ctx = buildAuthContext(request.auth)` →
`input = parseRequest(data, Schema)` → service.

### Callable shells (`functions/levelup/src/callable/`)

- `v1.levelup.startTestSession` → `startTestSessionService`
- `v1.levelup.submitTestSession` → `submitTestSessionService`
- `v1.levelup.evaluateAnswer` → `evaluateAnswerService`
- `v1.levelup.recordItemAttempt` → `recordItemAttemptService`
- `v1.levelup.getTestSession` → `getTestSessionService`
- `v1.levelup.listTestSessions` → `listTestSessionsService`
- `v1.levelup.getSpaceProgress` → `getSpaceProgressService`
- `v1.levelup.getStoryPointProgress` → `getStoryPointProgressService`
- `v1.levelup.dismissInsight` → `dismissInsightService` _(or routed to
  analytics; see Drift)_
- `v1.levelup.listLearningInsights` → `listLearningInsightsService` _(read; may
  proxy analytics)_

### Triggers (`functions/levelup/src/triggers/`) — single-writer, idempotent, outbox for must-deliver

- **`onTestSessionExpired`** — _scheduler-backed_ (see below) but the
  **expiry+grade transition** is a single-writer service
  (`expireAndGradeSessionService`) so the scheduler and any manual reaper share
  one path; idempotent (`status` guard: only `in_progress` → `expired`).
- **`onSubmissionGraded`** (AI-pending completion) — when an async AI evaluation
  finishes for a flagged session item, a single-writer trigger merges the
  `evaluation` into the `TestSubmission` subdoc and re-runs
  `progressUpdaterService` for that item; idempotent on
  `(sessionId,itemId,evaluationId)`. **Outbox** for the "your test was graded"
  notification (reliable, not fire-and-forget — be-levelup rec #6).
- **`onSpaceProgressUpdated`** → enqueues `recomputeStudentRollup` (analytics
  queue) so `StudentProgressSummary` stays current (cross-domain hand-off;
  command-vs-projection split — SDK §3 async).

### Schedulers / cron (`functions/levelup/src/schedulers/`)

- **`expireTestSessions`** — `onSchedule('every 5 minutes')`; `collectionGroup`
  query for `in_progress` sessions past `serverDeadline + 30s`; calls
  `expireAndGradeSessionService` per session (idempotent). Thin over the
  service.
- **`cleanupStaleSessions`** — `onSchedule('every 1 hour')`; marks `in_progress`
  sessions >24h old as `abandoned` via the single-writer transition service.

### Cloud Tasks orchestration

- AI grading of a submitted test with `AI_EVALUATABLE_TYPES` items is
  **multi-step**: submit computes deterministic scores immediately, then
  **enqueues a Cloud Task per pending item** to call `@levelup/ai`; each task
  result flows through `onSubmissionGraded` (single-writer merge + progress
  recompute). This keeps `submitTestSession` fast and the AI work
  retriable/idempotent (SDK §3 Cloud Tasks for multi-step).

---

## Authority boundary (server-only ⚷)

Maps to `REVIEW-domain-data-model.md §6`:

- **#6 — `DigitalTestSession` authority fields:** `serverDeadline`, `isLatest`,
  `attemptNumber`, all `QuestionStatus`/`visitedQuestions`/`markedForReview`
  transitions, adaptive ordering (`questionOrder`, `adaptiveState`), and the
  deadline clock (server `ctx.now()` + `/serverTimeOffset`, never client clock).
  SDK reads via answer-key-free view; never writes.
- **#5 — Grading outputs:** `TestSubmission.evaluation` /
  `UnifiedEvaluationResult`, all `pointsEarned/totalPoints/percentage`,
  `StoredEvaluation` score fields. The SDK submits _answers_; the **server**
  computes/writes scores. `recordItemAttempt`'s client-supplied `score` is
  re-validated server-side; the client cannot self-grade authority types or read
  the answer key to do so.
- **#9 — Denormalized summaries/counters:** `SpaceProgress`/`StoryPointProgress`
  aggregates, `StudentProgressSummary`, `ClassProgressSummary`, RTDB leaderboard
  entries — trigger/progress-writer maintained; SDK reads, never writes.
- **#11 — Cross-domain link integrity:** `spaceId/storyPointId/itemId` referents
  existence-validated in-tenant server-side before a session/progress write.
- **Answer keys (#4, sibling domain but consumed here):** the submit/evaluate
  services read the server-only `answerKeys` subcollection (Admin-SDK only,
  rules deny-all). They are **never** returned in any session/progress response
  projection. Editor-item answer re-merge (`getItemForEdit`) is out of this
  domain and uses an isolated non-persisted cache key (SDK §7.1.3).
- **Released/own-data projection:** progress + session reads for teacher/parent
  are gated (`progress.readOther`, parent on `ctx.studentIds`); learners read
  only own data unless authoring/staff role.

---

## Drift & open questions

### Reconciled from REVIEW drift table

- **D4 (timestamps):** all session/progress/attempt timestamps → ISO
  `Timestamp`. Live mixed `FirestoreTimestamp` (session audit), **epoch-millis
  number** (`submittedAt`, `AttemptRecord.timestamp`,
  `progress.lastUpdatedAt`/`completedAt`), ISO (chat). The admin adapter is the
  only converter.
- **D6 (record-map relations):** `DigitalTestSession.submissions` exploded to a
  `submissions/{itemId}` subcollection (1 MB / full-rewrite mitigation).
  `visitedQuestions`/`markedForReview` kept inline (small booleans).
  `SpaceProgress.storyPoints` summary map kept; `StoryPointProgressDoc.items`
  kept but flagged for per-item docs if large.
- **D9 (Zod-first / .strict):** every entity here authored Zod-first
  `.strict()`, type via `z.infer`; kills the `.passthrough()` drift generator.
- **D12 (schema↔interface drift):** canonicalize `sessionType` +
  `serverDeadline` (delete schema's `type`/`deadline`).
- **D14 (index/rule field):** `spaceProgress` index must key `userId` (entity +
  rule field), not `studentId`; legacy `testSessions`/`digitalTestSessions` and
  `progress`/`spaceProgress` index duplicates retired to the single canonical
  collection.
- **D5 (StoryPointType `test` vs `timed_test`):** runtime `TestSessionType`
  collapsed to one value per concept (`timed_test`); authoring enum mapped down
  via `storyPointTypeToSessionType()`.
- **Points/marks (be-levelup §4.4):** single authoritative
  `pointsEarned/totalPoints` from the progress writer; `marksEarned/totalMarks`
  an optional derived projection, never client-set.

### Open questions

1. **Inline vs always-subcollection submissions.** Recommend **always**
   `submissions/{itemId}` subcollection for one code path; confirm acceptable
   read cost for small quizzes (mitigate with a denormalized count + last-N on
   the parent doc for list views).
2. **`dismissInsight` / `listLearningInsights` module ownership.** Insights are
   _generated_ by the analytics insight engine. Recommend the **read/dismiss**
   callables live in `levelup` (learner-facing) and proxy/share the analytics
   service, OR move to `v1.analytics.*`. Decide and keep consistent; the SDK
   surface is unaffected either way (registry name only).
3. **`StudentProgressSummary` read endpoint home.** Surfaced in this domain's
   dashboards but authored by analytics triggers; the read endpoint is
   `v1.analytics.getChildSummary`/`getSummary` (common-api §3.3) —
   `studentSummaryRepo` here is a **view repo** over that. Confirm no duplicate
   `levelup` read endpoint is added.
4. **Idempotency key shape for submit/evaluate/record** — `(uid, sessionId)` /
   `(uid, spaceId, itemId, answerHash)` /
   `(uid, spaceId, storyPointId, itemId, attemptNumber)`. Confirm `answerHash`
   is stable across retries (canonical-JSON of `answer`).
5. **`useServerTime()` primitive** (SDK §7.1 open-Q): recommend a thin hook over
   the existing RTDB `/serverTimeOffset` doc rather than a new callable, so the
   realtime deadline never trusts the client clock.
6. **AI-pending UX:** when a submitted test has `AI_EVALUATABLE_TYPES` items,
   the result view returns immediately with `pending: true` per item; the
   `gradingStatus`/`testSessionDeadline` subscription (or a dedicated
   `submissionGraded` realtime payload) backfills scores. Confirm which
   subscription channel carries the backfill.
