# Unified Platform: Phase-Wise Implementation Plan

**Version:** 1.0 **Date:** 2026-02-12 **Status:** Ready for Review **Based on:**
`DESIGN_PLAN_AND_NEXT_STEPS.md` + `UNIFIED_DESIGN_PLAN_AND_NEXT_STEPS.md`

---

## Overview

This document breaks the unified platform build into **8 phases** with concrete
tasks, deliverables, entry/exit criteria, and dependency mapping. Each phase is
further divided into sub-phases with task-level granularity.

### Source Codebase Summary

| Metric              | LevelUp                                       | AutoGrade                                   |
| ------------------- | --------------------------------------------- | ------------------------------------------- |
| **UI Components**   | 50 shadcn/ui (Radix + Tailwind)               | 14 custom (Headless UI + Tailwind)          |
| **Question Types**  | 30 renderers (15+ formats)                    | 2 types (subjective + MCQ)                  |
| **Services**        | 29 files across 11 domains                    | Firebase services in shared package         |
| **State Mgmt**      | Redux (1 slice) + 5 Contexts + TanStack Query | Zustand (3 stores)                          |
| **Cloud Functions** | None (client-side only)                       | 4 callable modules + workers + triggers     |
| **Apps**            | 1 monolith                                    | 3 apps (client-admin, super-admin, scanner) |
| **Packages**        | None                                          | 4 (@autograde/types, firebase, ui, utils)   |
| **Multi-tenancy**   | Loose (orgId field)                           | Strict (/clients/{clientId}/...)            |

---

## Phase 0: Monorepo Scaffold & Shared Foundations

**Duration:** 1 week **Goal:** Empty monorepo that builds, with shared packages
containing migrated assets **Parallel work:** None (this is the foundation)

### Entry Criteria

- Both design plans reviewed and approved
- Decision on platform name finalized
- Development environment setup (Node 20, pnpm)

### Tasks

#### 0.1 Monorepo Initialization

| #     | Task                      | Details                                                                                                                                                  | Est. |
| ----- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| 0.1.1 | Initialize pnpm workspace | Root `package.json` with `pnpm-workspace.yaml`, create `apps/`, `packages/`, `functions/`, `docs/`, `scripts/` directories                               | 2h   |
| 0.1.2 | Add Turborepo             | `turbo.json` with build/dev/lint/test pipelines, configure caching                                                                                       | 2h   |
| 0.1.3 | Shared TypeScript config  | Root `tsconfig.json` (strict mode), per-package extension configs                                                                                        | 2h   |
| 0.1.4 | Shared ESLint + Prettier  | `packages/eslint-config/` with unified rules, `.prettierrc` at root                                                                                      | 3h   |
| 0.1.5 | Shared Tailwind config    | `packages/tailwind-config/` with LevelUp's HSL theming, semantic tokens (`surface`, `text`, `accent`, `success`, `warning`, `danger`), dark mode support | 3h   |
| 0.1.6 | Vitest configuration      | Shared Vitest config, coverage thresholds, workspace-aware test runner                                                                                   | 2h   |
| 0.1.7 | Husky + lint-staged       | Pre-commit hooks for linting and type checking                                                                                                           | 1h   |

#### 0.2 Shared Packages Creation

| #     | Task                        | Details                                                                                                                                                | Est. |
| ----- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- |
| 0.2.1 | `packages/shared-types/`    | Scaffold package, configure build with `tsup`, export unified type interfaces (empty stubs initially)                                                  | 2h   |
| 0.2.2 | `packages/shared-ui/`       | Copy all 50 shadcn/ui components from LevelUp's `src/components/ui/`, configure as package with Tailwind CSS, verify all Radix UI dependencies resolve | 4h   |
| 0.2.3 | `packages/shared-services/` | Scaffold Firebase service layer package, set up Firebase SDK imports, configure environment-based Firebase config                                      | 3h   |
| 0.2.4 | `packages/shared-utils/`    | Merge utilities: LevelUp's `src/lib/utils.ts` + AutoGrade's `packages/utils/` (csv.ts, pdfHelper.ts), deduplicate                                      | 2h   |
| 0.2.5 | `packages/shared-hooks/`    | Scaffold React hooks package, move reusable hooks from LevelUp (progress tracking, metrics)                                                            | 2h   |

#### 0.3 Verification

| #     | Task                | Details                                                     | Est. |
| ----- | ------------------- | ----------------------------------------------------------- | ---- |
| 0.3.1 | Build pipeline test | Run `turbo build` successfully across all packages          | 1h   |
| 0.3.2 | Lint pipeline test  | Run `turbo lint` with zero errors                           | 1h   |
| 0.3.3 | CI/CD setup         | GitHub Actions workflow for build + lint + type-check on PR | 2h   |

### Exit Criteria

- [ ] `pnpm install` succeeds with no errors
- [ ] `turbo build` completes for all packages
- [ ] `turbo lint` passes with zero errors
- [ ] `shared-ui` package exports all 50 shadcn components and compiles
- [ ] TypeScript strict mode enabled in all shared packages
- [ ] CI/CD pipeline green on a test PR

### Deliverables

- Monorepo with 5 shared packages
- CI/CD pipeline
- Shared configs (TS, ESLint, Prettier, Tailwind, Vitest)

---

## Phase 1: Unified Auth & User Management

**Duration:** 2 weeks **Goal:** Single auth system supporting all roles with
multi-org membership **Depends on:** Phase 0 complete

### Entry Criteria

- Phase 0 monorepo builds successfully
- Firebase project selected for unified platform
- Decision on auth providers (Email/Password + Google OAuth + School Code)

### Tasks

#### 1.1 Unified Type Definitions

| #     | Task                              | Details                                                                                                                                                                                             | Est.       |
| ----- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------- | --------- | -------- | ------------------------------------------- | --- |
| 1.1.1 | Define `User` interface           | Merge LevelUp's `AppUser` (uid, email, fullName, age, grade, country) + AutoGrade's `AppUser` (uid, email, userData) into unified `User` in `shared-types`                                          | 3h         |
| 1.1.2 | Define `UserMembership` interface | Based on AutoGrade's membership pattern + LevelUp's role fields. Fields: id, uid, orgId, role, permissions, status, classIds, subjectIds, childIds                                                  | 3h         |
| 1.1.3 | Define `Organization` interface   | Merge LevelUp's `OrgDTO` (adminUids, code, groups) + AutoGrade's `Client` (schoolCode, subscription, geminiApiKey). Add: branding, featureFlags, settings                                           | 3h         |
| 1.1.4 | Define role types                 | `'superAdmin'                                                                                                                                                                                       | 'orgAdmin' | 'teacher' | 'student' | 'parent' | 'scanner'` with per-role permission presets | 2h  |
| 1.1.5 | Define permission types           | Granular permissions: `canCreateSpaces`, `canManageContent`, `canCreateExams`, `canEditRubrics`, `canViewAnalytics`, `canManageUsers`, `canManageClasses`, `canConfigureAgents`, `canManuallyGrade` | 2h         |

#### 1.2 Auth Store (Zustand)

| #     | Task                   | Details                                                                                                                                                                    | Est. |
| ----- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| 1.2.1 | Create `auth.store.ts` | Replace LevelUp's AuthContext + AutoGrade's auth.store. State: user, memberships, currentOrgId, loading, error. Actions: login, logout, switchOrg. Persist to localStorage | 4h   |
| 1.2.2 | Create `org.store.ts`  | Replace LevelUp's OrgContext. State: currentOrg, orgSettings, subscription. Actions: loadOrg, updateSettings                                                               | 3h   |
| 1.2.3 | Create `ui.store.ts`   | Merge LevelUp's AppContext + LoginDialogContext + OnboardingContext + AutoGrade's ui.store. State: sidebar, modals, theme, onboarding, notifications                       | 3h   |

#### 1.3 Auth Flow Implementation

| #     | Task                   | Details                                                                             | Est. |
| ----- | ---------------------- | ----------------------------------------------------------------------------------- | ---- |
| 1.3.1 | School code login flow | Input school code → lookup org → show email/password form. From AutoGrade's pattern | 4h   |
| 1.3.2 | Email/password auth    | Firebase Auth with email verification                                               | 3h   |
| 1.3.3 | Google OAuth           | Firebase Auth Google provider, auto-link to existing accounts                       | 3h   |
| 1.3.4 | Membership resolution  | On login: query `userMemberships` for user, set current org, load permissions       | 4h   |
| 1.3.5 | Multi-org switcher     | UI component for switching between organizations (for users in multiple orgs)       | 4h   |
| 1.3.6 | Onboarding flow        | New user: profile completion → org join (via code) → role assignment                | 4h   |

#### 1.4 Route Protection

| #     | Task                       | Details                                                                                                        | Est. |
| ----- | -------------------------- | -------------------------------------------------------------------------------------------------------------- | ---- |
| 1.4.1 | `ProtectedRoute` component | Role-based route guard checking auth + membership + permissions. Adapted from AutoGrade's `ProtectedRoute.tsx` | 3h   |
| 1.4.2 | Permission hooks           | `usePermission(permission)`, `useRole()`, `useCurrentOrg()` hooks                                              | 3h   |
| 1.4.3 | Route configuration        | Define route → role → permission mapping for all app sections                                                  | 2h   |

#### 1.5 Firestore Security Rules

| #     | Task                         | Details                                                                                            | Est. |
| ----- | ---------------------------- | -------------------------------------------------------------------------------------------------- | ---- |
| 1.5.1 | Write unified security rules | Adapt AutoGrade's RBAC rules to use `/organizations/{orgId}/` paths, add rules for new collections | 6h   |
| 1.5.2 | Test security rules          | Firebase emulator tests for all CRUD operations per role                                           | 4h   |

#### 1.6 Migration Scripts

| #     | Task                     | Details                                                                 | Est. |
| ----- | ------------------------ | ----------------------------------------------------------------------- | ---- |
| 1.6.1 | LevelUp user migration   | `userRoles` + `userOrgs` → `userMemberships` transform script           | 4h   |
| 1.6.2 | AutoGrade user migration | `users` (with embedded `userData`) → unified `User` + `userMemberships` | 4h   |
| 1.6.3 | Migration validation     | Verify user counts, role mappings, membership integrity post-migration  | 3h   |

#### 1.7 Tests

| #     | Task                      | Details                                                         | Est. |
| ----- | ------------------------- | --------------------------------------------------------------- | ---- |
| 1.7.1 | Unit tests for auth store | Login, logout, switchOrg, permission checks                     | 4h   |
| 1.7.2 | Unit tests for migration  | Data transform correctness for both LevelUp and AutoGrade users | 3h   |
| 1.7.3 | Integration tests         | Full login flow with Firebase emulator                          | 4h   |

### Exit Criteria

- [ ] User can log in via school code + email/password
- [ ] User can log in via Google OAuth
- [ ] Multi-org switching works for users with multiple memberships
- [ ] Route guards correctly restrict access by role and permission
- [ ] Firestore security rules pass all emulator tests
- [ ] Migration scripts produce valid data from both source systems
- [ ] All unit and integration tests pass

### Deliverables

- Unified type definitions in `shared-types`
- 3 Zustand stores (auth, org, ui)
- Auth flow components (login, onboarding, org switcher)
- ProtectedRoute + permission hooks
- Firestore security rules
- 2 migration scripts (LevelUp users, AutoGrade users)
- Test suite

---

## Phase 2: Data Model Migration

**Duration:** 2-3 weeks **Goal:** All data living in org-scoped Firestore
structure **Depends on:** Phase 1 complete (auth + user data migrated)

### Entry Criteria

- Phase 1 auth system working
- User migration scripts validated
- Staging Firebase project available

### Tasks

#### 2.1 Organization Data

| #     | Task                       | Details                                                                                                   | Est. |
| ----- | -------------------------- | --------------------------------------------------------------------------------------------------------- | ---- |
| 2.1.1 | Migrate LevelUp orgs       | `organizations` (flat) → `/organizations/{orgId}` with expanded fields (subscription, settings, branding) | 4h   |
| 2.1.2 | Migrate AutoGrade clients  | `clients/{clientId}` → `/organizations/{orgId}` (rename, preserve schoolCode, subscription, geminiApiKey) | 4h   |
| 2.1.3 | Migrate org groups/classes | LevelUp `groups` + AutoGrade `classes` → `/organizations/{orgId}/classes/{classId}` with unified schema   | 4h   |

#### 2.2 Content Data (LevelUp → Unified)

| #     | Task                     | Details                                                                                                                                                       | Est. |
| ----- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| 2.2.1 | Migrate courses → spaces | LevelUp `courses` → `/organizations/{orgId}/spaces/{spaceId}`. Map: course.title → space.title, course.description → space.description, preserve all metadata | 6h   |
| 2.2.2 | Migrate story points     | `storyPoints` (flat with courseId ref) → `/organizations/{orgId}/spaces/{spaceId}/storyPoints/{spId}`                                                         | 4h   |
| 2.2.3 | Migrate items            | `items` (flat with courseId ref) → `/organizations/{orgId}/spaces/{spaceId}/items/{itemId}`. Preserve all 15+ question type payloads                          | 6h   |
| 2.2.4 | Migrate agents           | `agents` → `/organizations/{orgId}/spaces/{spaceId}/agents/{agentId}`                                                                                         | 3h   |

#### 2.3 Exam Data (AutoGrade → Unified)

| #     | Task                | Details                                                                                                            | Est. |
| ----- | ------------------- | ------------------------------------------------------------------------------------------------------------------ | ---- |
| 2.3.1 | Migrate exams       | `/clients/{clientId}/exams/{examId}` → `/organizations/{orgId}/exams/{examId}`. Update clientId → orgId references | 4h   |
| 2.3.2 | Migrate questions   | `/clients/{clientId}/exams/{examId}/questions/{qId}` → same path under `/organizations/`                           | 3h   |
| 2.3.3 | Migrate submissions | `/clients/{clientId}/submissions/{subId}` + question submissions → org-scoped path                                 | 5h   |

#### 2.4 Progress & Activity Data

| #     | Task                        | Details                                                                                                            | Est. |
| ----- | --------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---- |
| 2.4.1 | Migrate learning progress   | LevelUp `userStoryPointProgress` + `userCourseProgress` → `/organizations/{orgId}/userProgress/{userId}_{spaceId}` | 5h   |
| 2.4.2 | Migrate timed test sessions | LevelUp timed test data → `/organizations/{orgId}/timedTestSessions/{sessionId}`                                   | 3h   |
| 2.4.3 | Migrate chat sessions       | LevelUp AI chat sessions → `/organizations/{orgId}/chatSessions/{sessionId}`                                       | 3h   |
| 2.4.4 | Migrate RTDB data           | Leaderboards, courseProgress, resumeProgress, practiceProgress → org-scoped RTDB paths                             | 5h   |

#### 2.5 Configuration Data

| #     | Task                            | Details                                                                            | Est. |
| ----- | ------------------------------- | ---------------------------------------------------------------------------------- | ---- |
| 2.5.1 | Migrate evaluation settings     | AutoGrade RELMS configs → `/organizations/{orgId}/evaluationSettings/{settingsId}` | 3h   |
| 2.5.2 | Migrate student/teacher records | AutoGrade `/clients/{clientId}/students/` + `/teachers/` → org-scoped              | 3h   |
| 2.5.3 | Migrate parent records          | AutoGrade `/clients/{clientId}/parents/` → org-scoped                              | 2h   |

#### 2.6 Indexes & Validation

| #     | Task                      | Details                                                                                 | Est. |
| ----- | ------------------------- | --------------------------------------------------------------------------------------- | ---- |
| 2.6.1 | Create Firestore indexes  | Composite indexes for new collection paths (by orgId+status, by orgId+classId, etc.)    | 4h   |
| 2.6.2 | Data integrity validation | Script to compare source vs target: doc counts, field completeness, reference integrity | 6h   |
| 2.6.3 | Rollback procedure        | Document and test rollback scripts for each migration step                              | 4h   |

### Exit Criteria

- [ ] All data from both systems exists in unified org-scoped structure
- [ ] Data integrity validation passes (zero data loss)
- [ ] Firestore indexes created and deployed
- [ ] RTDB data migrated to org-scoped paths
- [ ] Rollback procedures documented and tested on staging

### Deliverables

- 12+ migration scripts (one per collection type)
- Data validation scripts
- Updated Firestore indexes
- Rollback documentation
- Migration run report (counts, timing, any issues)

---

## Phase 3: Unified Service Layer

**Duration:** 2-3 weeks **Goal:** Single set of services + TanStack Query hooks
for all data operations **Depends on:** Phase 2 complete (data in unified
structure)

### Entry Criteria

- All data migrated to org-scoped Firestore
- Firestore indexes deployed
- `shared-types` package has all unified interfaces

### Tasks

#### 3.1 Core Services (in `shared-services`)

| #      | Task                        | Details                                                                                                                                                            | Est. |
| ------ | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- |
| 3.1.1  | `OrganizationService`       | CRUD for organizations, settings management, branding. Merge LevelUp's OrgsService + AutoGrade's client operations                                                 | 6h   |
| 3.1.2  | `UserManagementService`     | CRUD for users within an org, membership management, bulk import (from AutoGrade's bulkCreateStudents/Teachers). Merge LevelUp's UsersService + UserRolesService   | 8h   |
| 3.1.3  | `ClassesService`            | CRUD for classes, student/teacher assignment. Merge LevelUp's OrgGroupsService + AutoGrade's class operations                                                      | 5h   |
| 3.1.4  | `SpacesService`             | CRUD for spaces (formerly courses), content assignment to classes. Adapted from LevelUp's CoursesService, now org-scoped                                           | 6h   |
| 3.1.5  | `LearningUnitsService`      | CRUD for story points within spaces. Adapted from LevelUp's StoryPointsService                                                                                     | 4h   |
| 3.1.6  | `ItemsService`              | CRUD for items (all 15+ types) within spaces. Merge LevelUp's ItemsService + AutoGrade's question operations, unified under org scope                              | 8h   |
| 3.1.7  | `ExamsService`              | CRUD for exams + questions. Adapted from AutoGrade, now org-scoped. Keep question paper upload + AI extraction flow                                                | 6h   |
| 3.1.8  | `SubmissionsService`        | Handle both digital submissions (timed tests) and handwritten submissions (scanner). Merge AutoGrade's submission workflow with LevelUp's attempt tracking         | 8h   |
| 3.1.9  | `ProgressService`           | Unified progress tracking: story point progress, course progress, resume progress, practice range progress. Merge 5 LevelUp progress services into one, org-scoped | 8h   |
| 3.1.10 | `LeaderboardService`        | RTDB-backed leaderboards, org-scoped. Adapted from LevelUp's LeaderboardService                                                                                    | 4h   |
| 3.1.11 | `ChatService`               | AI chat session management. Adapted from LevelUp's ChatSessionService                                                                                              | 4h   |
| 3.1.12 | `AgentsService`             | AI agent configuration per space. From LevelUp's AgentsService                                                                                                     | 3h   |
| 3.1.13 | `EvaluationSettingsService` | RELMS feedback configuration per org. From AutoGrade's evaluation settings                                                                                         | 4h   |
| 3.1.14 | `ContentService`            | Rich content management (materials, media). From LevelUp's ContentService                                                                                          | 4h   |
| 3.1.15 | `GradingService`            | AI-powered grading pipeline. From AutoGrade's grading.ts (Gemini Vision)                                                                                           | 5h   |

#### 3.2 TanStack Query Integration

| #     | Task                  | Details                                                                                                | Est. |
| ----- | --------------------- | ------------------------------------------------------------------------------------------------------ | ---- |
| 3.2.1 | Query key factory     | Consistent query key structure: `[domain, orgId, ...params]` for cache invalidation                    | 3h   |
| 3.2.2 | Space query hooks     | `useSpaces()`, `useSpace(id)`, `useCreateSpace()`, `useUpdateSpace()`, `useDeleteSpace()`              | 4h   |
| 3.2.3 | Item query hooks      | `useItems(spaceId)`, `useItem(id)`, `useCreateItem()`, `useUpdateItem()` with optimistic updates       | 4h   |
| 3.2.4 | Exam query hooks      | `useExams()`, `useExam(id)`, `useCreateExam()`, submission hooks                                       | 4h   |
| 3.2.5 | User management hooks | `useStudents()`, `useTeachers()`, `useClasses()`, bulk operations                                      | 4h   |
| 3.2.6 | Progress hooks        | `useProgress(spaceId)`, `useLeaderboard(spaceId)`, real-time RTDB subscriptions wrapped in query hooks | 5h   |
| 3.2.7 | Analytics hooks       | `useOrgAnalytics()`, `useSpaceAnalytics()`, `useExamAnalytics()`                                       | 4h   |

#### 3.3 Real-time Subscriptions

| #     | Task                      | Details                                                                          | Est. |
| ----- | ------------------------- | -------------------------------------------------------------------------------- | ---- |
| 3.3.1 | Firestore listener hooks  | `useFirestoreSubscription()` wrapper for TanStack Query + Firestore `onSnapshot` | 4h   |
| 3.3.2 | RTDB listener hooks       | `useRTDBSubscription()` for leaderboards, live progress, resume tracking         | 4h   |
| 3.3.3 | Grading progress listener | Real-time grading status updates (from AutoGrade's pattern)                      | 3h   |

#### 3.4 Tests

| #     | Task               | Details                                                  | Est. |
| ----- | ------------------ | -------------------------------------------------------- | ---- |
| 3.4.1 | Service unit tests | Mock Firestore, test CRUD operations for all 15 services | 8h   |
| 3.4.2 | Query hook tests   | Test hook behavior (loading, error, cache invalidation)  | 6h   |
| 3.4.3 | Integration tests  | Firebase emulator tests for cross-service workflows      | 6h   |

### Exit Criteria

- [ ] All 15 services operational with org-scoped data access
- [ ] TanStack Query hooks for all CRUD operations
- [ ] Real-time subscriptions working for progress, leaderboards, grading
- [ ] Optimistic updates for key mutations (item creation, progress updates)
- [ ] Unit test coverage > 80% for services
- [ ] Integration tests pass with Firebase emulator

### Deliverables

- 15 unified services in `shared-services`
- 20+ TanStack Query hook sets
- Real-time subscription utilities
- Test suite (unit + integration)

---

## Phase 4: Cloud Functions Merge

**Duration:** 2-3 weeks **Goal:** Unified Cloud Functions backend with all
triggers, workers, and callables **Depends on:** Phase 2 (data structure), can
run **parallel** with Phase 3

### Entry Criteria

- Unified Firestore structure deployed (Phase 2)
- Unified type definitions available (Phase 1)

### Tasks

#### 4.1 Functions Scaffold

| #     | Task                 | Details                                                                                                         | Est. |
| ----- | -------------------- | --------------------------------------------------------------------------------------------------------------- | ---- |
| 4.1.1 | Reorganize directory | `functions/src/` with: `triggers/`, `workers/`, `callables/`, `scheduled/`, `shared/`, `core/`, `prompts/`      | 3h   |
| 4.1.2 | Shared middleware    | Auth validation, org context injection, rate limiting, error handling wrappers                                  | 5h   |
| 4.1.3 | LLM framework        | Keep AutoGrade's `core/llm/` (LLMWrapper, GeminiProvider, FirestoreLogger, CostCalculator). Add Claude provider | 4h   |

#### 4.2 Callable Functions

| #     | Task                     | Details                                                                                                                         | Est. |
| ----- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ---- |
| 4.2.1 | Port user-management     | AutoGrade's bulkCreateStudents, bulkCreateTeachers, generateCredentials, createStudentWithAuth → update to use org-scoped paths | 4h   |
| 4.2.2 | Port question-extraction | AutoGrade's extractQuestions → update storage/Firestore paths to org-scoped                                                     | 3h   |
| 4.2.3 | Port scanner-management  | AutoGrade's createScanner, deleteScanner → update paths                                                                         | 2h   |
| 4.2.4 | Port AI chat             | AutoGrade's chatWithAI → merge with LevelUp's agent-based chat model. Support both Gemini and Claude                            | 5h   |
| 4.2.5 | New: Evaluation callable | LevelUp's agent-based evaluation logic as a callable function (question grading, feedback generation)                           | 6h   |
| 4.2.6 | New: Content generation  | AI-powered question generation, practice generation from exam weak areas                                                        | 5h   |

#### 4.3 Triggers

| #     | Task                              | Details                                                                    | Est. |
| ----- | --------------------------------- | -------------------------------------------------------------------------- | ---- |
| 4.3.1 | Port exam triggers                | AutoGrade's exam creation/update triggers → org-scoped paths               | 3h   |
| 4.3.2 | Port submission triggers          | AutoGrade's submission triggers (initiate scouting + grading) → org-scoped | 4h   |
| 4.3.3 | Port evaluation settings triggers | Update default dimensions on settings change → org-scoped                  | 2h   |
| 4.3.4 | New: Progress aggregation trigger | On item completion → update space progress → update leaderboard            | 5h   |
| 4.3.5 | New: Notification trigger         | On grading complete / new content / new exam → create notifications        | 4h   |

#### 4.4 Workers (HTTP)

| #     | Task                             | Details                                                                                    | Est. |
| ----- | -------------------------------- | ------------------------------------------------------------------------------------------ | ---- |
| 4.4.1 | Port answer-mapping (Panopticon) | AutoGrade's answer-to-question routing via AI → org-scoped                                 | 4h   |
| 4.4.2 | Port answer-grading (RELMS)      | AutoGrade's multi-dimensional grading via AI → org-scoped, use configurable RELMS settings | 5h   |
| 4.4.3 | New: Digital item evaluation     | LevelUp's question evaluation logic as a worker (code evaluation, text grading)            | 6h   |

#### 4.5 Scheduled Functions

| #     | Task                        | Details                                                                    | Est. |
| ----- | --------------------------- | -------------------------------------------------------------------------- | ---- |
| 4.5.1 | Daily analytics aggregation | Compute per-org daily stats: active users, submissions, content engagement | 4h   |
| 4.5.2 | Weekly report generation    | Auto-generate weekly progress reports per class                            | 4h   |
| 4.5.3 | Cleanup function            | Remove stale sessions, orphaned uploads, expired data                      | 3h   |

#### 4.6 Deployment & Testing

| #     | Task                | Details                                               | Est. |
| ----- | ------------------- | ----------------------------------------------------- | ---- |
| 4.6.1 | Staging deployment  | Deploy all functions to staging project               | 2h   |
| 4.6.2 | Integration testing | Test all triggers, callables, workers with emulator   | 6h   |
| 4.6.3 | Load testing        | Simulate concurrent grading requests, bulk operations | 4h   |

### Exit Criteria

- [ ] All AutoGrade functions ported and working with org-scoped paths
- [ ] LevelUp evaluation logic ported as callable/worker
- [ ] AI chat supports both Gemini and Claude providers
- [ ] All triggers fire correctly on data changes
- [ ] Functions deployed to staging with zero errors
- [ ] Integration tests pass with emulator

### Deliverables

- Unified `functions/` directory with organized structure
- 6 callable functions, 5 triggers, 3 workers, 3 scheduled functions
- LLM framework with Gemini + Claude providers
- Staging deployment
- Test suite

---

## Phase 5: Web App — Student, Teacher & Parent Experience

**Duration:** 4-5 weeks **Goal:** Main web application with all user-facing
features **Depends on:** Phase 3 (service layer) + Phase 4 (cloud functions)

### Entry Criteria

- Service layer with TanStack Query hooks operational
- Cloud Functions deployed to staging
- Auth system with role-based routing working
- All shared packages (UI, types, services, hooks) stable

### Tasks

#### 5.1 App Scaffold

| #     | Task                    | Details                                                                                                                                              | Est. |
| ----- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| 5.1.1 | Initialize `apps/web/`  | Vite + React + TypeScript, import all shared packages, configure Tailwind with shared config                                                         | 4h   |
| 5.1.2 | Responsive layout shell | Sidebar + header + main content area. Role-adaptive: sidebar shows different nav items per role. From LevelUp's layout pattern + AutoGrade's sidebar | 8h   |
| 5.1.3 | Route configuration     | Lazy-loaded routes with code splitting per role. From LevelUp's `App.tsx` pattern                                                                    | 4h   |
| 5.1.4 | Theme system            | Light/dark mode toggle, per-org branding via CSS variables                                                                                           | 4h   |
| 5.1.5 | Error boundaries        | Route-level + feature-level error boundaries with fallback UI                                                                                        | 3h   |
| 5.1.6 | Notification system     | Sonner integration for toasts, notification center component                                                                                         | 3h   |

#### 5.2 Student Features

| #     | Task                           | Details                                                                                                                                                                                                                    | Est. |
| ----- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| 5.2.1 | Student dashboard              | Combined view: assigned spaces + upcoming exams + recent results + progress summary                                                                                                                                        | 8h   |
| 5.2.2 | Space viewer                   | Story point navigation, item rendering, progress tracking bar. From LevelUp's space/course viewer                                                                                                                          | 8h   |
| 5.2.3 | Question renderers (all types) | Port all 30 question components from LevelUp: MCQ, MCAQ, true-false, text, code, matching, fill-blanks, fill-blanks-DD, paragraph, jumbled, audio, group-options, numerical, image-evaluation, chat-agent, material blocks | 16h  |
| 5.2.4 | Timed test experience          | Full timed test UI: question navigation, timer, review marking, submission. From LevelUp's `features/timed-test/`                                                                                                          | 10h  |
| 5.2.5 | Practice range                 | LeetCode-style practice with RTDB progress tracking. From LevelUp's `components/practiceRange/`                                                                                                                            | 8h   |
| 5.2.6 | Exam results viewer            | View graded exams with RELMS feedback, rubric breakdown, dimensional feedback. Merge AutoGrade's result view with richer UI                                                                                                | 8h   |
| 5.2.7 | AI chat tutor                  | Chat panel with AI tutoring. From LevelUp's `AiChatPanel.tsx` + `ChatSessionPanel.tsx`                                                                                                                                     | 6h   |
| 5.2.8 | Leaderboard                    | Per-space leaderboard with real-time updates. From LevelUp's leaderboard components                                                                                                                                        | 4h   |
| 5.2.9 | Student profile + settings     | Profile editing, theme preferences, notification settings                                                                                                                                                                  | 4h   |

#### 5.3 Teacher Features

| #     | Task                     | Details                                                                                                                                | Est. |
| ----- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| 5.3.1 | Teacher dashboard        | Overview: spaces managed, exams in progress, pending grading, class stats                                                              | 8h   |
| 5.3.2 | Space creator/editor     | Create and edit learning spaces, manage story points, reorder content. From LevelUp's editor components                                | 10h  |
| 5.3.3 | Question/item creator    | Create all question types, material blocks, interactive content. From LevelUp's `QuestionCreateDialog.tsx` + `AiQuestionGenerator.tsx` | 10h  |
| 5.3.4 | Exam creator             | Create exam, upload question paper, AI extraction, edit extracted questions, rubric configuration. From AutoGrade's exam workflow      | 10h  |
| 5.3.5 | Grading review interface | View AI-graded submissions, override scores, add manual feedback. From AutoGrade's grading UI                                          | 8h   |
| 5.3.6 | Class management         | View/manage classes, assign content + exams to classes                                                                                 | 5h   |
| 5.3.7 | Student progress views   | Per-student progress across spaces + exams, identify weak areas                                                                        | 6h   |
| 5.3.8 | Analytics dashboard      | Class-level analytics: avg scores, completion rates, question difficulty analysis. Recharts visualizations                             | 8h   |

#### 5.4 Parent Features

| #     | Task                     | Details                                                       | Est. |
| ----- | ------------------------ | ------------------------------------------------------------- | ---- |
| 5.4.1 | Parent dashboard         | Children's overview: spaces, exams, progress across children  | 6h   |
| 5.4.2 | Exam results viewer      | View child's graded exams (read-only version of student view) | 4h   |
| 5.4.3 | Learning progress viewer | View child's learning progress across spaces                  | 4h   |

#### 5.5 Shared Components

| #     | Task                     | Details                                                                                | Est. |
| ----- | ------------------------ | -------------------------------------------------------------------------------------- | ---- |
| 5.5.1 | Markdown + Math renderer | Unified MarkdownWithMath component (merge best of LevelUp + AutoGrade implementations) | 3h   |
| 5.5.2 | PDF viewer               | In-app PDF preview for question papers, materials                                      | 3h   |
| 5.5.3 | Image viewer/gallery     | Zoomable image viewer for answer sheets, materials                                     | 3h   |
| 5.5.4 | Data tables              | Sortable, filterable, paginated tables using shadcn Table + TanStack Table             | 5h   |
| 5.5.5 | Chart components         | Reusable chart wrappers (bar, line, pie, radar) with Recharts                          | 4h   |
| 5.5.6 | Empty states             | Consistent empty state components for all list views                                   | 2h   |
| 5.5.7 | Loading skeletons        | Skeleton loading states for all major views                                            | 3h   |

#### 5.6 Tests

| #     | Task                   | Details                                                  | Est. |
| ----- | ---------------------- | -------------------------------------------------------- | ---- |
| 5.6.1 | Component unit tests   | Key UI components, question renderers, dashboard widgets | 8h   |
| 5.6.2 | Page integration tests | Dashboard rendering, navigation flows, form submissions  | 6h   |
| 5.6.3 | Accessibility tests    | Automated a11y testing with axe-core for all views       | 4h   |

### Exit Criteria

- [ ] Student can: browse spaces, take timed tests, practice, view exam results,
      chat with AI tutor, see leaderboard
- [ ] Teacher can: create/edit spaces + items + exams, review grading, manage
      classes, view analytics
- [ ] Parent can: view children's progress and exam results
- [ ] All 15+ question types render and function correctly
- [ ] Role-based navigation shows correct sections per role
- [ ] Dark mode works across all views
- [ ] Mobile-responsive layout
- [ ] Component tests pass

### Deliverables

- `apps/web/` — fully functional web application
- 30+ question renderers (ported from LevelUp)
- Role-based dashboards (student, teacher, parent)
- Timed test + practice range experiences
- AI chat integration
- Analytics dashboards with charts

---

## Phase 6: Admin Apps

**Duration:** 3-4 weeks **Goal:** Organization admin + platform super admin +
updated scanner **Depends on:** Phase 3 (service layer), can run **partially
parallel** with Phase 5

### Entry Criteria

- Service layer operational
- Auth with orgAdmin and superAdmin roles working
- Shared UI components stable

### Tasks

#### 6.1 Organization Admin (`apps/admin/`)

| #     | Task                        | Details                                                                                              | Est. |
| ----- | --------------------------- | ---------------------------------------------------------------------------------------------------- | ---- |
| 6.1.1 | App scaffold                | Vite + React, shared packages, admin-specific layout (sidebar with admin nav)                        | 4h   |
| 6.1.2 | User management             | CRUD for students, teachers, parents, scanners. Bulk import via CSV. From AutoGrade's admin features | 10h  |
| 6.1.3 | Class management            | CRUD for classes (grade, section, academic year), assign students + teachers                         | 6h   |
| 6.1.4 | Content assignment          | Assign spaces + exams to classes, manage access                                                      | 5h   |
| 6.1.5 | Subscription management     | View current plan, usage stats, feature limits                                                       | 4h   |
| 6.1.6 | Evaluation settings (RELMS) | Configure feedback dimensions, presets, display settings. From AutoGrade's RELMS config UI           | 8h   |
| 6.1.7 | Organization settings       | Branding (logo, colors), API keys (Gemini), notification preferences                                 | 5h   |
| 6.1.8 | Analytics + reports         | Org-wide analytics: active users, exam stats, content engagement. PDF report export                  | 8h   |
| 6.1.9 | Bulk import/export          | CSV import for students/teachers, data export for compliance                                         | 5h   |

#### 6.2 Super Admin (`apps/super-admin/`)

| #     | Task                              | Details                                                         | Est. |
| ----- | --------------------------------- | --------------------------------------------------------------- | ---- |
| 6.2.1 | App scaffold                      | Vite + React, shared packages, super-admin layout               | 3h   |
| 6.2.2 | Organization management           | CRUD for organizations, activate/suspend, manage subscriptions  | 6h   |
| 6.2.3 | Cross-org user management         | Search users across orgs, manage memberships, handle disputes   | 5h   |
| 6.2.4 | Platform analytics                | Global stats: total orgs, users, exams, AI usage, cost tracking | 6h   |
| 6.2.5 | Subscription + billing management | Plan management, usage-based billing overview                   | 4h   |
| 6.2.6 | System health                     | Function execution stats, error rates, storage usage            | 4h   |

#### 6.3 Scanner App Update (`apps/scanner/`)

| #     | Task                 | Details                                                         | Est. |
| ----- | -------------------- | --------------------------------------------------------------- | ---- |
| 6.3.1 | Port from AutoGrade  | Copy `apps/scanner-app/`, update imports to use shared packages | 3h   |
| 6.3.2 | Update auth          | Use unified auth with scanner role                              | 3h   |
| 6.3.3 | Update data paths    | All Firestore/Storage operations → org-scoped paths             | 4h   |
| 6.3.4 | Keep mobile-first UX | Verify responsive layout, camera integration, upload flow       | 3h   |

#### 6.4 Tests

| #     | Task              | Details                                             | Est. |
| ----- | ----------------- | --------------------------------------------------- | ---- |
| 6.4.1 | Admin app tests   | CRUD operations, permission checks, bulk operations | 6h   |
| 6.4.2 | Super admin tests | Org management, cross-org operations                | 4h   |
| 6.4.3 | Scanner app tests | Upload flow, auth flow                              | 3h   |

### Exit Criteria

- [ ] Org admin can manage users, classes, content, evaluation settings, and
      view analytics
- [ ] Super admin can manage all organizations and view platform-wide analytics
- [ ] Scanner app works with unified auth and org-scoped data
- [ ] CSV bulk import/export functional
- [ ] PDF report generation works

### Deliverables

- `apps/admin/` — organization admin dashboard
- `apps/super-admin/` — platform admin dashboard
- `apps/scanner/` — updated scanner app
- Admin test suites

---

## Phase 7: Advanced Features & Cross-System Intelligence

**Duration:** 3-4 weeks **Goal:** Features that leverage the unified data model
for cross-system intelligence **Depends on:** Phase 5 + Phase 6 complete

### Entry Criteria

- Web app fully functional
- Admin apps operational
- All data flowing through unified pipeline

### Tasks

#### 7.1 Cross-System Features

| #     | Task                    | Details                                                                                                 | Est. |
| ----- | ----------------------- | ------------------------------------------------------------------------------------------------------- | ---- |
| 7.1.1 | Smart question bank     | Questions usable in both learning mode (spaces) and exam mode. Unified question editor with mode toggle | 8h   |
| 7.1.2 | Auto-generated practice | Analyze exam weak areas → auto-generate targeted practice spaces with relevant items                    | 10h  |
| 7.1.3 | Cross-system analytics  | Correlate digital practice performance with exam scores. Show "practice impact" metrics                 | 8h   |
| 7.1.4 | Hybrid learning units   | Single unit that includes digital practice items + physical exam reference. Unified progress view       | 6h   |

#### 7.2 Notification System

| #     | Task                     | Details                                                                                         | Est. |
| ----- | ------------------------ | ----------------------------------------------------------------------------------------------- | ---- |
| 7.2.1 | In-app notifications     | Notification center: new exams, grading complete, new content, achievement unlocks              | 6h   |
| 7.2.2 | Email notifications      | Transactional emails via Firebase Extensions or SendGrid: exam results, weekly summaries        | 5h   |
| 7.2.3 | Push notifications       | Firebase Cloud Messaging for web push: real-time alerts for grading completion, new assignments | 5h   |
| 7.2.4 | Notification preferences | Per-user, per-channel notification settings                                                     | 3h   |

#### 7.3 PWA & Offline

| #     | Task                  | Details                                                                                 | Est. |
| ----- | --------------------- | --------------------------------------------------------------------------------------- | ---- |
| 7.3.1 | Service worker setup  | Workbox integration for `apps/web/`, cache strategies for static assets + API responses | 5h   |
| 7.3.2 | Offline practice mode | Cache space data + items for offline practice. Queue submissions for sync               | 8h   |
| 7.3.3 | Install prompt        | PWA install banner, manifest configuration                                              | 2h   |

#### 7.4 Performance Optimization

| #     | Task                         | Details                                                                                                           | Est. |
| ----- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---- |
| 7.4.1 | Bundle analysis + splitting  | Analyze bundle sizes per route, optimize code splitting, lazy load heavy components (CodeMirror, Recharts, KaTeX) | 5h   |
| 7.4.2 | Image optimization           | Lazy loading, WebP conversion, srcset for responsive images                                                       | 4h   |
| 7.4.3 | Firestore query optimization | Denormalization for hot queries, pagination for large collections, cursor-based infinite scroll                   | 6h   |
| 7.4.4 | React performance            | Memo, useMemo, useCallback audits, virtualized lists for large data sets                                          | 5h   |

#### 7.5 Accessibility (WCAG AA)

| #     | Task                      | Details                                                                         | Est. |
| ----- | ------------------------- | ------------------------------------------------------------------------------- | ---- |
| 7.5.1 | Keyboard navigation audit | Full keyboard navigation for all interactive elements, focus management         | 5h   |
| 7.5.2 | Screen reader testing     | ARIA labels, live regions, semantic HTML verification                           | 5h   |
| 7.5.3 | Color contrast audit      | Verify all color combinations meet WCAG AA (4.5:1 for text, 3:1 for large text) | 3h   |
| 7.5.4 | Motion preferences        | Respect `prefers-reduced-motion`, provide animation toggles                     | 2h   |

#### 7.6 Internationalization (i18n)

| #     | Task                   | Details                                                                       | Est. |
| ----- | ---------------------- | ----------------------------------------------------------------------------- | ---- |
| 7.6.1 | i18n framework setup   | `react-i18next` or `next-intl`, translation file structure, language switcher | 4h   |
| 7.6.2 | English translations   | Extract all strings to translation files                                      | 6h   |
| 7.6.3 | Hindi translations     | Translate all strings to Hindi (initial supported language)                   | 4h   |
| 7.6.4 | RTL support foundation | Layout adjustments for future RTL language support                            | 3h   |

#### 7.7 Error Handling & Logging

| #     | Task                              | Details                                                                             | Est. |
| ----- | --------------------------------- | ----------------------------------------------------------------------------------- | ---- |
| 7.7.1 | Error boundary hierarchy          | App-level → route-level → feature-level error boundaries with appropriate fallbacks | 4h   |
| 7.7.2 | Error reporting                   | Client-side error logging to Firebase Analytics or Sentry                           | 3h   |
| 7.7.3 | Request retry + offline detection | Automatic retry for failed API calls, offline detection banner                      | 3h   |

### Exit Criteria

- [ ] Smart question bank allows questions in both learning and exam modes
- [ ] Auto-generated practice creates targeted content from exam weak areas
- [ ] Cross-system analytics shows practice-to-exam correlations
- [ ] In-app + email + push notifications working
- [ ] PWA installable with offline practice mode
- [ ] Bundle size < 200KB initial load (gzipped)
- [ ] WCAG AA compliance verified
- [ ] English + Hindi translations complete

### Deliverables

- Cross-system intelligence features
- Unified notification system (in-app + email + push)
- PWA with offline support
- Performance optimizations
- Accessibility compliance report
- i18n with English + Hindi

---

## Phase 8: Testing, Migration & Production Launch

**Duration:** 2-3 weeks **Goal:** Production-ready, live deployment **Depends
on:** All previous phases complete

### Entry Criteria

- All features implemented and individually tested
- Staging environment fully operational
- Real data available for migration testing

### Tasks

#### 8.1 End-to-End Testing

| #     | Task                  | Details                                                                          | Est. |
| ----- | --------------------- | -------------------------------------------------------------------------------- | ---- |
| 8.1.1 | Playwright setup      | E2E test framework, CI integration, browser matrix (Chrome, Firefox, Safari)     | 4h   |
| 8.1.2 | Student journey tests | Sign up → join org → browse spaces → take test → view results → chat with tutor  | 6h   |
| 8.1.3 | Teacher journey tests | Login → create space → add items → create exam → review grading → view analytics | 6h   |
| 8.1.4 | Admin journey tests   | Login → manage users → manage classes → configure settings → view reports        | 5h   |
| 8.1.5 | Scanner journey tests | Login → select exam → scan sheets → verify upload                                | 3h   |
| 8.1.6 | Cross-role tests      | Teacher assigns → student completes → parent views → admin reviews               | 4h   |

#### 8.2 Performance Testing

| #     | Task                        | Details                                                                          | Est. |
| ----- | --------------------------- | -------------------------------------------------------------------------------- | ---- |
| 8.2.1 | Load testing setup          | Artillery or k6 for simulating concurrent users                                  | 3h   |
| 8.2.2 | Concurrent user simulation  | Test with 1000+ concurrent users: page loads, API calls, real-time subscriptions | 5h   |
| 8.2.3 | Firestore performance       | Query latency under load, index effectiveness, read/write throughput             | 4h   |
| 8.2.4 | Cloud Functions performance | Cold start times, concurrent execution, memory usage                             | 3h   |

#### 8.3 Security Audit

| #     | Task                  | Details                                                         | Est. |
| ----- | --------------------- | --------------------------------------------------------------- | ---- |
| 8.3.1 | Firestore rules audit | Verify no unauthorized data access across orgs, test edge cases | 4h   |
| 8.3.2 | API security review   | Auth token validation, rate limiting, input sanitization        | 4h   |
| 8.3.3 | Client-side security  | XSS prevention, CSRF protection, secure storage of tokens       | 3h   |
| 8.3.4 | Dependency audit      | `npm audit`, update vulnerable packages, review supply chain    | 2h   |

#### 8.4 Data Migration (Production)

| #     | Task                       | Details                                                              | Est. |
| ----- | -------------------------- | -------------------------------------------------------------------- | ---- |
| 8.4.1 | Pre-migration backup       | Full backup of both LevelUp and AutoGrade production databases       | 2h   |
| 8.4.2 | Staging migration dry run  | Run all migration scripts on staging with production data copy       | 6h   |
| 8.4.3 | Data validation on staging | Full integrity checks, spot-check sample records, verify counts      | 4h   |
| 8.4.4 | Production migration       | Execute migration with downtime window, dual-write period for safety | 6h   |
| 8.4.5 | Post-migration validation  | Verify all data in production, compare against pre-migration counts  | 4h   |

#### 8.5 Pilot & Rollout

| #     | Task                      | Details                                                | Est. |
| ----- | ------------------------- | ------------------------------------------------------ | ---- |
| 8.5.1 | Select pilot schools      | 3-5 schools representing different sizes and use cases | 2h   |
| 8.5.2 | Pilot deployment          | Deploy to pilot schools, provide training materials    | 4h   |
| 8.5.3 | Pilot feedback collection | Structured feedback: bugs, UX issues, feature requests | 4h   |
| 8.5.4 | Bug fixes from pilot      | Address critical and high-priority issues              | 8h   |
| 8.5.5 | Gradual rollout           | 10% → 25% → 50% → 100% of schools over 2 weeks         | 4h   |

#### 8.6 Production Infrastructure

| #     | Task                       | Details                                                                          | Est. |
| ----- | -------------------------- | -------------------------------------------------------------------------------- | ---- |
| 8.6.1 | Production Firebase config | Separate production project, security rules, indexes                             | 3h   |
| 8.6.2 | CDN + hosting              | Firebase Hosting with CDN, custom domain configuration                           | 2h   |
| 8.6.3 | Monitoring + alerting      | Firebase Performance Monitoring, Cloud Functions error alerts, uptime monitoring | 4h   |
| 8.6.4 | Backup + disaster recovery | Automated Firestore backups, RTDB exports, documented recovery procedures        | 4h   |

### Exit Criteria

- [ ] All E2E tests pass across Chrome, Firefox, Safari
- [ ] System handles 1000+ concurrent users without degradation
- [ ] Security audit passes with no critical/high findings
- [ ] Production data migration validated
- [ ] Pilot feedback addressed
- [ ] Monitoring and alerting in place
- [ ] Backup procedures documented and tested

### Deliverables

- E2E test suite (Playwright)
- Performance test results + optimization report
- Security audit report
- Production deployment
- Monitoring dashboard
- Disaster recovery documentation

---

## Phase Dependency Map

```
Phase 0 (Setup)
    │
    ▼
Phase 1 (Auth & Users) ────────────────────────────┐
    │                                                │
    ▼                                                │
Phase 2 (Data Migration) ──────────┐                │
    │                               │                │
    ▼                               ▼                │
Phase 3 (Service Layer)     Phase 4 (Cloud Fns)     │
    │          ┌─── parallel ───┘                    │
    │          │                                     │
    ▼          ▼                                     │
Phase 5 (Web App) ──────────────────────────────────┤
    │                                                │
    │   Phase 6 (Admin Apps) ◄──────────────────────┘
    │       │    ┌─── partially parallel with Phase 5
    │       │    │
    ▼       ▼    │
Phase 7 (Advanced Features) ◄───────────────────────┘
    │
    ▼
Phase 8 (Testing & Launch)
```

### Critical Path

`Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 5 → Phase 7 → Phase 8`

### Parallel Opportunities

- **Phase 3 + Phase 4:** Service layer and Cloud Functions can be built
  simultaneously
- **Phase 5 + Phase 6:** Admin apps can start once service layer is available
  (from Phase 3)
- **Within Phase 5:** Student, teacher, and parent features can be built in
  parallel by different developers

---

## Estimated Timeline Summary

| Phase                      | Duration  | Cumulative                   | Team Size |
| -------------------------- | --------- | ---------------------------- | --------- |
| Phase 0: Setup             | 1 week    | Week 1                       | 1-2 devs  |
| Phase 1: Auth & Users      | 2 weeks   | Week 3                       | 2 devs    |
| Phase 2: Data Migration    | 2-3 weeks | Week 5-6                     | 2 devs    |
| Phase 3: Service Layer     | 2-3 weeks | Week 7-8                     | 2 devs    |
| Phase 4: Cloud Functions   | 2-3 weeks | Week 7-8 (parallel)          | 1-2 devs  |
| Phase 5: Web App           | 4-5 weeks | Week 12-13                   | 3-4 devs  |
| Phase 6: Admin Apps        | 3-4 weeks | Week 12-13 (partial overlap) | 1-2 devs  |
| Phase 7: Advanced Features | 3-4 weeks | Week 16-17                   | 2-3 devs  |
| Phase 8: Testing & Launch  | 2-3 weeks | Week 18-20                   | Full team |

**Total estimated duration: 18-20 weeks** (with parallelization) **Without
parallelization: 22-26 weeks**

---

## Risk Register

| #   | Risk                                            | Probability | Impact   | Mitigation                                                                    | Owner               |
| --- | ----------------------------------------------- | ----------- | -------- | ----------------------------------------------------------------------------- | ------------------- |
| R1  | Data migration corrupts or loses data           | Medium      | Critical | Run on staging first, full backups, dual-write period, rollback scripts       | Data Lead           |
| R2  | Feature regression during port                  | High        | High     | Feature matrix audit, E2E tests for all critical paths before + after         | QA Lead             |
| R3  | Performance degradation with org-scoped queries | Medium      | High     | Firestore composite indexes, RTDB for hot data, denormalization strategy      | Backend Lead        |
| R4  | Scope creep extends timeline                    | High        | High     | Strict phase gates, defer non-critical features to v2, weekly scope review    | PM                  |
| R5  | Dependency conflicts in monorepo                | Medium      | Medium   | pnpm strict mode, shared dependency versions, regular dependency audits       | DevOps              |
| R6  | AI cost overruns                                | Medium      | Medium   | Per-org API key model, usage quotas, cost monitoring dashboard                | Product             |
| R7  | User disruption during migration                | Medium      | High     | Gradual rollout, clear communication, keep old systems read-only for 3 months | PM                  |
| R8  | Team bandwidth constraints                      | Medium      | High     | Prioritize critical path, parallel workstreams, clear task ownership          | Engineering Manager |

---

## Open Decisions Required Before Starting

| #   | Decision         | Options                                         | Recommended                                     | Impact on                                     |
| --- | ---------------- | ----------------------------------------------- | ----------------------------------------------- | --------------------------------------------- |
| D1  | Platform name    | Keep "LevelUp" / "EduPlatform" / New name       | TBD by stakeholders                             | Branding, domain, deployment                  |
| D2  | Public spaces    | Allow non-org access to public content?         | Yes, via `/publicSpaces/` reference collection  | Phase 2 data model, Phase 5 routing           |
| D3  | Billing provider | Stripe / Razorpay / Both                        | Razorpay (India-first) + Stripe (international) | Phase 6 admin, Phase 7 subscription           |
| D4  | Mobile strategy  | PWA only / React Native / Flutter               | PWA first, evaluate native later                | Phase 7 PWA scope                             |
| D5  | Scanner app tech | Keep as web app / Convert to React Native       | Keep as web app (works fine)                    | Phase 6 scanner port                          |
| D6  | AI cost model    | Per-org API keys / Platform-subsidized / Hybrid | Hybrid: platform key with per-org quotas        | Phase 4 LLM framework, Phase 6 admin settings |
| D7  | Firebase project | Single project / Separate staging+prod          | Separate staging + production projects          | All phases (deployment config)                |

---

**End of Implementation Plan**
