# Backend Services & Cloud Functions — Rebuild Spec

> Status: design spec for the fresh build. Source of truth: the status reports
> under `docs/rebuild-spec/status/` (`be-identity.md`, `be-levelup.md`,
> `be-autograde.md`, `be-analytics.md`, `ai-features.md`, `api-layer.md`,
> `auth-access.md`). Goal: keep every working core concept from the current
> system, fix the structural debt, and make the entire backend reachable through
> **one common API layer shared by web and the planned React Native apps**.

---

## 0. Guiding principles (apply to every service)

1. **Transport-agnostic application core.** Each backend capability is a plain
   `async` service function `fn(input, ctx): Promise<output>` taking an explicit
   `RequestContext` (caller identity, tenant, claims, idempotency key, clock).
   It never imports `firebase-functions`. Firebase `onCall` becomes a thin
   adapter; the same service backs a future HTTP/REST or tRPC gateway and RN
   clients without a rewrite.
2. **One contract package = the API.** `@levelup/api-contract` colocates, per
   callable, the Zod request schema, the Zod response schema, and `z.infer`
   types. Delete the hand-written `callable-types.ts` interfaces and all inline
   request types scattered in `shared-services`. This package is the single
   dependency for web, RN, functions, and test/seed tooling.
3. **Validate in, validate out.** Requests parse through the contract Zod schema
   at the boundary. Responses `safeParse` behind a dev flag so server↔client
   drift across two platforms is caught early.
4. **`tenantId` comes from claims, not the body.** The active tenant is read
   from the caller's custom claims server-side. Only super-admin cross-tenant
   ops may pass an explicit override. Removes a class of wrong-tenant bugs and
   shrinks every request.
5. **Idempotency by default.** Every mutating service accepts an
   `idempotencyKey`; retried `createOrgUser` / `submitTestSession` /
   `uploadAnswerSheets` / bulk imports are safe.
6. **Side effects are event-sourced.** Notifications, content versions,
   leaderboard writes, stats maintenance, and analytics are driven by
   Firestore/queue triggers (or a transactional outbox), never fire-and-forget
   `.catch(log)` inside a callable.
7. **One source of truth for status, counters, and timestamps.** Each pipeline
   status is computed in exactly one place; each counter is adjusted through one
   helper; timestamps are transport-neutral (epoch-millis or ISO-8601) and
   adapted only at the storage edge.
8. **Region + config centralized.** `asia-south1`, `MAX_CLAIM_CLASS_IDS`,
   rate-limit ceilings, quota defaults, default tenant features, model names,
   and token budgets live in one shared config module consumed by functions and
   the gateway.

---

## 1. Service topology

Keep the four-codebase split — it maps cleanly to bounded contexts, deploy
independence, and memory/timeout tuning. Add a shared core layer beneath them.

```
                         ┌─────────────────────────────────────────┐
        web / RN ───────▶│   @levelup/api-contract (Zod + z.infer)   │
                         │   typed CALLABLES registry + client       │
                         └─────────────────────────────────────────┘
                                          │  invoke(name, data)
                ┌─────────────────────────┼──────────────────────────┐
                ▼                         ▼                          ▼
        ┌──────────────┐         ┌──────────────┐           ┌──────────────┐
        │  identity-fn │         │  levelup-fn  │           │ autograde-fn │
        │ users/tenants│         │ content/learn│           │ exams/grading│
        │ memberships  │         │ tests/chat   │           │ pipeline     │
        └──────┬───────┘         └──────┬───────┘           └──────┬───────┘
               │                        │                          │
               └────────────┬──────────┴────────────┬─────────────┘
                            ▼                        ▼
                  ┌────────────────────┐   ┌────────────────────────┐
                  │ @levelup/services  │   │  analytics-fn (events)  │
                  │ transport-agnostic │   │  summaries/at-risk/cost │
                  │ use-case modules   │   │  leaderboards/reports   │
                  └─────────┬──────────┘   └────────────────────────┘
                            ▼
              ┌──────────────────────────────────┐
              │ @levelup/ai (one LLMProvider seam)│
              │ @levelup/functions-shared         │
              │ (parseRequest, rateLimit, config) │
              │ @levelup/shared-types (domain)    │
              └──────────────────────────────────┘
```

### 1.1 Codebase boundaries (recommended)

| Codebase         | Owns                                                                                                                                | Callables (intent)                                                                                                                                                                                                                                                                                                                             | Triggers / schedulers                                                                                                                                                                                                                         |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **identity-fn**  | users, tenants, tenantCodes, memberships, claims, role entities, lifecycle, bulk import, export, announcements, notifications-admin | `saveTenant`, `saveStudent/Teacher/Parent/Staff/Class/AcademicSession`, `createOrgUser`, `joinTenant`, `switchActiveTenant`, `bulkImport*`, `bulkUpdateStatus`, `rolloverSession`, `deactivate/reactivateTenant`, `exportTenantData`, `uploadTenantAsset`, `save/listAnnouncements`, `searchUsers`, `saveGlobalEvaluationPreset`               | `beforeUserCreated`/`beforeSignIn` (Gen2 blocking), `onMembershipWritten` (claim sync), `onTenantStatusChanged`, `onStudentArchived`/`onClassArchived` (roster fan-out), `tenantLifecycleCheck`, `monthlyUsageReset`, `cleanupExpiredExports` |
| **levelup-fn**   | spaces, story points, unified items + answer keys, question bank, rubric presets, test sessions, progress, chat, store, reviews     | `saveSpace`, `saveStoryPoint`, `saveItem`, `getItemForEdit`, `listVersions`, `startTestSession`, `submitTestSession`, `evaluateAnswer`, `recordItemAttempt`, `saveQuestionBankItem`, `listQuestionBank`, `importFromBank`, `saveRubricPreset`, `sendChatMessage`, `saveSpaceReview`, `listStoreSpaces`, `purchaseSpace`, `manageNotifications` | `onSpaceDeleted` (cascade), `onSpacePublished` (notify), `expireTestSessions` (every 5m), `cleanupStaleSessions` (hourly), `cleanupInactiveChats`                                                                                             |
| **autograde-fn** | exams, exam questions, submissions, question submissions, evaluation settings, dead-letter, grading pipeline                        | `saveExam`, `gradeQuestion`, `extractQuestions`, `uploadAnswerSheets`                                                                                                                                                                                                                                                                          | `advancePipeline` reducer (queue-driven), `onExamPublished`, `onResultsReleased`, `onExamDeleted` (cascade), `staleSubmissionWatchdog`                                                                                                        |
| **analytics-fn** | cross-system summaries, exam analytics, at-risk, insights, cost rollups, leaderboards, PDF reports                                  | `getSummary`, `generateReport`                                                                                                                                                                                                                                                                                                                 | one debounced `recomputeStudentRollup` orchestrator + `recomputeClassRollup`, `onExamResultsReleased`, `dailyCostAggregation`, `nightlyAtRiskFlagging`, `generateInsights`                                                                    |

> A `gateway-fn` (HTTP/REST or tRPC) can be added later as an additional adapter
> over `@levelup/services`. Nothing else changes.

---

## 2. identity-fn

### 2.1 Keep

- The three-layer identity spine: `/users/{uid}` (`UnifiedUser`) +
  `/userMemberships/{uid}_{tenantId}` (`UserMembership`) + minimal
  `PlatformClaims` custom claims.
- Composite `{uid}_{tenantId}` membership key (one role per user/tenant).
- Minimal claims with `MAX_CLAIM_CLASS_IDS = 15` cap + `classIdsOverflow`
  fallback to a membership-doc read in rules.
- Consolidated `save*` upsert ergonomics, `SaveResponse { id, created }`.
- Defense-in-depth: Zod-at-boundary, per-action rate limiting, quota + feature +
  tenant-status gates, secrets in Secret Manager, signed-URL credential
  delivery, self-elevation block in rules.
- Atomic counters via `FieldValue.increment` (no read-modify-write).

### 2.2 Fix / restructure

1. **One membership/entity factory.** Replace the three divergent creation paths
   (`createOrgUser`, `save*` create branch, `joinTenant`) with a single
   `provisionMembership({ role, links, permissions, joinSource })`. Every
   membership has identical shape; every role either has a backing entity doc or
   explicitly does not. `joinTenant` students get a lazily-created
   `/students/{id}` profile.
2. **Normalize the entity→Auth link field to `authUid` everywhere.** Remove the
   deprecated `uid` dual field (`Teacher.uid`, the bulk-import student/parent
   `uid` vs `authUid` schism). Introduce a typed `TenantEntity` base
   (`tenantId`, `authUid`, `status`, timestamps) and give `staff`/`scanner` real
   shared types.
3. **Claim sync as a trigger, not a per-callable concern.** A single
   `syncMembershipClaims(uid, tenantId)` primitive runs from an
   `onMembershipWritten` Firestore trigger on `/userMemberships`, so no callable
   can forget to refresh claims after a role/status/class/permission change
   (fixes the stale-claims bug in `saveStudent` / `saveTeacher`). Callables only
   write the membership.
4. **Gen2 blocking Auth functions.** Replace Gen1
   `onUserCreated`/`onUserDeleted` with `beforeUserCreated`/`beforeSignIn`,
   seeding claims synchronously and eliminating the
   `onUserCreated`-vs-`createOrgUser` user-doc race. Standardize on the
   `authProviders` array. `onUserDeleted` becomes a Gen2 path that decrements
   both counter systems.
5. **Transactional / saga multi-write.** Wrap entity + membership + counter
   writes in a Firestore transaction where possible; for Auth-user + Firestore,
   use a documented compensating-action saga plus the per-request idempotency
   key.
6. **Unify counters.** Collapse `stats.total*` and `usage.current*` updates
   behind one `adjustTenantCounters(delta)` helper called from every
   create/delete/join/leave path (including `joinTenant` and deletion triggers),
   or derive `stats.total*` from a scheduled reconciler. Nothing should be able
   to drift.
7. **Typed claim permissions.** Replace `permissions?: Record<string, boolean>`
   in `PlatformClaims` with the real `TeacherPermissions`/`StaffPermissions`
   shapes (or a role discriminated union) so rules-generation and callers stay
   type-checked.
8. **Correctness bugs to fix before migration:** single audit-log collection
   name (`auditLogs`, not `auditLog`); `tenantCode` auto-suffix + retry on
   collision; robust CSV export (union of all keys for headers); `searchUsers`
   batched `where('uid','in',[...])` membership fetch backed by a real search
   index.

### 2.3 Service modules (`@levelup/services/identity`)

```
provisionMembership(input, ctx)        upsertTenantEntity(kind, input, ctx)
createOrgUser(input, ctx)              joinTenant(input, ctx)
switchActiveTenant(input, ctx)         bulkImportStudents/Teachers(input, ctx)
deactivate/reactivateTenant(input, ctx) exportTenantData(input, ctx)
syncMembershipClaims(uid, tenantId)    adjustTenantCounters(tenantId, delta)
```

### 2.4 Collections (unchanged where sound)

`/users/{uid}`, `/userMemberships/{uid}_{tenantId}`, `/tenants/{tenantId}`,
`/tenantCodes/{CODE}`,
`/tenants/{t}/{students,teachers,parents,staff,scanners,classes,academicSessions,auditLogs,notifications,announcements,rateLimits}`,
`/platformActivityLog`, `/globalEvaluationPresets`. RTDB
`notifications/{tenantId}/{recipientId}`; Storage `exports/{tenantId}/...`.

---

## 3. levelup-fn

### 3.1 Keep

- `UnifiedItem` content atom (7 item types, 15 question types, 7 material
  types); `AUTO_EVALUATABLE_TYPES` (9) vs `AI_EVALUATABLE_TYPES` (6) split.
- Consolidated `save*` endpoints with
  `{ id?, tenantId, ...scope, data, deleted? }`.
- **The transactional `progress-updater` as the single progress write path**
  (best-score retention, two-tier item→storyPoint→space aggregation, completion
  detection, capped attempt history, RTDB leaderboard sync). This is the
  strongest piece — keep it intact.
- **Answer-key isolation:** `extractAnswerKey`/`stripAnswerFromPayload` into an
  `answerKeys` subcollection that rules deny to all clients; `getItemForEdit`
  re-merges server-side.
- Deterministic auto-grading for 9 types with partial credit.
- Server-authoritative timing (`serverDeadline` + grace + reaper schedulers).
- Layered AI safety + cost control; rich submit analytics.
- Zod `safeParse` on every document read.

### 3.2 Fix / restructure

1. **Single canonical item path. Delete the flat path.** Standardize on
   `spaces/{id}/storyPoints/{spId}/items/{itemId}`. Migrate flat items once,
   then remove every fallback branch (`firestore.ts` `loadItem/loadItems`,
   `submit-test-session`, `evaluate-answer`, `get-item-for-edit`,
   `import-from-bank`, `saveStoryPoint` delete, `onSpaceDeleted`). Fixes the
   orphan-on-delete bug and halves answer-key reads.
2. **Validate `payload` with the discriminated union.** Replace
   `SaveItemRequestSchema.data.payload = z.record(unknown)` with a
   `z.discriminatedUnion('questionType', ...)` (and per-`ItemType`) so bad
   payloads are rejected at write time, not at grade time.
3. **Collapse `StoryPointType`.** Drop `test`, keep `timed_test`. Centralize "is
   this an assessment story point" + session-type mapping in one helper instead
   of scattered `=== 'timed_test' || === 'test'` checks.
4. **Unify the points model.** One authoritative `basePoints` per item; model
   marks as `points × weight`. Remove the `meta.totalPoints` vs
   `payload.basePoints` fallback and the `create-item` "P0-6" mirroring
   workaround.
5. **One publish-notification path.** Move fan-out entirely into the
   `onSpacePublished` trigger; remove inline `notifyStudentsOfPublish` from
   `saveSpace`; pick one recipient-resolution source (class membership).
6. **`evaluateAnswer` persists progress in one call** (for practice) via the
   progress-updater, returning the result — eliminating the second
   `recordItemAttempt` round-trip and the cost-without-progress window. Add
   idempotency key `sessionId+itemId+attempt` to submit/record.
7. **Batch reads.** `db.getAll(...)` for answer keys in `submitTestSession`;
   precompute and store the resolved rubric on the item at save time (or cache
   per request) instead of 4 sequential reads in `resolveRubric`.
8. **Shrink hot documents.** Keep summaries-only in the `storyPointProgress`
   subdoc if it grows; consider per-item progress docs for very large spaces;
   cap/paginate session `submissions`/`items` maps to stay under the 1 MB limit.
9. **Real multimodal eval.** Wire `mediaUrls` into the LLM call (fetch + attach
   images/audio), reusing the autograde image-download path, so
   `image_evaluation`/`audio` types are genuinely graded.
10. **Chat abuse limiting** moves fully to the shared Firestore/Redis limiter;
    drop the per-instance in-memory `Map` (keep the regex content filter).
11. **Centralize cascade-delete + stats** in one tested helper so
    `onSpaceDeleted`, `saveStoryPoint` delete, and `saveItem` delete cannot
    drift; prefer recomputing stats from a trigger.
12. **`purchaseSpace`** gets a real payment-gateway adapter behind an
    interface + an idempotency key; today's stub `transactionId` is replaced.

### 3.3 Service modules (`@levelup/services/levelup`)

```
saveSpace / saveStoryPoint / saveItem(input, ctx)
startTestSession / submitTestSession(input, ctx)
evaluateAnswer(input, ctx)             recordItemAttempt(input, ctx)
recordProgress(...)  ← single writer, used by both submit + record + evaluate
resolveRubric(itemRef, ctx)            cascadeDeleteSpace(spaceId, ctx)
sendChatMessage(input, ctx)            store: list/purchase/review
```

### 3.4 Collections

`tenants/{t}/spaces/{s}`, `.../storyPoints/{sp}`,
`.../storyPoints/{sp}/items/{i}` (canonical only),
`.../items/{i}/answerKeys/{k}` (server-only), `.../agents/{a}`,
`.../versions/{v}`, `.../reviews/{uid}`, `tenants/{t}/digitalTestSessions/{id}`,
`tenants/{t}/spaceProgress/{uid}_{sid}(+storyPointProgress/{sp})`,
`tenants/{t}/chatSessions/{id}(+messages/)`, `tenants/{t}/questionBank/{i}`,
`tenants/{t}/rubricPresets/{p}`, `tenants/platform_public/spaces/{s}`. RTDB
`leaderboards/{t}/{s}/{uid}`.

---

## 4. autograde-fn (the grading pipeline)

### 4.1 Keep

- **Two-stage AI architecture:** Panopticon page→question scouting, then RELMS
  per-question rubric grading.
- **Rubric resolution chain:** question rubric → exam `EvaluationSettings` →
  tenant default → enabled `EvaluationDimension`s.
- **Confidence-based human-in-the-loop routing:** `< threshold` →
  `needs_review`, `>= autoApprove` → `graded`, middle → `graded` +
  `reviewSuggested` (per-tenant thresholds).
- **Resilience:** `gradingDeadLetter` DLQ, graceful degradation of service
  errors to `needs_review`, stale-submission watchdog, per-batch progress
  writes.
- **Per-tenant secret/quota isolation**, per-question cost accounting rolled to
  `exam.stats` and tenant `usage`.
- Consolidated `saveExam` with server-side status transitions + post-publish
  field locking.
- Entity model: `Exam` / `ExamQuestion` / `Submission` / `QuestionSubmission` /
  `EvaluationSettings`.

### 4.2 Fix / restructure — the pipeline is the headline rework

1. **One durable orchestrator, one place for status.** Replace the
   "trigger-runs-worker-inline + a second trigger recomputes status" topology
   with a single `advancePipeline(submissionId)` reducer driven by a **Cloud
   Tasks queue** (one task per stage). Compute final submission status in
   exactly ONE idempotent place and delete the duplicated counting logic in
   `process-answer-grading.ts` vs `on-question-submission-updated.ts`. Every
   transition is guarded by `pipelineStatus`.

   ```
   uploadAnswerSheets ─▶ submission(uploaded) ─▶ enqueue(scout)
        scout    ─▶ Panopticon ─▶ questionSubmissions[] ─▶ status=scouting_complete ─▶ enqueue(grade)
        grade    ─▶ RELMS batch (concurrency N, DLQ, confidence routing) ─▶ status=grading_complete ─▶ enqueue(finalize)
        finalize ─▶ aggregate scores ─▶ status=ready_for_review ─▶ notify
   teacher review/override ─▶ reviewed ─▶ saveExam(results_released) ─▶ onResultsReleased
   ```

   The reducer is callable from a Cloud Task today and from the emulator via a
   thin inline-dispatch shim (preserve the emulator-friendly property without
   the racy inline-in-trigger pattern).

2. **Single canonical ingestion path.** Make `uploadAnswerSheets` (explicit
   submit-with-storage-paths, server-creates the submission) the ONLY ingestion
   path. Demote/remove the `onAnswerSheetUpload` GCS trigger and the
   `'gcs'`/`classId[0]` divergence, so web, scanner-app, and RN behave
   identically. (Scanner-app uploads compressed images to Storage, then calls
   `uploadAnswerSheets`; it never writes the submission doc directly.)
3. **Provider structured output.** Pass a Zod-derived JSON `responseSchema` to
   Gemini for extraction / scouting / grading and validate with Zod — delete the
   regex fence-stripping + key remapping. One canonical
   `UnifiedEvaluationResult` schema (shared with levelup). Model name +
   `maxTokens` move into config / `EvaluationSettings`, not literals (drop the
   16384/8192/65536/4096 magic numbers).
4. **Clean the status taxonomy.** Remove vestigial
   `ocr_processing`/`ocr_failed`/`'ocr'` states (no OCR stage exists) and the
   unreachable `completed` exam status (or actually set it). Expand
   `AnswerSheetData.uploadSource` to all real sources. Validate transition
   tables against the type unions at build time. Stop using `grading_complete`
   (a submission status) as a releasable exam status in `saveExam`.
5. **Stabilize the LLM dependency.** Ship compiled `.d.ts` from `@levelup/ai`
   and import `LLMWrapper`/provider normally; remove
   `functions/autograde/src/utils/llm.ts`'s `require()` + relative-path
   fallback + duplicated interfaces.
6. **Scale the watchdog & image handling.** Drive the watchdog off a
   collection-group query with a `pipelineStatus + updatedAt` composite index
   instead of iterating all tenants. Download/normalize each answer image once
   during scouting and reuse it in grading (no per-question re-download).
7. **First-class cross-domain links.** Model
   `linkedSpaceId`/`linkedStoryPointId`/ `linkedItemId` as typed references with
   integrity checks; centralize "practice this space" feedback generation rather
   than string-concatenating in `finalizeSubmission`.
8. **Hard, typed quota gate.** Replace the swallowed dynamic-import quota check
   with a typed pre-check that fails closed; accumulate cost in a single
   transactional rollup.
9. **Retire the top-level `autograde/` POC** from the active tree.

### 4.3 Service modules (`@levelup/services/autograde`)

```
saveExam(input, ctx)                 extractQuestions(input, ctx)
uploadAnswerSheets(input, ctx)       gradeQuestion(input, ctx)  // manual | retry | ai
advancePipeline(submissionId, ctx)   // the single reducer
scoutSubmission / gradeSubmission / finalizeSubmission(submissionId, ctx)
resolveRubric(questionRef, ctx)      computeSubmissionStatus(submission) // ONE place
```

### 4.4 Collections

`tenants/{t}/exams/{e}`, `.../exams/{e}/questions/{q}`,
`tenants/{t}/submissions/{s}`, `.../submissions/{s}/questionSubmissions/{q}`,
`tenants/{t}/evaluationSettings/{id}`, `tenants/{t}/gradingDeadLetter/{id}`,
`tenants/{t}/examAnalytics/{e}` (written by analytics).

---

## 5. analytics-fn (cross-system aggregation, materialized)

### 5.1 Keep

- **Precompute-on-write:** triggers materialize per-student
  `StudentProgressSummary` and per-class `ClassProgressSummary` so reads are
  single-doc lookups.
- **Pure rule engines:** `at-risk-rules.ts` (4 rules) and `insight-rules.ts` (6
  rules), side-effect-free and unit-tested.
- Per-exam `ExamAnalytics` on results-released; transaction-based section
  merges; Zod re-validation at boundaries; cursor pagination + batch-commit caps
  in schedulers.
- Consolidated `getSummary` (scope discriminator) and `generateReport` (type
  discriminator) → signed-URL PDF.
- Cross-system overall score (60% autograde / 40% levelup); dual Firestore +
  RTDB notification fan-out.

### 5.2 Fix / restructure

1. **Collapse trigger fan-out into one debounced orchestrator.** Today 4
   functions write `studentProgressSummaries/{id}` and 3 fire on every write to
   it. Replace with: (a) section-scoped writes that set a single `recompute`
   marker, and (b) one debounced/queued `recomputeStudentRollup` worker (Cloud
   Tasks/Pub-Sub) that recomputes class summary, leaderboard, milestones, and
   at-risk in a defined order. Removes races, double-notifications, the dead
   `pendingRecalculation` flag. **Merge the two `spaceProgress/{id}` triggers
   into one.**
2. **`onProgressMilestone` is the single at-risk notifier**, driven by the
   summary's `isAtRisk` transition. The nightly scheduler only sets flags (no
   notify), killing the duplicate notify path.
3. **One membership model.** Standardize on `userMemberships` with
   `{uid}_{tenantId}` ids matching the rules; rewrite `onStudentSummaryUpdated`
   (today reads `tenants/{id}/memberships` keyed on `schoolId`) and the at-risk
   UID resolution against it. Fix the O(N)
   `students.where(authUid != null).limit(1000)` lookup with
   `where(authUid in [...])` or denormalized `teacherUids`/`parentUids` on the
   summary.
4. **Wire budget alerts.** `dailyCostAggregation` emits the existing
   `ai_budget_alert` notification on 80%/100% breach instead of only
   `console.warn`.
5. **Fix insight cap + correlation stub.** Correct slot math
   (`min(slotsAvailable, seeds.length)`, deterministic delete by `createdAt`);
   either implement real exam↔space correlation aggregation or drop the
   `cross_system_correlation` rule until data-backed.
6. **Replace expensive count queries.** Platform-scope `getSummary` uses
   Firestore `.count()` aggregations or a daily-maintained `platformMetrics`
   rollup doc; cache health snapshots.
7. **Compute real metrics or omit them.** Implement `streakDays` (from RTDB
   practice), `discriminationIndex` (upper/lower group), `topicPerformance`,
   `className` resolution — or remove them from the schema so reports never
   display zeros as truth. Remove the unused `standardDeviation` import.
8. **Fix `costSummaries` path shape** to one consistent structure (see §7).
9. **`workspace:*` for shared-types**, not the vendored
   `.local-deps/shared-types` copy.
10. **Security rules for materialized collections** (or formalize callable-only)
    — see §8.

### 5.3 Trigger/scheduler inventory (after restructure)

```
onSubmissionGraded            → set recompute marker (autograde section)
onSpaceProgressUpdated        → set recompute marker (levelup section) [merged trigger]
recomputeStudentRollup(queue) → rebuild student summary + class rollup + leaderboard
                                + milestones + at-risk, in order, ONCE
onExamResultsReleased         → compute ExamAnalytics
dailyCostAggregation (cron)   → cost rollups + ai_budget_alert
nightlyAtRiskFlagging (cron)  → set isAtRisk flags only (no notify)
generateInsights (cron)       → rule-based + chat-derived learningInsights signals
```

---

## 6. AI calls & cost logging (cross-cutting)

### 6.1 Keep

- **Single typed LLM gateway** `LLMWrapper.call(prompt, metadata, options)` —
  retry, per-tenant circuit breaker, cost capture, audit logging to
  `llmCallLogs`.
- **Per-tenant Gemini key in Secret Manager** (`tenant-{tenantId}-gemini`);
  never in Firestore or client bundles.
- **Cost/quota discipline:** per-call cost, daily/monthly rollups by purpose +
  model, soft warning + hard limit.
- **Confidence-routed grading; resilient parsers; prompt-injection defense.**

### 6.2 Fix / restructure

1. **One `@levelup/ai` package, built with `.d.ts`.** Remove the autograde
   re-declaration and `require()` fallback; both services import the same
   compiled package.
2. **Real provider seam.** `LLMProvider` interface (`generate`,
   `generateStructured`, `generateWithImages`) with a `GeminiProvider` today and
   room for OpenAI/Anthropic/Vertex. Pricing math lives behind each provider.
   Model/provider become a tenant/space setting, not hardcoded
   `gemini-2.5-flash`.
3. **Structured output everywhere.** One canonical `UnifiedEvaluationResult` Zod
   schema in shared-types passed as `responseSchema`; Zod-validate on parse;
   delete snake/camel field re-mapping across `evaluator.ts`/`relms.ts`.
4. **Versioned prompt registry.** Named templates (`evaluator.v2`, `tutor.v1`,
   `panopticon.v1`, `extraction.v1`) with typed inputs, tenant/space-selectable;
   log the prompt version on every `llmCallLog` for reproducibility/A-B.
5. **Quota enforcement inside the gateway** so it cannot be bypassed; unify
   cost-summary paths (§7) so increment/quota-check/aggregator all agree.
6. **Move circuit-breaker + abuse state out of memory** into
   Firestore/Memorystore so protections survive cold starts and scale with RN
   concurrency.
7. **Finish multimodal eval** in levelup by reusing the autograde
   image-download-to-base64 path.
8. **Rebuild content/question generation as a first-class server feature**
   behind the gateway (with cost logging + quota), emitting items that conform
   to the unified content schema — do not leave it stranded in the legacy app.
9. **Security:** revoke the leaked legacy Gemini key
   (`LevelUp-App/src/integrations/llm/GeminiModel.ts`), remove all key logging,
   make per-tenant Secret Manager the only key path.
10. **Surface AI learning signals.** Feed chat-derived
    `learningInsights.{conceptsTouched, masterySignals, struggleSignals}` into
    the insights pipeline so "AI insights" blend deterministic rules with real
    LLM signals.

### 6.3 LLM call metadata contract (logged per call)

```ts
interface LLMCallMetadata {
  tenantId: string;
  userId: string;
  userRole: TenantRole;
  purpose:
    | "evaluate"
    | "chat"
    | "summarize"
    | "insight"
    | "extract"
    | "scout"
    | "grade"
    | "generate";
  operation: string; // e.g. 'evaluateAnswer'
  resourceType: "item" | "exam" | "submission" | "space" | "chatSession";
  resourceId: string;
  promptVersion: string; // 'evaluator.v2'
  idempotencyKey?: string;
}
// → /tenants/{tenantId}/llmCallLogs/{callId}  (CF write-only; admin read)
//   { ...metadata, model, provider, inputTokens, outputTokens, costUsd, latencyMs, status }
```

---

## 7. Cost-summary canonical layout (resolve the schism)

Today three layouts disagree, breaking quota enforcement. Standardize on:

```
tenants/{t}/costSummaries/{YYYY-MM-DD}        ← daily doc (DailyCostSummary)
tenants/{t}/costSummariesMonthly/{YYYY-MM}    ← monthly rollup (derived)
```

- `incrementDailyCostSummary` writes the daily doc.
- `checkUsageQuota` reads the current-month daily docs by `__name__` range OR
  the monthly rollup doc — both consistent with the above.
- `dailyCostAggregation` rolls daily → monthly with delta-based
  `FieldValue.increment(new - old)` idempotency.
- Provide a one-time migration from the old `costSummaries/daily/{date}` +
  `costSummaries/monthly/{month}` sub-path shape.

---

## 8. Reliability, security rules & access

1. **Pipeline reliability:** Cloud Tasks queues per stage + `gradingDeadLetter`
   DLQ + watchdog + idempotent reducers (autograde); transactional outbox or
   triggers for all side effects (notifications, content versions, leaderboards)
   — never fire-and-forget.
2. **Materialized analytics collections need rules.** Add tenant/role-scoped
   `match` rules for `studentProgressSummaries`, `classProgressSummaries`,
   `examAnalytics`, `insights`, `costSummaries` mirroring `getSummary`'s
   authorization — OR enforce callable-only and document it. Decide once;
   current default-deny is an undocumented gap that some apps read around.
3. **Claims sync trigger** (§2.2) closes the stale-access window; add
   `revokeRefreshTokens(uid)` on membership suspend / tenant deactivate / role
   change.
4. **Treat `firestore.rules` as defense-in-depth.** All authorization decisions
   live in one shared `@levelup/access` policy module imported by every service
   and adapter; generate rules fragments from the same typed permission enum (no
   stringly-typed `permissions[perm]`).

---

## 9. Common API layer integration (web + React Native)

```ts
// @levelup/api-contract — one file per callable
export const SaveSpaceRequestSchema = z.object({
  /* ... */
});
export type SaveSpaceRequest = z.infer<typeof SaveSpaceRequestSchema>;
export const SaveSpaceResponseSchema = SaveResponseSchema;
export type SaveSpaceResponse = z.infer<typeof SaveSpaceResponseSchema>;

export const CALLABLES = {
  saveSpace: {
    req: SaveSpaceRequestSchema,
    res: SaveSpaceResponseSchema,
    apiVersion: 1,
  },
  submitTestSession: {
    req: SubmitTestSessionReqSchema,
    res: SubmitTestSessionResSchema,
    apiVersion: 1,
  },
  uploadAnswerSheets: {
    req: UploadAnswerSheetsReqSchema,
    res: SaveResponseSchema,
    apiVersion: 1,
  },
  // ...all ~47 callables
} as const;

// generic, transport-injectable client — identical for web + RN
function createCallableClient(
  invoke: (name: string, data: unknown) => Promise<unknown>
) {
  return mapValues(CALLABLES, (def, name) => async (input) => {
    const data = def.req.parse(input);
    const res = await invoke(name, data);
    return import.meta.env.DEV ? def.res.parse(res) : (res as Output);
  });
}
```

- Web injects `httpsCallable`; RN injects the same (Firebase JS SDK works in RN)
  or a REST/tRPC adapter later. One client, one set of typed methods, no
  stringly-typed names.
- React Query hooks in `@levelup/shared-hooks` call the typed client (never
  `httpsCallable` directly); platform-neutral so RN reuses them.
- Standardize: one pagination shape
  `{ cursor?, limit? } → { items, nextCursor }`; one wire error envelope
  (`HttpsError.details` always carries `{ code: AppErrorCode }`); explicit
  `apiVersion` per callable to enable real dual-run migrations.
- `ALLOWED_TRANSITIONS` state machines move into the contract package so clients
  can pre-validate transitions.

---

## 10. Migration notes (from current code)

1. **Stand up `@levelup/api-contract` first.** Move all `callable-types.ts`
   interfaces + `callable-schemas.ts` Zod + the inline request types from
   `shared-services` into one file-per-callable package; derive types via
   `z.infer`. Wire `parseRequest` to it. This is non-behavioral and unblocks
   everything else.
2. **Extract services without behavior change.** Lift each `onCall` handler's
   body into a `@levelup/services` function taking `ctx`; the callable becomes
   `auth → parse → service(input, ctx)`. Ship `.d.ts` for `@levelup/ai`; delete
   the autograde `require()` shim.
3. **levelup item-path migration.** Backfill flat `spaces/{id}/items/*` into
   nested `storyPoints/{sp}/items/*` (one-time script), then delete all fallback
   branches and the flat-path indexes from `firestore.indexes.json`.
4. **autograde pipeline cutover.** Introduce Cloud Tasks + the `advancePipeline`
   reducer; run it alongside the existing triggers, then remove the
   inline-in-trigger worker and the duplicated status logic; remove the
   `onAnswerSheetUpload` GCS trigger after RN/web both use `uploadAnswerSheets`.
   Validate the cleaned status taxonomy at build time.
5. **analytics trigger collapse.** Add the `recompute` marker + single
   `recomputeStudentRollup` queue worker; merge the two `spaceProgress`
   triggers; make `onProgressMilestone` the only notifier; wire
   `ai_budget_alert`; migrate `costSummaries` to the canonical layout (§7) with
   a backfill.
6. **identity hardening.** Add `onMembershipWritten` claim-sync trigger; migrate
   Gen1 Auth triggers to Gen2 blocking functions; normalize `authUid`; introduce
   `provisionMembership` + `adjustTenantCounters`; add idempotency keys; fix
   audit-log collection name + `tenantCode` collision handling. Backfill
   `uid → authUid`.
7. **Security pass.** Add rules for materialized analytics collections; lock
   storage rules per-tenant; revoke the leaked legacy Gemini key; add
   `revokeRefreshTokens` on deactivation/role change.
8. **Retire dead code.** Top-level `autograde/` POC and the legacy `LevelUp-App`
   AI/content generation paths are archived after their concepts (content
   generation, gamification economy) are ported into the new platform.
