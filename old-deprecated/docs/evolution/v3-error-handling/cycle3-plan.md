# V3 Error Handling — Cycle 3 Plan

## Context

Cycle 1 established unified error types, rate limiting on 35/38 endpoints,
cleanup schedulers (24h test sessions, 7d chat sessions), ErrorBoundary + Sonner
in all 5 apps, and the useApiError hook.

## Remaining Gaps

| Category           | Status                 | Action                                                              |
| ------------------ | ---------------------- | ------------------------------------------------------------------- |
| Rate limiting      | 35/38 endpoints        | Add to 3 missing: create-item, deactivate-tenant, reactivate-tenant |
| Cascade deletes    | onSpaceDeleted only    | Add onClassDeleted, onExamDeleted triggers                          |
| Structured logging | Basic logger.info only | Add correlation IDs to callable wrappers                            |
| Error toasts       | Basic messages         | Add recovery suggestions                                            |

## Implementation

### Phase 1: Complete Rate Limiting (3 callables)

- functions/levelup/src/callable/create-item.ts — WRITE tier (30/min)
- functions/identity/src/callable/deactivate-tenant.ts — WRITE tier (30/min)
- functions/identity/src/callable/reactivate-tenant.ts — WRITE tier (30/min)

### Phase 2: Cascade Delete Triggers

- functions/identity/src/triggers/on-class-deleted.ts — Remove class from
  students/teachers, cleanup assignments
- functions/autograde/src/triggers/on-exam-deleted.ts — Delete submissions,
  question submissions, analytics

### Phase 3: Structured Logging

- Add correlation ID generation to parseRequest utility
- Pass correlationId through callable execution for traceability

### Phase 4: Enhanced Error Messages

- Add recovery suggestions to ERROR_MESSAGES map
- Update useApiError hook to show recovery actions

## Acceptance Criteria

- [ ] All 38 callables have rate limiting
- [ ] Cascade delete triggers for class and exam deletion
- [ ] Correlation IDs in callable logs
- [ ] Build passes
