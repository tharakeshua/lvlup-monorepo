# V3: Error Handling & Resource Lifecycle — Changelog

**Vertical**: V3 | **Cycle**: 1 | **Team**: Foundation Architect **Date**:
2026-03-07

---

## Added

### Error Type System

- **`packages/shared-types/src/error-types.ts`** — Unified error type
  definitions
  - `AppErrorCode` union type with 9 semantic error codes
  - `AppErrorResponse` standardized error response interface
  - `APP_ERROR_TO_HTTPS` / `HTTPS_TO_APP_ERROR` bidirectional mappings between
    application error codes and Firebase FunctionsErrorCode
  - `RATE_LIMITS` configuration object with 5 tiers (WRITE/30, READ/60, AI/10,
    AUTH/10, REPORT/5)
  - `ERROR_MESSAGES` user-friendly message map for all error codes

### Frontend Error Handling

- **`packages/shared-hooks/src/use-api-error.ts`** — `useApiError()` hook
  - Parses Firebase callable errors into typed `AppErrorCode`
  - Displays user-friendly toast notifications via Sonner
  - Development-mode console error logging
  - `getApiErrorMessage()` standalone utility for non-hook contexts

### Rate Limiting (All 30 Endpoints)

- **`functions/identity/src/utils/rate-limit.ts`** — Rate limiter for identity
  module
- **`functions/autograde/src/utils/rate-limit.ts`** — Rate limiter for autograde
  module
- **`functions/analytics/src/utils/rate-limit.ts`** — Rate limiter for analytics
  module
- Rate limiting added to all 30 callable endpoints across 4 function modules:
  - Write operations: 30 req/min (save*, create*, purchase\*)
  - Read operations: 60 req/min (list*, get*, manageNotifications)
  - AI/LLM operations: 10 req/min (chat, evaluate, extract, grade)
  - Auth operations: 10 req/min (switchTenant, joinTenant)
  - Report operations: 5 req/min (generateReport)
  - Bulk operations: 5 req/min (bulkImportStudents)

### Resource Lifecycle Schedulers

- **`functions/levelup/src/triggers/cleanup-stale-sessions.ts`** — Hourly
  cleanup of test sessions that have been `in_progress` for >24 hours, marking
  them as `abandoned`
- **`functions/levelup/src/triggers/cleanup-inactive-chats.ts`** — Daily cleanup
  (3AM UTC) of chat sessions inactive for >7 days, setting `isActive=false`
- **`functions/identity/src/triggers/on-tenant-deactivated.ts`** — Firestore
  trigger that suspends all active memberships when a tenant status changes to
  `suspended` or `expired`

## Changed

### Toast Standardization

- **`apps/teacher-web/src/main.tsx`** — Replaced shadcn/ui `Toaster` with
  `SonnerToaster` (richColors, top-right position) for consistency with other 4
  apps
- **`packages/shared-hooks/package.json`** — Added `sonner` as dependency for
  the `useApiError` hook

### Exports

- **`packages/shared-types/src/index.ts`** — Added
  `export * from './error-types'`
- **`packages/shared-hooks/src/index.ts`** — Added `useApiError` and
  `getApiErrorMessage` exports
- **`functions/levelup/src/index.ts`** — Added `cleanupStaleSessions` and
  `cleanupInactiveChats` exports
- **`functions/identity/src/index.ts`** — Added `onTenantDeactivated` export

## Security

- Verified `.gitignore` already contains `*-firebase-adminsdk-*.json` pattern
- Admin SDK key files exist locally but are not git-tracked (no git repo
  initialized)
