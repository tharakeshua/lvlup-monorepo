# Evolution Cycle 3: Combined Pass 1 — Core Development

## Cycle Goal

First combined evolution pass covering **Feature Completion + Integration +
Quality + UX Polish** across ALL 13 verticals (V1-V13). Get every vertical from
its current state (~60%) to ~80% complete. Build features, integrate them, fix
obvious quality issues, and apply baseline UX polish — all in one pass.

## How This Cycle Works

For each vertical, the worker should execute ALL FOUR themes in sequence:

1. **Feature**: Complete missing/incomplete features
2. **Integration**: Ensure features work with other verticals
3. **Quality**: Fix bugs, add validation, handle edge cases
4. **UX Polish**: Improve visual quality, add loading states, basic animations

## Execution Strategy

You are the Evolution Coordinator. Spawn worker sessions via maestro per
vertical. Each vertical: **Plan → Implement → Test** (3 phases).

### Parallelization

```
TIER 1 (Sequential — 🏗️ Foundation Architect): V1 → V2 → V3
TIER 2 (V4 ∥ V5 parallel, then V6): V4 ∥ V5 → V6
TIER 3 (Sequential — 🔧 Platform Engineer): V7 → V8
TIER 4 (Sequential — 🎨 Design Systems Engineer): V9 → V10
TIER 5 (All parallel): V11 ∥ V12 ∥ V13
```

## Team Member → Vertical Mapping

| Team Member                | ID                         | Verticals  |
| -------------------------- | -------------------------- | ---------- |
| 🏗️ Foundation Architect    | tm_1772827423990_e254lbuxp | V1, V2, V3 |
| 📚 Learning Engineer       | tm_1772827431038_ba107mn2u | V4, V6     |
| 🤖 AI & Grading Engineer   | tm_1772827435178_pdjja48sg | V5         |
| 🔧 Platform Engineer       | tm_1772827442479_ubakln3h3 | V7, V8     |
| 🎨 Design Systems Engineer | tm_1772827447174_t1bzhuvt8 | V9, V10    |
| ⚡ Performance Engineer    | tm_1772827454409_bun9c5rcc | V11        |
| 🧪 QA Engineer             | tm_1772827458070_4g36ik1na | V12        |
| 🌐 Marketing Site Builder  | (create if needed)         | V13        |

## Per-Phase Worker Instructions

### Phase 1: PLAN

```
You are an Auto-LevelUp Evolution Planner for [{VERTICAL_NAME}] — Cycle 3: Combined Pass 1.

This cycle combines Feature Completion + Integration + Quality + UX Polish.

STEPS:
1. Read the monorepo structure and your vertical's current state
2. Read prior evolution docs at /docs/evolution/{vertical-id}/ if they exist
3. Analyze your vertical across ALL FOUR themes:
   a. FEATURES: What's incomplete or missing?
   b. INTEGRATION: What doesn't connect properly with other verticals?
   c. QUALITY: What bugs, edge cases, or validation gaps exist?
   d. UX POLISH: What looks rough, has no loading states, or needs visual improvement?
4. Produce a combined plan at /docs/evolution/{vertical-id}/cycle3-plan.md with:
   - Current state assessment (per theme)
   - Target state (what 80% complete looks like)
   - Ordered task list covering all 4 themes (feature tasks first, then integration, quality, UX)
   - Files to modify, acceptance criteria, complexity (S/M/L) per task

REPORT: maestro task report complete with summary
```

### Phase 2: IMPLEMENT

```
You are an Auto-LevelUp Evolution Builder for [{VERTICAL_NAME}] — Cycle 3: Combined Pass 1.

Read plan at /docs/evolution/{vertical-id}/cycle3-plan.md. Execute ALL tasks.

RULES: TypeScript strict (no any), Tailwind CSS, React best practices, use shared packages,
mobile-first responsive, don't break existing functionality.

PROCESS: Execute tasks in order → run pnpm build → write changelog → report complete
OUTPUT: /docs/evolution/{vertical-id}/cycle3-changelog.md
```

### Phase 3: TEST

```
You are an Auto-LevelUp Evolution Tester for [{VERTICAL_NAME}] — Cycle 3: Combined Pass 1.

Verify ALL FOUR themes:
- Features: Do they work end-to-end?
- Integration: Do they connect with other verticals?
- Quality: Are edge cases handled? Validation works?
- UX: Loading/error/empty states present? Basic polish applied?
Also: pnpm build (zero errors), pnpm lint (zero errors), run existing tests

OUTPUT: /docs/evolution/{vertical-id}/cycle3-test-report.md
```

---

## Vertical-by-Vertical Instructions

### V1: Type System & Ubiquitous Language (🏗️ Foundation Architect)

**Feature**: Eliminate remaining `any` types across codebase. Complete branded
types (TenantId, ClassId, SpaceId, StudentId, ExamId, TeacherId, ParentId).
Complete Zod schemas for all Firebase read boundaries. Complete barrel exports.
**Integration**: Verify shared types are consistently used across all 5 apps and
4 function modules. Fix type mismatches at cross-module boundaries. **Quality**:
Add strict null checks. Add runtime type guards at external data boundaries. Fix
any implicit `any` in generics. **UX**: Add JSDoc comments to exported types.
Ensure type names are intuitive and self-documenting. **Key Files**:
packages/shared-types/src/, functions/_/src/types/, all _.d.ts files

### V2: API Redesign & Consolidation (🏗️ Foundation Architect)

**Feature**: Complete consolidation 53 → ~25 callables (save* pattern). Complete
Zod validation at every entry point. Standardize all request/response formats.
Update all frontend service calls. **Integration**: Verify all frontend services
correctly hit new endpoints. Test API error propagation: function → service → UI
toast. **Quality**: Handle edge cases: empty arrays, null fields, oversized
payloads, malformed IDs. Add request timeout handling. **UX**: Improve error
messages to be user-actionable. Add optimistic update support for common
operations. Add proper loading states for multi-step operations. **Key Files**:
API_REDESIGN.md, functions/*/src/callable/, packages/shared-services/src/

### V3: Error Handling & Resource Lifecycle (🏗️ Foundation Architect)

**Feature**: Complete unified error class hierarchy. Complete per-user rate
limiting. Implement all TTLs (test sessions 24h, chat sessions 7d). Complete
cleanup functions. Complete cascade deletes. Complete error boundaries in all 5
apps. **Integration**: Test error propagation chain end-to-end: Cloud Function →
service → store → error boundary → toast. Verify rate limiting works across all
endpoints. **Quality**: Audit every try/catch — no swallowed errors. Add
structured logging with correlation IDs. Implement graceful degradation. **UX**:
Polish error toasts (icons, retry buttons). Add recovery suggestions. Add
progress indicators for long operations. **Key Files**: functions/_/src/utils/,
functions/_/src/callable/, packages/shared-ui/src/components/

### V4: Learning Platform & Content Engine (📚 Learning Engineer)

**Feature**: Complete space CRUD with draft/published transitions. Complete
store listing UI. Implement space templates/duplication. Complete drag-and-drop
reordering. Complete all item types. Complete rich text editor. Complete
progress tracking with visualization. Implement resume-where-you-left-off.
Complete search/filtering. **Integration**: Test full content lifecycle: teacher
creates → publishes → student enrolls → learns → progress tracked. Verify
progress flows to dashboards. **Quality**: Fix edge cases: empty spaces,
orphaned story points, concurrent editing. Validate content inputs (max lengths,
file sizes). Test with large datasets (100+ spaces). **UX**: Add smooth
transitions between content. Implement breadcrumb navigation. Add
search-as-you-type. Polish editor (auto-save indicator, unsaved changes
warning). Animate progress bars. **Key Files**: functions/levelup/src/callable/,
apps/teacher-web/, apps/student-web/

### V5: AutoGrade & AI Pipeline (🤖 AI & Grading Engineer)

**Feature**: Complete OCR pipeline (accuracy, validation, multi-format).
Complete grading pipeline (queue, batch, retry, confidence scoring). Complete
human-in-the-loop review. Complete AI chat (context memory, subject prompting,
safety). Complete LLM observability (logging, cost tracking, quotas). Implement
image quality handling. **Integration**: Test full grading flow: exam created
(V6) → student submits → OCR → AI grades → teacher reviews → results displayed.
Verify AI chat integrates with V4 content. **Quality**: Handle AI API failures
(timeout, rate limit, invalid response). Add confidence thresholds. Handle edge
cases: blank sheets, illegible writing. Retry with exponential backoff. **UX**:
Add typing indicator for AI chat. Polish grading review interface
(side-by-side). Add confidence visuals (green/yellow/red). Add loading state
during OCR. Celebrate high scores. **Key Files**: functions/autograde/src/,
apps/teacher-web/ (grading UI), apps/student-web/ (chat)

### V6: Digital Testing & Assessment (📚 Learning Engineer)

**Feature**: Complete test session lifecycle (start → in-progress → submit →
evaluate). Implement timer with auto-submit. Complete section-based navigation.
Support ALL question types (MCQ, short answer, essay, matching, fill-in-blanks).
Complete evaluation presets. Build question bank with difficulty tagging.
Complete student analytics. Begin adaptive testing. **Integration**: Test full
flow: teacher assigns → student takes → auto-submit on timer → graded (V5) →
results in dashboard (V9). Verify question bank integrates with V4 content.
**Quality**: Handle browser crash during test, network loss during submission.
Implement auto-save (every 30s). Handle timer edge cases. Validate submission
completeness. **UX**: Clean distraction-free test interface. Smooth question
navigation with progress indicator. "Review answers" screen. Visual timer
urgency (color change at 5min, 1min). Result reveal animations. Confetti for
passing scores. **Key Files**: functions/levelup/src/callable/,
apps/student-web/, apps/teacher-web/

### V7: Admin Dashboards (🔧 Platform Engineer)

**Feature**: **Super Admin**: Complete dashboard (metrics, activity), tenant
CRUD, user management, system health, evaluation presets, LLM usage dashboard,
platform config, announcements. **School Admin**: Complete dashboard (school
metrics), class management, teacher/student/parent management with bulk ops,
academic session management, analytics. **Integration**: Verify super admin
pulls real metrics from V4 (content), V5 (AI usage), V6 (assessments). Verify
school admin shows correct enrollment, results, performance. **Quality**: Add
loading skeletons for all widgets. Handle empty states (new tenant). Add
confirmation dialogs for destructive actions. Validate admin forms. Handle
pagination for large datasets. **UX**: Animated charts (count-up). Collapsible
sidebar. Quick-action cards. Sortable/searchable data tables. Breadcrumb
navigation. Keyboard shortcuts. **Key Files**: apps/super-admin/,
apps/admin-web/, functions/identity/src/callable/,
functions/analytics/src/callable/

### V8: Multi-Tenancy & Business Logic (🔧 Platform Engineer)

**Feature**: Complete dual onboarding (self-service + admin-managed). Implement
tenant branding. Build billing-ready structure (tiers, usage tracking, feature
gating). Complete tenant analytics. Verify data isolation. Implement data export
and deactivation. Complete role permissions. Complete onboarding wizard.
**Integration**: Verify V4 content scoped to tenant. V5 AI quotas per-tenant. V6
assessment data isolation. V7 admin shows tenant-scoped data. Billing captures
usage from V4-V7. **Quality**: Audit ALL Firestore security rules. Test edge
cases: deactivated tenant login, expired subscription, role downgrade. Handle
tenant deletion gracefully. Test concurrent operations. **UX**: Polish
onboarding wizard (step indicators, progress bar). Branding preview. Smooth role
switching. Welcome tour for new tenants. **Key Files**:
functions/identity/src/callable/, apps/admin-web/, firestore.rules

### V9: Student, Parent & Teacher Experience (🎨 Design Systems Engineer)

**Feature**: **Student**: Complete learning dashboard, achievements,
notifications, study planner, leaderboard, resume learning. **Parent**: Complete
child progress, test notifications, alerts, multi-child. **Teacher**: Complete
class dashboard with heatmap, assignment workflow, batch grading, reports,
content tools. Notification center UI. PDF report export. **Integration**:
Student dashboard shows V4 progress, V6 results, V5 AI chat. Parent shows
child's V4+V6+V5 data. Teacher shows V4 content, V6 assignments, V5 grading.
Notifications from V7. **Quality**: Fix all UI bugs. Handle empty states. Add
loading indicators for all async ops. Handle offline/slow network. Validate
inputs with inline errors. **UX**: Gamification polish (XP bars, level-up
animations, badges, streaks). Clean data viz for parents. Efficient workflow for
teachers (drag-drop, batch ops). Pull-to-refresh on mobile. **Key Files**:
apps/student-web/, apps/parent-web/, apps/teacher-web/

### V10: UI/UX Design System & Accessibility (🎨 Design Systems Engineer)

**Feature**: Complete design tokens in packages/tailwind-config/. Complete
shared-ui library (Skeleton, EmptyState, StatusBadge, DataTable, StatsCard,
ProgressRing). Standardize loading/error/empty states. Complete Framer Motion
animations. Complete accessibility (ARIA, keyboard, screen reader, WCAG AA).
Complete dark/light mode. Add prefers-reduced-motion. **Integration**: Verify
all V4-V9 features use shared-ui consistently. Test loading states for
cross-vertical data fetches. Verify dark/light mode on all views. **Quality**:
Audit component props — all properly typed. Fix style inconsistencies. Test with
extreme content (long text, missing images). Verify all state handling
(loading/error/disabled). **UX**: Refine micro-animations (250ms ease-out
transitions). Skeleton shimmer for all loading. Polish empty state
illustrations. Smooth focus ring animations. Subtle hover effects. Color
hierarchy consistency. Smooth scroll globally. **Key Files**:
packages/shared-ui/, packages/tailwind-config/, all 5 apps

### V11: Performance, PWA & Responsive Excellence (⚡ Performance Engineer)

**Feature**: Complete mobile-first responsive audit (375px, 768px, 1024px,
1440px). Touch-friendly (44px tap targets). Bottom nav for mobile. Safe area
handling. PWA for student-web (manifest, service worker, offline page, install).
Code splitting (React.lazy + Suspense). Bundle analysis. Image optimization
(WebP, lazy load, srcset). **Integration**: Re-run performance audit with full
feature set. Test PWA offline with integrated features. Verify code splitting
with cross-vertical imports. Test mobile on all integrated views. **Quality**:
Profile memory leaks. Fix render performance. Optimize Firestore queries
(indexes). Fix PWA cache invalidation. Test on slow 3G. **UX**: 60fps
animations. Blur-up image placeholders. Route prefetching. Instant page
transitions with suspense. Smart PWA install timing. **Key Files**: all 5 apps
(layouts, routes), vite.config.ts files

### V12: Testing & CI/CD Pipeline (🧪 QA Engineer)

**Feature**: **Playwright E2E**: Tests for all 5 apps. **Vitest**: All callable
functions, Zod schemas, services, stores. **Integration**: Firebase security
rules, auth flow, multi-tenant isolation, AI pipeline (mocked). **CI/CD**:
GitHub Actions (lint → type-check → unit → build → e2e → deploy).
**Integration**: Add cross-vertical E2E journeys (teacher creates content →
assigns test → student takes → AI grades → results in dashboard). Test CI with
full suite. **Quality**: Fix flaky tests. Add edge case scenarios. Add negative
testing. Increase coverage to >70%. **UX**: Visual regression tests for polished
UI states. Test animations with prefers-reduced-motion. Screenshot tests at all
breakpoints. **Key Files**: tests/e2e/, tests/integration/, .github/workflows/

### V13: Marketing Website & Landing Pages (🌐 Marketing Site Builder)

**Feature**: Create Astro static site with: hero section with product
screenshots, feature showcase for all roles (Schools, Teachers, Students,
Parents), "how it works" walkthrough, product demo section, pricing page with
tier comparison (Free/Basic/Pro/Enterprise), testimonials with metrics, FAQ
(general/pricing/security/AI), contact/demo request form. SEO: meta tags, Open
Graph, JSON-LD, sitemap.xml, robots.txt. **Integration**: Pricing tiers match V8
billing structure. Feature descriptions match completed V4-V10 features. Links
to product app. Contact form works end-to-end. **Quality**: Fix broken links,
missing images. Test all forms with validation. Fix responsive issues. Test on
slow network. Fix SEO issues. **UX**: Hero parallax or gradient animation.
Polished CTA buttons with hover effects. Scroll-triggered animations for feature
sections. Testimonial carousel. Floating nav with scroll progress. Mobile menu
slide-in animation. Target 90+ Lighthouse. **Key Files**: website/ (new Astro
project), shared Tailwind config

---

## Quality Gates

- [ ] `pnpm build` passes with zero errors across all apps + functions
- [ ] `pnpm lint` passes with zero errors
- [ ] All existing tests pass
- [ ] No `any` types in modified files
- [ ] All new features work end-to-end (not stubs)
- [ ] Cross-vertical integrations verified
- [ ] All forms have basic validation
- [ ] Loading/error states present on new views
- [ ] Mobile responsive on all new views
- [ ] Marketing website builds and deploys independently

## Codebase Entry Points

| Area                | Path                                                   |
| ------------------- | ------------------------------------------------------ |
| Root Config         | package.json, turbo.json, pnpm-workspace.yaml          |
| Firebase            | firebase.json, firestore.rules, firestore.indexes.json |
| Super Admin         | apps/super-admin/                                      |
| School Admin        | apps/admin-web/                                        |
| Teacher App         | apps/teacher-web/                                      |
| Student App         | apps/student-web/                                      |
| Parent App          | apps/parent-web/                                       |
| Identity Functions  | functions/identity/src/                                |
| LevelUp Functions   | functions/levelup/src/                                 |
| AutoGrade Functions | functions/autograde/src/                               |
| Analytics Functions | functions/analytics/src/                               |
| Shared UI           | packages/shared-ui/                                    |
| Shared Types        | packages/shared-types/                                 |
| Shared Services     | packages/shared-services/                              |
| Shared Hooks        | packages/shared-hooks/                                 |
| Shared Stores       | packages/shared-stores/                                |
| E2E Tests           | tests/e2e/                                             |
| Marketing Website   | website/                                               |

## Test Credentials

| User         | Email                     | Password        | Role           | App Port |
| ------------ | ------------------------- | --------------- | -------------- | -------- |
| Super Admin  | superadmin@levelup.test   | SuperAdmin123!  | Platform admin | 4567     |
| School Admin | admin@springfield.test    | TenantAdmin123! | School admin   | 4568     |
| Teacher      | teacher1@springfield.test | Teacher123!     | Teacher        | 4569     |
| Student      | student1@springfield.test | Student123!     | Student        | 4570     |
| Parent       | parent1@springfield.test  | Parent123!      | Parent         | 4571     |
