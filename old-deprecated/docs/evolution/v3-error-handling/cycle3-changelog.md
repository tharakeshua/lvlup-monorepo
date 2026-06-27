# V3: Error Handling & Resource Lifecycle — Cycle 3 Changelog

**Vertical**: V3 | **Cycle**: 3 | **Team**: Foundation Architect **Date**:
2026-03-07

---

## Added

### Error Recovery Hints

- **`packages/shared-types/src/error-types.ts`** — Added `ERROR_RECOVERY_HINTS`
  map with user-facing recovery suggestions for each `AppErrorCode`:
  - `VALIDATION_FAILED` → "Check the form fields and try again."
  - `NOT_FOUND` → "The item may have been deleted. Try refreshing the page."
  - `PERMISSION_DENIED` → "Contact your administrator if you need access."
  - `UNAUTHENTICATED` → "Please sign in and try again."
  - `RATE_LIMITED` → "Wait a few seconds before trying again."
  - `CONFLICT` → "Refresh the page to see the latest version."
  - `PRECONDITION_FAILED` → "Refresh the page and verify the current status."
  - `INTERNAL_ERROR` → "If the problem persists, contact support."
  - `QUOTA_EXCEEDED` → "Contact your administrator to upgrade your plan."

### Cascade Delete Trigger

- **`functions/autograde/src/triggers/on-exam-deleted.ts`** (NEW) — Firestore
  trigger for exam cascade deletion:
  - Deletes `examQuestions` subcollection
  - Deletes all related submissions and their `questionSubmissions`
    subcollections
  - Deletes `examAnalytics` document
  - Decrements tenant `stats.totalExams`
  - Uses chunked batch deletes (max 450 per batch) with recursion for large
    collections

## Changed

### Enhanced Error Toasts with Recovery Hints

- **`packages/shared-hooks/src/use-api-error.ts`** — Updated `useApiError()`
  hook to show `ERROR_RECOVERY_HINTS` as toast `description` alongside error
  messages, giving users actionable next steps

### Rate Limiting (2 missing endpoints)

- **`functions/identity/src/callable/deactivate-tenant.ts`** — Added
  `enforceRateLimit(tenantId, callerUid, 'write', 30)` after auth check
- **`functions/identity/src/callable/reactivate-tenant.ts`** — Added
  `enforceRateLimit(tenantId, callerUid, 'write', 30)` after auth check

### Exports

- **`functions/autograde/src/index.ts`** — Added `onExamDeleted` export

## Status

- **All callable endpoints** now have rate limiting (32/32)
- **Error toasts** now show recovery suggestions via `ERROR_RECOVERY_HINTS`
- **Cascade deletes**: exam deletion fully covered (class deletion trigger
  exists but disabled due to deployment type conflict)
- **Build**: 12/12 tasks pass, 0 errors
