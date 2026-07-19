# FNCLEAN-3 — v1 API Architecture + Non-Callable Function Risk Assessment

Date: 2026-07-13 · Branch: `staging` · Project: `lvlup-ff6fa` (asia-south1) ·
Read-only source analysis. Inputs:
`docs/functions-cleanup/deployed-functions-raw.txt` (244 deployed functions),
`docs/functions-cleanup/01-deployed-source-map.md` (FNCLEAN-1), repo source.

**Deployed surface**: 244 functions = 165 `v1-*` (new sdk-v1 codebase: 140
callables + 25 non-callables) + 79 unprefixed legacy (45 callables + 34
non-callables across 4 legacy codebases).

---

## PART A — Architecture of the new (v1) backend

### A1. Layering

```
apps (lean UI) → @levelup/query → @levelup/repositories → @levelup/api-client
                                       ↘ @levelup/api-contract (SSOT wire seam) ↙
server:  functions/sdk-v1 (thin deploy shell) → @levelup/functions-adapters → @levelup/services → repo-admin (ONLY direct-Firestore code)
```

- **`packages/api-contract`** is the single source of truth for the callable
  surface. `packages/api-contract/src/registry.ts:37-44` assembles per-module
  barrels (`IDENTITY_CALLABLES`, levelup content + gamification, autograde +
  fold, analytics) into one flat `CALLABLES` object. Each `CallableDef` carries:
  versioned name (`v1.<module>.<op>`), module, `.strict()` zod request/response
  schemas, `authMode` (`authed`/`public`), `rateTier`
  (`write|read|ai|auth|report`), `idempotent?`, `invalidates?` (query-key
  invalidation hints). Deployed count: **140 callables** in the sdk-v1 codebase,
  pinned by the coverage test
  `functions/sdk-v1/src/__tests__/callable-coverage.test.ts:21-33` (every
  contract name must resolve to an exported function in the matching module).
- **`packages/services`** owns ALL business logic, one directory per bounded
  context: `identity/`, `levelup/`, `autograde/`, `analytics/`, `notification/`,
  `shared/`, plus `repo-admin/` — the only code that touches Firestore via the
  Admin SDK.
- **`functions/sdk-v1`** is a thin shell: 4 module registries (`identity.ts`,
  `levelup.ts`, `autograde.ts`, `analytics.ts`) that `wire()`/`call()` contract
  names to service functions, plus `bootstrap.ts` (composition root) and
  `index.ts` (export tree). No business logic lives in the functions layer.

### A2. Composition root (`functions/sdk-v1/src/bootstrap.ts`, runs before any module barrel via `index.ts:38` side-effect import)

`bootstrapRuntime()` (bootstrap.ts:63-172) initializes Admin SDK once and
injects the structural ports into `@levelup/functions-adapters`:

| Port             | Provider                                                                                                                                                                                  |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `repos`          | `createRepos({ now })` from `@levelup/services/repo-admin`                                                                                                                                |
| `ai`             | `createAiGateway(...)` from `@levelup/ai` — per-tenant Gemini key via Secret Manager, circuit breaker, `imageStore` (storagePath→bytes, 14MB budget), result adapted through `ai-seam.ts` |
| `clock`          | ISO wall clock                                                                                                                                                                            |
| storage signer   | `createAdminStorageSigner()` (V4 signed URLs; stub in emulator/test)                                                                                                                      |
| RTDB projections | `createRtdbGradingProjections()` / `createRtdbLevelupProjections()`                                                                                                                       |
| pipeline tasks   | `enqueuePipelineAdvance()` via Cloud Tasks (`firebase-admin/functions`, no extra dep)                                                                                                     |

### A3. Naming conventions

- **Callable names**: contract uses dotted `v1.<module>.<op>`; `index.ts:12-31`
  exports a nested tree
  `export const v1 = { identity: {...}, levelup: {...}, ... }`; Firebase joins
  the export path with dashes → deployed id **`v1-identity-saveTenant`** etc.
  The dotted→dashed mapping is reconciled in the client transport.
- **`v2_` is a DATA prefix, not a function-name prefix.** No deployed function
  is named `v2_*`. The prefix applies to Firestore collection roots: SSOT
  `packages/services/src/repo-admin/paths.ts:30-37` — `collectionPrefix()` reads
  `LVLUP_COLLECTION_PREFIX` (deployed as `v2_`), `topLevel(name)` prefixes
  top-level collections only (`tenants` → `v2_tenants`; subcollections inherit).
  Mirrored in `packages/seed/src/engine/paths.ts`.
- **Trigger paths**:
  `packages/functions-shared/src/adapters/on-document.ts:74-85` —
  `prefixTriggerDocument()` prepends the prefix to the trigger document pattern
  at **module-load (CLI discovery) time**, so
  `tenants/{tenantId}/submissions/{submissionId}` deploys as
  `v2_tenants/{tenantId}/submissions/{submissionId}`. ⚠ Deploy gotcha (CLI
  13.35.1): `.env` is NOT injected at discovery by default — the prefix must be
  present in the discovery environment or triggers silently deploy unprefixed
  (see TRAIN-1 notes; serveAdmin patch / in-code env load).
- **Schedulers**: wired via `wireScheduler`/`schedule`/`makeScheduler`, exported
  inside the same `v1.<module>` tree (e.g. `v1-identity-tenantLifecycleCheck`).
- **taskQueue functions**:
  `makeTaskHandler<P>(queueName, service, {tenantField, retryConfig, rateLimits})`
  wrapping `onTaskDispatched` (v2 tasks). Queues in
  `packages/functions-shared/src/config/config.ts:11-15`: `grading-pipeline`,
  `student-rollup`, (`outbox-drain` defined, no handler deployed yet). Enqueued
  via `getFunctions().taskQueue(...)` with region-qualified function id and
  `dedupeId` idempotency (`ALREADY_EXISTS` = dedupe hit).

### A4. Deployment: firebase.json codebases

`firebase.json` declares **5 codebases**: `identity`, `autograde`, `levelup`,
`analytics` (LEGACY, sources `functions/<name>`, postdeploy
`scripts/prepare-functions-deploy.ts cleanup <name>` which restores the
workspace-dep rewrite) and **`sdk-v1`** (NEW, source `functions/sdk-v1`,
predeploy = tsup bundle build + `prepare-deploy-pkg.mjs` which strips
`workspace:` deps/devDeps from package.json). Codebase = deletion boundary:
`firebase deploy --only functions:<codebase>` manages only that codebase's
functions.

### A5. Intended end-state surface

Per `docs/rebuild-spec/specs/SDK-SERVER-DESIGN.md` §0 and `SDK-LAYERS-PLAN.md`
§2: legacy 4 codebases are kept only for parallel-run; the end state is **ONLY
the `sdk-v1` codebase** — 140 contract callables + the 25 non-callables below
(14 v2\_-path triggers, 9 schedulers, 2 taskQueue), all business logic in
`@levelup/services`, all clients on `v1-*`. All 5 web apps + mobile apps already
call `v1-*` only. The one legacy capability with **no v1 equivalent** is the
gen-1 Auth triggers (see B4).

---

## PART B — Per-function verdicts (all 59 non-callable deployed functions)

Verdict legend:

- **SAFE-TO-DELETE** — dead or hazardous; nothing legitimate depends on it.
- **LOAD-BEARING-FOR-LEGACY-DATA** — operates on UNPREFIXED paths that still
  hold the real production data (`tenants/tenant_subhang` SUB001, CHAITANY);
  keep until that data is migrated/frozen.
- **SUPERSEDED-BY-V1** — a v1 twin covers the same job on `v2_` paths; the
  legacy one only matters if something still writes unprefixed paths. Deletable
  once legacy writers (legacy callables + storage triggers) are gone.
- **KEEP** — part of the intended v1 surface.

### B1. ⚠ Critical finding: legacy Storage triggers fire on v1 uploads (namespace collision)

Cloud Storage has **no v2\_ namespace**. v1's `requestUploadUrl` mints object
paths `tenants/{tenantId}/exams/{examId}/answer-sheets/{studentId}/{file}`
(`packages/services/src/autograde/request-upload-url.ts:87`, same shape for
`question-paper`) — **exactly the patterns the legacy storage triggers match**
(`functions/autograde/src/triggers/on-answer-sheet-upload.ts:23`,
`on-question-paper-upload.ts:18`). So every v1 signed-URL upload fires the
legacy trigger today. The trigger then looks up the exam in **unprefixed**
Firestore: for v1-native exam ids it no-ops, but for exams whose ids exist in
BOTH trees (the SUB001 Option-A migration preserves document ids) it can create
a phantom legacy submission and wake the legacy 4GiB AI grading pipeline —
double grading + AI spend on unprefixed data. **Delete `onAnswerSheetUpload` and
`onQuestionPaperUpload` FIRST in any cleanup wave.**

### B2. Legacy non-callables — 34 functions

Codebases: `functions/{identity,autograde,levelup,analytics}`. All run in
asia-south1; all Firestore/collection paths below are UNPREFIXED.

#### Scheduled (10)

| Function                  | Codebase  | Schedule        | What it does                                                                                                                                | Verdict                                                                                                                                                                                                                                                          |
| ------------------------- | --------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cleanupExpiredExports`   | identity  | every 30 min    | Deletes expired export files under Storage `exports/` by `deleteAfter` metadata (`triggers/cleanup-expired-exports.ts:9`)                   | **SUPERSEDED-BY-V1** — twin `v1-identity-cleanupExpiredExports`. ⚠ Verify the v1 twin deletes the Storage objects (not just job docs) before removal; Storage `exports/` is a shared, unprefixed namespace.                                                      |
| `cleanupInactiveChats`    | levelup   | daily 03:00 UTC | collectionGroup `chatSessions`, deactivates >7d-inactive (`triggers/cleanup-inactive-chats.ts:18`)                                          | **SAFE-TO-DELETE** — legacy chat data is static. ⚠ Gap: **no v1 twin exists**; `v2_` chatSessions have no inactivity sweep — port to sdk-v1 if the behavior is wanted.                                                                                           |
| `cleanupStaleSessions`    | levelup   | hourly          | collectionGroup `digitalTestSessions`, abandons >24h in_progress (`triggers/cleanup-stale-sessions.ts:20`)                                  | **SUPERSEDED-BY-V1** (`v1-levelup-cleanupStaleSessions`)                                                                                                                                                                                                         |
| `dailyCostAggregation`    | analytics | 00:05 UTC       | `tenants/{t}/llmCallLogs` → `costSummaries` daily/monthly (`schedulers/daily-cost-aggregation.ts:16`)                                       | **SUPERSEDED-BY-V1** — new AI calls log under v2\_; unprefixed llmCallLogs no longer grow.                                                                                                                                                                       |
| `generateInsights`        | analytics | 02:30 UTC       | Insight rules per active student → `tenants/{t}/insights` (`schedulers/generate-insights.ts:24`)                                            | **SUPERSEDED-BY-V1** (`v1-analytics-generateInsights`)                                                                                                                                                                                                           |
| `monthlyUsageReset`       | identity  | 1st 00:00 UTC   | Resets `tenants/{t}.usage` counters (`scheduled/usage-reset.ts:15`)                                                                         | **SUPERSEDED-BY-V1**. ⚠ Writes monthly to the REAL unprefixed tenant docs — stop before taking a migration snapshot.                                                                                                                                             |
| `nightlyAtRiskDetection`  | analytics | 02:00 UTC       | Flags at-risk in `studentProgressSummaries`, notifies teachers/parents (`schedulers/nightly-at-risk-detection.ts:14`)                       | **SUPERSEDED-BY-V1** (`v1-analytics-nightlyAtRiskDetection`)                                                                                                                                                                                                     |
| `onTestSessionExpired`    | levelup   | every 5 min     | Expires + auto-grades past-deadline `digitalTestSessions` (`triggers/on-test-session-expired.ts:20`)                                        | **SUPERSEDED-BY-V1** (`v1-levelup-expireTestSessions`). Run one final sweep (or confirm zero unprefixed in_progress sessions) before deleting.                                                                                                                   |
| `staleSubmissionWatchdog` | autograde | every 15 min    | Re-drives submissions stuck in scouting/grading >10 min, 3 retries → manual_review (`schedulers/stale-submission-watchdog.ts:16`)           | **SUPERSEDED-BY-V1** (`v1-autograde-staleSubmissionWatchdog`)                                                                                                                                                                                                    |
| `tenantLifecycleCheck`    | identity  | daily 00:00 UTC | Expires trial tenants past `expiresAt`; writes `tenants/{t}` status, `auditLog`, `platformActivityLog` (`scheduled/tenant-lifecycle.ts:16`) | **SUPERSEDED-BY-V1**. ⚠ **HAZARD — delete early**: still mutates the REAL unprefixed tenant docs daily (could flip status on unmigrated source-of-truth data). Product no longer reads unprefixed tenant status (trial gate moved to v1 `evaluateTenantAccess`). |

#### Firestore triggers (18)

| Function                        | Codebase  | Path (unprefixed) · event                                       | What it does                                                                                                                                              | Verdict                                                                                                                                                                                                                             |
| ------------------------------- | --------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `onClassArchived`               | identity  | `tenants/{t}/classes/{c}` · updated                             | status→archived: strips classId from students'/teachers' `classIds[]` (`triggers/on-class-deleted.ts:12`)                                                 | **LOAD-BEARING-FOR-LEGACY-DATA** — referential integrity for real unprefixed rosters; fires if admin tooling / migration scripts archive legacy classes. v2\_ twin exists for v1 data.                                              |
| `onExamDeleted`                 | autograde | `tenants/{t}/exams/{e}` · deleted                               | Cascade-deletes questions, submissions (+questionSubmissions), examAnalytics; decrements tenant stats (`triggers/on-exam-deleted.ts:15`)                  | **LOAD-BEARING-FOR-LEGACY-DATA** — cascade integrity for real unprefixed exams. Decision point for the final legacy purge: keeping it during bulk deletion gives automatic cascade; deleting it first leaves orphan subcollections. |
| `onExamPublished`               | autograde | `tenants/{t}/exams/{e}` · updated                               | status→published: bulk "New Exam Assigned" notifications (`triggers/on-exam-published.ts:13`)                                                             | **SUPERSEDED-BY-V1** (`v1-autograde-onExamPublished`) — no new unprefixed publishes once legacy callables are gone.                                                                                                                 |
| `onExamResultsReleased`         | analytics | `tenants/{t}/exams/{e}` · updated                               | status→results_released: builds `examAnalytics/{e}` (`triggers/on-exam-results-released.ts:14`)                                                           | **SUPERSEDED-BY-V1** (`v1-analytics-onExamResultsReleased`)                                                                                                                                                                         |
| `onProgressMilestone`           | analytics | `tenants/{t}/studentProgressSummaries/{s}` · updated            | Milestone detection → notifications only, no Firestore writes (`triggers/on-progress-milestone.ts:22`)                                                    | **SAFE-TO-DELETE** — notification-only, downstream of the legacy rollup chain; only fires when other legacy analytics triggers write summaries. No v1 trigger twin needed (v1 handles via its rollup/outbox design).                |
| `onQuestionSubmissionUpdatedV2` | autograde | `tenants/{t}/submissions/{s}/questionSubmissions/{q}` · updated | Aggregates per-question grading → parent submission status (`triggers/on-question-submission-updated.ts:10`)                                              | **SUPERSEDED-BY-V1** (`v1-autograde-onQuestionSubmissionUpdated`, flat `_kind`-guarded design) — dead once no new unprefixed submissions (requires B1 storage triggers deleted).                                                    |
| `onResultsReleased`             | autograde | `tenants/{t}/exams/{e}` · updated                               | Results-released notifications to students/parents/creator (`triggers/on-results-released.ts:15`)                                                         | **SUPERSEDED-BY-V1** (`v1-autograde-onResultsReleased`)                                                                                                                                                                             |
| `onSpaceDeleted`                | levelup   | `tenants/{t}/spaces/{s}` · deleted                              | Cascade-deletes storyPoints/items(+answerKeys)/agents/testSessions/spaceProgress/chatSessions + RTDB leaderboard (`triggers/on-space-deleted.ts:19`)      | **LOAD-BEARING-FOR-LEGACY-DATA** — the real 12 SUB001 spaces live unprefixed; deleting one without this orphans deep subcollections. Same purge decision point as `onExamDeleted`.                                                  |
| `onSpaceProgressUpdated`        | analytics | `tenants/{t}/spaceProgress/{p}` · written                       | Recomputes LevelUp section of `studentProgressSummaries` (`triggers/on-space-progress-updated.ts:20`)                                                     | **SUPERSEDED-BY-V1** (`v1-analytics-onSpaceProgressUpdated`)                                                                                                                                                                        |
| `onSpacePublished`              | levelup   | `tenants/{t}/spaces/{s}` · updated                              | status→published: bulk notifications (`triggers/on-space-published.ts:13`)                                                                                | **SUPERSEDED-BY-V1** — no v1 trigger twin; v1 emits publish notifications at service level (outbox).                                                                                                                                |
| `onStudentArchived`             | identity  | `tenants/{t}/students/{s}` · updated                            | status→archived: strips studentId from parents/classes, decrements counts (`triggers/on-student-deleted.ts:12`)                                           | **LOAD-BEARING-FOR-LEGACY-DATA** — same rationale as `onClassArchived`.                                                                                                                                                             |
| `onStudentSummaryUpdated`       | analytics | `tenants/{t}/studentProgressSummaries/{s}` · written            | Recomputes `classProgressSummaries/{classId}` (5-min debounce) (`triggers/on-student-summary-updated.ts:20`)                                              | **SUPERSEDED-BY-V1** — v1 collapses this into the `student-rollup` taskQueue orchestrator.                                                                                                                                          |
| `onSubmissionCreated`           | autograde | `tenants/{t}/submissions/{s}` · created                         | Starts legacy OCR/grading pipeline (4GiB/540s) (`triggers/on-submission-created.ts:13`)                                                                   | **SUPERSEDED-BY-V1** (`v1-autograde-onSubmissionCreated` + Cloud Tasks pipeline). Only reachable via legacy callables or the B1 storage trigger — remove those first, then this is dead.                                            |
| `onSubmissionGraded`            | analytics | `tenants/{t}/submissions/{s}` · updated                         | Recomputes AutoGrade section of student summary (`triggers/on-submission-graded.ts:22`)                                                                   | **SUPERSEDED-BY-V1** (`v1-analytics-onSubmissionGraded`)                                                                                                                                                                            |
| `onSubmissionUpdated`           | autograde | `tenants/{t}/submissions/{s}` · updated                         | Legacy pipeline state machine (scouting→grading→finalize, DLQ) (4GiB/540s) (`triggers/on-submission-updated.ts:16`)                                       | **SUPERSEDED-BY-V1** — v1 replaces trigger-chained stages with the `grading-pipeline` taskQueue reducer.                                                                                                                            |
| `onTenantDeactivated`           | identity  | `tenants/{t}` · updated                                         | status→suspended/expired: suspends all `userMemberships` for tenant (`triggers/on-tenant-deactivated.ts:35`)                                              | **LOAD-BEARING-FOR-LEGACY-DATA** — acts on the real unprefixed tenant docs + real `userMemberships`. Goes dead once legacy status writers (`tenantLifecycleCheck`, legacy `deactivateTenant`) are removed; keep until then.         |
| `onUserStoryPointProgressWrite` | analytics | `tenants/{t}/spaceProgress/{p}` · written                       | Newly-completed story points → RTDB `storyPointLeaderboard`/`courseLeaderboard` + summary recompute (`triggers/on-user-story-point-progress-write.ts:20`) | **SUPERSEDED-BY-V1** — v1 RTDB projections (bootstrap-wired) cover leaderboards; apps read the v1 roots.                                                                                                                            |
| `updateLeaderboard`             | analytics | `tenants/{t}/studentProgressSummaries/{s}` · written            | Projects summaries → RTDB `tenantLeaderboard`/`courseLeaderboard` (`triggers/update-leaderboard.ts:18`)                                                   | **SUPERSEDED-BY-V1** — same as above.                                                                                                                                                                                               |

#### Storage triggers (2) — see B1

| Function                | Codebase  | Object pattern (default bucket `lvlup-ff6fa.appspot.com`)         | What it does                                                                                                            | Verdict                                                                       |
| ----------------------- | --------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `onAnswerSheetUpload`   | autograde | `tenants/{t}/exams/{e}/answer-sheets/{studentId}/{file}` (images) | Creates/appends unprefixed submission → wakes legacy grading pipeline (`triggers/on-answer-sheet-upload.ts:23`)         | **SAFE-TO-DELETE — DELETE FIRST** (active collision with v1 upload paths, B1) |
| `onQuestionPaperUpload` | autograde | `tenants/{t}/exams/{e}/question-paper/{file}` (images)            | Appends image to unprefixed `exam.questionPaper.images`, transitions status (`triggers/on-question-paper-upload.ts:18`) | **SAFE-TO-DELETE — DELETE FIRST** (same collision)                            |

#### https (2) — the flagged pair

| Function           | Verdict                                                                                                                                                                                                                                                                                       |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `onClassDeleted`   | **SAFE-TO-DELETE** — ORPHAN https stub, no source anywhere in the repo (FNCLEAN-1). Artifact of the delete-first/https-stub trick used during trigger-type changes (DEP-1 gotcha). The real logic is `onClassArchived` (identity, file `on-class-deleted.ts` exports the _Archived_ trigger). |
| `onStudentDeleted` | **SAFE-TO-DELETE** — same: orphan https stub; real logic is `onStudentArchived`.                                                                                                                                                                                                              |

#### Auth triggers (2) — gen-1, identity codebase

| Function        | What it does                                                                                                     | Verdict                                                                                                                                                                                                                                                                                                               |
| --------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `onUserCreated` | Auth user.create → creates platform `/users/{uid}` profile doc (`triggers/on-user-created.ts:12`)                | **LOAD-BEARING (KEEP-UNTIL-MIGRATED)** — sdk-v1 has **no auth-trigger equivalent**; this is the only signup-time user-doc writer. Note it writes UNPREFIXED `/users`, not `v2_users` — new signups do not get a v2\_ profile doc from this trigger; the v1 backend must lazy-create (verify before eventual removal). |
| `onUserDeleted` | Auth user.delete → soft-deletes `/users/{uid}`, deactivates `userMemberships` (`triggers/on-user-deleted.ts:12`) | **LOAD-BEARING (KEEP-UNTIL-MIGRATED)** — same; no v1 equivalent. Port both to sdk-v1 (or v2 blocking functions) before deleting.                                                                                                                                                                                      |

### B3. v1 (sdk-v1 codebase) non-callables — 25 functions, all **KEEP**

All are part of the intended end-state surface. Firestore triggers listen on
**v2\_-prefixed** patterns (prefix baked in at CLI discovery via
`prefixTriggerDocument()`, on-document.ts:74-85).

| Function                                   | Kind      | Path / schedule / queue                                                 | What it does                                                                                                                                                                                                                                                                                       |
| ------------------------------------------ | --------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `v1-identity-onMembershipWritten`          | trigger   | `v2_userMemberships/{id}` · written                                     | Single claim-sync writer (re-mint claims on membership change). ⚠ Was "dead-by-shape" (IDN-7: old registration watched nested `users/{uid}/memberships/{tid}` which nothing writes); now correctly on the flat root — `functions/sdk-v1/src/identity.ts:425-455`. Verify claim-sync fires in prod. |
| `v1-identity-onStudentArchived`            | trigger   | `v2_tenants/{t}/students/{id}` · updated                                | Roster projection reconcile (D7)                                                                                                                                                                                                                                                                   |
| `v1-identity-onClassArchived`              | trigger   | `v2_tenants/{t}/classes/{id}` · updated                                 | Detach students from archived class                                                                                                                                                                                                                                                                |
| `v1-identity-onTenantDeactivated`          | trigger   | `v2_tenants/{t}` · updated                                              | Outbox revoke fan-out                                                                                                                                                                                                                                                                              |
| `v1-identity-onAnnouncementPublished`      | trigger   | `v2_tenants/{t}/announcements/{id}` · written                           | Outbox notification fan-out                                                                                                                                                                                                                                                                        |
| `v1-autograde-onSubmissionCreated`         | trigger   | `v2_tenants/{t}/submissions/{s}` · created                              | Start grading pipeline (`_kind`-guarded)                                                                                                                                                                                                                                                           |
| `v1-autograde-onSubmissionUpdated`         | trigger   | same · updated                                                          | Single pipeline reducer re-drive                                                                                                                                                                                                                                                                   |
| `v1-autograde-onQuestionSubmissionUpdated` | trigger   | flat `v2_.../submissions/{s}` · updated, `_kind==='questionSubmission'` | Aggregate finalize check                                                                                                                                                                                                                                                                           |
| `v1-autograde-onExamPublished`             | trigger   | `v2_tenants/{t}/exams/{e}` · updated                                    | Outbox publish notification                                                                                                                                                                                                                                                                        |
| `v1-autograde-onResultsReleased`           | trigger   | same · updated                                                          | Results notification fan-out                                                                                                                                                                                                                                                                       |
| `v1-autograde-onExamDeleted`               | trigger   | same · deleted                                                          | Cascade delete (questions/submissions/analytics/DLQ)                                                                                                                                                                                                                                               |
| `v1-analytics-onSubmissionGraded`          | trigger   | `v2_tenants/{t}/submissions/{s}` · updated                              | Recompute autograde section + enqueue rollup                                                                                                                                                                                                                                                       |
| `v1-analytics-onSpaceProgressUpdated`      | trigger   | `v2_tenants/{t}/spaceProgress/{p}` · written                            | Recompute levelup section + leaderboard diff                                                                                                                                                                                                                                                       |
| `v1-analytics-onExamResultsReleased`       | trigger   | `v2_tenants/{t}/exams/{e}` · updated                                    | Exam analytics + outbox notification                                                                                                                                                                                                                                                               |
| `v1-autograde-advancePipeline`             | taskQueue | queue `grading-pipeline`                                                | Single-writer pipeline reducer (maxAttempts 5, backoff 10s, 6 concurrent)                                                                                                                                                                                                                          |
| `v1-analytics-recomputeStudentRollup`      | taskQueue | queue `student-rollup`                                                  | 4-writer rollup fan-out collapse                                                                                                                                                                                                                                                                   |
| `v1-identity-tenantLifecycleCheck`         | scheduled | every day 00:00                                                         | Trial/past-due sweep (v2_tenants)                                                                                                                                                                                                                                                                  |
| `v1-identity-monthlyUsageReset`            | scheduled | `0 0 1 * *`                                                             | Zero monthly counters                                                                                                                                                                                                                                                                              |
| `v1-identity-cleanupExpiredExports`        | scheduled | every 30 min                                                            | Export TTL purge                                                                                                                                                                                                                                                                                   |
| `v1-levelup-expireTestSessions`            | scheduled | every 5 min                                                             | Expire+grade past-deadline sessions                                                                                                                                                                                                                                                                |
| `v1-levelup-cleanupStaleSessions`          | scheduled | hourly                                                                  | Abandon >24h in_progress sessions                                                                                                                                                                                                                                                                  |
| `v1-autograde-staleSubmissionWatchdog`     | scheduled | every 15 min                                                            | Re-drive stuck submissions → DLQ                                                                                                                                                                                                                                                                   |
| `v1-analytics-dailyCostAggregation`        | scheduled | `5 0 * * *`                                                             | LLM cost roll-up + budget alert                                                                                                                                                                                                                                                                    |
| `v1-analytics-nightlyAtRiskDetection`      | scheduled | `0 2 * * *`                                                             | At-risk flagging                                                                                                                                                                                                                                                                                   |
| `v1-analytics-generateInsights`            | scheduled | `30 2 * * *`                                                            | Per-student insights (5-active cap)                                                                                                                                                                                                                                                                |

No storage or auth triggers exist in sdk-v1 source (confirmed by search);
nothing non-callable in source is undeployed. Defined-but-unwired:
`outbox-drain` queue constant has no deployed handler.

### B4. Verdict summary & recommended ordering

| Verdict                          | Count | Functions                                                                                                                                                                                                                   |
| -------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **KEEP** (v1 surface)            | 25    | all `v1-*` non-callables (B3)                                                                                                                                                                                               |
| **SAFE-TO-DELETE**               | 6     | `onClassDeleted`, `onStudentDeleted` (orphan https stubs), `onAnswerSheetUpload`, `onQuestionPaperUpload` (**delete first — active collision**), `onProgressMilestone`, `cleanupInactiveChats` (port sweep to v1 if wanted) |
| **LOAD-BEARING-FOR-LEGACY-DATA** | 7     | `onUserCreated`, `onUserDeleted` (auth — keep-until-migrated, no v1 equivalent), `onClassArchived`, `onStudentArchived`, `onTenantDeactivated`, `onExamDeleted`, `onSpaceDeleted`                                           |
| **SUPERSEDED-BY-V1**             | 21    | remaining legacy schedulers + firestore triggers (B2)                                                                                                                                                                       |

Recommended deletion order:

1. **Now**: the 2 storage triggers (collision hazard) + 2 https stubs +
   `tenantLifecycleCheck`/`monthlyUsageReset` (stop mutating unmigrated real
   tenant docs) — note the last two are formally SUPERSEDED but hazard-flagged.
2. **With the legacy-callable purge**: the 21 SUPERSEDED-BY-V1 functions (their
   only remaining event sources are legacy callables), plus
   `onProgressMilestone`/`cleanupInactiveChats`.
3. **After SUB001/CHAITANY data migration (or freeze)**: the 5 Firestore
   LOAD-BEARING triggers — decide deliberately whether cascade triggers
   (`onExamDeleted`, `onSpaceDeleted`) should stay alive DURING the legacy-data
   purge to auto-cascade, or be removed first with a manual recursive delete
   instead.
4. **Last**: auth triggers, only after porting user-create/delete handling into
   sdk-v1 (and deciding unprefixed-vs-v2\_ `/users` writer semantics).

Deletion caveat (DEP-1/TRAIN-1 gotchas): use pinned CLI 13.35.1; deleting
functions of a changed trigger type requires delete-first; codebase-scoped
deploys only manage their own codebase's functions.
