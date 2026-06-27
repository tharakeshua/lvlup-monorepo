# Analytics & Intelligence Module -- Code Review Report

**Reviewer:** Analytics & Intelligence Engineer (AI-assisted) **Date:**
2026-02-24 **Scope:** Cloud Functions (analytics), shared-types/progress,
shared-services/ai, shared-hooks (progress, evaluation settings) **Reference:**
`docs/phase3d-unified-progress-ai.md`

---

## Summary

The Analytics & Intelligence module implements cross-system progress
aggregation, at-risk detection, exam analytics, cost tracking, and shared AI
infrastructure (LLM wrapper, cost tracker, secret manager). The code is
generally well-structured with clear separation of concerns. However, several
critical and major issues were identified around data correctness, security,
reliability, and missing test coverage.

**Findings:** 5 Critical, 8 Major, 7 Minor, 5 Suggestions

---

## Critical Findings

### C1. Missing Firestore Security Rules for All Analytics Collections

**Files:** `firestore.rules` (root) **Lines:** Rules file ends at line 208 with
no rules for `studentProgressSummaries`, `classProgressSummaries`,
`examAnalytics`, `costSummaries`, or `llmCallLogs`

The Firestore security rules file has no rules for any analytics-related
collections. By default, Firestore denies all access when no matching rule
exists, which means:

- The callable functions `getStudentSummary` and `getClassSummary` work (they
  use Admin SDK), but direct client reads via hooks are blocked.
- More critically, there are no rules preventing unauthorized writes if an
  `allow write` catch-all exists elsewhere, or rules may be entirely missing
  meaning client-side listeners will fail.

Security rules must be added for:

- `tenants/{tenantId}/studentProgressSummaries/{studentId}` -- students read
  own, teachers/admins read all, writes blocked (Admin SDK only)
- `tenants/{tenantId}/classProgressSummaries/{classId}` -- teachers/admins read,
  writes blocked
- `tenants/{tenantId}/examAnalytics/{examId}` -- teachers/admins read, writes
  blocked
- `tenants/{tenantId}/costSummaries/**` -- tenant admins only, writes blocked
- `tenants/{tenantId}/llmCallLogs/{callId}` -- no client read/write (admin SDK
  only)

### C2. Callable Functions Lack Authorization Beyond Authentication

**Files:**

- `functions/analytics/src/callable/get-student-summary.ts:18-19`
- `functions/analytics/src/callable/get-class-summary.ts:18-19`

Both callable functions only check `request.auth` (authentication) but perform
no **authorization** checks. Any authenticated user can read any student's
progress summary or any class's summary across any tenant by passing arbitrary
`tenantId`/`studentId`/`classId` values. This is a data privacy violation.

**Required fix:** Verify the caller belongs to the specified tenant and has the
appropriate role. Students should only access their own summaries. Teachers
should only access summaries for their assigned classes. Example:

```typescript
const callerUid = request.auth.uid;
// Verify membership in tenant
// Verify studentId matches callerUid or caller is teacher/admin
```

### C3. N+1 Query Problem in onExamResultsReleased Causes Timeout Risk

**File:** `functions/analytics/src/triggers/on-exam-results-released.ts:93-96`
**Lines:** 93-96

Inside the loop iterating over all submissions (`submissionsSnap.docs`), there
is a subcollection query per submission:

```typescript
const qSubmissionsSnap = await db
  .collection(`tenants/${tenantId}/submissions/${doc.id}/questionSubmissions`)
  .get();
```

For an exam with 200 students and 10 questions each, this results in 200
sequential Firestore subcollection reads inside a for-loop. With Cloud Function
timeout at 540s (default) and Firestore latency, this can easily exceed the
timeout for large exams.

**Recommended fix:** Use `Promise.all` with batched parallelism (e.g., 10 at a
time) or use a `collectionGroup` query on `questionSubmissions` filtered by
`examId`.

### C4. Declining Performance Detection Logic Is Inverted/Always False

**File:** `functions/analytics/src/utils/at-risk-rules.ts:51-58` **Lines:**
51-58

```typescript
const recent = summary.autograde.recentExams.slice(0, MIN_EXAMS_FOR_DECLINING);
const isDeclining = recent.every(
  (exam, i) => i === 0 || exam.score <= recent[i - 1].score
);
if (isDeclining && recent[0].score < recent[recent.length - 1].score) {
  reasons.push("declining_performance");
}
```

There are two issues:

1. The `isDeclining` check verifies each exam's score is `<=` the previous one
   (meaning scores go down as index increases). But the guard condition
   `recent[0].score < recent[recent.length - 1].score` requires the first
   element to be **less than** the last, which contradicts the declining
   direction. If `isDeclining` is true (scores are non-increasing from index 0
   to end), then `recent[0]` should be **greater than or equal to**
   `recent[recent.length - 1]`, making the guard condition always false (except
   for equal scores, where `<` also fails).
2. The direction of "declining" depends on the sort order of `recentExams`
   (newest-first from `topN` in the trigger), but this assumption is implicit
   and not documented.

**Result:** The declining performance rule **never fires**. The guard condition
is logically incompatible with the `isDeclining` check.

### C5. Daily Cost Aggregation Re-Runs Are Not Idempotent -- Double-Counting Monthly Totals

**File:** `functions/analytics/src/schedulers/daily-cost-aggregation.ts:151-163`
**Lines:** 151-163

```typescript
await db
  .doc(`tenants/${tenantId}/costSummaries/monthly/${monthStr}`)
  .set(
    {
      totalCostUsd: admin.firestore.FieldValue.increment(totalCostUsd),
      ...
    },
    { merge: true },
  );
```

The monthly summary uses `FieldValue.increment()`, which is additive. If the
scheduler runs twice for the same day (e.g., Cloud Scheduler retry, manual
re-run, or deployment restart), the monthly totals will be double-counted. The
daily document (line 147) uses `.set()` which is idempotent, but the monthly
increment is not.

**Recommended fix:** Before incrementing, check if the daily document already
exists for this date. If it does, subtract the old daily values before adding
new ones, or use a transaction to compare-and-set.

---

## Major Findings

### M1. `computeOverallScore` Returns Inconsistent Scale

**File:** `functions/analytics/src/utils/aggregation-helpers.ts:9-20` **Lines:**
9-20

```typescript
const normalisedCompletion = levelupAvgCompletion / 100;
return (
  autogradeAvgScore * AUTOGRADE_WEIGHT + normalisedCompletion * LEVELUP_WEIGHT
);
```

`autogradeAvgScore` is documented as 0-1 normalized, and the comment says
`levelupAvgCompletion` is 0-100. This produces a 0-1 result. However, this is
fragile because:

- `on-submission-graded.ts:107` computes `averageScore` as
  `totalMarksObtained / totalMarksAvailable` (0-1 scale) -- correct.
- `on-space-progress-updated.ts:89` computes `averageCompletion` as
  `totalPercentage / totalSpaces` where `percentage` fields come from Firestore
  `prog.percentage` which could be 0-1 OR 0-100 depending on the LevelUp data
  source.

The design doc (Section 2.3) says LevelUp story point `percentage` is "already
0-1", but the code treats it as 0-100. If `prog.percentage` values are actually
0-1, the overall score calculation will be wrong (dividing by 100 twice).

### M2. `onStudentSummaryUpdated` Debounce Can Silently Skip Class Updates

**File:** `functions/analytics/src/triggers/on-student-summary-updated.ts:68-79`
**Lines:** 68-79

The 5-minute debounce check skips class summary recalculation if the last update
was within 5 minutes. In a scenario where 50 students' submissions are graded in
a batch, only the first student's update triggers a class recalculation. The
remaining 49 updates within 5 minutes are silently dropped. There is no
mechanism to ensure a final reconciliation after the debounce window.

**Recommendation:** Add a delayed re-trigger mechanism (e.g., write a "pending
recalculation" flag that a scheduled function picks up) or use a Cloud Tasks
queue with deduplication to ensure the class summary is eventually updated with
all changes.

### M3. Batch Write May Exceed 500-Operation Limit in Nightly At-Risk Detection

**File:**
`functions/analytics/src/schedulers/nightly-at-risk-detection.ts:49-70`
**Lines:** 49-70

The code paginates reads at `PAGE_SIZE = 500`, but the `writeBatch` accumulates
all writes within that page. Firestore batches have a hard limit of 500
operations. If all 500 documents in a page need at-risk status updates, the
batch commit will succeed. However, if `PAGE_SIZE` were ever increased or if
there are exactly 500 changed documents, it is right at the boundary. More
critically, there is no guard against exceeding this limit.

**Recommendation:** Add an explicit check: if `batchWrites >= 500`, commit the
current batch and create a new one.

### M4. `standardDeviation` Is Imported but Unused in `on-exam-results-released.ts`

**File:** `functions/analytics/src/triggers/on-exam-results-released.ts:10`

```typescript
import { median, standardDeviation } from "../utils/aggregation-helpers";
```

`standardDeviation` is imported but never used. The `ExamAnalytics` type in the
design doc includes `standardDeviation` in `scoreDistribution` but the
implementation does not compute it. Either the import should be removed (if not
needed) or the standard deviation should be computed and stored.

### M5. `gradeDistribution` Computed but Never Stored

**File:**
`functions/analytics/src/triggers/on-exam-results-released.ts:55-78,180-199`

The `gradeDistribution` record is populated in the loop (line 78) but is never
included in the final `analytics` object written to Firestore. The
`ExamAnalytics` type in the design doc specifies `gradeDistribution` should be
part of `scoreDistribution`, but the implementation only stores `buckets`.

### M6. LLM Logger Uses Client-Side Firestore SDK in a Server-Side Context

**File:** `packages/shared-services/src/ai/llm-logger.ts:9-15`

```typescript
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  Timestamp,
} from "firebase/firestore";
```

The logger uses `firebase/firestore` (client-side Web SDK) rather than
`firebase-admin/firestore` (Admin SDK). When called from Cloud Functions
(server-side), this will either fail or create a separate Firestore connection
that does not use the Admin SDK's elevated privileges. The Cloud Functions
analytics module uses `firebase-admin`, so there is an SDK mismatch.

The `_setFirestoreForTesting` override partially mitigates this, but the default
path will not work in a Cloud Functions context without explicit setup.

### M7. Cost Tracker Pricing May Silently Record $0 for New Models

**File:** `packages/shared-services/src/ai/cost-tracker.ts:38-43`

```typescript
if (!pricing) {
  console.warn(
    `[CostTracker] Unknown model "${model}"; cost will be recorded as $0.`
  );
  return { input: 0, output: 0, total: 0, currency: "USD" };
}
```

When a new model is used that is not in the pricing table, cost is silently
recorded as $0. This means the daily cost aggregation will undercount actual
costs. A `console.warn` in Cloud Functions logs is easy to miss. This should at
minimum trigger an alerting mechanism or use a default fallback pricing tier.

### M8. No Transaction Wrapping on Summary Read-Modify-Write in Triggers

**Files:**

- `functions/analytics/src/triggers/on-submission-graded.ts:134-160`
- `functions/analytics/src/triggers/on-space-progress-updated.ts:119-145`

Both triggers read the existing summary document, then merge-write new data
without a Firestore transaction. If both triggers fire concurrently for the same
student (e.g., a submission is graded at the same time space progress is
updated), one update will overwrite the other's merge, causing stale data for
either `autograde` or `levelup` fields.

**Recommendation:** Use `db.runTransaction()` to ensure atomic read-modify-write
on the summary document.

---

## Minor Findings

### m1. `topN` Used for Date Sorting Is Semantically Unclear

**Files:**

- `functions/analytics/src/triggers/on-submission-graded.ts:118-120`
- `functions/analytics/src/triggers/on-space-progress-updated.ts:102-104`

`topN` (described as "Cap an array to the top N entries, sorted by a key
descending") is used with `e.date?.toMillis ? e.date.toMillis() : 0` to get the
most recent entries. This works but using a utility named `topN` for date-based
sorting is semantically confusing. Consider a named wrapper like `mostRecent()`.

### m2. `useProgress` Hook Queries Different Collection Than Analytics Triggers

**File:** `packages/shared-hooks/src/queries/useProgress.ts:21`

The hook queries `tenants/${tenantId}/progress` but the analytics triggers
operate on `tenants/${tenantId}/spaceProgress`. These appear to be different
collections. If the frontend is meant to read from the aggregated
`studentProgressSummaries`, this hook may need updating or a separate
`useStudentProgressSummary` hook is needed.

### m3. `ExamAnalytics.scoreDistribution` Lacks Standard Deviation and Percentiles

**File:** `functions/analytics/src/triggers/on-exam-results-released.ts:180-199`

The design doc specifies `scoreDistribution` should include `mean`, `median`,
`standardDeviation`, `p25`, `p75`, `min`, `max`. The implementation only stores
`buckets` and computes `medianScore` as a top-level field. The schema diverges
from the spec.

### m4. Magic Number for Score Bucketing Boundary Condition

**File:** `functions/analytics/src/triggers/on-exam-results-released.ts:176`

```typescript
const bucket =
  buckets.find((b) => pct >= b.min && pct < b.max) ??
  buckets[buckets.length - 1];
```

A score of exactly 100% falls into the last bucket via the `??` fallback, but a
score of exactly 80% falls into `{min: 80, max: 100}` correctly. However, a
score of exactly 20%, 40%, or 60% falls into the higher bucket (e.g., 20% goes
to 20-40 instead of 0-20). This is standard but should be documented.

### m5. `onSpaceProgressUpdated` Always Sets `streakDays: 0`

**File:** `functions/analytics/src/triggers/on-space-progress-updated.ts:113`

```typescript
streakDays: 0, // TODO: compute from RTDB practiceProgress when available
```

The TODO has been left in place. The at-risk rule for `zero_streak`
(at-risk-rules.ts:38) fires when `streakDays === 0`, meaning **all students with
at least one space** will be flagged for `zero_streak`. This generates false
positives in the at-risk detection.

### m6. `monthStr` Variable Declared Twice in `daily-cost-aggregation.ts`

**File:** `functions/analytics/src/schedulers/daily-cost-aggregation.ts:109,151`

`monthStr` is declared at line 109 inside the `if (budgetLimitUsd)` block and
again at line 151 outside that block. While this works because of block scoping,
it is confusing and could lead to bugs if the structure changes. Use a single
declaration at the top of the tenant loop.

### m7. `useEvaluationSettings` Return Type Union Is Awkward for Consumers

**File:** `packages/shared-hooks/src/queries/useEvaluationSettings.ts:12`

```typescript
return useQuery<EvaluationSettings | EvaluationSettings[] | null>({
```

The return type is a union of a single item, an array, and null. This forces
every consumer to type-narrow before use. Consider splitting into two hooks:
`useEvaluationSettings(tenantId)` (returns array) and
`useEvaluationSetting(tenantId, settingsId)` (returns single).

---

## Suggestions

### S1. Add Unit Tests for the Analytics Module

**Scope:** `functions/analytics/src/`

There are zero test files for the entire analytics module. The following should
be prioritized:

- `aggregation-helpers.ts` -- pure functions, easy to test
- `at-risk-rules.ts` -- critical business logic, easy to test
- Integration tests for triggers using Firestore emulator

### S2. Add Composite Indexes for Analytics Queries

The daily cost aggregation queries `llmCallLogs` with
`where('createdAt', '>=', ...)` and `where('createdAt', '<=', ...)`. The design
doc Appendix C lists required indexes but no `firestore.indexes.json` was found.
Ensure composite indexes are defined.

### S3. Add Error Handling for Exam/Space Lookup Failures in Triggers

**Files:**

- `functions/analytics/src/triggers/on-submission-graded.ts:56-70`
- `functions/analytics/src/triggers/on-space-progress-updated.ts:43-53`

If the `in` query for exam/space lookup returns fewer results than expected
(e.g., deleted exams), the submissions referencing those exams are silently
skipped (`if (!exam) continue`). Consider logging a warning for orphaned
references.

### S4. Consider Circuit Breaker for LLM Wrapper

**File:** `packages/shared-services/src/ai/llm-wrapper.ts:184`

The retry logic retries up to 3 times per call. Under sustained API outages,
every caller will independently retry, amplifying load. Consider adding a
circuit breaker pattern that short-circuits after N consecutive failures within
a time window.

### S5. Secret Manager Client Should Support Caching

**File:** `packages/shared-services/src/ai/secret-manager.ts:37-67`

`getGeminiApiKey` fetches from Secret Manager on every call. In Cloud Functions
that process many requests, this adds latency and API quota consumption.
Consider an in-memory cache with a TTL (e.g., 5 minutes).

---

## Files Reviewed

| File                                                              | Lines | Status             |
| ----------------------------------------------------------------- | ----- | ------------------ |
| `functions/analytics/src/index.ts`                                | 18    | Clean              |
| `functions/analytics/src/utils/aggregation-helpers.ts`            | 97    | M1                 |
| `functions/analytics/src/utils/at-risk-rules.ts`                  | 65    | C4, m5             |
| `functions/analytics/src/callable/get-student-summary.ts`         | 41    | C2                 |
| `functions/analytics/src/callable/get-class-summary.ts`           | 41    | C2                 |
| `functions/analytics/src/triggers/on-submission-graded.ts`        | 166   | M8                 |
| `functions/analytics/src/triggers/on-space-progress-updated.ts`   | 151   | M1, M8, m5         |
| `functions/analytics/src/triggers/on-student-summary-updated.ts`  | 190   | M2, M3             |
| `functions/analytics/src/triggers/on-exam-results-released.ts`    | 217   | C3, M4, M5, m3, m4 |
| `functions/analytics/src/schedulers/nightly-at-risk-detection.ts` | 89    | M3                 |
| `functions/analytics/src/schedulers/daily-cost-aggregation.ts`    | 170   | C5, m6             |
| `packages/shared-types/src/progress/summary.ts`                   | 112   | Clean              |
| `packages/shared-types/src/progress/analytics.ts`                 | 85    | Clean              |
| `packages/shared-types/src/progress/insight.ts`                   | 34    | Clean              |
| `packages/shared-types/src/progress/index.ts`                     | 28    | Clean              |
| `packages/shared-services/src/ai/llm-wrapper.ts`                  | 354   | S4                 |
| `packages/shared-services/src/ai/cost-tracker.ts`                 | 72    | M7                 |
| `packages/shared-services/src/ai/llm-logger.ts`                   | 96    | M6                 |
| `packages/shared-services/src/ai/secret-manager.ts`               | 136   | S5                 |
| `packages/shared-services/src/ai/index.ts`                        | 17    | Clean              |
| `packages/shared-hooks/src/queries/useProgress.ts`                | 42    | m2                 |
| `packages/shared-hooks/src/queries/useEvaluationSettings.ts`      | 39    | m7                 |
| `firestore.rules`                                                 | 208   | C1                 |

---

## Findings Summary Table

| ID  | Severity   | Title                                                       | File(s)                                                   |
| --- | ---------- | ----------------------------------------------------------- | --------------------------------------------------------- |
| C1  | Critical   | Missing Firestore security rules for analytics collections  | `firestore.rules`                                         |
| C2  | Critical   | Callable functions lack authorization beyond authentication | `get-student-summary.ts`, `get-class-summary.ts`          |
| C3  | Critical   | N+1 query causes timeout risk in exam analytics             | `on-exam-results-released.ts:93`                          |
| C4  | Critical   | Declining performance rule logic is inverted/never fires    | `at-risk-rules.ts:51-58`                                  |
| C5  | Critical   | Cost aggregation monthly increment is not idempotent        | `daily-cost-aggregation.ts:151`                           |
| M1  | Major      | `computeOverallScore` scale assumptions fragile             | `aggregation-helpers.ts`, `on-space-progress-updated.ts`  |
| M2  | Major      | Debounce silently skips class summary updates               | `on-student-summary-updated.ts:68`                        |
| M3  | Major      | Batch write may exceed 500-operation limit                  | `nightly-at-risk-detection.ts:49`                         |
| M4  | Major      | `standardDeviation` imported but unused                     | `on-exam-results-released.ts:10`                          |
| M5  | Major      | `gradeDistribution` computed but never stored               | `on-exam-results-released.ts:55`                          |
| M6  | Major      | LLM Logger uses client SDK in server context                | `llm-logger.ts:9`                                         |
| M7  | Major      | Unknown models silently record $0 cost                      | `cost-tracker.ts:38`                                      |
| M8  | Major      | No transaction on read-modify-write for summaries           | `on-submission-graded.ts`, `on-space-progress-updated.ts` |
| m1  | Minor      | `topN` used for date sorting is semantically unclear        | triggers                                                  |
| m2  | Minor      | `useProgress` queries different collection than triggers    | `useProgress.ts:21`                                       |
| m3  | Minor      | Score distribution lacks spec fields                        | `on-exam-results-released.ts`                             |
| m4  | Minor      | Score bucketing boundary condition undocumented             | `on-exam-results-released.ts:176`                         |
| m5  | Minor      | `streakDays` hardcoded to 0 causes false at-risk flags      | `on-space-progress-updated.ts:113`                        |
| m6  | Minor      | `monthStr` declared twice                                   | `daily-cost-aggregation.ts`                               |
| m7  | Minor      | Awkward union return type in `useEvaluationSettings`        | `useEvaluationSettings.ts:12`                             |
| S1  | Suggestion | Add unit tests for analytics module                         | --                                                        |
| S2  | Suggestion | Add composite Firestore indexes                             | --                                                        |
| S3  | Suggestion | Add error handling for lookup failures in triggers          | triggers                                                  |
| S4  | Suggestion | Consider circuit breaker for LLM wrapper                    | `llm-wrapper.ts`                                          |
| S5  | Suggestion | Cache Secret Manager API key lookups                        | `secret-manager.ts`                                       |
