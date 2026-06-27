# Foundation Changes (Phase 0) - Student Progress System

Date: 2026-03-12

## Overview

Phase 0 fixes the foundation layer so that feature code (StoryPointViewerPage,
PracticeModePage, etc.) can reliably persist and read student progress. These
changes address GAP-5 (security rules mismatch) and GAP-10 (no query
invalidation after recording attempts) from the analysis in
`docs/STUDENT-PROGRESS-ANALYSIS.md`.

---

## Files Changed

### 1. `firestore.rules` (lines 438-454)

**Problem (GAP-5):** The `spaceProgress` read/write security rules checked
`resource.data.studentId` and `request.auth.token.studentId`, but the
`recordItemAttempt` cloud function writes `userId` (the Firebase Auth UID) to
the document — not `studentId`. This meant client-side reads via `useProgress`
would be denied by security rules for students.

**Fix:** Changed the spaceProgress rules to check
`resource.data.userId == request.auth.uid` instead of
`resource.data.studentId == request.auth.token.studentId`.

Specifically:

- **Read rule:** `resource.data.studentId == request.auth.token.studentId`
  changed to `resource.data.userId == request.auth.uid`
- **Parent read rule:**
  `request.auth.token.studentIds.hasAny([resource.data.studentId])` changed to
  `request.auth.token.studentIds.hasAny([resource.data.userId])`
- **Write rule:**
  `request.resource.data.studentId == request.auth.token.studentId` changed to
  `request.resource.data.userId == request.auth.uid`

**Note:** Only the `spaceProgress` rules were changed. The separate `progress`
collection rules (lines 456+) were left unchanged since those may use a
different field convention.

---

## New Files Created

### 2. `packages/shared-hooks/src/queries/useRecordItemAttempt.ts`

**Purpose:** React mutation hook that wraps `callRecordItemAttempt` from
`@levelup/shared-services` and invalidates the `useProgress` query cache on
success.

**Why:** Previously, no mutation hook existed for `recordItemAttempt`. Feature
pages (StoryPointViewerPage, PracticeModePage) had no convenient way to persist
answers to Firestore and refresh the progress UI. This hook fills that gap and
addresses GAP-10 (no query invalidation).

**Usage:**

```tsx
import { useRecordItemAttempt } from "@levelup/shared-hooks";

function MyComponent() {
  const recordAttempt = useRecordItemAttempt();

  const handleSubmit = async (evaluationResult) => {
    recordAttempt.mutate({
      tenantId: "tenant_abc",
      spaceId: "space_123",
      storyPointId: "sp_456",
      itemId: "item_789",
      itemType: "question", // ItemType: 'question' | 'material' | etc.
      score: evaluationResult.score,
      maxScore: evaluationResult.maxScore,
      correct: evaluationResult.correct,
      timeSpent: 45, // optional, in seconds
      feedback: "Good attempt", // optional
    });
  };

  return (
    <div>
      {recordAttempt.isPending && <p>Saving...</p>}
      {recordAttempt.isError && <p>Error: {recordAttempt.error.message}</p>}
      {recordAttempt.isSuccess && <p>Saved!</p>}
    </div>
  );
}
```

**Return value:** Standard TanStack Query `UseMutationResult` with:

- `mutate(params)` / `mutateAsync(params)` - trigger the mutation
- `isPending` - loading state
- `isError` / `error` - error state
- `isSuccess` / `data` - success state (returns `{ success: boolean }`)

**Cache invalidation:** On success, invalidates all queries matching
`['tenants', tenantId, 'progress', ...]` so that `useProgress` re-fetches fresh
data immediately.

### 3. `packages/shared-hooks/src/queries/index.ts` (modified)

Added export: `export { useRecordItemAttempt } from './useRecordItemAttempt';`

This makes the hook available via
`import { useRecordItemAttempt } from '@levelup/shared-hooks';`

---

## Files Reviewed (No Changes Needed)

### 4. `packages/shared-types/src/levelup/progress.ts`

**Review result:** Types are consistent with what the cloud function expects.

- `ItemProgressEntry` supports both question completion (via `questionData`) and
  material completion (via `completed`, `progress`)
- `SpaceProgress` has the correct `userId` field matching the cloud function
  output
- `StoryPointProgress` has proper aggregate fields

### 5. `packages/shared-services/src/levelup/assessment-callables.ts`

**Review result:** `RecordItemAttemptRequest` interface matches the cloud
function's expected parameters exactly. All fields align with the Zod validation
schema (`RecordItemAttemptRequestSchema`) and the cloud function's local
interface. No changes needed.

---

## Breaking Changes

None. All changes are additive or fix existing broken behavior:

- Security rules fix: Enables reads that were previously denied (non-breaking,
  fixes a bug)
- New hook: Additive, does not change existing hooks
- No type changes

---

## What This Unblocks (Phase 1+)

With these foundation fixes in place, the following Phase 1 work can proceed:

1. **StoryPointViewerPage** can call `useRecordItemAttempt` after evaluation to
   persist answers (GAP-1)
2. **PracticeModePage** can call `useRecordItemAttempt` after evaluation to
   persist to Firestore (GAP-2)
3. **MaterialViewer** can call `useRecordItemAttempt` to track material
   completion (GAP-6)
4. Client-side progress reads via `useProgress` will succeed for students (GAP-5
   fixed)
5. Progress UI will update immediately after recording attempts (GAP-10 fixed)
