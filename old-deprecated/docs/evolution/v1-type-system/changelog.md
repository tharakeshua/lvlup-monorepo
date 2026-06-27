# V1 — Type System & Ubiquitous Language: Changelog

**Cycle:** C1-V1 **Date:** 2026-03-07

---

## New Files

### `packages/shared-types/src/branded.ts`

- Created branded/nominal ID types using `unique symbol` pattern
- 14 types: TenantId, ClassId, StudentId, TeacherId, ParentId, SpaceId,
  StoryPointId, ItemId, ExamId, SubmissionId, UserId, SessionId, AgentId,
  AcademicSessionId

### `packages/shared-types/src/schemas/index.ts`

- Created Zod runtime validation schemas for Firebase read boundaries
- Schemas: Tenant, Class, Student, Teacher, Space, Exam, Submission,
  ExamQuestion, QuestionSubmission
- Includes FirestoreTimestampSchema for Firestore timestamp validation

### `docs/domain-glossary.md`

- Comprehensive ubiquitous language glossary for the Auto-LevelUp platform
- Covers all 15 core domain entities with Firestore paths and canonical type
  names

### `docs/evolution/v1-type-system/plan.md`

- Detailed implementation plan for V1 type system evolution

---

## Modified Files

### Shared Packages

**`packages/shared-types/src/index.ts`**

- Added branded type exports (Brand, TenantId, ClassId, etc.)
- Added Zod schema exports (TenantSchema, SpaceSchema, etc.)

**`packages/shared-types/src/identity/user.ts`**

- Added `activeTenantId?: string` to UnifiedUser (was stored in Firestore but
  missing from type)

**`packages/shared-types/src/callable-types.ts`**

- Changed `createdAt: unknown` → `createdAt: FirestoreTimestamp` in
  ManageNotificationsResponse

**`packages/shared-types/src/progress/analytics.ts`**

- Removed duplicate Notification, NotificationType, NotificationChannel types
  (canonical versions in notification/notification.ts)

**`packages/shared-services/src/autograde/exam-callables.ts`**

- Removed `as any` casts on ExamStatus literals ('published',
  'results_released')

**`packages/shared-services/src/firebase/config.ts`**

- Removed `as any` on `getFirestore(app)`

**`packages/shared-services/src/ai/llm-wrapper.ts`**

- Fixed responseSchema cast from `as any` to typed intersection

**`packages/shared-services/src/realtime-db/index.ts`**

- Changed all `<T = any>` generics to `<T = unknown>`
- Changed `Record<string, any>` to `Record<string, unknown>`

**`packages/shared-utils/src/validation.ts`**

- Changed `Record<string, any>` to `Record<string, unknown>`

**`packages/shared-utils/src/pdf.ts`**

- Fixed render context cast from `as any` to `as object`

**`packages/shared-hooks/src/queries/useSpaces.ts`**

- Removed unnecessary `as any` casts on FirestoreTimestamp fields

**`packages/shared-hooks/src/data/useRealtimeDB.ts`**

- Changed `<T = any>` to `<T = unknown>`

**`packages/shared-ui/src/components/ui/status-badge.tsx`**

- Extracted `StatusBadgeStatus` type from CVA variants
- Added `deleted` status variant
- Exported `StatusBadgeStatus` type for consumers

**`packages/shared-ui/src/components/DownloadPDFButton.tsx`**

- Changed `catch (err: any)` to `catch (err: unknown)` with `instanceof Error`
  check

**`packages/shared-ui/src/components/ui/scroll-area.tsx`**

- Fixed `viewportRef` type from `RefObject<HTMLDivElement>` to
  `Ref<HTMLDivElement>`
- Removed `ref={viewportRef as any}`

**`packages/shared-ui/src/hooks/useStoryPointProgress.ts`**

- Removed `as any` cast on items fallback

### Apps

**`apps/teacher-web/src/components/spaces/ItemEditor.tsx`**

- Replaced ~18 `any` types with specific QuestionTypeData subtypes (MCQData,
  TrueFalseData, etc.)

**`apps/teacher-web/src/pages/exams/ExamDetailPage.tsx`**

- Typed rubric parameter from `any` to `UnifiedRubric`

**`apps/teacher-web/src/pages/exams/GradingReviewPage.tsx`**

- Replaced status `as any` casts with proper
  QuestionGradingStatus/SubmissionPipelineStatus types

**`apps/teacher-web/src/pages/spaces/SpaceEditorPage.tsx`**

- Fixed payload casts from `as any` to QuestionPayload

**`apps/teacher-web/src/components/spaces/StoryPointEditor.tsx`**

- Fixed difficulty cast from `as any` to typed union

**`apps/teacher-web/src/components/spaces/RubricEditor.tsx`**

- Fixed priority cast from `as any` to typed union

**`apps/teacher-web/` (6 files)**

- Removed all `status as any` casts (using widened StatusBadgeStatus type)

**`apps/student-web/src/pages/DashboardPage.tsx`**

- Changed `Record<string, any>` to `Exam` type

**`apps/student-web/src/pages/StoryPointViewerPage.tsx`**

- Typed evaluations state from `Record<string, any>` to
  `Record<string, UnifiedEvaluationResult>`

**`apps/student-web/src/pages/ConsumerDashboardPage.tsx`**

- Changed `Record<string, any>` to `Space` type

**`apps/student-web/src/pages/StoreDetailPage.tsx`**

- Changed `Record<string, any>` to `Space` type

**`apps/student-web/src/pages/TimedTestPage.tsx`**

- Removed timestamp `as any` casts

**`apps/student-web/src/pages/ChatTutorPage.tsx`**

- Removed timestamp `as any` cast

**`apps/super-admin/src/pages/TenantDetailPage.tsx`**

- Removed timestamp `as any` casts
- Cleaned up unused type imports

### Cloud Functions

**`functions/levelup/src/types/index.ts`**

- Added QuestionPayload to re-exports

**`functions/levelup/src/utils/auth.ts`**

- Typed return values from `any` to `UserMembership` and `TenantRole`

**`functions/levelup/src/utils/auto-evaluate.ts`**

- Replaced all `any` parameters with specific QuestionTypeData subtypes
- Added imports for MCQData, TrueFalseData, NumericalData, FillBlanksData, etc.

**`functions/levelup/src/prompts/evaluator.ts`**

- Typed all `qData` and `answer` parameters with specific types

**`functions/levelup/src/prompts/tutor.ts`**

- Changed `item.payload as any` to `QuestionPayload`
- Changed `studentAnswer?: any` to `unknown`

**`functions/levelup/src/callable/evaluate-answer.ts`**

- Changed `answer: any` to `answer: unknown` in EvaluateAnswerRequest

**`functions/levelup/src/callable/save-story-point.ts`**

- Changed `Record<string, any>` to `Record<string, unknown>`

**`functions/levelup/src/callable/save-item.ts`**

- Changed all `Record<string, any>` to `Record<string, unknown>`
- Added typed payload cast for extractAnswerKey/stripAnswerFromPayload

**`functions/levelup/src/callable/save-space.ts`**

- Changed `space: any` to `Space` type

**`functions/levelup/src/callable/create-item.ts`**

- Typed all array callbacks with MCQOption, FillBlank, etc.

**`functions/levelup/src/callable/record-item-attempt.ts`**

- Created `StoredItemProgressEntry extends ItemProgressEntry` for Firestore data

**`functions/levelup/src/callable/send-chat-message.ts`**

- Added QuestionPayload import, used type-narrowed cast
- Changed `} as any` to `} satisfies ChatSession`

**`functions/levelup/src/callable/submit-test-session.ts`**

- Typed answerKeyMap as `Map<string, AnswerKey>`
- Changed all `(item.payload as any)` to `(item.payload as QuestionPayload)`
- Changed `Record<string, any>` to `Record<string, unknown>`

**`functions/levelup/src/triggers/on-test-session-expired.ts`**

- Typed answerKeyMap as `Map<string, AnswerKey>`
- Changed all `as any` casts to proper types

**`functions/identity/src/callable/join-tenant.ts`**

- Fixed `membership as any` to `membership as unknown as UserMembership`
- Used `callerUser.activeTenantId` (now available on UnifiedUser type)

**`functions/identity/src/callable/create-org-user.ts`**

- Fixed `membership as any` to `membership as unknown as UserMembership`

**`functions/autograde/src/prompts/extraction.ts`**

- Removed unnecessary `as any` cast

**`functions/autograde/src/callable/grade-question.ts`**

- Cast to QuestionSubmission type

**`functions/analytics/src/triggers/update-leaderboard.ts`**

- Changed `Record<string, any>` to `Record<string, unknown>` in
  computeTierCounts
- Removed `as any[]` cast with typed `{ avgCompletion?: number }` interface

**`functions/analytics/src/triggers/on-user-story-point-progress-write.ts`**

- Changed `Record<string, any>` to `Record<string, unknown>`

**`functions/analytics/src/schedulers/nightly-at-risk-detection.ts`**

- Fixed `(summary as any).studentName` by looking up user document for display
  name

---

## Summary

- **~97 production `any` types eliminated** across 45+ files
- **4 new files** created (branded types, Zod schemas, domain glossary, plan)
- **Zero build errors** introduced
- **Zero lint errors** introduced (pre-existing lint warnings unchanged)
- **1 type gap discovered and fixed**: `activeTenantId` on `UnifiedUser`
- **1 naming conflict resolved**: duplicate Notification types removed
