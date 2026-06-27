# Domain Model — Status Report

**Scope:** `packages/shared-types/src/**` (the domain-model source of truth),
cross-referenced with `firestore.rules`, `firestore.indexes.json`,
`docs/domain-glossary.md`, and `docs/DOMAIN_SQL_MODEL.md`.

**Verdict in one line:** The domain model is genuinely strong — well-organized
by bounded context, with branded IDs, a unified content/rubric/evaluation core
shared across both products, and Zod schemas with compile-time drift assertions.
The main debt is structural Firestore-isms (dual-write FK arrays,
`Record<string,X>` maps used as relations, composite-key documents,
duplicate/legacy collection paths) plus several **silent schema-vs-interface
drifts** that the "compile-time assertion" mechanism does not actually catch.

---

## 1. What currently exists & how it's architected

`packages/shared-types/src` is a pure TypeScript package (no Firebase runtime
dependency — it ships a portable `FirestoreTimestamp` interface, see
`identity/user.ts:11`) that is the **single source of truth** for the platform's
domain. It is consumed by every app (`apps/*`) and every Cloud Function group
(`functions/*`).

It is organized into bounded-context folders, each with an `index.ts` barrel,
re-exported from the root `index.ts`:

| Area                                        | Folder              | Root export     |
| ------------------------------------------- | ------------------- | --------------- |
| Branded IDs                                 | `branded.ts`        | `index.ts:7-43` |
| Identity & multi-tenancy                    | `identity/`         | `index.ts:46`   |
| Tenant entities (people/classes)            | `tenant/`           | `index.ts:49`   |
| Shared content (items, rubrics, evaluation) | `content/`          | `index.ts:52`   |
| LevelUp (digital learning)                  | `levelup/`          | `index.ts:55`   |
| AutoGrade (physical-exam grading)           | `autograde/`        | `index.ts:58`   |
| Progress aggregation                        | `progress/`         | `index.ts:61`   |
| Notifications                               | `notification/`     | `index.ts:64`   |
| Gamification                                | `gamification/`     | `index.ts:67`   |
| Analytics (LLM/cost/health)                 | `analytics/`        | `index.ts:70`   |
| Constants (enums-as-const)                  | `constants/`        | `index.ts:73`   |
| Callable API contracts                      | `callable-types.ts` | `index.ts:76`   |
| Unified error model                         | `error-types.ts`    | `index.ts:79`   |
| Runtime type guards                         | `type-guards.ts`    | `index.ts:82`   |
| Zod runtime schemas                         | `schemas/`          | `index.ts:86`   |

**Two products, one core.** The headline architectural decision is that
**AutoGrade** (grading physical answer sheets via an OCR → scouting → AI-grading
pipeline) and **LevelUp** (digital interactive learning content) share a single
canonical content/grading core in `content/`:

- `UnifiedItem` (`content/item.ts:354`) — the content atom for LevelUp.
- `UnifiedRubric` (`content/rubric.ts:64`) — 4 scoring modes, used by
  `Space`/`StoryPoint`/`UnifiedItem` (LevelUp) **and** `Exam`/`ExamQuestion`
  (AutoGrade).
- `UnifiedEvaluationResult` (`content/evaluation.ts:28`) — the grading-output
  shape used by AutoGrade `QuestionSubmission.evaluation` and LevelUp
  `DigitalTestSession`.
- Cross-domain linkage is bidirectional: `UnifiedItem.linkedQuestionId`
  (`content/item.ts:387`) ↔ `ExamQuestion.linkedItemId`
  (`autograde/exam-question.ts:38`); `Exam.linkedSpaceId/linkedStoryPointId`
  (`autograde/exam.ts:54-56`).

**API contract layer.** `callable-types.ts` defines a deliberately consolidated
"upsert" API: one `save*` endpoint per entity, where absence of `id` = create
and presence of `id` = update (incl. status transitions). Each comment documents
which legacy endpoints it replaced (e.g. `SaveExamRequest`,
`callable-types.ts:392-425`, "replaces createExam, updateExam, publishExam,
releaseExamResults, linkExamToSpace"). `schemas/callable-schemas.ts` provides
the Zod request validators (40+ schemas).

**Runtime validation strategy.** `schemas/index.ts` defines Zod schemas for ~35
entities for use at Firestore read boundaries, plus a clever **compile-time
compatibility assertion block** (`schemas/index.ts:1319-1407`) of the form
`type _Assert = Interface extends SchemaType ? true : never`. Schemas use
`.passthrough()` so unknown fields survive.

---

## 2. Entities / schemas / collections / branded IDs / API

### 2.1 Branded ID types (`branded.ts`)

17 nominal types:
`TenantId, ClassId, StudentId, TeacherId, ParentId, SpaceId, StoryPointId, ItemId, ExamId, SubmissionId, UserId, SessionId, AgentId, AcademicSessionId, NotificationId, QuestionBankItemId`
plus `Brand<T,B>` helper (`branded.ts:20`). Factory casts `asTenantId(...)` etc.
(`branded.ts:76-91`).

### 2.2 Identity (`identity/`) → collection roots

- `UnifiedUser` (`identity/user.ts:43`) → `/users/{uid}`. Holds platform flags
  (`isSuperAdmin`), `activeTenantId`, and optional B2C `ConsumerProfile`
  (`identity/user.ts:32`) with `PurchaseRecord[]`.
- `Tenant` (`identity/tenant.ts:98`) → `/tenants/{tenantId}`. Large aggregate:
  `TenantSubscription`, `TenantFeatures` (9 feature flags incl.
  `scannerAppEnabled`), `TenantSettings` (Gemini key ref), `TenantStats`,
  `TenantBranding`, `TenantUsage`, `TenantOnboarding`, `TenantDeactivation`.
- `UserMembership` (`identity/membership.ts:92`) →
  `/userMemberships/{uid}_{tenantId}` (composite key). Role enum `TenantRole`
  (`identity/membership.ts:9`):
  superAdmin/tenantAdmin/teacher/student/parent/scanner/staff. Carries role-link
  IDs (teacherId/studentId/parentId/scannerId/staffId) and
  `TeacherPermissions`/`StaffPermissions`.
- `PlatformClaims` (`identity/claims.ts:15`) — JWT custom claims;
  `MAX_CLAIM_CLASS_IDS = 15` with a `classIdsOverflow` flag
  (`identity/claims.ts:9,24-25`) to stay under the 1 KB JWT cap.
- `TenantCodeIndex` (`identity/tenant-code.ts:9`) → `/tenantCodes/{code}`
  uniqueness index.

### 2.3 Tenant entities (`tenant/`)

`Class` (`/tenants/{t}/classes/{id}`), `Student` (`/students/{id}`), `Teacher`
(`/teachers/{id}`), `Parent` (`/parents/{id}`), `AcademicSession`
(`/academicSessions/{id}`). All carry `tenantId`, lifecycle
`status: 'active'|'archived'`, and cross-link via FK arrays
(`Class.studentIds`/`teacherIds`, `Student.classIds`/`parentIds`, etc.).

### 2.4 Shared content (`content/`)

- `UnifiedItem` (`content/item.ts:354`): `type: ItemType` (7 types —
  question/material/interactive/assessment/discussion/project/checkpoint) +
  discriminated `payload: ItemPayload`. **15 question subtypes**
  (`QuestionType`, `content/item.ts:29`) with per-type data shapes (MCQ, MCAQ,
  true-false, numerical, text, paragraph, code+testcases, fill-blanks,
  fill-blanks-dd, matching, jumbled, audio, image_evaluation, group-options,
  chat_agent_question). **7 material subtypes** incl. `rich` block content.
  `AUTO_EVALUATABLE_TYPES` / `AI_EVALUATABLE_TYPES` partition
  (`content/item.ts:47-55`).
- `UnifiedRubric` (`content/rubric.ts:64`): `scoringMode` ∈
  criteria_based/dimension_based/holistic/hybrid; `RubricCriterion`,
  `EvaluationDimension` (RELMS model with weight/priority/promptGuidance).
  Inheritance chain (per docstring): tenant→space→storyPoint→item (LevelUp) and
  tenant→exam→question (AutoGrade).
- `UnifiedEvaluationResult` (`content/evaluation.ts:28`):
  score/maxScore/correctness/percentage, `structuredFeedback` keyed by
  dimension, strengths/weaknesses/missingConcepts, rubric breakdown,
  `mistakeClassification`, token+cost tracking.
- `ItemMetadata` / `ItemAnalytics` (`content/item-metadata.ts`): rich
  educational dimensions, PYQ info, `MigrationSource`.
- `RubricPreset` (`content/rubric-preset.ts:20`) →
  `/tenants/{t}/rubricPresets/{id}`.

### 2.5 LevelUp (`levelup/`)

- `Space` (`levelup/space.ts:24`) → `/tenants/{t}/spaces/{id}`. Types
  learning/practice/assessment/resource/hybrid; `accessType`
  class_assigned/tenant_wide/public_store; B2C store fields
  (price/currency/publishedToStore); `ratingAggregate`; default rubric + default
  agent IDs.
- `ContentVersion` (`levelup/space.ts:90`) → `/spaces/{id}/versions/{id}`.
- `StoryPoint` (`levelup/story-point.ts:63`) → `/spaces/{id}/storyPoints/{id}`.
  Embedded `sections`, `AssessmentConfig` (incl. `AdaptiveConfig`,
  `AssessmentSchedule`, `RetryConfig`).
- `UnifiedItem` lives under storyPoints (see §4 path note).
- `Agent` (`levelup/agent.ts:18`) → `/spaces/{id}/agents/{id}`. tutor|evaluator.
- `DigitalTestSession` (`levelup/test-session.ts:63`) →
  `/tenants/{t}/digitalTestSessions/{id}`. 5-status question tracking,
  `submissions: Record<string,TestSubmission>`, adaptive state, `TestAnalytics`
  breakdowns.
- `SpaceProgress` (`levelup/progress.ts:133`) →
  `/tenants/{t}/spaceProgress/{userId}_{spaceId}` with `StoryPointProgressDoc`
  subcollection (`levelup/progress.ts:111`) holding
  `items: Record<string, ItemProgressEntry>` and capped `attempts` (max 20).
- `ChatSession` (`levelup/chat.ts:20`) → `/tenants/{t}/chatSessions/{id}` with
  embedded `messages: ChatMessage[]`.
- `QuestionBankItem` (`levelup/question-bank.ts:11`) →
  `/tenants/{t}/questionBank/{id}` (+ `QuestionBankFilter`).
- `AnswerKey` (`levelup/answer-key.ts:10`) → server-only
  `/spaces/{id}/storyPoints/{spId}/answerKeys/{itemId}`.
- `SpaceReview` (`levelup/space-review.ts:9`) →
  `/spaces/{id}/reviews/{userId}` + `SpaceRatingAggregate`.

### 2.6 AutoGrade (`autograde/`)

- `Exam` (`autograde/exam.ts:33`) → `/tenants/{t}/exams/{id}`;
  `ExamGradingConfig`, `ExamQuestionPaper`, lifecycle via `ExamStatus` (8
  states).
- `ExamQuestion` (`autograde/exam-question.ts:17`) →
  `/exams/{id}/questions/{id}`; `SubQuestion[]`, shared `UnifiedRubric`.
- `Submission` (`autograde/submission.ts:33`) → `/tenants/{t}/submissions/{id}`;
  `AnswerSheetData`, `ScoutingResult` (Panopticon routing map),
  `SubmissionSummary`, `pipelineStatus` (15 states).
- `QuestionSubmission` (`autograde/question-submission.ts:25`) →
  `/submissions/{id}/questionSubmissions/{id}`; `QuestionMapping`, shared
  `UnifiedEvaluationResult`, `ManualOverride`, `gradingStatus` (7 states).
- `EvaluationSettings` (`autograde/evaluation-settings.ts:34`) →
  `/tenants/{t}/evaluationSettings/{id}`; enabled `EvaluationDimension[]`,
  confidence config, usage quota.
- `GradingDeadLetterEntry` (`autograde/dead-letter.ts:13`) →
  `/tenants/{t}/gradingDeadLetter/{id}`.
- `ExamAnalytics` (`autograde/exam-analytics.ts:40`) →
  `/tenants/{t}/examAnalytics/{examId}`; score distribution, per-question
  difficulty/discrimination indices, class & topic breakdowns.

### 2.7 Progress (`progress/`)

- `StudentProgressSummary` (`progress/summary.ts:66`) →
  `/studentProgressSummaries/{studentId}`; merges `StudentAutogradeMetrics` +
  `StudentLevelupMetrics`, at-risk flags.
- `ClassProgressSummary` (`progress/summary.ts:99`) →
  `/classProgressSummaries/{classId}`.
- `DailyCostSummary` (`progress/analytics.ts:15`), `AtRiskDetectionResult`
  (`progress/analytics.ts:55`), `LearningInsight` (`progress/insight.ts:21`) →
  `/insights/{id}`.

### 2.8 Gamification (`gamification/achievement.ts`)

`Achievement`, `AchievementCriteria` (10 criteria types), `StudentAchievement`,
`StudentLevel` (XP/tier), `StudyGoal`, `StudySession`. Collections under
`/tenants/{t}/{achievements|studentAchievements|studentLevels|studyGoals}`.

### 2.9 Notification (`notification/`)

`Notification` (`notification/notification.ts:25`), `NotificationPreferences`
(`:48`), `NotificationRTDBState` (`:60`, lives in **RTDB** at
`/notifications/{tenantId}/{userId}` for live badge counts), and `Announcement`
(`notification/announcement.ts:6`) with platform|tenant scope.

### 2.10 Analytics (`analytics/`)

`LLMCallLog` (`/llmCallLogs/{id}`), `PlatformActivityLog`
(`/platformActivityLog/{id}` — platform root),
`HealthSnapshot`/`HealthHistoryResponse`.

### 2.11 Constants (`constants/grades.ts`)

`GRADE_THRESHOLDS`, `BLOOMS_LEVELS`, `SUBMISSION_PIPELINE_STATUSES` (15),
`QUESTION_GRADING_STATUSES` (7), `EXAM_STATUSES` (8) — all `as const` arrays
with derived union types.

### 2.12 API surface (`callable-types.ts` + `schemas/callable-schemas.ts`)

Save-pattern endpoints:
`saveTenant/saveClass/saveStudent/saveTeacher/saveParent/saveAcademicSession/saveStaff/saveSpace/saveStoryPoint/saveItem/saveExam/saveQuestionBankItem/saveSpaceReview/saveRubricPreset/saveGlobalPreset/saveAnnouncement`.
Action/process endpoints: `manageNotifications`, `gradeQuestion`
(manual|retry|ai), `extractQuestions`, `uploadAnswerSheets`, `startTestSession`,
`submitTestSession`, `evaluateAnswer`, `sendChatMessage`, `recordItemAttempt`,
`getSummary` (student|class|platform|health), `generateReport`,
`bulkImportTeachers/Students`, `createOrgUser`, `switchActiveTenant`,
`joinTenant`, `rolloverSession`, `bulkUpdateStatus`, `exportTenantData`,
`deactivate/reactivateTenant`, `uploadTenantAsset`, `searchUsers`,
`listStoreSpaces`, `purchaseSpace`, `importFromBank`. Unified errors in
`error-types.ts` with `AppErrorCode`↔HTTPS bidirectional maps and `RATE_LIMITS`
tiers (WRITE/READ/AI/AUTH/REPORT).

### 2.13 Implied Firestore collection tree (confirmed in `firestore.rules`)

```
/users/{uid}
/userMemberships/{uid_tenantId}
/tenantCodes/{code}
/scanners/{scannerId}
/platformActivityLog/{id}
/globalEvaluationPresets/{id}
/tenants/platform_public/spaces/{id}          (B2C store mirror)
/tenants/{tenantId}/
    students, teachers, parents, classes, staff, academicSessions
    spaces/{spaceId}/storyPoints/{spId}/items/{id}/...   (canonical)
    spaces/{spaceId}/items/{id}                          (LEGACY duplicate path — rules:321)
    spaces/{spaceId}/{storyPoints|items}/answerKeys/{id}
    spaces/{spaceId}/agents, reviews, versions
    exams/{examId}/questions/{id}
    submissions/{submissionId}/questionSubmissions/{id}
    spaceProgress/{userId_spaceId}/storyPointProgress/{id}
    progress/{id}                 (LEGACY — rules:474)
    testSessions/{id}             (LEGACY — rules:491)
    digitalTestSessions/{id}      (current — rules:510)
    chatSessions, evaluationSettings, llmCallLogs, auditLogs,
    notifications, notificationPreferences, examAnalytics,
    studentProgressSummaries, classProgressSummaries, insights,
    rubricPresets, questionBank, gradingDeadLetter,
    achievements, studentAchievements, studentLevels, studyGoals
```

---

## 3. Strengths worth keeping

1. **Bounded-context organization is excellent** — small single-responsibility
   files, barrel exports, clear module docstrings naming the Firestore path on
   each entity. This should survive verbatim.
2. **Branded IDs** (`branded.ts`) give nominal type safety at app boundaries — a
   genuinely good pattern. Keep.
3. **Unified content/rubric/evaluation core** is the platform's best idea:
   `UnifiedRubric`/`UnifiedEvaluationResult`/`UnifiedItem` shared by both
   products avoids two parallel grading models. Keep and double down.
4. **Enums as `as const` arrays** (`constants/grades.ts`) — single source for
   both the runtime list and the derived type. Keep.
5. **Unified error model** (`error-types.ts`) with bidirectional code maps,
   user-facing messages, recovery hints, and rate-limit tiers — directly
   reusable by a REST/RN client. Keep.
6. **Consolidated upsert API** (`callable-types.ts`) — collapsing ~5 CRUD
   endpoints into one `save*` per entity is a clean contract and maps naturally
   onto REST `PUT`. Keep the philosophy.
7. **Zod schemas + compile-time drift assertions** (`schemas/index.ts:1319`) —
   the _intent_ is exactly right (validate at trust boundaries; fail build on
   drift). Keep the mechanism but fix its gaps (§4).
8. **Two-tier progress storage** (space-level summary + storyPoint
   subcollection) is a thoughtful read-optimization. The _concept_ is keepable.
9. **The SQL target spec already exists** (`docs/DOMAIN_SQL_MODEL.md`) — a 53–70
   table normalized model with ERD, junction tables, and an honest runtime
   trade-off analysis. This is a major head-start for a rebuild and should be
   treated as the migration target.

---

## 4. Pain points / tech debt / inconsistencies

**A. Schema-vs-interface drift that the assertion block does NOT catch.**
Because all schemas use `.passthrough()` and the assertions are
`Interface extends SchemaType` (one direction only), several schemas have _wrong
field names/types_ that compile clean:

- `ChatMessageSchema` (`schemas/index.ts:446`): `timestamp` typed as
  `FirestoreTimestampSchema` and `tokensUsed: z.number()`, but the interface
  (`levelup/chat.ts:11-18`) has `timestamp: string` and
  `tokensUsed: {input,output}`.
- `AgentSchema` (`schemas/index.ts:428`): declares `systemPrompt` required +
  `rules: z.array(z.string())` + `isActive`, but the interface
  (`levelup/agent.ts`) has `systemPrompt?` optional, `rules?: string` (a single
  string, not array), and **no `isActive` field at all**.
- `DigitalTestSessionSchema` (`schemas/index.ts:472`): uses `type`/`deadline`
  but the interface (`levelup/test-session.ts`) uses
  `sessionType`/`serverDeadline`.
- `NotificationSchema` (`schemas/index.ts:493`): uses `recipientUid`, but the
  interface (`notification/notification.ts:28`) uses `recipientId`.
- `SubmissionSchema.answerSheets.uploadSource` (`schemas/index.ts:282`) allows
  `'gcs'` which is not in the `AnswerSheetData` union
  (`autograde/submission.ts:15`, only web|scanner). These are latent runtime
  parse failures (or silent data loss via passthrough). The assertion harness
  gives false confidence.

**B. Duplicate / legacy collection paths.** `firestore.rules` shows three
coexisting generations:

- Items at BOTH `/spaces/{id}/storyPoints/{spId}/items` (rules:296, the
  canonical path the glossary documents) **and** `/spaces/{id}/items`
  (rules:321).
- Test sessions at `/testSessions` (rules:491, legacy) **and**
  `/digitalTestSessions` (rules:510, current).
- Progress at `/progress` (rules:474, legacy) **and** `/spaceProgress`
  (rules:439, current). The domain types only model the current paths, so the
  legacy ones are undocumented dark data. `firestore.indexes.json` still indexes
  `items`, `testSessions`, AND `progress` collection groups — confirming both
  are live.

**C. Dual-write FK arrays with no integrity guarantee.** `Class.studentIds` ↔
`Student.classIds`, `Class.teacherIds` ↔ `Teacher.classIds`, `Parent.studentIds`
↔ `Student.parentIds`, `Space.classIds`/`teacherIds`. Every membership change is
two writes that can drift; there is no junction collection.
(`DOMAIN_SQL_MODEL.md` §10.1 flags this as the #1 win of normalization.)

**D. `Record<string, X>` maps used as relations.** `SpaceProgress.storyPoints`,
`StoryPointProgressDoc.items`,
`DigitalTestSession.submissions`/`visitedQuestions`/`markedForReview`,
`Notification`/`DailyCostSummary.byPurpose/byModel`,
`ExamAnalytics.questionAnalytics/classBreakdown/topicPerformance`. These are
unqueryable, unbounded, and force whole-doc reads/writes. The `items` map also
risks the 1 MB Firestore doc cap on large story points.

**E. Composite-key documents.** `UserMembership` id = `{uid}_{tenantId}`,
`SpaceProgress` id = `{userId}_{spaceId}`. Works, but encodes relationship
semantics in a string key, complicates lookups, and is fragile if IDs ever
contain separators.

**F. `deleted`/soft-delete inconsistency.** Most entities use
`status: 'active'|'archived'`. But callable requests introduce a
`deleted: boolean` soft-delete (`saveStoryPoint`/`saveItem`,
`callable-types.ts:350,384`) and `SaveClassRequest.data.status` adds a third
`'deleted'` value (`callable-types.ts:79`) not present in the `Class` interface
union. Three different delete conventions.

**G. Deprecated fields carried forward.** `Teacher.uid`/`Parent.uid` deprecated
in favor of `authUid` (`tenant/teacher.ts:12`, `tenant/parent.ts:17`);
`Parent.childStudentIds` deprecated for `studentIds`;
`Tenant.logoUrl`/`bannerUrl` deprecated for `branding.*`. Yet
`SaveParentRequest.data` still uses `childStudentIds` (`callable-types.ts:135`),
perpetuating the deprecated name through the live API.

**H. `FirestoreTimestamp` leaks the storage engine into the domain.** Every
entity's timestamps are a Firestore-shaped `{seconds,nanoseconds}` object
(`identity/user.ts:11`). This is portable across Firebase SDKs but is _not_ a
clean domain primitive — it bakes a Firestore assumption into a layer that an RN
app or a REST client must also adopt. Progress entities mix this with raw
epoch-millis `number` fields (`ItemProgressEntry.lastUpdatedAt`,
`AttemptRecord.timestamp`) — two timestamp conventions in one model.

**I. `Tenant` is a god-aggregate.** 8 nested sub-objects + 4 deprecated
top-level fields on one document (`identity/tenant.ts:98-135`). Stats/usage are
denormalized counters that can drift.

**J. Branded IDs evaporate inside the model.** Every entity field that _is_ an
ID is typed as plain `string` (e.g. `Space.tenantId: string`,
`UnifiedItem.spaceId: string`), so the branded types only exist at function
signatures, never on the persisted shapes. The safety is opt-in and mostly
unused.

**K. Minor:** `asNotificationId`/`asQuestionBankItemId` factories exist
(`branded.ts:90-91`) but are not exported from `index.ts` (only the types are).
`RubricPreset`/`ContentVersion`/`StudyGoal`/`StudySession`/`Announcement`/`PlatformActivityLog`/`HealthSnapshot`
have **no Zod schema** and no drift assertion — validation coverage is partial.

---

## 5. Recommendations for a fresh rebuild

The core domain concepts are sound and should be preserved verbatim — the work
is structural and validation hygiene, not re-conceptualization.

1. **Keep the bounded-context layout and the Unified core.** `UnifiedItem` /
   `UnifiedRubric` / `UnifiedEvaluationResult`, the 7×15×7 content taxonomy,
   branded IDs, the `as const` enums, and the unified error model all carry
   forward unchanged.

2. **Adopt the existing SQL target model** (`docs/DOMAIN_SQL_MODEL.md`). It
   already resolves pains C/D/E: FK arrays → junction tables (`class_students`,
   `space_classes`, `parent_students`), `Record<string,X>` maps → child tables
   (`story_point_progress`, `item_progress`, `test_session_submissions`),
   composite keys → surrogate PK + unique constraint, soft-delete →
   `archived_at TIMESTAMPTZ NULL`. Use UUID v7 (sortable) for IDs and keep the
   `Brand<>` types at the app layer.

3. **Make Zod the single source of truth, derive types from schemas.** Invert
   the current relationship: define `z` schemas, then
   `export type X = z.infer<typeof XSchema>`. This _structurally eliminates_ the
   drift class in pain A (a schema and its type can never disagree because the
   type is generated). Drop the brittle `extends ... ? true : never` assertion
   block and the manual `interface` duplicates. (See the `zod-schema-validation`
   skill.)

4. **Define a transport-neutral timestamp.** Replace `FirestoreTimestamp` with
   ISO-8601 strings (or epoch-millis `number`) at the domain boundary and adapt
   at the storage edge. This is mandatory for a common REST/JSON API layer and
   React Native clients — neither should depend on a Firestore Timestamp shape.
   Pick ONE convention and remove the epoch-millis/Timestamp split in progress
   types.

5. **Split the API contract into a transport-agnostic package.**
   `callable-types.ts` + `error-types.ts` + the request Zod schemas are already
   90% of a REST contract. Extract a `@levelup/api-contract` package that the
   web apps, a new REST/RPC layer, and future RN apps all import. Keep the
   `save*` upsert philosophy (maps cleanly to `PUT /resource/{id}` and
   `POST /resource`). Consider generating an OpenAPI spec from the Zod
   request/response schemas so the RN client can codegen.

6. **One delete convention.** Standardize on `archived_at` (SQL) / `status`
   lifecycle. Remove the `deleted: boolean` request flag and the stray
   `'deleted'` status value (pains F).

7. **Retire legacy/duplicate paths before migrating.** Reconcile `/items` vs
   `/storyPoints/.../items`, `/testSessions` vs `/digitalTestSessions`,
   `/progress` vs `/spaceProgress` (pain B). The rebuild is the moment to drop
   the legacy generation rather than carry three layers of dark data forward.

8. **Drop deprecated field names at the contract boundary** (pain G/H):
   `authUid` only, `studentIds` only, `branding.*` only. Don't let the rebuilt
   API expose `uid`/`childStudentIds`/top-level `logoUrl`.

9. **Move denormalized aggregates to derived/materialized state.**
   `Tenant.stats/usage`, `Space.stats`, `Space.ratingAggregate`, summary
   collections → materialized views / trigger-maintained tables so they cannot
   silently drift (pain D/I).

10. **Complete validation coverage.** Every persisted entity gets a schema
    (close the gaps in pain K: `RubricPreset`, `ContentVersion`, gamification
    entities, `Announcement`, analytics logs). Export every ID factory from the
    package root.

11. **Plan the real-time story explicitly.** If leaving Firestore, the ~4
    features that need live updates (test-session deadline, chat streaming,
    notification badges, grading status) need a deliberate replacement
    (WebSocket/SSE or a managed realtime layer) — `DOMAIN_SQL_MODEL.md` §10.2
    already enumerates these. For RN, decide the offline strategy up front.
