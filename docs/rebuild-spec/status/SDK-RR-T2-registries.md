# SDK RE-REVIEW T2 — Extensibility Registries (QUESTION_TYPE_REGISTRY + ROLE_DESCRIPTORS)

**Mode:** READ-ONLY deep re-review. No code changed, no fixes applied.
**Branch:** staging · **Reviewer:** be-sdk (`tm_1782508112019_1yz8039fd`) ·
**Date:** 2026-06-27 **Source findings re-validated:** LD-03 (SDK-REVIEW-A) +
B-IDN-12 / B-IDN-30 (SDK-REVIEW-B) **Mandate focus:** extensibility —
prove/disprove that "add a new type / add a new role" collapses to **one
entry**, and design it concretely against **every** real call site.

---

## 0. Verdict (up front)

| Theme             | Sites today (verified)                                                                                           | After registry                                                                                                              | Proven?                                                                                                                                                                                                                                                                |
| ----------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Question type** | **9 edit points across 5 files** (4 canonical in `domain` + test + 3 legacy-vocab adapters in `services`/`seed`) | **1 registry entry** (3 inline schemas + 2 scalar fields); enum, **3** discriminated unions, AUTO/AI arrays all **derived** | ✅ **PROVEN** — one entry, with one unavoidable `as [member,...]` tuple-cast helper (runtime-safe).                                                                                                                                                                    |
| **Role**          | **~12 canonical sites** (domain/access/contract/services) **+ ~6 seed sites = ~18 total**                        | **1 descriptor append + 1 branded-id line + N _intentional_ `ACCESS_RULES` lines**                                          | ✅ **PROVEN with caveats** — enum/rank/EntityIds/repo-map/membership-&-claims id-fields/contract-links all derive; authorization intent and the per-role _profile schema_ stay manual **by design** (both belong inside the one descriptor or are security decisions). |

**Two material things the source reports got slightly wrong or missed —
corrected here:**

1. **B-IDN-12 lists `sync-membership-claims.ts` as a per-role `switch` (lines
   "119-144").** It is **not**. The runtime `buildClaimsFromMembership`
   (`services/src/identity/sync-membership-claims.ts:38-67`) copies **all** id
   fields **flat, role-agnostically** — it already needs **zero** change for a
   new role. The per-role `switch` that **does** need a new `case` is in the
   **seed** builder (`packages/seed/src/engine/claims.ts:118-144`). So the
   runtime and seed claim-builders are **structurally divergent** (flat-copy vs
   switch) even though `seed.claims.test.ts` asserts they are byte-equal —
   adding a role exercises exactly that divergence. (New finding RR-T2-A.)

2. **The two `TEACHER_PERMISSION_KEYS` / `STAFF_PERMISSION_KEYS` lists have
   _already drifted_** (concrete live bug, strengthens B-IDN-13).
   `domain/src/enums/permissions.ts:7-29` and `seed/src/engine/claims.ts:38-58`
   define **different key sets**:
   - domain teacher keys:
     `canManageSpaces, canManageStudents, canManageClasses, canCreateExams, canGradeExams, canViewAnalytics, canManageContent, canReleaseResults`
   - seed teacher keys:
     `canCreateExams, canEditRubrics, canManuallyGrade, canViewAllExams, canCreateSpaces, canManageContent, canViewAnalytics, canConfigureAgents`
     These are not the same list. This is the "two parallel copies silently
     drift" failure mode the registry mandate exists to kill, caught in the act.
     (New finding RR-T2-B.)

---

# PART A — QUESTION_TYPE_REGISTRY (learning domain)

## A.1 Exhaustive site inventory — what "add one question type" touches today

Grepped all 15 literals
(`mcq, mcaq, true-false, numerical, text, paragraph, code, fill-blanks, fill-blanks-dd, matching, jumbled, audio, image_evaluation, group-options, chat_agent_question`) +
the symbols
`QUESTION_TYPES / QuestionType / AUTO_EVALUATABLE_TYPES / AI_EVALUATABLE_TYPES / QuestionTypeDataSchema / zQuestionType`.

### Tier 1 — CANONICAL (must change for _every_ new type) — 2 files, 4 edit points

| #   | Site                                                       | file:line                                                         | What changes                                                                                                 |
| --- | ---------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 1   | `QUESTION_TYPES` enum array                                | `packages/domain/src/enums/content.ts:21-37`                      | append literal                                                                                               |
| 2   | `AUTO_EVALUATABLE_TYPES` **or** `AI_EVALUATABLE_TYPES`     | `content.ts:41-51` / `:53-60`                                     | append to exactly one (the **drift hazard**: a type can be added to neither → silently ungraded, or to both) |
| 3   | per-type Zod schema (e.g. `McqDataSchema`)                 | `packages/domain/src/entities/content/question-payload.ts:19-132` | add `…DataSchema` with `questionType: z.literal(...)`                                                        |
| 4   | `z.discriminatedUnion("questionType", [...])` member array | `question-payload.ts:134-150`                                     | append the new schema to the tuple                                                                           |

### Tier 2 — TEST FIXTURE (must change or test fails) — 2 files

| #   | Site                                        | file:line                                                                  | What changes                                                                                   |
| --- | ------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 5   | `minimalQuestionData(qt)` per-type `switch` | `packages/domain/src/__tests__/item-payload.discriminated.test.ts:144-179` | add a `case` producing a minimal valid payload                                                 |
| 5b  | cardinality + AUTO/AI-partition asserts     | `packages/domain/src/__tests__/enums.bridge.test.ts:66-98`                 | `expect(QUESTION_TYPES.length).toBe(15)` → 16; partition asserts auto-pass once arrays updated |

### Tier 3 — LEGACY-VOCAB ADAPTERS (only if the new type ingests legacy data) — `services` + `seed`

| #   | Site                                    | file:line                                                      | Notes                                                                                                                          |
| --- | --------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 6   | `QUESTION_TYPE_MAP` legacy→canonical    | `packages/services/src/levelup/content.ts:61-90`               | maps old external vocab (`msq`,`short_answer`,…) → canonical; a _brand-new_ type with no legacy source needs **no** entry      |
| 7   | `buildQuestionData()` per-type `switch` | `packages/services/src/levelup/content.ts:120-173`             | transform layer from legacy shape; needs a branch only for types ingested from legacy                                          |
| 8   | `DETERMINISTIC_TYPES` set               | `packages/services/src/levelup/grading.ts:15-24`               | a **third** auto/AI classification, in _legacy_ vocab (`multiple_choice`,`numeric`,…) — separate from `AUTO_EVALUATABLE_TYPES` |
| 9   | seed legacy `QuestionType` union + data | `packages/seed/src/config/types.ts:252-267`, `seed/src/data/*` | seed authoring vocab; only if you seed the new type                                                                            |

### Confirmed DECOUPLED (do **not** change — good)

- **api-contract is clean.** `zQuestionType` is only used as a _filter/value_ in
  request schemas (`save-question-bank-item.ts:12`, `save-rubric-preset.ts:16`,
  `list-rubric-presets.ts:12`, `generate-content.ts:14`,
  `list-question-bank.ts:13`) — it re-uses the domain enum, never re-declares
  it.
- **autograde `ExamQuestion.questionType` is `z.string().optional()`**
  (`api-contract/src/callables/autograde/_shared.ts:155,171`) — intentionally
  **open** (paper-scan world), already extension-free.
- **repositories / api-client / query do not branch on `questionType`**
  (verified in SDK-REVIEW-A §3.6).

> **Net today:** 4 canonical edit points (2 files) + 1 test switch are
> _mandatory_; the 3 legacy adapters are conditional. The two **independent**
> auto/AI classifications (`AUTO_EVALUATABLE_TYPES` in canonical vocab,
> `DETERMINISTIC_TYPES` in legacy vocab) are the concrete realization of LD-03's
> "parallel arrays drift" risk — **three** places encode "how is this graded,"
> none derived from the schema set.

## A.2 The registry design (concrete)

```ts
// packages/domain/src/entities/content/question-types/registry.ts  — THE single SSOT
import { z } from "zod";
import { zObject } from "../../../authoring/strict.js";

export type GradingMode = "auto" | "ai";

export interface QuestionTypeSpec {
  /** answer-FREE prompt schema (carries `questionType: z.literal(<key>)`). */
  prompt: z.ZodTypeAny;
  /** typed correct-answer schema (the AnswerKeyData member; see LD-02). */
  answer: z.ZodTypeAny;
  /** typed learner-submitted-answer schema. */
  learnerAnswer: z.ZodTypeAny;
  /** replaces AUTO_/AI_ arrays AND DETERMINISTIC_TYPES with ONE source. */
  evaluation: GradingMode;
  /** human label (admin UI, content tooling). */
  label: string;
  /** minimal valid payload — replaces the test's minimalQuestionData switch. */
  sample: () => Record<string, unknown>;
}

// One entry = one question type. Schemas authored inline (they are intrinsic content,
// not derivable — but they live HERE, in the one place).
export const QUESTION_TYPE_REGISTRY = {
  mcq: {
    prompt: zObject({
      questionType: z.literal("mcq"),
      options: z.array(
        zObject({ id: zOptionId, text: z.string(), imageUrl: zUrl.optional() })
      ),
      shuffleOptions: z.boolean().optional(),
    }),
    answer: zObject({
      questionType: z.literal("mcq"),
      correctOptionIds: z.array(zOptionId),
    }),
    learnerAnswer: zObject({
      questionType: z.literal("mcq"),
      selectedOptionIds: z.array(zOptionId),
    }),
    evaluation: "auto",
    label: "Multiple choice",
    sample: () => ({ questionType: "mcq", options: [{ id: "a", text: "A" }] }),
  },
  numerical: {
    prompt: zObject({
      questionType: z.literal("numerical"),
      unit: z.string().optional(),
    }),
    answer: zObject({
      questionType: z.literal("numerical"),
      value: z.number(),
      tolerance: z.number().optional(),
    }),
    learnerAnswer: zObject({
      questionType: z.literal("numerical"),
      value: z.number(),
    }),
    evaluation: "auto",
    label: "Numerical",
    sample: () => ({ questionType: "numerical" }),
  },
  paragraph: {
    /* …prompt/answer/learnerAnswer… */ evaluation: "ai",
    label: "Long answer",
    sample: () => ({ questionType: "paragraph" }),
  },
  // … 15 entries total …
} as const satisfies Record<string, QuestionTypeSpec>;

export type QuestionType = keyof typeof QUESTION_TYPE_REGISTRY; // ← registry IS the SSOT
```

## A.3 Derivation mechanics — everything else regenerates

```ts
// enums/content.ts becomes derived re-exports:
export const QUESTION_TYPES = Object.keys(
  QUESTION_TYPE_REGISTRY
) as QuestionType[];
export const zQuestionType = z.enum(
  QUESTION_TYPES as [QuestionType, ...QuestionType[]]
);

// the three discriminated unions — derived from the registry columns:
const members = <K extends "prompt" | "answer" | "learnerAnswer">(k: K) =>
  QUESTION_TYPES.map((t) => QUESTION_TYPE_REGISTRY[t][k]);

// ⚠ Zod's discriminatedUnion REQUIRES a non-empty tuple type. `.map()` yields an
// array, so a one-line tuple assertion (the "tiny typed helper" LD-03 predicted)
// is unavoidable. Runtime is fully correct — Zod reads the literal off each member.
type DU = [
  z.ZodDiscriminatedUnionOption<"questionType">,
  ...z.ZodDiscriminatedUnionOption<"questionType">[],
];
export const QuestionPromptSchema = z.discriminatedUnion(
  "questionType",
  members("prompt") as unknown as DU
);
export const AnswerKeyDataSchema = z.discriminatedUnion(
  "questionType",
  members("answer") as unknown as DU
);
export const LearnerAnswerSchema = z.discriminatedUnion(
  "questionType",
  members("learnerAnswer") as unknown as DU
);

// the grading classification — ONE source replaces 3 (AUTO_/AI_/DETERMINISTIC_TYPES):
export const AUTO_EVALUATABLE_TYPES = QUESTION_TYPES.filter(
  (t) => QUESTION_TYPE_REGISTRY[t].evaluation === "auto"
);
export const AI_EVALUATABLE_TYPES = QUESTION_TYPES.filter(
  (t) => QUESTION_TYPE_REGISTRY[t].evaluation === "ai"
);

// the test fixture — derived, the per-type switch disappears:
//   for (const t of QUESTION_TYPES) expect(union.safeParse(REGISTRY[t].sample()).success).toBe(true);
```

**Exhaustiveness guarantee:** because
`QuestionType = keyof typeof QUESTION_TYPE_REGISTRY` and every derived structure
iterates `QUESTION_TYPES`, **the enum, all three unions, both grading arrays,
and the test fixture cannot fall out of sync** — there is exactly one list.
(Today `enums.bridge.test.ts` exists _precisely_ to catch the AUTO/AI partition
drifting from the enum; under the registry that test becomes structurally
impossible to fail and can be deleted or repurposed as a guard.)

## A.4 Proof — a 16th type is ONE entry

Adding `"ordering-grid"`:

```ts
QUESTION_TYPE_REGISTRY = {
  …,
  "ordering-grid": {
    prompt:        zObject({ questionType: z.literal("ordering-grid"), rows: z.array(z.string()), cols: z.array(z.string()) }),
    answer:        zObject({ questionType: z.literal("ordering-grid"), grid: z.array(z.array(z.boolean())) }),
    learnerAnswer: zObject({ questionType: z.literal("ordering-grid"), grid: z.array(z.array(z.boolean())) }),
    evaluation: "auto", label: "Ordering grid",
    sample: () => ({ questionType: "ordering-grid", rows: ["r"], cols: ["c"] }),
  },
};
```

That single entry causes, **with no other edit**: `QUESTION_TYPES` gains
`"ordering-grid"`; `QuestionPromptSchema` / `AnswerKeyDataSchema` /
`LearnerAnswerSchema` each gain the member; `AUTO_EVALUATABLE_TYPES` gains it
(because `evaluation:"auto"`); the round-trip test picks it up via `sample()`.
**Omitting `evaluation` or any of the three schemas is a compile error**
(`satisfies Record<…, QuestionTypeSpec>`). This is the literal LD-03 target.

## A.5 What CANNOT be derived (residual, Part A)

| Residual                                                                   | Why                                                                    | Disposition                                                                                                                                     |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| The 3 Zod schemas per type (prompt/answer/learnerAnswer)                   | intrinsic content — an MCQ's option shape is not computable            | **Expected.** They live _inside_ the one entry → still "one place."                                                                             |
| `as unknown as DU` tuple cast on the 3 unions                              | Zod typing needs a non-empty **tuple**; `Array.map()` returns an array | One shared helper, runtime-correct. The only true friction.                                                                                     |
| Legacy `QUESTION_TYPE_MAP` / `buildQuestionData()` (`services/content.ts`) | anti-corruption layer for _old external vocab_                         | **Out of registry scope.** A brand-new type has no legacy source → no entry needed. Recommend documenting that these are legacy-ingestion-only. |
| `DETERMINISTIC_TYPES` (`grading.ts:15-24`)                                 | a **3rd** grading classification in legacy vocab                       | Should be **deleted** and replaced by `AUTO_EVALUATABLE_TYPES` (now registry-derived) mapped through `QUESTION_TYPE_MAP`. Flag as cleanup.      |
| autograde `ExamQuestion.questionType: z.string()`                          | deliberately open paper-scan world                                     | Leave as-is; not registry-bound.                                                                                                                |

---

# PART B — ROLE_DESCRIPTORS (identity domain)

## B.1 Exhaustive site inventory — what "add one role" touches today

Grepped role literals
(`superAdmin, tenantAdmin, teacher, student, parent, scanner, staff`) +
`TENANT_ROLES / TenantRole / zTenantRole / ROLE_RANK / entityRepoByRole / EntityIds`.

### Tier 1 — DOMAIN (the schema SSOT) — 4 files

| #   | Site                                     | file:line                                                   | What changes                                              |
| --- | ---------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------- |
| 1   | `TENANT_ROLES` enum                      | `packages/domain/src/enums/tenant.ts:12-20`                 | append literal                                            |
| 2   | new branded id `zXId`                    | `packages/domain/src/primitives/branded-id.zod.ts:19-34`    | add `export const zExaminerId = zBrandedId("ExaminerId")` |
| 3   | `PlatformClaimsSchema` per-role id field | `packages/domain/src/entities/identity/claims.ts:24-28`     | add `examinerId: zExaminerId.optional()`                  |
| 4   | `UserMembershipSchema` per-role id field | `packages/domain/src/entities/identity/membership.ts:39-43` | add `examinerId: zExaminerId.optional()`                  |
| 5   | new profile schema                       | `packages/domain/src/entities/identity/profiles.ts:24-119`  | author `ExaminerSchema`                                   |

### Tier 2 — ACCESS (rank + policy intent) — 1 file, 2 concerns

| #   | Site                                                             | file:line                                                            | What changes                                                                                      |
| --- | ---------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 6   | `ROLE_RANK` Record                                               | `packages/access/src/keys/roles.ts:17-25`                            | add ordinal rank                                                                                  |
| 6b  | predicates `isStaffOrAbove`/`isTeacherOrAbove`/`isAuthoringRole` | `roles.ts:28-45`                                                     | rank-driven ones auto-work; `isAuthoringRole` is a **hardcoded literal list** (`:43-45`) — manual |
| 7   | `ACCESS_RULES` role groups + table                               | `packages/access/src/policy.ts:43-48` (groups), `:54-141` (34 rules) | **intentional** — decide which actions the role gets                                              |

### Tier 3 — SERVICES (runtime maps) — 3 files

| #   | Site                                        | file:line                                                      | What changes                                                                         |
| --- | ------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 8   | `EntityIds` interface                       | `packages/services/src/shared/context.ts:18-24`                | add `examinerId?: string`                                                            |
| 9   | `ProvisionMembershipInput.entityIds`        | `packages/services/src/identity/provision-membership.ts:19-25` | add `examinerId?: string`                                                            |
| 10  | `createOrgUser` `entityRepoByRole` map      | `packages/services/src/identity/org-users.ts:43-47`            | add `examiner: repos.examiners` (**fails open today: missing `scanner` → B-IDN-23**) |
| 11  | `createOrgUser` entityIds **ternary chain** | `org-users.ts:83-90`                                           | add a branch (nested ternary, the silent-fail hazard)                                |
| 12  | new `save*Service`                          | `packages/services/src/identity/save-entities.ts:81-145`       | author `saveExaminerService` (+ optional provisioning branch)                        |
| 12b | runtime `buildClaimsFromMembership`         | `sync-membership-claims.ts:38-67`                              | **NO CHANGE** — flat-copies all id fields (corrects B-IDN-12)                        |

### Tier 4 — API-CONTRACT (the SSOT seam) — 2 files

| #   | Site                                      | file:line                                                                  | What changes                                                                                                               |
| --- | ----------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 13  | `ChangeMembershipRoleRequest.links`       | `packages/api-contract/src/callables/identity/users.ts:222-228`            | add `examinerId: zExaminerId.optional()` (**note: today only has teacher/student/parent/staff — already missing scanner**) |
| 14  | new `save*` callable + `ENTITY_CALLABLES` | `packages/api-contract/src/callables/identity/entities.ts:54-189, 384-400` | author `saveExaminer` + register                                                                                           |

### Tier 5 — SEED (parallel claim/provision pipeline) — 4 files

| #   | Site                                         | file:line                                                            | What changes                                                         |
| --- | -------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 15  | seed `TenantRole` union                      | `packages/seed/src/engine/claims.ts:27-34`                           | append literal (a **2nd** copy of the role union)                    |
| 16  | seed `MembershipForClaims` id field          | `seed/src/engine/claims.ts:65-83`                                    | add `examinerId?`                                                    |
| 17  | seed `buildPlatformClaims` per-role `switch` | `seed/src/engine/claims.ts:118-144`                                  | add a `case` (**the switch B-IDN-12 mis-attributed to the runtime**) |
| 18  | seed config schema role arrays               | `seed/src/config/schema.ts:116-132`                                  | add `examiners: z.array(...)`                                        |
| 18b | seed resolver + pipeline writes              | `seed/src/engine/resolver.ts`, `seed/src/engine/pipeline.ts:264-402` | add `examiner()` resolution + per-role `ensureDoc`/`writeMembership` |

### Tier 6 — BUSINESS-LOGIC role checks (conditional, not structural)

`ctx.role === "student"|"parent"|"teacher"` literals in
`services/src/autograde/reads.ts:102-135,229`, `upload-answer-sheets.ts:111-114`
(`role === "scanner"`), `analytics/reads.ts:28-366`,
`shared/projections.ts:11-12`, `enums/notification.ts:34-41` recipient subset.
These are _intent_ branches — a registry doesn't remove them, but
rank-predicates reduce them.

> **Net today:** ~12 mandatory canonical sites (Tiers 1-4) + ~6 seed sites
> (Tier 5) = **~18**, several of them **stringly-typed maps that fail open**
> when a role is missed — `entityRepoByRole` (no `scanner` → B-IDN-23), the
> `org-users.ts:83-90` ternary, and `ChangeMembershipRoleRequest.links` (no
> `scanner`). All three are live proof of the spread-not-registered problem.

## B.2 The registry design (concrete)

```ts
// packages/domain/src/entities/identity/role-registry.ts  — single source for "what is a role"
import { z } from "zod";
import {
  StudentSchema,
  TeacherSchema,
  ParentSchema,
  StaffSchema,
  ScannerSchema,
} from "./profiles.js";
import {
  zStudentId,
  zTeacherId,
  zParentId,
  zStaffId,
  zScannerId,
} from "../../primitives/branded-id.zod.js";

export interface RoleDescriptor {
  role: string;
  rank: number; // → ROLE_RANK
  idField: string; // "studentId" → claims/membership/EntityIds/links key
  idBrand: z.ZodTypeAny; // zStudentId → the schema field
  repoKey: string; // "students" → ctx.repos[repoKey]
  profileSchema: z.ZodTypeAny; // the role's profile entity
  scope: "platform" | "tenant"; // superAdmin = platform (B-IDN-20)
  provisionable: boolean; // can createOrgUser make one?
  authoring: boolean; // → isAuthoringRole
  permissionSet?: "teacher" | "staff"; // which granular permission space (B-IDN-13)
}

export const ROLE_DESCRIPTORS = [
  {
    role: "student",
    rank: 0,
    idField: "studentId",
    idBrand: zStudentId,
    repoKey: "students",
    profileSchema: StudentSchema,
    scope: "tenant",
    provisionable: true,
    authoring: false,
  },
  {
    role: "parent",
    rank: 1,
    idField: "parentId",
    idBrand: zParentId,
    repoKey: "parents",
    profileSchema: ParentSchema,
    scope: "tenant",
    provisionable: true,
    authoring: false,
  },
  {
    role: "scanner",
    rank: 2,
    idField: "scannerId",
    idBrand: zScannerId,
    repoKey: "scanners",
    profileSchema: ScannerSchema,
    scope: "tenant",
    provisionable: true,
    authoring: false,
  },
  {
    role: "teacher",
    rank: 3,
    idField: "teacherId",
    idBrand: zTeacherId,
    repoKey: "teachers",
    profileSchema: TeacherSchema,
    scope: "tenant",
    provisionable: true,
    authoring: true,
    permissionSet: "teacher",
  },
  {
    role: "staff",
    rank: 4,
    idField: "staffId",
    idBrand: zStaffId,
    repoKey: "staff",
    profileSchema: StaffSchema,
    scope: "tenant",
    provisionable: true,
    authoring: true,
    permissionSet: "staff",
  },
  {
    role: "tenantAdmin",
    rank: 5,
    idField: "",
    idBrand: z.never(),
    repoKey: "",
    profileSchema: z.never(),
    scope: "tenant",
    provisionable: false,
    authoring: true,
  },
  {
    role: "superAdmin",
    rank: 6,
    idField: "",
    idBrand: z.never(),
    repoKey: "",
    profileSchema: z.never(),
    scope: "platform",
    provisionable: false,
    authoring: false,
  },
] as const satisfies readonly RoleDescriptor[];

// id-carrying (provisionable) descriptors — drives every per-role id structure:
const ID_ROLES = ROLE_DESCRIPTORS.filter((d) => d.idField !== "");
```

## B.3 Derivation mechanics

```ts
// enum + rank — derived (one list):
export const TENANT_ROLES = ROLE_DESCRIPTORS.map((d) => d.role);
export type TenantRole = (typeof ROLE_DESCRIPTORS)[number]["role"];
export const ROLE_RANK = Object.fromEntries(
  ROLE_DESCRIPTORS.map((d) => [d.role, d.rank])
) as Record<TenantRole, number>;
export const isAuthoringRole = (r: TenantRole | null) =>
  !!r && ROLE_DESCRIPTORS.find((d) => d.role === r)!.authoring;

// EntityIds type — derived:
export type EntityIds = Partial<
  Record<(typeof ID_ROLES)[number]["idField"], string>
>;

// role → repo + role → idField — replace the org-users ternary & entityRepoByRole literal:
export const repoKeyForRole = (r: TenantRole) =>
  ROLE_DESCRIPTORS.find((d) => d.role === r)?.repoKey;
export const idFieldForRole = (r: TenantRole) =>
  ROLE_DESCRIPTORS.find((d) => d.role === r)?.idField;
//   org-users.ts:83-90 collapses to:  const entityIds = { [idFieldForRole(input.role)!]: entityId };
//   org-users.ts:43-48 collapses to:  const entityRepo = ctx.repos[repoKeyForRole(input.role)!];

// the per-role id Zod fields on PlatformClaimsSchema / UserMembershipSchema / links — derived shape:
const roleIdFields = Object.fromEntries(
  ID_ROLES.map((d) => [d.idField, d.idBrand.optional()])
);
//   PlatformClaimsSchema = zObject({ role: zTenantRole.optional(), …, ...roleIdFields });
//   UserMembershipSchema = zObject({ …, ...roleIdFields });
//   ChangeMembershipRoleRequest.links = zObject({ ...roleIdFields }).strict().optional();
```

**Runtime claim-mint already derives for free:** `buildClaimsFromMembership`
flat-copies the id fields, so once the schema fields are registry-derived it
needs **zero** per-role logic — the seed `switch` (`engine/claims.ts:118-144`)
is the only place that still hard-codes per-role behavior and should be
rewritten to the same flat-copy + `ID_ROLES` loop so the two builders converge
(and `seed.claims.test.ts` byte-equality stops being load-bearing prose).

## B.4 Proof — a new role is ONE append + N intentional policy lines

Adding `"examiner"` (a grader who is not full staff):

1. **One descriptor append** to `ROLE_DESCRIPTORS` (rank 3.5→re-number,
   `idField:"examinerId"`, `repoKey:"examiners"`,
   `profileSchema: ExaminerSchema`, `permissionSet:"teacher"`).
2. **One branded-id line**: `zExaminerId = zBrandedId("ExaminerId")` (+ the
   inline `ExaminerSchema`, which _is_ the descriptor's `profileSchema`).
3. **N intentional `ACCESS_RULES` lines** — e.g. add `"examiner"` to
   `TEACHERISH` for `grade.manual`/`grade.ai`, exclude from `space.write`.
   **This stays manual on purpose** (see B.5).

That append regenerates: `TENANT_ROLES`, `ROLE_RANK`, `isAuthoringRole`,
`EntityIds`, the `repoKeyForRole`/`idFieldForRole` lookups (killing the
`org-users` ternary + `entityRepoByRole` literal **and the B-IDN-23
scanner-orphan class of bug**), and the per-role id fields on
claims/membership/links. The save callable+service can be **generated by a
factory** keyed on the descriptor (`makeSaveCallable(descriptor)`), reducing
Tier 4 to a registration line. Seed converges once its builder is unified.

## B.5 What STAYS MANUAL (residual, Part B) — and why

| Residual                                                         | Why it must stay manual                                                                                                                                                                                                                                           | Disposition                                                                                                                    |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **`ACCESS_RULES` authorization intent** (`policy.ts:43-141`)     | Which actions a role may perform is a **security decision**, not a mechanical fact. Deriving it would mean a new role silently inherits or is denied capabilities — the opposite of safe. The mandate's own framing: "1 append + **N intentional** policy lines." | **Correct as manual.** The registry should _not_ touch it. Keep `ACCESS_RULES` data-driven & completeness-tested (already is). |
| Per-role **profile schema** (`ExaminerSchema`)                   | intrinsic content (an examiner has different fields than a scanner)                                                                                                                                                                                               | Lives **inside** the descriptor → still "one place."                                                                           |
| Save-request **authorable field subset**                         | the writable projection of a profile is an intentional choice (you don't expose `createdBy`)                                                                                                                                                                      | Either a `factory(descriptor)` with an `authorableKeys` mask, or hand-authored. Reducible, not fully derivable.                |
| Bulk-import flows (`bulkImportStudents/Teachers`)                | bespoke per role; not every role has CSV import                                                                                                                                                                                                                   | Manual, conditional.                                                                                                           |
| Business-logic `ctx.role === "x"` branches (autograde/analytics) | encode product rules, not identity structure                                                                                                                                                                                                                      | Rank-predicates (`isStaffOrAbove`) shrink these; the rest are intentional.                                                     |
| `superAdmin` platform-vs-tenant scope (B-IDN-20)                 | super-admin is platform-scoped; the registry models it via `scope:"platform"` but the policy keys off `isSuperAdmin`, not `role`                                                                                                                                  | Descriptor carries `scope`; keep the `isSuperAdmin` platform flag distinct (B-IDN-20 stands).                                  |

---

## C. Cross-cutting residual — the one shared friction (both registries)

Both registries hit the **same TypeScript limit**: deriving a Zod
**discriminated union** or a **branded-field object** from
`Array.map()/Object.fromEntries()` produces an `array`/`Record<string,…>`,
losing the **tuple-ness** (Zod's `discriminatedUnion` generic) and **per-field
brand** (e.g. `examinerId: ExaminerId`). Runtime behavior is fully correct; only
the static type needs a one-line assertion (`as [M,...M[]]`) or a typed
mapped-helper. This is the "tiny typed helper" LD-03 predicted, and it is the
**only** thing standing between the current code and literal single-entry
extension. It does **not** weaken the win: the _silent-drift / fail-open_ bug
class (parallel arrays, missing map keys, forgotten ternary branches) is
**eliminated** because every structure reads from one list, guarded by
`satisfies`.

## D. New findings surfaced during re-review

- **RR-T2-A · P2 ·** Runtime `buildClaimsFromMembership` (flat-copy,
  role-agnostic) and seed `buildPlatformClaims` (per-role `switch`) are
  **structurally divergent** claim builders that a contract test asserts are
  byte-equal. Adding a role exercises exactly the divergence. (Corrects
  B-IDN-12's site attribution.) → unify on the flat-copy + `ID_ROLES` loop.
- **RR-T2-B · P1 ·** `TEACHER_PERMISSION_KEYS` / `STAFF_PERMISSION_KEYS`
  **already differ** between `domain/src/enums/permissions.ts:7-29` and
  `seed/src/engine/claims.ts:38-58` — a live instance of the two-copy drift the
  registry mandate targets. Strengthens B-IDN-13 (unify permission keys into one
  registry, imported by both).
- **RR-T2-C · P2 ·** `ChangeMembershipRoleRequest.links` (`users.ts:222-228`)
  and `createOrgUser.entityRepoByRole` (`org-users.ts:43-47`) **both omit
  `scanner`** though it is a first-class role — two independent confirmations of
  B-IDN-23, both auto-fixed by deriving from `ID_ROLES`.

## E. Recommendation priority

| Priority    | Action                                                                            | Fixes                                     |
| ----------- | --------------------------------------------------------------------------------- | ----------------------------------------- |
| **P1**      | `QUESTION_TYPE_REGISTRY` — derive enum + 3 unions + grading arrays                | LD-03 (+ enables LD-02 typed answer axis) |
| **P1**      | `ROLE_DESCRIPTORS` — derive enum/rank/EntityIds/repo-map/id-fields/links          | B-IDN-12, B-IDN-23, B-IDN-30              |
| **P1**      | Unify permission keys into one imported list (kill the live domain↔seed drift)    | B-IDN-13, RR-T2-B                         |
| **P2**      | Converge runtime + seed claim builders on one flat-copy path                      | RR-T2-A                                   |
| **P2**      | Delete `DETERMINISTIC_TYPES`; derive from registry `evaluation` + legacy map      | LD-03 residual                            |
| keep manual | `ACCESS_RULES` authorization intent; per-role/per-type schemas (inside the entry) | by design                                 |

**Bottom line:** Both registries are not only feasible, they are _demonstrably_
the right shape — the codebase already contains three live bugs (scanner
orphaned in two maps, permission-key drift, divergent claim builders) that are
**exactly** the failure mode a single registry prevents. The single residual
cost is one TypeScript tuple/brand-cast helper per registry; the residual
_manual_ work is precisely the work that _should_ stay manual — the per-type Zod
shapes (which live inside the one entry) and the per-role authorization intent
(a security decision). "Add a 16th question type = one entry" and "add a role =
one append + N intentional policy lines" are both **proven**.

_All findings are READ-ONLY observations. No code was modified._ </content>
</invoke>
