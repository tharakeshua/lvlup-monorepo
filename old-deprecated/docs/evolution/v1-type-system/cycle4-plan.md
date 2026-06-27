# V1: Type System & Ubiquitous Language — Cycle 4 Plan

> Evolution Cycle 4 | Hardening & Adoption Pass Generated: 2026-03-08

---

## 1. Current State Assessment (After Cycles 1–3)

| Area                     | Status           | Details                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------ | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `any` in production code | **ZERO**         | Only 1 instance in `functions/test-utils/test-data.ts:339` (`rawRequest: {} as any`) — acceptable for mock factory                                                                                                                                                                                                                                                    |
| `any` in apps            | **ZERO**         | Fully eliminated in all 5 apps                                                                                                                                                                                                                                                                                                                                        |
| `any` in packages        | **ZERO**         | Fully eliminated in all shared packages                                                                                                                                                                                                                                                                                                                               |
| `any` in functions       | **ZERO**         | Eliminated in all 4 function modules' production code                                                                                                                                                                                                                                                                                                                 |
| Branded types defined    | **16 types**     | `TenantId`, `ClassId`, `StudentId`, `TeacherId`, `ParentId`, `SpaceId`, `StoryPointId`, `ItemId`, `ExamId`, `SubmissionId`, `UserId`, `SessionId`, `AgentId`, `AcademicSessionId`, `NotificationId`, `QuestionBankItemId`                                                                                                                                             |
| Branded type factories   | **16 factories** | `asTenantId()`, `asClassId()`, etc.                                                                                                                                                                                                                                                                                                                                   |
| Zod entity schemas       | **19 schemas**   | `TenantSchema`, `ClassSchema`, `StudentSchema`, `TeacherSchema`, `ParentSchema`, `SpaceSchema`, `StoryPointSchema`, `AgentSchema`, `ChatSessionSchema`, `ChatMessageSchema`, `DigitalTestSessionSchema`, `ExamSchema`, `ExamQuestionSchema`, `SubmissionSchema`, `QuestionSubmissionSchema`, `AcademicSessionSchema`, `NotificationSchema` + 2 (callable sub-schemas) |
| Zod callable schemas     | **28 schemas**   | Full coverage of all callable request types                                                                                                                                                                                                                                                                                                                           |
| Runtime type guards      | **6 guards**     | `isQuestionItem`, `isMaterialItem`, `isAutoEvaluatable`, `isAIEvaluatable`, `isFirestoreTimestamp`, `isNonEmptyString`, `isValidDocumentId`                                                                                                                                                                                                                           |
| Domain glossary          | **Complete**     | `docs/domain-glossary.md` — 17 identity types, 7 tenant entities, 11 LevelUp types, 7 AutoGrade types, 4 shared content types, 7 progress types, 3 notification types                                                                                                                                                                                                 |
| Error types              | **Defined**      | `error-types.ts` — 9 `AppErrorCode` values, mappings, recovery hints, rate limits                                                                                                                                                                                                                                                                                     |
| Barrel export            | **Complete**     | All types, schemas, guards exported from `@levelup/shared-types`                                                                                                                                                                                                                                                                                                      |

---

## 2. Remaining Gaps

### GAP-1: Type Guards Return `boolean` Instead of Type Predicates (HIGH)

**File**: `packages/shared-types/src/type-guards.ts`

Two item type guards return `boolean` instead of TypeScript type predicates:

- Line 20: `isQuestionItem(item: UnifiedItem): boolean` → should be
  `item is QuestionUnifiedItem`
- Line 25: `isMaterialItem(item: UnifiedItem): boolean` → should be
  `item is MaterialUnifiedItem`

**Impact**: TypeScript cannot narrow types in conditional branches using these
guards — callers must still manually assert types after the guard check.

---

### GAP-2: Branded Types Defined but Not Adopted (CRITICAL)

**Scope**: ~30+ files in `packages/shared-types/src/`, all callable-types, all
domain interfaces

Branded types (`TenantId`, `SpaceId`, etc.) are fully defined in `branded.ts`
and exported via barrel, but **zero domain type definitions actually use them**.
Every interface still declares IDs as plain `string`:

| Module              | Files with plain `string` IDs                                                                                                | Example Violation                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `identity/`         | `user.ts`, `membership.ts`, `tenant.ts`                                                                                      | `activeTenantId?: string` should be `TenantId`                   |
| `tenant/`           | `class.ts`, `student.ts`, `teacher.ts`, `parent.ts`, `academic-session.ts`                                                   | `tenantId: string`, `classIds: string[]`, `studentIds: string[]` |
| `levelup/`          | `space.ts`, `story-point.ts`, `agent.ts`, `chat.ts`, `test-session.ts`, `progress.ts`, `question-bank.ts`, `space-review.ts` | All `id`, `tenantId`, `spaceId` fields                           |
| `autograde/`        | `exam.ts`, `submission.ts`, `question-submission.ts`, `exam-question.ts`, `exam-analytics.ts`                                | `examId: string`, `studentId: string`                            |
| `content/`          | `item.ts`                                                                                                                    | `spaceId: string`, `storyPointId: string`                        |
| `progress/`         | `summary.ts`, `insight.ts`, `analytics.ts`                                                                                   | `studentId: string`, `classId: string`                           |
| `gamification/`     | `achievement.ts`                                                                                                             | `userId: string`, `achievementId: string`                        |
| `callable-types.ts` | 20+ instances                                                                                                                | `tenantId: string` across all request interfaces                 |

**Impact**: No compile-time protection against mixing ID types (e.g., passing a
`ClassId` where `StudentId` is expected).

**Decision Point**: Branded type adoption in domain interfaces is a **breaking
change** for consumers. Two approaches:

1. **Gradual adoption** — Only brand IDs in new code; keep existing interfaces
   using `string` (lower risk, lower value)
2. **Full migration** — Update all domain interfaces to use branded IDs, then
   fix all downstream consumers (high risk, high value)

**Recommendation**: Full migration with a phased rollout — update shared-types
first, then fix type errors across apps and functions in sequence. Branded types
are structurally compatible with `string` at runtime, so only compile-time
breakage occurs.

---

### GAP-3: Missing Zod Entity Schemas (HIGH)

**17 domain document types** defined in shared-types lack corresponding Zod
schemas:

| Module       | Missing Schema                 | TypeScript Type          | Firestore Path                             |
| ------------ | ------------------------------ | ------------------------ | ------------------------------------------ |
| Identity     | `UnifiedUserSchema`            | `UnifiedUser`            | `/users/{uid}`                             |
| Identity     | `UserMembershipSchema`         | `UserMembership`         | `/userMemberships/{uid}_{tenantId}`        |
| LevelUp      | `UnifiedItemSchema`            | `UnifiedItem`            | `.../items/{itemId}`                       |
| LevelUp      | `SpaceProgressSchema`          | `SpaceProgress`          | `.../spaceProgress/{userId}_{spaceId}`     |
| LevelUp      | `QuestionBankItemSchema`       | `QuestionBankItem`       | `.../questionBankItems/{itemId}`           |
| LevelUp      | `SpaceReviewSchema`            | `SpaceReview`            | `.../spaceReviews/{reviewId}`              |
| LevelUp      | `AnswerKeySchema`              | `AnswerKey`              | `.../answerKeys/{itemId}`                  |
| AutoGrade    | `EvaluationSettingsSchema`     | `EvaluationSettings`     | `.../evaluationSettings/{settingsId}`      |
| AutoGrade    | `GradingDeadLetterSchema`      | `GradingDeadLetterEntry` | `.../gradingDeadLetter/{entryId}`          |
| AutoGrade    | `ExamAnalyticsSchema`          | `ExamAnalytics`          | `.../examAnalytics/{examId}`               |
| Progress     | `StudentProgressSummarySchema` | `StudentProgressSummary` | `.../studentProgressSummaries/{studentId}` |
| Progress     | `ClassProgressSummarySchema`   | `ClassProgressSummary`   | `.../classProgressSummaries/{classId}`     |
| Progress     | `LearningInsightSchema`        | `LearningInsight`        | `.../insights/{insightId}`                 |
| Analytics    | `LLMCallLogSchema`             | `LLMCallLog`             | `.../llmCallLogs/{logId}`                  |
| Gamification | `AchievementSchema`            | `Achievement`            | `.../achievements/{achievementId}`         |
| Gamification | `StudentAchievementSchema`     | `StudentAchievement`     | `.../studentAchievements/{docId}`          |
| Gamification | `StudentLevelSchema`           | `StudentLevel`           | `.../studentLevels/{userId}`               |

**Impact**: No runtime validation at Firestore read boundaries for these types.
Malformed documents silently pass through as typed objects.

---

### GAP-4: No `z.infer<>` Type Exports from Schemas (MEDIUM)

All 19 existing Zod entity schemas (and future ones) lack exported TypeScript
types derived via `z.infer<typeof Schema>`. This means:

- TypeScript interfaces and Zod schemas can drift apart silently
- No mechanism to validate that a schema matches its interface at compile time
- Developers must manually keep schemas and types in sync

**Fix**: Export `z.infer` types alongside each schema and add compile-time
compatibility assertions.

---

### GAP-5: Unvalidated Firestore `.data()` Reads in Functions (CRITICAL)

All 4 function modules use `doc.data() as Type` — direct type assertion without
Zod validation. This is the most critical runtime safety gap.

| Module      | Helper File                                 | Unvalidated Casts                                            | Called By                        |
| ----------- | ------------------------------------------- | ------------------------------------------------------------ | -------------------------------- |
| `identity`  | `utils/firestore-helpers.ts:9,18,24`        | `UnifiedUser`, `UserMembership`, `Tenant`                    | All identity callables           |
| `levelup`   | `utils/firestore.ts:18,32,46,59,70`         | `Space`, `StoryPoint`, `UnifiedItem`, `Agent`, `ChatSession` | All levelup callables (HOT PATH) |
| `autograde` | `utils/firestore-helpers.ts:14,22,27,37,45` | `Exam`, `ExamQuestion`, `Submission`, `QuestionSubmission`   | All autograde callables          |
| `analytics` | `callable/get-summary.ts:95,136`            | `StudentProgressSummary`, `ClassProgressSummary`             | getSummary                       |
| `analytics` | `callable/generate-report.ts:113,132,162`   | `Exam`, `Submission`, `QuestionSubmission`, class data       | generateReport                   |

**Additional unvalidated reads:**

- `levelup/callable/submit-test-session.ts:43` — `DigitalTestSession`
- `levelup/callable/send-chat-message.ts:96` — `ChatSession`
- `levelup/callable/import-from-bank.ts:58` — `QuestionBankItem`
- `identity/triggers/on-tenant-deactivated.ts:20-21` — `Tenant` before/after
- `analytics/schedulers/nightly-at-risk-detection.ts:62` —
  `StudentProgressSummary`
- `identity/callable/save-student.ts:81` — double cast
  `as unknown as UserMembership`

**Impact**: If Firestore documents are missing required fields or have wrong
types, the app will fail silently or produce undefined behavior downstream.

---

### GAP-6: `Record<string, unknown>` Overuse in Functions (MEDIUM)

Several function files discard type information by casting validated payloads to
`Record<string, unknown>`:

- `levelup/src/callable/save-item.ts:108,184,202` — `ItemPayload` cast to
  `Record<string, unknown>`
- `autograde/src/callable/save-exam.ts:303,312` — `gradingConfig` cast to
  `Record<string, unknown>`
- `identity/src/callable/save-tenant.ts:186` — updates object
- `identity/src/triggers/on-user-created.ts:16` —
  `Omit<UnifiedUser, ...> & Record<string, unknown>`

**Root cause**: Firestore's dot-notation updates (`subscription.plan`) require
string keys. Functions build update objects dynamically and lose type safety.

**Fix strategy**: Create typed update builder helpers or use discriminated
update types instead of raw records.

---

## 3. Task List

### Phase 4A: Fix Type Guard Predicates

**Task 4A.1**: Update item type guards to use proper TypeScript type predicates.

**Files**:

- `packages/shared-types/src/type-guards.ts`

**Changes**:

```typescript
// Before:
export function isQuestionItem(item: UnifiedItem): boolean;
// After (requires narrowed type to exist):
export function isQuestionItem(
  item: UnifiedItem
): item is UnifiedItem & { type: "question" };
```

**Acceptance Criteria**:

- [x] `isQuestionItem` uses type predicate syntax
- [x] `isMaterialItem` uses type predicate syntax
- [x] TypeScript control flow narrows correctly after guard calls
- [x] Build passes

---

### Phase 4B: Add Missing Zod Entity Schemas

**Task 4B.1**: Create Zod schemas for 17 missing domain document types.

**File**: `packages/shared-types/src/schemas/index.ts` (append)

**Schemas to add** (ordered by dependency):

1. `UnifiedUserSchema` — identity/user.ts
2. `UserMembershipSchema` — identity/membership.ts
3. `UnifiedItemSchema` — content/item.ts (complex — discriminated union by
   `type`)
4. `SpaceProgressSchema` — levelup/progress.ts
5. `QuestionBankItemSchema` — levelup/question-bank.ts
6. `SpaceReviewSchema` — levelup/space-review.ts
7. `AnswerKeySchema` — levelup/answer-key.ts
8. `EvaluationSettingsSchema` — autograde/evaluation-settings.ts
9. `GradingDeadLetterSchema` — autograde/dead-letter.ts
10. `ExamAnalyticsSchema` — autograde/exam-analytics.ts
11. `StudentProgressSummarySchema` — progress/summary.ts
12. `ClassProgressSummarySchema` — progress/summary.ts
13. `LearningInsightSchema` — progress/insight.ts
14. `LLMCallLogSchema` — analytics/llm-call-log.ts
15. `AchievementSchema` — gamification/achievement.ts
16. `StudentAchievementSchema` — gamification/achievement.ts
17. `StudentLevelSchema` — gamification/achievement.ts

**Note**: `StudyGoal` and `StudySession` are also missing schemas but are lower
priority as they're not read from Firestore in Cloud Functions yet. Include them
for completeness.

**Acceptance Criteria**:

- [ ] All 17+ domain document types have corresponding Zod schemas
- [ ] Schemas match their TypeScript interfaces
- [ ] Build passes with all schemas exported from barrel

---

### Phase 4C: Export `z.infer<>` Types + Compile-Time Compatibility

**Task 4C.1**: For every Zod entity schema (existing 19 + new 17), export an
inferred TypeScript type and add a compile-time compatibility assertion.

**File**: `packages/shared-types/src/schemas/index.ts`

**Pattern**:

```typescript
export const TenantSchema = z.object({ ... });
export type TenantSchemaType = z.infer<typeof TenantSchema>;

// Compile-time check: schema type must be assignable to/from interface
// (catches drift between Zod schema and TypeScript interface)
type _AssertTenantCompat = TenantSchemaType extends Tenant ? true : never;
```

**Acceptance Criteria**:

- [ ] Every entity schema has a corresponding `z.infer` type export
- [ ] Compile-time assertions verify schema-interface alignment
- [ ] Build passes

---

### Phase 4D: Validate Firestore Reads in Cloud Functions

**Task 4D.1**: Replace all `doc.data() as Type` casts with Zod schema validation
in function helper files.

**Priority order** (by call frequency / blast radius):

1. **`functions/levelup/src/utils/firestore.ts`** — Hot path, replace:
   - `doc.data() as Space` → `SpaceSchema.parse({ id: doc.id, ...doc.data() })`
   - `doc.data() as StoryPoint` → `StoryPointSchema.parse(...)`
   - `doc.data() as UnifiedItem` → `UnifiedItemSchema.parse(...)`

2. **`functions/identity/src/utils/firestore-helpers.ts`** — Replace:
   - `doc.data() as UnifiedUser` → `UnifiedUserSchema.parse(...)`
   - `doc.data() as UserMembership` → `UserMembershipSchema.parse(...)`
   - `doc.data() as Tenant` → `TenantSchema.parse(...)`

3. **`functions/autograde/src/utils/firestore-helpers.ts`** — Replace:
   - `doc.data() as Exam` → `ExamSchema.parse(...)`
   - `doc.data() as ExamQuestion[]` → `.map(d => ExamQuestionSchema.parse(...))`
   - `doc.data() as Submission` → `SubmissionSchema.parse(...)`
   - `doc.data() as QuestionSubmission` → `QuestionSubmissionSchema.parse(...)`

4. **`functions/analytics/src/callable/get-summary.ts`** — Replace:
   - `snapshot.data() as GetSummaryResponse['studentSummary']` → validate with
     schema
   - `snapshot.data() as GetSummaryResponse['classSummary']` → validate with
     schema

5. **`functions/analytics/src/callable/generate-report.ts`** — Replace:
   - `examSnap.data()!` → `ExamSchema.parse(...)`
   - `d.data() as Submission` → `SubmissionSchema.parse(...)`
   - Untyped class/membership reads → validate with schemas

6. **Remaining callables** with inline `.data()` casts:
   - `levelup/callable/submit-test-session.ts:43`
   - `levelup/callable/send-chat-message.ts:96`
   - `levelup/callable/import-from-bank.ts:58`
   - `analytics/schedulers/nightly-at-risk-detection.ts:62`

7. **Fix double-cast** in `identity/callable/save-student.ts:81`:
   - Remove `as unknown as UserMembership` — restructure to avoid the cast

**Error handling strategy**: Use `.safeParse()` with structured logging for
production resilience:

```typescript
const result = SpaceSchema.safeParse({ id: doc.id, ...doc.data() });
if (!result.success) {
  logger.error("Invalid Space document", {
    docId: doc.id,
    errors: result.error.flatten(),
  });
  throw new HttpsError("internal", "Data integrity error");
}
return result.data;
```

**Acceptance Criteria**:

- [ ] Zero `doc.data() as Type` casts in production function code
- [ ] All Firestore reads validate through Zod schemas
- [ ] Invalid documents produce structured error logs
- [ ] Build passes
- [ ] Existing tests still pass

---

### Phase 4E: Branded Type Adoption in Domain Interfaces (DEFERRED — Recommendation)

> **Recommendation**: Defer branded type adoption in domain interfaces to
> Cycle 5.
>
> **Rationale**: Updating ~30+ type definition files in shared-types will
> cascade type errors to all 5 apps, 7 packages, and 4 function modules. This
> requires:
>
> 1. Updating every Firestore read to wrap raw strings with `asTenantId()` etc.
> 2. Updating every React component that passes IDs as props
> 3. Updating every callable request builder
> 4. Updating all Zod schemas to use `.transform()` for ID branding
>
> This is a full-codebase migration best done as a dedicated cycle with thorough
> testing.
>
> **Preparatory work for this cycle**: Audit and document every location where
> branded type adoption will be needed (done in GAP-2 above).

---

### Phase 4F: Build, Test & Verify

**Task 4F.1**: Full build verification.

**Steps**:

1. `pnpm build --force` from root — all 12 tasks must pass
2. `pnpm lint` from root — zero new errors
3. `pnpm test` on shared-types — all schema tests pass
4. Verify function builds complete without errors

**Acceptance Criteria**:

- [ ] `pnpm build` passes with 0 errors
- [ ] `pnpm lint` produces no new errors
- [ ] All existing tests pass
- [ ] Changelog written to `docs/evolution/v1-type-system/cycle4-changelog.md`
- [ ] Test report written to
      `docs/evolution/v1-type-system/cycle4-test-report.md`

---

## 4. Files to Modify/Create

### Files to Modify

| File                                                              | Phase  | Changes                                                                  |
| ----------------------------------------------------------------- | ------ | ------------------------------------------------------------------------ |
| `packages/shared-types/src/type-guards.ts`                        | 4A     | Fix return types to use type predicates                                  |
| `packages/shared-types/src/schemas/index.ts`                      | 4B, 4C | Add 17+ new schemas, add `z.infer` exports, add compatibility assertions |
| `packages/shared-types/src/index.ts`                              | 4B     | May need additional exports if schema file is split                      |
| `functions/levelup/src/utils/firestore.ts`                        | 4D     | Replace `.data() as Type` with Zod validation                            |
| `functions/identity/src/utils/firestore-helpers.ts`               | 4D     | Replace `.data() as Type` with Zod validation                            |
| `functions/autograde/src/utils/firestore-helpers.ts`              | 4D     | Replace `.data() as Type` with Zod validation                            |
| `functions/analytics/src/callable/get-summary.ts`                 | 4D     | Replace `.data() as Type` with Zod validation                            |
| `functions/analytics/src/callable/generate-report.ts`             | 4D     | Replace `.data() as Type` with Zod validation                            |
| `functions/levelup/src/callable/submit-test-session.ts`           | 4D     | Replace inline `.data()` cast                                            |
| `functions/levelup/src/callable/send-chat-message.ts`             | 4D     | Replace inline `.data()` cast                                            |
| `functions/levelup/src/callable/import-from-bank.ts`              | 4D     | Replace inline `.data()` cast                                            |
| `functions/analytics/src/schedulers/nightly-at-risk-detection.ts` | 4D     | Replace inline `.data()` cast                                            |
| `functions/identity/src/callable/save-student.ts`                 | 4D     | Fix double-cast `as unknown as UserMembership`                           |

### Files to Create

| File                                                  | Phase | Purpose                         |
| ----------------------------------------------------- | ----- | ------------------------------- |
| `docs/evolution/v1-type-system/cycle4-changelog.md`   | 4F    | Document all changes            |
| `docs/evolution/v1-type-system/cycle4-test-report.md` | 4F    | Build/test verification results |

---

## 5. Execution Order

1. **Phase 4A** — Fix type guard predicates (quick win, no dependencies)
2. **Phase 4B** — Add 17+ missing Zod entity schemas (prerequisite for 4D)
3. **Phase 4C** — Add `z.infer<>` exports + compile-time assertions (depends on
   4B)
4. **Phase 4D** — Validate Firestore reads in functions (depends on 4B, highest
   impact)
5. **Phase 4F** — Full build, test, and verification pass

---

## 6. Risk Assessment

| Risk                                             | Impact                                        | Mitigation                                                                                                                    |
| ------------------------------------------------ | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Zod schemas reject valid Firestore documents     | Functions crash on valid data                 | Use `.passthrough()` on schemas for fields we don't validate; use `.safeParse()` with logging before `.parse()` in production |
| Schema/interface drift after initial alignment   | Silent type mismatches                        | Compile-time `extends` assertions catch drift at build time                                                                   |
| Firestore documents with missing optional fields | Parse failures                                | Mark all optional interface fields as `.optional()` in Zod schemas                                                            |
| Performance overhead of Zod validation           | Increased function latency                    | Zod parsing is ~0.1ms per document — negligible vs Firestore round-trip (~50-200ms)                                           |
| `UnifiedItem` schema complexity                  | Difficult to model discriminated union in Zod | Use `z.discriminatedUnion('type', [...])` for the top-level type field; use `.passthrough()` for payload flexibility          |
| Branded type adoption cascade (if attempted)     | Hundreds of type errors across codebase       | **Deferred to Cycle 5** — documented and scoped                                                                               |
| Test file breakage from schema changes           | Slowed development                            | Add `.passthrough()` to entity schemas to allow test mock extras                                                              |

---

## 7. Success Metrics

| Metric                                | Target                                         |
| ------------------------------------- | ---------------------------------------------- |
| Zod schema coverage                   | 100% of Firestore document types (36+ schemas) |
| Unvalidated `.data() as Type` casts   | ZERO in production function code               |
| Type guard predicates                 | All item guards use `is` syntax                |
| `z.infer<>` exports                   | Every schema has corresponding type export     |
| Schema-interface alignment assertions | Every schema has compile-time check            |
| Build status                          | `pnpm build` — 0 errors                        |
| Test status                           | All existing tests pass                        |

---

## 8. Out of Scope for Cycle 4

| Item                                                 | Reason                                                                      | Target Cycle        |
| ---------------------------------------------------- | --------------------------------------------------------------------------- | ------------------- |
| Branded type adoption in domain interfaces           | Breaking change requiring full-codebase migration                           | Cycle 5             |
| Error type adoption in functions (`AppErrorCode`)    | Belongs to V3 (Error Handling & Resource Lifecycle)                         | V3                  |
| `Record<string, unknown>` reduction in functions     | Partially addressed by Zod validation; full fix needs typed update builders | Cycle 5             |
| Gamification schemas for `StudyGoal`, `StudySession` | Lower priority — not read in Cloud Functions yet                            | Cycle 5 (if needed) |
| JSDoc documentation gaps                             | Mostly addressed in Cycle 3                                                 | Maintenance         |
