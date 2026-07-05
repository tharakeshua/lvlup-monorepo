# DP-2 · Registry-driven extensibility (question types + roles)

**Wave:** W1 (spine — the core of the extensibility mandate) · **Status:**
design-only · **Evidence:** `SDK-RR-T2-registries.md`, A-LD-03, B-IDN-12/13/23.

## Problem

Adding a **question type** = 9 edit points / 5 files (the `QUESTION_TYPES` enum,
the `AUTO_*`/`AI_*` classification arrays, the per-type Zod schema, the
`discriminatedUnion` member, a test, + 3 legacy-vocab adapters). The two
classification arrays can **silently drift** from the schema set. Adding a
**role** = ~18 sites. Live drift already exists: `TEACHER/STAFF_PERMISSION_KEYS`
differ between `domain/enums/permissions.ts` and `seed/engine/claims.ts:38-58`
(RR-T2-B); runtime `buildClaimsFromMembership` (flat, role-agnostic) vs seed
`buildPlatformClaims` (per-role switch) diverge despite a byte-equal contract
test (RR-T2-A); `scanner` omitted in `ChangeMembershipRoleRequest.links` and
`entityRepoByRole` (RR-T2-C).

## Target design A — `QUESTION_TYPE_REGISTRY` (in `domain`)

```ts
type QuestionTypeDef = {
  prompt: ZodObject;        // answer-free (see DP-3)
  answer: ZodObject;        // typed AnswerKeyData variant
  learnerAnswer: ZodObject; // typed LearnerAnswer variant
  evaluation: 'auto' | 'ai';
  label: string;
  sample: () => unknown;
}
const QUESTION_TYPE_REGISTRY = {
  mcq:    { prompt: McqPrompt, answer: McqKey, learnerAnswer: McqAns, evaluation:'auto', label:'Multiple choice', sample:()=>({...}) },
  jumbled:{ prompt: JumbledPrompt, answer: JumbledKey, learnerAnswer: JumbledAns, evaluation:'auto', label:'Reorder', sample:()=>({...}) },
  // …13 more
} as const satisfies Record<string, QuestionTypeDef>
```

The registry **is** the SSOT. Derive:

- `QuestionType = keyof typeof QUESTION_TYPE_REGISTRY`;
  `zQuestionType = z.enum(Object.keys(...))`.
- `QuestionPromptSchema` / `AnswerKeyDataSchema` / `LearnerAnswerSchema` =
  `z.discriminatedUnion('questionType', registry.map(...))`.
- `AUTO_TYPES`/`AI_TYPES` = filtered by `evaluation`.
- the test fixture = `sample()`.

**A 16th type = one entry. Proven.** `api-contract`/repos/api-client/query
already DECOUPLED (no `switch(questionType)` downstream).
`autograde.questionType` is already `z.string()` (open).

## Target design B — `ROLE_DESCRIPTORS` (spanning `domain` + `access`)

```ts
type RoleDescriptor = {
  role: string;
  rank: number;
  idField: string;
  idBrand: ZodBrand;
  repoKey: string;
  profileSchema: ZodObject;
  scope: "tenant" | "platform";
  provisionable: boolean;
  authoring: boolean;
  permissionSet?: readonly string[];
};
const ROLE_DESCRIPTORS = [
  {
    role: "tenantAdmin",
    rank: 80,
    idField: "adminId",
    idBrand: zAdminId,
    repoKey: "admins",
    profileSchema: AdminProfile,
    scope: "tenant",
    provisionable: true,
    authoring: true,
  },
  {
    role: "teacher",
    rank: 40,
    idField: "teacherId",
    idBrand: zTeacherId,
    repoKey: "teachers",
    profileSchema: TeacherProfile,
    scope: "tenant",
    provisionable: true,
    authoring: true,
    permissionSet: TEACHER_PERMISSION_KEYS,
  },
  {
    role: "staff",
    rank: 30,
    idField: "staffId",
    idBrand: zStaffId,
    repoKey: "staff",
    profileSchema: StaffProfile,
    scope: "tenant",
    provisionable: true,
    authoring: false,
    permissionSet: STAFF_PERMISSION_KEYS,
  },
  {
    role: "scanner",
    rank: 20,
    idField: "scannerId",
    idBrand: zScannerId,
    repoKey: "scanners",
    profileSchema: ScannerProfile,
    scope: "tenant",
    provisionable: true,
    authoring: false,
  },
  // student, parent…
] as const satisfies readonly RoleDescriptor[];
```

Derive: `TENANT_ROLES`, `ROLE_RANK`, `isAuthoringRole`, the `EntityIds` type,
`repoKeyForRole`/`idFieldForRole` (kills the `org-users` ternary +
`entityRepoByRole` literal), and the per-role id Zod fields on
`claims`/`membership`/`links`. **A new role = one descriptor append + one
branded-id line + N intentional `ACCESS_RULES` lines.**

## Stays manual (by design)

- The per-type Zod schemas (intrinsic content — but they live _inside_ the one
  entry).
- `ACCESS_RULES` authorization intent (`access/policy.ts:43-141`) — a **security
  decision**, must never be derived.
- Legacy `QUESTION_TYPE_MAP`/`buildQuestionData` — anti-corruption for old vocab
  only (no entry needed for new types).

## Residual friction

One small tuple/brand cast helper per registry (`Array.map` loses the
discriminatedUnion tuple-ness / per-field brand) — runtime is fully correct;
only a 1-line static assertion is needed. This is the _only_ friction, and it
eliminates the silent-drift / fail-open bug class via `satisfies`.

## Tests

- "registry derives all" — assert the derived enum/unions/arrays match the
  registry keys exhaustively.
- One unified `buildClaimsFromMembership` shared by runtime + seed (kills
  RR-T2-A).

## Closes

LD-03, B-IDN-12, B-IDN-13, B-IDN-23, RR-T2-A/B/C — and prevents the class going
forward.
