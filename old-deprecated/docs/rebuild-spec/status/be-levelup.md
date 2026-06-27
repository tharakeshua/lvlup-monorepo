# Status Report: `functions/levelup` Backend

Audit date: 2026-06-19 Scope: `functions/levelup/src` (Firebase Cloud Functions,
region `asia-south1`) plus the LevelUp domain types in
`packages/shared-types/src/levelup` and `packages/shared-types/src/content`, the
request schemas in `packages/shared-types/src/schemas/callable-schemas.ts`, and
the LevelUp `firestore.rules` section.

This module owns the **learning side** of the platform: spaces, story points,
the unified content item / question bank, AI tutor chat, AI/auto answer
evaluation, digital timed-test sessions, per-student learning progress, the B2C
store, reviews, and rubric presets.

---

## 1. What exists & how it is architected

### 1.1 Function inventory (`src/index.ts`)

All functions are `onCall` (callable, region `asia-south1`, `cors: true`) except
triggers and schedulers. There are **19 callables**, **3 Firestore triggers**,
and **2 scheduled cleanup jobs**.

Content authoring (teacher/admin):

- `saveSpace` (`callable/save-space.ts`) — consolidated
  create/update/publish/archive/draft + store listing. Replaces 5 legacy
  endpoints (createSpace, updateSpace, publishSpace, archiveSpace,
  publishToStore).
- `saveStoryPoint` (`callable/save-story-point.ts`) — consolidated
  create/update/delete.
- `saveItem` (`callable/save-item.ts`) — consolidated create/update/delete;
  splits answer keys into a server-only subcollection for timed tests.
- `getItemForEdit` (`callable/get-item-for-edit.ts`) — re-merges stripped answer
  keys back into payload for the teacher editor (inverse of
  `stripAnswerFromPayload`).
- `listVersions` (`callable/list-versions.ts`) — paginated content version
  history.

Assessment / learner runtime:

- `startTestSession` (`callable/start-test-session.ts`) — creates a
  `DigitalTestSession` with server deadline, shuffle/adaptive ordering,
  max-attempts + retry-cooldown + lock-after-passing enforcement,
  resume-active-session.
- `submitTestSession` (`callable/submit-test-session.ts`) — auto-grades
  deterministic types, flags AI-pending items, computes scores + analytics
  breakdowns, writes progress.
- `evaluateAnswer` (`callable/evaluate-answer.ts`) — single-answer eval;
  auto-evaluates deterministic types, otherwise calls Gemini with resolved
  rubric+agent.
- `recordItemAttempt` (`callable/record-item-attempt.ts`) — non-test item
  attempt (practice/standard) → progress updater.

Question bank & rubric presets:

- `saveQuestionBankItem`, `listQuestionBank`, `importFromBank`,
  `saveRubricPreset`.

AI chat:

- `sendChatMessage` (`callable/send-chat-message.ts`) — Socratic tutor chat with
  conversation summarization (LLM-based, cached) + fire-and-forget
  learning-insight extraction.

Reviews / store / notifications:

- `saveSpaceReview`, `listStoreSpaces`, `purchaseSpace`, `manageNotifications`.

Triggers (`src/triggers/`):

- `onSpaceDeleted` — cascade delete (storyPoints, items+answerKeys, agents,
  sessions, progress+subcollections, chatSessions, RTDB leaderboard, tenant
  stats).
- `onSpacePublished` — student notifications on status→published.
- `onTestSessionExpired` — `onSchedule('every 5 minutes')`, collectionGroup
  query for in-progress sessions past `serverDeadline`+30s; expires and grades
  them.
- `cleanupStaleSessions` — `onSchedule('every 1 hours')`, marks in-progress
  sessions >24h old as `abandoned`.
- `cleanupInactiveChats` — chat session cleanup.

Note: `onSpacePublished` (trigger) and the `notifyStudentsOfPublish` helper
inside `saveSpace` **both** send publish notifications, but with different
recipient resolution (trigger reads `classes.studentIds`; the inline helper
queries the `students` collection by `classIds array-contains`). This is
duplicated, divergent logic — see §4.

### 1.2 Layering

- **Callables** validate auth + parse Zod request schema + enforce rate limit,
  then do business logic.
- **Utils** (`src/utils/`): `auth.ts` (membership checks), `firestore.ts` (typed
  loaders that `safeParse` documents against shared-types Zod schemas),
  `progress-updater.ts` (the single transactional progress write path),
  `auto-evaluate.ts` (deterministic grading for 9 question types), `rubric.ts`
  (4-level inheritance resolution), `chat-safety.ts` (prompt-injection /
  blocked-topic regex + in-memory abuse counter), `content-version.ts`,
  `notification-sender.ts`. `rate-limit.ts` and `parse-request.ts` are 1-line
  re-exports from `@levelup/functions-shared`.
- **Prompts** (`src/prompts/`): `tutor.ts` (Socratic system prompt + per-subject
  guidance map), `evaluator.ts` (per-question-type prompt builders + JSON output
  contract).
- **Types** (`src/types/index.ts`): pure re-export of `@levelup/shared-types`.
  No local type definitions — shared-types is the single source of truth.

### 1.3 AI integration

Both `evaluateAnswer` and `sendChatMessage` use `LLMWrapper` +
`getGeminiApiKey(tenantId)` from `@levelup/shared-services/ai`. Provider is
hardcoded `'gemini'`; default model `gemini-2.5-flash`, cheap model
`gemini-2.5-flash-lite` for summarization/insight extraction. Agent docs can
override model + temperature. Cost/token telemetry is passed via a structured
context object (`clientId`, `userId`, `purpose`, `operation`, `resourceType`,
`resourceId`) — this feeds the analytics module.

---

## 2. Entities / schemas / collections / APIs (with file paths)

### 2.1 Firestore collections (all tenant-scoped under `/tenants/{tenantId}/`)

| Path                                                         | Entity                                           | Type def                                    |
| ------------------------------------------------------------ | ------------------------------------------------ | ------------------------------------------- |
| `spaces/{spaceId}`                                           | `Space`                                          | `shared-types/src/levelup/space.ts`         |
| `spaces/{spaceId}/storyPoints/{spId}`                        | `StoryPoint`                                     | `shared-types/src/levelup/story-point.ts`   |
| `spaces/{spaceId}/storyPoints/{spId}/items/{itemId}`         | `UnifiedItem` (canonical nested path)            | `shared-types/src/content/item.ts`          |
| `spaces/{spaceId}/items/{itemId}`                            | `UnifiedItem` (legacy flat path, still read)     | same                                        |
| `.../items/{itemId}/answerKeys/{keyId}`                      | `AnswerKey` (server-only, rules deny all)        | `shared-types/src/levelup/answer-key.ts`    |
| `spaces/{spaceId}/agents/{agentId}`                          | `Agent` (tutor/evaluator)                        | `shared-types/src/levelup/agent.ts`         |
| `spaces/{spaceId}/versions/{versionId}`                      | `ContentVersion`                                 | `space.ts`                                  |
| `spaces/{spaceId}/reviews/{userId}`                          | space review                                     | `shared-types/src/levelup/space-review.ts`  |
| `digitalTestSessions/{sessionId}`                            | `DigitalTestSession`                             | `shared-types/src/levelup/test-session.ts`  |
| `spaceProgress/{userId}_{spaceId}`                           | `SpaceProgress` (space-level)                    | `shared-types/src/levelup/progress.ts`      |
| `spaceProgress/{userId}_{spaceId}/storyPointProgress/{spId}` | `StoryPointProgressDoc` (per-item details)       | same                                        |
| `chatSessions/{sessionId}` (+ `messages/` subcollection)     | `ChatSession` / `ChatMessage`                    | `shared-types/src/levelup/chat.ts`          |
| `questionBank/{itemId}`                                      | `QuestionBankItem`                               | `shared-types/src/levelup/question-bank.ts` |
| `rubricPresets/{presetId}`                                   | rubric preset                                    | `shared-types/src/content/rubric-preset.ts` |
| `evaluationSettings/{id}`                                    | tenant rubric defaults (read by `resolveRubric`) | tenant module                               |

Cross-tenant:

- `tenants/platform_public/spaces/{spaceId}` — denormalized B2C store listings
  (written by `saveSpace`, read by `listStoreSpaces`, purchased via
  `purchaseSpace`).
- `users/{uid}.consumerProfile` — `enrolledSpaceIds`, `purchaseHistory`,
  `totalSpend` (B2C enrollment).
- RTDB `leaderboards/{tenantId}/{spaceId}/{userId}` — live leaderboard, written
  by `progress-updater`.

### 2.2 Domain model highlights

- **`UnifiedItem`** (`content/item.ts`) is the central content atom: 7 top-level
  `ItemType`s (question, material, interactive, assessment, discussion, project,
  checkpoint), **15 `QuestionType`s**, 7 `MaterialType`s.
  `AUTO_EVALUATABLE_TYPES` (9 types) vs `AI_EVALUATABLE_TYPES` (6 types) drive
  the grading split. The `payload` is a discriminated union (`ItemPayload`), but
  in Firestore it is stored/validated as `z.record(z.string(), z.unknown())`
  (see `SaveItemRequestSchema`), so the union is **not enforced at the API
  boundary**.
- **`UnifiedRubric`** (`content/rubric.ts`) is shared with AutoGrade — 4 scoring
  modes (criteria_based, dimension_based, holistic, hybrid). Inheritance chain
  item → storyPoint → space → tenant (`resolveRubric` in `utils/rubric.ts`).
- **`UnifiedEvaluationResult`** (`content/evaluation.ts`) shared with AutoGrade
  — produced by both `auto-evaluate.ts` and the AI evaluator.
- **`DigitalTestSession`** has a rich 5-status question-tracking model
  (`visitedQuestions`, `markedForReview`, `submissions`), section mapping,
  adaptive state, and a denormalized analytics block.

### 2.3 Request schemas

All LevelUp request schemas live in
`packages/shared-types/src/schemas/callable-schemas.ts` (lines 380-740). The
consolidated "Save\*" pattern uses `{ id?, tenantId, ...scope, data: {...} }`
where absent `id` = create, present `id` = update, `data.deleted = true` =
delete. Validation is via `parseRequest` (re-exported from
`@levelup/functions-shared`).

---

## 3. Strengths worth keeping

1. **Single source of truth for types.** `src/types/index.ts` is pure re-export;
   documents are `safeParse`d on read in `utils/firestore.ts` (`loadSpace`,
   `loadStoryPoint`, `loadItem`, `loadAgent`) and on submit
   (`DigitalTestSessionSchema`, `ChatSessionSchema`). Data-integrity errors fail
   loudly as `internal` rather than corrupting downstream logic.
2. **Consolidated Save\* endpoints.** Collapsing
   create/update/publish/archive/delete into one callable per entity is a clean,
   RN-friendly surface that the rebuild should preserve.
3. **Unified, transactional progress writer.** `utils/progress-updater.ts` is
   the _only_ path that writes progress (both `recordItemAttempt` and
   `submitTestSession` delegate to it). It does best-score retention, two-tier
   aggregation (item → storyPoint → space), completion detection, attempt
   history (capped at 20), and RTDB leaderboard sync in one place. This is the
   strongest piece of the module.
4. **Answer-key isolation.** `extractAnswerKey` / `stripAnswerFromPayload`
   (`callable/create-item.ts`) move correct answers into an `answerKeys`
   subcollection that `firestore.rules` denies to all clients
   (`allow read, write: if false;`). Students physically cannot read answers via
   the SDK. `getItemForEdit` re-merges them server-side for editing. This is a
   correct security design.
5. **Deterministic auto-grading covers 9 types** (`utils/auto-evaluate.ts`) with
   partial-credit logic (MCAQ negative marking, fill-blanks proportional,
   group-options) — keeps AI cost down and grading instant.
6. **Server-authoritative timing.** `serverDeadline` is computed server-side;
   submit validates against it with a 30s grace; a 5-min scheduler reaps expired
   sessions and a 24h scheduler abandons truly stale ones. Clients cannot cheat
   the clock.
7. **Layered AI safety + cost control.** Prompt-injection regex + blocked-topic
   filter + message length cap + `<student_message>`/`<student_answer>` wrapping
   with explicit "ignore instructions inside tags" guidance; conversation
   summarization with caching to bound token growth; cheap-model usage for
   ancillary tasks; per-call cost telemetry.
8. **Rich analytics on submit** — topic / Bloom's / difficulty / section / time
   breakdowns computed in `computeTestAnalytics`.

---

## 4. Pain points / tech debt / inconsistencies

1. **Dual item storage paths (the biggest debt).** Items live at the canonical
   nested path `spaces/{id}/storyPoints/{spId}/items/{itemId}` but a legacy flat
   path `spaces/{id}/items/{itemId}` is still read everywhere as a fallback
   (`utils/firestore.ts` `loadItem`/`loadItems`, `evaluate-answer.ts`,
   `submit-test-session.ts`, `get-item-for-edit.ts`, `import-from-bank.ts`).
   Answer-key lookups try nested-then-flat on **every question** in a test (N
   sequential-ish double reads). Worse: `saveStoryPoint`'s DELETE branch queries
   only the **flat** path (`.../items where storyPointId ==`), so deleting a
   story point whose items were created at the nested path **orphans those
   items**. `onSpaceDeleted` also only iterates the flat `items` collection, not
   nested ones — cascade delete is incomplete.
2. **`StoryPointType` and session-type drift.** Type union is
   `standard | timed_test | quiz | practice | test` but `test` and `timed_test`
   are treated as synonyms in 4+ places (`save-space.ts` validatePublish,
   `start-test-session.ts`, `create-item.ts` isTimedTest). Two values mean the
   same thing — should be one.
3. **`payload` is untyped at the boundary.**
   `SaveItemRequestSchema.data.payload` is `z.record(z.string(), z.unknown())`.
   The carefully-modeled `ItemPayload`/`QuestionPayload`/`QuestionTypeData`
   discriminated unions are never validated on write. Garbage payloads can be
   persisted and only blow up at grade/eval time.
4. **Points/marks model is muddled.** `submit-test-session.ts` tracks both
   `pointsEarned/totalPoints` and `marksEarned/totalMarks`, derived from
   `item.meta?.totalPoints ?? payload.basePoints ?? 1` vs
   `item.meta?.maxMarks ?? itemPoints`. `create-item.ts` has an explicit "P0-6"
   workaround mirroring `basePoints` into `stats.totalPoints` and
   delta-adjusting on update. The dual points/marks concept and the
   meta-vs-payload fallback are fragile and under-documented.
5. **Duplicate publish-notification logic.** `saveSpace.notifyStudentsOfPublish`
   (queries `students` by `classIds`) and the `onSpacePublished` trigger (reads
   `classes.studentIds`) both fire on publish, with different recipient
   resolution — students may get two notifications or, if class membership data
   diverges, inconsistent ones.
6. **AnswerKey path comment mismatch.** `answer-key.ts` docstring says path is
   `.../storyPoints/{spId}/answerKeys/{itemId}`, but the code actually stores at
   `.../items/{itemId}/answerKeys/{keyId}` (auto-id, one doc per item). Type doc
   is stale.
7. **In-memory chat abuse counter is per-instance.** `chat-safety.ts`
   `userMessageTimestamps` Map resets on cold start and is not shared across
   instances, so the 50/hr cap is best-effort only. The real rate limit is the
   Firestore-backed `enforceRateLimit`; the in-memory one adds little.
8. **`evaluateAnswer` does not persist its result.** It returns the evaluation
   but the client is responsible for then calling `recordItemAttempt` with
   `evaluationData`. Two round-trips and a window where evaluation cost was
   spent but no progress recorded.
9. **N+1 reads.** Answer-key resolution in `submit-test-session.ts` does up to 2
   reads per question (nested + flat fallback), `resolveRubric` does up to 4
   sequential document reads, `loadItem` with no storyPointId scans every story
   point's items subcollection.
10. **`evaluateAnswer` mediaUrls are not actually sent to the model.** The code
    has a placeholder `// For now, the URLs are passed in the prompt text` —
    image/audio evaluation passes URLs as text, so true multimodal grading is
    not implemented.
11. **`SpaceProgress.storyPoints` map grows unbounded in the parent doc** and is
    rewritten on every attempt; combined with `submissions`/`items` maps in
    sessions, large tests risk approaching the 1 MB document limit.
12. **No idempotency / payment integration.** `purchaseSpace` is a stub (no
    gateway, generates a fake `transactionId`), and there is no dedupe key on
    submit/record — a double-fired client call re-runs the transaction.

---

## 5. Recommendations for a fresh rebuild

These keep the strong core concepts (UnifiedItem, consolidated Save\* endpoints,
server-authoritative sessions, the unified progress writer, answer-key
isolation, rubric inheritance) while fixing the structural debt and enabling a
common API layer + React Native clients.

1. **Single canonical item path. Delete the flat path entirely.** Standardize on
   `spaces/{id}/storyPoints/{spId}/items/{itemId}`. Run a one-time migration to
   move flat items, then remove every `flatItemsPath`/`fallback` branch
   (`firestore.ts`, `submit-test-session.ts`, `evaluate-answer.ts`,
   `import-from-bank.ts`, `get-item-for-edit.ts`, `save-story-point.ts` delete,
   `onSpaceDeleted`). This removes the orphan-on-delete bug and halves
   answer-key reads.
2. **Introduce a transport-agnostic service layer** (`packages/shared-services`
   already exists) so business logic — `createSpace`, `submitSession`,
   `evaluate`, `recordAttempt` — lives in plain functions that take a typed
   context, not in `onCall` handlers. Firebase callables become thin adapters;
   the same services can back an HTTP/REST or tRPC gateway for React Native and
   third-party clients. Define request/response DTOs once in shared-types
   (already the pattern) and generate an OpenAPI/tRPC contract from the Zod
   schemas.
3. **Validate `payload` with the discriminated union.** Replace `z.record(...)`
   in `SaveItemRequestSchema` with a discriminated
   `z.discriminatedUnion('questionType', ...)` (and per-ItemType) so bad
   payloads are rejected at write time. The Zod schemas already exist
   conceptually in `content/item.ts` types — formalize them.
4. **Collapse `StoryPointType` to one value per concept** (drop `test`, keep
   `timed_test`) and centralize "is this an assessment story point" +
   session-type mapping in one helper instead of scattered
   `=== 'timed_test' || === 'test'` checks.
5. **Unify the points model.** Pick one of points/marks (or model marks as
   `points * weight` with a single declared `basePoints` on the item). Remove
   the `meta.totalPoints` vs `payload.basePoints` fallback ambiguity; store the
   authoritative value once and denormalize deterministically.
6. **One publish-notification path.** Move notification fan-out entirely into
   the `onSpacePublished` trigger (event-sourced), remove the inline
   `notifyStudentsOfPublish` from `saveSpace`, and pick one recipient-resolution
   source (class membership). Same for all side-effects: prefer triggers over
   fire-and-forget calls inside callables so retries are free.
7. **Persist evaluation server-side in one call.** Have `evaluateAnswer` (for
   practice) write progress itself via the progress-updater, returning the
   result — eliminate the client's second `recordItemAttempt` round-trip and the
   cost-without-progress window. Add an idempotency key (e.g.
   `sessionId+itemId+attempt`) to submit/record so retries are safe.
8. **Batch reads.** Use `db.getAll(...)` for answer keys (already done in
   `importFromBank`) in `submit-test-session.ts`; precompute and store the
   resolved rubric on the item at save time (or cache per request) instead of 4
   sequential reads in `resolveRubric`.
9. **Shrink hot documents.** Keep only summaries (not the full `items` map) in
   the `storyPointProgress` subdoc if it grows large; consider per-item progress
   docs for very large spaces. Cap or paginate `submissions` for big tests.
10. **Real multimodal eval + provider abstraction.** Wire `mediaUrls` into the
    LLM call (fetch + attach images/audio) so `image_evaluation`/`audio` are
    genuinely graded. Keep `LLMWrapper`'s provider field but make provider/model
    a tenant-configurable setting rather than hardcoded Gemini, to allow
    swapping models without code changes.
11. **Move chat abuse limiting fully to the shared Firestore/Redis limiter**;
    drop the per-instance in-memory `Map` in `chat-safety.ts` (keep the regex
    content filter, which is genuinely useful).
12. **Centralize cascade-delete and stats** in a single tested helper so
    `onSpaceDeleted`, `saveStoryPoint` delete, and `saveItem` delete cannot
    drift (they currently maintain stats independently with hand-written
    `FieldValue.increment` calls). Consider recomputing stats from a trigger
    rather than incrementing inline.
