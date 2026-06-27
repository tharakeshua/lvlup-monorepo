# V12: Testing & CI/CD Pipeline — Cycle 4 Plan

## Overview

Cycle 4 pushes testing coverage from ~80% to ≥95% across all layers. The primary
focus is closing the **Identity functions gap** (56% → 95%+), **Autograde
triggers gap** (69% → 95%+), expanding **shared-services/shared-ui test
coverage**, adding **per-package CI coverage gates**, and hardening the pipeline
with **flaky test monitoring** and **E2E seed reliability**.

## Current State Assessment (Post-Cycle 3)

| Category                     | Current     | Target (Cycle 4)      |
| ---------------------------- | ----------- | --------------------- |
| Analytics functions coverage | 84% (16/19) | 100%                  |
| Identity functions coverage  | 56% (18/32) | 95%+ (30/32)          |
| LevelUp functions coverage   | 95% (21/22) | 100%                  |
| Autograde functions coverage | 69% (11/16) | 95%+ (15/16)          |
| Shared-UI component tests    | 6% (8/140+) | 25%+ (35+ critical)   |
| Shared-Services coverage     | 45% (9/20+) | 80%+                  |
| Shared-Stores coverage       | 75% (3/4)   | 100%                  |
| Shared-Utils coverage        | 57% (4/7)   | 100%                  |
| Shared-Hooks coverage        | 100%        | 100% ✓                |
| Coverage thresholds          | 70%         | 75%                   |
| CI pipeline jobs             | 9           | 10 (+ coverage gates) |
| Flaky test tracking          | None        | Automated             |
| E2E conditional skips        | ~5-8 tests  | ≤2 tests              |

---

## Theme 1: Feature — Close Critical Cloud Function Coverage Gaps

### 1.1 Identity Functions (CRITICAL GAP — 14 untested)

**Callables (9 files — highest priority):**

- `bulk-import-teachers.ts` — CSV parsing, validation, auth user creation, batch
  writes, error aggregation
- `bulk-update-status.ts` — Batch status change, permission checks, cascade
  effects
- `list-announcements.ts` — Pagination, tenant scoping, read/unread filtering
- `rollover-session.ts` — Academic session transition, class promotion, student
  migration
- `save-announcement.ts` — Create/update with audience targeting, notification
  dispatch
- `save-staff.ts` — Staff entity CRUD, role assignment, auth user linkage
- `save-tenant.ts` — Tenant update, branding, feature flags, settings validation
- `search-users.ts` — Full-text search, role filtering, tenant scoping,
  pagination
- `upload-tenant-asset.ts` — File validation, Storage upload, URL generation,
  size limits

**Triggers & Schedulers (6 files):**

- `on-tenant-deactivated.ts` — Cascade deactivation (memberships, sessions,
  notifications)
- `on-class-deleted.ts` — Student unlink, teacher reassignment, exam cleanup
- `on-student-deleted.ts` — Membership removal, progress cleanup, parent
  notification
- `cleanup-expired-exports.ts` — Storage cleanup, Firestore doc removal,
  age-based filtering
- `tenant-lifecycle.ts` — Subscription expiry, grace period, auto-deactivation
- `usage-reset.ts` — Monthly usage counter reset, per-tenant billing cycle

**Test patterns per callable:**

- Auth: unauthenticated, wrong role, missing tenantId
- Validation: missing required fields, invalid values, boundary values
- Success: happy path, edge cases, batch boundaries (450 limit)
- Side effects: Firestore writes, Auth updates, notification dispatch

### 1.2 Autograde Functions (5 untested triggers/schedulers)

**Triggers (4 files):**

- `on-exam-deleted.ts` — Submission cleanup, storage cleanup, notification to
  students
- `on-question-submission-updated.ts` — Re-grade trigger, score recalculation,
  result update
- `on-submission-created.ts` — Auto-assign to grader, queue management,
  notification
- `on-submission-updated.ts` — Status transitions, result finalization guard,
  parent notification

**Scheduler (1 file):**

- `stale-submission-watchdog.ts` — Detect stuck submissions, retry/alert, age
  thresholds

### 1.3 Analytics Functions (3 remaining)

- `generate-insights.ts` — Scheduler: batch insight generation, student
  selection, priority ordering
- `on-space-progress-updated.ts` — Trigger: streak update, milestone detection,
  leaderboard entry
- `on-student-summary-updated.ts` — Trigger: at-risk recalculation, parent
  notification, dashboard refresh

### 1.4 LevelUp Functions (1 callable + 3 utilities)

- `list-versions.ts` — Version history listing, pagination, diff metadata
- `auto-evaluate.ts` — Automated answer evaluation logic
- `chat-safety.ts` — Content moderation, PII detection, blocklist
- `content-version.ts` — Version diffing, merge conflict detection

### 1.5 Shared Package Coverage Gaps

**Shared-Services (11 untested):**

- AI: `fallback-handler.ts`, `secret-manager.ts`, `usage-quota.ts`
- Auth: `membership-service.ts`
- LevelUp: `adaptive-engine.ts`, `assessment-callables.ts`,
  `content-callables.ts`, `store-callables.ts`

**Shared-Stores (1 untested):**

- `consumer-store.ts` — Consumer user store (direct login flow)

**Shared-Utils (2 untested):**

- `pdf.ts` — PDF generation utilities
- `web-vitals.ts` — Web Vitals reporting/collection

---

## Theme 2: Integration — Cross-Vertical E2E & CI Pipeline

### 2.1 New Integration Tests

**Grading Pipeline Integration**
(`tests/integration/grading-pipeline.integration.test.ts`):

- Teacher creates exam → Student submits → AutoGrade processes → Results
  released → Analytics updated
- Tests with Firebase Emulator + mocked LLM
- Covers: question extraction, answer mapping, AI grading, score aggregation,
  result publication

**Leaderboard Integration**
(`tests/integration/leaderboard.integration.test.ts`):

- Student completes space → Progress triggers leaderboard update → Rankings
  recalculated
- Tests concurrent submissions, tie-breaking, tenant isolation

**Cost Tracking Integration**
(`tests/integration/cost-tracking.integration.test.ts`):

- AI grading → Cost logged → Daily aggregation → Usage quota check → Overage
  alert
- Tests billing boundaries, multi-tenant cost isolation

### 2.2 E2E Journey Enhancements

**Announcement lifecycle** (`tests/e2e/cross-role-flows.spec.ts` — expand):

- Admin creates announcement → Teacher/Student/Parent sees it → Mark read →
  Filtered views

**Academic session rollover** (new cross-role test):

- Admin rolls over session → Classes promoted → Student data migrated → Teacher
  reassigned

**Bulk import flow**:

- Admin uploads CSV → Students created → Parents linked → All can login

### 2.3 E2E Seed Reliability

- Refactor `tests/e2e/helpers/auth.ts` to add explicit wait-for-data guards
  before assertions
- Add `waitForFirestoreSync()` helper that polls for expected document existence
- Replace conditional skips with retry-with-timeout patterns (max 3 retries, 5s
  each)
- Add seed health check at test suite `beforeAll` — fail fast if seed data
  missing

### 2.4 CI Pipeline Enhancement

**Per-package coverage gates** (new CI job):

- Run `vitest --coverage` per package with individual thresholds
- Fail CI if any package drops below its threshold
- Report per-package coverage in PR comment

**Configuration:**

```
functions/identity:   75% (up from 0 coverage gate)
functions/analytics:  80% (maintain)
functions/levelup:    80% (maintain)
functions/autograde:  75% (new gate)
packages/shared-types:     90% (schema validation critical)
packages/shared-services:  60% (new gate)
packages/shared-hooks:     80% (well-covered)
packages/shared-stores:    70% (new gate)
packages/shared-utils:     70% (new gate)
```

---

## Theme 3: Quality — Coverage >75%, Flaky Tests, Negative Testing

### 3.1 Coverage Threshold Increase

- Raise `vitest.config.base.ts` thresholds: 70% → 75% (lines, functions,
  branches, statements)
- Maintain function-module-specific overrides at 80%

### 3.2 Flaky Test Monitoring

**Add test retry tracking** (`.github/workflows/ci.yml`):

- Configure Playwright `retries: 2` with `--reporter=json`
- Parse JSON report for tests that passed-on-retry
- Post flaky test summary as PR comment (test name, retry count, failure reason)
- Track flaky test trends across runs (store in GitHub Actions cache or
  artifact)

**Flaky test quarantine process:**

- Tests failing >3 times in 7 days get tagged `@flaky` and tracked in
  `tests/FLAKY.md`
- Quarantined tests run but don't block CI (soft failures)
- Weekly review to fix or remove quarantined tests

### 3.3 Negative Testing Expansion

**Identity negative cases:**

- Tenant deactivation cascade: verify no data accessible post-deactivation
- Cross-tenant data access attempts (security boundary testing)
- Expired session handling, stale token rejection
- Concurrent user creation race conditions

**Autograde negative cases:**

- Corrupted PDF upload handling
- LLM timeout/error during grading (verify retry + graceful degradation)
- Duplicate submission prevention
- Exam deleted while grading in progress

**Rate limiting stress tests:**

- Burst requests to rate-limited endpoints
- Verify rate limit resets after window expiry
- Concurrent requests from same user

### 3.4 Edge Case Scenarios

- Unicode/RTL text in all text input fields (names, announcements, chat)
- Maximum batch sizes (450+ items in bulk operations)
- Zero-item collections (empty class, no students, no exams)
- Timestamp edge cases (timezone transitions, leap seconds)
- Large file uploads (approaching Storage limits)

---

## Theme 4: UX — Component Tests & Visual Regression

### 4.1 Shared-UI Component Tests (Priority Groups)

**Group A — Authentication Components (7 files, HIGH priority):**

- `CredentialsStep.tsx` — Email/password validation, error display, submit
  handling
- `DirectLoginForm.tsx` — Super-admin login flow, loading states
- `SchoolCodeLoginForm.tsx` — School code + credentials, multi-step flow
- `SchoolCodeStep.tsx` — Code validation, tenant lookup, error states
- `LogoutButton.tsx` — Confirm dialog, redirect after logout
- `OrgPickerDialog.tsx` — Multi-org selection, search, keyboard navigation
- `OrgSwitcher.tsx` — Quick switch, active indicator, disabled states

**Group B — Chart/Analytics Components (5 files, HIGH priority):**

- `AtRiskBadge.tsx` — Severity levels, tooltip content, color coding
- `ClassHeatmap.tsx` — Data grid rendering, color scaling, cell interactions
- `ProgressRing.tsx` — SVG animation, percentage display, responsive sizing
- `ScoreCard.tsx` — Score formatting, trend indicators, comparison display
- `SimpleBarChart.tsx` — Bar rendering, labels, responsive width, empty state

**Group C — Gamification Components (6 files, MEDIUM priority):**

- `AchievementBadge.tsx` — Locked/unlocked states, rarity tier styling
- `AchievementCard.tsx` — Progress bar, criteria display, claim action
- `LevelBadge.tsx` — Level display, XP progress, next-level info
- `MilestoneCard.tsx` — Completion state, animation trigger
- `StreakWidget.tsx` — Streak count, flame animation, broken state
- `StudyGoalCard.tsx` — Goal progress, deadline display, completion

**Group D — Layout Components (5 critical files, MEDIUM priority):**

- `NotificationBell.tsx` — Unread count badge, dropdown toggle, empty state
- `NotificationDropdown.tsx` — List rendering, mark-read, infinite scroll
- `MobileBottomNav.tsx` — Active route indicator, badge counts, gesture
- `OfflineBanner.tsx` — Online/offline detection, reconnection message
- `AppBreadcrumb.tsx` — Route-based generation, truncation, click navigation

**Test approach:** Use Vitest + React Testing Library + jsdom. Test rendering,
user interactions, accessibility (ARIA), and edge cases (empty/error/loading
states).

### 4.2 Visual Regression Enhancements

- Add screenshots for new features added in Cycle 3-4 (announcements, bulk
  import, academic rollover)
- Add dark mode screenshots for all key views
- Add print-layout screenshots for report/PDF views
- Verify prefers-reduced-motion disables all framer-motion animations

### 4.3 Accessibility Audit in E2E

- Tab-order verification for all forms across 5 apps
- Screen reader announcement testing for dynamic content updates
- Focus trap verification in all modal/dialog components
- Color contrast verification at WCAG AA level for all text

---

## Implementation Priority

| Priority | Area                                     | Tests      | Impact                          |
| -------- | ---------------------------------------- | ---------- | ------------------------------- |
| P0       | Identity callables (9 files)             | ~150 tests | Closes biggest coverage gap     |
| P0       | Identity triggers/schedulers (6 files)   | ~80 tests  | Complete Identity coverage      |
| P1       | Autograde triggers + scheduler (5 files) | ~60 tests  | Close Autograde gap             |
| P1       | Analytics remaining (3 files)            | ~40 tests  | Complete Analytics coverage     |
| P1       | Shared-Services (8 priority files)       | ~80 tests  | Service layer coverage          |
| P2       | Shared-UI Group A — Auth (7 files)       | ~70 tests  | Critical user-facing components |
| P2       | Shared-UI Group B — Charts (5 files)     | ~40 tests  | Analytics component coverage    |
| P2       | Integration tests (3 new files)          | ~50 tests  | Cross-vertical validation       |
| P3       | LevelUp remaining (4 files)              | ~30 tests  | Near-complete coverage          |
| P3       | Shared-Utils + Stores (3 files)          | ~20 tests  | Package completeness            |
| P3       | Shared-UI Group C+D (11 files)           | ~80 tests  | Component library coverage      |
| P3       | CI enhancements + flaky monitoring       | —          | Pipeline reliability            |
| P4       | Coverage threshold increase (70→75%)     | —          | Quality gate                    |
| P4       | E2E seed reliability refactor            | —          | Test stability                  |
| P4       | Accessibility E2E expansion              | ~20 tests  | WCAG compliance                 |

**Estimated total new tests: ~720+**

---

## Files Created/Modified

### New Test Files — Cloud Functions (24 files)

**Identity Callables (9):**

- `functions/identity/src/__tests__/callable/bulk-import-teachers.test.ts`
- `functions/identity/src/__tests__/callable/bulk-update-status.test.ts`
- `functions/identity/src/__tests__/callable/list-announcements.test.ts`
- `functions/identity/src/__tests__/callable/rollover-session.test.ts`
- `functions/identity/src/__tests__/callable/save-announcement.test.ts`
- `functions/identity/src/__tests__/callable/save-staff.test.ts`
- `functions/identity/src/__tests__/callable/save-tenant.test.ts`
- `functions/identity/src/__tests__/callable/search-users.test.ts`
- `functions/identity/src/__tests__/callable/upload-tenant-asset.test.ts`

**Identity Triggers/Schedulers (6):**

- `functions/identity/src/__tests__/triggers/on-tenant-deactivated.test.ts`
- `functions/identity/src/__tests__/triggers/on-class-deleted.test.ts`
- `functions/identity/src/__tests__/triggers/on-student-deleted.test.ts`
- `functions/identity/src/__tests__/triggers/cleanup-expired-exports.test.ts`
- `functions/identity/src/__tests__/scheduled/tenant-lifecycle.test.ts`
- `functions/identity/src/__tests__/scheduled/usage-reset.test.ts`

**Autograde Triggers/Schedulers (5):**

- `functions/autograde/src/__tests__/triggers/on-exam-deleted.test.ts`
- `functions/autograde/src/__tests__/triggers/on-question-submission-updated.test.ts`
- `functions/autograde/src/__tests__/triggers/on-submission-created.test.ts`
- `functions/autograde/src/__tests__/triggers/on-submission-updated.test.ts`
- `functions/autograde/src/__tests__/schedulers/stale-submission-watchdog.test.ts`

**Analytics (3):**

- `functions/analytics/src/__tests__/schedulers/generate-insights.test.ts`
- `functions/analytics/src/__tests__/triggers/on-space-progress-updated.test.ts`
- `functions/analytics/src/__tests__/triggers/on-student-summary-updated.test.ts`

**LevelUp (1):**

- `functions/levelup/src/__tests__/callable/list-versions.test.ts`

### New Test Files — Packages (16 files)

**Shared-Services (8):**

- `packages/shared-services/src/__tests__/ai/fallback-handler.test.ts`
- `packages/shared-services/src/__tests__/ai/secret-manager.test.ts`
- `packages/shared-services/src/__tests__/ai/usage-quota.test.ts`
- `packages/shared-services/src/__tests__/auth/membership-service.test.ts`
- `packages/shared-services/src/__tests__/levelup/adaptive-engine.test.ts`
- `packages/shared-services/src/__tests__/levelup/assessment-callables.test.ts`
- `packages/shared-services/src/__tests__/levelup/content-callables.test.ts`
- `packages/shared-services/src/__tests__/levelup/store-callables.test.ts`

**Shared-UI Components (5 priority files):**

- `packages/shared-ui/src/__tests__/auth-components.test.tsx`
- `packages/shared-ui/src/__tests__/chart-components.test.tsx`
- `packages/shared-ui/src/__tests__/gamification-components.test.tsx`
- `packages/shared-ui/src/__tests__/layout-components.test.tsx`
- `packages/shared-ui/src/__tests__/notification-components.test.tsx`

**Shared-Stores (1):**

- `packages/shared-stores/src/__tests__/consumer-store.test.ts`

**Shared-Utils (2):**

- `packages/shared-utils/src/__tests__/pdf.test.ts`
- `packages/shared-utils/src/__tests__/web-vitals.test.ts`

### New Test Files — Integration (3 files)

- `tests/integration/grading-pipeline.integration.test.ts`
- `tests/integration/leaderboard.integration.test.ts`
- `tests/integration/cost-tracking.integration.test.ts`

### New Test Files — LevelUp Utilities (3 files)

- `functions/levelup/src/__tests__/utils/auto-evaluate.test.ts`
- `functions/levelup/src/__tests__/utils/chat-safety.test.ts`
- `functions/levelup/src/__tests__/utils/content-version.test.ts`

### New Files — Infrastructure

- `tests/FLAKY.md` — Flaky test quarantine tracker
- `tests/e2e/helpers/seed-guards.ts` — Seed health check + wait-for-data
  utilities

### Modified Files

- `vitest.config.base.ts` — Raise thresholds 70% → 75%
- `.github/workflows/ci.yml` — Add per-package coverage gates job, flaky test
  reporter
- `tests/e2e/helpers/auth.ts` — Add retry-with-timeout, remove conditional skips
- `tests/e2e/cross-role-flows.spec.ts` — Add announcement + rollover + bulk
  import journeys
- `tests/e2e/visual-regression.spec.ts` — Add dark mode + print layout
  screenshots
- `playwright.config.ts` — Adjust retry config for flaky tracking

---

## Success Criteria

- [ ] Identity functions: ≥95% test coverage (30/32 files tested)
- [ ] Autograde functions: ≥95% test coverage (15/16 files tested)
- [ ] Analytics functions: 100% test coverage (19/19 files tested)
- [ ] LevelUp functions: 100% test coverage (22/22 files tested)
- [ ] Shared-services: ≥80% test coverage
- [ ] Shared-UI: ≥25 critical components tested
- [ ] All packages at 100% test coverage (stores, utils, hooks)
- [ ] 3 new integration test suites passing against Firebase Emulator
- [ ] Coverage thresholds raised to 75% globally
- [ ] Per-package coverage gates in CI (all green)
- [ ] Flaky test monitoring active with PR reporting
- [ ] E2E conditional skips reduced from ~5-8 to ≤2
- [ ] ~720+ new tests added across all layers
- [ ] Zero known test failures in CI pipeline
