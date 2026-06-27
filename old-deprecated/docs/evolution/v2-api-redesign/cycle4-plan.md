# V2 API Redesign — Cycle 4 Plan

## Context

Cycles 1-3 consolidated the API from 53 to 37 active callable endpoints, added
Zod validation to 42 request schemas with `parseRequest()` at every entry point,
migrated frontend legacy calls, and hardened schemas with `firestoreId`
patterns, max string lengths, and array limits. Build passes cleanly (12/12
tasks, 0 errors).

### Current Endpoint Count

| Module    | Callable Endpoints | Notes                                                                                                   |
| --------- | ------------------ | ------------------------------------------------------------------------------------------------------- |
| Identity  | 15                 | 6 save\*, 3 auth/lifecycle, 3 tenant-lifecycle, 1 bulk, 1 preset, 1 export                              |
| LevelUp   | 17                 | 3 save\*, 4 assessment, 3 question-bank, 1 rubric, 1 chat, 1 review, 2 store, 1 notifications, 1 import |
| AutoGrade | 4                  | 1 save\*, 1 grade, 1 extract, 1 upload                                                                  |
| Analytics | 2                  | 1 summary, 1 report                                                                                     |
| **Total** | **38**             | All but 1 with Zod validation                                                                           |

---

## Audit Findings — Gaps Remaining

### GAP 1: Missing Zod Validation (1 endpoint)

**`functions/levelup/src/callable/save-space-review.ts`** is the only callable
that does NOT use `parseRequest()` with a Zod schema. It uses the legacy
`request.data as SaveReviewRequest` pattern with manual `if (!field)` checks. No
`SaveSpaceReviewRequestSchema` exists in `callable-schemas.ts`.

### GAP 2: Direct `httpsCallable()` Bypassing shared-services (13 frontend files)

Multiple frontend files call `httpsCallable()` directly instead of using the
`shared-services` wrapper layer:

**student-web (6 files):** | File | Direct Calls | |------|-------------| |
`hooks/useTestSession.ts` | startTestSession, submitTestSession,
recordItemAttempt | | `hooks/useChatTutor.ts` | sendChatMessage | |
`hooks/useEvaluateAnswer.ts` | evaluateAnswer | | `pages/CheckoutPage.tsx` |
purchaseSpace | | `pages/StoreDetailPage.tsx` | listStoreSpaces (or similar) | |
`pages/StoreListPage.tsx` | listStoreSpaces |

**teacher-web (4 files):** | File | Direct Calls | |------|-------------| |
`components/rubric/RubricPresetPicker.tsx` | saveRubricPreset | |
`components/spaces/QuestionBankImportDialog.tsx` | importFromBank | |
`pages/spaces/QuestionBankPage.tsx` | listQuestionBank, saveQuestionBankItem | |
`pages/exams/GradingReviewPage.tsx` | gradeQuestion (or similar) |

**super-admin (3 files):** | File | Direct Calls | |------|-------------| |
`pages/GlobalPresetsPage.tsx` | saveGlobalEvaluationPreset | |
`components/tenant-detail/DeleteTenantDialog.tsx` | deleteTenant (GHOST —
endpoint doesn't exist!) | | `pages/SystemHealthPage.tsx` | unknown callable |

### GAP 3: Ghost Endpoint Reference

`apps/super-admin/src/components/tenant-detail/DeleteTenantDialog.tsx` calls
`deleteTenant` which does **not exist** as an exported callable function. This
is a runtime error waiting to happen.

### GAP 4: Missing Frontend Wrappers in shared-services

21 backend endpoints have no corresponding wrapper in `shared-services`:

| Category         | Missing Wrappers                                                       |
| ---------------- | ---------------------------------------------------------------------- |
| Assessment       | startTestSession, submitTestSession, evaluateAnswer, recordItemAttempt |
| Question Bank    | saveQuestionBankItem, listQuestionBank, importFromBank                 |
| Rubric           | saveRubricPreset                                                       |
| Chat             | sendChatMessage                                                        |
| Reviews          | saveSpaceReview                                                        |
| Store            | listStoreSpaces, purchaseSpace                                         |
| Identity         | saveGlobalEvaluationPreset, joinTenant                                 |
| Tenant Lifecycle | (wrappers exist: deactivateTenant, reactivateTenant, exportTenantData) |

### GAP 5: Error Response Format Not Standardized

API_REDESIGN.md specifies a structured error format:

```typescript
interface ErrorResponse {
  error: {
    code: string; // 'INVALID_TRANSITION', 'VALIDATION_ERROR', etc.
    message: string;
    details?: Record<string, any>;
  };
}
```

**Current state:** All 38 endpoints use Firebase `HttpsError(code, message)`
without a `details` field. The `parseRequest()` utility flattens Zod errors into
a single string — no structured field-level error details are passed to the
client.

**Specific issues:**

- Status transition errors in `save-space.ts` and `save-exam.ts` don't include
  `allowedTransitions` in error response
- `parseRequest()` discards Zod's structured issue array, formatting it as a
  flat string
- No mapping from Firebase error codes to domain-specific error codes

### GAP 6: Response Format Inconsistencies

Most save endpoints return `{ id: string, created: boolean }` (the
`SaveResponse` type), but some deviate:

| Endpoint                     | Response Shape                         | Issue                                       |
| ---------------------------- | -------------------------------------- | ------------------------------------------- |
| `saveGlobalEvaluationPreset` | `{ id, created?, deleted? }`           | Optional fields instead of consistent shape |
| `saveQuestionBankItem`       | `{ id, created }` or `{ id, deleted }` | Two different shapes                        |
| `saveRubricPreset`           | `{ id, created }` or `{ id, deleted }` | Two different shapes                        |
| `saveSpaceReview`            | `{ success, isUpdate }`                | Doesn't follow SaveResponse pattern         |
| `extractQuestions`           | `questions: unknown[]`                 | Loose typing on question array              |

### GAP 7: Potentially Dead Wrappers in shared-services

8 wrappers are exported from `shared-services` but appear unused in any frontend
app:

- `callSaveStudent`, `callSaveTeacher`, `callSaveParent`,
  `callSaveAcademicSession`
- `callManageNotifications`, `callSaveSpace`, `callSaveStoryPoint`,
  `callSaveItem`

These may be used via indirect imports or dynamic calls — needs confirmation
before removal.

---

## Cycle 4 Scope

### Priority 1: Critical Fixes

#### 1A. Add Zod Validation to `saveSpaceReview`

- Create `SaveSpaceReviewRequestSchema` in `callable-schemas.ts`
- Replace `request.data as SaveReviewRequest` with
  `parseRequest(request.data, SaveSpaceReviewRequestSchema)`
- Apply same `firestoreId`, max-length constraints as all other schemas
- **Files:** `packages/shared-types/src/schemas/callable-schemas.ts`,
  `functions/levelup/src/callable/save-space-review.ts`

#### 1B. Fix Ghost `deleteTenant` Reference

- Audit `DeleteTenantDialog.tsx` — determine if `deleteTenant` should be
  `deactivateTenant` (which exists) or if a new endpoint is needed
- Fix the frontend reference to point to the correct endpoint
- **File:**
  `apps/super-admin/src/components/tenant-detail/DeleteTenantDialog.tsx`

### Priority 2: Frontend Service Layer Consolidation

#### 2A. Create Missing Wrappers in shared-services

Add wrappers for the 14 endpoints called directly from frontend apps:

- **Assessment:** `callStartTestSession`, `callSubmitTestSession`,
  `callEvaluateAnswer`, `callRecordItemAttempt`
- **Question Bank:** `callSaveQuestionBankItem`, `callListQuestionBank`,
  `callImportFromBank`
- **Rubric:** `callSaveRubricPreset`
- **Chat:** `callSendChatMessage`
- **Reviews:** `callSaveSpaceReview`
- **Store:** `callListStoreSpaces`, `callPurchaseSpace`
- **Identity:** `callSaveGlobalEvaluationPreset`, `callJoinTenant`

Organize into new service files:

- `packages/shared-services/src/levelup/assessment-callables.ts`
- `packages/shared-services/src/levelup/content-callables.ts` (question bank,
  rubric, reviews)
- `packages/shared-services/src/levelup/store-callables.ts`
- `packages/shared-services/src/levelup/chat-callables.ts`
- `packages/shared-services/src/levelup/index.ts`

#### 2B. Migrate Direct `httpsCallable()` Calls

Update the 13 frontend files to import from `@levelup/shared-services` instead
of calling `httpsCallable()` directly. This ensures:

- Consistent function region configuration
- Centralized error handling
- Type-safe request/response contracts
- Single source of truth for endpoint names

### Priority 3: Error Response Enrichment

#### 3A. Enrich `parseRequest()` with Structured Details

Update `parseRequest()` in all 4 function modules to pass Zod's structured
issues via HttpsError's `details` parameter:

```typescript
throw new HttpsError("invalid-argument", `Invalid request: ${message}`, {
  validationErrors: result.error.issues.map((i) => ({
    field: i.path.join("."),
    message: i.message,
    code: i.code,
  })),
});
```

- **Files:** `functions/*/src/utils/parse-request.ts` (4 files)

#### 3B. Add `details` to Status Transition Errors

Update `save-space.ts` and `save-exam.ts` to include transition context:

```typescript
throw new HttpsError("failed-precondition", message, {
  currentStatus,
  requestedStatus: data.status,
  allowedTransitions: ALLOWED_TRANSITIONS[currentStatus],
});
```

- **Files:** `functions/levelup/src/callable/save-space.ts`,
  `functions/autograde/src/callable/save-exam.ts`

### Priority 4: Response Format Normalization (Deferred)

The following are noted but **deferred to Cycle 5** to keep this cycle focused:

- Normalize save-with-delete response shapes (`saveQuestionBankItem`,
  `saveRubricPreset`, `saveGlobalEvaluationPreset`) to consistently return
  `{ id, created, deleted? }`
- Normalize `saveSpaceReview` to return `{ id, created }` instead of
  `{ success, isUpdate }`
- Strengthen `extractQuestions` response typing from `unknown[]` to a validated
  question type
- Audit and confirm status of the 8 potentially dead wrappers

---

## Acceptance Criteria

- [ ] `saveSpaceReview` validates input via `parseRequest()` with
      `SaveSpaceReviewRequestSchema`
- [ ] `DeleteTenantDialog.tsx` references a valid endpoint (no ghost calls)
- [ ] All 14 missing shared-services wrappers are created with proper typing
- [ ] 13 frontend files migrated from direct `httpsCallable()` to
      shared-services wrappers
- [ ] `parseRequest()` passes structured Zod validation details in error
      response
- [ ] Status transition errors include `details` with allowed transitions
- [ ] `pnpm build` passes cleanly
- [ ] `pnpm lint` passes (no new lint errors)

---

## Files Modified (Estimated)

| Category           | Files                                                                                           | Count   |
| ------------------ | ----------------------------------------------------------------------------------------------- | ------- |
| Zod Schema         | `packages/shared-types/src/schemas/callable-schemas.ts`                                         | 1       |
| Backend Validation | `functions/levelup/src/callable/save-space-review.ts`                                           | 1       |
| parseRequest       | `functions/*/src/utils/parse-request.ts`                                                        | 4       |
| Status Errors      | `functions/levelup/src/callable/save-space.ts`, `functions/autograde/src/callable/save-exam.ts` | 2       |
| New Wrappers       | `packages/shared-services/src/levelup/*.ts`                                                     | 5       |
| Wrapper Exports    | `packages/shared-services/src/index.ts`, `src/levelup/index.ts`                                 | 2       |
| Frontend Migration | `apps/student-web/src/**/*.ts(x)`                                                               | 6       |
| Frontend Migration | `apps/teacher-web/src/**/*.ts(x)`                                                               | 4       |
| Frontend Migration | `apps/super-admin/src/**/*.ts(x)`                                                               | 3       |
| **Total**          |                                                                                                 | **~28** |

## Risk Assessment

| Risk                                                                | Mitigation                                                           |
| ------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Frontend wrapper migration could break runtime behavior             | Match exact request/response types from existing direct calls        |
| Adding `details` to HttpsError could affect frontend error handlers | `details` is additive — existing error handling won't break          |
| Ghost `deleteTenant` fix could affect admin UI workflow             | Confirm with product whether deactivate suffices or delete is needed |
