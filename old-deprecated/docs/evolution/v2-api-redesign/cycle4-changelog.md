# Cycle 4 Changelog — API Redesign & Consolidation

**Date:** 2026-03-08

## Priority 1A — Zod Validation for saveSpaceReview

- Added `SaveSpaceReviewRequestSchema` to
  `packages/shared-types/src/schemas/callable-schemas.ts`
- Replaced manual validation in
  `functions/levelup/src/callable/save-space-review.ts` with `parseRequest()` +
  Zod schema
- Removed local `SaveReviewRequest` interface and manual `if` checks for
  `tenantId`, `spaceId`, `rating`

## Priority 1B — Ghost Endpoint Fix

- Rewrote `apps/super-admin/src/components/tenant-detail/DeleteTenantDialog.tsx`
  - Replaced non-existent `deleteTenant` callable with `callDeactivateTenant`
    from `@levelup/shared-services`
  - Updated UI copy from "Delete" to "Deactivate" to reflect actual backend
    behaviour
  - Removed direct `httpsCallable` import

## Priority 2A — New Shared-Services Wrappers

Created typed callable wrappers for 14 backend endpoints:

- **`packages/shared-services/src/levelup/assessment-callables.ts`** (NEW)
  - `callStartTestSession`, `callSubmitTestSession`, `callEvaluateAnswer`,
    `callRecordItemAttempt`
- **`packages/shared-services/src/levelup/content-callables.ts`** (NEW)
  - `callSaveQuestionBankItem`, `callListQuestionBank`, `callImportFromBank`,
    `callSaveRubricPreset`, `callSaveSpaceReview`
- **`packages/shared-services/src/levelup/store-callables.ts`** (NEW)
  - `callListStoreSpaces`, `callPurchaseSpace`
- **`packages/shared-services/src/levelup/chat-callables.ts`** (NEW)
  - `callSendChatMessage`
- **`packages/shared-services/src/auth/auth-callables.ts`** (UPDATED)
  - `callSaveGlobalEvaluationPreset`, `callJoinTenant`
- **`packages/shared-services/src/levelup/index.ts`** (NEW) — barrel re-exports
- Updated `packages/shared-services/src/auth/index.ts` and
  `packages/shared-services/src/index.ts`

## Priority 2B — Frontend Migration (13 files)

Migrated all frontend files from direct `httpsCallable()` to shared-services
wrappers:

| File                                                         | Before                                                                                | After                                               |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `student-web/hooks/useTestSession.ts`                        | `httpsCallable(fn, 'startTestSession')`                                               | `callStartTestSession` / `callSubmitTestSession`    |
| `student-web/hooks/useChatTutor.ts`                          | `httpsCallable(fn, 'sendChatMessage')`                                                | `callSendChatMessage`                               |
| `student-web/hooks/useEvaluateAnswer.ts`                     | `httpsCallable(fn, 'evaluateAnswer')`                                                 | `callEvaluateAnswer`                                |
| `student-web/pages/CheckoutPage.tsx`                         | `httpsCallable(fn, 'purchaseSpace')`                                                  | `callPurchaseSpace`                                 |
| `student-web/pages/StoreDetailPage.tsx`                      | `httpsCallable(fn, 'purchaseSpace')`                                                  | `callPurchaseSpace`                                 |
| `student-web/pages/StoreListPage.tsx`                        | `httpsCallable(fn, 'listStoreSpaces')`                                                | `callListStoreSpaces`                               |
| `teacher-web/components/rubric/RubricPresetPicker.tsx`       | `httpsCallable(fn, 'saveRubricPreset')`                                               | `callSaveRubricPreset`                              |
| `teacher-web/components/spaces/QuestionBankImportDialog.tsx` | `httpsCallable(fn, 'importFromBank')`                                                 | `callImportFromBank`                                |
| `teacher-web/pages/spaces/QuestionBankPage.tsx`              | `httpsCallable(fn, 'listQuestionBank')` / `httpsCallable(fn, 'saveQuestionBankItem')` | `callListQuestionBank` / `callSaveQuestionBankItem` |
| `teacher-web/pages/exams/GradingReviewPage.tsx`              | `httpsCallable(fn, 'gradeQuestion')`                                                  | `callGradeQuestion`                                 |
| `super-admin/pages/GlobalPresetsPage.tsx`                    | `httpsCallable(fn, 'saveGlobalEvaluationPreset')`                                     | `callSaveGlobalEvaluationPreset`                    |
| `super-admin/pages/SystemHealthPage.tsx`                     | `httpsCallable(fn, 'saveTenant')`                                                     | `callSaveTenant`                                    |

**Note:** `useSaveAnswer` in `useTestSession.ts` kept as raw `httpsCallable` —
its request shape (`sessionId`, `itemId`, `answer`, `timeSpentSeconds`) doesn't
match `RecordItemAttemptRequestSchema` (`spaceId`, `storyPointId`, `score`,
`maxScore`, `correct`). This is a pre-existing contract mismatch that needs a
separate backend endpoint or schema alignment.

## Priority 3A — parseRequest Enrichment

Updated all 4 `parseRequest()` implementations with structured Zod validation
details:

- `functions/levelup/src/utils/parse-request.ts`
- `functions/identity/src/utils/parse-request.ts`
- `functions/autograde/src/utils/parse-request.ts`
- `functions/analytics/src/utils/parse-request.ts`

Each now passes a `details` object to `HttpsError`:

```typescript
{
  validationErrors: [{ field, message, code }];
}
```

## Priority 3B — Status Transition Error Details

Added structured `details` parameter to status transition `HttpsError` throws:

- `functions/levelup/src/callable/save-space.ts` —
  `{ currentStatus, requestedStatus, allowedTransitions }`
- `functions/autograde/src/callable/save-exam.ts` —
  `{ currentStatus, requestedStatus, allowedTransitions }`

## Build

All packages build successfully:

- `shared-types` (tsup)
- `shared-services` (tsc)
- `functions-levelup`, `functions-identity`, `functions-analytics`,
  `functions-autograde` (tsc)
- `teacher-web`, `student-web`, `super-admin` (vite)

**Note:** `.local-deps` directories require manual sync after
`shared-types`/`shared-services` rebuild because `tsup` breaks hardlinks when
cleaning output. The pnpm store copies at `node_modules/.pnpm/@levelup+shared-*`
must also be synced.
