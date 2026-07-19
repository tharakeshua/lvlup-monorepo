# Auto-LevelUp Evolution Team Squad

> Team assembled for the systematic evolution of Auto-LevelUp from its current
> state to a production-grade, polished EdTech platform.

---

## Team Overview

| #   | Avatar | Name                        | Role                                               | Mode        | Verticals    | Skills                                                                                                                                                                    |
| --- | ------ | --------------------------- | -------------------------------------------------- | ----------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 🎯     | **Evolution Coordinator**   | Orchestrates all 13 evolution cycles               | Coordinator | All (V1–V13) | typescript-advanced-types, firebase-basics, vercel-react-best-practices, code-visualizer                                                                                  |
| 2   | 🏗️     | **Foundation Architect**    | TypeScript, API design & error handling specialist | Worker      | V1, V2, V3   | typescript-advanced-types, firebase-firestore-basics, firebase-basics, firebase-auth-basics, zustand-5, zod-schema-validation, nodejs-backend-patterns                    |
| 3   | 📚     | **Learning Engineer**       | Learning platform & assessment specialist          | Worker      | V4, V6       | firebase-basics, firebase-firestore-basics, vercel-react-best-practices, typescript-advanced-types, react-vite-best-practices, zustand-5, framer-motion-animator          |
| 4   | 🤖     | **AI & Grading Engineer**   | AutoGrade pipeline & AI integration specialist     | Worker      | V5           | firebase-basics, firebase-firestore-basics, typescript-advanced-types, nodejs-backend-patterns, zod-schema-validation                                                     |
| 5   | 🔧     | **Platform Engineer**       | Admin dashboards & multi-tenancy specialist        | Worker      | V7, V8       | vercel-react-best-practices, typescript-advanced-types, firebase-basics, firebase-firestore-basics, firebase-auth-basics, tailwind-design-system, nodejs-backend-patterns |
| 6   | 🎨     | **Design Systems Engineer** | UX, design system & accessibility specialist       | Worker      | V9, V10      | tailwind-design-system, framer-motion-animator, accessibility-a11y, vercel-react-best-practices, react-vite-best-practices, frontend-design, zustand-5                    |
| 7   | ⚡     | **Performance Engineer**    | PWA, performance & responsive specialist           | Worker      | V11          | pwa-development, react-vite-best-practices, vercel-react-best-practices, tailwind-design-system, accessibility-a11y, frontend-design                                      |
| 8   | 🧪     | **QA Engineer**             | Testing, CI/CD & quality assurance specialist      | Worker      | V12          | playwright-generate-test, github-actions-templates, typescript-advanced-types, vercel-react-best-practices, react-vite-best-practices                                     |
| 9   | 🌐     | **Marketing Site Builder**  | Marketing website & landing pages specialist       | Worker      | V13          | astro, tailwind-design-system, framer-motion-animator, accessibility-a11y, frontend-design                                                                                |

---

## Detailed Duties by Team Member

### 🎯 Evolution Coordinator

**ID**: `tm_1772827415906_pwp7iqzdk` **Mode**: Coordinator **Verticals**: All
(V1–V13)

**Duties**:

- Orchestrate the execution of all 13 evolution verticals (sequential within
  tiers, parallelized across independent verticals)
- Create maestro tasks with full worker instructions for each phase (Plan →
  Implement → Test)
- Spawn worker sessions and assign them to tasks
- Monitor worker progress via maestro session logs
- Review output quality (plans, code changes, test reports)
- Resolve blockers by creating fix sessions with targeted feedback
- Enforce quality gates (build pass, lint pass, type check, plan coverage,
  acceptance criteria)
- Maintain the evolution status board and track progress across all tiers
- Handle failures: respawn with feedback, create fix cycles, re-test as needed
- Ensure cross-vertical dependencies are respected
- Coordinate monorepo-wide impacts (shared packages affecting all 5 apps)

---

### 🏗️ Foundation Architect

**ID**: `tm_1772827423990_e254lbuxp` **Mode**: Worker **Verticals**: V1, V2, V3
(Priority Tier 1 — Foundation)

**V1 — Type System & Ubiquitous Language**:

- Audit all type definitions across `packages/shared-types/src/`
- Eliminate all `any` types from the entire codebase (apps, packages, functions)
- Create domain glossary (`/docs/domain-glossary.md`) defining all EdTech terms
- Ensure type names match domain glossary exactly
- Add branded types (TenantId, ClassId, SpaceId, StudentId, ExamId, etc.)
- Create shared type barrel export at `packages/shared-types/src/index.ts`
- Add Zod schemas for runtime validation at Firebase read boundaries in Cloud
  Functions
- Ensure type contracts between frontend and Cloud Functions are consistent

**V2 — API Redesign & Consolidation**:

- Implement the API redesign documented in `API_REDESIGN.md`
- Consolidate 53 callable endpoints → ~25 using upsert `save*` semantics
- Standardize request/response format across all 4 function modules
- Add Zod validation at every callable entry point
- Implement status transitions as field updates within `save*` functions
- Eliminate duplicate endpoints (e.g., `createTenant` + `updateTenant` →
  `saveTenant`)
- Update all frontend service calls to use the new API surface
- Maintain backward compatibility during migration or document breaking changes

**V3 — Error Handling & Resource Lifecycle**:

- Create unified error class hierarchy for Cloud Functions
- Standardize HTTP error codes and error response format
- Implement per-user rate limiting for all callable functions
- Add error boundary components in all 5 apps with Sonner toast integration
- Implement TTLs for stale resources (test sessions, chat sessions)
- Add scheduled cleanup Cloud Functions for expired resources
- Implement cascade deletes and orphan data cleanup
- Add error logging and monitoring hooks

---

### 📚 Learning Engineer

**ID**: `tm_1772827431038_ba107mn2u` **Mode**: Worker **Verticals**: V4, V6
(Priority Tier 2 — Core Experience)

**V4 — Learning Platform & Content Engine**:

- Polish space (course) CRUD with draft/published status transitions
- Improve store listing and discovery UI for student enrollment
- Add space templates, duplication/cloning, and versioning
- Improve story point (chapter) hierarchical navigation and reordering
- Implement drag-and-drop reorganization for story points
- Polish item (lesson/test/assignment) creation for all types
- Improve rich text editor experience and media attachment support
- Enhance progress tracking with visualization (charts, milestones)
- Add resume-where-you-left-off functionality for students
- Implement content search and filtering

**V6 — Digital Testing & Assessment**:

- Polish test session lifecycle (start → in-progress → submit → evaluate)
- Add timer with auto-submit on expiry
- Implement section-based navigation and answer review
- Support multiple question types (MCQ, short answer, essay, matching,
  fill-in-blanks)
- Enhance evaluation presets and rubric-based grading
- Build question bank per subject/topic with difficulty tagging
- Add student analytics (attempt history, performance trends, strength/weakness
  by topic)
- Implement adaptive testing (difficulty adjustment based on performance)
- Add mastery-based progression and personalized practice recommendations

---

### 🤖 AI & Grading Engineer

**ID**: `tm_1772827435178_pdjja48sg` **Mode**: Worker **Verticals**: V5
(Priority Tier 2 — Core Experience)

**V5 — AutoGrade & AI Pipeline**:

- **OCR Pipeline**: Improve extraction accuracy, add validation step, support
  multiple formats
- **Grading Pipeline**: Implement proper queue with batch processing, retry with
  exponential backoff, confidence scoring
- **Human-in-the-Loop**: Review interface for low-confidence grades, partial
  credit support
- **AI Chat Tutoring**: Enhance context memory, add subject-specific prompting,
  implement safety filters
- **Observability**: Enhance LLM call logging, add cost tracking per tenant,
  implement usage quotas
- **Error Handling**: Graceful Gemini API fallback, proper error messages, admin
  alerts for systemic failures
- Implement image quality handling (blur, rotation, skew correction for answer
  sheets)
- Add grading accuracy metrics and analytics dashboard
- Build AI usage dashboard for super admin

---

### 🔧 Platform Engineer

**ID**: `tm_1772827442479_ubakln3h3` **Mode**: Worker **Verticals**: V7, V8
(Priority Tier 3 — Business & Admin)

**V7 — Admin Dashboards**:

- **Super Admin Portal** (apps/super-admin/):
  - Dashboard home: active tenants, total users, system metrics, recent activity
  - Tenant management: CRUD tenants, activate/deactivate, view stats, billing
    status
  - User management: view all users, role management, activity logs
  - System health: Firebase usage, error rates, function invocation stats
  - Global evaluation presets management
  - LLM usage and cost dashboard
  - Platform configuration (feature flags, global settings)
  - Announcement system
- **School Admin Portal** (apps/admin-web/):
  - Dashboard home: school metrics, class overview, upcoming events
  - Class management: CRUD classes, assign teachers/students, schedule
  - Teacher/Student/Parent management with bulk operations
  - Academic session management (terms, semesters)
  - School-level analytics: performance trends, engagement metrics

**V8 — Multi-Tenancy & Business Logic**:

- Implement dual onboarding: self-service + admin-managed
- Tenant branding customization (logo, colors, custom domain ready)
- Build billing-ready structure (subscription tiers, usage tracking, feature
  gating)
- Tenant analytics dashboard (usage, engagement, performance benchmarks)
- Verify complete tenant data isolation via security rules audit
- Implement tenant data export and deactivation/archival flow
- Fine-grained staff role permissions (view-only, manage classes, manage
  content, full admin)
- Onboarding wizard with step-by-step setup

---

### 🎨 Design Systems Engineer

**ID**: `tm_1772827447174_t1bzhuvt8` **Mode**: Worker **Verticals**: V9, V10
(Priority Tier 4 — User Experience & Polish)

**V9 — Student, Parent & Teacher Experience**:

- **Student Portal**: Learning dashboard, achievement system, notification
  center, study planner, leaderboard, resume learning
- **Parent Portal**: Child progress dashboard, test result notifications,
  performance alerts, multi-child support
- **Teacher Portal**: Class dashboard with performance heatmap, assignment
  workflow, batch grading, student reports, content creation tools
- Ensure consistent UX patterns across all 3 role portals
- Add notification center UI (consuming existing trigger infrastructure)
- Implement PDF report export for teacher and parent portals

**V10 — UI/UX Design System & Accessibility**:

- Extend design tokens in `packages/tailwind-config/` (colors, typography,
  spacing, shadows)
- Audit and extend `packages/shared-ui/` component library:
  - Add: Skeleton loaders, EmptyState, StatusBadge, DataTable, StatsCard,
    ProgressRing
  - Standardize loading/error/empty states across all views
- Add micro-animations with Framer Motion (page transitions, score counting,
  achievement unlock, shimmer)
- Accessibility audit: ARIA labels, keyboard nav, screen reader, WCAG AA
  contrast, focus indicators
- Ensure dark/light mode consistency across all 5 apps
- Add `prefers-reduced-motion` support

---

### ⚡ Performance Engineer

**ID**: `tm_1772827454409_bun9c5rcc` **Mode**: Worker **Verticals**: V11
(Priority Tier 5 — Scale & Quality)

**V11 — Performance, PWA & Responsive Excellence**:

- Mobile-first responsive audit across all 5 apps at 375px, 768px, 1024px,
  1440px
- Touch-friendly interactions (44px minimum tap targets)
- Bottom navigation for mobile, responsive data tables (card view on mobile)
- Safe area handling (notch, home indicator)
- PWA setup for student-web: manifest.json, service worker, offline page,
  install prompt
- Code splitting per route (React.lazy + Suspense)
- Bundle analysis and tree-shaking audit across all 5 apps
- Image optimization (WebP, lazy loading, responsive srcset)
- Performance targets: FCP < 1.5s, TTI < 3s
- Vite build optimization (chunk splitting, preload hints)
- App-specific optimizations (preload for student-web, virtualization for
  admin-web, lightweight parent-web)

---

### 🧪 QA Engineer

**ID**: `tm_1772827458070_4g36ik1na` **Mode**: Worker **Verticals**: V12
(Priority Tier 5 — Scale & Quality)

**V12 — Testing & CI/CD Pipeline**:

- **Playwright E2E Tests** (expand existing in `tests/e2e/`):
  - Super Admin: tenant CRUD, user management, system dashboard
  - School Admin: class management, teacher/student operations
  - Teacher: space/item creation, test assignment, grading workflow
  - Student: enrollment, learning flow, test taking, progress viewing
  - Parent: login, child progress viewing, notifications
  - Cross-role flows and mobile viewport tests
- **Vitest Unit Tests**:
  - All callable functions (identity, levelup, autograde, analytics)
  - Zod schema validation, service layer functions, utility functions
  - Zustand store actions and selectors
- **Integration Tests**:
  - Firebase security rules (with emulators)
  - Auth flow (sign up → sign in → role assignment → tenant access)
  - Multi-tenant data isolation verification
  - AI grading pipeline (with mocked LLM responses)
- **CI/CD Pipeline** (GitHub Actions):
  - Workflow: Lint → Type Check → Unit Test → Build → E2E Test → Deploy
  - Preview deployments for PRs (Firebase Hosting preview channels)
  - Firebase Functions deployment on merge to main
  - Test result artifacts and coverage reports

---

### 🌐 Marketing Site Builder

**ID**: `{MARKETING_SITE_BUILDER_ID}` **Mode**: Worker **Verticals**: V13
(Priority Tier 5 — Scale, Quality & Market)

**V13 — Marketing Website & Landing Pages**:

- Build separate Astro static site for optimal SEO and performance
- Create stunning hero section with product screenshots/demo video and clear
  value proposition
- Feature showcase sections for all user roles (Schools, Teachers, Students,
  Parents)
- "How it works" step-by-step walkthrough section
- Product demo with interactive screenshots or embedded video
- Pricing page with tier comparison (Free, Basic, Pro, Enterprise)
- Testimonials/social proof section with metrics (students served, tests graded)
- FAQ section covering general, pricing, security, and AI capabilities
- Contact/demo request form with school info fields
- SEO optimization: meta tags, Open Graph, JSON-LD structured data, sitemap.xml,
  robots.txt
- Target 90+ Lighthouse score across all pages
- Smooth scroll animations (Intersection Observer)
- Fully responsive, mobile-first design
- Accessibility compliance (WCAG AA)
- Independent deployment — separate from the React SPA apps
- Share design tokens with the main app's Tailwind config

---

## Execution Flow

```
Parallelized Execution (independent verticals run concurrently where possible):

Tier 1 (Sequential):  V1 → V2 → V3
                           │
                           ▼
Tier 2 (Parallel):    V4 ─┬─ V5 ─┬─ V6
                          │      │
                          ▼      ▼
Tier 3 (Parallel):    V7 ─┬─ V8
                          │
                          ▼
Tier 4 (Parallel):    V9 ─┬─ V10
                          │
                          ▼
Tier 5 (Parallel):    V11 ─┬─ V12 ─┬─ V13
                                    │
                                    ▼
                                  DONE

Team Member Assignments:
🏗️ Foundation Architect  → V1, V2, V3
📚 Learning Engineer      → V4, V6
🤖 AI & Grading Engineer → V5
🔧 Platform Engineer      → V7, V8
🎨 Design Systems Eng.   → V9, V10
⚡ Performance Engineer   → V11
🧪 QA Engineer            → V12
🌐 Marketing Site Builder → V13

Each vertical follows: Plan → Implement → Test (3 phases, 3 sessions)
Total: 39 tasks, 39+ sessions across all 13 cycles
```

## Installed Skills Registry

| Skill                       | Source                             | Used By                                                                                                       |
| --------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| typescript-advanced-types   | wshobson/agents                    | Foundation Architect, Learning Engineer, AI & Grading Engineer, Platform Engineer, QA Engineer, Coordinator   |
| firebase-firestore-basics   | firebase/agent-skills              | Foundation Architect, Learning Engineer, AI & Grading Engineer, Platform Engineer                             |
| firebase-basics             | firebase/agent-skills              | Foundation Architect, Learning Engineer, AI & Grading Engineer, Platform Engineer, Coordinator                |
| firebase-auth-basics        | firebase/agent-skills              | Foundation Architect, Platform Engineer                                                                       |
| vercel-react-best-practices | vercel-labs/agent-skills           | Learning Engineer, Platform Engineer, Design Systems Engineer, Performance Engineer, QA Engineer, Coordinator |
| zustand-5                   | prowler-cloud/prowler              | Foundation Architect, Learning Engineer, Design Systems Engineer                                              |
| zod-schema-validation       | mindrally/skills                   | Foundation Architect, AI & Grading Engineer                                                                   |
| tailwind-design-system      | wshobson/agents                    | Platform Engineer, Design Systems Engineer, Performance Engineer, Marketing Site Builder                      |
| nodejs-backend-patterns     | (local)                            | Foundation Architect, AI & Grading Engineer, Platform Engineer                                                |
| framer-motion-animator      | patricio0312rev/skills             | Learning Engineer, Design Systems Engineer, Marketing Site Builder                                            |
| react-vite-best-practices   | asyrafhussin/agent-skills          | Learning Engineer, Design Systems Engineer, Performance Engineer, QA Engineer                                 |
| accessibility-a11y          | mindrally/skills                   | Design Systems Engineer, Performance Engineer, Marketing Site Builder                                         |
| pwa-development             | alinaqi/claude-bootstrap           | Performance Engineer                                                                                          |
| frontend-design             | (local)                            | Design Systems Engineer, Performance Engineer, Marketing Site Builder                                         |
| playwright-generate-test    | github/awesome-copilot             | QA Engineer                                                                                                   |
| github-actions-templates    | sickn33/antigravity-awesome-skills | QA Engineer                                                                                                   |
| astro                       | astrolicious/agent-skills          | Marketing Site Builder                                                                                        |
| code-visualizer             | (local)                            | Coordinator                                                                                                   |

---

## Test Credentials (Development / Emulator)

| User         | Email                     | Password        | Role           | Tenant | App Port |
| ------------ | ------------------------- | --------------- | -------------- | ------ | -------- |
| Super Admin  | superadmin@levelup.test   | SuperAdmin123!  | Platform admin | —      | 4567     |
| School Admin | admin@springfield.test    | TenantAdmin123! | School admin   | SPR001 | 4568     |
| Teacher      | teacher1@springfield.test | Teacher123!     | Teacher        | SPR001 | 4569     |
| Student      | student1@springfield.test | Student123!     | Student        | SPR001 | 4570     |
| Parent       | parent1@springfield.test  | Parent123!      | Parent         | SPR001 | 4571     |

---

## Key Codebase Entry Points

| Area                | Path                                                                                | Description                                   |
| ------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------- |
| Root Config         | `package.json`, `turbo.json`, `pnpm-workspace.yaml`                                 | Monorepo configuration                        |
| Firebase Config     | `firebase.json`, `firestore.rules`, `firestore.indexes.json`, `database.rules.json` | Firebase project setup                        |
| Super Admin App     | `apps/super-admin/`                                                                 | Platform administration portal                |
| School Admin App    | `apps/admin-web/`                                                                   | School/tenant administration portal           |
| Teacher App         | `apps/teacher-web/`                                                                 | Teacher dashboard and tools                   |
| Student App         | `apps/student-web/`                                                                 | Student learning portal                       |
| Parent App          | `apps/parent-web/`                                                                  | Parent progress tracking                      |
| Identity Functions  | `functions/identity/src/`                                                           | User, tenant, class management (12 callables) |
| LevelUp Functions   | `functions/levelup/src/`                                                            | Content, learning, testing (12 callables)     |
| AutoGrade Functions | `functions/autograde/src/`                                                          | Exam grading pipeline (9 callables)           |
| Analytics Functions | `functions/analytics/src/`                                                          | Reporting & insights (5 callables)            |
| Shared UI           | `packages/shared-ui/`                                                               | shadcn/ui component library                   |
| Shared Types        | `packages/shared-types/`                                                            | TypeScript type definitions                   |
| Shared Services     | `packages/shared-services/`                                                         | Firebase service layer                        |
| Shared Hooks        | `packages/shared-hooks/`                                                            | React hooks                                   |
| Shared Stores       | `packages/shared-stores/`                                                           | Zustand state stores                          |
| Shared Utils        | `packages/shared-utils/`                                                            | Utility functions                             |
| E2E Tests           | `tests/e2e/`                                                                        | Playwright test files                         |
| Integration Tests   | `tests/integration/`                                                                | Firebase emulator tests                       |
| Documentation       | `docs/`                                                                             | 60+ architecture & implementation docs        |
| API Redesign Spec   | `API_REDESIGN.md`                                                                   | API consolidation specification               |
| Marketing Website   | `website/` (new)                                                                    | Astro static site for customer acquisition    |

---

_Squad assembled and ready for evolution. The Evolution Coordinator will
orchestrate the parallelized execution of all 13 verticals across 5 waves,
transforming Auto-LevelUp into a production-grade EdTech platform._
