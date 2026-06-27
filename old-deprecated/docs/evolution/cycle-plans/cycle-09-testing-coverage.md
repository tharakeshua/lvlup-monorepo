# Evolution Cycle 9: Testing Coverage

## Cycle Goal

Achieve comprehensive test coverage across every vertical. Target: >80% code
coverage for critical paths, all user journeys covered by E2E tests, all Cloud
Functions have unit tests, all security rules tested, and CI/CD pipeline fully
automated.

## Execution Strategy

Same tier-based parallelization. Each vertical: Plan → Implement → Test.

## Team Member → Vertical Mapping

Same as all cycles — see cycle-03-feature-completion.md for full mapping table.

---

## Vertical-by-Vertical Instructions

### V1: Type System (🏗️ Foundation Architect)

- Add type tests using `tsd` or `expect-type` to verify type contracts
- Test Zod schema validation with valid and invalid inputs (fuzz testing)
- Test branded type construction and validation
- Verify type exports match expected public API
- Add tests for type guard functions

### V2: API (🏗️ Foundation Architect)

- Unit test every callable function with: valid input, invalid input, auth
  failure, permission denied
- Test API rate limiting behavior
- Test request validation (missing fields, wrong types, oversized payloads)
- Test response format consistency across all endpoints
- Add API contract tests (ensure frontend and backend agree on shapes)

### V3: Error Handling (🏗️ Foundation Architect)

- Test error class hierarchy (correct codes, messages, HTTP status mapping)
- Test rate limiter under concurrent load
- Test TTL cleanup functions (verify stale resources are cleaned)
- Test cascade delete operations (verify all child data removed)
- Test error boundary recovery in all 5 apps
- Test structured logging output format

### V4: Learning Platform (📚 Learning Engineer)

- E2E: Teacher creates space → adds story points → adds items → publishes
- E2E: Student discovers space → enrolls → starts learning → completes items →
  progress tracked
- Unit: Space CRUD functions, progress calculation, content filtering
- Integration: Space enrollment with tenant isolation
- Test drag-and-drop reordering logic
- Test content search/filter with various query patterns

### V5: AutoGrade & AI (🤖 AI & Grading Engineer)

- E2E: Full grading pipeline (create exam → upload answer sheet → OCR → grade →
  review → finalize)
- Unit: OCR extraction functions, grading logic, confidence scoring
- Integration: AI grading with mocked LLM responses (test prompt construction,
  response parsing)
- Test batch grading queue (concurrent exams, retry behavior)
- Test AI chat with mocked responses (context management, safety filter)
- Test cost tracking accuracy

### V6: Digital Testing (📚 Learning Engineer)

- E2E: Student takes full test (start → answer all → submit → view results)
- E2E: Timer expiry → auto-submit flow
- Unit: Timer logic, answer validation, evaluation scoring
- Test all question types (MCQ, short answer, essay, matching, fill-in-blanks)
- Test concurrent test sessions
- Test auto-save and recovery after disconnect

### V7: Admin Dashboards (🔧 Platform Engineer)

- E2E: Super admin creates tenant, manages users, views system health
- E2E: School admin manages classes, assigns teachers, views analytics
- Unit: Dashboard metric aggregation functions
- Test all CRUD operations (create, read, update, delete with confirmation)
- Test pagination, search, filtering on all data tables
- Test announcement creation and delivery

### V8: Multi-Tenancy (🔧 Platform Engineer)

- Integration: Full tenant lifecycle (create → configure → populate →
  deactivate)
- Security rules tests for EVERY collection (read/write/delete for each role)
- Test cross-tenant isolation (tenant A cannot access tenant B data)
- Test onboarding wizard flow end-to-end
- Test billing usage tracking accuracy
- Test tenant data export completeness

### V9: User Experience (🎨 Design Systems Engineer)

- E2E: Student complete learning journey (login → dashboard → learn → test →
  view results)
- E2E: Parent views child progress (login → dashboard → view grades → download
  report)
- E2E: Teacher complete teaching workflow (login → create content → assign test
  → grade → review)
- Test notification delivery and acknowledgment
- Test PDF report generation and download
- Test on mobile viewport (375px)

### V10: Design System (🎨 Design Systems Engineer)

- Visual regression tests for all shared-ui components (Storybook + Chromatic or
  Playwright screenshots)
- Test all component states: default, hover, focus, active, disabled, loading,
  error
- Accessibility tests: axe-core automated audit on all pages
- Test dark/light mode switching on all components
- Test prefers-reduced-motion behavior
- Test keyboard navigation through all interactive components

### V11: Performance (⚡ Performance Engineer)

- Add Lighthouse CI to all 5 apps (fail on score < 85)
- Add bundle size budget tests (fail if any app exceeds limit)
- Add Core Web Vitals monitoring tests
- Test PWA: offline page, install prompt, cache behavior
- Load test: simulate 50 concurrent users on student app
- Test mobile performance at 4G and 3G throttling

### V12: Testing (🧪 QA Engineer)

- **Meta-testing**: Verify CI pipeline catches all test failures
- Test pipeline stages independently: lint, type-check, unit, build, e2e
- Test preview deployment creation for PRs
- Test production deployment pipeline
- Add test coverage reporting (fail if coverage drops below threshold)
- Document test strategy and how to add new tests
- Create test data factories for all entity types

### V13: Marketing Site (🌐 Marketing Site Builder)

- Visual regression tests for all pages (desktop + mobile)
- Test all forms (contact, demo request) with valid and invalid input
- Test all navigation links and anchors
- Lighthouse audit automation (performance 90+, accessibility 95+, SEO 95+)
- Test responsive layout at all breakpoints
- Cross-browser testing (Chrome, Firefox, Safari)

---

## Quality Gates

- [ ] Code coverage > 80% for Cloud Functions
- [ ] Code coverage > 70% for React apps
- [ ] All E2E tests pass (all 5 apps + cross-app journeys)
- [ ] Security rules test coverage: 100% of collections
- [ ] CI pipeline: lint → type-check → unit → build → e2e → deploy (all green)
- [ ] No flaky tests (re-run 3 times, all pass)
- [ ] Test execution time < 10 minutes total in CI
- [ ] Bundle size budgets enforced in CI
