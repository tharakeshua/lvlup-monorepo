# V3: Error Handling & Resource Lifecycle — Implementation Plan

**Vertical**: V3 | **Cycle**: 1 | **Team**: Foundation Architect **Status**:
Planning → Implementation **Dependencies**: V1 (Type System) ✅ | V2 (API
Redesign) ✅

---

## Current State Analysis

### What Exists

- Firebase `HttpsError` used consistently across all 30 callables
- Zod request validation via `parseRequest()` on all endpoints
- Rate limiting in levelup module (`enforceRateLimit()` — Firestore-based
  sliding window)
- Test session expiry scheduler (every 5 min, 30s grace period)
- Cascade delete triggers: `onSpaceDeleted`, `onClassDeleted`,
  `onStudentDeleted`
- Global `ErrorBoundary` in shared-ui (class component)
- Sonner installed in 2/5 apps (admin-web, student-web)

### Gaps Identified

1. **No unified error class hierarchy** — raw HttpsError strings scattered
2. **No standardized error response format** — relies on Firebase's default
   shape
3. **Rate limiting missing** from 28/30 endpoints (only chat has it)
4. **No enhanced AI rate limiting** — LLM calls have no per-user throttling
5. **ErrorBoundary exists but no toast integration** for operational errors
6. **Sonner missing** from teacher-web, parent-web, super-admin
7. **No TTL for chat sessions** — grow unbounded
8. **Test session TTL** only handles deadline-based expiry, not 24h stale
   cleanup
9. **No cleanup for orphaned data** beyond existing triggers
10. **Firebase admin SDK key files** exist in project root (security risk)

---

## Implementation Plan

### 1. Unified Error Classes (Backend)

**File**: `functions/shared/src/errors.ts` (new shared utils)

Create `AppError` base class extending `HttpsError` with typed error codes:

```typescript
type AppErrorCode =
  | "VALIDATION_FAILED"
  | "NOT_FOUND"
  | "PERMISSION_DENIED"
  | "UNAUTHENTICATED"
  | "RATE_LIMITED"
  | "CONFLICT"
  | "PRECONDITION_FAILED"
  | "INTERNAL_ERROR"
  | "QUOTA_EXCEEDED";
```

Mapping to Firebase error codes for transport. Each callable wraps in a
try-catch that converts unhandled errors to `AppError('INTERNAL_ERROR')`.

### 2. Standardized Error Response Type

**File**: `packages/shared-types/src/error-types.ts`

```typescript
interface AppErrorResponse {
  code: AppErrorCode;
  message: string;
  details?: Record<string, unknown>;
  requestId?: string;
}
```

### 3. Rate Limiting for All Callable Functions

**Strategy**: Move `enforceRateLimit` to a shared location. Create rate limit
config per endpoint category:

| Category     | Max/min | Endpoints                                                               |
| ------------ | ------- | ----------------------------------------------------------------------- |
| Write ops    | 30/min  | save*, create*, bulk\*                                                  |
| Read ops     | 60/min  | list*, get*, manage\*                                                   |
| AI/LLM calls | 10/min  | sendChatMessage, evaluateAnswer, extractQuestions, gradeQuestion(retry) |
| Auth ops     | 10/min  | switchActiveTenant, joinTenant                                          |
| Reports      | 5/min   | generateReport                                                          |

### 4. Error Boundary Enhancement (Frontend)

- Add Sonner dependency to teacher-web, parent-web, super-admin
- Create `AppErrorBoundary` component that:
  - Catches render errors (existing behavior)
  - Integrates with Sonner toast for API errors
  - Provides reset/retry functionality
- Create `useApiError` hook in shared-hooks for callable error handling with
  toast

### 5. Resource Lifecycle — TTLs & Cleanup

**5a. Stale Test Sessions (24h)**

- Add `cleanupStaleTestSessions` scheduled function
- Query `in_progress` sessions older than 24h (regardless of deadline)
- Mark as `abandoned` (new status), not `expired`

**5b. Inactive Chat Sessions (7d)**

- Add `cleanupInactiveChatSessions` scheduled function
- Query `chatSessions` where `updatedAt < now - 7d` and `isActive === true`
- Set `isActive = false`

**5c. Orphaned Data Handling**

- Extend existing triggers for tenant deactivation
- Add `onTenantDeactivated` trigger to suspend all memberships

### 6. Security Hardening

- Verify `.gitignore` covers `*-firebase-adminsdk-*.json` ✅ (already present)
- The admin SDK JSON files exist in project root but aren't git-tracked (no git
  repo)
- Leave as-is since no git repo is initialized

---

## File Changes Summary

### New Files

1. `packages/shared-types/src/error-types.ts` — Error type definitions
2. `packages/shared-utils/src/errors.ts` — Frontend error utilities
3. `packages/shared-hooks/src/use-api-error.ts` — API error hook with toast
4. `functions/levelup/src/triggers/cleanup-stale-sessions.ts` — 24h test session
   cleanup
5. `functions/levelup/src/triggers/cleanup-inactive-chats.ts` — 7d chat session
   cleanup

### Modified Files

1. `functions/*/src/callable/*.ts` — Add rate limiting to all endpoints
2. `functions/*/src/utils/rate-limit.ts` — Extract to shared util, add config
3. `packages/shared-ui/src/components/layout/ErrorBoundary.tsx` — Enhanced with
   toast
4. `packages/shared-ui/src/index.ts` — Export new components
5. `apps/*/package.json` — Add sonner dependency where missing
6. `apps/*/src/main.tsx` — Add SonnerToaster
7. `functions/*/src/index.ts` — Export new cleanup functions

### Acceptance Criteria

- [ ] All 30 callable endpoints have rate limiting
- [ ] Unified error types exported from shared-types
- [ ] Frontend error handler with Sonner toast in all 5 apps
- [ ] Stale test session cleanup (24h) scheduled function
- [ ] Inactive chat session cleanup (7d) scheduled function
- [ ] `pnpm build` passes
- [ ] `pnpm lint` passes
