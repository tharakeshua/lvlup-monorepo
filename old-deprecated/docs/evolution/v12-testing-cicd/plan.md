# V12: Testing & CI/CD Pipeline — Evolution Plan

## Overview

Expand testing infrastructure and CI/CD pipelines to ensure production
confidence across all 5 apps, 4 Cloud Function modules, and 8 shared packages.

## Current State Assessment

### Existing Test Coverage

- **130+ test files** across unit, integration, and E2E layers
- **E2E (Playwright 1.58.2)**: 8 root-level specs + 36 app-level specs
  (admin-web: 16, student-web: 15, teacher-web: 4)
- **Integration**: 7 test files with Firebase Emulator support (security rules,
  auth flows, exam pipeline, space lifecycle)
- **Unit (Vitest 4.0.18)**: 40+ tests across functions and packages
- **CI/CD**: GitHub Actions with lint → typecheck → build → test pipeline

### Identified Gaps

#### Unit Tests

1. **Analytics**: Missing vitest.config.ts; missing tests for schedulers
   (nightlyAtRiskDetection, dailyCostAggregation, generateInsights) and triggers
   (onSubmissionGraded, onSpaceProgressUpdated, onStudentSummaryUpdated,
   onExamResultsReleased)
2. **Identity**: Missing tests for joinTenant, deactivateTenant,
   reactivateTenant, exportTenantData, saveGlobalEvaluationPreset; triggers
   (onUserCreated, onUserDeleted, onTenantDeactivated)
3. **LevelUp**: Missing tests for saveQuestionBankItem, listQuestionBank,
   importFromBank, saveRubricPreset, listStoreSpaces, purchaseSpace; triggers
   (onTestSessionExpired, onSpaceDeleted); schedulers (cleanupStaleSessions,
   cleanupInactiveChats)

#### E2E Tests

1. **Super-admin** and **parent-web** lack app-level E2E directories
2. **No mobile viewport projects** in Playwright config
3. **No cross-role flow tests** (teacher creates → student takes)

#### CI/CD

1. No E2E test job in pipeline
2. No integration test job with Firebase Emulators
3. No preview deployment for PRs
4. `typecheck` not defined as turbo task
5. No deploy-on-merge workflow

## Implementation Plan

### Phase 1: Unit Test Coverage Expansion

#### 1a. Analytics Functions

- Create `functions/analytics/vitest.config.ts`
- Add tests for `onSubmissionGraded`, `onExamResultsReleased`
- Add tests for schedulers: `nightlyAtRiskDetection`, `dailyCostAggregation`

#### 1b. Identity Functions

- Add tests for `joinTenant`, `deactivateTenant`, `reactivateTenant`,
  `exportTenantData`
- Add tests for `saveGlobalEvaluationPreset`
- Add trigger tests: `onUserCreated`, `onUserDeleted`

#### 1c. LevelUp Functions

- Add tests for `saveQuestionBankItem`, `listQuestionBank`, `importFromBank`
- Add tests for `saveRubricPreset`, `listStoreSpaces`, `purchaseSpace`
- Add trigger tests: `onTestSessionExpired`, `onSpaceDeleted`
- Add scheduler tests: `cleanupStaleSessions`, `cleanupInactiveChats`

### Phase 2: E2E Test Enhancements

#### 2a. Playwright Config Updates

- Add mobile viewport projects (iPhone 14, iPad) for all 5 apps
- Add tablet viewport project
- Configure `webServer` entries for CI auto-start

#### 2b. Super-Admin App E2E Suite

- Create `apps/super-admin/e2e/` with playwright.config.ts
- Auth, dashboard, tenant management, analytics tests

#### 2c. Parent-Web App E2E Suite

- Create `apps/parent-web/e2e/` with playwright.config.ts
- Auth, child progress, report card, notifications tests

#### 2d. Cross-Role Flow Tests

- Teacher creates exam → Admin reviews → Student takes test → Parent views
  results

### Phase 3: Integration Test Expansion

#### 3a. AI Pipeline Integration Tests

- Mock LLM for deterministic grading pipeline testing
- Test question extraction → grading → finalization flow

#### 3b. Multi-Tenant Isolation Tests

- Expand tenant isolation tests for new collections (question bank, rubric
  presets, store)

### Phase 4: CI/CD Pipeline Enhancement

#### 4a. Enhanced GitHub Actions

- Add `typecheck` task to turbo.json
- Add integration test job (with Firebase Emulator)
- Add E2E test job (with Playwright)
- Add preview deployment job for PRs
- Add production deploy job on merge to main
- Add coverage threshold enforcement

#### 4b. Coverage Reporting

- Per-package coverage collection
- Codecov flags for functions, packages, integration
- PR comment with coverage diff

## File Changes

### New Files

- `functions/analytics/vitest.config.ts`
- `functions/analytics/src/__tests__/triggers/on-submission-graded.test.ts`
- `functions/analytics/src/__tests__/triggers/on-exam-results-released.test.ts`
- `functions/analytics/src/__tests__/schedulers/nightly-at-risk-detection.test.ts`
- `functions/analytics/src/__tests__/schedulers/daily-cost-aggregation.test.ts`
- `functions/identity/src/__tests__/callable/join-tenant.test.ts`
- `functions/identity/src/__tests__/callable/deactivate-tenant.test.ts`
- `functions/identity/src/__tests__/callable/export-tenant-data.test.ts`
- `functions/identity/src/__tests__/callable/save-global-preset.test.ts`
- `functions/identity/src/__tests__/triggers/on-user-created.test.ts`
- `functions/identity/src/__tests__/triggers/on-user-deleted.test.ts`
- `functions/levelup/src/__tests__/callable/save-question-bank-item.test.ts`
- `functions/levelup/src/__tests__/callable/list-question-bank.test.ts`
- `functions/levelup/src/__tests__/callable/import-from-bank.test.ts`
- `functions/levelup/src/__tests__/callable/save-rubric-preset.test.ts`
- `functions/levelup/src/__tests__/callable/list-store-spaces.test.ts`
- `functions/levelup/src/__tests__/callable/purchase-space.test.ts`
- `functions/levelup/src/__tests__/triggers/on-test-session-expired.test.ts`
- `functions/levelup/src/__tests__/triggers/on-space-deleted.test.ts`
- `functions/levelup/src/__tests__/schedulers/cleanup-stale-sessions.test.ts`
- `functions/levelup/src/__tests__/schedulers/cleanup-inactive-chats.test.ts`
- `apps/super-admin/e2e/playwright.config.ts`
- `apps/super-admin/e2e/auth.spec.ts`
- `apps/super-admin/e2e/dashboard.spec.ts`
- `apps/super-admin/e2e/tenant-management.spec.ts`
- `apps/super-admin/e2e/helpers.ts`
- `apps/parent-web/e2e/playwright.config.ts`
- `apps/parent-web/e2e/auth.spec.ts`
- `apps/parent-web/e2e/dashboard.spec.ts`
- `apps/parent-web/e2e/helpers.ts`
- `tests/e2e/cross-role-flows.spec.ts`
- `.github/workflows/deploy.yml`
- `docs/evolution/v12-testing-cicd/test-report.md`
- `docs/evolution/v12-testing-cicd/changelog.md`

### Modified Files

- `playwright.config.ts` — Add mobile viewport projects
- `.github/workflows/ci.yml` — Add integration + E2E jobs
- `turbo.json` — Add typecheck task
- `package.json` — Add test:ci scripts
