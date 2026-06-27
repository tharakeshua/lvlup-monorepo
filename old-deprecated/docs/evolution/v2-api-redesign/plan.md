# V2: API Redesign & Consolidation — Plan

## Current State Assessment

### Consolidation Status: ~90% Complete

The source code has already been consolidated from 53 endpoints to 30 callable
endpoints using the `save*` upsert pattern. All `index.ts` files export only
consolidated names. Old source files have been removed.

| Module    | Original | Consolidated (src/) | Target (API_REDESIGN.md) |
| --------- | -------- | ------------------- | ------------------------ |
| Identity  | 21       | 12                  | 8                        |
| LevelUp   | 17       | 12                  | 9                        |
| AutoGrade | 9        | 4                   | 5                        |
| Analytics | 5        | 2                   | 3                        |
| **Total** | **53**   | **30**              | **25**                   |

### Remaining Gaps

1. **Zod validation: 0%** — No callable validates input with Zod. All use
   `as RequestType` type assertions with ad-hoc `if (!field)` checks.
2. **Legacy frontend wrappers still in use:**
   - `callCreateOrgUser` → admin-web/UsersPage.tsx
   - `callPublishExam`, `callReleaseExamResults`, `callLinkExamToSpace` →
     teacher-web/ExamDetailPage.tsx
   - `callGenerateExamResultPdf` → teacher-web/ExamDetailPage,
     parent-web/ExamResultsPage, admin-web/ReportsPage
   - `callGenerateClassReportPdf` → admin-web/ReportsPage
3. **Stale `.d.ts` files in lib/**: Old compiled output from pre-consolidation
   still present.
4. **Dead legacy wrappers**: `callCreateTenant`, `callUpdateTeacherPermissions`,
   `callSwitchActiveTenant`, `callUpdateExam`, `callGenerateProgressReportPdf`
   are exported but never imported.

---

## Implementation Plan

### Step 1: Create Zod Request Schemas

**File:** `packages/shared-types/src/schemas/callable-schemas.ts`

Create Zod schemas matching every request type in `callable-types.ts`:

- `SaveTenantRequestSchema`, `SaveClassRequestSchema`,
  `SaveStudentRequestSchema`
- `SaveTeacherRequestSchema`, `SaveParentRequestSchema`,
  `SaveAcademicSessionRequestSchema`
- `ManageNotificationsRequestSchema`, `BulkImportStudentsRequestSchema`
- `SaveSpaceRequestSchema`, `SaveStoryPointRequestSchema`,
  `SaveItemRequestSchema`
- `SaveExamRequestSchema`, `GradeQuestionRequestSchema`
- `GetSummaryRequestSchema`, `GenerateReportRequestSchema`
- Also: `ExtractQuestionsRequestSchema`, `UploadAnswerSheetsRequestSchema`
- Also: `SwitchActiveTenantRequestSchema`, `JoinTenantRequestSchema`,
  `CreateOrgUserRequestSchema`
- Also: `StartTestSessionRequestSchema`, `SubmitTestSessionRequestSchema`
- Also: `EvaluateAnswerRequestSchema`, `SendChatMessageRequestSchema`
- Also: `RecordItemAttemptRequestSchema`, `ListStoreSpacesRequestSchema`,
  `PurchaseSpaceRequestSchema`
- Also: `SaveGlobalPresetRequestSchema`

Export from `packages/shared-types/src/schemas/index.ts` and
`packages/shared-types/src/index.ts`.

### Step 2: Add Zod Validation to All Callable Entry Points

For each of the 30 callable endpoints:

1. Import the corresponding Zod request schema
2. Replace `const data = request.data as FooRequest` with
   `const data = FooRequestSchema.parse(request.data)`
3. Wrap parse errors to return user-friendly
   `HttpsError('invalid-argument', ...)` messages
4. Create a shared `parseRequest` utility to DRY up the pattern

### Step 3: Migrate Frontend Legacy Calls

Update 4 frontend files to use consolidated wrappers:

- `apps/admin-web/src/pages/UsersPage.tsx` → Replace `callCreateOrgUser` with
  `callSaveStudent`/`callSaveTeacher`
- `apps/teacher-web/src/pages/exams/ExamDetailPage.tsx` → Replace
  `callPublishExam`/`callReleaseExamResults`/`callLinkExamToSpace` with
  `callSaveExam`, replace `callGenerateExamResultPdf` with `callGenerateReport`
- `apps/parent-web/src/pages/ExamResultsPage.tsx` → Replace
  `callGenerateExamResultPdf` with `callGenerateReport`
- `apps/admin-web/src/pages/ReportsPage.tsx` → Replace
  `callGenerateExamResultPdf`/`callGenerateClassReportPdf` with
  `callGenerateReport`

### Step 4: Remove Legacy Wrappers from shared-services

- `auth-callables.ts`: Remove `callCreateTenant`, `callCreateOrgUser`,
  `callUpdateTeacherPermissions`, `callSwitchActiveTenant` and their interfaces
- `exam-callables.ts`: Remove `callUpdateExam`, `callPublishExam`,
  `callReleaseExamResults`, `callLinkExamToSpace`
- `pdf-callables.ts`: Remove `callGenerateExamResultPdf`,
  `callGenerateProgressReportPdf`, `callGenerateClassReportPdf` and their
  interfaces
- Update `auth/index.ts`, `autograde/index.ts`, `reports/index.ts` re-exports

### Step 5: Clean Up Stale Build Artifacts

- Remove old `.d.ts` files in `functions/*/lib/callable/` that reference deleted
  source files
- Run `pnpm build` to regenerate clean `lib/` output

### Step 6: Verify

- `pnpm build` — all modules compile
- `pnpm lint` — no lint errors
- Write test report and changelog

---

## Acceptance Criteria

- [ ] Every callable endpoint validates input via Zod schema parse
- [ ] No frontend code imports legacy wrapper functions
- [ ] No dead/unused callable wrappers in shared-services
- [ ] `pnpm build` passes cleanly
- [ ] `pnpm lint` passes cleanly
- [ ] Stale `.d.ts` files removed from lib/ directories
