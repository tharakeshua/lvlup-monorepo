# V2: API Redesign & Consolidation — Changelog

## Changes Made

### 1. Zod Request Schemas (NEW)

- **Created** `packages/shared-types/src/schemas/callable-schemas.ts` with 26
  Zod request schemas covering all callable endpoints
- **Updated** `packages/shared-types/src/schemas/index.ts` to re-export callable
  schemas
- **Updated** `packages/shared-types/src/index.ts` to use `export *` for schemas
  (previously named exports only)

### 2. parseRequest Utility (NEW)

- **Created** `functions/*/src/utils/parse-request.ts` in all 4 function modules
- Wraps `schema.safeParse()` and converts `ZodError` to
  `HttpsError('invalid-argument')` with field-level details
- **Updated** each module's `utils/index.ts` to re-export `parseRequest`

### 3. Zod Validation at Callable Entry Points

- **Updated** 29 callable endpoints to replace `request.data as FooRequest` with
  `parseRequest(request.data, FooRequestSchema)`
- All callables now validate input data at runtime before processing

**Identity (12 files):**

- save-tenant.ts, save-class.ts, save-student.ts, save-teacher.ts,
  save-parent.ts
- save-academic-session.ts, manage-notifications.ts, bulk-import-students.ts
- save-global-preset.ts, create-org-user.ts, switch-active-tenant.ts,
  join-tenant.ts

**LevelUp (11 files):**

- save-space.ts, save-story-point.ts, save-item.ts, manage-notifications.ts
- start-test-session.ts, submit-test-session.ts, evaluate-answer.ts
- send-chat-message.ts, record-item-attempt.ts, list-store-spaces.ts,
  purchase-space.ts

**AutoGrade (4 files):**

- save-exam.ts, grade-question.ts, extract-questions.ts, upload-answer-sheets.ts

**Analytics (2 files):**

- get-summary.ts, generate-report.ts

### 4. Frontend Migration

- **apps/teacher-web/src/pages/exams/ExamDetailPage.tsx**: Replaced
  `callPublishExam`, `callReleaseExamResults`, `callLinkExamToSpace` with
  `callSaveExam`; replaced `callGenerateExamResultPdf` with `callGenerateReport`
- **apps/parent-web/src/pages/ExamResultsPage.tsx**: Replaced
  `callGenerateExamResultPdf` with `callGenerateReport`
- **apps/admin-web/src/pages/ReportsPage.tsx**: Replaced
  `callGenerateExamResultPdf` and `callGenerateClassReportPdf` with
  `callGenerateReport`

### 5. Legacy Wrapper Cleanup

**packages/shared-services/src/auth/auth-callables.ts:**

- Removed: `callCreateTenant`, `callUpdateTeacherPermissions` and their
  interfaces
- Kept: `callSwitchActiveTenant` (still used by shared-stores/auth-store.ts)

**packages/shared-services/src/autograde/exam-callables.ts:**

- Removed: `callUpdateExam`, `callPublishExam`, `callReleaseExamResults`,
  `callLinkExamToSpace`

**packages/shared-services/src/reports/pdf-callables.ts:**

- Removed: `callGenerateExamResultPdf`, `callGenerateProgressReportPdf`,
  `callGenerateClassReportPdf` and their interfaces

**Updated re-exports in:**

- `packages/shared-services/src/auth/index.ts`
- `packages/shared-services/src/reports/index.ts`

### 6. Stale Build Artifacts

- **Deleted** 39 stale `.d.ts`/`.js`/`.js.map` files from
  `functions/*/lib/callable/` referencing old pre-consolidation endpoints

### 7. Dependency Updates

- **Added** `zod: ^4.3.6` to `functions/identity/package.json`,
  `functions/levelup/package.json`, `functions/autograde/package.json`,
  `functions/analytics/package.json`

### 8. Type Narrowing Fix

- **Fixed** `functions/levelup/src/callable/save-item.ts:158` — added `typeof`
  check for `data.meta.totalPoints` to satisfy strict typing from Zod-inferred
  `Record<string, unknown>`

## Breaking Changes

- **Frontend**: `callGenerateExamResultPdf`, `callGenerateClassReportPdf`,
  `callGenerateProgressReportPdf` removed from `@levelup/shared-services`. Use
  `callGenerateReport({ type: 'exam-result' | 'class' | 'progress', ... })`
  instead.
- **Frontend**: `callPublishExam`, `callReleaseExamResults`,
  `callLinkExamToSpace`, `callUpdateExam` removed. Use
  `callSaveExam({ id, tenantId, data: { status | linkedSpaceId | ... } })`
  instead.
- **Frontend**: `callCreateTenant`, `callUpdateTeacherPermissions` removed.
  These backend endpoints no longer exist (were consolidated in V1).
