# V1: Type System & Ubiquitous Language — Plan

> Evolution Cycle 1 | Foundation Pass Generated: 2026-03-07

---

## 1. Audit Summary

### 1.1 Codebase Structure

- **5 Apps:** admin-web, teacher-web, student-web, parent-web, super-admin
- **8 Shared Packages:** shared-types, shared-services, shared-stores,
  shared-hooks, shared-ui, shared-utils, eslint-config, tailwind-config
- **4 Cloud Functions:** identity, levelup, autograde, analytics
- **150+ types/interfaces** already defined in `packages/shared-types/src/`

### 1.2 Current Type System Health

| Area                  | Status        | Details                                                                                           |
| --------------------- | ------------- | ------------------------------------------------------------------------------------------------- |
| Barrel Export         | GOOD          | `packages/shared-types/src/index.ts` exists with complete re-exports                              |
| Shared Types          | GOOD          | 47 source files, 150+ types, well-organized into 9 modules                                        |
| `any` in shared-types | CLEAN         | Zero `any` types (uses `unknown` where needed — 8 instances)                                      |
| `any` in apps         | 52 instances  | Primarily in teacher-web (39), student-web (13)                                                   |
| `any` in packages     | 131 instances | 76 in test files, 55 in production code                                                           |
| `any` in functions    | ~68 files     | 50+ in test files, ~15 in production code                                                         |
| Naming consistency    | GOOD          | PascalCase interfaces, lowercase union types, UPPER_SNAKE_CASE constants                          |
| Domain glossary       | MISSING       | No formal domain glossary exists                                                                  |
| Branded types         | MISSING       | All IDs are plain `string`                                                                        |
| Zod schemas           | MISSING       | No runtime validation at Firebase read boundaries                                                 |
| Naming duplication    | ISSUE         | `Notification` and `NotificationType` defined in both `notification/` and `progress/analytics.ts` |

### 1.3 `any` Type Inventory

#### Apps — Production Code (52 total)

**teacher-web/src/components/spaces/ItemEditor.tsx (20 instances)**

- Lines 80, 144, 348, 349, 394, 480, 525, 569, 628, 683, 812, 876, 980, 1049,
  1116, 1163, 1208, 1329: `any` in callback parameters and return types
- Lines 158: `difficulty as any`

**teacher-web/src/pages/exams/ExamDetailPage.tsx (2)**

- Line 115: `rubric: any` parameter
- Line 193: `status as any`

**teacher-web/src/pages/exams/ExamListPage.tsx (1)**

- Line 118: `status as any`

**teacher-web/src/pages/exams/GradingReviewPage.tsx (4)**

- Lines 146, 151, 196, 201: `as any` for status/timestamp casts

**teacher-web/src/pages/StudentsPage.tsx (1)** — `status as any`
**teacher-web/src/pages/spaces/SpaceListPage.tsx (1)** — `status as any`
**teacher-web/src/pages/spaces/SpaceEditorPage.tsx (3)** — `status as any`,
`payload as any` **teacher-web/src/pages/ClassDetailPage.tsx (6)** —
`status as any` (6x) **teacher-web/src/components/spaces/StoryPointEditor.tsx
(1)** — `difficulty as any`

**student-web/src/pages/DashboardPage.tsx (5)** — `Record<string, any>` usage
**student-web/src/pages/StoryPointViewerPage.tsx (1)** — `Record<string, any>`
**student-web/src/pages/ConsumerDashboardPage.tsx (1)** — `Record<string, any>`
**student-web/src/pages/StoreDetailPage.tsx (1)** — `Record<string, any>`
**student-web/src/pages/TimedTestPage.tsx (2)** — `as any` for timestamp
**student-web/src/pages/ChatTutorPage.tsx (1)** — `as any` for timestamp

**super-admin/src/pages/TenantDetailPage.tsx (2)** — `as any` for timestamp

#### Packages — Production Code (55 in prod, 76 in tests)

**shared-services/src/autograde/exam-callables.ts (2)** — `as any` for
ExamStatus **shared-services/src/firebase/config.ts (1)** — `app as any`
**shared-services/src/ai/llm-wrapper.ts (1)** — `generationConfig as any`
**shared-services/src/realtime-db/index.ts (1)** — `Record<string, any>`
**shared-utils/src/pdf.ts (1)** — `as any` for canvas render
**shared-utils/src/validation.ts (1)** — `Record<string, any>`
**shared-hooks/src/queries/useSpaces.ts (2)** — `as any` for timestamp
**shared-ui/src/components/ui/scroll-area.tsx (1)** — `ref as any`
**shared-ui/src/components/DownloadPDFButton.tsx (1)** — `catch (err: any)`
**shared-ui/src/hooks/useStoryPointProgress.ts (1)** — `as any` for items **Test
files (76)** — Mock setups across shared-services and shared-stores tests

#### Functions — Production Code (~15 in prod, 50+ in tests)

**levelup/src/callable/save-space.ts** — `space: any`, `Record<string, any>`
**levelup/src/callable/create-item.ts** — Multiple `.filter((o: any) =>`
patterns **levelup/src/callable/record-item-attempt.ts** — `as any[]`
**autograde/src/callable/grade-question.ts** — `as any`
**analytics/src/schedulers/nightly-at-risk-detection.ts** — `summary as any`

### 1.4 Type Naming Issues

1. **Duplicate `Notification` interface** — `notification/notification.ts` vs
   `progress/analytics.ts`
2. **Duplicate `NotificationType`** — same modules, different union members
3. **`unknown` for answers** — `AnswerKey.correctAnswer: unknown`,
   `TestSubmission.answer: unknown` (acceptable but could be typed as
   discriminated union)
4. **`createdAt: unknown`** in `ManageNotificationsResponse` — should be
   `FirestoreTimestamp`

---

## 2. Implementation Plan

### Phase 2A: Domain Glossary & Branded Types

**2A.1 — Create Domain Glossary** (`docs/domain-glossary.md`)

Define all domain terms with Firestore collection paths:

| Term                | Definition                               | Collection Path                                                          |
| ------------------- | ---------------------------------------- | ------------------------------------------------------------------------ |
| **Tenant**          | School/institution (multi-tenant root)   | `/tenants/{tenantId}`                                                    |
| **School**          | Alias for Tenant in user-facing contexts | —                                                                        |
| **Class**           | A class/section within a tenant          | `/tenants/{tenantId}/classes/{classId}`                                  |
| **Student**         | Student profile within a tenant          | `/tenants/{tenantId}/students/{studentId}`                               |
| **Teacher**         | Teacher profile within a tenant          | `/tenants/{tenantId}/teachers/{teacherId}`                               |
| **Parent**          | Parent/guardian profile within a tenant  | `/tenants/{tenantId}/parents/{parentId}`                                 |
| **Space**           | A learning space (course/module)         | `/tenants/{tenantId}/spaces/{spaceId}`                                   |
| **StoryPoint**      | A section/chapter within a Space         | `/tenants/{tenantId}/spaces/{spaceId}/storyPoints/{storyPointId}`        |
| **Item**            | Content atom (question/material/etc.)    | `/tenants/{tenantId}/spaces/{spaceId}/storyPoints/{spId}/items/{itemId}` |
| **TestSession**     | Student's test/quiz attempt              | `/tenants/{tenantId}/digitalTestSessions/{sessionId}`                    |
| **Exam**            | Physical exam (AutoGrade)                | `/tenants/{tenantId}/exams/{examId}`                                     |
| **Submission**      | Student's answer sheet submission        | `/tenants/{tenantId}/submissions/{submissionId}`                         |
| **AcademicSession** | Academic year/term                       | `/tenants/{tenantId}/academicSessions/{sessionId}`                       |
| **Evaluation**      | AI/manual grading result                 | (embedded in QuestionSubmission/TestSubmission)                          |
| **Progress**        | Student learning progress                | `/tenants/{tenantId}/spaceProgress/{userId}_{spaceId}`                   |

**2A.2 — Add Branded Types** (`packages/shared-types/src/branded.ts`)

Create nominal/branded types for entity IDs:

```typescript
declare const __brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [__brand]: B };

export type TenantId = Brand<string, "TenantId">;
export type ClassId = Brand<string, "ClassId">;
export type StudentId = Brand<string, "StudentId">;
export type TeacherId = Brand<string, "TeacherId">;
export type ParentId = Brand<string, "ParentId">;
export type SpaceId = Brand<string, "SpaceId">;
export type StoryPointId = Brand<string, "StoryPointId">;
export type ItemId = Brand<string, "ItemId">;
export type ExamId = Brand<string, "ExamId">;
export type SubmissionId = Brand<string, "SubmissionId">;
export type UserId = Brand<string, "UserId">;
export type SessionId = Brand<string, "SessionId">;
export type AgentId = Brand<string, "AgentId">;

// Constructor helpers
export const TenantId = (id: string) => id as TenantId;
export const ClassId = (id: string) => id as ClassId;
// ... etc
```

**2A.3 — Export Branded Types from Barrel**

Update `packages/shared-types/src/index.ts` to export branded types.

### Phase 2B: Eliminate `any` Types

**Priority: Production code first, test code second.**

**Strategy by pattern:**

| Pattern                                        | Fix Strategy                                           | Files Affected           |
| ---------------------------------------------- | ------------------------------------------------------ | ------------------------ |
| `status as any` on StatusBadge                 | Widen StatusBadge props to accept all status unions    | ~12 files in teacher-web |
| `difficulty as any`                            | Use proper `StoryPoint['difficulty']` type             | 2 files                  |
| `payload as any` for questionType/materialType | Use type narrowing with `payload.questionType` checks  | 2 files                  |
| `Record<string, any>` for Firestore data       | Replace with proper entity types                       | ~8 files                 |
| `timestamp as any` for `.seconds` access       | Use `FirestoreTimestamp` type properly                 | ~6 files                 |
| `callback: (u: any) => void` in ItemEditor     | Type callbacks with proper `QuestionTypeData` subtypes | 1 large file             |
| `rubric: any` parameter                        | Replace with `UnifiedRubric`                           | 1 file                   |
| `err: any` in catch                            | Use `unknown` and narrow                               | 1 file                   |
| `as any` for Firebase config                   | Use `FirebaseApp` type assertion                       | 1 file                   |
| Test file mocks                                | Type mock objects properly or use `as unknown as Type` | ~76 files                |
| Function `any` in array callbacks              | Type with proper entity types                          | ~5 files                 |

**Detailed file-by-file changes:**

1. **`shared-ui/src/components/StatusBadge.tsx`** — Widen `status` prop type to
   accept all domain status strings (examine current props and extend)

2. **`teacher-web/src/components/spaces/ItemEditor.tsx`** — Replace all
   `(u: any) => void` callbacks with typed versions using discriminated union
   based on `QuestionType`

3. **`student-web/src/pages/DashboardPage.tsx`** — Replace `Record<string, any>`
   with `Exam` type for exam data

4. **`shared-services/src/realtime-db/index.ts`** — Replace
   `Record<string, any>` with generic `Record<string, unknown>`

5. **`shared-utils/src/validation.ts`** — Replace `Record<string, any>` with
   `Record<string, unknown>`

6. **All timestamp `as any` casts** — Import and use `FirestoreTimestamp` type
   consistently

7. **`shared-services/src/autograde/exam-callables.ts`** — Use proper
   `ExamStatus` type instead of `as any`

### Phase 2C: Fix Naming Duplication

1. **Rename** `progress/analytics.ts` `Notification` → `ProgressNotification`
2. **Rename** `progress/analytics.ts` `NotificationType` →
   `ProgressNotificationType`
3. **Update** `progress/index.ts` exports accordingly
4. **Verify** no consumers break

### Phase 2D: Fix `unknown` Usages in Shared Types

1. **`callable-types.ts:175`** — Change `createdAt: unknown` →
   `createdAt: FirestoreTimestamp`
2. **`answer-key.ts`** — Keep `unknown` for `correctAnswer` /
   `acceptableAnswers` (polymorphic by question type, proper pattern)
3. **`test-session.ts:29`** — Keep `unknown` for `answer` (same reason)

### Phase 2E: Add Zod Schemas at Firebase Read Boundaries

Create Zod schemas for all entity types that are read from Firestore in Cloud
Functions. These validate data at the boundary between Firestore's untyped reads
and our type system.

**New file: `packages/shared-types/src/schemas/index.ts`**

Schemas to create:

- `TenantSchema` — validates Tenant entity reads
- `ClassSchema` — validates Class entity reads
- `StudentSchema` — validates Student entity reads
- `TeacherSchema` — validates Teacher entity reads
- `SpaceSchema` — validates Space entity reads
- `ExamSchema` — validates Exam entity reads
- `SubmissionSchema` — validates Submission entity reads
- `ExamQuestionSchema` — validates ExamQuestion entity reads
- `QuestionSubmissionSchema` — validates QuestionSubmission entity reads

**Usage pattern in Cloud Functions:**

```typescript
const doc = await db.doc(`tenants/${tenantId}`).get();
const tenant = TenantSchema.parse({ id: doc.id, ...doc.data() });
// tenant is now fully typed and validated
```

**NOTE:** Zod will be added as a dependency to `packages/shared-types`.

### Phase 2F: Build & Verify

After each major change batch:

1. Run `pnpm build` from root
2. Run `pnpm lint` from root
3. Fix any type errors introduced

---

## 3. Acceptance Criteria Checklist

- [ ] Zero `any` types in entire codebase (production code)
- [ ] Zero `any` types in test code (or justified `as unknown as Type` pattern)
- [ ] Domain glossary exists at `docs/domain-glossary.md`
- [ ] Branded types created and exported from shared-types
- [ ] Zod schemas at Firebase read boundaries in Cloud Functions
- [ ] No naming duplications in shared-types
- [ ] `pnpm build` passes with zero errors
- [ ] `pnpm lint` passes with zero errors
- [ ] Changelog written to `docs/evolution/v1-type-system/changelog.md`
- [ ] Test report written to `docs/evolution/v1-type-system/test-report.md`

---

## 4. Risk Assessment

| Risk                                               | Mitigation                                                                     |
| -------------------------------------------------- | ------------------------------------------------------------------------------ |
| Branded types cause breaking changes               | Use gradual adoption — branded types are structurally compatible with `string` |
| Zod adds bundle size to frontend                   | Schemas only in shared-types, only imported in Cloud Functions                 |
| Test file `any` elimination is time-consuming      | Prioritize production code; use `as unknown as Type` pattern for test mocks    |
| StatusBadge prop widening could be over-permissive | Create a `DomainStatus` union type covering all valid status strings           |

---

## 5. Execution Order

1. Create domain glossary (2A.1)
2. Create branded types (2A.2-2A.3)
3. Fix naming duplication in shared-types (2C)
4. Fix `unknown` → `FirestoreTimestamp` in callable-types (2D)
5. Eliminate `any` in shared-types/shared-services/shared-stores production code
   (2B)
6. Eliminate `any` in apps production code (2B)
7. Eliminate `any` in Cloud Functions production code (2B)
8. Add Zod schemas (2E)
9. Eliminate `any` in test files (2B)
10. Build & verify (2F)
11. Write changelog and test report (Phase 3)
