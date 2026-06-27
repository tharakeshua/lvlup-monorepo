# AutoGrade Engineer — Cross-Module Design Review

**Reviewer:** AutoGrade Engineer **Date:** 2026-02-20 **Plans Reviewed:**

- `01-identity-auth-design.md`
- `02-autograde-design.md` _(own plan)_
- `03-levelup-design.md`
- `04-analytics-intelligence-design.md`
- `05-frontend-apps-design.md`

---

## 1. Executive Summary

All five design plans are high quality with strong internal coherence. However,
the cross-plan review has surfaced **3 critical bugs**, **2 critical
inconsistencies in the shared data model**, and **several moderate integration
gaps** that must be resolved before implementation begins.

The most urgent issues are:

1. **`UnifiedRubric` / `RubricCriterion` schema split** — AutoGrade and LevelUp
   define the same shared type with incompatible field names (`marks` vs
   `maxPoints`, missing `id`, `name`, `weight`, `levels`). Since this is the
   canonical shared type, it must be reconciled in `packages/shared-types`
   before either module builds anything.
2. **`EvaluationDimension` schema split** — Same issue: the two plans define
   incompatible schemas for the same shared type.
3. **Analytics uses wrong Firestore field names** — `submission.status` and
   `submission.isReleased` don't exist; the correct fields are
   `submission.pipelineStatus` and `submission.resultsReleased`.
4. **Scanner offline contradiction** — AutoGrade says online-only; Frontend
   implements a full offline queue. One must win.
5. **`studentUserId` field gap** — Analytics queries submissions by
   `studentUserId` but AutoGrade's `Submission` schema has no such field.

---

## 2. Per-Plan Feedback

---

### 2.1 Plan 01 — Identity & Auth

**Overall:** Well-designed. The claims model, scanner role, and membership
structure all integrate cleanly with AutoGrade's needs. The custom-token scanner
auth model is exactly what was required.

**Positive integrations with AutoGrade:**

- `scannerId` in `PlatformClaims` + `isScanner()` helper function correctly
  enable AutoGrade's scanner-scoped submission writes.
- `canCreateExams`, `canEditRubrics`, `canManuallyGrade` in `TeacherPermissions`
  map exactly to AutoGrade's permission-gated Cloud Functions.
- `TenantFeatures.autoGradeEnabled`, `scannerAppEnabled`, `aiGradingEnabled`
  flags are the right hooks for runtime feature gating.
- `TenantSettings.geminiKeyRef` + `setTenantApiKey` function are correctly
  designed for AutoGrade's Secret Manager pattern.

**Issues found:**

**[MODERATE] Scanner Cloud Function not named** The auth plan describes scanner
device registration logic in the open questions section (§12, question 7:
"Custom Token: device registers via admin, gets secret, exchanges for Firebase
custom token per session") but never defines the Cloud Function that creates the
scanner device. AutoGrade and Frontend both reference this flow. Suggest naming
it `registerScannerDevice` in the auth plan and including its full
specification.

**[MINOR] `scannerId` points to global `/scanners/{scannerId}`, not
tenant-scoped** The `UserMembership.scannerId` references
`/scanners/{scannerId}` which is a top-level collection. AutoGrade creates
submissions scoped to `/tenants/{tenantId}/submissions/`. This is fine
architecturally (scanners serve one tenant), but the Firestore rules should
explicitly block cross-tenant scanner access. The auth plan's rules for
`/scanners/{scannerId}` only check `resource.data.authUid == request.auth.uid` —
there's no tenant check. Suggest adding
`resource.data.tenantId == request.auth.token.tenantId` to that rule.

**[MINOR] `bulkImportStudents` function name inconsistency** Auth plan names the
bulk import function `bulkImportStudents` (§7.3). Frontend plan (§4.4
integration table) references `bulkCreateStudents`. Pick one name and use it
everywhere.

---

### 2.2 Plan 02 — AutoGrade (Own Plan)

**Status:** Sound design. No internal inconsistencies. The grading pipeline
state machine, partial grading, DLQ, and retry patterns are all correct. The
rubric inheritance chain is well-specified.

**Self-identified gaps (to be reconciled with other plans):**

**[CRITICAL] `RubricCriterion` fields don't match LevelUp's definition** — see
§3 below.

**[CRITICAL] `EvaluationDimension` fields don't match LevelUp's definition** —
see §3 below.

**[MODERATE] `ExamAnalytics` duplication** — AutoGrade defines `ExamAnalytics`
in section 3.8, and Analytics module defines its own `ExamAnalytics` in section
2.5 of plan 04. These schemas differ. One module must own this document.
Recommend: AutoGrade writes `ExamAnalytics` (since it owns exam/submission
data); Analytics module reads it and enriches with LevelUp cross-references
(`suggestedSpaceId`, `topicInsights`). The Analytics plan's richer schema should
become the canonical definition, and AutoGrade should adopt it.

**[MINOR] Scanner app scope decision** AutoGrade §9.1 states "online-only for
now." Frontend §8.2 implements a full offline queue with IndexedDB. This must be
resolved. See §4.4 below.

---

### 2.3 Plan 03 — LevelUp

**Overall:** Comprehensive and well-structured. The learning space model is
rich. Key integration concern is the shared type definitions diverging from
AutoGrade's.

**Positive integrations with AutoGrade:**

- `ExamQuestion.linkedItemId` ↔ `UnifiedItem.meta.migrationSource` provides a
  clean bidirectional linkage.
- `Space.linkedStoryPointId` mentioned in AutoGrade's exam schema enables
  exam→space cross-referencing.
- The LevelUp practice/test answer evaluation pipeline correctly uses
  `UnifiedEvaluationResult` — the same type AutoGrade uses for question grading
  output.

**Issues found:**

**[CRITICAL] `RubricCriterion` definition conflicts with AutoGrade's**

AutoGrade's `RubricCriterion` (plan 02, §2.2):

```typescript
interface RubricCriterion {
  description: string;
  marks: number;
}
```

LevelUp's `RubricCriterion` (plan 03, §3.5):

```typescript
interface RubricCriterion {
  id: string;
  name: string;
  description?: string;
  maxPoints: number;
  weight?: number;
  levels?: Array<{ score: number; label: string; description: string }>;
}
```

These are the same shared type (`packages/shared-types/src/content/rubric.ts`)
but have incompatible fields. AutoGrade's Gemini extraction prompt returns
`criteria` with `description` and `marks`. LevelUp's UI renders criteria with
`name` and `maxPoints`. The canonical definition must be resolved before
implementation.

**Proposed resolution:** Adopt LevelUp's richer schema as the canonical
definition. AutoGrade's extraction prompt must be updated to return `id`,
`name`, `maxPoints` (not `marks`). The migration field-mapping must use
`marks → maxPoints`.

**[CRITICAL] `EvaluationDimension` definition conflicts with AutoGrade's**

AutoGrade's `EvaluationDimension` (plan 02, §2.2):

```typescript
interface EvaluationDimension {
  id: string;
  name: string;
  description: string;
  icon?: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  promptGuidance: string;
  enabled: boolean;
  isDefault: boolean;
  isCustom: boolean;
  expectedFeedbackCount?: number;
  createdAt?: Timestamp;
  createdBy?: string;
}
```

LevelUp's `EvaluationDimension` (plan 03, §3.5):

```typescript
interface EvaluationDimension {
  id: string;
  name: string;
  description?: string;
  weight: number;
  scoringScale: number;
}
```

These are radically different. AutoGrade's version is richer and is required for
the RELMS grading prompt builder (`buildDynamicRELMSPrompt`). LevelUp's version
is a simplified display representation.

**Proposed resolution:** AutoGrade's `EvaluationDimension` is the canonical
definition (it's needed for AI grading). LevelUp should adopt it fully. The
`weight` and `scoringScale` fields from LevelUp's version should be added to
AutoGrade's definition as optional fields.

**[MODERATE] `AssessmentPayload` has a third, ad-hoc rubric schema**

LevelUp's `AssessmentPayload` (plan 03, §3.3) defines:

```typescript
rubric?: Array<{ criterion: string; maxPoints: number; description: string }>;
```

And `ProjectPayload` has the same. This is a third incompatible rubric criterion
schema (not `UnifiedRubric`, not `RubricCriterion`). All rubric representations
should use `UnifiedRubric`. Replace these inline arrays with
`rubric?: UnifiedRubric`.

**[MINOR] `StoryPointType` includes `'test'` as "alias for timed_test (legacy
compat)"** This should be removed before implementation — no need for backward
compat aliases in a fresh build. Keep the enum clean.

---

### 2.4 Plan 04 — Analytics & Intelligence

**Overall:** The analytics architecture is well-designed with appropriate SLAs,
debounce logic, and insight engine approach. The RTDB→Firestore flush mechanism
is correct. However, several field references to AutoGrade's data model are
wrong.

**Positive integrations with AutoGrade:**

- `StudentProgressSummary.autograde` section correctly mirrors AutoGrade's
  submission fields (examId, subject, percentage, grade, weakTopics).
- The `ExamSummaryEntry.isReleased` flag correctly gates visibility.
- Cross-system `TopicCorrelation` linking LevelUp scores with AutoGrade scores
  is a strong design.
- `ClassExamStats.questionStats` referencing AutoGrade's `questionId` and
  `averageScore` is correct.

**Issues found:**

**[CRITICAL BUG] Wrong field name: `submission.status` vs
`submission.pipelineStatus`**

In plan 04, §7.2 `computeExamAnalytics`:

```typescript
.where('status', 'in', ['grading_complete', 'released'])
```

AutoGrade's `Submission` schema (plan 02, §3.3) uses `pipelineStatus` (not
`status`) and `'results_released'` (not `'released'`). The correct query is:

```typescript
.where('pipelineStatus', 'in', ['grading_complete', 'reviewed', 'results_released'])
```

**[CRITICAL BUG] Wrong field name: `submission.isReleased` vs
`submission.resultsReleased`**

In plan 04, §5.2 `updateStudentProgressSummary`:

```typescript
.where('isReleased', '==', true)
```

AutoGrade's `Submission` uses `resultsReleased: boolean` (plan 02, §3.3). Must
be:

```typescript
.where('resultsReleased', '==', true)
```

Also in `ExamSummaryEntry.isReleased` — the field should be named
`resultsReleased` to match the source schema.

**[CRITICAL BUG] No student→user UID linkage in Submission schema**

In plan 04, §5.2:

```typescript
.where('studentUserId', '==', userId)
```

AutoGrade's `Submission` (plan 02, §3.3) has `studentId: string` (the
tenant-scoped student entity ID), not a Firebase Auth UID. There is no
`studentUserId` field. To query a student's submissions by auth UID, the system
would need to:

1. Look up the student entity:
   `students.where('authUid', '==', userId).limit(1)`
2. Get the `studentId`
3. Then query submissions by `studentId`

**Suggested fix:** Add `studentAuthUid: string` to the `Submission` schema in
AutoGrade plan, populated from the student entity's `authUid` at submission
creation time. This enables a single-step query from Auth UID to submissions. OR
analytics can perform the two-step lookup.

**[MODERATE] `ExamAnalytics` ownership conflict**

Both AutoGrade (plan 02, §3.8) and Analytics (plan 04, §2.5) define
`ExamAnalytics` schemas for the same collection
(`/tenants/{tenantId}/examAnalytics/{examId}`). The schemas differ:

- AutoGrade's has `topicPerformance`, `discriminationIndex`, `commonMistakes`
- Analytics has `topicInsights` with `suggestedSpaceId`, richer statistical
  fields (`standardDeviation`, `p25`, `p75`), `gradeDistribution`

**Resolution:** Analytics module owns the `ExamAnalytics` document (it's the
aggregator by design). AutoGrade's plan should remove its own `ExamAnalytics`
schema and instead call an Analytics callable function (`computeExamAnalytics`)
after grading completes. AutoGrade's `finalizeSubmission` should enqueue the
analytics computation as a Cloud Task — this is already described in AutoGrade
§5 but the ownership needs to be explicit.

**[MODERATE] Grading pipeline states used in analytics queries are incomplete**

Plan 04's `computeExamAnalytics` only queries for `'grading_complete'` and
`'released'` states. But AutoGrade also has `'reviewed'` as a valid fully-graded
state (between `grading_complete` and `results_released`). Analytics should
include `'reviewed'` in its queries. See the bug fix above.

**[MINOR] `onSpaceProgressWrite` trigger also updates leaderboard** Analytics
plan has Firestore trigger on `spaceProgress` that calls `updateLeaderboard`.
This is fine, but AutoGrade's grading pipeline doesn't write to `spaceProgress`
— it writes to `submissions`. Leaderboard updates from AutoGrade results must
come through a separate trigger on `submissions` or through
`StudentProgressSummary` updates. Ensure there's a trigger path for AutoGrade
exam results to reach the leaderboard (if that's desired — this may be
intentionally excluded).

---

### 2.5 Plan 05 — Frontend Apps

**Overall:** Comprehensive screen architecture with good wireframes. AutoGrade
screens (exam editor, grading review, scanner) are well-described and match the
backend design. Key issue is the scanner offline contradiction.

**Positive integrations with AutoGrade:**

- Grading Review screen (§5.2) correctly shows: answer image viewer, AI score +
  confidence, rubric breakdown, override modal with reason field. This maps
  directly to AutoGrade's `manualGradeQuestion` CF.
- DLQ badge in teacher dashboard ("X grading failures") matches AutoGrade §16.5
  monitoring spec.
- Exam card with pipeline status indicators is correct.
- PDF download button on result view calls `generateResultPDF` correctly.
- Student result view correctly shows structured feedback (strengths,
  weaknesses, key takeaway, mistake classification) matching
  `UnifiedEvaluationResult`.

**Issues found:**

**[CRITICAL] Scanner offline contradiction**

AutoGrade plan §9.1 explicitly states: _"For the initial implementation, the
scanner app operates online-only. Offline support may be added in a future
phase."_

Frontend plan §8.2 implements a full offline architecture:

- IndexedDB `QueuedUpload` store
- Background Sync API
- Service Worker for offline shell caching
- `navigator.onLine` connectivity indicator
- `[Save to Queue]` button in capture flow

**Resolution required:** Either:

- **Option A (Recommended):** Implement offline support from the start. The
  frontend plan's architecture is sound and the user experience benefit is high
  for scanner operators in low-connectivity environments. Update AutoGrade plan
  to reflect this.
- **Option B:** Remove offline from Frontend plan, make scanner online-only.
  Simpler to build.

The AutoGrade plan's design decision table says "Scanner app offline:
Online-only for now." This was a deliberate user decision. Frontend must align.
Recommend raising this with the user for confirmation before implementation.

**[MODERATE] `bulkCreateStudents` vs `bulkImportStudents` function name**

Frontend §4.4 integration table references `bulkCreateStudents`. Auth plan §7.3
names this `bulkImportStudents`. Must be consistent — one Cloud Function, one
name.

**[MODERATE] Teacher Web missing DLQ resolution UI**

AutoGrade's dead-letter queue design (§16.3) specifies that teachers can: retry,
manually grade, or dismiss DLQ entries. The frontend plan's Teacher Web screen
architecture (§5.1) lists "Grading Status (pipeline progress per student)" and
"Grading Review (per-student, per-question)" but doesn't explicitly show a DLQ
management screen. Suggest adding a "Failed Gradings" section in the Exam
Submission Manager that surfaces DLQ items with retry/manual grade/dismiss
actions.

**[MINOR] Question extraction progress indicator**

AutoGrade §7.1 states: _"Update RTDB progress for real-time UI feedback"_ during
question extraction. Frontend plan doesn't explicitly describe this real-time
feedback UI. Should show a progress spinner/bar in the Exam Editor while
extraction is running (since it can take up to 9 minutes).

**[MINOR] Scanner app navigation in Frontend doesn't show exam status
filtering**

AutoGrade §9.2 flow says: "Select Exam (from published exams for scanner's
tenant)." Frontend §8.1 shows the Exam Selector correctly. However, the frontend
wireframe shows "Active Exams" but should filter by `status == 'published'` as
specified in AutoGrade. This is a minor clarification needed in the frontend
spec.

---

## 3. Unified Question/Rubric Model — Inconsistencies

This is the most critical cross-plan issue and must be resolved before any code
is written.

### 3.1 The Problem

Two plans define the same `UnifiedRubric`-related types in
`packages/shared-types` but with incompatible schemas:

| Type                                 | AutoGrade Plan (§2.2)   | LevelUp Plan (§3.5) |
| ------------------------------------ | ----------------------- | ------------------- |
| `RubricCriterion.marks`              | `marks: number`         | Not present         |
| `RubricCriterion.maxPoints`          | Not present             | `maxPoints: number` |
| `RubricCriterion.id`                 | Not present             | `id: string`        |
| `RubricCriterion.name`               | Not present             | `name: string`      |
| `RubricCriterion.weight`             | Not present             | `weight?: number`   |
| `RubricCriterion.levels`             | Not present             | `levels?: [...]`    |
| `EvaluationDimension.priority`       | `'HIGH'│'MEDIUM'│'LOW'` | Not present         |
| `EvaluationDimension.promptGuidance` | `string`                | Not present         |
| `EvaluationDimension.enabled`        | `boolean`               | Not present         |
| `EvaluationDimension.weight`         | Not present             | `number`            |
| `EvaluationDimension.scoringScale`   | Not present             | `number`            |

### 3.2 Proposed Canonical Schema

The canonical `packages/shared-types/src/content/rubric.ts` should be:

```typescript
interface RubricCriterion {
  id: string; // Required — stable identifier
  name: string; // Display name (e.g., "Correct setup")
  description?: string; // Optional longer description
  maxPoints: number; // CANONICAL field name (AutoGrade's 'marks' → renamed)
  weight?: number; // Relative weight for hybrid scoring
  levels?: Array<{
    score: number;
    label: string;
    description: string;
  }>;
}

interface EvaluationDimension {
  id: string;
  name: string;
  description: string;
  icon?: string;
  priority: "HIGH" | "MEDIUM" | "LOW"; // From AutoGrade — required for prompt ordering
  promptGuidance: string; // From AutoGrade — required for RELMS
  enabled: boolean; // From AutoGrade — required for EvaluationSettings
  isDefault: boolean;
  isCustom: boolean;
  weight?: number; // From LevelUp — optional for weighted scoring
  scoringScale?: number; // From LevelUp — optional
  expectedFeedbackCount?: number;
  createdAt?: Timestamp;
  createdBy?: string;
}
```

### 3.3 Impact on AutoGrade

- **Question extraction prompt output** must return `id` (generated UUID),
  `name`, `maxPoints` instead of `description`, `marks`.
- **RELMS prompt builder** uses `criterion.maxPoints` instead of
  `criterion.marks`.
- **Rubric validation** checks
  `sum(criteria.map(c => c.maxPoints)) == question.maxMarks`.
- **Migration field mapping** must map existing `marks` → `maxPoints`, generate
  `id` and `name` from `description`.

---

## 4. Missing Integration Points

### 4.1 AutoGrade → Analytics trigger for exam results

**Gap:** When AutoGrade releases exam results (`releaseExamResults` CF),
`StudentProgressSummary` needs to be updated for every affected student.
Currently Analytics plan §5.1 lists
`Submission.isReleased → true (Firestore trigger)` as a trigger source — but
this field is wrong (see §2.4 bug). The trigger should fire on `resultsReleased`
field change.

**Suggested fix:** Add a Firestore `onDocumentUpdated` trigger in Analytics
module that fires when `submissions/{id}.resultsReleased` changes from `false`
to `true`.

### 4.2 AutoGrade → LevelUp cross-domain recommendations

**Gap:** Analytics `topicInsights` field in `ExamAnalytics` has
`suggestedSpaceId` — a LevelUp space recommended for weak topics. But the plan
doesn't specify how this space is identified. AutoGrade knows `weakTopics` from
exam data; it needs to find a LevelUp space covering those topics. This
cross-domain query isn't described.

**Suggested approach:** Analytics Insight Engine queries
`/tenants/{tenantId}/spaces` filtered by `subject` matching exam subject and
`labels` or `topics` matching weak topics. This is a rule-based lookup,
consistent with the Analytics plan's "no LLM" principle.

### 4.3 Result release → parent notification

**Gap:** AutoGrade §7.1 `releaseExamResults` CF step 5 says: "If parent portal
enabled, notify parents too." But no specific notification flow is defined for
parents. The Notification schema (Analytics plan §2.10) has
`NotificationType: 'result_released'`, which is correct. AutoGrade's result
release CF should call a notification-creation function in Analytics. This
interface (callable or direct Firestore write to `/notifications/`) must be
agreed between the two modules.

**Suggested:** AutoGrade CF writes directly to
`/tenants/{tenantId}/notifications/` (using Admin SDK) without calling an
Analytics CF, since it already has all the data (studentId, examId, parentIds
from `parentLinkedStudentIds`). The Analytics plan already defines the
notification schema.

### 4.4 Scanner device session and tenant context

**Gap:** The auth plan's scanner custom token flow doesn't explicitly document
how the scanner device knows its `tenantId` for scoping API calls. The scanner
app must pass `tenantId` in all upload requests (`uploadAnswerSheets` CF
requires it).

**Clarification needed:** Is `tenantId` embedded in the custom token claims?
Looking at the auth plan's `PlatformClaims`, `scannerId` is present. The
`tenantId` is also in claims. So this should work — but the auth plan should
explicitly confirm that the scanner custom token includes `tenantId` in claims,
identical to other user types.

### 4.5 ExamAnalytics ownership handoff

As identified in §2.4, both AutoGrade and Analytics define `ExamAnalytics`. The
handoff protocol must be explicit:

1. AutoGrade's `finalizeSubmission` → enqueues Cloud Task to Analytics'
   `computeExamAnalytics`
2. Analytics' function reads from AutoGrade's submissions/questionSubmissions
3. Analytics writes `ExamAnalytics` document
4. AutoGrade's UI reads `ExamAnalytics` from Firestore

AutoGrade should not write to `ExamAnalytics` directly — that's Analytics'
document.

---

## 5. Cloud Function Naming Conventions

Review of naming across all plans:

| Function               | Auth Plan            | AutoGrade Plan         | Analytics Plan                 | Frontend Reference      |
| ---------------------- | -------------------- | ---------------------- | ------------------------------ | ----------------------- |
| Bulk student import    | `bulkImportStudents` | —                      | —                              | `bulkCreateStudents` ❌ |
| Scanner registration   | _(unnamed)_          | _(unnamed)_            | —                              | —                       |
| Org switch             | `switchActiveTenant` | —                      | —                              | `switchActiveTenant` ✓  |
| Answer mapping         | —                    | `processAnswerMapping` | —                              | —                       |
| Answer grading         | —                    | `processAnswerGrading` | —                              | —                       |
| Question extraction    | —                    | `extractQuestions`     | —                              | —                       |
| Exam analytics         | —                    | `computeExamAnalytics` | `computeExamAnalytics` ✓       | —                       |
| Practice flush         | —                    | —                      | `flushPracticeProgress`        | —                       |
| Student summary update | —                    | —                      | `updateStudentProgressSummary` | —                       |

**Action items:**

1. Standardize bulk import CF name: use `bulkImportStudents` everywhere.
2. Name the scanner registration CF: suggest `createScannerDevice`.
3. Analytics and AutoGrade both define `computeExamAnalytics` — Analytics must
   own it.

---

## 6. Suggested Changes Summary

| Priority              | Module        | Change                                                                                                 |
| --------------------- | ------------- | ------------------------------------------------------------------------------------------------------ |
| **P0 - Blocker**      | shared-types  | Reconcile `RubricCriterion` schema: adopt LevelUp's fields, rename `marks→maxPoints`, add `id`, `name` |
| **P0 - Blocker**      | shared-types  | Reconcile `EvaluationDimension` schema: merge both definitions                                         |
| **P0 - Bug**          | Analytics     | Fix `submission.status` → `submission.pipelineStatus`; `'released'` → `'results_released'`             |
| **P0 - Bug**          | Analytics     | Fix `submission.isReleased` → `submission.resultsReleased`                                             |
| **P0 - Bug**          | Analytics     | Fix `studentUserId` query gap — add `studentAuthUid` to Submission or implement two-step lookup        |
| **P1 - Critical**     | AutoGrade     | Decide: scanner offline or online-only? Align with Frontend plan                                       |
| **P1 - Critical**     | Analytics     | Resolve `ExamAnalytics` ownership: Analytics owns it, AutoGrade enqueues computation                   |
| **P1 - Critical**     | AutoGrade     | Update extraction prompt to return `id`, `name`, `maxPoints` per canonical schema                      |
| **P2 - Important**    | Auth          | Name and specify `createScannerDevice` Cloud Function                                                  |
| **P2 - Important**    | Auth          | Add tenant check to `/scanners/{scannerId}` Firestore rules                                            |
| **P2 - Important**    | Auth/Frontend | Standardize bulk import CF name: `bulkImportStudents`                                                  |
| **P2 - Important**    | AutoGrade     | Add `studentAuthUid` field to `Submission` for analytics queries                                       |
| **P2 - Important**    | AutoGrade     | Add result-release → parent notification integration point                                             |
| **P3 - Nice to have** | Frontend      | Add DLQ management UI to Teacher Web exam detail                                                       |
| **P3 - Nice to have** | Frontend      | Add extraction progress indicator in Exam Editor                                                       |
| **P3 - Nice to have** | LevelUp       | Remove `'test'` alias from `StoryPointType` enum                                                       |
| **P3 - Nice to have** | LevelUp       | Replace `AssessmentPayload.rubric` and `ProjectPayload.rubric` inline arrays with `UnifiedRubric`      |

---

## 7. Approval Status

| Plan                              | Status                       | Condition                                                                                                                                                                                      |
| --------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **01 — Identity & Auth**          | ✅ **Approved with changes** | Name `createScannerDevice` CF; add tenant check to scanner Firestore rules; standardize `bulkImportStudents` name                                                                              |
| **02 — AutoGrade**                | ✅ **Approved with changes** | Update `RubricCriterion` to canonical schema; add `studentAuthUid` to Submission; resolve scanner offline decision; hand `ExamAnalytics` ownership to Analytics                                |
| **03 — LevelUp**                  | ⚠️ **Needs revision**        | Must adopt canonical `RubricCriterion` (rename `maxPoints`, add `id`/`name`); must adopt canonical `EvaluationDimension`; replace inline rubric arrays in `AssessmentPayload`/`ProjectPayload` |
| **04 — Analytics & Intelligence** | ❌ **Needs revision**        | Fix 3 critical bugs (wrong field names); resolve `ExamAnalytics` ownership with AutoGrade; fix `ExamSummaryEntry.isReleased → resultsReleased`                                                 |
| **05 — Frontend Apps**            | ✅ **Approved with changes** | Resolve scanner offline decision; add DLQ management UI; fix CF name consistency (`bulkImportStudents`)                                                                                        |

---

## 8. Recommended Resolution Order

1. **First:** Reconcile `UnifiedRubric`/`RubricCriterion`/`EvaluationDimension`
   in `packages/shared-types`. All modules depend on this. (AutoGrade + LevelUp
   engineers together)
2. **Second:** Fix Analytics plan's 3 critical bugs. (Analytics engineer)
3. **Third:** Decide scanner offline support. (User decision → Frontend +
   AutoGrade update accordingly)
4. **Fourth:** Agree on `ExamAnalytics` ownership and handoff protocol.
   (AutoGrade + Analytics engineers)
5. **Fifth:** Add `studentAuthUid` to AutoGrade's Submission schema and update
   analytics query. (AutoGrade engineer)
6. **Sixth:** Name and spec `createScannerDevice` CF. (Auth engineer)

---

_Review complete. All findings are from my AutoGrade perspective. LevelUp,
Analytics, and Frontend engineers should validate these findings in their own
review documents._
