# Phase-Wise Implementation Plan

**Date:** 2026-02-11 **Status:** Execution-ready **Input References:**
`docs/DESIGN_PLAN_AND_NEXT_STEPS.md`,
`docs/UNIFIED_DESIGN_PLAN_AND_NEXT_STEPS.md`

## 1. Scope and Goal

Deliver a unified platform by combining:

- AutoGrade strengths: strict multi-tenancy, monorepo package model,
  grading/scanner pipeline.
- LevelUp strengths: rich learning UX, shadcn-based UI system, content and
  engagement features.

Success criteria:

- Single org-scoped data model (`/organizations/{orgId}/...`) across all apps.
- Unified role/membership/auth model.
- Shared packages for types, UI, services, hooks, and utilities.
- End-to-end teacher and student journeys (learn + assess + review) in
  production.

## 2. Delivery Principles

- Build foundations first, then migrate by vertical slices.
- Use adapters for backward compatibility during cutover.
- Run phased rollout (staging -> pilot -> staged production percentages).
- Treat tenant isolation, migration safety, and core flow regression as release
  blockers.

## 3. Phase Plan

## Phase 0: Program Setup and Guardrails (Week 1)

Objective:

- Lock architecture guardrails and delivery mechanics.

Key work:

- Confirm canonical package boundaries (`shared-types`, `shared-ui`,
  `shared-services`, `shared-utils`, `shared-hooks`).
- Freeze new app-local domain types and duplicated UI primitives.
- Define migration acceptance criteria and quality gates.
- Configure baseline CI checks (lint, typecheck, test smoke).

Exit criteria:

- Guardrail document approved.
- Baseline CI running.
- Team ownership and workstream map approved.

## Phase 1: Shared Foundations (Weeks 2-3)

Objective:

- Build the reusable base for all applications.

Key work:

- Initialize monorepo workspace and shared package structure.
- Consolidate unified domain types and mapping adapters.
- Move design tokens and core components into shared design system.
- Standardize state strategy: TanStack Query for server state, Zustand for
  client state.
- Enable strict TypeScript in shared packages.

Exit criteria:

- All apps can import shared packages.
- Shared types and UI primitives are source of truth.
- Example vertical slice compiles end-to-end.

## Phase 2: Auth, Membership, and Tenant Model (Weeks 3-5)

Objective:

- Establish one secure identity and access model.

Key work:

- Implement unified `User` and `UserMembership` contracts.
- Build org switcher and role-based route access.
- Replace legacy role/context models with unified auth store.
- Write and validate org-scoped Firestore rules.
- Create migration scripts for users/memberships from both systems.

Exit criteria:

- Login, org selection, and role guard flows are stable.
- Security rules enforce org isolation.
- Membership migration validated on staging data.

## Phase 3: Data and Service Unification (Weeks 5-8)

Objective:

- Move all domain data and service access to the unified model.

Key work:

- Migrate LevelUp content/progress paths into org-scoped collections.
- Migrate AutoGrade exams/submissions/settings into unified paths.
- Merge and standardize service layers into shared services.
- Move RTDB paths to org scope for leaderboard/progress isolation.
- Create indexes and perform data integrity verification.

Exit criteria:

- Core read/write flows use unified service layer only.
- Migration scripts are repeatable and auditable.
- Data integrity checks pass for staging migration.

## Phase 4: Backend Workflow Merge (Weeks 7-9, parallel)

Objective:

- Unify Cloud Functions and asynchronous processing.

Key work:

- Merge functions by domain (`triggers`, `workers`, `callables`, `scheduled`).
- Port grading, answer mapping, and extraction pipelines.
- Add shared middleware: auth validation, org context, rate limiting.
- Add progress aggregation and notification triggers.

Exit criteria:

- Backend workflows execute in staging with observability.
- Function-level integration tests pass for critical paths.

## Phase 5: Teacher and Student Experience Convergence (Weeks 8-12)

Objective:

- Deliver unified web journeys for learning and assessment.

Key work:

- Build unified role-adaptive web shell.
- Teacher flows: create/manage spaces, exams, grading review, progress
  analytics.
- Student flows: learn/practice/timed tests/exam results/AI tutoring.
- Parent flows: child progress and exam visibility.
- Integrate shared navigation and consistent IA.

Exit criteria:

- End-to-end teacher and student primary journeys complete.
- UX walkthrough sign-off from internal stakeholders.

## Phase 6: Admin and Scanner Apps (Weeks 10-13)

Objective:

- Complete operational apps for institution management and paper ingestion.

Key work:

- Build org admin app (users, classes, assignments, settings, analytics).
- Build super-admin app (tenant operations and platform governance).
- Upgrade scanner app to unified auth and org-scoped paths.

Exit criteria:

- Admin roles can operate full lifecycle without legacy dependencies.
- Scanner upload-to-submission flow is stable.

## Phase 7: Advanced Intelligence and Product Hardening (Weeks 13-16)

Objective:

- Add cross-system intelligence and production polish.

Key work:

- Cross-system analytics (practice signals -> exam outcomes).
- Weakness-driven recommended practice generation.
- Unified notifications (in-app + push/email).
- PWA/offline-capable learning subset.
- Accessibility, performance, and resilience hardening.

Exit criteria:

- Advanced features released behind flags and validated.
- Performance and accessibility targets met.

## Phase 8: Launch and Scale (Weeks 16-18)

Objective:

- Release safely and scale with confidence.

Key work:

- Full regression suite (unit/integration/e2e).
- Security and rules audit.
- Pilot rollout for selected institutions.
- Fix pilot issues and run staged production rollout.
- Post-launch monitoring and stabilization.

Exit criteria:

- Production rollout complete.
- No critical tenant/security/data integrity defects open.

## 4. Cross-Phase Workstreams

- **Migration and Compatibility:** adapter layer, dual-read/dual-write where
  needed.
- **Quality Engineering:** Vitest + Playwright gates across all phases.
- **Security and Compliance:** Firestore rule reviews and scoped-access checks
  every phase.
- **Design System Governance:** no unmanaged UI primitives after Phase 1.
- **Observability:** logs, metrics, tracing, and incident playbooks for backend
  workflows.

## 5. Dependencies and Parallelization

Sequential dependencies:

- P0 -> P1 -> P2 -> P3 are mandatory sequence.
- P5 depends on P1-P3 completion for stable foundations.
- P8 depends on all prior phases.

Parallel opportunities:

- P4 can run in parallel with late P3.
- P6 can run in parallel with P5 once auth/data foundations are stable.
- QA hardening begins in P2 and intensifies through P8.

## 6. Milestones

1. **M1 (End Week 3):** Shared foundations and package governance live.
2. **M2 (End Week 5):** Unified auth + tenant model operational.
3. **M3 (End Week 8):** Unified data/services and backend workflows stable in
   staging.
4. **M4 (End Week 12):** Unified teacher/student web experience
   feature-complete.
5. **M5 (End Week 16):** Admin/scanner/advanced features complete with
   hardening.
6. **M6 (End Week 18):** Production launch complete with monitored rollout.

## 7. Risk Controls

- Migration failure: rehearse on staging, keep rollback scripts and backup
  snapshots.
- Regression risk: enforce critical flow e2e gates before each phase exit.
- Scope creep: no new major feature intake after Phase 5 starts.
- Tenant data leak risk: mandatory rule audits and negative authorization tests.

## 8. Immediate Next Actions

1. Approve this phase plan as execution baseline.
2. Create phase-linked epics and task boards for P0-P2.
3. Start with one thin vertical slice: unified auth + one shared question flow.
