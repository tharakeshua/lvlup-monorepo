# LevelUp + Content — Vertical-Slice SDK/Server Plan

> **Domain key:** `levelup-content` **Owns:** spaces · storyPoints · items (+
> AnswerKeys, server-only) · agents · question bank · rubric presets · test
> sessions · learning progress · AI tutor chat · B2C store/reviews/purchases ·
> content versions. **Trust model:** LEAN UI + LEAN-AUTHORITATIVE SERVER + FAT
> SDK. Logic lives once in `@levelup/services`; callables/triggers/schedulers
> are thin shells. No direct Firestore except the server repository admin
> adapter. `tenantId` is **claim-derived, never in any request body**.
>
> Grounded in: `status/be-levelup.md`, `status/REVIEW-domain-data-model.md`,
> `specs/common-api.md` (§3.3 levelup inventory), `specs/SDK-SERVER-DESIGN.md`,
> and the live types under `packages/shared-types/src/{levelup,content}`.

---

## Domain entities (`@levelup/domain`)

All entities are **Zod-first**, authored as `z.object({...}).strict()`, type via
`z.infer`. All persisted ID fields use **branded IDs**. All timestamps are
**ISO-8601 string** `Timestamp` (kills the `FirestoreTimestamp`/epoch/ISO
trichotomy — REVIEW D4). Edge adapters in the server repo convert Firestore
`Timestamp` ↔ ISO on read/write.

### Branded IDs (this domain)

`SpaceId`, `StoryPointId`, `SectionId`, `ItemId`, `AnswerKeyId`, `AgentId`,
`RubricPresetId`, `QuestionBankItemId`, `TestSessionId`, `SpaceProgressId`
(`{userId}_{spaceId}`), `ChatSessionId`, `ChatMessageId`, `SpaceReviewId`,
`ContentVersionId`, `PurchaseId`. (REVIEW §4 — brands must survive inside
persisted shapes, not evaporate at function signatures.)

### Shared content core (consumed by autograde too — single shape, no fork)

- **`UnifiedRubricSchema`** — `scoringMode: RubricScoringMode` enum
  (`criteria_based|dimension_based|holistic|hybrid`);
  `criteria?: RubricCriterion[]`, `dimensions?: EvaluationDimension[]`,
  `holisticGuidance?`, `holisticMaxScore?`, `passingPercentage?`,
  `showModelAnswer?`, **`modelAnswer?` + `evaluatorGuidance?` (⚷ authoring-only,
  server projects out for non-authoring roles)**. Sub-schemas:
  `RubricCriterionSchema` (+ `RubricCriterionLevelSchema`),
  `EvaluationDimensionSchema` (`priority: HIGH|MEDIUM|LOW`, `promptGuidance` ⚷,
  `weight`, `scoringScale`).
- **`UnifiedEvaluationResultSchema`** — `score`, `maxScore`, `correctness`,
  `percentage`, `structuredFeedback?: Record<string, FeedbackItem[]>`,
  `strengths/weaknesses/missingConcepts: string[]`, `rubricBreakdown?`,
  `summary?`, `confidence`, `mistakeClassification?` enum, `tokensUsed?`,
  `costUsd?` (⚷), `evaluationRubricId?`, `dimensionsUsed?`,
  `gradedAt: Timestamp`. **Server-authoritative output** (REVIEW §6.5).
  Sub-schemas `FeedbackItemSchema` (`severity: critical|major|minor`),
  `RubricBreakdownItemSchema`.
- **`ItemMetadataSchema`** — `totalPoints?`, `maxMarks?`, `estimatedTime?`,
  `learningObjectives?`, `skillsAssessed?`, `bloomsLevel?`, `prerequisites?`,
  `isRetriable?`, `evaluatorAgentId?`, `pyqInfo?: PyqInfo[]`, `featured?`,
  `viewCount?`, `successRate?`, `migrationSource?`. `ItemAnalyticsSchema` —
  multi-dimensional (difficulty, topics, cognitiveLoad, conceptImportance, …).

### LevelUp entities

- **`SpaceSchema`** — `id: SpaceId`, `tenantId: TenantId`, `title`,
  `description?`, `thumbnailUrl?`, `slug?`, `type: SpaceType`
  (`learning|practice|assessment|resource|hybrid`), `subject?`, `labels?`,
  `classIds: ClassId[]`, `sectionIds?`, `teacherIds: UserId[]`,
  `accessType: SpaceAccessType` (`class_assigned|tenant_wide|public_store`),
  `academicSessionId?`, `defaultEvaluatorAgentId?: AgentId`,
  `defaultTutorAgentId?: AgentId`, assessment defaults,
  **`defaultRubric?: UnifiedRubric` + `defaultRubricId?: RubricPresetId`**
  (embed-resolved snapshot + source id — REVIEW open-Q resolution), store fields
  (`price?`, `currency?`, `publishedToStore?`, `storeDescription?`,
  `storeThumbnailUrl?`), **lifecycle** `status: SpaceStatus`
  (`draft|published|archived`), `publishedAt?: Timestamp`,
  `archivedAt?: Timestamp` (REVIEW D5 — single `archivedAt`),
  `stats?: SpaceStats` (⚷ denormalized),
  `ratingAggregate?: SpaceRatingAggregate` (⚷), `version?`, audit
  (`createdBy: UserId`, `createdAt`, `updatedAt`).
  - **`ALLOWED_TRANSITIONS.space`** (build-time-checked data):
    `draft → [published]`, `published → [archived, draft]`,
    `archived → [draft]`. Union members validated against the `SpaceStatus`
    `as const` enum (REVIEW open-Q / top-risk #5).
- **`StoryPointSchema`** — `id: StoryPointId`, `spaceId: SpaceId`, `tenantId`,
  `title`, `description?`, `orderIndex`, `type: StoryPointType`. **DRIFT FIX
  (be-levelup §4.2):** collapse `StoryPointType` to
  `standard|timed_test|quiz|practice` — **drop the synonym `test`** (migrate
  `test`→`timed_test`). `sections: StoryPointSection[]`,
  `assessmentConfig?: AssessmentConfig` (durationMinutes, maxAttempts, shuffle,
  passingPercentage, `adaptiveConfig?`, `schedule?`, `retryConfig?`),
  **`defaultRubric?: UnifiedRubric` + `defaultRubricId?`**, `difficulty?`,
  `estimatedTimeMinutes?`, `stats?: StoryPointStats` (⚷), audit.
- **`UnifiedItemSchema`** — `id: ItemId`, `spaceId`,
  `storyPointId: StoryPointId`, `sectionId?: SectionId`, `tenantId`,
  `type: ItemType` (7:
  `question|material|interactive|assessment|discussion|project|checkpoint`),
  **`payload: ItemPayload` as a REAL `z.discriminatedUnion`** (REVIEW top-risk
  #3 / be-levelup §4.3) — the most important content-core fix. Top-level
  discriminant `type`; nested `payload.questionType` (15 `QuestionType`s) /
  `payload.materialType` (7) / `interactiveType` / `assessmentType`. Each of the
  15 question payloads (`MCQData`…`ChatAgentQuestionData`) gets its own
  `.strict()` member schema. `title?`, `content?`, `difficulty?`, `topics?`,
  `labels?`, `orderIndex`, `meta?: ItemMetadata`, `analytics?: ItemAnalytics`,
  **`rubric?: UnifiedRubric` (resolved snapshot) + `rubricId?: RubricPresetId`**
  (REVIEW §2 / open-Q), `linkedQuestionId?: ExamQuestionId` (cross-domain),
  `attachments?: ItemAttachment[]`, `version?`, audit.
  - **Note:** answer-bearing fields inside payloads (`MCQOption.isCorrect`,
    `correctAnswer`, `modelAnswer`, `evaluationGuidance`, `correctOrder`,
    `correctItems`, …) are **stripped server-side into the AnswerKey** on save;
    the client never receives them through `getItem`/`listItems` (only via the
    role-gated `getItemForEdit`).
- **`AnswerKeySchema`** (⚷ **server-only**, deny-all rules) — `id: AnswerKeyId`,
  `itemId: ItemId`, `questionType: QuestionType`, `correctAnswer: unknown`,
  `acceptableAnswers?`, `evaluationGuidance? (⚷)`, `modelAnswer? (⚷)`, audit.
  Lives at `items/{itemId}/answerKeys/{keyId}` (be-levelup §4.6 — fix the stale
  docstring path). **Never** in any client-facing response schema.
- **`AgentSchema`** — `id: AgentId`, `spaceId`, `tenantId`, `type: AgentType`
  (`tutor|evaluator`), `name`, `identity`, tutor fields (`systemPrompt?`,
  `supportedLanguages?`, `defaultLanguage?`, `maxConversationTurns?`), evaluator
  fields (**`rules?` — DRIFT FIX (REVIEW D12): live type is single-string,
  schema expects array; standardize to `string[]`; add `isActive` field the
  schema referenced**), `evaluationObjectives?`, `strictness?`,
  `feedbackStyle?`, `modelOverride?`, `temperatureOverride?`, audit.
  (`systemPrompt`/`rules` are ⚷ — leak how to score; authoring-only.)
- **`RubricPresetSchema`** (no live schema — REVIEW §4 gap, ADD) —
  `id: RubricPresetId`, `tenantId`, `name`, `description?`,
  `rubric: UnifiedRubric`, `category: RubricPresetCategory`, `questionTypes?`,
  `isDefault: boolean`, audit.
- **`QuestionBankItemSchema`** — `id: QuestionBankItemId`, `tenantId`,
  `questionType`, `title?`, `content`, `explanation?`, `basePoints?`,
  `questionData: QuestionTypeData` (discriminated on `questionType`), `subject`,
  `topics`, `difficulty`, `bloomsLevel?`, `usageCount` (⚷ counter),
  `averageScore?` (⚷), `lastUsedAt?`, `tags`, audit.
- **`DigitalTestSessionSchema`** — `id: TestSessionId`, `tenantId`,
  `userId: UserId`, `spaceId`, `storyPointId`, **DRIFT FIX (REVIEW D12):
  standardize `sessionType` (not `type`) and `serverDeadline` (not `deadline`)**
  to match the live writer. `sessionType: TestSessionType`
  (`timed_test|quiz|practice`), `attemptNumber`, `status: TestSessionStatus`
  (`in_progress|completed|expired|abandoned`), **`isLatest` (⚷)**, timing
  (`startedAt`, `endedAt?`, `durationMinutes`, **`serverDeadline?` ⚷**),
  question tracking (`totalQuestions`, `answeredQuestions`, `questionOrder`),
  **5-status maps**
  `visitedQuestions`/`submissions: Record<string,TestSubmission>`/`markedForReview`
  (⚷ — REVIEW D6 1MB-doc risk; explode `submissions` to a `submissions/{itemId}`
  subcollection in the rebuild), scores (⚷
  `pointsEarned/totalPoints/marksEarned/totalMarks/percentage`),
  `sectionMapping?`, `lastVisitedIndex?`, adaptive state (`adaptiveState?`,
  `currentDifficultyLevel?`, `difficultyProgression?`),
  `analytics?: TestAnalytics` (⚷), audit. Sub-schemas: `TestSubmissionSchema`
  (`evaluation?: UnifiedEvaluationResult` ⚷), `TestAnalyticsSchema`,
  `AdaptiveStateSchema`.
  - **`ALLOWED_TRANSITIONS.testSession`** (build-time data):
    `in_progress → [completed, expired, abandoned]`; terminal states have no
    outgoing edges.
- **`SpaceProgressSchema`** — `id: SpaceProgressId`, `userId`, `tenantId`,
  `spaceId`, `status: ProgressStatus` (`not_started|in_progress|completed`),
  aggregate scores (⚷
  `pointsEarned/totalPoints/marksEarned?/totalMarks?/percentage`),
  **`storyPoints: Record<StoryPointId, StoryPointProgress>`** (⚷, REVIEW D6 —
  keep summary-only in parent doc), `startedAt?`, `completedAt?`, `updatedAt`.
  Sub-schemas: `StoryPointProgressSchema` (summary),
  `StoryPointProgressDocSchema` (subcollection,
  `items: Record<ItemId, ItemProgressEntry>`), `ItemProgressEntrySchema`,
  `QuestionProgressDataSchema`, `StoredEvaluationSchema`, `AttemptRecordSchema`.
  All progress writes are ⚷ server-authoritative.
- **`ChatSessionSchema`** — `id: ChatSessionId`, `tenantId`, `userId`,
  `spaceId`, `storyPointId`, `itemId`, `questionType?`, `agentId?`,
  `agentName?`, `sessionTitle`, `previewMessage`, `messageCount` (⚷ counter),
  `language`, `isActive`, `messages: ChatMessage[]` (or `messages/`
  subcollection), `systemPrompt (⚷)`, audit. `ChatMessageSchema` — `id`,
  `role: ChatMessageRole` (`user|assistant|system`), `text`,
  **`timestamp: Timestamp` (ISO — DRIFT FIX REVIEW D4/D12: live is string vs
  schema FirestoreTimestamp; unify ISO)**, `mediaUrls?`, `tokensUsed?` (⚷).
- **`SpaceReviewSchema`** — `id: SpaceReviewId`, `spaceId`, `tenantId`,
  `userId`, `userName?`, `rating: number` (1–5), `comment?`, audit.
  `SpaceRatingAggregateSchema` (⚷ denormalized on Space) — `averageRating`,
  `totalReviews`, `distribution: Record<number,number>`.
- **`ContentVersionSchema`** — `id: ContentVersionId`, `version`,
  `entityType: 'space'|'storyPoint'|'item'`, `entityId`,
  `changeType: 'created'|'updated'|'published'|'archived'`, `changeSummary`,
  `changedBy: UserId`, `changedAt: Timestamp`.
- **`StoreSpaceListingSchema`** (B2C, `tenants/platform_public/spaces/{id}`) —
  projection of Space with `sourceTenantId`, `price`, `currency`,
  `accessType: 'public_store'`, `storeDescription`, `storeThumbnailUrl`,
  `ratingAggregate?`. (⚷ written only by `saveSpace` store side-effect /
  trigger.)
- **`PurchaseRecordSchema`** — `id: PurchaseId`, `userId`, `spaceId`,
  `sourceTenantId`, `amount`, `currency`, `transactionId`, `gateway`,
  `status: 'completed'|'failed'|'pending'`, `purchasedAt`. (⚷ — written only by
  `purchaseSpace`; mirrors into
  `users/{uid}.consumerProfile.enrolledSpaceIds/purchaseHistory`.)

---

## API contract (`@levelup/api-contract`)

Every callable is a `CallableDef` with `name: 'v1.levelup.<op>'`,
`module: 'levelup'`, `.strict()` request/response schemas (**no `tenantId` field
— derived from claims**), `authMode`, `rateTier`, `idempotent?`,
`invalidates[]`. Save\* uses the upsert convention (`id?` absent = create,
present = update, `data.deleted=true` = delete).

### Writes / mutations

| name                              | request fields (no tenantId)                                                                     | response                                                                                                                   | authMode | rateTier   | idempotent | invalidates                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | -------- | ---------- | ---------- | --------------------------------------------------------------------------------------- |
| `v1.levelup.saveSpace`            | `id?`, `data: {title,type,…,status?,publishedToStore?,price?,…}`                                 | `SaveResponse{id,created}`                                                                                                 | authed   | write      | no         | `spaceKeys.all`, `storeKeys.all`                                                        |
| `v1.levelup.saveStoryPoint`       | `id?`, `spaceId`, `data{…,deleted?}`                                                             | `SaveResponse`                                                                                                             | authed   | write      | no         | `storyPointKeys.list(spaceId)`, `spaceKeys.detail(spaceId)`                             |
| `v1.levelup.saveItem`             | `id?`, `spaceId`, `storyPointId`, `data{type,payload(discriminated),meta?,rubricId?,…,deleted?}` | `SaveResponse`                                                                                                             | authed   | write      | no         | `itemKeys.list(spaceId,storyPointId)`, `storyPointKeys.detail`                          |
| `v1.levelup.importFromBank`       | `spaceId`, `storyPointId`, `bankItemIds[]`, `targetType?`                                        | `{createdItemIds: ItemId[]}`                                                                                               | authed   | write      | yes        | `itemKeys.list(...)`                                                                    |
| `v1.levelup.saveAgent`            | `id?`, `spaceId`, `data{type,…,deleted?}`                                                        | `SaveResponse`                                                                                                             | authed   | write      | no         | `agentKeys.list(spaceId)`                                                               |
| `v1.levelup.saveRubricPreset`     | `id?`, `data{name,rubric,category,…,deleted?}`                                                   | `SaveResponse \| {id,deleted}`                                                                                             | authed   | write      | no         | `rubricPresetKeys.all`                                                                  |
| `v1.levelup.saveQuestionBankItem` | `id?`, `data{questionType,questionData,…,deleted?}`                                              | `SaveResponse \| {id,deleted}`                                                                                             | authed   | write      | no         | `questionBankKeys.all`                                                                  |
| `v1.levelup.startTestSession`     | `spaceId`, `storyPointId`                                                                        | `{sessionId,startedAt,serverDeadline,questionOrder,totalQuestions,attemptNumber,sectionMapping,lastVisitedIndex,resuming}` | authed   | write      | yes        | `testSessionKeys.active(storyPointId)`, `progressKeys.space(spaceId)`                   |
| `v1.levelup.submitTestSession`    | `sessionId`, `submissions: Record<itemId,{answer,timeSpentSeconds}>`, `idempotencyKey`           | `{sessionId,status,scores{pointsEarned,totalPoints,percentage},pendingAiItemIds[],analytics?}`                             | authed   | write      | **yes**    | `testSessionKeys.detail`, `progressKeys.space(spaceId)`, `progressKeys.storyPoint(...)` |
| `v1.levelup.evaluateAnswer`       | `spaceId`, `storyPointId`, `itemId`, `answer`, `mode?: 'practice'\|'preview'`, `idempotencyKey?` | `{evaluation: UnifiedEvaluationResult, progressUpdated: boolean}`                                                          | authed   | ai         | **yes**    | `progressKeys.storyPoint(...)`                                                          |
| `v1.levelup.recordItemAttempt`    | `spaceId`, `storyPointId`, `itemId`, `answer`, `evaluationData?`, `timeSpent?`, `idempotencyKey` | `{progress: ItemProgressView}`                                                                                             | authed   | write      | **yes**    | `progressKeys.storyPoint(...)`, `progressKeys.space(spaceId)`                           |
| `v1.levelup.sendChatMessage`      | `sessionId?`, `spaceId`, `storyPointId`, `itemId`, `text`, `mediaUrls?`, `language?`             | `{sessionId, message: ChatMessage, tokensUsed?}` (concrete, not `unknown` — common-api)                                    | authed   | ai         | no         | `chatKeys.session(sessionId)`                                                           |
| `v1.levelup.saveSpaceReview`      | `spaceId`, `rating`, `comment?`                                                                  | `{success, isUpdate}`                                                                                                      | authed   | write      | no         | `reviewKeys.list(spaceId)`, `spaceKeys.detail(spaceId)`                                 |
| `v1.levelup.purchaseSpace`        | `spaceId`, `paymentToken?`, `idempotencyKey`                                                     | `{success, transactionId, enrolledSpaceId}`                                                                                | authed   | write      | **yes**    | `storeKeys.all`, `enrollmentKeys.mine`                                                  |
| `v1.levelup.manageNotifications`  | `action: 'list'\|'markRead'`, `notificationId?`, `cursor?`, `limit?`                             | discriminated on action                                                                                                    | authed   | read/write | no         | `notificationKeys.all`                                                                  |

### Reads (replace **all** direct Firestore reads in student/teacher/parent UI — common-api §3.3)

| name                               | request                                                                 | response                                                                                              | rateTier |
| ---------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------- |
| `v1.levelup.listSpaces`            | `PageRequest & SpaceFilter{status?,type?,classId?,subject?,teacherId?}` | `pageResponse(SpaceView)`                                                                             | read     |
| `v1.levelup.getSpace`              | `{spaceId}`                                                             | `SpaceView` (rubric snapshot only; `evaluatorGuidance`/`modelAnswer` projected out for non-authoring) | read     |
| `v1.levelup.listStoryPoints`       | `{spaceId}`                                                             | `{items: StoryPointView[]}`                                                                           | read     |
| `v1.levelup.listItems`             | `{spaceId, storyPointId}` & `PageRequest`                               | `pageResponse(ItemView)` (**answer-stripped**)                                                        | read     |
| `v1.levelup.getItemForEdit`        | `{spaceId, storyPointId, itemId}`                                       | `{item: ItemEditView}` (⚷ **re-merges AnswerKey — authoring roles only**)                             | read     |
| `v1.levelup.getSpaceProgress`      | `{spaceId, userId?}`                                                    | `SpaceProgressView`                                                                                   | read     |
| `v1.levelup.getStoryPointProgress` | `{spaceId, storyPointId, userId?}`                                      | `StoryPointProgressView` (per-item entries)                                                           | read     |
| `v1.levelup.getTestSession`        | `{sessionId}`                                                           | `TestSessionView` (answer-stripped while in_progress)                                                 | read     |
| `v1.levelup.listTestSessions`      | `{storyPointId?, spaceId?}` & `PageRequest`                             | `pageResponse(TestSessionSummaryView)`                                                                | read     |
| `v1.levelup.listVersions`          | `{spaceId}` & `PageRequest`                                             | `pageResponse(ContentVersion)`                                                                        | read     |
| `v1.levelup.listQuestionBank`      | `QuestionBankFilter & PageRequest`                                      | `pageResponse(QuestionBankItem)`                                                                      | read     |
| `v1.levelup.listRubricPresets`     | `{category?, questionType?}`                                            | `{items: RubricPreset[]}`                                                                             | read     |
| `v1.levelup.listAgents`            | `{spaceId}`                                                             | `{items: AgentView[]}` (prompts ⚷ stripped for non-authoring)                                         | read     |
| `v1.levelup.listStoreSpaces`       | `PageRequest & {subject?,search?}`                                      | `pageResponse(StoreSpaceListing)`                                                                     | read     |
| `v1.levelup.getStoreSpace`         | `{spaceId}`                                                             | `StoreSpaceListing`                                                                                   | read     |
| `v1.levelup.listSpaceReviews`      | `{spaceId}` & `PageRequest`                                             | `pageResponse(SpaceReview)`                                                                           | read     |
| `v1.levelup.listChatSessions`      | `{spaceId?, itemId?}` & `PageRequest`                                   | `pageResponse(ChatSessionSummary)`                                                                    | read     |
| `v1.levelup.getChatSession`        | `{sessionId}`                                                           | `ChatSessionView` (with messages)                                                                     | read     |

### SUBSCRIPTIONS (realtime registry)

| name                             | params        | payload                                                             |
| -------------------------------- | ------------- | ------------------------------------------------------------------- |
| `v1.levelup.testSessionDeadline` | `{sessionId}` | `TestSessionLiveSchema` (status, serverDeadline, answeredQuestions) |
| `v1.levelup.chatStream`          | `{sessionId}` | `ChatMessageSchema` (appended messages)                             |

---

## Repositories (`@levelup/repositories`) — the brain

Per-entity repos + cross-entity **view** repos. Own shaping, batching/N+1
collapse, cursor management, transition pre-checks, derived fields. No repo
imports another except declared view repos.

- **`spaceRepo`** — `list(filter?)` (cursor `paginate()`), `get(id)`,
  `save(input)`, `canTransition(from,to)` (reads `ALLOWED_TRANSITIONS.space` —
  UX only), `canPublish(space)` (derived: ≥1 storyPoint, ≥1 item, timed-test
  duration>0 — pre-check mirroring `validatePublish`), shaping: blend
  `ratingAggregate` + `stats` into `SpaceView`.
- **`storyPointRepo`** — `list(spaceId)`, `get(id)`, `save(input)`,
  `isAssessment(sp)` (derived: `type ∈ {timed_test,quiz,practice}` — the single
  helper replacing scattered `=== timed_test || === test` checks, be-levelup
  §4.4).
- **`itemRepo`** — `list(spaceId,storyPointId)` (paginate), `get(id)`
  (answer-stripped), `getForEdit(id)` (authoring-only; **isolated non-persisted
  cache key** so answer keys never leak into shared cache — SDK-SERVER §7.1.3),
  `save(input)` (client-side discriminated-union pre-validate before send),
  `importFromBank(bankIds)`.
- **`progressRepo`** (view-ish) — `getSpaceProgress(spaceId,userId?)`,
  `getStoryPointProgress(...)`, derived: completion %, best-vs-latest blend,
  "solved" rollups. Read-only from SDK (⚷ writes are server-side).
- **`testSessionRepo`** — `start(spaceId,storyPointId)`,
  `submit(sessionId,submissions)`, `get(sessionId)`, `listForStoryPoint(...)`,
  derived: `remainingSeconds(session, serverTimeOffset)`, `attemptStatus`.
  Cursor mgmt for history.
- **`evaluationRepo`** — `evaluate(input)` (single-answer practice eval; server
  persists progress), `recordAttempt(input)`.
- **`chatRepo`** — `listSessions(filter)`, `getSession(id)`, `send(input)`
  (append shaping), subscribes via `chatStream`.
- **`questionBankRepo`** — `list(filter)` (paginate), `save(input)`.
- **`rubricPresetRepo`** — `list(filter)`, `save(input)`, derived:
  `resolveEffectiveRubric(item,storyPoint,space)` (client-side preview of the
  tenant→space→storyPoint→item chain; server is authoritative at save).
- **`agentRepo`** — `list(spaceId)`, `save(input)`.
- **`storeRepo`** — `listStoreSpaces(filter)`, `getStoreSpace(id)`,
  `purchase(spaceId)`, `listReviews(spaceId)`, `saveReview(input)`. **N+1
  collapse:** batches review aggregates server-side (REVIEW §1.2 fat-SDK shaping
  rationale).
- **`versionRepo`** — `list(spaceId)`.
- **`spaceDetailViewRepo`** (cross-entity **view**) — assembles
  `{space, storyPoints, itemsByStoryPoint, myProgress}` in one shaped view for
  the learner/editor dashboard, collapsing what is today a `listStoryPoints` +
  N×`listItems` + `getSpaceProgress` fan-out into one batched repo call
  (SDK-SERVER §1.2 (b)).

---

## Query hooks (`@levelup/query`)

Query-key factories: `spaceKeys`, `storyPointKeys`, `itemKeys`, `progressKeys`,
`testSessionKeys`, `chatKeys`, `questionBankKeys`, `rubricPresetKeys`,
`agentKeys`, `storeKeys`, `reviewKeys`, `versionKeys`, `enrollmentKeys`. Each:
`all`, `list(filter)`, `detail(id)` — narrowest-correct invalidation.

**Read hooks:** `useSpaces(filter)`, `useSpace(id)`, `useStoryPoints(spaceId)`,
`useItems(spaceId,spId)`, `useItemForEdit(id)` (non-persisted cache),
`useSpaceProgress(spaceId)`, `useStoryPointProgress(...)`, `useTestSession(id)`,
`useTestSessions(filter)`, `useVersions(spaceId)`, `useQuestionBank(filter)`,
`useRubricPresets(filter)`, `useAgents(spaceId)`, `useStoreSpaces(filter)`,
`useStoreSpace(id)`, `useSpaceReviews(spaceId)`, `useChatSessions(filter)`,
`useChatSession(id)`, `useSpaceDetailView(spaceId)`.

**Mutation hooks:** `useSaveSpace`, `useSaveStoryPoint`, `useSaveItem`,
`useImportFromBank`, `useSaveAgent`, `useSaveRubricPreset`,
`useSaveQuestionBankItem`, `useStartTestSession`, `useSubmitTestSession`,
`useEvaluateAnswer`, `useRecordItemAttempt`, `useSendChatMessage`,
`useSaveSpaceReview`, `usePurchaseSpace`, `useManageNotifications`.

**Subscription hooks:** `useTestSessionDeadline(sessionId)`,
`useChatStream(sessionId)`, plus a thin `useServerTime()` over the
`/serverTimeOffset` doc (SDK-SERVER §7.1.1).

**Conservative optimistic allow-list (✅ only):**

- `useRecordItemAttempt` — practice progress append (rollback on error, trust
  server value).
- `useSendChatMessage` — optimistic append of the user message.
- `useManageNotifications` (markRead).
- **❌ NEVER optimistic:** `useSaveSpace` (publish/lifecycle),
  `useSubmitTestSession`, `useEvaluateAnswer`, `usePurchaseSpace`, `useSaveItem`
  — all round-trip (§4 ⚷ rows). A lint rule flags optimistic config on these.

---

## Server services (`@levelup/services/{shared,server}`)

Every service is `fn(input, ctx: AuthContext)` — never imports
`firebase-functions`. `authorize(ctx, policyKey, resource)` from
`@levelup/access`. `tenantId` from `ctx`, never input.

### services/server (⚷ server-only — answer keys, grading, counters, purchases, secrets)

- `saveSpaceService` — authorize `space.write`/`space.publish`;
  `assertTransition(ALLOWED_TRANSITIONS.space)`; `validatePublish`;
  store-listing side-effect; enqueue `onSpacePublished`. Single canonical nested
  item path (be-levelup §4.1 — kill flat path + orphan-on-delete).
- `saveStoryPointService` — authorize `storyPoint.write`; cascade-delete via the
  **single** centralized cascade helper (be-levelup §4.12).
- `saveItemService` — authorize `item.write`; **validate `payload` discriminated
  union**; `extractAnswerKey` + `stripAnswerFromPayload` → server-only
  `answerKeys` subcollection (REVIEW §6.4); resolve+store `effectiveRubric` +
  `rubricId` at write (be-levelup §4.8 — no grade-time reads); maintain `stats`
  counters.
- `getItemForEditService` — authorize `item.edit` (authoring roles); re-merge
  AnswerKey into payload. **Returns answer-bearing item — gate strictly.**
- `importFromBankService` — `db.getAll` batched read; idempotent.
- `startTestSessionService` — authorize `session.start`; server clock;
  `serverDeadline`; shuffle/adaptive order;
  max-attempts/cooldown/lock-after-passing; resume-active. (⚷ all
  timing/ordering authority — REVIEW §6.6.)
- `submitTestSessionService` — idempotent on `(uid, idempotencyKey)`; load
  AnswerKeys (batched `getAll`); auto-grade 9 deterministic types; flag
  AI-pending; compute scores+analytics; write progress via the **single
  transactional progress-updater**; enqueue AI grading for pending items. (⚷
  grading/scoring — REVIEW §6.5.)
- `evaluateAnswerService` — auto-grade or Gemini (resolved rubric+agent);
  **persists progress server-side** (be-levelup §4.8 rec #7 — removes the second
  round-trip); per-call cost telemetry → analytics; idempotent.
- `recordItemAttemptService` — single transactional progress write (best-score
  retention, two-tier aggregation, attempt history cap 20, RTDB leaderboard
  sync); idempotent.
- `purchaseSpaceService` — `PaymentGateway` interface (stub → deterministic
  `transactionId`; real adapter drop-in); writes
  `consumerProfile.enrolledSpaceIds` + `PurchaseRecord`. (⚷ REVIEW §6.8.)
- `cascadeDeleteSpaceService` / `recomputeSpaceStatsService` — centralized
  counter/cascade authority (be-levelup §4.12; REVIEW §6.9).

### services/shared (client-safe read/shaping, still server-resolved tenant)

- `listSpacesService`, `getSpaceService`, `listStoryPointsService`,
  `listItemsService` (answer-stripped projection), `getSpaceProgressService`,
  `getStoryPointProgressService`, `getTestSessionService` (answer-stripped while
  in_progress), `listTestSessionsService`, `listVersionsService`,
  `listQuestionBankService`, `listRubricPresetsService`, `listAgentsService`
  (prompt-stripped for non-authoring), `listStoreSpacesService`,
  `getStoreSpaceService`, `listSpaceReviewsService`, `listChatSessionsService`,
  `getChatSessionService`.
- `sendChatMessageService` — uses `@levelup/ai` seam + per-tenant Secret Manager
  key (server-only); chat-safety regex filter; cheap-model summarization.
  (Cost/keys ⚷.)
- `saveSpaceReviewService` — upsert review; enqueue rating-aggregate recompute
  (⚷ aggregate).

**authorize() policy keys:** `space.read|write|publish|archive`,
`storyPoint.write`, `item.read|write|edit`, `answerKey.read` (deny-all client),
`session.start|submit`, `progress.read`, `evaluation.run`, `chat.send`,
`rubricPreset.write`, `questionBank.write`, `agent.write`,
`store.read|purchase`, `review.write`.

---

## Function shells (callable / trigger / scheduler)

### onCall adapters (thin: `buildAuthContext` → `parseRequest(Zod)` → service)

One per callable above (`v1.levelup.*`). Body is 3 lines (SDK-SERVER §3.1).
Region/config from `@levelup/functions-shared`; no business logic, no `tenantId`
from body.

### Triggers (single-writer, idempotent, outbox/enqueue for must-deliver)

- **`onSpacePublished`** (`onDocumentUpdated` space status→published) —
  **single** publish-notification path (be-levelup §4.6 — remove the inline
  `notifyStudentsOfPublish` duplicate); one recipient-resolution source (class
  membership); idempotent via processed-marker; uses transactional outbox for
  notification fan-out.
- **`onSpaceDeleted`** — cascade delete via the centralized
  `cascadeDeleteSpaceService` (storyPoints, items+answerKeys at the **single**
  nested path, agents, sessions, progress+subcollections, chatSessions, RTDB
  leaderboard, tenant stats). Idempotent.
- **`onTestSessionGraded`** / **`onProgressUpdated`** — single-writer
  derived-value updaters feeding analytics rollups (command-vs-projection
  split); idempotent handlers.
- **`onSpaceReviewWritten`** — recompute `ratingAggregate` (single-writer ⚷
  counter).

### Schedulers / cron

- **`expireTestSessions`** (`every 5 minutes`) — collectionGroup query for
  `in_progress` past `serverDeadline`+30s grace; expire + auto-grade via
  `submitTestSessionService`. Thin over service.
- **`cleanupStaleSessions`** (`every 1 hours`) — mark `in_progress` >24h as
  `abandoned`.
- **`cleanupInactiveChats`** — chat session cleanup.

### Cloud Tasks orchestration (multi-step)

- **AI grading fan-out** from `submitTestSession`: pending AI items enqueued to
  a Cloud Tasks queue → per-item `gradeItemTask` (idempotent) → reducer writes
  evaluation + re-aggregates progress (single-writer). Keeps submit fast and AI
  cost reliable/retryable.

---

## Authority boundary (server-only ⚷)

Maps to REVIEW §6:

1. **`tenantId`** — claim-derived for every op; **no field in any request
   schema** (REVIEW §6.1 / D2). The #1 boundary.
2. **AnswerKeys** — `correctAnswer`, `acceptableAnswers`, `evaluationGuidance`,
   `modelAnswer` — server-only subcollection, deny-all rules; never in any
   client response except `getItemForEdit` (authoring-gated). (REVIEW §6.4.)
3. **Grading outputs** — `UnifiedEvaluationResult` (score, correctness,
   confidence, cost), `TestSubmission.evaluation`, stored progress evaluations.
   Client submits answers; server computes scores. (REVIEW §6.5.)
4. **Test-session authority** — `serverDeadline`, `isLatest`, `attemptNumber`,
   question states/ordering, adaptive state. Server clock; SDK optimistic
   forbidden. (REVIEW §6.6.)
5. **Rubric/answer guidance** — `UnifiedRubric.modelAnswer`/`evaluatorGuidance`,
   `EvaluationDimension.promptGuidance`, `Agent.systemPrompt`/`rules`.
   Authoring-roles read only; server projects out otherwise. (REVIEW §6.7.)
6. **Purchases / enrollment** — `consumerProfile.enrolledSpaceIds`,
   `PurchaseRecord` — `purchaseSpace` CF only; SDK can request, never
   self-enroll. (REVIEW §6.8.)
7. **Denormalized counters/aggregates** — `Space.stats`/`ratingAggregate`,
   `StoryPoint.stats`, `*ProgressSummary`,
   `QuestionBankItem.usageCount/averageScore`, `ChatSession.messageCount`.
   Trigger-maintained; SDK reads, never writes. (REVIEW §6.9.)
8. **Lifecycle status** — `Space.status` + `ALLOWED_TRANSITIONS`,
   `TestSession.status`, results visibility. Pipeline transitions
   server-enforced. (REVIEW §6.10.)
9. **Cross-domain link integrity** — `linkedQuestionId`/`linkedItemId`
   existence-validated in-tenant server-side. (REVIEW §6.11.)
10. **Storage** — answer-sheet/media reads per-path tenant+role+ownership scoped
    (out of firestore.rules, in-boundary). (REVIEW §6.13.)

- **AI calls / Gemini keys / cost / quota** — Secret Manager per-tenant; never
  in client bundle.

---

## Drift & open questions

**Reconciliations (REVIEW drift table):**

- **D1 — dual item path:** rebuild standardizes on the **single canonical
  nested** path `spaces/{s}/storyPoints/{sp}/items/{id}`; delete flat path + all
  fallback branches; one-time migration; fixes orphan-on-delete + halves
  answer-key reads. Invisible to SDK (behind `listItems`/`getItem`/`saveItem`).
- **D4 — timestamps:** all domain `Timestamp` = ISO-8601 string; server edge
  adapter converts Firestore `Timestamp` ↔ ISO (chat `timestamp`, progress
  epoch-millis, session `submittedAt` all unified).
- **D5 — soft-delete:** single `archivedAt: Timestamp|null` on entities;
  `data.deleted=true` request convention kept for storyPoint/item.
- **D6 — record-maps:** explode `DigitalTestSession.submissions` and
  `SpaceProgress.storyPoints`/`StoryPointProgressDoc.items` toward
  subcollections to avoid the 1MB-doc risk on large tests; SDK shapes them back
  into view-models.
- **D9 — Zod-first `.strict()`:** invert interfaces→schemas; the `payload`
  `z.record(unknown)` becomes a real `z.discriminatedUnion` (top-risk #3); add
  the missing schemas (`RubricPreset`, `ContentVersion`, standalone
  `UnifiedRubric`/`UnifiedEvaluationResult`/`ItemMetadata`).
- **D12 — schema/interface drift:** `ChatMessage.timestamp` (ISO), `Agent.rules`
  (→`string[]`) + `Agent.isActive` (add), `DigitalTestSession`
  `sessionType`/`serverDeadline` (standardize), reconciled in the entity schemas
  above.
- **Rubric on item:** store **both** `effectiveRubric` snapshot **and** source
  `rubricId` (REVIEW open-Q resolution; SDK-SERVER locked decision). SDK reads
  snapshot for display/scoring-preview only.
- **StoryPointType:** drop synonym `test`; keep
  `timed_test|quiz|practice|standard` (be-levelup §4.2/§4.4).
- **Points/marks model:** pick one authoritative value at save; remove
  `meta.totalPoints` vs `payload.basePoints` fallback ambiguity (be-levelup
  §4.4/rec #5). **Open question:** confirm whether `marks` is kept as a distinct
  academic concept or modeled as `points × weight`.
- **Publish notifications:** single path via `onSpacePublished` trigger; remove
  inline duplicate (be-levelup §4.5/rec #6).
- **evaluateAnswer:** persists progress server-side (one call), idempotency key
  `sessionId+itemId+attempt` (be-levelup rec #7).

**Open questions:**

1. **Server-time primitive:** expose `useServerTime()` over `/serverTimeOffset`
   doc vs rely on `serverDeadline` only? (Recommend: thin `useServerTime()`.)
2. **`getItemForEdit` cache scope:** confirm non-persisted, role-gated query key
   excluded from any future offline store so answer keys never leak (SDK-SERVER
   §7.1.3).
3. **`purchaseSpace` response stability:** confirm v1 contract
   (`{success,transactionId,enrolledSpaceId}`) is stable so the real
   `PaymentGateway` adapter is a drop-in (stub returns deterministic fake id).
4. **Session `submissions` subcollection cutover:** decide whether v1 ships the
   subcollection explosion or defers it behind the same `getTestSession` shaping
   (migration absorbed server-side, SDK unchanged).
5. **multimodal eval:** `evaluateAnswer` mediaUrls currently passed as text only
   (be-levelup §4.10) — wire real image/audio attachment to the LLM call, or
   document as deferred.
6. **`joinTenant` lazy student:** SDK must not assume a `/students/{id}` doc
   exists for code-joined learners reading progress (REVIEW open-Q).
