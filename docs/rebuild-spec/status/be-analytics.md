# Status Report: `functions/analytics` Backend

Audited: 2026-06-19. Source root:
`/Users/subhang/Desktop/Projects/auto-levleup/functions/analytics`.

The analytics Cloud Functions package owns **cross-system aggregation**: it
rolls up AutoGrade (exam) + LevelUp (learning space) activity into per-student
and per-class progress summaries, computes per-exam analytics, runs rule-based
at-risk detection and insight generation, tracks LLM cost, drives leaderboards
(RTDB), fans out notifications, and produces PDF reports. It is a pure backend
package (no UI) consumed by all 5 web apps via callables, Firestore reads, and
RTDB listeners.

---

## 1. What exists & how it's architected

`package.json` → `@levelup/functions-analytics`, Node 20, firebase-functions v6,
firebase-admin v13, `pdfkit` for PDFs. Built with `tsc` to `lib/`, tested with
`vitest` (80% coverage thresholds in `vitest.config.ts`). All functions pinned
to region `asia-south1`. Depends on `@levelup/functions-shared` (workspace) and
`@levelup/shared-types` (vendored via `file:.local-deps/shared-types`).

`src/index.ts` calls `admin.initializeApp()` once and re-exports 11 functions
across 3 categories:

### Callables (`src/callable/`)

- **`getSummary`** (`get-summary.ts`) — `onCall`, 256MiB. Consolidated read
  endpoint replacing the old `getStudentSummary`/`getClassSummary`. `scope`
  discriminator: `student` / `class` (tenant-scoped, membership-checked) and
  `platform` / `health` (superAdmin only). Auth → `parseRequest` (Zod) →
  `enforceRateLimit('...','read',60)` → role/membership checks → reads
  precomputed summary docs and validates them with
  `StudentProgressSummarySchema`/`ClassProgressSummarySchema` before returning.
  Platform scope runs ~6 ad-hoc count queries over
  `tenants`/`userMemberships`/`users`/`platformActivityLog`. Health scope reads
  `platformHealthSnapshots` + counts `gradingDeadLetter` and `llmCallLogs`
  (status==error) in last 24h.
- **`generateReport`** (`generate-report.ts`) — `onCall`, 512MiB / 120s,
  rate-limited `'report',5`. `type` discriminator: `exam-result` (individual or
  class summary), `progress`, `class`. Builds PDFs via `utils/pdf-helpers.ts`,
  uploads to Cloud Storage at `tenants/{tenantId}/reports/...`, returns a 1-hour
  signed URL. Reads exams/questions/submissions/summaries and re-validates each
  with Zod.

### Firestore triggers (`src/triggers/`)

- **`onSubmissionGraded`** (`on-submission-graded.ts`) —
  `onDocumentUpdated tenants/{tenantId}/submissions/{submissionId}`. Fires when
  `pipelineStatus` transitions into
  `graded`/`grading_complete`/`results_released`. Refetches **all** graded
  submissions for the student, batch-fetches exam metadata (chunks of 30),
  aggregates `StudentAutogradeMetrics`, then a **transaction** merges the
  `autograde` section into the student summary and recomputes
  `overallScore`/strengths/weaknesses.
- **`onSpaceProgressUpdated`** (`on-space-progress-updated.ts`) —
  `onDocumentWritten tenants/{tenantId}/spaceProgress/{progressId}`. Refetches
  all space-progress for the user, builds `StudentLevelupMetrics`,
  transaction-merges the `levelup` section. `streakDays` hardcoded `0` (TODO:
  compute from RTDB).
- **`onUserStoryPointProgressWrite`** (`on-user-story-point-progress-write.ts`)
  — **same trigger document** as above (`spaceProgress/{progressId}`). Diffs
  `storyPoints` map to find newly completed points, writes RTDB
  `storyPointLeaderboard/*` and `courseLeaderboard/*`, then transaction-touches
  the same student summary (`overallScore` recompute only).
- **`onExamResultsReleased`** (`on-exam-results-released.ts`) —
  `onDocumentUpdated tenants/{tenantId}/exams/{examId}` on
  `status → results_released`. Computes `ExamAnalytics`: avg/median/passRate,
  score-distribution buckets, grade distribution, per-question difficulty index
  (discrimination hardcoded `0`), per-class breakdown. Writes
  `tenants/{tenantId}/examAnalytics/{examId}`. Prefetches questionSubmissions in
  parallel batches of 10.
- **`onStudentSummaryUpdated`** (`on-student-summary-updated.ts`) —
  `onDocumentWritten studentProgressSummaries/{studentId}`. Resolves the
  student's classes and recomputes `ClassProgressSummary` (top/bottom
  performers, at-risk roster). Has a **5-minute debounce** that sets
  `pendingRecalculation: true` instead of recomputing — but nothing ever
  consumes that flag.
- **`updateLeaderboard`** (`update-leaderboard.ts`) — **same trigger doc** as
  `onStudentSummaryUpdated`. Writes RTDB
  `tenantLeaderboard/{tenantId}/{studentId}` (score = `overallScore*1000`) +
  per-space `courseLeaderboard/*`, plus a `countsByTier` heuristic. Handles
  deletion cleanup (tenant board only).
- **`onProgressMilestone`** (`on-progress-milestone.ts`) — **also**
  `onDocumentUpdated studentProgressSummaries/{studentId}`. Detects milestones
  (first exam, 80% avg, first/all spaces, 7-day streak, at-risk in/out
  transitions) and fans out notifications to student/admins/parents.

### Schedulers (`src/schedulers/`)

- **`dailyCostAggregation`** (`daily-cost-aggregation.ts`) — cron `5 0 * * *`.
  Per tenant, sums yesterday's `llmCallLogs` into `costSummaries/daily/{date}`
  and increments `costSummaries/monthly/{month}` using a delta-based idempotency
  guard. Checks `subscription.monthlyBudgetUsd` (80%/100% thresholds) but only
  `console.warn`s — no notification sent.
- **`nightlyAtRiskDetection`** (`nightly-at-risk-detection.ts`) — cron
  `0 2 * * *`, 1GiB/540s. Paginates all student summaries (500/page), applies
  `evaluateAtRiskRules`, batch-updates `isAtRisk`/`atRiskReasons`, resolves
  teacher/parent UIDs for newly-flagged students and notifies them.
- **`generateInsights`** (`generate-insights.ts`) — cron `30 2 * * *`. Per
  student, builds context (exams, published spaces, per-student
  space-completion) and runs `generateInsightsForStudent`, capping each student
  at 5 active (non-dismissed) `insights` docs.

### Util layer (`src/utils/`)

- `aggregation-helpers.ts` — `computeOverallScore` (60% autograde / 40%
  levelup), `median`, `standardDeviation`, `identifyStrengthsAndWeaknesses`,
  `topN`/`bottomN`.
- `at-risk-rules.ts` — pure rule engine (4 rules, no LLM).
- `insight-rules.ts` — pure rule engine (6 rules, no LLM), capped at 5.
- `notification-sender.ts` — `sendNotification` / `sendBulkNotifications`;
  dual-writes Firestore `notifications` doc + RTDB
  `notifications/{tenantId}/{userId}/{unreadCount,latest}`.
- `pdf-helpers.ts` — pdfkit layout primitives.
- `parse-request.ts`, `rate-limit.ts` — thin re-exports of
  `@levelup/functions-shared`.

Test coverage is broad: 18 test files in `src/__tests__/` mirroring every
function and util.

---

## 2. Entities / schemas / collections / APIs (with paths)

### Callable APIs

| Function         | Schema (request)                                                  | Types                                                            | File                              |
| ---------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------- |
| `getSummary`     | `GetSummaryRequestSchema` (`schemas/callable-schemas.ts:735`)     | `GetSummaryRequest`/`Response` (`callable-types.ts:492-507`)     | `src/callable/get-summary.ts`     |
| `generateReport` | `GenerateReportRequestSchema` (`schemas/callable-schemas.ts:742`) | `GenerateReportRequest`/`Response` (`callable-types.ts:512-527`) | `src/callable/generate-report.ts` |

### Firestore collections written/read

- `tenants/{tenantId}/studentProgressSummaries/{studentId}` —
  `StudentProgressSummary` (`shared-types/src/progress/summary.ts:66`;
  `StudentProgressSummarySchema` at `schemas/index.ts:1075`). Written by
  `onSubmissionGraded`, `onSpaceProgressUpdated`,
  `onUserStoryPointProgressWrite`, `nightlyAtRiskDetection`.
- `tenants/{tenantId}/classProgressSummaries/{classId}` — `ClassProgressSummary`
  (`summary.ts:99`; schema `index.ts:1128`). Written by
  `onStudentSummaryUpdated`.
- `tenants/{tenantId}/examAnalytics/{examId}` — `ExamAnalytics`
  (`shared-types/src/autograde/exam-analytics.ts:40`). Written by
  `onExamResultsReleased`.
- `tenants/{tenantId}/insights/{insightId}` — `LearningInsight`
  (`shared-types/src/progress/insight.ts:21`). Written by `generateInsights`.
- `tenants/{tenantId}/costSummaries/daily/{date}` and
  `costSummaries/monthly/{month}` — `DailyCostSummary`
  (`shared-types/src/progress/analytics.ts:15`). Written by
  `dailyCostAggregation`.
- `tenants/{tenantId}/notifications/{notifId}` — `Notification`
  (`shared-types/src/notification/notification.ts:25`). Written by
  `notification-sender`.
- `tenants/{tenantId}/llmCallLogs/{logId}` — `LLMCallLog`
  (`shared-types/src/analytics/llm-call-log.ts:8`). Read-only here.
- Read inputs: `submissions`, `submissions/.../questionSubmissions`, `exams`,
  `spaces`, `spaceProgress`, `classes`, `students`, `teachers`, `parents`,
  `userMemberships`, `tenants/{tenantId}/memberships`, top-level `users`,
  `platformActivityLog`, `platformHealthSnapshots`, `gradingDeadLetter`,
  `tenants/{tenantId}/rateLimits/*`.

### RTDB paths

- `tenantLeaderboard/{tenantId}/{studentId}`,
  `courseLeaderboard/{spaceId}/{userId}`,
  `storyPointLeaderboard/{storyPointId}/{userId}` (`update-leaderboard.ts`,
  `on-user-story-point-progress-write.ts`).
- `notifications/{tenantId}/{userId}/{unreadCount,latest}`
  (`NotificationRTDBState`, `notification.ts:60`).

### Storage

- `tenants/{tenantId}/reports/{exams|progress|classes}/...pdf`
  (`generate-report.ts:88`).

### Supplementary types

- `AtRiskReason` / `AtRiskDetectionResult` (`progress/analytics.ts:48-62`),
  `NotificationType`/`NotificationPreferences`/`NotificationRTDBState`
  (`notification/notification.ts`), `Insight*` enums
  (`progress/insight.ts:9-19`).

---

## 3. Strengths worth keeping

- **Precompute-on-write, read-cheap.** Summaries are materialized by triggers so
  `getSummary` is a single doc read. Good fit for dashboard latency and for
  future React Native clients.
- **Pure, well-tested rule engines.** `at-risk-rules.ts` and `insight-rules.ts`
  are side-effect-free with thresholds at the top — trivially portable to any
  future API layer and unit-tested in isolation.
- **Defensive Zod re-validation at the boundary.** Callables `safeParse` every
  doc and throw `internal`/`Data integrity error` on drift, with structured
  logging (`get-summary.ts:121`, `generate-report.ts` throughout).
- **Concurrency-safe summary writes.** AutoGrade/LevelUp updates use
  `runTransaction` read-modify-write (`on-submission-graded.ts:139`,
  `on-space-progress-updated.ts:124`) so concurrent triggers don't clobber each
  other's section.
- **Idempotent monthly cost aggregation.** Delta-based
  `FieldValue.increment(new - old)` makes scheduler re-runs safe
  (`daily-cost-aggregation.ts:160`).
- **Cursor pagination + batch-commit caps** in schedulers (500/page, 450-op
  batches) keep them within Firestore limits at scale.
- **Consolidated callables** (one `getSummary`, one `generateReport` with
  discriminated `scope`/`type`) reduce the function surface and deploy cost.
- **Rate limiting + role/tenant enforcement** on every callable.

---

## 4. Pain points / tech debt / inconsistencies

- **Trigger fan-out on a single doc = write amplification & races.** Three
  functions (`onStudentSummaryUpdated`, `updateLeaderboard`,
  `onProgressMilestone`) all fire on every write to
  `studentProgressSummaries/{studentId}` — and the summary itself is written by
  4 other functions. A single graded submission can cascade into class-summary
  recompute + leaderboard write + milestone notifications, each re-reading large
  collections. Risk of feedback loops and quota burn.
- **Two triggers on the identical `spaceProgress/{progressId}` document**
  (`onSpaceProgressUpdated` and `onUserStoryPointProgressWrite`) both
  transaction-write the same student summary — redundant reads and competing
  transactions on every space-progress write.
- **`onSubmissionGraded` status-source bug.** It checks
  `before/after.pipelineStatus` but the `GRADED_STATUSES` set and the in-query
  use mixed values; the header doc says it triggers on `status` while the code
  uses `pipelineStatus`. Mismatched status vocab across exam
  (`status: 'results_released'`) vs submission (`pipelineStatus`) is
  error-prone.
- **No notification on budget breach.** `dailyCostAggregation` sets
  `budgetAlertSent` and `console.warn`s but never calls `notification-sender`,
  despite an `ai_budget_alert` NotificationType existing (`notification.ts:18`).
- **Three different "membership" models in use.** `getSummary` queries top-level
  `userMemberships` (by where); `onStudentSummaryUpdated` reads
  `tenants/{tenantId}/memberships` with a `schoolId` field standing in for
  classId; `firestore.rules` `getMembership` expects doc-id `{uid}_{tenantId}`
  in `userMemberships`. These will silently disagree (e.g. class resolution in
  `onStudentSummaryUpdated` keys on `schoolId`, which is conceptually a school,
  not a class).
- **`nightlyAtRiskDetection` student resolution is O(N) and fragile.** It runs
  `students.where('authUid','!=',null).limit(1000)` per at-risk student then
  `.find()`s in memory (`nightly-at-risk-detection.ts:124`) — won't scale past
  1000 students and duplicates notification logic already in
  `onProgressMilestone` (double-notify risk).
- **`generateInsights` insight-capping logic is buggy.**
  `toWrite = seeds.slice(0, Math.max(slotsAvailable, seeds.length))` collapses
  to `seeds.length` (always writes everything), defeating the 5-active cap; the
  subsequent delete math can over/under-delete.
- **`costSummaries/daily/{date}` path mixing.** Daily docs are stored as
  `costSummaries/daily/{date}` (a doc under a `daily` sub-doc?) while the
  budget-check reads `costSummaries/monthly` as a collection with
  `.doc(monthStr)` in one place and `costSummaries/monthly/{month}` as a path
  elsewhere (`daily-cost-aggregation.ts:111` vs `:149`) — inconsistent path
  shape, likely a latent read miss.
- **No Firestore security rules for the materialized analytics collections.**
  `firestore.rules` has no `match` for `studentProgressSummaries`,
  `classProgressSummaries`, `examAnalytics`, `costSummaries`, or `insights`
  (only `notifications`, `notificationPreferences`, `llmCallLogs` are covered).
  With default-deny that means clients can't read them directly and must funnel
  through `getSummary` — but several frontend apps appear to read summaries
  directly, so this is either an access gap or undocumented reliance on the
  callable.
- **Hardcoded / stubbed metrics leak into reports.** `streakDays: 0` (TODO),
  `discriminationIndex: 0`, `topicPerformance: {}`, `className: classId`
  placeholder, and `correlationData` is a fixed `{gap:0.2}` stub
  (`generate-insights.ts:76`) — these surface as real-looking values in PDFs and
  dashboards.
- **`standardDeviation` is exported/imported but unused** in
  `on-exam-results-released.ts` (only `median` is used) — dead import.
- **`get-summary.ts` platform scope does up to 6 full-collection count queries
  with no caching** — expensive and unbounded as tenants/users grow; should use
  `.count()` aggregation or precomputed snapshots.
- **`as unknown as` casts everywhere** to bridge Zod-inferred types and
  hand-written interfaces (e.g.
  `result.data as unknown as GetSummaryResponse['studentSummary']`) — the
  schema/interface duplication (`callable-types.ts` vs `schemas/`) is maintained
  by `_Assert*Compat` type guards but the double source of truth is debt.
- **`AtRiskReason` enum drift.** Type lists `no_recent_activity`
  (`analytics.ts:49`) but the rule engine emits `zero_streak` — both exist;
  `no_recent_activity` is never produced.
- **Vendored shared-types via `file:.local-deps/shared-types`** rather than
  `workspace:*` like other deps — a copy that can drift from source.

---

## 5. Recommendations for a fresh rebuild

Keep the core concepts — **precomputed cross-system summaries, pure rule
engines, materialized exam analytics, cost tracking, at-risk + insight
generation, dual Firestore/RTDB notification fan-out** — but restructure for a
common API layer and React Native clients:

1. **Introduce a transport-agnostic service layer.** Move all read/compute logic
   (summary read, report data assembly, platform/health metrics) into
   framework-free service modules in `shared-services` so the same code backs
   Firebase callables today and a REST/GraphQL gateway (e.g. for RN/mobile or
   BFF) tomorrow. Callables become thin adapters: auth → parse →
   `service.getSummary(ctx)`.

2. **Collapse the summary-trigger fan-out into one orchestrator.** Replace the
   4-writers / 3-readers-on-one-doc topology with: (a) section-scoped writes
   that set a single `recompute` marker, and (b) one debounced/queued worker
   (Cloud Tasks or a Pub/Sub topic) that recomputes class summaries,
   leaderboards, milestones, and at-risk in a defined order. This removes races,
   double-notifications, and the dead `pendingRecalculation` flag. Merge
   `onSpaceProgressUpdated` + `onUserStoryPointProgressWrite` into one
   space-progress handler.

3. **Single canonical schema source.** Generate TS types from the Zod schemas
   (`z.infer`) and delete the hand-written `callable-types.ts` duplicates and
   the `_AssertCompat` shims. Removes all `as unknown as` casts and the drift
   class of bugs (e.g. `AtRiskReason` enum mismatch).

4. **One membership model.** Standardize on a single membership representation
   (recommend `userMemberships` with deterministic `{uid}_{tenantId}` id used by
   rules) and a clear class/section concept distinct from school; rewrite
   `onStudentSummaryUpdated` and the at-risk UID resolution against it. Fix the
   O(N) student lookup with a direct `where(authUid in [...])` or denormalized
   `teacherUids`/`parentUids` on the summary doc.

5. **Wire budget alerts and centralize notifications.** Have
   `dailyCostAggregation` emit `ai_budget_alert` via `notification-sender`. Make
   `onProgressMilestone` the _only_ place that fans out at-risk notifications
   (drive it off the summary's `isAtRisk` transition) and have the nightly
   scheduler only set flags — eliminating the duplicate notify path.

6. **Fix the insight cap and correlation stub.** Correct `generateInsights` slot
   math (write `min(slotsAvailable, seeds.length)`, delete deterministically by
   `createdAt`), and either implement real exam↔space correlation aggregation or
   remove the `cross_system_correlation` rule until backed by data.

7. **Replace expensive count queries with aggregations/snapshots.** Use
   Firestore `.count()` for platform metrics, or maintain a `platformMetrics`
   rollup doc updated by a daily scheduler; cache health snapshots.

8. **Add explicit security rules (or formalize callable-only access).** Decide
   per collection: if clients read summaries directly, add tenant-scoped `match`
   rules with role checks (mirroring the `getSummary` logic) for
   `studentProgressSummaries`/`classProgressSummaries`/`examAnalytics`/`insights`;
   otherwise enforce callable-only and document it.

9. **Normalize status vocabularies and timestamps.** One shared status enum for
   submissions/exams (avoid `status` vs `pipelineStatus` confusion), and
   consistent ISO/Timestamp handling for the RN clients. Fix the `costSummaries`
   path shape to a consistent collection structure.

10. **Compute real metrics or omit them.** Implement `streakDays` (from RTDB
    practice activity), `discriminationIndex` (upper/lower group analysis), and
    `topicPerformance`, or remove them from the schema so reports don't display
    zeros as truth. Drop the unused `standardDeviation` import.

11. **Use `workspace:*` for shared-types** instead of the vendored `.local-deps`
    copy to keep the domain model single-sourced across the monorepo and future
    RN app.
