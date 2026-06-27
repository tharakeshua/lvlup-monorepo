# Student Portal Progress System — Current State Analysis & Gaps

## Executive Summary

The student portal has a well-designed **type system** and **cloud function
backend** for tracking progress, but the **client-side submission flow is
broken** — answers are evaluated but never persisted to Firestore. This means no
student progress is actually saved to the database, and the UI shows empty
progress on page reload.

---

## 1. Current Architecture

### Data Model (Firestore)

```
/tenants/{tenantId}/spaceProgress/{userId}_{spaceId}   ← 1 doc per user per space
├── userId, tenantId, spaceId
├── status: 'not_started' | 'in_progress' | 'completed'
├── pointsEarned, totalPoints, percentage
├── storyPoints: Record<storyPointId, StoryPointProgress>
│     ├── storyPointId, status, pointsEarned, totalPoints, percentage
│     └── completedAt?
├── items: Record<itemId, ItemProgressEntry>
│     ├── itemId, itemType, completed, completedAt?, timeSpent?, interactions
│     ├── questionData?: { status, attemptsCount, bestScore, pointsEarned, totalPoints, percentage, solved }
│     └── feedback?
├── startedAt?, completedAt?
└── updatedAt
```

### Submission Flows

**Flow A: Standard Story Point (learning) — StoryPointViewerPage.tsx**

```
Student answers → autoEvaluateClient() OR callEvaluateAnswer() → setEvaluations (React state) → STOP
                                                                                     ↑ NEVER calls recordItemAttempt
```

**Flow B: Practice Mode — PracticeModePage.tsx**

```
Student answers → autoEvaluateClient() OR callEvaluateAnswer() → setEvaluations (React state)
                                                                → persistToRTDB() → RTDB (NOT Firestore)
                                                                                     ↑ NEVER calls recordItemAttempt
```

**Flow C: Timed Test — TimedTestPage.tsx**

```
Student answers → useSaveAnswer() → recordItemAttempt (BROKEN: contract mismatch)
Student submits test → callSubmitTestSession() → Cloud Function → updateSpaceProgress() ← WORKS
```

### Cloud Functions

| Function            | Purpose                                          | Writes to Firestore?                                                   |
| ------------------- | ------------------------------------------------ | ---------------------------------------------------------------------- |
| `recordItemAttempt` | Record single item attempt, update spaceProgress | YES — updates spaceProgress with best score, per-storyPoint aggregates |
| `evaluateAnswer`    | AI-evaluate a single answer                      | NO — only returns evaluation result                                    |
| `submitTestSession` | Submit completed test, grade all answers         | YES — updates digitalTestSession + spaceProgress                       |
| `startTestSession`  | Create new test session                          | YES — creates digitalTestSession                                       |

### Client Hooks

| Hook                | Purpose                                     | Calls Firestore?     |
| ------------------- | ------------------------------------------- | -------------------- |
| `useEvaluateAnswer` | Wraps `callEvaluateAnswer`                  | NO — evaluation only |
| `useSaveAnswer`     | Wraps `recordItemAttempt` (broken contract) | YES but broken       |
| `useProgress`       | Reads spaceProgress                         | YES — reads          |
| `useStartTest`      | Wraps `callStartTestSession`                | YES                  |
| `useSubmitTest`     | Wraps `callSubmitTestSession`               | YES                  |

---

## 2. Critical Gaps (P0)

### GAP-1: StoryPointViewerPage never persists answers to Firestore

**File:** `apps/student-web/src/pages/StoryPointViewerPage.tsx:130-153`

The `handleSubmitAnswer` function evaluates the answer but ONLY stores the
result in local React state. It never calls `callRecordItemAttempt()` to write
to Firestore. On page refresh, all progress is lost.

**What should happen:** After evaluation, call
`callRecordItemAttempt({ tenantId, spaceId, storyPointId, itemId, itemType, score, maxScore, correct, timeSpent })`
to persist the result.

### GAP-2: PracticeModePage persists to RTDB instead of Firestore

**File:** `apps/student-web/src/pages/PracticeModePage.tsx:85-97, 113-140`

Practice progress is saved to Realtime Database at
`practice/{userId}/{spaceId}`, not to Firestore `spaceProgress`. This means
practice answers don't count towards space progress, story point progress, or
any aggregate metrics.

**What should happen:** After evaluation, call `callRecordItemAttempt()` to
write to Firestore spaceProgress. Can keep RTDB as a fast cache for session
state, but Firestore must be the source of truth.

### GAP-3: useSaveAnswer has contract mismatch with recordItemAttempt

**File:** `apps/student-web/src/hooks/useTestSession.ts:83-105`

The `useSaveAnswer` hook sends
`{tenantId, sessionId, itemId, answer, timeSpentSeconds}` but the
`recordItemAttempt` cloud function expects
`{tenantId, spaceId, storyPointId, itemId, itemType, score, maxScore, correct, timeSpent}`.
There's even a comment acknowledging this: _"This is a pre-existing contract
mismatch — kept as raw httpsCallable pending fix."_

**What should happen:** Fix the contract — either create a separate
`saveTestAnswer` callable, or adjust `useSaveAnswer` to match
`recordItemAttempt`'s expected signature.

### GAP-4: Space/StoryPoint completion status never transitions to 'completed'

**File:** `functions/levelup/src/callable/record-item-attempt.ts:124, 131`

The `recordItemAttempt` function always hardcodes:

- `status: 'in_progress'` for the space
- `storyPoints[id].status: 'in_progress'`

There is NO logic to check if all items in a story point are done (to mark story
point as `'completed'`) or if all story points in a space are done (to mark
space as `'completed'`).

Similarly, `submitTestSession`'s `updateSpaceProgress()` always sets
`status: 'in_progress'` at the space level.

**What should happen:** After updating item progress:

1. Count total items in the story point vs completed items → if all done, set
   `storyPoints[id].status: 'completed'`
2. Count total story points in the space vs completed → if all done, set
   `status: 'completed'`

### GAP-5: Firestore security rules field mismatch

**File:** `firestore.rules:443, 450`

The spaceProgress read rule checks `resource.data.studentId` but the cloud
function writes `userId` (not `studentId`). This means:

- Client-side reads that go through security rules will fail for students
- This is masked because cloud functions use Admin SDK (bypasses rules)
- But the `useProgress` hook reads from client SDK and WILL hit this rule

**What should happen:** Either:

- Update rules to check `resource.data.userId == request.auth.uid` instead of
  `resource.data.studentId`
- Or add a `studentId` field to the progress document matching the `studentId`
  in custom claims

---

## 3. Significant Gaps (P1)

### GAP-6: Material completion not tracked

**File:** `apps/student-web/src/components/materials/MaterialViewer.tsx`

When a student views/completes a material (text, video, PDF, etc.), there is no
tracking. Materials should mark as completed after reading/viewing, contributing
to story point and space progress.

### GAP-7: useProgress "overall" mode fetches wrong document

**File:** `packages/shared-hooks/src/queries/useProgress.ts:34`

When no `spaceId` is provided, it does
`doc(db, tenants/${tenantId}/spaceProgress, studentId)` — but document IDs
follow the pattern `{userId}_{spaceId}`. A doc with just `{studentId}` as ID
will never exist.

### GAP-8: evaluateAnswer cloud function doesn't record the attempt

**File:** `functions/levelup/src/callable/evaluate-answer.ts`

The `evaluateAnswer` function only evaluates and returns the result. The caller
must separately call `recordItemAttempt` to persist. But neither
StoryPointViewerPage nor PracticeModePage calls `recordItemAttempt` after
getting the evaluation.

### GAP-9: Per-storyPoint aggregates don't include all story points

**File:** `functions/levelup/src/callable/record-item-attempt.ts:128-136`

When computing storyPoint progress, only the current storyPoint being submitted
to gets its aggregate recomputed. Other storyPoints that were previously updated
are not recomputed, so they can get stale if the overall aggregation algorithm
changes.

Also, the `merge: true` on `set()` means storyPoint entries from previous story
points are preserved, but only the current storyPoint gets fresh aggregate
numbers.

### GAP-10: No query invalidation after recording item attempt

When `recordItemAttempt` is called, the `useProgress` query cache is not
invalidated. The UI won't show updated progress until the cache expires (30s
stale time) or the user navigates away and back.

---

## 4. What's Working

| Feature                            | Status                                                                                   |
| ---------------------------------- | ---------------------------------------------------------------------------------------- |
| SpaceProgress type definitions     | COMPLETE — well-defined interfaces in `shared-types/src/levelup/progress.ts`             |
| recordItemAttempt cloud function   | WORKING — correctly computes best scores, per-storyPoint aggregates, updates leaderboard |
| submitTestSession cloud function   | WORKING — grades test, computes analytics, updates spaceProgress                         |
| startTestSession cloud function    | WORKING — creates digital test session                                                   |
| evaluateAnswer cloud function      | WORKING — auto-evaluates deterministic types, AI-evaluates subjective types              |
| Client-side auto-evaluation        | WORKING — all 9 deterministic types properly evaluated in `auto-evaluate-client.ts`      |
| SpaceViewerPage progress display   | WORKING — reads and displays spaceProgress correctly (if data exists)                    |
| ProgressPage                       | WORKING — reads StudentProgressSummary and displays overall metrics                      |
| Firestore triggers for aggregation | WORKING — `onSpaceProgressUpdated` recalculates StudentProgressSummary                   |
| Question rendering (15 types)      | WORKING — all answerers properly render and collect answers                              |

---

## 5. Required Changes

### Phase 1: Fix Core Submission Pipeline (Critical)

1. **Create `useRecordItemAttempt` hook** that wraps `callRecordItemAttempt` and
   invalidates `useProgress` cache
2. **Update StoryPointViewerPage** `handleSubmitAnswer` to call
   `recordItemAttempt` after evaluation
3. **Update PracticeModePage** `handleSubmit` to call `recordItemAttempt` after
   evaluation (replace or supplement RTDB persistence)
4. **Fix Firestore security rules** — change `resource.data.studentId` to
   `resource.data.userId == request.auth.uid`

### Phase 2: Fix Completion Detection

5. **Update `recordItemAttempt` cloud function** to detect story point
   completion (all items done → `'completed'`)
6. **Update `recordItemAttempt` cloud function** to detect space completion (all
   story points done → `'completed'`)
7. **Fix `useSaveAnswer` contract mismatch** — decide: separate callable vs fix
   parameters

### Phase 3: Fill Missing Tracking

8. **Add material completion tracking** — record view/completion for materials
9. **Fix `useProgress` overall mode** — either remove it or implement proper
   all-spaces query
10. **Add query invalidation** — after recording item attempt, invalidate
    progress queries

### Phase 4: Data Consistency

11. **Ensure 1 document per story point model works** — currently the model is 1
    doc per space (containing all story point data). The task requirement says
    "1 document per story point" — need to clarify if this means changing the
    data model or if the current model (1 doc per space with nested story point
    data) is acceptable.

---

## 6. Desired Data Model (1 Doc Per Story Point)

The task specifies: _"I want to have 1 document per story point. All item
submissions in a story point go into that single document."_

Current model: 1 doc per space
(`/tenants/{tenantId}/spaceProgress/{userId}_{spaceId}`) with all items in a
flat `items` map.

**Proposed new model:**

```
/tenants/{tenantId}/storyPointProgress/{userId}_{storyPointId}
├── userId, tenantId, spaceId, storyPointId
├── status: 'not_started' | 'in_progress' | 'completed'
├── pointsEarned, totalPoints, percentage
├── items: Record<itemId, ItemProgressEntry>     ← all items in this story point
├── startedAt?, completedAt?
└── updatedAt

/tenants/{tenantId}/spaceProgress/{userId}_{spaceId}
├── userId, tenantId, spaceId
├── status: 'not_started' | 'in_progress' | 'completed'
├── pointsEarned, totalPoints, percentage
├── storyPoints: Record<storyPointId, StoryPointProgressSummary>  ← summary only, no items
├── startedAt?, completedAt?
└── updatedAt
```

**Benefits:**

- Smaller documents (items scoped to story point, not space)
- Parallel writes to different story points don't conflict
- Cleaner reads — load only the story point you need
- Better fits Firestore's 1MB document limit for large spaces

**Trade-offs:**

- Requires 2 reads for full space view (spaceProgress + storyPointProgress)
- Space-level aggregation needs recomputation across multiple docs
- Migration needed from current format

---

## 7. Key File Paths

| File                                                             | Purpose                                                    |
| ---------------------------------------------------------------- | ---------------------------------------------------------- |
| `packages/shared-types/src/levelup/progress.ts`                  | SpaceProgress, StoryPointProgress, ItemProgressEntry types |
| `packages/shared-services/src/levelup/assessment-callables.ts`   | Client callable wrappers                                   |
| `packages/shared-hooks/src/queries/useProgress.ts`               | useProgress React hook                                     |
| `functions/levelup/src/callable/record-item-attempt.ts`          | recordItemAttempt cloud function                           |
| `functions/levelup/src/callable/evaluate-answer.ts`              | evaluateAnswer cloud function                              |
| `functions/levelup/src/callable/submit-test-session.ts`          | submitTestSession cloud function                           |
| `apps/student-web/src/pages/StoryPointViewerPage.tsx`            | Standard learning page                                     |
| `apps/student-web/src/pages/PracticeModePage.tsx`                | Practice mode page                                         |
| `apps/student-web/src/pages/SpaceViewerPage.tsx`                 | Space overview page                                        |
| `apps/student-web/src/pages/ProgressPage.tsx`                    | Overall progress page                                      |
| `apps/student-web/src/utils/auto-evaluate-client.ts`             | Client-side deterministic evaluation                       |
| `apps/student-web/src/hooks/useTestSession.ts`                   | Test session hooks (includes broken useSaveAnswer)         |
| `apps/student-web/src/components/questions/QuestionAnswerer.tsx` | Master question answerer component                         |
| `firestore.rules`                                                | Security rules (lines 438-454 for spaceProgress)           |
