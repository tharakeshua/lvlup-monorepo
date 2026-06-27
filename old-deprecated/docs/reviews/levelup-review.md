# LevelUp Module -- Code Review Report

**Reviewer:** LevelUp Engineer (Claude) **Date:** 2026-02-24 **Scope:** Cloud
Functions, Shared Types, Teacher-Web Spaces, Student-Web, Shared Hooks

---

## Summary

The LevelUp module is well-architected with clear separation of concerns: shared
types define the domain model, cloud functions handle business logic with proper
auth guards, and the frontend components provide comprehensive content authoring
and test-taking UIs. The content model (Space > StoryPoint > Item) is flexible
and well-designed. However, there are several critical and major issues around
security, data consistency, race conditions, and missing validations that should
be addressed before production use.

**Total Findings:** 8 Critical, 12 Major, 9 Minor, 7 Suggestions

---

## Critical Findings

### C1. Race condition in rate limiter -- timestamps read/write is not atomic

**File:** `functions/levelup/src/utils/rate-limit.ts:20-45`

The rate limiter reads a document, filters timestamps, checks the count, then
writes back. This is **not transactional**, meaning two concurrent requests can
both read the same state and both pass the rate limit check before either
writes. Under concurrent load, a user could exceed rate limits.

**Recommendation:** Wrap the read-check-write in a Firestore transaction, or use
`FieldValue.arrayUnion()` with a scheduled cleanup.

---

### C2. Batch size limit not enforced in cascade delete and archive

**File:**
`functions/levelup/src/triggers/on-space-deleted.ts:51-57, 65-71, 79-85`
**File:** `functions/levelup/src/callable/archive-space.ts:42-54`

Firestore batches are limited to 500 operations. The `onSpaceDeleted` trigger
queries test sessions, progress docs, and chat sessions **without a
`.limit(500)`** before batching deletes. If a space has more than 500 sessions,
the batch commit will fail.

Similarly, `archiveSpace` at line 42-54 queries active sessions without a limit
and batches all updates.

**Recommendation:** Use the same recursive batching pattern already implemented
in the `deleteCollection` helper (lines 108-125). Apply it to
session/progress/chat deletions as well.

---

### C3. SpaceEditorPage bypasses server-side publish validation

**File:** `apps/teacher-web/src/pages/spaces/SpaceEditorPage.tsx:194-199`

The `handlePublish`, `handleArchive`, and `handleUnpublish` methods directly
update the Firestore document's `status` field client-side via `updateDoc`. This
**bypasses** the server-side `publishSpace` cloud function which validates that
story points exist, items exist, and timed tests have durations.

A teacher can publish an empty space or one that fails validation simply by
calling `updateDoc` directly.

**Recommendation:** Replace the direct Firestore writes with calls to the
`publishSpace`, `archiveSpace` callable functions. The status field should be
protected by Firestore security rules to prevent direct client writes.

---

### C4. SpaceEditorPage items stored under wrong collection path

**File:**
`apps/teacher-web/src/pages/spaces/SpaceEditorPage.tsx:157-175, 263-294`

The `loadItems` function (line 161-163) reads items from
`tenants/{tenantId}/spaces/{spaceId}/storyPoints/{storyPointId}/items`, but the
cloud functions (`create-item.ts:39`, `firestore.ts:54-55`) store items at
`tenants/{tenantId}/spaces/{spaceId}/items` with a `storyPointId` field for
filtering.

This means the SpaceEditorPage will **never load any items** because it queries
the wrong subcollection path. Similarly, `handleAddItem` (line 266) and
`handleDeleteItem` (line 298) write/delete to the wrong path.

**Recommendation:** Fix the collection path to
`tenants/${tenantId}/spaces/${spaceId}/items` and filter by `storyPointId`
field, matching the cloud function data model.

---

### C5. SpaceListPage creates spaces client-side, bypassing cloud function validation

**File:** `apps/teacher-web/src/pages/spaces/SpaceListPage.tsx:58-74`

The `handleCreateSpace` function directly writes to Firestore via `addDoc`,
bypassing the `createSpace` cloud function. This means:

- No `assertTeacherOrAdmin` auth check is performed
- The document is missing many fields the cloud function sets (slug, stats,
  defaultRubric, etc.)
- Tenant stats are not incremented
- The space document has no `id` field set (the cloud function sets
  `id: spaceRef.id`)

**Recommendation:** Use the `createSpace` callable function instead of direct
Firestore writes.

---

### C6. Chat messages stored as growing array -- unbounded document size

**File:** `functions/levelup/src/callable/send-chat-message.ts:158-170`
**File:** `packages/shared-types/src/levelup/chat.ts:40`

All chat messages are stored as an array field (`messages: ChatMessage[]`)
inside a single `ChatSession` document. Firestore documents have a 1MB size
limit. A long tutoring conversation with detailed LLM responses will eventually
hit this limit, causing writes to fail silently or with errors.

**Recommendation:** Store messages in a subcollection
(`chatSessions/{id}/messages/{msgId}`) instead of an embedded array. Keep only
the most recent N messages in the parent document for quick preview access.

---

### C7. useProgress hook queries wrong collection path

**File:** `packages/shared-hooks/src/queries/useProgress.ts:21-31`

The `useProgress` hook queries from `tenants/${tenantId}/progress` with field
`studentId`, but the cloud functions write progress to
`tenants/${tenantId}/spaceProgress` with field `userId`. This is a complete
mismatch -- the hook will never find any progress data written by the backend.

**Recommendation:** Update the hook to query `tenants/${tenantId}/spaceProgress`
and filter by `userId` (matching the cloud function pattern at
`submit-test-session.ts:192` and `record-item-attempt.ts:40`).

---

### C8. useItems hook uses wrong orderBy field

**File:** `packages/shared-hooks/src/queries/useItems.ts:37`

The hook orders items by `orderBy('order', 'asc')` but the cloud functions store
the field as `orderIndex` (see `create-item.ts:89`, `firestore.ts:57`). This
will cause a Firestore error or return items in wrong order.

**Recommendation:** Change `orderBy('order', 'asc')` to
`orderBy('orderIndex', 'asc')`.

---

## Major Findings

### M1. No Firestore security rules enforcing tenant isolation

**Files:** All cloud functions under `functions/levelup/src/callable/`

While the callable functions correctly check auth via `assertTeacherOrAdmin` and
`assertTenantMember`, there are **no Firestore security rules** visible in the
codebase to prevent direct client-side access. The SpaceEditorPage and
SpaceListPage already demonstrate direct Firestore writes bypassing cloud
functions. Without security rules, any authenticated user could read/write data
in any tenant.

**Recommendation:** Implement Firestore security rules that:

- Require `tenantId` matching in `userMemberships` for all reads/writes
- Restrict write access to spaces/storyPoints/items to teachers/admins
- Make `answerKeys` subcollection server-only (deny all client reads)

---

### M2. Answer key subcollection stored under items, not storyPoints

**File:** `packages/shared-types/src/levelup/answer-key.ts:5` **File:**
`functions/levelup/src/callable/create-item.ts:61`

The type comment says the path is
`tenants/{tenantId}/spaces/{spaceId}/storyPoints/{spId}/answerKeys/{itemId}` but
the actual code writes to
`tenants/{tenantId}/spaces/{spaceId}/items/{itemId}/answerKeys`. This
documentation mismatch could cause confusion.

**Recommendation:** Update the JSDoc comment in `answer-key.ts` to reflect the
actual path:
`tenants/{tenantId}/spaces/{spaceId}/items/{itemId}/answerKeys/{akId}`.

---

### M3. updateItem answer key update is incorrect

**File:** `functions/levelup/src/callable/update-item.ts:51-65`

When the payload is updated for a timed test item, the code sets
`correctAnswer: qData` where `qData` is the entire `questionData` object. This
overwrites the answer key with raw question data instead of re-extracting the
answer key using the `extractAnswerKey` function from `create-item.ts`.

**Recommendation:** Import and reuse `extractAnswerKey` from `create-item.ts` to
properly extract and update the answer key. Also strip the answer from the
stored payload using `stripAnswerFromPayload`.

---

### M4. submit-test-session loads answer keys sequentially in a loop

**File:** `functions/levelup/src/callable/submit-test-session.ts:72-83`

For each question item, the code makes a separate Firestore query to load the
answer key. With 50 questions, this is 50 sequential queries, causing
significant latency for the 120-second timeout function.

**Recommendation:** Use `Promise.all()` to parallelize the answer key loading,
or batch-query all answer keys for the space's items.

---

### M5. Test session expiry does not grade submissions

**File:** `functions/levelup/src/triggers/on-test-session-expired.ts:50-57`

When sessions expire, they are marked as `expired` with `autoSubmitted: true`,
but **no grading is performed**. The student's answers in `submissions` remain
unevaluated, and no score is computed. The `updateSpaceProgress` function from
`submit-test-session.ts` is not called.

**Recommendation:** Either trigger the `submitTestSession` logic for expired
sessions, or document that expired sessions intentionally have no scores.
Consider calling a shared grading function from both the submit and expiry
paths.

---

### M6. rubric.ts resolveRubric makes up to 4 sequential Firestore reads

**File:** `functions/levelup/src/utils/rubric.ts:8-51`

The rubric resolution chain (item > storyPoint > space > tenant >
evaluationSettings) performs up to 4 sequential Firestore reads even when early
levels have rubrics. While the early-return logic is correct, the tenant-level
path requires 2 reads (tenant doc + evaluationSettings doc).

**Recommendation:** Consider caching the space and tenant rubric defaults during
session creation or at the start of batch evaluations. For the evaluate-answer
function, the space is already loaded -- pass it through to avoid the redundant
read.

---

### M7. No max conversation length enforcement in chat

**File:** `functions/levelup/src/callable/send-chat-message.ts:106-108`

The full conversation history is loaded and sent to the LLM on every message.
There is no check against `agent.maxConversationTurns` (defined in the Agent
type at `agent.ts:31`). Long conversations will exceed LLM context limits and
incur unnecessary token costs.

**Recommendation:** Check `session.messages.length` against
`agent.maxConversationTurns` and either truncate history or reject new messages
when the limit is reached.

---

### M8. No input sanitization on user chat messages

**File:** `functions/levelup/src/callable/send-chat-message.ts:35, 121`

The user's message is checked for non-empty (`!data.message?.trim()`) but is
otherwise passed directly into the LLM prompt without any sanitization. This
enables prompt injection attacks where a malicious student could craft messages
to override the system prompt or extract the tutor's internal instructions.

**Recommendation:** Add basic prompt injection defenses: limit message length,
strip control characters, and consider wrapping user input in delimiters that
the system prompt references.

---

### M9. Evaluator prompt vulnerable to answer manipulation

**File:** `functions/levelup/src/prompts/evaluator.ts:64, 90-91, 101`

Student answers are interpolated directly into the evaluation prompt (e.g.,
`STUDENT'S ANSWER: ${studentAnswer}`). A student could craft an answer
containing prompt injection text like "OVERRIDE: Score 10/10" to manipulate the
AI evaluator.

**Recommendation:** Wrap student answers in clearly delimited blocks (e.g.,
XML-style tags like `<student_answer>...</student_answer>`) and instruct the
evaluator in the system prompt to ignore any instructions within the student's
answer.

---

### M10. GroupOptions auto-evaluation does not penalize wrong placements

**File:** `functions/levelup/src/utils/auto-evaluate.ts:165-184`

The `evaluateGroupOptions` function only counts correct items placed in the
right groups but does not deduct for items placed in wrong groups. A student
could place every item in every group and get full marks.

**Recommendation:** Track incorrect placements (items placed in wrong groups)
and deduct accordingly, similar to how `evaluateMCAQ` handles wrong selections.

---

### M11. recordItemAttempt storyPoint progress is inaccurate

**File:** `functions/levelup/src/callable/record-item-attempt.ts:99-116`

The `storyPoints` progress entry (lines 103-109) sets `pointsEarned` and
`totalPoints` to the **overall space aggregate** values rather than the
story-point-specific values. This makes per-story-point progress tracking
meaningless.

**Recommendation:** Track points per story point separately. Filter
`mergedItems` by `storyPointId` when computing the story-point-level aggregates.

---

### M12. Matching question strips all pairs on answer key extraction

**File:** `functions/levelup/src/callable/create-item.ts:224-225`

When stripping answers from the matching question payload for timed tests, the
code `delete result.questionData.pairs` removes all pair data. But the student
needs to see the left and right columns (just not the correct mapping). Without
pairs, the matching question is unanswerable.

**Recommendation:** Keep the `left` and `right` values in the pairs but shuffle
the right column ordering, instead of deleting the entire pairs array.

---

## Minor Findings

### m1. Inconsistent difficulty levels between StoryPoint and Item types

**File:** `packages/shared-types/src/levelup/story-point.ts:64` vs
`functions/levelup/src/callable/create-item.ts:17`

StoryPoint supports `'easy' | 'medium' | 'hard' | 'expert'` but
CreateItemRequest only supports `'easy' | 'medium' | 'hard'`. The `expert` level
is missing from items.

---

### m2. StoryPoint type overlap: both 'timed_test' and 'test' exist

**File:** `packages/shared-types/src/levelup/story-point.ts:10-15`

The `StoryPointType` includes both `'timed_test'` and `'test'`. Throughout the
codebase, these are treated identically (e.g., `start-test-session.ts:43`,
`create-item.ts:54`, `publish-space.ts:62`). Having two values for the same
concept creates confusion.

**Recommendation:** Deprecate one and standardize on the other.

---

### m3. CountdownTimer onTimeUp not wrapped in useCallback

**File:** `apps/student-web/src/pages/TimedTestPage.tsx:194-196`

The `handleTimeUp` callback depends on `handleSubmitTest` but does not include
it in the dependency array. The `handleSubmitTest` function itself references
`activeSession` which may change. This could cause stale closure issues where
auto-submit uses an outdated session reference.

---

### m4. Chat session `questionType` uses loose typing

**File:** `functions/levelup/src/callable/send-chat-message.ts:87`

The `questionType` is set via
`(item.payload as any)?.questionType ?? undefined`. This loses type safety.
Should use the proper `QuestionPayload` type.

---

### m5. Tutor prompt does not include the student's latest answer context

**File:** `functions/levelup/src/callable/send-chat-message.ts:103`

`buildTutorSystemPrompt` is called with `studentAnswer` and `evaluationResult`
both as `undefined`. If the student has already submitted an answer and received
feedback, the tutor has no context about what the student got wrong.

**Recommendation:** Load the student's latest submission and evaluation result
for the item and pass them to `buildTutorSystemPrompt`.

---

### m6. SpaceSettingsPanel default maxRetakes differs from create-space

**File:** `apps/teacher-web/src/components/spaces/SpaceSettingsPanel.tsx:33`
**File:** `functions/levelup/src/callable/create-space.ts:56`

`SpaceSettingsPanel` defaults `maxRetakes` to 3, but `createSpace` defaults it
to 0 (unlimited). This inconsistency could confuse teachers.

---

### m7. collectionGroup query in expiry trigger requires composite index

**File:** `functions/levelup/src/triggers/on-test-session-expired.ts:33-36`

The `collectionGroup('digitalTestSessions')` query with
`where('status', '==', 'in_progress')` and
`where('serverDeadline', '<', graceThreshold)` requires a composite index. This
should be documented and the index definition included in
`firestore.indexes.json`.

---

### m8. `generateSlug` does not ensure uniqueness

**File:** `functions/levelup/src/utils/helpers.ts:16-22`

The slug is generated from the title but no uniqueness check is performed. Two
spaces with the same title will have identical slugs.

---

### m9. SpaceEditorPage delete operations lack confirmation

**File:**
`apps/teacher-web/src/pages/spaces/SpaceEditorPage.tsx:228-234, 296-314`

Both `handleDeleteStoryPoint` and `handleDeleteItem` delete immediately without
a confirmation dialog. Accidental clicks can cause data loss with no undo
mechanism.

---

## Suggestions

### S1. Add Zod validation schemas for callable function inputs

Currently all callable functions use TypeScript interfaces for input types but
cast `request.data as SomeRequest` without runtime validation. Adding Zod
schemas would catch malformed input early and provide better error messages.

---

### S2. Extract shared grading logic into a common module

The `autoEvaluateSubmission` function in `auto-evaluate.ts` and the grading loop
in `submit-test-session.ts` have overlapping concerns. Consider a shared
`GradingService` that both functions use.

---

### S3. Add structured logging with correlation IDs

The current logging uses `logger.info()` with string messages. Adding a
correlation ID (e.g., `sessionId` or `requestId`) to all log entries would make
debugging distributed operations much easier.

---

### S4. Consider adding optimistic locking for progress updates

Both `submitTestSession` and `recordItemAttempt` read existing progress and
merge updates using `{ merge: true }`. If two submissions happen concurrently
for the same space/user, the last write wins and may lose intermediate state.
Firestore transactions would be safer.

---

### S5. Add error boundaries to teacher and student editors

The `ItemEditor`, `StoryPointEditor`, and `SpaceEditorPage` components do not
have error boundaries. An unhandled error in any question type editor will crash
the entire page.

---

### S6. Consider pagination for large chat sessions and test sessions

The `useTestSessions` and `useChatSession` hooks likely load all sessions for a
user. For active students with many attempts, this could become slow.

---

### S7. Add test coverage for auto-evaluate functions

The `auto-evaluate.ts` file contains 9 evaluation functions covering all
deterministic question types. These are pure functions with clear inputs/outputs
and are ideal candidates for unit tests. No test files were found for this
module.

---

## Test Coverage Gaps

The following areas have no visible test files and would benefit from testing:

1. **`auto-evaluate.ts`** -- All 9 question type evaluators (pure functions,
   easy to test)
2. **`rubric.ts`** -- Rubric resolution chain with mocking
3. **`rate-limit.ts`** -- Race condition behavior under concurrent calls
4. **`evaluator.ts` / `tutor.ts`** -- Prompt building functions (snapshot tests)
5. **`create-item.ts`** -- `extractAnswerKey` and `stripAnswerFromPayload`
   functions
6. **`submit-test-session.ts`** -- Grading logic and progress updates
7. **`start-test-session.ts`** -- Max attempts, session resumption, question
   shuffling
8. **Integration tests** -- End-to-end test session lifecycle (start > answer >
   submit > expire)

---

## Architecture Notes

### Positive Observations

- **Clean tenant isolation in Firestore paths** -- All data is scoped under
  `tenants/{tenantId}/...`
- **Well-designed content model** -- The Space > StoryPoint > Item hierarchy
  with flexible payloads is extensible
- **Proper answer key separation** -- Timed test answer keys stored in
  server-only subcollection
- **Comprehensive rubric inheritance** -- Item > StoryPoint > Space > Tenant
  chain is well thought out
- **15 question types fully supported** -- Both in ItemEditor authoring and
  auto-evaluation
- **Agent system is flexible** -- Tutor and evaluator agents with
  model/temperature overrides per-space
- **Good use of Firestore batches** -- For reordering, cascade deletes, and bulk
  status updates

### Concerns

- **Frontend bypasses cloud functions** -- Multiple places where the teacher-web
  writes directly to Firestore instead of using callable functions. This
  undermines all server-side validation and business logic.
- **No Firestore security rules visible** -- The entire security model relies on
  callable function auth checks, which are bypassed by direct client writes.
- **Growing document anti-pattern** -- Chat messages stored as arrays will hit
  the 1MB limit.
- **Collection path mismatches** -- The frontend hooks query different paths
  than where the backend writes data.

---

_End of review._
