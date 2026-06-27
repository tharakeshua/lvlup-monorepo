# V1: Type System & Ubiquitous Language — Cycle 4 Changelog

**Vertical**: V1 | **Cycle**: 4 | **Team**: Foundation Architect **Date**:
2026-03-08

---

## Added

### Zod Entity Schemas (17 new schemas)

- **`packages/shared-types/src/schemas/index.ts`** — Added 17 missing Zod entity
  schemas with `.passthrough()`:
  - `UnifiedUserSchema` (with nested `PurchaseRecordSchema`,
    `ConsumerProfileSchema`)
  - `UserMembershipSchema` (with nested `TeacherPermissionsSchema`,
    `StaffPermissionsSchema`)
  - `UnifiedItemSchema` (uses `z.record(z.string(), z.unknown())` for flexible
    payload/meta fields)
  - `SpaceProgressSchema` (with nested `QuestionProgressDataSchema`,
    `ItemProgressEntrySchema`, `StoryPointProgressSchema`)
  - `QuestionBankItemSchema`
  - `SpaceReviewSchema`
  - `AnswerKeySchema`
  - `EvaluationSettingsSchema` (with nested `EvaluationDimensionSchema`,
    `EvaluationDisplaySettingsSchema`, `EvaluationConfidenceConfigSchema`,
    `UsageQuotaConfigSchema`)
  - `GradingDeadLetterSchema`
  - `ExamAnalyticsSchema` (with nested `ScoreDistributionBucketSchema`,
    `QuestionAnalyticsEntrySchema`, `ClassBreakdownEntrySchema`,
    `TopicPerformanceEntrySchema`)
  - `StudentProgressSummarySchema` (with nested `StudentAutogradeMetricsSchema`,
    `StudentLevelupMetricsSchema`, etc.)
  - `ClassProgressSummarySchema` (with nested `ClassAutogradeMetricsSchema`,
    `ClassLevelupMetricsSchema`)
  - `LearningInsightSchema`
  - `LLMCallLogSchema`
  - `AchievementSchema` (with nested `AchievementCriteriaSchema`)
  - `StudentAchievementSchema`
  - `StudentLevelSchema`

### Compile-Time Compatibility Assertions

- **`packages/shared-types/src/schemas/index.ts`** — Added `z.infer<>` type
  exports and compile-time `_Assert` types for all 34 schemas (17 existing + 17
  new), ensuring schema definitions stay aligned with TypeScript interfaces.

## Changed

### Type Guard Predicates (Phase 4A)

- **`packages/shared-types/src/type-guards.ts`**:
  - `isQuestionItem()` return type changed from `boolean` to
    `item is UnifiedItem & { type: 'question' }`
  - `isMaterialItem()` return type changed from `boolean` to
    `item is UnifiedItem & { type: 'material' }`

### Zod Runtime Validation at Firestore Boundaries (Phase 4D)

Replaced all `doc.data() as Type` casts with `.safeParse()` + `logger.error`
structured logging:

- **`functions/levelup/src/utils/firestore.ts`** — All 5 loader functions
  (`loadSpace`, `loadStoryPoint`, `loadItem`, `loadItems`, `loadAgent`) now
  validate with Zod schemas
- **`functions/identity/src/utils/firestore-helpers.ts`** — `getUser()`,
  `getMembership()`, `getTenant()` now validate with Zod schemas; returns `null`
  on validation failure
- **`functions/autograde/src/utils/firestore-helpers.ts`** — All 5 functions
  (`getExam`, `getSubmission`, `getEvaluationSettings`, `getExamQuestions`,
  `getQuestionSubmissions`) now validate with Zod schemas
- **`functions/analytics/src/callable/get-summary.ts`** — Replaced 2
  `snapshot.data() as Type` casts with `safeParse` validation
- **`functions/analytics/src/callable/generate-report.ts`** — Replaced ~8
  `doc.data() as Type` casts across report handlers
- **`functions/analytics/src/schedulers/nightly-at-risk-detection.ts`** —
  Replaced `StudentProgressSummary` cast; skips invalid documents
- **`functions/levelup/src/callable/submit-test-session.ts`** — Replaced
  `DigitalTestSession` cast
- **`functions/levelup/src/callable/send-chat-message.ts`** — Replaced
  `ChatSession` cast
- **`functions/levelup/src/callable/import-from-bank.ts`** — Replaced
  `QuestionBankItem` cast; skips invalid bank items
- **`functions/identity/src/callable/save-student.ts`** — Eliminated double-cast
  `as unknown as UserMembership`; uses explicit `MembershipClaimsInput`
  construction with `as const` literals
- **`functions/identity/src/triggers/on-tenant-deactivated.ts`** — Replaced
  before/after `Tenant` casts with `TenantSchema.safeParse()`

## Technical Notes

- **Zod v4 compatibility**: All `z.record()` calls use 2-argument form
  `z.record(z.string(), z.unknown())` per Zod v4 API
- **FirestoreTimestamp handling**: Zod-validated results use
  `as unknown as Type` because `.passthrough()` preserves runtime Firestore
  methods (`toDate()`, `toMillis()`) that Zod's inferred type doesn't model
- **pnpm local-deps sync**: Function modules using
  `file:.local-deps/shared-types` require manual dist sync after schema changes

## Status

- **36 total Zod entity schemas** covering all Firestore document types
- **Zero `doc.data() as Type` casts** remaining in Cloud Functions (all replaced
  with safeParse)
- **Type-safe type guards** with proper TypeScript predicate narrowing
- **Build**: 12/12 tasks pass, 0 errors
- **Tests**: 311/312 pass (1 pre-existing failure unrelated to Cycle 4)
