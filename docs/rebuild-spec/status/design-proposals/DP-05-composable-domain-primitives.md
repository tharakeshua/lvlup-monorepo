# DP-5 · Composable domain primitives ("blocks from smaller blocks")

**Wave:** W2 · **Status:** design-only · **Evidence:** B-IDN-10/11,
A-LD-04/05/06/07/08/09, F-SSOT-03.

## Problem

The composability the mandate asks for is _asserted but bypassed_:

- `withAudit` / `zAuditFields` / `zTenantScoped` / `zSoftDeletable` ship in
  `primitives/audit.zod.ts` (docstring: "every entity schema appends audit
  uniformly") — **zero identity entities use them**; every entity hand-inlines
  `tenantId` + 4 audit fields (B-IDN-10).
- No shared `PersonName`/`ContactInfo`:
  `firstName/lastName/displayName/email/phone` copy-pasted across
  `UnifiedUser` + all 5 role profiles (B-IDN-11).
- `points` vs `marks` — two scoring currencies coexist on the same entities
  (DigitalTestSession/SpaceProgress) with no shared `Score` primitive or defined
  relationship (LD-04).
- 3 overlapping assessment/timing/passing models (`StoryPoint.assessmentConfig`
  vs assessment-item vs `Exam`; `passingPercentage` vs `passingMarks`) (LD-05);
  two parallel "question" abstractions (15-type levelup vs flat scan
  `ExamQuestion`) share no `QuestionCore` (LD-06).
- `RichMaterial.blocks = unknown[]` though `RICH_BLOCK_TYPES` enum exists
  (LD-07); rubric `{snapshot+id}` copy-pasted on 3 entities (LD-08);
  `saveItem`/`saveExam` hand-redeclare entity subsets instead of deriving
  (LD-09, F-SSOT-03).

## Target design

Establish and **actually use** a primitives layer in `domain`:

| Primitive                                         | Composes into                           | Replaces                                 |
| ------------------------------------------------- | --------------------------------------- | ---------------------------------------- |
| `zTenantScoped` + `withAudit`                     | every tenant entity                     | hand-inlined `tenantId` + 4 audit fields |
| `PersonName` + `ContactInfo`                      | `UnifiedUser`, all role profiles        | 6× copy-pasted name/contact fields       |
| `Score` (defines `points`↔`marks`)                | DigitalTestSession, SpaceProgress, Exam | two ad-hoc scoring currencies            |
| `TimingConfig` + `PassingPolicy`                  | StoryPoint, assessment-item, Exam       | 3 overlapping timing/passing models      |
| `QuestionCore`                                    | levelup question + scan `ExamQuestion`  | two unrelated question abstractions      |
| `RubricBinding` (`{snapshot+id}`)                 | the 3 rubric-bearing entities           | copy-pasted rubric binding               |
| `RichBlock` (discriminated by `RICH_BLOCK_TYPES`) | `RichMaterial.blocks`                   | `unknown[]`                              |

**Write-contracts derived, not redeclared:**

```ts
const SaveItemData = UnifiedItemSchema.pick({ ... }).partial({ ... })   // not a hand-written subset
const StoredEvaluation = UnifiedEvaluationResultSchema.pick({ ... })
```

## Composition example

```ts
const Teacher = withAudit(
  zTenantScoped(
    zObject({
      teacherId: zTeacherId,
      ...PersonName.shape,
      ...ContactInfo.shape,
      classIds: z.array(zClassId),
    })
  )
);
```

Primitives are the small blocks; DP-2's registries compose them per-variant.
Together DP-5 + DP-2 are the literal expression of "blocks from smaller blocks."

## Migration

Mechanical, no wire break if the composed shape is field-identical to today's
inlined shape (verify per entity). Derived write-contracts must be checked
against current request schemas for accidental field changes.

## Tests

- A lint/test asserting tenant entities are authored via
  `withAudit(zTenantScoped(...))`.
- Derived write-contract snapshot tests (catch accidental surface drift).

## Closes

B-IDN-10, B-IDN-11, LD-04, LD-05, LD-06, LD-07, LD-08, LD-09, F-SSOT-03.
