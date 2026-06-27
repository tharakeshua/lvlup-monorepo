# V1 Type System — Cycle 2 Refinement Plan

## Context

Cycle 1 eliminated ~97 `any` types across 45+ files, created 14 branded ID
types, Zod schemas at Firebase boundaries, and a domain glossary. Cycle 2 is the
refinement pass: fix what slipped through and enforce deeper type safety.

## Audit Summary

| Category                                 | Count               | Severity |
| ---------------------------------------- | ------------------- | -------- |
| `any` types remaining (production)       | ~80+                | HIGH     |
| `any` types remaining (test files)       | ~120+               | LOW      |
| Branded types adoption                   | 0 (defined, unused) | CRITICAL |
| `z.unknown()` in Zod schemas             | 12                  | MEDIUM   |
| Double type assertions (`as unknown as`) | 5                   | HIGH     |
| `Record<string, any>` patterns           | 40+                 | MEDIUM   |
| Firestore doc casts without validation   | 100+                | MEDIUM   |

## Scope — Cycle 2 Phases

### Phase 1: Branded Type Adoption in shared-types

- Update entity interfaces in `packages/shared-types/src/` to use branded IDs
  instead of plain `string`
- Target: `Tenant.id`, `Class.id`, `Student.id`, `Teacher.id`, `Space.id`,
  `StoryPoint.id`, `Exam.id`, `Submission.id`, `UnifiedItem.id`, etc.
- Add `as TenantId` etc. factory helpers in `branded.ts`
- **Rationale**: Branded types only add value when enforced in interfaces

### Phase 2: Strengthen Zod Schemas

- Replace `z.unknown()` and `z.record(z.string(), z.unknown())` with typed
  schemas where the data shape is known
- Focus on `callable-schemas.ts`: rubric fields, payload, questionData, answer
  fields
- Add missing entity schemas for entities not yet covered (Parent,
  AcademicSession, Agent, ChatSession)

### Phase 3: Fix Unsafe Type Patterns in Cloud Functions

- Fix double assertions in identity functions (`join-tenant.ts`,
  `bulk-import-students.ts`, `save-teacher.ts`, `create-org-user.ts`)
- Replace `as string` Firestore data casts with proper typed reads
- Add Zod validation at Firestore read boundaries in triggers

### Phase 4: Eliminate Remaining `any` in Production Code

- `autograde/apps/client-admin/src/services/ai-service.ts` — type AI/LLM
  request/response
- `autograde/functions/src/` — question extraction, firestore utils
- `autograde/developer-admin/src/` — function caller types
- `LevelUp-App/src/services/` — users, leaderboard, chat, progress services
- Replace `Record<string, any>` with `Record<string, unknown>` or typed
  interfaces

### Phase 5: Build & Verify

- Run `pnpm build` across all packages
- Run `pnpm lint` across all packages
- Verify zero new errors introduced

## Acceptance Criteria

1. [ ] Branded types used in all shared-types entity interfaces
2. [ ] Zero `z.unknown()` in callable schemas where data shape is known
3. [ ] Zero double type assertions in cloud functions
4. [ ] `any` count in production code reduced by 50%+
5. [ ] Build passes with zero new errors
6. [ ] Lint passes with zero new errors

## Risk Assessment

| Risk                                     | Mitigation                                            |
| ---------------------------------------- | ----------------------------------------------------- |
| Branded types break downstream consumers | Use gradual adoption; keep `as TenantId` cast helpers |
| Zod schema changes reject valid data     | Make new schema fields `.optional()` and test         |
| Build cascading failures                 | Fix shared-types first, then dependents               |
