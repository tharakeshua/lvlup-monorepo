# Analytics & Intelligence Engineer — Design Plan Review

**Reviewer:** Analytics & Intelligence Engineer **Date:** 2026-02-20 **Plans
Reviewed:** 01 (Identity/Auth), 02 (AutoGrade), 03 (LevelUp), 04 (Analytics — my
own), 05 (Frontend) **Review Scope:** Cross-module consistency, integration
points, data flow correctness, schema alignment

---

## 1. Summary of Findings

After reviewing all five design plans from the perspective of the Analytics &
Intelligence module, I have identified **8 critical issues**, **6 medium
issues**, and **4 low-priority observations**. Several of these are blocking for
implementation — particularly the LLMWrapper API contract mismatch, the
submission field name error in my own aggregation query, the RubricCriterion
schema divergence, and the EvaluationDimension struct mismatch.

The plans are overall well-structured and show strong thinking, but the
shared-types contracts are not aligned, which will cause runtime failures across
multiple modules if not resolved before implementation begins.

**Overall Assessment:** | Plan | Status | |------|--------| | 01 — Identity &
Auth | ✅ Approved (with minor notes) | | 02 — AutoGrade | ⚠️ Approved with
changes required | | 03 — LevelUp | ⚠️ Approved with changes required | | 04 —
Analytics & Intelligence (mine) | ⚠️ Approved with self-corrections required | |
05 — Frontend Apps | ✅ Approved (with minor notes) |

---

## 2. Per-Plan Feedback

---

### 2.1 Plan 01 — Identity & Authentication

**Review:** This plan is the most mature and consistent of all five. The auth
flows, claims design, membership model, and Cloud Function specs are
well-defined and provide a solid foundation for all downstream modules.

**Positives:**

- Custom claims design is clean and well-sized. The 15-classId cap with overflow
  handling via Firestore fallback is a good pattern.
- `TenantFeatures` flags (`autoGradeEnabled`, `levelUpEnabled`,
  `analyticsEnabled`) give us the right gates to disable analytics-heavy
  features for tenants that haven't configured them.
- `Tenant.settings.geminiKeyRef` and `geminiKeySet` are exactly what the
  LLMWrapper needs — good.
- `TenantStats` structure provides the denormalized counters our Analytics
  module maintains. Clear ownership alignment.

**Issues Found:**

1. **FCM Token Storage (Medium):** The `UnifiedUser` schema does not include an
   `fcmToken` field. The Analytics plan's `NotificationService` reads
   `users/{uid}.fcmToken` to deliver push notifications. This field must be
   added to the `UnifiedUser` schema, written by the client when the user grants
   notification permissions. **Suggested fix:** Add `fcmToken?: string` and
   `fcmTokenUpdatedAt?: Timestamp` to `UnifiedUser`. The client updates this on
   app load.

2. **`lastLogin` vs `lastActive` (Low):** The `UnifiedUser` schema has
   `lastLogin?: Timestamp` but the Analytics Insight Engine reads
   `levelup.lastActiveAt` from the student summary. These are different signals
   (login vs content interaction). No action needed, but note they serve
   different purposes.

**Approval Status: ✅ Approved** — with the FCM token field addition.

---

### 2.2 Plan 02 — AutoGrade

**Review:** The AutoGrade plan is comprehensive and well-thought-out. The
submission pipeline, state machine, and grading architecture are sound. However,
several fields and schemas diverge from what the Analytics module expects to
consume.

**Positives:**

- Exam lifecycle and state machine are clearly defined. The
  `SubmissionPipelineStatus` values are unambiguous.
- `ExamAnalytics` schema at `/tenants/{tenantId}/examAnalytics/{examId}` is
  well-designed — good separation of overall distribution, per-question
  analytics, and class breakdown.
- The LLMWrapper usage pattern in `processAnswerGrading` correctly defers to the
  shared `LLMWrapper` class with tenant-keyed API calls. Good.
- `GradingDeadLetterEntry` for failed pipeline steps is exactly the right
  pattern.

**Issues Found:**

1. **LLMCallLog Schema Mismatch — CRITICAL:** AutoGrade plan (Section 8.4)
   defines `LLMCallLog` with field names `purpose`, `operation`, `resourceType`,
   `resourceId`, `tokens: { input, output, total }`,
   `cost: { input, output, total, currency }`. The Analytics plan (Section 2.7)
   defines the canonical `LLMCallLog` with flat fields: `task`, `inputTokens`,
   `outputTokens`, `totalTokens`, `inputCostUSD`, `outputCostUSD`,
   `totalCostUSD`. These are completely different schemas for the same
   collection.

   **Impact:** The daily cost aggregation function in Analytics reads all
   `llmCallLogs` and accesses `log.totalCostUSD`, `log.inputTokens`, `log.task`,
   etc. If AutoGrade writes logs with the `cost.total` structure, the
   aggregation will produce zero-cost summaries silently.

   **Required fix:** AutoGrade must write `LLMCallLog` using the Analytics
   schema. The `purpose` field maps to `task`, `tokens.input` maps to
   `inputTokens`, `cost.total` maps to `totalCostUSD`, etc.

2. **LLMWrapper API Interface — CRITICAL:** AutoGrade uses
   `llm.call(prompt, metadata, options)` with three separate argument objects.
   The Analytics `LLMWrapper` exposes a single `params` object:
   `llm.call({ tenantId, task, prompt, images, ... })`. These cannot both be
   correct. The LLMWrapper is owned by Analytics; AutoGrade must conform to the
   Analytics-defined interface.

   **Required fix:** AutoGrade to update all LLMWrapper call sites to the
   single-object API.

3. **`RubricCriterion` Schema Mismatch — CRITICAL (shared type):** AutoGrade
   defines `RubricCriterion` as `{ description: string; marks: number }`.
   LevelUp defines it as
   `{ id: string; name: string; description?: string; maxPoints: number; weight?: number; levels?: [...] }`.
   Both reference `packages/shared-types/src/content/rubric.ts` as the canonical
   definition, but they have written conflicting schemas. `marks` vs `maxPoints`
   is a breaking difference — AutoGrade's question extraction prompt generates
   `criteria[].marks` but LevelUp's rubric editor expects
   `criteria[].maxPoints`.

   **Required fix:** A single canonical `RubricCriterion` must be agreed upon.
   Recommendation: use `maxPoints` (LevelUp's naming is more descriptive) and
   add `id: string` as required. AutoGrade question extraction prompt must be
   updated to output `maxPoints` not `marks`.

4. **`EvaluationDimension` Schema Mismatch — CRITICAL (shared type):** AutoGrade
   defines `EvaluationDimension` with `priority: 'HIGH' | 'MEDIUM' | 'LOW'`,
   `promptGuidance: string`, `enabled: boolean`, `isDefault: boolean`,
   `isCustom: boolean`, `expectedFeedbackCount?: number`. LevelUp defines
   `EvaluationDimension` with `weight: number`, `scoringScale: number` and NO
   `priority`, `promptGuidance`, etc. These must be the same type in
   `packages/shared-types`.

   **Required fix:** Merge both schemas. Canonical `EvaluationDimension` should
   include all fields from AutoGrade's definition (since RELMS grading depends
   on `promptGuidance` and `priority`) PLUS LevelUp's `weight` and
   `scoringScale`. Both modules need to use the merged type.

5. **`ExamAnalytics` Dual Schema — Medium:** AutoGrade (Section 3.8) and
   Analytics (Section 2.5) both define `ExamAnalytics` schemas with field
   differences:
   - AutoGrade:
     `questionAnalytics: Record<string, { questionId, avgScore, avgPercentage, difficultyIndex, discriminationIndex, commonMistakes, commonStrengths }>`
   - Analytics: `questions: Record<string, QuestionAnalytics>` with
     `averageScore`, `averageScorePercent`, `difficultyRating` (string enum),
     `mistakeClassification`, `confidenceDistribution`

   These partially overlap but are named differently. Since the Analytics module
   owns `ExamAnalytics` computation, AutoGrade's definition should be removed
   from the AutoGrade plan — only the Analytics plan's schema is canonical.

6. **ExamAnalytics Status Filter — Medium:** Analytics Section 7.2 queries
   submissions with `.where('status', 'in', ['grading_complete', 'released'])`.
   But AutoGrade's `SubmissionPipelineStatus` does not include `'released'` —
   the correct value is `'results_released'`. The filter must be corrected to
   `['grading_complete', 'reviewed', 'results_released']`.

7. **Submission Query Field: `studentUserId` — High:** The AutoGrade
   `Submission` schema stores `studentId: string` (the entity document ID, e.g.,
   `students/{studentId}`), not the Firebase Auth UID. But the Analytics
   `updateStudentProgressSummary` function queries
   `.where('studentUserId', '==', userId)` where `userId` is the Firebase Auth
   UID. This field does not exist in the Submission schema.

   **Required fix:** Add `authUid: string` to the `Submission` schema (populated
   from the student entity's `authUid` at submission creation time). The
   Analytics query should use `.where('authUid', '==', userId)`. This requires a
   Firestore composite index on `examId` + `authUid`.

8. **Missing Notification Trigger in AutoGrade Pipeline (Low):** AutoGrade's
   `finalizeSubmission` step (Section 7.2) says submissions move to
   `ready_for_review` but there is no mention of notifying the teacher. The
   Analytics notification table includes
   `grading_complete → TenantAdmin + Teacher → in_app`. AutoGrade should call
   `NotificationService.send()` with type `grading_complete` when
   `finalizeSubmission` completes. This should be documented in the AutoGrade
   plan.

**Approval Status: ⚠️ Approved with changes required** — Issues 1–4 are critical
shared-type conflicts that must be resolved before implementation.

---

### 2.3 Plan 03 — LevelUp Learning Spaces

**Review:** The LevelUp plan is the most complex in scope and is generally
well-designed. The practice mode RTDB architecture, timed test runner, and
content model are solid. However, there are alignment issues with the Analytics
module.

**Positives:**

- The RTDB practice progress structure, flush trigger design, and merge logic
  align well with what Analytics expects to consume.
- The `SpaceProgress` Firestore schema in LevelUp (Section 3.7) closely matches
  the Analytics plan's `SpaceProgress` schema (Section 2.1). Minor differences
  noted below.
- The `DigitalTestSession.submissions[itemId]` map correctly populates the
  SpaceProgress item entries after submission.
- The `Agent` model (evaluator + tutor) is clearly scoped. The LLMWrapper usage
  for tutor chat and answer evaluation is correct directionally.

**Issues Found:**

1. **RTDB Practice Progress Key Mismatch — High:** LevelUp plan (Section 8.2)
   defines RTDB abbreviated keys as `s`, `t`, `a`, `b?` (where `b` = bestScore).
   Analytics plan (Section 2.2) defines keys as `s`, `t`, `a`, `sc` (where `sc`
   = best score 0-100). The key for best score is `b` in LevelUp but `sc` in
   Analytics. The flush function in Analytics reads `rtdbItem.sc` but LevelUp
   writes `rtdbItem.b`.

   **Required fix:** Agree on one abbreviated key. Recommendation: use `sc`
   (Analytics plan) since it is more readable. Update LevelUp's RTDB writes and
   flush function accordingly. Also note: LevelUp's `_meta` structure uses
   `meta/lastFlushedAt` path but Analytics uses `_meta.dirty` and
   `_meta.flushedAt`. Must align on the meta structure.

2. **Flush Interval Discrepancy — High:** LevelUp plan (Section 8.4) states the
   Cloud Scheduler runs "every 10 minutes" for stale flush. Analytics plan
   (Section 4.3) states "every 6 hours". These must agree. The Analytics plan
   owns this function. The LevelUp plan's "10 minutes" appears in both the
   design decision table (Section 2: "10-min + session-end flush") and in
   Section 8.4.

   **Decision needed:** What is the correct interval? 10 minutes ensures data
   freshness for analytics dashboards but is expensive if there are many active
   users. 6 hours is cheaper but means practice progress can be delayed by up to
   6h in dashboards. The blueprint states "10-minute" flush. **Recommendation:
   use 10 minutes** per the original blueprint spec. Analytics plan must be
   corrected.

3. **`SpaceProgress` Schema Minor Differences — Medium:**
   - LevelUp's `ItemProgressEntry` has `timeSpent?: number` (seconds),
     `interactions?: number`, `lastUpdatedAt: number` (epoch ms as number).
     Analytics plan has `timeSpentSeconds: number`, `interactions: number`,
     `lastActiveAt: Timestamp`. Field naming and types differ slightly.
   - LevelUp's `QuestionData` in items has `percentage: number` field; Analytics
     plan's `QuestionSubmissionEntry` does not have `percentage`.
   - LevelUp's `StoryPointProgress` has `completedAt?: number` (epoch ms);
     Analytics has `completedAt?: Timestamp`.

   **Required fix:** Since `spaceProgress` is written by LevelUp and read by
   Analytics, these must match exactly. Canonical schema should be defined in
   `packages/shared-types`. Recommendation: use `Timestamp` for all timestamp
   fields (not epoch ms) for Firestore compatibility, and name time fields
   consistently (`timeSpentSeconds`, `lastActiveAt`, etc.).

4. **LLMWrapper API Usage — High:** LevelUp plan (Section 10.3) calls
   `LLMWrapper.chat(...)` and (Section 11.2) calls `LLMWrapper.generate(...)` as
   two separate methods. The Analytics plan defines a single
   `LLMWrapper.call(params)` method. There is no `.chat()` or `.generate()`
   method in the Analytics LLMWrapper implementation. Also, LevelUp passes
   `taskType: 'tutor_chat'` but the Analytics `TaskType` union has
   `'tutoring_chat'` (not `'tutor_chat'`).

   **Required fix:** All LevelUp LLMWrapper calls must use the single
   `LLMWrapper.call(params)` API. The `taskType: 'tutor_chat'` must be changed
   to `task: 'tutoring_chat'` to match the `TaskType` union in Analytics.

5. **`practiceProgress` Firestore Path in Module Boundaries — Low:** LevelUp
   plan (Section 1 "Module Boundaries") lists
   `/tenants/{tenantId}/practiceProgress/{userId}_{spaceId}` as a Firestore path
   it owns. But this Firestore collection does not exist in either plan —
   practice progress is in RTDB, not in a separate Firestore `practiceProgress`
   collection. The Firestore-persisted form is `spaceProgress`. This appears to
   be an error in the module boundaries section of the LevelUp plan.

   **Required fix:** Remove `/tenants/{tenantId}/practiceProgress/` from the
   LevelUp Firestore module boundaries. Replace with a note that practice data
   is in RTDB at `practiceProgress/{tenantId}/{userId}/{spaceId}` (RTDB, not
   Firestore).

6. **Space Published Notification — Low:** LevelUp plan (Section 4.5
   `publishSpace`) mentions "Send notification to students in assigned classes"
   as a side effect. But the notification implementation lives in the Analytics
   NotificationService. LevelUp plan should explicitly call
   `NotificationService.sendBulk()` with type `space_published` targeting
   students in `space.classIds`. The channel mapping (in_app + push) matches
   what the Analytics notification table specifies — good.

**Approval Status: ⚠️ Approved with changes required** — Issues 1, 2, and 4 are
critical for data pipeline correctness.

---

### 2.4 Plan 04 — Analytics & Intelligence (My Own Plan)

**Review:** This is my own plan. Reviewing it with the same rigor as the others,
I have found several issues introduced by mismatches with the data I will
consume from AutoGrade and LevelUp.

**Issues I Must Fix:**

1. **Submission Query Field Bug — Critical (self-correction):** Section 5.2
   `updateStudentProgressSummary` queries:
   `.where('studentUserId', '==', userId)`. The correct field (as noted in
   AutoGrade feedback above) will be `authUid` once AutoGrade adds it. Query
   must be `.where('authUid', '==', userId)`.

2. **ExamAnalytics Submission Status Filter Bug — High (self-correction):**
   Section 7.2 queries
   `.where('status', 'in', ['grading_complete', 'released'])`. `'released'` is
   not a valid `SubmissionPipelineStatus` value. Correct query:
   `.where('pipelineStatus', 'in', ['grading_complete', 'reviewed', 'results_released'])`.
   Also note the field is `pipelineStatus` on the Submission document, not
   `status`.

3. **Flush Interval — High (self-correction):** Section 4.3 specifies Cloud
   Scheduler "every 6 hours" for stale practice progress flush. This contradicts
   the blueprint's "10 minutes" spec and LevelUp plan's reference to "10-min
   flush". **Correction:** Change to "every 10 minutes" (`'every 10 minutes'` in
   Cloud Scheduler).

4. **RTDB `_meta` Structure (self-correction):** Section 4.2 uses `_meta.dirty`
   and `_meta.flushedAt` for RTDB flush metadata. LevelUp uses
   `meta/lastFlushedAt` (different path, no `dirty` flag). Must align.
   **Correction:** My `_meta` structure (`_meta.dirty`, `_meta.la`,
   `_meta.sessionStart`, `_meta.flushedAt`) is more complete. LevelUp should
   adopt this. The stale flush check should use `_meta.la` (lastActiveAt epoch
   ms) and `_meta.dirty`.

5. **Missing `pipelineStatus` vs `status` field name:** The Submission filter in
   Section 7.2 uses `.where('status', 'in', ...)` but the AutoGrade schema names
   this field `pipelineStatus`. All submission queries must use
   `pipelineStatus`.

6. **`resultsReleased` field for submission release trigger:** Section 3.3 says
   the SpaceProgress trigger fires on "Submission.isReleased → true". But
   AutoGrade's `Submission` schema uses `resultsReleased: boolean`, not
   `isReleased`. The Firestore trigger for `onSubmissionWrite` must check
   `change.after.data()?.resultsReleased === true && change.before.data()?.resultsReleased !== true`.

**Approval Status: ⚠️ Approved with self-corrections required** — 6 bugs in my
own plan that I must fix before implementation.

---

### 2.5 Plan 05 — Frontend Apps

**Review:** The Frontend plan is well-structured, covers all 6 app surfaces
appropriately, and correctly references the data contracts from upstream
modules. The analytics consumption patterns (reading `studentProgressSummaries`,
`classProgressSummaries`, leaderboards, exam analytics) are all consistent with
what the Analytics module produces.

**Positives:**

- Student dashboard correctly reads from `studentProgressSummaries/{userId}`
  (single document read) — consistent with Analytics design.
- Leaderboard reads correctly reference RTDB at
  `leaderboards/{tenantId}/{spaceId}` with real-time subscription — consistent
  with Analytics.
- Analytics dashboard screens (Teacher Web Section 5, Admin Web Section 4)
  correctly reference `classProgressSummaries`, `examAnalytics`, and
  `tenantAnalytics/current` — all match Analytics schemas.
- The `OrgSwitcher` component correctly calls `switchActiveTenant` CF and forces
  token refresh — consistent with Identity plan.
- Permission-gated features (Section 5.4) correctly reference `canViewAnalytics`
  permission which is defined in Identity plan's `TeacherPermissions`.

**Issues Found:**

1. **Scanner App Offline Architecture vs AutoGrade Online-Only Decision —
   Medium:** Frontend plan (Section 8) designs the Scanner App with full offline
   support (IndexedDB queue + Background Sync API). AutoGrade plan (Section 9.1)
   states: "For the initial implementation, the scanner app operates
   online-only." These are contradictory. The Frontend plan invests significant
   design effort in offline scanner architecture.

   **Required decision:** If offline is deferred to a later phase per
   AutoGrade's decision, the Frontend plan's offline architecture section should
   be marked as "Phase 2 — not initial implementation" to avoid building it
   unnecessarily.

2. **AI Cost Dashboard — Medium:** Admin Web (Section 4.1) includes "AI Cost
   Analytics (daily/monthly usage, per-model breakdown)" reading from
   `costSummaries`. This is consistent with the Analytics `DailyCostSummary` and
   `MonthlyCostSummary` schemas. However, the Analytics plan stores daily
   summaries at `/tenants/{tenantId}/costSummaries/daily/{YYYY-MM-DD}` which is
   a subcollection path `costSummaries/daily`. Frontend must query with the
   correct path structure. Verify the collection path is `costSummaries` and
   subcollections are `daily` and `monthly`.

3. **Recommendations Dismissal — Low:** Student dashboard (Section 6.1) shows
   Recommendations from Insight Engine. Analytics `Recommendation` schema has
   `dismissed: boolean`. Frontend should implement a "Dismiss" button that calls
   a Cloud Function to set `dismissed: true` on the recommendation within
   `studentProgressSummaries/{userId}.insights.recommendations`. This flow is
   implied but not specified in the Frontend plan.

4. **Notification Unread Count Source — Low:** Parent nav (Section 7.3) shows
   `badge: unreadCount` for Notifications. Analytics plan stores notifications
   in `/tenants/{tenantId}/notifications/{notificationId}` with `read: boolean`.
   Frontend should query `where('recipientUid', '==', uid, 'read', '==', false)`
   to get the count. The required Firestore index is defined in Analytics plan.
   This is consistent but the Frontend plan should explicitly name the data
   source for the badge count.

**Approval Status: ✅ Approved** — Issues are minor clarifications. Scanner
offline decision needs explicit alignment between Frontend and AutoGrade
engineers.

---

## 3. Inconsistencies Summary

| #   | Severity     | Area                               | Plans Involved | Description                                                                                                                         |
| --- | ------------ | ---------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Critical** | Shared Type: RubricCriterion       | 02, 03, 04     | `marks` (AutoGrade) vs `maxPoints` (LevelUp) — different field names in shared type                                                 |
| 2   | **Critical** | Shared Type: EvaluationDimension   | 02, 03         | Completely different struct — AutoGrade has `priority`/`promptGuidance`, LevelUp has `weight`/`scoringScale`                        |
| 3   | **Critical** | LLMCallLog Schema                  | 02, 04         | `purpose`/`tokens.input`/`cost.total` (AutoGrade) vs `task`/`inputTokens`/`totalCostUSD` (Analytics)                                |
| 4   | **Critical** | LLMWrapper API                     | 02, 03, 04     | Three different call signatures — AutoGrade uses 3-arg, LevelUp uses `.chat()`/`.generate()`, Analytics uses single `.call(params)` |
| 5   | **Critical** | Submission authUid lookup          | 02, 04         | Analytics queries `studentUserId` which doesn't exist in AutoGrade's Submission schema                                              |
| 6   | **High**     | RTDB Practice Progress Keys        | 03, 04         | Best-score abbreviated key is `b` (LevelUp) vs `sc` (Analytics)                                                                     |
| 7   | **High**     | Flush Interval                     | 03, 04         | "every 10 minutes" (LevelUp, Blueprint) vs "every 6 hours" (Analytics)                                                              |
| 8   | **High**     | SubmissionPipelineStatus filter    | 02, 04         | Analytics queries `'released'` status which doesn't exist; should be `'results_released'`                                           |
| 9   | **High**     | `pipelineStatus` vs `status` field | 02, 04         | Analytics queries `.where('status', ...)` but field is `pipelineStatus` on Submission                                               |
| 10  | **High**     | `resultsReleased` vs `isReleased`  | 02, 04         | Submission field is `resultsReleased` but Analytics trigger checks `isReleased`                                                     |
| 11  | **Medium**   | ExamAnalytics dual definition      | 02, 04         | Two schema definitions for same collection with different field names                                                               |
| 12  | **Medium**   | SpaceProgress field names          | 03, 04         | `timeSpent`/`lastUpdatedAt`/epoch ms (LevelUp) vs `timeSpentSeconds`/`lastActiveAt`/Timestamp (Analytics)                           |
| 13  | **Medium**   | FCM Token missing from User schema | 01, 04         | `UnifiedUser` has no `fcmToken` field but NotificationService reads it                                                              |
| 14  | **Medium**   | Scanner offline vs online-only     | 02, 05         | Frontend builds offline queue; AutoGrade says online-only for initial phase                                                         |
| 15  | **Medium**   | LLMWrapper TaskType: `tutor_chat`  | 03, 04         | LevelUp uses `'tutor_chat'` but Analytics `TaskType` defines `'tutoring_chat'`                                                      |
| 16  | **Low**      | `practiceProgress` Firestore path  | 03             | LevelUp module boundaries lists non-existent Firestore `practiceProgress` collection                                                |
| 17  | **Low**      | RTDB `_meta` structure             | 03, 04         | LevelUp uses `meta/lastFlushedAt`; Analytics uses `_meta.dirty`/`_meta.flushedAt`                                                   |
| 18  | **Low**      | Space publish notification path    | 03, 04         | LevelUp says "send notification" but doesn't specify NotificationService call                                                       |

---

## 4. Missing Integration Points

### 4.1 AutoGrade → Analytics (Missing)

1. **`authUid` on Submission document:** AutoGrade must populate
   `authUid: string` (Firebase Auth UID) on each `Submission` document. This is
   required for the Analytics `updateStudentProgressSummary` to find a student's
   submissions without a costly join through the student entity. AutoGrade
   should resolve `studentId → students/{studentId}.authUid` at submission
   creation time and denormalize it onto the submission.

2. **Grading complete notification trigger:** AutoGrade's `finalizeSubmission`
   should call `NotificationService.send()` with type `grading_complete` to
   notify teachers. Currently this call is missing from the AutoGrade CF spec.

3. **ExamAnalytics trigger from AutoGrade:** AutoGrade's `finalizeSubmission`
   increments `exam.stats.gradedSubmissions` (via denormalized counter). The
   Analytics module should trigger `computeExamAnalytics` via Cloud Task when
   `exam.stats.gradedSubmissions == exam.stats.totalSubmissions`. This trigger
   point is not explicitly specified — AutoGrade should enqueue the analytics
   computation Cloud Task from within `finalizeSubmission`.

### 4.2 LevelUp → Analytics (Missing)

1. **DigitalTestSession completion → SpaceProgress:** LevelUp's
   `submitTimedTest` Cloud Function updates `spaceProgress`. This write will
   trigger the Analytics `onSpaceProgressWrite` Firestore trigger. This chain is
   correct but not explicitly documented as an integration point in LevelUp
   plan. Should be noted.

2. **Practice flush → StudentProgressSummary:** When the flush function writes
   to `spaceProgress`, it should be documented that the `onSpaceProgressWrite`
   trigger fires automatically to update the student summary. The LevelUp plan
   doesn't mention this downstream effect.

3. **Space published → Student notifications:** LevelUp's `publishSpace` CF
   should explicitly call `NotificationService.sendBulk()`. Currently says
   "notification sent" without specifying the call.

### 4.3 Identity → Analytics (Missing)

1. **New student enrollment → Space progress initialization:** When a student is
   added to a class (via `createOrgUser` or `updateStudentClasses`), the
   Analytics module may need to initialize `studentProgressSummaries/{userId}`
   if it doesn't exist. Currently, the summary is only created on first progress
   write. This is acceptable (lazy initialization) but should be documented.

2. **Tenant stats maintenance:** The Identity plan's `createOrgUser` calls
   `updateTenantStats(data.tenantId, data.role, 'increment')` directly. The
   Analytics plan (Section 15) specifies that `Tenant.stats` counters are
   maintained via Firestore triggers on student/teacher write. There is a
   potential double-update: the Identity module manually increments AND the
   Analytics Firestore trigger also increments. This must be de-duplicated —
   recommend that Identity removes its manual `updateTenantStats` call and
   relies entirely on the Analytics Firestore trigger.

### 4.4 Frontend → Analytics (Missing)

1. **Recommendation dismissal API:** Frontend needs a Cloud Function to dismiss
   a recommendation. Analytics plan doesn't define this CF. Needs to be added:
   `dismissRecommendation(tenantId, userId, recommendationId)` that sets
   `dismissed: true` in the student summary's recommendations array.

2. **Notification read tracking:** Frontend needs to mark notifications as read.
   Analytics plan doesn't define a CF for this. Either a client-side Firestore
   write (with appropriate security rules) or a
   `markNotificationRead(notificationId)` CF should be defined.

---

## 5. Suggested Changes

### 5.1 Shared Types Package Changes (Highest Priority)

These must be resolved before any module begins implementation:

```typescript
// packages/shared-types/src/content/rubric.ts — CANONICAL DEFINITION

// RubricCriterion: merge AutoGrade and LevelUp definitions
interface RubricCriterion {
  id: string; // Required (LevelUp had this, AutoGrade didn't)
  name: string; // Required
  description?: string;
  maxPoints: number; // Use maxPoints (not marks) — consistent with scoring model
  weight?: number; // Optional weight (from LevelUp)
  levels?: Array<{
    // Optional rubric levels (from LevelUp)
    score: number;
    label: string;
    description: string;
  }>;
}

// EvaluationDimension: merge AutoGrade and LevelUp definitions
interface EvaluationDimension {
  id: string;
  name: string;
  description: string;
  // From AutoGrade (RELMS grading — required for grading prompts)
  priority: "HIGH" | "MEDIUM" | "LOW";
  promptGuidance: string;
  enabled: boolean;
  isDefault: boolean;
  isCustom: boolean;
  expectedFeedbackCount?: number;
  // From LevelUp (rubric scoring)
  weight: number; // 0-1, all dimensions sum to 1
  scoringScale: number; // e.g., 5 = 1-5 scale, 10 = 1-10 scale
  // Shared
  icon?: string;
  createdAt?: Timestamp;
  createdBy?: string;
}
```

### 5.2 LLMWrapper API — Canonical Contract

```typescript
// packages/shared-services/src/llm/LLMWrapper.ts — CANONICAL API
// All modules must use this interface. No .chat() or .generate() methods.

class LLMWrapper {
  async call(params: {
    tenantId: string;
    userId?: string;
    userRole?: "teacher" | "student" | "admin" | "system";
    task: TaskType; // MUST use TaskType union
    model?: string;
    prompt: string;
    images?: string[];
    systemInstruction?: string;
    temperature?: number;
    maxOutputTokens?: number;
    relatedResourceType?: string;
    relatedResourceId?: string;
    tags?: string[];
  }): Promise<LLMCallResult>;
}
```

### 5.3 Submission Schema Addition (AutoGrade)

```typescript
// Add to Submission schema (AutoGrade plan)
interface Submission {
  // ... existing fields ...
  authUid: string; // Firebase Auth UID of the student — denormalized from students/{studentId}.authUid
  // ... rest of fields ...
}
```

### 5.4 Analytics Plan Self-Corrections

```typescript
// Section 5.2 — corrected submission query
const submissionsSnap = await db
  .collection(`tenants/${tenantId}/submissions`)
  .where("authUid", "==", userId) // was: 'studentUserId'
  .where("resultsReleased", "==", true) // was: 'isReleased'
  .get();

// Section 7.2 — corrected exam analytics query
const submissions = await db
  .collection(`tenants/${tenantId}/submissions`)
  .where("examId", "==", examId)
  .where("pipelineStatus", "in", [
    "grading_complete",
    "reviewed",
    "results_released",
  ])
  // was: .where('status', 'in', ['grading_complete', 'released'])
  .get();

// Section 4.3 — corrected flush scheduler
export const flushStalePracticeProgress = functions.pubsub
  .schedule("every 10 minutes") // was: 'every 6 hours'
  .onRun(async () => {
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000; // was: sixHoursAgo
    // ...
  });

// Section 3.3 — corrected Firestore trigger
export const onSpaceProgressWrite = functions.firestore
  .document("tenants/{tenantId}/spaceProgress/{progressId}")
  .onWrite(async (change, context) => {
    // Check for resultsReleased change (was: isReleased)
    const before = change.before.data();
    const after = change.after.data();
    if (after?.resultsReleased && !before?.resultsReleased) {
      // results just released
    }
  });
```

### 5.5 Identity Plan Addition

```typescript
// Add to UnifiedUser schema (Identity plan)
interface UnifiedUser {
  // ... existing fields ...
  fcmToken?: string; // FCM push notification token (set by client on notification permission grant)
  fcmTokenUpdatedAt?: Timestamp;
}
```

### 5.6 New Cloud Functions Needed

| Function                | Owner     | Purpose                                           |
| ----------------------- | --------- | ------------------------------------------------- |
| `dismissRecommendation` | Analytics | Set `dismissed: true` on student recommendation   |
| `markNotificationRead`  | Analytics | Mark notification as read; update `read`/`readAt` |

---

## 6. Approval Status Summary

| Plan                  | Approval                              | Blocker Count | Required Action Before Implementation                                                                    |
| --------------------- | ------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------- |
| 01 — Identity & Auth  | **✅ Approved**                       | 0             | Add `fcmToken` to `UnifiedUser`                                                                          |
| 02 — AutoGrade        | **⚠️ Approved with changes**          | 4 critical    | Fix LLMCallLog schema, LLMWrapper API, RubricCriterion, EvaluationDimension, add `authUid` to Submission |
| 03 — LevelUp          | **⚠️ Approved with changes**          | 3 critical    | Fix RTDB key naming, flush interval, LLMWrapper API call sites                                           |
| 04 — Analytics (mine) | **⚠️ Approved with self-corrections** | 4 critical    | Fix submission query field, status filter, flush interval, `resultsReleased` field name                  |
| 05 — Frontend         | **✅ Approved**                       | 0             | Clarify scanner offline scope with AutoGrade team                                                        |

**Pre-implementation gate:** All critical issues (#1–#10 in the inconsistencies
table) must be resolved and the shared-types package must have a canonical
`RubricCriterion`, `EvaluationDimension`, `LLMCallLog`, and `LLMWrapper`
contract before any module begins coding.

---

_Review completed by: Analytics & Intelligence Engineer_ _Date: 2026-02-20_
