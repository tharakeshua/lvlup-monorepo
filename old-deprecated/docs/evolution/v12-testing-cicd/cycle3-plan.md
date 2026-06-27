# V12: Testing & CI/CD Pipeline — Cycle 3 Plan

## Overview

Cycle 3 Combined Pass 1 focuses on closing critical test coverage gaps, adding
visual regression testing, enhancing CI/CD, and improving test reliability
across the Auto-LevelUp monorepo.

## Current State Assessment

| Category                   | Before Cycle 3    | Target                       |
| -------------------------- | ----------------- | ---------------------------- |
| Analytics utility coverage | ~33% (5/15 files) | 80%+                         |
| Callable function coverage | 82% (33/40)       | 95%+                         |
| Zod schema tests           | 0                 | Full coverage                |
| Coverage thresholds        | 60%               | 70%                          |
| E2E cross-role tests       | 5 basic tests     | 15+ journeys                 |
| Visual regression tests    | 0                 | All apps, all breakpoints    |
| CI pipeline stages         | 7 jobs            | 8 jobs (+ visual regression) |

---

## Theme 1: Feature — Expand Test Coverage

### 1.1 Analytics Utility Tests (CRITICAL GAP)

- **at-risk-rules.ts** — Test all 4 rules: low_exam_score, zero_streak,
  low_space_completion, declining_performance
- **insight-rules.ts** — Test all 6 rule functions + generateInsightsForStudent
  aggregator
- **notification-sender.ts** — Test sendNotification and sendBulkNotifications
  with mocked Firebase
- **rate-limit.ts** — Test enforceRateLimit with sliding window, threshold
  breach, new user
- **parse-request.ts** — Test Zod parsing, error formatting, success paths

### 1.2 Missing Callable Function Tests

- **identity/manage-notifications** — List pagination, markRead single + all,
  auth checks
- **identity/reactivate-tenant** — SuperAdmin-only, membership reactivation,
  status restore
- **levelup/create-item** — extractAnswerKey for all question types,
  stripAnswerFromPayload
- **levelup/save-space-review** — Rating validation, duplicate prevention,
  aggregate recomputation

### 1.3 Zod Schema Validation Tests

- All callable schemas in shared-types (Identity, LevelUp, AutoGrade, Analytics)
- Firestore data schemas (Tenant, Class, Student, Teacher, Exam, Submission)
- Edge cases: boundary values, missing fields, wrong types, extra fields

---

## Theme 2: Integration — Cross-Vertical E2E Journeys

### 2.1 Cross-Role Flow Expansion

- Teacher publishes space → Student accesses → Parent views progress
- Admin creates class → Teacher assigned → Student enrolled → Parent linked
- Teacher creates exam → Student takes exam → Results released → Parent notified
- Multi-tenant isolation in browser (cross-tenant auth boundary tests)

### 2.2 Integration Test Enhancements

- Notification delivery chain (send → store → RTDB count)
- Multi-tenant concurrent operations
- Rate limiting integration tests

---

## Theme 3: Quality — Fix Flaky Tests, Negative Testing, Coverage >70%

### 3.1 Coverage Threshold Increase

- Raise vitest.config.base.ts thresholds from 60% → 70%
- Raise analytics vitest.config.ts thresholds from 80% (keep high)

### 3.2 Negative Testing Patterns

- Auth rejection for all callable functions
- Invalid input edge cases for all schemas
- Rate limit exceeded scenarios
- Concurrent write conflict handling

### 3.3 Edge Case Scenarios

- Empty arrays/objects in schemas
- Boundary values (min/max ratings, max batch sizes)
- Unicode/special characters in text fields
- Timestamp edge cases

---

## Theme 4: UX — Visual Regression & Accessibility

### 4.1 Visual Regression Tests

- Screenshot tests at 3 breakpoints: Desktop (1280×720), Mobile (390×844),
  Tablet (820×1180)
- All 5 app login pages
- Key dashboard views per app
- Comparison against baseline screenshots

### 4.2 Accessibility Tests

- prefers-reduced-motion media query tests
- ARIA attribute verification on key components
- Focus management testing in E2E flows
- Color contrast verification via Lighthouse thresholds

### 4.3 Screenshot Test Infrastructure

- Add `toMatchSnapshot` for visual diffs
- Configure CI to store/compare screenshot baselines
- Add screenshot update workflow

---

## Implementation Priority

1. Analytics utility tests (highest coverage gap)
2. Callable function tests (close to 100%)
3. Zod schema tests (foundational validation)
4. Cross-role E2E expansion
5. Visual regression setup
6. CI/CD enhancements
7. Documentation

## Files Created/Modified

### New Test Files

- `functions/analytics/src/__tests__/at-risk-rules.test.ts`
- `functions/analytics/src/__tests__/insight-rules.test.ts`
- `functions/analytics/src/__tests__/notification-sender.test.ts`
- `functions/analytics/src/__tests__/rate-limit.test.ts`
- `functions/analytics/src/__tests__/parse-request.test.ts`
- `functions/identity/src/__tests__/manage-notifications.test.ts`
- `functions/identity/src/__tests__/reactivate-tenant.test.ts`
- `functions/levelup/src/__tests__/create-item.test.ts`
- `functions/levelup/src/__tests__/save-space-review.test.ts`
- `packages/shared-types/src/__tests__/callable-schemas.test.ts`
- `tests/e2e/visual-regression.spec.ts`

### Modified Files

- `vitest.config.base.ts` — Raise thresholds to 70%
- `.github/workflows/ci.yml` — Add visual regression job
- `tests/e2e/cross-role-flows.spec.ts` — Expand journey tests
