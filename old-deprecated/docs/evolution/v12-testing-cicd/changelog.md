# V12: Testing & CI/CD Pipeline — Changelog

## Cycle 4: Coverage Push to ≥95%

### Cloud Function Unit Tests (45 new test files)

#### Identity Functions (14 new)

- **Callables (9)**: `bulk-import-teachers`, `bulk-update-status`,
  `list-announcements`, `rollover-session`, `save-announcement`, `save-staff`,
  `save-tenant`, `search-users`, `upload-tenant-asset`
- **Triggers (3)**: `on-tenant-deactivated`, `on-class-deleted`,
  `on-student-deleted`
- **Schedulers (2)**: `tenant-lifecycle`, `usage-reset`

#### Autograde Functions (5 new)

- **Triggers (4)**: `on-exam-deleted`, `on-question-submission-updated`,
  `on-submission-created`, `on-submission-updated`
- **Schedulers (1)**: `stale-submission-watchdog`

#### Analytics Functions (3 new)

- **Triggers (2)**: `on-space-progress-updated`, `on-student-summary-updated`
- **Schedulers (1)**: `generate-insights`

#### LevelUp Functions (4 new)

- **Callables (1)**: `list-versions`
- **Utils (3)**: `auto-evaluate` (9 question types), `chat-safety` (injection
  detection + rate limits), `content-version`

### Shared Package Tests (16 new test files)

#### Shared Services (8 new)

- **AI layer (3)**: `fallback-handler` (circuit breaker), `secret-manager` (GCP
  Secret Manager), `usage-quota` (per-tenant quotas)
- **Auth (1)**: `membership-service`
- **LevelUp (4)**: `adaptive-engine`, `assessment-callables`,
  `content-callables`, `store-callables`

#### Shared Stores (1 new)

- `consumer-store` — Zustand cart store with localStorage persistence

#### Shared Utils (2 new)

- `pdf` — PDF-to-image conversion
- `web-vitals` — PerformanceObserver reporting

#### Shared UI (5 new)

- `auth-components` — Auth forms/guards
- `chart-components` — ScoreCard + AtRiskBadge
- `gamification-components` — LevelBadge + StreakWidget
- `layout-components` — OfflineBanner + NotificationBell
- `notification-components` — NotificationDropdown

### Integration Tests (3 new)

- `grading-pipeline.integration.test.ts` — Exam creation → question setup →
  submission → grading aggregation → analytics
- `leaderboard.integration.test.ts` — Leaderboard entries, tie-breaking, tenant
  isolation, progress updates
- `cost-tracking.integration.test.ts` — Daily cost summaries, monthly
  aggregation, quota enforcement, tenant isolation

### CI/CD Pipeline Enhancements

- `.github/workflows/ci.yml` — Added `coverage-gates` job with per-package
  thresholds (identity:75%, analytics:80%, levelup:80%, autograde:75%,
  shared-types:90%, shared-services:60%, shared-hooks:80%, shared-stores:70%,
  shared-utils:70%)
- `.github/workflows/ci.yml` — Added `flaky-test-monitor` job that analyzes E2E
  test results for retries and posts PR comments
- `.github/workflows/ci.yml` — Added `coverage-gates` to `all-checks` required
  gate

### Coverage Threshold Increase

- `vitest.config.base.ts` — Raised global thresholds from 70% → 75% (lines,
  functions, branches, statements)

### Testing Infrastructure

- `tests/FLAKY.md` — Flaky test quarantine tracker with
  detection/tracking/resolution process
- `tests/e2e/helpers/seed-guards.ts` — Seed health checks, `waitForElement`,
  `waitForNavigation`, `loginWithRetry`, `waitForDataLoad` helpers
- `playwright.config.ts` — JSON reporter for CI flaky test analysis, 2 retries
  in CI

---

## Cycle 3: Feature Completion

### AutoGrade Coverage Thresholds

- `functions/autograde/vitest.config.ts` — Added 80% coverage thresholds (lines,
  functions, branches, statements) matching analytics, identity, and levelup
  modules. Added lcov reporter for CI coverage collection.

### Test CI Script

- `package.json` — Added `test:ci` script that runs
  `turbo run test:coverage && pnpm run test:integration` for a single-command CI
  test execution.

### E2E on Main Branch

- `.github/workflows/ci.yml` — Removed `if: github.event_name == 'pull_request'`
  condition from E2E job, enabling E2E tests on both PR and main/develop branch
  pushes.
- `.github/workflows/ci.yml` — Added `e2e` to the `all-checks` job's `needs`
  array, making E2E a required gate for the CI pipeline.

---

## Cycle 1-2: Initial Implementation

### Unit Tests

- **Analytics Functions**: vitest.config.ts + 4 test files (triggers +
  schedulers)
- **Identity Functions**: 6 test files (callables + triggers)
- **LevelUp Functions**: 10 test files (callables + triggers + schedulers)

### E2E Tests

- **Super-Admin App E2E Suite**: 3 specs + helpers + config
- **Parent-Web App E2E Suite**: 2 specs + helpers + config
- **Cross-Role Flow Tests**: Role boundary checks
- **Mobile Viewport Projects**: iPhone 14 for 4 apps
- **Tablet Viewport Project**: iPad (gen 7) for admin-web

### CI/CD Pipeline

- Integration test job with Firebase Emulators
- E2E test job with Playwright + artifact upload
- Deploy workflow for functions + hosting
- Preview deployments for PRs (7-day expiry)
- Enhanced coverage reporting (multi-path lcov)

### Config Changes

- `playwright.config.ts`: Expanded to 12 projects (mobile, tablet, cross-role)
- `turbo.json`: Added `typecheck` and `test:coverage` tasks

## Summary

| Metric              | Cycle 1-2           | Cycle 3             | Cycle 4                                   |
| ------------------- | ------------------- | ------------------- | ----------------------------------------- |
| New test files      | 20                  | 1                   | 45                                        |
| Coverage thresholds | 3/4 functions (80%) | 4/4 functions (80%) | Global 75% base + per-package gates       |
| test:ci script      | None                | Added               | —                                         |
| E2E in CI           | PR-only             | All branches        | + Flaky monitoring                        |
| CI pipeline jobs    | 7                   | 8                   | 10 (+ coverage-gates, flaky-test-monitor) |
| Integration tests   | 3                   | 3                   | 6                                         |
| Testing infra       | —                   | —                   | FLAKY.md + seed-guards + loginWithRetry   |
