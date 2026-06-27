# Unified LevelUp + AutoGrade Design Plan and Next Steps

**Date:** 2026-02-11  
**Status:** Proposed execution plan  
**Scope:** Product + UX + architecture plan for merging LevelUp and AutoGrade
into one cohesive platform

## 1. Objective

Create one unified education platform that:

- Reuses proven assets from both systems.
- Removes duplicated UI/type/service layers.
- Fixes current design inconsistencies and workflow fragmentation.
- Supports school-grade multi-tenancy by default.

## 2. What We Can Reuse vs What We Should Not Reuse

## 2.1 Reuse As-Is (High confidence)

| Area                                                             | Source                        | Why it should be reused                                      |
| ---------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------ |
| Multi-tenant data boundary (`/clients/{clientId}/...`)           | AutoGrade                     | Already enforces strict school isolation and role context.   |
| Exam/submission/grading domain model                             | AutoGrade                     | Core to handwritten exam evaluation and RELMS workflow.      |
| Flexible item model (`ItemDTO`, multiple question/content types) | LevelUp                       | Broad learning content support is already mature.            |
| shadcn/Radix-style component foundation                          | LevelUp (`src/components/ui`) | Larger, more consistent, scalable component base.            |
| Existing scanner app separation                                  | AutoGrade                     | Operationally distinct workflow, should remain separate app. |

## 2.2 Reuse With Refactor (Medium confidence)

| Area                                                           | Current state                                                                     | Refactor needed                                                                                     |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| User/role model                                                | Split across LevelUp `userRoles/userOrgs` and AutoGrade `userData/userMembership` | Introduce one `UserMembership` contract and migrate both systems to it.                             |
| Question model                                                 | LevelUp question payload vs AutoGrade rubric-based exam question                  | Define `UnifiedQuestion` core + mode-specific extensions (`learning`, `exam`).                      |
| Admin dashboards                                               | Separate IA and navigation paradigms                                              | Unify information architecture and permissions-driven navigation.                                   |
| Shared packages in AutoGrade (`packages/ui`, `packages/types`) | Good direction, but duplicated by app-local types/components                      | Promote packages to platform-wide source of truth and remove local duplicates.                      |
| State layer                                                    | LevelUp uses Redux + query patterns; AutoGrade uses Zustand stores                | Standardize on one approach per concern (`TanStack Query` for server state + minimal global store). |

## 2.3 Do Not Reuse Directly (Low confidence)

| Area                                                                                                    | Why not                                                                  |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Duplicated UI component sets in AutoGrade (`packages/ui` and app-local `components/ui`)                 | Creates drift and inconsistent behavior/visuals.                         |
| Duplicated type definitions (`autograde/packages/types/*` vs `autograde/apps/client-admin/src/types/*`) | High risk of schema mismatch and runtime bugs.                           |
| Per-app isolated Tailwind token systems                                                                 | Prevents visual consistency and makes theme changes expensive.           |
| LevelUp loose organization scoping (`orgId` optional in many places)                                    | Incompatible with strict school isolation required for unified platform. |

## 3. Current Design Flaws to Fix (Explicit)

1. Visual inconsistency across apps: same concepts rendered with different
   controls, spacing, and typographic rhythm.
2. Component duplication: similar UI primitives implemented multiple times.
3. Type drift risk: duplicated domain models in package-level and app-level
   files.
4. IA fragmentation: teachers/admins switch mental models between “learning
   platform” and “grading platform”.
5. Tenant boundary mismatch: LevelUp patterns are more open, AutoGrade patterns
   are strict.
6. Inconsistent state patterns increase cognitive load and onboarding time.

## 4. Target Unified UX/System Design

## 4.1 Product IA

- `Teacher Workspace`: Spaces, Exams, Evaluations, Students, Analytics.
- `Student Workspace`: Assigned Spaces, Tests, Exam Results, Feedback,
  Recommendations.
- `Client Admin`: Users, Classes, Access/Permissions, Platform settings,
  usage/cost analytics.
- `Scanner App`: dedicated and minimal upload/scanning flow.

## 4.2 Design System Direction

- Base on LevelUp’s shadcn/Radix-style primitives.
- Move all primitives and tokens to a shared package (`packages/design-system`).
- Define semantic tokens: `surface`, `text`, `accent`, `success`, `warning`,
  `danger`, `focus`, `chart-*`.
- Keep one spacing scale, one radius scale, one elevation model, one motion
  policy.
- Add accessibility guardrails: focus states, keyboard flow, color contrast
  budget.

## 4.3 Unified Domain Core

```ts
interface UserMembership {
  id: string; // ${uid}_${clientId}
  uid: string;
  clientId: string;
  role:
    | "superAdmin"
    | "clientAdmin"
    | "teacher"
    | "student"
    | "parent"
    | "scanner";
  permissions?: Record<string, boolean>;
  status: "active" | "inactive";
}

interface UnifiedQuestion {
  id: string;
  mode: "learning" | "exam";
  text: string;
  maxMarks?: number;
  rubric?: { criteria: Array<{ description: string; marks: number }> };
  learningPayload?: Record<string, unknown>;
}
```

## 4.4 High-Level Architecture

```mermaid
flowchart LR
  A[Shared Auth + Membership] --> B[Teacher App]
  A --> C[Student App]
  A --> D[Client Admin]
  E[Scanner App] --> F[Submission Pipeline]
  B --> G[Unified Content + Exam Services]
  C --> G
  D --> G
  F --> G
  G --> H[(Firestore: /clients/{clientId}/...)]
  G --> I[(Cloud Functions: grading/extraction/chat)]
```

## 5. Recommended Implementation Plan

## Phase 0 (1 week): Alignment + Guardrails

- Freeze new app-local UI primitives and app-local domain type creation.
- Approve canonical package ownership:
  - `packages/domain-types`
  - `packages/design-system`
  - `packages/firebase-services`
- Define migration acceptance criteria and non-negotiables (tenant safety,
  backward compatibility).

## Phase 1 (2 weeks): Shared Foundations

- Extract canonical domain types from both systems into `packages/domain-types`.
- Create mapping adapters (`levelup -> unified`, `autograde -> unified`).
- Move design tokens + base primitives into `packages/design-system`.
- Publish a UI migration checklist for all apps.

## Phase 2 (2 weeks): IA + UX Convergence

- Redesign teacher dashboard IA (single nav for Spaces + Exams + Evaluations).
- Redesign student dashboard IA (learning + results in one journey).
- Build reusable layout shells for `teacher`, `student`, `client-admin`.
- Validate with 5-8 workflow-based usability walkthroughs.

## Phase 3 (3 weeks): App Migration Wave 1

- Migrate AutoGrade `client-admin` to shared design system + shared domain
  types.
- Replace app-local duplicated UI and types.
- Add compatibility adapters so existing services continue working during
  migration.

## Phase 4 (3 weeks): App Migration Wave 2

- Migrate LevelUp app areas most tied to unified flows: assignments, progress,
  tests, analytics.
- Enforce strict client scoping in LevelUp data access paths.
- Add cross-linking: exam weakness -> targeted LevelUp practice.

## Phase 5 (2 weeks): Hardening + Rollout

- Regression test key journeys (teacher create + grade + assign + review).
- Security rules audit for strict tenant isolation.
- Performance and bundle checks; optimize large route chunks.
- Staged rollout by client cohort.

## 6. Decision Log (Key ADR-style calls)

1. **UI foundation:** choose LevelUp-style shadcn/Radix baseline.  
   Tradeoff: migration effort now, but lower long-term design debt.

2. **Tenant model:** adopt AutoGrade-style strict client scoping everywhere.  
   Tradeoff: LevelUp migration complexity, but compliance/safety gains.

3. **Type source of truth:** one shared package; no app-level domain
   duplication.  
   Tradeoff: initial refactors, but fewer production schema mismatches.

4. **App strategy:** keep scanner as separate app; unify teacher/student/admin
   experiences with shared core.  
   Tradeoff: one extra deployment target, but cleaner operational UX.

## 7. Risks and Mitigations

| Risk                                              | Mitigation                                                        |
| ------------------------------------------------- | ----------------------------------------------------------------- |
| Migration breaks existing flows                   | Adapter layer + incremental module cutover + feature flags.       |
| Team parallel work reintroduces duplication       | CI checks forbidding new duplicated domain type declarations.     |
| UX redesign drifts from educator workflow reality | Structured teacher/admin validation checkpoints each phase.       |
| Scope creep                                       | Enforce phase gates and measurable entry/exit criteria per phase. |

## 8. Immediate Next Steps (Actionable)

1. Approve this plan and lock the three shared package boundaries.
2. Create a `reuse audit` ticket set:
   - UI component dedupe
   - type dedupe
   - tenant scoping migration
3. Start Phase 1 with one thin vertical slice:
   - Teacher dashboard header/nav using shared design system
   - Unified membership context
   - One shared question type consumed by both systems
4. Run review checkpoint after the first slice before broad migration.

---

## Appendix: Evidence Reviewed

- `docs/UNIFIED_PLATFORM_BRAINSTORM.md`
- `docs/UNIFIED_SYSTEM_BRAINSTORM.md`
- `docs/levelup-data-architecture.md`
- `docs/autograde-domain-model.md`
- `LevelUp-App/src/components/ui/*`
- `LevelUp-App/src/types/items.ts`
- `LevelUp-App/src/types/organizations.ts`
- `autograde/packages/ui/*`
- `autograde/packages/types/*`
- `autograde/apps/client-admin/src/components/ui/*`
- `autograde/apps/client-admin/src/types/firestore.ts`
