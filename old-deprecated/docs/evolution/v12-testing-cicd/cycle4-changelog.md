# V12 Cycle 4: Testing & CI/CD — Coverage Push to ≥95%

## Overview

Cycle 4 added **46 new test files** across Cloud Functions, shared packages, UI
components, and integration tests. CI/CD pipeline enhanced with per-package
coverage gates and flaky test monitoring. Global coverage thresholds raised from
70% → 75%. E2E seed reliability improved with seed-guards helpers and
retry-with-timeout patterns.

---

## Cloud Function Unit Tests (27 new files)

### Identity Functions (14 new)

| Type           | Files                                                                                                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Callables (9)  | `bulk-import-teachers`, `bulk-update-status`, `list-announcements`, `rollover-session`, `save-announcement`, `save-staff`, `save-tenant`, `search-users`, `upload-tenant-asset` |
| Triggers (4)   | `on-tenant-deactivated`, `on-class-deleted`, `on-student-deleted`, `cleanup-expired-exports`                                                                                    |
| Schedulers (2) | `tenant-lifecycle`, `usage-reset`                                                                                                                                               |

### Autograde Functions (5 new)

| Type           | Files                                                                                                 |
| -------------- | ----------------------------------------------------------------------------------------------------- |
| Triggers (4)   | `on-exam-deleted`, `on-question-submission-updated`, `on-submission-created`, `on-submission-updated` |
| Schedulers (1) | `stale-submission-watchdog`                                                                           |

### Analytics Functions (3 new)

| Type           | Files                                                     |
| -------------- | --------------------------------------------------------- |
| Triggers (2)   | `on-space-progress-updated`, `on-student-summary-updated` |
| Schedulers (1) | `generate-insights`                                       |

### LevelUp Functions (4 new)

| Type          | Files                                                                                                    |
| ------------- | -------------------------------------------------------------------------------------------------------- |
| Callables (1) | `list-versions`                                                                                          |
| Utils (3)     | `auto-evaluate` (9 question types), `chat-safety` (injection detection + rate limits), `content-version` |

---

## Shared Package Tests (16 new files)

### Shared Services (8 new)

- **AI layer**: `fallback-handler` (circuit breaker + error classification),
  `secret-manager` (GCP Secret Manager per-tenant keys), `usage-quota`
  (per-tenant AI quota enforcement)
- **Auth**: `membership-service` (user membership queries via client SDK)
- **LevelUp**: `adaptive-engine` (adaptive question selection),
  `assessment-callables` (httpsCallable wrappers), `content-callables` (content
  management wrappers), `store-callables` (store operation wrappers)

### Shared Stores (1 new)

- `consumer-store` — Zustand cart store with localStorage persistence,
  add/remove/clear/total selectors

### Shared Utils (2 new)

- `pdf` — PDF-to-image conversion with pdf.js mocking
- `web-vitals` — PerformanceObserver-based Web Vitals reporting (CLS, FID, LCP,
  FCP, TTFB)

### Shared UI (5 new)

- `auth-components` — Auth form components and guards
- `chart-components` — ScoreCard (8 tests) + AtRiskBadge (5 tests) with
  lucide-react mocking
- `gamification-components` — LevelBadge (7 tests) + StreakWidget (8 tests) with
  ARIA checks
- `layout-components` — OfflineBanner (5 tests) + NotificationBell (6 tests)
- `notification-components` — NotificationDropdown (6 tests) with UI component
  mocking

---

## Integration Tests (3 new files)

| Test File                              | Flow Covered                                                                                                |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `grading-pipeline.integration.test.ts` | Exam creation → questions → submission → grading aggregation → analytics (5 tests)                          |
| `leaderboard.integration.test.ts`      | Leaderboard entries, tie-breaking by spacesCompleted, tenant isolation, progress updates (4 tests)          |
| `cost-tracking.integration.test.ts`    | Daily cost summaries, monthly aggregation, quota enforcement, tenant isolation, purpose breakdown (5 tests) |

All integration tests use Firebase emulators with `seedTenant` helpers and
`resetEmulators` cleanup.

---

## CI/CD Pipeline Enhancements

### Per-Package Coverage Gates (`coverage-gates` job)

Enforces minimum line coverage per package:

| Package                    | Threshold |
| -------------------------- | --------- |
| `functions/identity`       | 75%       |
| `functions/analytics`      | 80%       |
| `functions/levelup`        | 80%       |
| `functions/autograde`      | 75%       |
| `packages/shared-types`    | 90%       |
| `packages/shared-services` | 60%       |
| `packages/shared-hooks`    | 80%       |
| `packages/shared-stores`   | 70%       |
| `packages/shared-utils`    | 70%       |

Outputs a per-package coverage report to GitHub Step Summary and PR comments.

### Flaky Test Monitor (`flaky-test-monitor` job)

- Runs after E2E suite (even on failure)
- Analyzes test-results artifacts for retry patterns
- Posts flaky test summary as PR comment
- Feeds into `tests/FLAKY.md` quarantine process

### All-Checks Gate Updated

- `coverage-gates` added to `all-checks` required job dependencies

---

## Coverage Threshold Increase

`vitest.config.base.ts` — Global thresholds raised:

- Lines: 70% → **75%**
- Functions: 70% → **75%**
- Branches: 70% → **75%**
- Statements: 70% → **75%**

---

## Testing Infrastructure

### Flaky Test Tracker (`tests/FLAKY.md`)

- Quarantine process: Detection → Tracking → Quarantine → Resolution → Release
- `@flaky` tag convention for both Playwright and Vitest tests
- Weekly review cadence for quarantined tests

### Auth Helpers Enhanced (`tests/e2e/helpers/auth.ts`)

- `loginWithRetry()` — Login with retry-and-timeout replacing conditional
  `test.skip()`
- `expectDashboardWithRetry()` — Dashboard heading assertion with retry logic

### Seed Guards (`tests/e2e/helpers/seed-guards.ts`)

- `seedHealthCheck()` — Verifies app reachability before test suite
- `waitForElement()` — Retry-based element visibility waits
- `waitForNavigation()` — URL pattern matching with retries
- `loginWithRetry()` — Login flow with automatic retry on failure
- `waitForDataLoad()` — Loading indicator + content presence checks

### Playwright Config

- JSON reporter enabled for CI (`test-results/results.json`)
- 2 retries in CI for flaky test detection
- Trace capture on first retry

---

## Files Changed Summary

| Category                 | Count                                                   |
| ------------------------ | ------------------------------------------------------- |
| New test files           | 46                                                      |
| New integration tests    | 3                                                       |
| New infrastructure files | 2 (FLAKY.md, seed-guards.ts)                            |
| Modified config files    | 3 (vitest.config.base.ts, ci.yml, playwright.config.ts) |
| Modified E2E helpers     | 1 (auth.ts - retry-with-timeout patterns)               |
| **Total files touched**  | **55**                                                  |
