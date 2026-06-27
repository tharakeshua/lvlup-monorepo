# LevelUp Engineer Review — Unified Design Plans

**Reviewer:** LevelUp Engineer **Date:** 2026-02-20 **Task:** Cross-module
consistency review of all 5 unified design plans from the LevelUp perspective
**Plans Reviewed:**

1. `01-identity-auth-design.md` — Identity, Auth & Multi-Tenancy
2. `02-autograde-design.md` — AutoGrade Exam & Grading Module
3. `03-levelup-design.md` — LevelUp Learning Spaces Module _(self-review)_
4. `04-analytics-intelligence-design.md` — Analytics & Intelligence Engine
5. `05-frontend-apps-design.md` — Frontend Applications

---

## Executive Summary

All five design plans are largely coherent and reflect a thoughtful unified B2B
SaaS architecture. However, the cross-plan review from the LevelUp perspective
has surfaced **7 concrete inconsistencies** — several of which are bugs that
would cause runtime errors — and **5 missing integration points** that need to
be addressed before implementation begins.

The most critical issues are:

1. **Shared type split** — `UnifiedRubric` and its sub-types (`RubricCriterion`,
   `EvaluationDimension`) are defined differently in AutoGrade vs LevelUp. This
   will cause type errors at compile time and wrong AI evaluation behavior at
   runtime.
2. **Field name mismatch in Analytics** — Analytics queries `studentUserId` but
   AutoGrade stores `studentId`. This query will silently return no results,
   breaking all student-level analytics for exam submissions.
3. **Status field mismatch in Analytics** — Analytics queries
   `status: 'released'` but AutoGrade sets a boolean `resultsReleased: true`,
   not a status string. Same silent failure.

All other plans are **approved with changes** pending resolution of the items
catalogued below.

---

## Inconsistencies Found

### CRITICAL — Shared Type Conflicts

#### INC-01: `RubricCriterion.marks` vs `RubricCriterion.maxPoints`

**Location:** `02-autograde-design.md` §RubricCriterion vs
`03-levelup-design.md` §RubricCriterion

**AutoGrade defines:**

```typescript
interface RubricCriterion {
  id: string;
  name: string;
  description: string;
  marks: number; // ← "marks"
  weightPercentage?: number;
}
```

**LevelUp defines:**

```typescript
interface RubricCriterion {
  id: string;
  name: string;
  description: string;
  maxPoints: number; // ← "maxPoints"
  weight: number;
  levels?: CriterionLevel[];
}
```

Since `UnifiedRubric` is supposed to be a **shared type** used by both modules,
this is a hard incompatibility. The AI evaluator prompt builder in AutoGrade
will reference `criterion.marks` while LevelUp's evaluator will reference
`criterion.maxPoints` — these are the same semantic concept but different field
names. Cross-module rubric inheritance (tenant→space→exam) will break silently.

**Resolution required:** Standardize on `maxPoints: number` (LevelUp's version
is more expressive with `weight` + `levels[]`). AutoGrade must update all
references from `.marks` to `.maxPoints`. The full `RubricCriterion` interface
should be:

```typescript
interface RubricCriterion {
  id: string;
  name: string;
  description: string;
  maxPoints: number;
  weight?: number; // optional — used for weighting within rubric
  levels?: CriterionLevel[];
}
```

---

#### INC-02: `EvaluationDimension` Structure Divergence

**Location:** `02-autograde-design.md` §EvaluationDimension vs
`03-levelup-design.md` §EvaluationDimension

**AutoGrade defines:**

```typescript
interface EvaluationDimension {
  id: string;
  name: string;
  description: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  promptGuidance: string;
  enabled: boolean;
  isDefault: boolean;
  isCustom: boolean;
  expectedFeedbackCount?: number;
}
```

**LevelUp defines:**

```typescript
interface EvaluationDimension {
  id: string;
  name: string;
  description: string;
  weight: number;
  scoringScale: number;
}
```

These are so different they are effectively separate types despite sharing the
name. AutoGrade's version is focused on qualitative feedback structuring
(`priority`, `promptGuidance`, `expectedFeedbackCount`) while LevelUp's is
focused on quantitative scoring (`weight`, `scoringScale`). Both are valid but
they need to be **merged into a single unified type** or **split into distinct
named types**.

**Resolution required:** Merge into a unified `EvaluationDimension`:

```typescript
interface EvaluationDimension {
  id: string;
  name: string;
  description: string;
  weight?: number; // quantitative weight for scoring
  scoringScale?: number; // max score for this dimension
  priority?: "HIGH" | "MEDIUM" | "LOW"; // qualitative priority for feedback ordering
  promptGuidance?: string; // LLM prompt guidance for this dimension
  enabled?: boolean; // whether active in this rubric
  isDefault?: boolean; // system default vs user-created
  isCustom?: boolean; // user-created dimension
  expectedFeedbackCount?: number; // expected number of feedback points
}
```

All fields optional where applicable; module-level code accesses only what it
needs.

---

#### INC-03: `UnifiedRubric` Extra Fields in LevelUp Not Present in AutoGrade

**Location:** `03-levelup-design.md` §UnifiedRubric vs `02-autograde-design.md`
§UnifiedRubric

LevelUp's `UnifiedRubric` includes:

```typescript
holisticGuidance?: string;   // AI prompt for holistic scoring
holisticMaxScore?: number;   // max score for holistic mode
```

These fields are absent from AutoGrade's `UnifiedRubric` definition. Since
rubrics can be inherited from tenant-level settings that span both modules,
AutoGrade's AI evaluator must be able to read and apply `holisticGuidance` for
`scoring_mode: 'holistic'` rubrics — otherwise holistic rubric inheritance will
be broken when an AutoGrade exam uses a tenant-level rubric authored via
LevelUp.

**Resolution required:** Add `holisticGuidance?: string` and
`holisticMaxScore?: number` to AutoGrade's `UnifiedRubric` definition. These
fields are low-cost to add and high-value for coherence.

---

### HIGH — Analytics Query Field Name Bugs

#### INC-04: Analytics Queries `studentUserId` — AutoGrade Schema Has `studentId`

**Location:** `04-analytics-intelligence-design.md`
§updateStudentProgressSummary vs `02-autograde-design.md` §ExamSubmission

Analytics function:

```typescript
// From analytics plan §updateStudentProgressSummary
const submissionsSnap = await db
  .collection("submissions")
  .where("studentUserId", "==", userId) // ← "studentUserId"
  .where("tenantId", "==", tenantId)
  .get();
```

AutoGrade `ExamSubmission` schema:

```typescript
interface ExamSubmission {
  studentId: string; // ← "studentId" (NOT "studentUserId")
  examId: string;
  tenantId: string;
  // ...
}
```

This query will **silently return zero results** for all students, so
`StudentProgressSummary` data for AutoGrade exams will never be populated. This
is a high-severity data pipeline bug.

**Resolution required:** Analytics plan must use
`.where('studentId', '==', userId)` to match AutoGrade's schema. Alternatively,
standardize on `studentUserId` across both plans — but the AutoGrade plan should
be updated as source of truth since it is more fully specified.

---

#### INC-05: Analytics Queries Exam `status: 'released'` — AutoGrade Uses `resultsReleased: boolean`

**Location:** `04-analytics-intelligence-design.md` §ExamAnalytics aggregation
vs `02-autograde-design.md` §Exam/ExamSubmission

Analytics function:

```typescript
// From analytics plan §ExamAnalytics
.where('status', 'in', ['grading_complete', 'released'])
```

AutoGrade schema:

```typescript
interface Exam {
  status: "draft" | "published" | "active" | "completed" | "archived";
  // No 'released' status
}
interface ExamSubmission {
  resultsReleased: boolean; // separate boolean, not a status value
}
```

`'released'` is not a valid `Exam.status` value in AutoGrade. The query should
filter on `resultsReleased: true` on submissions, not `status: 'released'` on
exams.

**Resolution required:**

```typescript
// Correct query for submissions with released results
const submissionsSnap = await db
  .collection("submissions")
  .where("tenantId", "==", tenantId)
  .where("resultsReleased", "==", true)
  .get();
```

---

### MEDIUM — Schedule Conflict

#### INC-06: `flushStalePracticeProgress` Schedule Mismatch

**Location:** `03-levelup-design.md` §8.3 vs
`04-analytics-intelligence-design.md` §4.3

LevelUp plan (§8.3):

> "Cloud Scheduler: **every 10 minutes** — `flushStalePracticeProgress`"

Analytics plan (§4.3):

> "Cloud Scheduler: **every 6 hours** — `flushStalePracticeProgress`"

These are the same Cloud Scheduler job referenced with incompatible frequencies.
The RTDB→Firestore flush for practice progress is latency-sensitive for
analytics freshness. A 6-hour flush means student practice progress could be
invisible to analytics for up to 6 hours, which degrades the utility of the
Insight Engine recommendations.

**Resolution required:** Determine the intended schedule and reconcile both
plans. Recommendation:

- **10-minute schedule** if near-real-time analytics are a priority (higher
  Cloud Function invocation cost)
- **30-minute schedule** as a pragmatic middle ground
- Both plans must reference the same value

---

### LOW — RTDB Meta Path Naming

#### INC-07: RTDB `_meta` Structure Inconsistency

**Location:** `04-analytics-intelligence-design.md` §RTDB structure vs
`03-levelup-design.md` §RTDB structure

Analytics plan refers to:

```
practiceProgress/{userId}/{spaceId}/_meta/dirty    (boolean)
practiceProgress/{userId}/{spaceId}/_meta/la       (number — lastActiveAt)
```

LevelUp plan refers to:

```
practiceProgress/{userId}/{spaceId}/meta/lastFlushedAt   (timestamp)
```

These are different path segments (`_meta` vs `meta`) and different field names
(`dirty`/`la` vs `lastFlushedAt`). The flush function and the RTDB security
rules in both plans must agree on the exact path.

**Resolution required:** Standardize on a single structure. Recommendation:

```
practiceProgress/{userId}/{spaceId}/_meta/dirty           (boolean — whether flush is needed)
practiceProgress/{userId}/{spaceId}/_meta/lastActiveAt    (number — Unix ms)
practiceProgress/{userId}/{spaceId}/_meta/lastFlushedAt   (number — Unix ms)
```

Use `_meta` (underscore prefix) to visually distinguish from data nodes. Update
both plans and RTDB security rules accordingly.

---

## Missing Integration Points

### MIP-01: AutoGrade Submission Trigger for `studentProgressSummaries`

**Plans:** `02-autograde-design.md`, `04-analytics-intelligence-design.md`

The analytics plan describes `updateStudentProgressSummary` as being triggered
when `submission.isReleased` changes, but AutoGrade uses
`resultsReleased: boolean` (see INC-05). Beyond the field name fix, the
**trigger mechanism** is not explicitly defined in either plan. AutoGrade's
`releaseExamResults` Cloud Function sets `resultsReleased: true` — this should
explicitly trigger (or call) the analytics update function.

**Action required:** AutoGrade's `releaseExamResults` function must either:

1. Directly call the Analytics `updateStudentProgressSummary` function after
   releasing results, OR
2. Publish to a Pub/Sub topic that Analytics subscribes to

Neither plan specifies this integration. The AutoGrade plan should be updated to
document that it calls/publishes the analytics update trigger.

---

### MIP-02: `Exam.linkedSpaceId` / `ExamQuestion.linkedItemId` Usage in LevelUp

**Plans:** `02-autograde-design.md`, `03-levelup-design.md`

AutoGrade defines `Exam.linkedSpaceId` and `ExamQuestion.linkedItemId` for
cross-domain linkage, but the LevelUp plan makes no mention of how LevelUp
responds to this linkage. Specifically:

- When a teacher links an AutoGrade exam to a LevelUp space, does the space
  editor show this linkage?
- Does LevelUp's item bank expose items for AutoGrade question import?
- Is there a UI flow in the space editor to "export items to AutoGrade exam"?

**Action required:** LevelUp plan should add a section describing the read-only
display of `linkedExamId` on a LevelUp space, and specify whether an item export
workflow is in scope for Phase 4.

---

### MIP-03: AI Tutor Chat Session History Management

**Plans:** `03-levelup-design.md`, `05-frontend-apps-design.md`

The LevelUp plan describes AI tutor chat sessions stored in Firestore
(`/spaces/{spaceId}/chatSessions/{sessionId}`), and the frontend plan describes
the AI Tutor Chat as a slide-over panel. However, neither plan describes:

- How students navigate/resume prior chat sessions within the same space
- Whether there is a session history list UI
- How sessions are scoped (per storyPoint vs per space)
- Whether session history is visible to teachers (for review/moderation)

**Action required:** Both plans should add a brief specification for chat
session history UX and teacher visibility. At minimum: scoping (per space),
student resumption behavior (auto-resume last session or list view), and teacher
read access.

---

### MIP-04: Roll-Number Student Firestore Access for Timed Tests

**Plans:** `01-identity-auth-design.md`, `03-levelup-design.md`

The identity plan establishes synthetic email accounts for roll-number students
(`{rollNumber}@{tenantId}.levelup.internal`) with a `ConsumerProfile`. The
LevelUp plan correctly references `DigitalTestSession` for timed tests. However,
neither plan explicitly specifies the Firestore security rules that allow a
roll-number student (authenticated with synthetic email) to:

1. Read their `DigitalTestSession` document
2. Write their `TestSubmission` answers during a live test
3. Be blocked from reading `answerKeys` (which LevelUp correctly marks
   `allow read: if false`)

The RTDB rules for `practiceProgress` are defined, but Firestore rules for the
roll-number student timed test flow are only implied.

**Action required:** Identity/Auth plan §Firestore Rules or LevelUp plan
§Security should add explicit Firestore rules for `DigitalTestSession` student
read/write access and confirm roll-number student claim structure enables these
rules.

---

### MIP-05: Space Progress Aggregation Trigger after Practice Flush

**Plans:** `03-levelup-design.md`, `04-analytics-intelligence-design.md`

The LevelUp plan describes `flushStalePracticeProgress` writing to
`SpaceProgress` documents in Firestore. The Analytics plan describes
`classProgressSummaries` being aggregated from `SpaceProgress`. However, neither
plan specifies **what triggers the class-level aggregation** after a practice
flush writes new data to `SpaceProgress`.

The AutoGrade side has Cloud Tasks with a 3-minute debounce for class summaries,
but no equivalent mechanism is described for the LevelUp practice→class-progress
pipeline.

**Action required:** Analytics plan should specify a trigger (Firestore
`onWrite` on `SpaceProgress` → Cloud Tasks debounce →
`updateClassProgressSummary`) that mirrors the AutoGrade exam submission → class
summary pattern. LevelUp plan should acknowledge this downstream trigger exists.

---

## Per-Plan Feedback

### Plan 01 — Identity, Auth & Multi-Tenancy

**Verdict: APPROVED WITH CHANGES**

Strengths:

- Clean `PlatformClaims` JWT structure with `tenantId`, `role`, `permissions` is
  well-suited for LevelUp's space access control
- `TeacherPermissions` correctly includes `canCreateSpaces`, `managedSpaceIds`,
  `canConfigureAgents` — these are exactly what LevelUp space editor gates need
- `ConsumerProfile.enrolledSpaceIds` cleanly supports the student enrollment
  model
- RTDB security rules for `practiceProgress` are well-structured

Issues:

- **MIP-04** — Firestore rules for roll-number student timed test access not
  explicitly specified
- The `canConfigureAgents` permission is referenced in LevelUp's agent config UI
  but the definition of what this permission controls (per-space? tenant-wide?)
  is ambiguous. Clarify: does `canConfigureAgents` gate creating _any_ agent in
  the tenant, or only within spaces the teacher manages (`managedSpaceIds`)?

---

### Plan 02 — AutoGrade Exam & Grading Module

**Verdict: APPROVED WITH CHANGES — Requires resolution of INC-01, INC-02, INC-03
before shared-types package is defined**

Strengths:

- Panopticon + RELMS pipeline is well-specified
- Cross-domain linkage via `Exam.linkedSpaceId` and `ExamQuestion.linkedItemId`
  is present
- `UnifiedEvaluationResult` structure is appropriate for LevelUp to consume for
  item grading
- `LLMWrapper` abstraction with per-tenant Secret Manager key retrieval is
  correct

Issues:

- **INC-01** — `RubricCriterion.marks` must be renamed to `maxPoints`
- **INC-02** — `EvaluationDimension` structure must be merged with LevelUp's
  definition
- **INC-03** — `UnifiedRubric` must add `holisticGuidance` and
  `holisticMaxScore`
- **INC-04** — `ExamSubmission.studentId` field name confirmed as source of
  truth (Analytics must fix)
- **INC-05** — `resultsReleased: boolean` confirmed as source of truth
  (Analytics must fix)
- **MIP-01** — `releaseExamResults` CF must explicitly trigger analytics update
- **MIP-02** — `linkedSpaceId` usage in LevelUp UI not specified — needs
  cross-team alignment

---

### Plan 03 — LevelUp Learning Spaces Module (Self-Review)

**Verdict: APPROVED WITH CHANGES — Self-identified issues requiring fixes**

The overall structure is sound. The following self-identified items need
correction:

Self-identified issues:

- **INC-01** — Confirm `maxPoints` as canonical field name (self-consistent,
  needs AutoGrade to align)
- **INC-02** — `EvaluationDimension` needs to absorb AutoGrade's additional
  fields for shared-type compatibility
- **INC-03** — `holisticGuidance`/`holisticMaxScore` should be added to the
  shared type definition explicitly
- **INC-06** — Flush schedule "every 10 minutes" in §8.3 must be reconciled with
  Analytics plan
- **INC-07** — RTDB `meta/lastFlushedAt` path must be standardized to
  `_meta/lastFlushedAt`
- **MIP-02** — Add a section describing how `Exam.linkedSpaceId` is surfaced in
  the space editor (even if read-only)
- **MIP-03** — Add AI tutor chat session history behavior specification
- **MIP-04** — Add explicit Firestore rules for roll-number student timed test
  access
- **MIP-05** — Acknowledge that `flushStalePracticeProgress` triggers downstream
  `classProgressSummary` aggregation

---

### Plan 04 — Analytics & Intelligence Engine

**Verdict: NEEDS REVISION — Two critical query bugs must be fixed before
implementation**

Strengths:

- Insight Engine as rule-based (non-LLM) system is the right call for cost and
  latency
- Cloud Tasks 3-minute debounce for class summaries is well-designed
- Nightly analytics scheduler structure is sound
- `studentProgressSummaries` / `classProgressSummaries` data model is correct

Issues:

- **INC-04** — `studentUserId` must be corrected to `studentId` in all
  submission queries
- **INC-05** — `status: 'released'` query must be corrected to
  `resultsReleased: true`
- **INC-06** — Flush schedule "every 6 hours" must be reconciled with LevelUp
  plan
- **INC-07** — RTDB `_meta/dirty` and `_meta/la` path must be standardized
- **MIP-01** — Must specify how analytics is triggered after AutoGrade results
  release
- **MIP-05** — Must specify LevelUp practice→class-progress aggregation trigger

---

### Plan 05 — Frontend Applications

**Verdict: APPROVED WITH CHANGES**

Strengths:

- Timed Test Runner wireframe correctly reflects 5-status question navigator
  (not_visited, not_answered, answered, marked_for_review, answered_and_marked)
- Space Editor drag-to-reorder story points and section manager are correctly
  specified
- All 15 question renderer components are listed with correct type identifiers
- AI Tutor Chat slide-over panel architecture is appropriate
- Scanner offline IndexedDB queue with Background Sync API is well-designed
- Teacher permission gates correctly reference `canCreateSpaces`,
  `canConfigureAgents`
- `QuestionRendererProps.mode: 'answer' | 'review' | 'preview'` interface is
  correct

Issues:

- **MIP-03** — No screen specified for AI tutor chat session history. Add at
  minimum a "Previous Chats" section within the space viewer or a modal listing
  past sessions
- The `chat_agent_question` item type renderer is listed but its behavior in
  `'review'` mode is not described. Specify: does the student's chat transcript
  replay in review mode, or is it hidden?
- The space viewer's student progress tracking (marking items complete, resuming
  from last position) is mentioned but the Firestore write path for this
  progress update is not specified in the frontend plan. Confirm it writes to
  `SpaceProgress.items[itemId]` directly or via a Cloud Function

---

## Suggested Shared-Types Package Structure

Given the inconsistencies found, I recommend that the implementation begins by
establishing a `shared-types` package that is the **single source of truth** for
all cross-module types. Both AutoGrade and LevelUp Cloud Functions and frontend
apps import from this package.

```
packages/shared-types/
  src/
    rubric.ts          # UnifiedRubric, RubricCriterion, EvaluationDimension (merged from INC-01..03)
    evaluation.ts      # UnifiedEvaluationResult, EvaluationFeedback
    item.ts            # UnifiedItem, all 15 question subtypes, 7 material subtypes
    progress.ts        # SpaceProgress, ItemProgressEntry, StudentProgressSummary
    analytics.ts       # ClassProgressSummary, ExamAnalytics, InsightCard
    index.ts           # re-exports all
```

This will prevent future type drift between plans and catch INC-01/INC-02/INC-03
class issues at compile time.

---

## Summary Table

| Item                                              | Type                  | Severity | Affects Plans | Status                       |
| ------------------------------------------------- | --------------------- | -------- | ------------- | ---------------------------- |
| INC-01: `marks` vs `maxPoints`                    | Type conflict         | CRITICAL | 02, 03        | Must fix before shared-types |
| INC-02: `EvaluationDimension` divergence          | Type conflict         | CRITICAL | 02, 03        | Must fix before shared-types |
| INC-03: Missing `holistic*` fields in AutoGrade   | Type gap              | HIGH     | 02, 03        | Fix in AutoGrade plan        |
| INC-04: `studentUserId` vs `studentId`            | Query bug             | CRITICAL | 02, 04        | Fix in Analytics plan        |
| INC-05: `status: 'released'` vs `resultsReleased` | Query bug             | CRITICAL | 02, 04        | Fix in Analytics plan        |
| INC-06: Flush schedule 10min vs 6hr               | Config conflict       | MEDIUM   | 03, 04        | Decide and reconcile         |
| INC-07: RTDB `meta` vs `_meta` path               | Path conflict         | LOW      | 03, 04        | Standardize                  |
| MIP-01: AutoGrade→Analytics trigger               | Missing integration   | HIGH     | 02, 04        | Add to AutoGrade CF          |
| MIP-02: `linkedSpaceId` UX in LevelUp             | Missing UI spec       | MEDIUM   | 02, 03        | Add to LevelUp plan          |
| MIP-03: Chat session history                      | Missing UX spec       | MEDIUM   | 03, 05        | Add to both plans            |
| MIP-04: Roll-number Firestore rules               | Missing security spec | HIGH     | 01, 03        | Add to Identity plan         |
| MIP-05: Practice→class-progress trigger           | Missing integration   | HIGH     | 03, 04        | Add to Analytics plan        |

**Plan Verdicts:** | Plan | Verdict | |------|---------| | 01 — Identity & Auth
| Approved with changes | | 02 — AutoGrade | Approved with changes (resolve
INC-01, 02, 03 first) | | 03 — LevelUp _(self)_ | Approved with changes | | 04 —
Analytics | **Needs revision** (INC-04, INC-05 are critical bugs) | | 05 —
Frontend | Approved with changes |
