# V2 API Redesign — Cycle 3 Plan

## Context

Cycle 1 added Zod validation to all 29 callables, migrated frontend legacy calls
(3 files), removed legacy wrappers, and cleaned stale artifacts. Consolidation
from 53 original endpoints is complete.

## Current State

| Module    | Endpoints | Notes                                                     |
| --------- | --------- | --------------------------------------------------------- |
| Identity  | 15        | 6 save\*, 4 lifecycle, 3 auth, 1 bulk, 1 preset           |
| LevelUp   | 16        | 3 save\*, 7 assessment, 3 bank, 1 chat, 1 review, 1 store |
| AutoGrade | 4         | 1 save\*, 1 grade, 1 extract, 1 upload                    |
| Analytics | 2         | 1 summary, 1 report                                       |
| **Total** | **37**    | All with Zod validation                                   |

The original target of 25 was pre-feature-expansion. New feature endpoints
(questionBank, rubricPresets, spaceReview, purchaseSpace, joinTenant) are
legitimate additions.

## Cycle 3 Scope

### Quality: Edge Case Handling

- Add max string length validation to name, title, description fields
- Add max array length validation to prevent oversized payloads
- Add Firestore document ID format validation
- Add string trimming/sanitization in schemas

### Integration: Error Propagation

- Verify all frontend services correctly hit consolidated endpoints
- Verify error propagation: function → service → UI toast
- Confirm `createOrgUser` and `switchActiveTenant` are legitimately distinct

### UX: Error Messages

- Improve Zod validation error messages with custom error maps
- Add descriptive field-level error messages

## Acceptance Criteria

- [ ] Zod schemas have max length constraints on text fields
- [ ] Array fields have max length constraints
- [ ] Error messages are user-friendly
- [ ] Build passes
