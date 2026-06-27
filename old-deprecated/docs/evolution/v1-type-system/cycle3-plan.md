# V1 Type System — Cycle 3 Plan

## Context

Cycle 1 eliminated ~97 `any` types, created branded types and Zod schemas. Cycle
2 fixed double assertions, strengthened Zod callable schemas, and added factory
helpers. Production code now has ZERO `any` types.

## Remaining Gaps for Cycle 3

| Category                  | Status                  | Action                      |
| ------------------------- | ----------------------- | --------------------------- |
| `any` in production code  | ZERO                    | Done                        |
| Branded types defined     | 16 types + 16 factories | Done                        |
| Zod read boundary schemas | 8 entities covered      | Add 8 more missing entities |
| Type guard functions      | None                    | Create runtime type guards  |
| JSDoc on exported types   | Partial                 | Add to all major exports    |
| Cross-module consistency  | Unverified              | Audit and fix               |

## Implementation

### Phase 1: Complete Zod Read Boundary Schemas

Add schemas for entities missing from
`packages/shared-types/src/schemas/index.ts`:

- ParentSchema, AcademicSessionSchema, StoryPointSchema
- AgentSchema, ChatSessionSchema, DigitalTestSessionSchema
- SpaceProgressSchema, UnifiedItemSchema (simplified)
- NotificationSchema

### Phase 2: Runtime Type Guards

Create `packages/shared-types/src/type-guards.ts` with:

- `isQuestionItem(item)` — narrows UnifiedItem to question type
- `isMaterialItem(item)` — narrows UnifiedItem to material type
- `isFirestoreTimestamp(value)` — validates timestamp shape
- `isAutoEvaluatable(type)` — checks if question type supports auto-eval
- `isAIEvaluatable(type)` — checks if question type supports AI eval

### Phase 3: JSDoc Documentation

Add JSDoc comments to all major exported interfaces and types across all
modules.

### Phase 4: Cross-Module Consistency

Verify shared types are imported consistently across all 5 apps and 4 function
modules.

## Acceptance Criteria

- [ ] All entity types have corresponding Zod schemas
- [ ] Runtime type guards exported from shared-types
- [ ] JSDoc on all major exported types
- [ ] `pnpm build` passes
- [ ] `pnpm lint` passes
