# `@levelup/api-contract` — Core Layer Plan

> **Domain key:** `api-contract-core` **Layer:** `@levelup/api-contract` (the
> SINGLE SOURCE OF TRUTH for the wire). Pure TS + Zod, zero firebase / DOM /
> React / node coupling. **Position in the cake:** `@levelup/domain` ←
> **`@levelup/api-contract`** ← `@levelup/api-client` ← `@levelup/repositories`
> ← `@levelup/query` ← apps. Also imported verbatim by
> `functions/{identity,levelup,autograde,analytics}` and seed/test tooling.
> **Trust model:** LEAN UI + LEAN-AUTHORITATIVE SERVER + FAT SDK. This layer
> _defines_ the contract both sides agree on; it enforces nothing at runtime on
> the server (that is `@levelup/services` + `@levelup/access`), but it is the
> build-time gate that makes drift impossible and makes `tenantId`-from-body
> structurally unrepresentable.
>
> **Scope of THIS file (the core, not the per-callable defs):** the
> `CallableDef` interface, the `CALLABLES` registry assembly +
> `CallableName`/`ReqOf`/`ResOf`, the full `AppErrorCode` enum +
> `ApiErrorDetails` + `ERROR_MESSAGES`/`ERROR_RECOVERY_HINTS` +
> `HTTPS_TO_APP_ERROR`/`APP_ERROR_TO_HTTPS`, the `PageRequest`/`pageResponse`
> pagination fragment, the `SUBSCRIPTIONS` registry shape, the
> `ALLOWED_TRANSITIONS` build-time-checked-data shape, and the contract test
> asserting no tenant-scoped request schema declares `tenantId`.
>
> The per-callable `*Def` schema bodies are owned by the vertical-slice domain
> plans
> (`domains/{identity,levelup-content,autograde,analytics,gamification,notification,testsession-progress}.md`).
> This file specifies the **frame** those defs slot into.
>
> Grounded in: `specs/common-api.md` §2/§3.2/§5/§6/§7/§10,
> `specs/SDK-SERVER-DESIGN.md` §2.1/§5.2/§5.3/§5.6,
> `status/REVIEW-domain-data-model.md` §6/§7 (risk #1, top-risk #5), and the
> live `packages/shared-types/src/error-types.ts` + `branded.ts`.

---

## 0. Package boundary & dependencies (downward-only)

|                                                      |                                                                                                                                                                                                                              |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Package name**                                     | `@levelup/api-contract`                                                                                                                                                                                                      |
| **Runtime deps**                                     | `zod` (^3.23), `@levelup/domain`                                                                                                                                                                                             |
| **Forbidden imports** (lint `no-restricted-imports`) | `firebase`, `firebase/*`, `firebase-functions`, `firebase-admin`, `@levelup/api-client`, `@levelup/repositories`, `@levelup/query`, `@levelup/realtime`, `@levelup/transport-*`, `react`, any DOM/node lib (`fs`, `path`, …) |
| **Allowed imports**                                  | `zod`, `@levelup/domain` (entity schemas, branded-ID Zod refinements, `Timestamp`, `Page<T>`, `AuditFields`, status enums)                                                                                                   |
| **Consumed by**                                      | `@levelup/api-client`, `@levelup/repositories`, `@levelup/query`, `@levelup/realtime`, all `functions/*` codebases, `functions/services`, seed/test tooling                                                                  |

**Why `domain` is the only upstream dependency.** Request/response schemas
_embed_ domain objects (e.g. `SaveSpaceRequest.data` is a partial of
`SpaceSchema`; `pageResponse(SpaceViewSchema)` wraps a domain view).
`ALLOWED_TRANSITIONS` union members are validated at build time against the
`as const` status enums (`SpaceStatus`, `ExamStatus`, …) which live in
`@levelup/domain`. The contract never re-declares an entity shape — it imports
it.

---

## 1. File layout within the package

```
packages/api-contract/
├── package.json                     # name, deps (zod + @levelup/domain), exports map
├── tsconfig.json                    # extends root; "composite": true; references ../domain
├── eslint.config.js                 # no-restricted-imports boundary (see §0)
├── vitest.config.ts
└── src/
    ├── index.ts                     # public barrel — re-exports the entire surface
    │
    ├── callable/
    │   ├── callable-def.ts          # CallableDef<Req,Res>, ApiModule, RateTier, AuthMode  (§2)
    │   ├── registry.ts              # CALLABLES assembly + CallableName/ReqOf/ResOf        (§3)
    │   └── modules/                 # per-MODULE def barrels (defs themselves live in domain plans)
    │       ├── identity.ts          #   export const identityCallables = { 'v1.identity.saveTenant': ... }
    │       ├── levelup.ts           #   (incl. folded gamification name-segment defs)
    │       ├── autograde.ts
    │       └── analytics.ts
    │
    ├── error/
    │   ├── codes.ts                 # AppErrorCode enum + APP_ERROR_CODES array            (§4.1)
    │   ├── details.ts               # ApiErrorDetails, ValidationError, JsonValue          (§4.2)
    │   ├── maps.ts                  # APP_ERROR_TO_HTTPS / HTTPS_TO_APP_ERROR + FunctionsErrorCode (§4.3)
    │   └── copy.ts                  # ERROR_MESSAGES / ERROR_RECOVERY_HINTS                 (§4.4)
    │
    ├── pagination/
    │   └── page.ts                  # PageRequest, pageResponse(), PageRequestInput        (§5)
    │
    ├── transitions/
    │   └── allowed-transitions.ts   # ALLOWED_TRANSITIONS + TransitionMap + assertTransition helper type (§6)
    │
    ├── subscriptions/
    │   ├── subscription-def.ts      # SubscriptionDef, SubscriptionName/ParamsOf/PayloadOf (§7)
    │   └── registry.ts              # SUBSCRIPTIONS assembly (payload schemas from domain)  (§7)
    │
    ├── meta/
    │   ├── api-version.ts           # API_VERSION = 'v1' as const; versioned-name helpers   (§8)
    │   └── rate-tiers.ts            # RATE_TIER values + RATE_LIMITS (moved from error-types) (§9)
    │
    └── __tests__/
        ├── no-tenant-id-in-request.test.ts      # THE contract test (§10.1)
        ├── registry-integrity.test.ts           # name↔key, module match, strict schemas (§10.2)
        ├── error-maps-bijection.test.ts          # maps + copy completeness (§10.3)
        ├── allowed-transitions-enum.test.ts      # union members ⊆ status enums (§10.4)
        ├── subscriptions-integrity.test.ts       # subscription registry shape (§10.5)
        └── pagination.test.ts                    # PageRequest defaults / pageResponse (§10.6)
```

**Rule: defs are authored in module barrels, asserted into the frame here.**
Each `callable/modules/<m>.ts` exports a `Record<\`v1.<m>.\*\`,
CallableDef<any,any>>`whose values come from (or re-export) the per-callable schema files the domain plans own.`registry.ts`spreads the four module records into one`CALLABLES`.
This keeps the registry assembly (this layer) decoupled from def authoring
(domain layers) while giving one import surface.

---

## 2. `CallableDef` — the per-callable contract unit (`src/callable/callable-def.ts`)

```ts
import type { ZodType } from "zod";

/** The four deploy-independent bounded-context codebases. */
export type ApiModule = "identity" | "levelup" | "autograde" | "analytics";
export const API_MODULES = [
  "identity",
  "levelup",
  "autograde",
  "analytics",
] as const;

/** Drives rate limiter + contract-test agreement on tier-per-callable (common-api §9). */
export type RateTier = "write" | "read" | "ai" | "auth" | "report";
export const RATE_TIERS = ["write", "read", "ai", "auth", "report"] as const;

/** 'public' is ONLY for pre-auth lookups (lookupTenantByCode). Everything else is 'authed'. */
export type AuthMode = "authed" | "public";

/**
 * One entry per callable. The single source of truth for name, module, wire schemas,
 * auth/rate policy, idempotency, and invalidation hints.
 * Req/Res are PHANTOM type params recovered via z.infer at the registry boundary.
 */
export interface CallableDef<Req = unknown, Res = unknown> {
  /** Versioned, namespaced, stable: `v1.<module>.<operation>`. MUST equal its registry key. */
  readonly name: CallableName;
  /** Which codebase owns/deploys it. MUST equal the `<module>` segment of `name`. */
  readonly module: ApiModule;
  /** .strict() request schema. For tenant-scoped ops it MUST NOT contain a `tenantId` key (§10.1). */
  readonly requestSchema: ZodType<Req>;
  /** .strict() response schema. Validated client-side in dev to catch drift. */
  readonly responseSchema: ZodType<Res>;
  /** 'public' only for pre-auth (lookupTenantByCode). */
  readonly authMode: AuthMode;
  /** Tier for the limiter + contract agreement. */
  readonly rateTier: RateTier;
  /**
   * Marks the callable as accepting an `idempotencyKey` in its request schema; the
   * api-client generates a UUID-v7 per call and the server dedupes on (uid,key) (common-api §9).
   * A contract test asserts: idempotent === true  ⟺  request schema has an `idempotencyKey` field.
   */
  readonly idempotent?: boolean;
  /**
   * Super-admin cross-tenant escape hatch. When true, the request schema MAY carry an
   * OPTIONAL `tenantOverride` field; buildAuthContext honors it only if ctx.isSuperAdmin.
   * This is the ONLY way a tenant id legitimately appears in a request (audited). Default false.
   */
  readonly allowsTenantOverride?: boolean;
  /**
   * Query-key roots this mutation dirties — a HINT consumed by @levelup/query invalidation.
   * Strings, not live key factories, to keep this layer framework-free (e.g. 'spaces', 'storeSpaces').
   * Reads omit this.
   */
  readonly invalidates?: readonly string[];
  /**
   * Tags mutating role/status/class/permission callables that MUST call syncMembershipClaims
   * server-side. A lint/contract test in the SERVER layer reads this flag (common-api §4.5).
   */
  readonly resyncsClaims?: boolean;
}

/**
 * Authoring helper — gives inference + a single place to default flags.
 * Domain plans author defs through this so `name`/`module`/schemas stay consistent.
 */
export function defineCallable<Req, Res>(
  def: CallableDef<Req, Res>
): CallableDef<Req, Res> {
  return def;
}
```

**Notes**

- `name` is typed as `CallableName` (a forward reference resolved once the
  registry is assembled — TS allows the circular type because
  `CallableName = keyof typeof CALLABLES` and `CALLABLES` values are
  `CallableDef`). To break the cycle cleanly, `callable-def.ts` declares
  `name: string` on the _generic_ `CallableDef` and `registry.ts` re-narrows via
  the `satisfies` check (see §3). The phantom `Req`/`Res` carry inference
  through `ReqOf`/`ResOf`.
- `invalidates` deliberately uses **plain strings** (query-key roots) not
  imported key factories — importing `@levelup/query` would violate
  downward-only. The query layer maps these strings → its key factories.
- New vs `common-api.md` §3.2: this file adds `idempotent`,
  `allowsTenantOverride`, `invalidates`, `resyncsClaims` per
  `SDK-SERVER-DESIGN.md` §2.1 and §5.4 and `common-api.md` §4.5/§9.

---

## 3. `CALLABLES` registry assembly + `CallableName`/`ReqOf`/`ResOf` (`src/callable/registry.ts`)

```ts
import { identityCallables } from "./modules/identity";
import { levelupCallables } from "./modules/levelup";
import { autogradeCallables } from "./modules/autograde";
import { analyticsCallables } from "./modules/analytics";
import type { CallableDef } from "./callable-def";

/**
 * THE registry. One flat object keyed by the versioned callable name.
 * Module barrels are spread in; `as const` freezes the key set so `keyof` is a literal union.
 */
export const CALLABLES = {
  ...identityCallables,
  ...levelupCallables,
  ...autogradeCallables,
  ...analyticsCallables,
} as const;

/** Compile-time guarantee every value is a CallableDef (catches a malformed module barrel). */
type _AssertAllDefs = {
  [K in keyof typeof CALLABLES]: (typeof CALLABLES)[K] extends CallableDef<
    any,
    any
  >
    ? true
    : never;
};

export type CallableName = keyof typeof CALLABLES; // 'v1.identity.saveTenant' | 'v1.levelup.saveSpace' | …
export type ReqOf<N extends CallableName> = import("zod").infer<
  (typeof CALLABLES)[N]["requestSchema"]
>;
export type ResOf<N extends CallableName> = import("zod").infer<
  (typeof CALLABLES)[N]["responseSchema"]
>;

/** Runtime list of all names (contract tests + server router iteration). */
export const CALLABLE_NAMES = Object.keys(CALLABLES) as CallableName[];

/** Lookup with a clear failure mode (server router; never silent). */
export function getCallable<N extends CallableName>(
  name: N
): (typeof CALLABLES)[N] {
  const def = CALLABLES[name];
  if (!def) throw new Error(`[api-contract] unknown callable: ${name}`);
  return def;
}

/** All callables for one module (server codebase wires only its own slice). */
export function callablesForModule(
  module: import("./callable-def").ApiModule
): CallableDef[] {
  return CALLABLE_NAMES.map((n) => CALLABLES[n]).filter(
    (d) => d.module === module
  );
}
```

### 3.1 Module barrel shape (`src/callable/modules/levelup.ts`, representative)

```ts
import { saveSpaceDef, listSpacesDef, /* …all levelup + folded-gamification defs */ } from /* domain-owned def files */;

export const levelupCallables = {
  'v1.levelup.saveSpace':  saveSpaceDef,
  'v1.levelup.listSpaces': listSpacesDef,
  'v1.levelup.submitTestSession': submitTestSessionDef,
  // … every v1.levelup.* and the gamification name-segment defs folded under module 'levelup'
} as const satisfies Record<string, CallableDef<any, any>>;
```

> **Gamification folding (per `domains/gamification.md`).** There is no 5th
> codebase. Gamification student-facing callables keep `module: 'levelup'` (or
> `'analytics'` for derivation/leaderboard) but the **name segment** may read
> `v1.levelup.listAchievements`, `v1.levelup.getLeaderboard`, etc. The `module`
> discriminator on `CallableDef` stays one of the four; the `name`'s `<module>`
> segment must still equal `def.module` (asserted in §10.2).

### 3.2 Full registry inventory (frame must accommodate all of these)

The registry assembles **~90 callables** across the four module barrels (the
original ~47 plus the new `list*`/`get*` read endpoints that replace direct
Firestore reads, plus gamification). Authoritative per-def schemas are owned by
the domain plans; this layer guarantees the _keys_ below resolve. Enumerated so
the contract test (§10.2) and the server router have a closed set:

- **identity** (`v1.identity.*`): `saveTenant`, `deactivateTenant`,
  `reactivateTenant`, `exportTenantData`, `uploadTenantAsset`, `saveStudent`,
  `saveTeacher`, `saveParent`, `saveStaff`, `saveClass`, `saveAcademicSession`,
  `createOrgUser`, `switchActiveTenant`, `joinTenant`, `bulkImportStudents`,
  `bulkImportTeachers`, `bulkUpdateStatus`, `rolloverSession`,
  `manageNotifications`, `saveAnnouncement`, `listAnnouncements`,
  `markAnnouncementRead`, `searchUsers`, `saveGlobalEvaluationPreset`,
  `lookupTenantByCode` (**public**), `getMe`, `getTenant`, `listTenants`,
  `getStudent`, `getTeacher`, `getClass`, `listStudents`, `listTeachers`,
  `listParents`, `listStaff`, `listClasses`, `listAcademicSessions`,
  `listNotifications`, `getNotificationBadge`, `markNotificationRead`,
  `getNotificationPreferences`, `saveNotificationPreferences`.
- **levelup** (`v1.levelup.*`, incl. folded gamification): `saveSpace`,
  `saveStoryPoint`, `saveItem`, `getItemForEdit`, `listVersions`,
  `startTestSession`, `submitTestSession`, `evaluateAnswer`,
  `recordItemAttempt`, `saveQuestionBankItem`, `listQuestionBank`,
  `importFromBank`, `saveRubricPreset`, `listRubricPresets`, `saveAgent`,
  `listAgents`, `sendChatMessage`, `getChatSession`, `listChatSessions`,
  `saveSpaceReview`, `listSpaceReviews`, `listStoreSpaces`, `getStoreSpace`,
  `purchaseSpace`, `listSpaces`, `getSpace`, `listStoryPoints`, `listItems`,
  `getSpaceProgress`, `getStoryPointProgress`, `getTestSession`,
  `listTestSessions`, `getLeaderboard`, `getStudentLevel`,
  `getGamificationSummary`, `listAchievements`, `listStudentAchievements`,
  `markAchievementsSeen`, `saveAchievementDefinition`, `listLearningInsights`,
  `dismissInsight`, `listStudyGoals`, `saveStudyGoal`, `listStudySessions`,
  `manageNotifications`.
- **autograde** (`v1.autograde.*`): `saveExam`, `extractQuestions`,
  `uploadAnswerSheets`, `gradeQuestion`, `releaseResults`,
  `saveEvaluationSettings`, `listEvaluationSettings`, `listExams`, `getExam`,
  `listSubmissions`, `getSubmission`, `listQuestionSubmissions`,
  `listQuestions`, `getExamAnalytics`, `listDeadLetter`, `resolveDeadLetter`.
- **analytics** (`v1.analytics.*`): `getSummary`, `generateReport`,
  `getPerformanceTrends`, `getChildSummary`, `listLinkedChildren`,
  `getExamAnalytics`, `getCostSummary`, `listInsights`, `dismissInsight`,
  `getLeaderboard`.

(The exact final set is closed by `CALLABLE_NAMES`; any name a domain plan adds
must land in a module barrel or the build fails the `satisfies` check.)

---

## 4. Error model (`src/error/`)

> Supersedes the live `shared-types/src/error-types.ts`. The live enum is
> **renamed/expanded** to match `common-api.md` §6.1 and `SDK-SERVER-DESIGN.md`
> §5.2. Both maps + both copy tables live here so client and server agree
> (common-api §6.1).

### 4.1 `AppErrorCode` enum + array (`src/error/codes.ts`)

```ts
/**
 * Application-level, transport-neutral error codes. The union is the SINGLE source;
 * the array is its runtime mirror (kept in sync by a type-level exhaustiveness check below).
 */
export type AppErrorCode =
  | "VALIDATION_ERROR" // Zod parseRequest failure → carries validationErrors[]
  | "INVALID_TRANSITION" // ALLOWED_TRANSITIONS violation (status state machine)
  | "NOT_FOUND"
  | "PERMISSION_DENIED" // authorize() denied (access policy)
  | "UNAUTHENTICATED" // no/invalid token
  | "RATE_LIMITED" // limiter tripped (retryable)
  | "QUOTA_EXCEEDED" // usage/plan quota (not retryable without upgrade)
  | "FEATURE_DISABLED" // tenant feature gate off
  | "TENANT_SUSPENDED" // tenant lifecycle deactivated
  | "CONFLICT" // already-exists / version conflict (optimistic)
  | "PRECONDITION_FAILED" // generic failed-precondition not covered by INVALID_TRANSITION
  | "IDEMPOTENCY_CONFLICT" // same idempotencyKey, different payload
  | "PAYMENT_FAILED" // purchaseSpace gateway decline
  | "INTERNAL_ERROR"; // catch-all (retryable=false by default)

export const APP_ERROR_CODES = [
  "VALIDATION_ERROR",
  "INVALID_TRANSITION",
  "NOT_FOUND",
  "PERMISSION_DENIED",
  "UNAUTHENTICATED",
  "RATE_LIMITED",
  "QUOTA_EXCEEDED",
  "FEATURE_DISABLED",
  "TENANT_SUSPENDED",
  "CONFLICT",
  "PRECONDITION_FAILED",
  "IDEMPOTENCY_CONFLICT",
  "PAYMENT_FAILED",
  "INTERNAL_ERROR",
] as const satisfies readonly AppErrorCode[];

// Compile-time exhaustiveness: array ⊇ union AND union ⊇ array (no drift between the two).
type _AppErrorCodeCheck = AppErrorCode extends (typeof APP_ERROR_CODES)[number]
  ? true
  : never;
const _appErrorCodeCheck: _AppErrorCodeCheck = true;

/** Default retryability by code — consumed by normalizeError when the server omits `retryable`. */
export const DEFAULT_RETRYABLE: Record<AppErrorCode, boolean> = {
  VALIDATION_ERROR: false,
  INVALID_TRANSITION: false,
  NOT_FOUND: false,
  PERMISSION_DENIED: false,
  UNAUTHENTICATED: false,
  RATE_LIMITED: true,
  QUOTA_EXCEEDED: false,
  FEATURE_DISABLED: false,
  TENANT_SUSPENDED: false,
  CONFLICT: true,
  PRECONDITION_FAILED: false,
  IDEMPOTENCY_CONFLICT: false,
  PAYMENT_FAILED: false,
  INTERNAL_ERROR: true,
};
```

> **Migration note from live `error-types.ts`:** `VALIDATION_FAILED` →
> `VALIDATION_ERROR`; adds `INVALID_TRANSITION`, `FEATURE_DISABLED`,
> `TENANT_SUSPENDED`, `IDEMPOTENCY_CONFLICT`, `PAYMENT_FAILED`.
> `CONFLICT`/`PRECONDITION_FAILED`/`INTERNAL_ERROR` kept. A one-shot codemod
> aliases old → new during cutover.

### 4.2 `ApiErrorDetails` + helpers (`src/error/details.ts`)

```ts
import { z } from "zod";
import { APP_ERROR_CODES } from "./codes";
import type { AppErrorCode } from "./codes";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [k: string]: JsonValue };

export interface ValidationError {
  path: string;
  message: string;
}

/** The typed payload ALWAYS carried in HttpsError.details (common-api §6.1). */
export interface ApiErrorDetails {
  code: AppErrorCode;
  message: string; // user-safe default; client may localize via ERROR_MESSAGES
  validationErrors?: ValidationError[]; // present iff code === 'VALIDATION_ERROR'
  retryable?: boolean; // explicit server hint; else DEFAULT_RETRYABLE[code]
  meta?: Record<string, JsonValue>; // e.g. { resource:'space', id }, { retryAfterMs }
}

/** Zod mirror — used by the api-client to safely PARSE an unknown HttpsError.details at runtime. */
export const ApiErrorDetailsSchema = z
  .object({
    code: z.enum(APP_ERROR_CODES),
    message: z.string(),
    validationErrors: z
      .array(z.object({ path: z.string(), message: z.string() }))
      .optional(),
    retryable: z.boolean().optional(),
    meta: z.record(z.string(), z.any()).optional(),
  })
  .strict();

/** Type guard for the client decoder (normalizeError). */
export function isApiErrorDetails(x: unknown): x is ApiErrorDetails {
  return ApiErrorDetailsSchema.safeParse(x).success;
}
```

> **Note on `fail()` and `normalizeError()`:** these _live elsewhere_ (server
> `@levelup/functions-shared` and client `@levelup/api-client` respectively, per
> `SDK-SERVER-DESIGN.md` §5.2). This layer provides only the **shared
> vocabulary** (`ApiErrorDetails`, `ApiErrorDetailsSchema`, the maps, the copy)
> that both helpers import. Keeping `fail`/`normalizeError` out of
> `api-contract` preserves the firebase-free purity (`fail` throws
> `HttpsError`).

### 4.3 Code ↔ transport maps (`src/error/maps.ts`)

```ts
import type { AppErrorCode } from "./codes";

/** Firebase Callable error code union (mirrors functions.https.FunctionsErrorCode — re-declared, NOT imported). */
export type FunctionsErrorCode =
  | "ok"
  | "cancelled"
  | "unknown"
  | "invalid-argument"
  | "deadline-exceeded"
  | "not-found"
  | "already-exists"
  | "permission-denied"
  | "resource-exhausted"
  | "failed-precondition"
  | "aborted"
  | "out-of-range"
  | "unimplemented"
  | "internal"
  | "unavailable"
  | "data-loss"
  | "unauthenticated";

/** Server: AppErrorCode → HttpsError code (used by `fail()` in functions-shared). Total over the enum. */
export const APP_ERROR_TO_HTTPS: Record<AppErrorCode, FunctionsErrorCode> = {
  VALIDATION_ERROR: "invalid-argument",
  INVALID_TRANSITION: "failed-precondition",
  NOT_FOUND: "not-found",
  PERMISSION_DENIED: "permission-denied",
  UNAUTHENTICATED: "unauthenticated",
  RATE_LIMITED: "resource-exhausted",
  QUOTA_EXCEEDED: "resource-exhausted",
  FEATURE_DISABLED: "failed-precondition",
  TENANT_SUSPENDED: "failed-precondition",
  CONFLICT: "already-exists",
  PRECONDITION_FAILED: "failed-precondition",
  IDEMPOTENCY_CONFLICT: "already-exists",
  PAYMENT_FAILED: "failed-precondition",
  INTERNAL_ERROR: "internal",
};

/**
 * Client: HttpsError code → AppErrorCode FALLBACK only.
 * normalizeError prefers details.code (the authoritative AppErrorCode) and uses this map
 * only when an error arrives WITHOUT typed details (legacy / non-app errors). Many→one is fine.
 */
export const HTTPS_TO_APP_ERROR: Record<FunctionsErrorCode, AppErrorCode> = {
  ok: "INTERNAL_ERROR",
  cancelled: "INTERNAL_ERROR",
  unknown: "INTERNAL_ERROR",
  "invalid-argument": "VALIDATION_ERROR",
  "deadline-exceeded": "INTERNAL_ERROR",
  "not-found": "NOT_FOUND",
  "already-exists": "CONFLICT",
  "permission-denied": "PERMISSION_DENIED",
  "resource-exhausted": "RATE_LIMITED",
  "failed-precondition": "PRECONDITION_FAILED",
  aborted: "CONFLICT",
  "out-of-range": "VALIDATION_ERROR",
  unimplemented: "INTERNAL_ERROR",
  internal: "INTERNAL_ERROR",
  unavailable: "INTERNAL_ERROR",
  "data-loss": "INTERNAL_ERROR",
  unauthenticated: "UNAUTHENTICATED",
};
```

> **Asymmetry is intentional & documented (§10.3 asserts it):**
> `APP_ERROR_TO_HTTPS` is **total + injective-by-intent** over `AppErrorCode`;
> `HTTPS_TO_APP_ERROR` is **total over `FunctionsErrorCode` but many→one**
> (several HTTPS codes collapse to `INTERNAL_ERROR`/`RATE_LIMITED`). It is a
> fallback, not a bijection — `normalizeError` reads `details.code` first.

### 4.4 User-facing copy (`src/error/copy.ts`)

```ts
import type { AppErrorCode } from "./codes";

/** Default user-safe message per code (client may localize). Total over the enum. */
export const ERROR_MESSAGES: Record<AppErrorCode, string> = {
  VALIDATION_ERROR: "The request contains invalid data.",
  INVALID_TRANSITION: "That action is not allowed from the current state.",
  NOT_FOUND: "The requested resource was not found.",
  PERMISSION_DENIED: "You do not have permission to perform this action.",
  UNAUTHENTICATED: "You must be signed in to perform this action.",
  RATE_LIMITED: "Too many requests. Please try again in a moment.",
  QUOTA_EXCEEDED: "You have exceeded your usage quota.",
  FEATURE_DISABLED: "This feature is not enabled for your organization.",
  TENANT_SUSPENDED: "Your organization account is currently suspended.",
  CONFLICT: "This resource was modified elsewhere. Refresh and retry.",
  PRECONDITION_FAILED:
    "The operation cannot be performed in the current state.",
  IDEMPOTENCY_CONFLICT:
    "A conflicting request with the same key is already in progress.",
  PAYMENT_FAILED: "The payment could not be completed.",
  INTERNAL_ERROR: "An unexpected error occurred. Please try again.",
};

/** Recovery hint shown alongside the toast; null = no actionable hint. Total over the enum. */
export const ERROR_RECOVERY_HINTS: Record<AppErrorCode, string | null> = {
  VALIDATION_ERROR: "Check the highlighted fields and try again.",
  INVALID_TRANSITION: "Refresh to see the current status, then retry.",
  NOT_FOUND: "The item may have been deleted. Try refreshing.",
  PERMISSION_DENIED: "Contact your administrator if you need access.",
  UNAUTHENTICATED: "Please sign in and try again.",
  RATE_LIMITED: "Wait a few seconds before trying again.",
  QUOTA_EXCEEDED: "Contact your administrator to upgrade your plan.",
  FEATURE_DISABLED: "Ask your administrator to enable this feature.",
  TENANT_SUSPENDED: "Contact support to restore your account.",
  CONFLICT: "Refresh the page to load the latest version.",
  PRECONDITION_FAILED: "Refresh the page and verify the current status.",
  IDEMPOTENCY_CONFLICT: "Wait for the in-flight request to finish.",
  PAYMENT_FAILED: "Check your payment details and try again.",
  INTERNAL_ERROR: "If the problem persists, contact support.",
};
```

---

## 5. Pagination fragment (`src/pagination/page.ts`)

```ts
import { z } from "zod";
import type { ZodTypeAny } from "zod";

/** Opaque, server-encoded cursor (base64 Firestore snapshot today; row key under REST later). */
export const PageRequest = z
  .object({
    cursor: z.string().optional(),
    limit: z.number().int().min(1).max(100).default(20),
  })
  .strict();
export type PageRequestInput = z.input<typeof PageRequest>; // limit optional (pre-default)
export type PageRequestParsed = z.infer<typeof PageRequest>; // limit required (post-default)

/**
 * Wrap any item schema in the unified page envelope. Used by EVERY list endpoint
 * (listSpaces, listSubmissions, searchUsers, listVersions, …). `total` only when cheaply known.
 */
export const pageResponse = <T extends ZodTypeAny>(item: T) =>
  z
    .object({
      items: z.array(item),
      nextCursor: z.string().nullable(), // null = end of stream
      total: z.number().int().nonnegative().optional(),
    })
    .strict();

/** Inferred page type for a given item type (repos/hooks consume this; UI never sees `cursor`). */
export type PageResponse<T> = {
  items: T[];
  nextCursor: string | null;
  total?: number;
};

/**
 * Composition helper so a request schema can mix filter fields + paging without re-spelling them.
 * Usage in a domain def:  requestSchema: withPaging(z.object({ status: SpaceStatus.optional() }))
 */
export const withPaging = <S extends z.ZodObject<any>>(shape: S) =>
  shape.merge(PageRequest); // result stays .strict() if `shape` was .strict()
```

**Contract guarantees:** cursors are opaque strings (the SDK/UI never construct
or parse them); `limit` defaults to 20, hard-capped at 100; `nextCursor: null`
is the canonical end-of-stream signal. Repositories expose
`paginate()`/infinite-query helpers over this; the UI sees only `Page<T>` +
`fetchNextPage()` (per `SDK-SERVER-DESIGN.md` §5.3).

---

## 6. `ALLOWED_TRANSITIONS` — build-time-checked data (`src/transitions/allowed-transitions.ts`)

```ts
import type {
  SpaceStatus,
  ExamStatus,
  SubmissionStatus,
  TestSessionStatus,
  TenantStatus,
} from "@levelup/domain";

/** Adjacency map: from-state → allowed to-states. Terminal states map to []. */
export type TransitionMap<S extends string> = Readonly<Record<S, readonly S[]>>;

export const ALLOWED_TRANSITIONS = {
  space: {
    draft: ["published"],
    published: ["archived", "draft"],
    archived: ["draft"],
  } satisfies TransitionMap<SpaceStatus>,

  exam: {
    draft: ["extracting", "ready"],
    extracting: ["ready", "failed"],
    ready: ["grading", "archived"],
    grading: ["graded", "failed"],
    graded: ["results_released", "grading"], // re-grade allowed pre-release
    results_released: ["archived"],
    failed: ["ready", "archived"],
    archived: [],
  } satisfies TransitionMap<ExamStatus>,

  submission: {
    uploaded: ["queued", "failed"],
    queued: ["grading", "failed"],
    grading: ["graded", "needs_review", "failed"],
    needs_review: ["graded", "grading"],
    graded: ["released"],
    released: [],
    failed: ["queued"],
  } satisfies TransitionMap<SubmissionStatus>,

  testSession: {
    in_progress: ["completed", "expired", "abandoned"],
    completed: [],
    expired: [],
    abandoned: [],
  } satisfies TransitionMap<TestSessionStatus>,

  tenant: {
    active: ["suspended"],
    suspended: ["active"],
  } satisfies TransitionMap<TenantStatus>,
} as const;

export type TransitionEntity = keyof typeof ALLOWED_TRANSITIONS;

/** Pure predicate — used by repos for UX pre-checks AND by the server to enforce. */
export function canTransition<E extends TransitionEntity>(
  entity: E,
  from: keyof (typeof ALLOWED_TRANSITIONS)[E],
  to: string
): boolean {
  const edges = (
    ALLOWED_TRANSITIONS[entity] as Record<string, readonly string[]>
  )[from as string];
  return edges?.includes(to) ?? false;
}
```

> **The `satisfies TransitionMap<XStatus>` clause IS the build-time check**
> (`REVIEW` top-risk #5 / open-Q): the key set of every map must be exactly the
> `as const` status-enum union, and every value must be a subset of it — a typo
> or a stale status fails `tsc`. Test §10.4 additionally asserts no edge points
> at a non-member at runtime. The exact enum members (`ExamStatus`,
> `SubmissionStatus`, …) come from `@levelup/domain`; if the autograde plan
> drops the unreachable `'completed'` exam status (REVIEW open-Q), this map
> updates in lockstep and the build catches the mismatch.
>
> **Server uses the same table to enforce** (`assertTransition` in
> `@levelup/services` imports `canTransition`); the SDK uses it for
> button-disable UX. One table, both halves (responsibility table §4: pre-check
> in SDK ○, enforce in SERVER ●).

---

## 7. `SUBSCRIPTIONS` registry (`src/subscriptions/`)

### 7.1 `SubscriptionDef` + type recovery (`src/subscriptions/subscription-def.ts`)

```ts
import type { ZodType } from "zod";

/** Realtime channel definition — parallel to CallableDef but for subscribe() (SDK-SERVER §5.6). */
export interface SubscriptionDef<Params = unknown, Payload = unknown> {
  /** Versioned name `v1.<module>.<channel>`. MUST equal its registry key. */
  readonly name: SubscriptionName;
  readonly module: import("../callable/callable-def").ApiModule;
  /** .strict() params schema (sessionId, submissionId, scope, …). Same no-tenantId rule applies. */
  readonly params: ZodType<Params>;
  /** .strict() payload schema — what each emission is validated against on the client. */
  readonly payload: ZodType<Payload>;
  /** Underlying source kind — a HINT for transport-firebase (Firestore doc/query vs RTDB node). */
  readonly source: "firestore-doc" | "firestore-query" | "rtdb-node";
}

export function defineSubscription<P, T>(
  def: SubscriptionDef<P, T>
): SubscriptionDef<P, T> {
  return def;
}
```

### 7.2 Registry assembly (`src/subscriptions/registry.ts`)

```ts
import { z } from "zod";
import {
  TestSessionLiveSchema,
  ChatMessageSchema,
  NotificationStateSchema,
  SubmissionStatusSchema,
  ExamGradingProgressSchema,
  LeaderboardSnapshotSchema,
  StudentLevelSchema,
  SpaceProgressLiveSchema,
  AchievementUnlockSchema,
} from "@levelup/domain"; // payload schemas are DOMAIN-owned (downward-only)

export const SUBSCRIPTIONS = {
  // levelup
  "v1.levelup.testSessionDeadline": {
    name: "v1.levelup.testSessionDeadline",
    module: "levelup",
    source: "firestore-doc",
    params: z.object({ sessionId: z.string() }).strict(),
    payload: TestSessionLiveSchema,
  },
  "v1.levelup.chatStream": {
    name: "v1.levelup.chatStream",
    module: "levelup",
    source: "firestore-query",
    params: z.object({ sessionId: z.string() }).strict(),
    payload: ChatMessageSchema,
  },
  "v1.levelup.spaceProgressLive": {
    name: "v1.levelup.spaceProgressLive",
    module: "levelup",
    source: "firestore-doc",
    params: z.object({ spaceId: z.string() }).strict(),
    payload: SpaceProgressLiveSchema,
  },
  "v1.levelup.leaderboardLive": {
    name: "v1.levelup.leaderboardLive",
    module: "analytics",
    source: "rtdb-node",
    params: z
      .object({
        scope: z.enum(["tenant", "class", "space", "storyPoint"]),
        spaceId: z.string().optional(),
        storyPointId: z.string().optional(),
        limit: z.number().int().max(100).default(50),
      })
      .strict(),
    payload: LeaderboardSnapshotSchema, // { entries: LeaderboardEntry[], callerRank: number|null }
  },
  "v1.levelup.studentLevelLive": {
    name: "v1.levelup.studentLevelLive",
    module: "levelup",
    source: "firestore-doc",
    params: z.object({}).strict(),
    payload: StudentLevelSchema,
  },
  "v1.levelup.achievementUnlock": {
    name: "v1.levelup.achievementUnlock",
    module: "levelup",
    source: "firestore-query",
    params: z.object({}).strict(),
    payload: AchievementUnlockSchema,
  },
  // autograde
  "v1.autograde.gradingStatus": {
    name: "v1.autograde.gradingStatus",
    module: "autograde",
    source: "firestore-doc",
    params: z.object({ submissionId: z.string() }).strict(),
    payload: SubmissionStatusSchema,
  },
  "v1.autograde.examGrading": {
    name: "v1.autograde.examGrading",
    module: "autograde",
    source: "firestore-doc",
    params: z.object({ examId: z.string() }).strict(),
    payload: ExamGradingProgressSchema,
  },
  // identity / notification
  "v1.notification.badge": {
    name: "v1.notification.badge",
    module: "identity",
    source: "rtdb-node",
    params: z.object({}).strict(),
    payload: NotificationStateSchema,
  },
} as const satisfies Record<
  string,
  import("./subscription-def").SubscriptionDef<any, any>
>;

export type SubscriptionName = keyof typeof SUBSCRIPTIONS;
export type ParamsOf<S extends SubscriptionName> = z.infer<
  (typeof SUBSCRIPTIONS)[S]["params"]
>;
export type PayloadOf<S extends SubscriptionName> = z.infer<
  (typeof SUBSCRIPTIONS)[S]["payload"]
>;
export const SUBSCRIPTION_NAMES = Object.keys(
  SUBSCRIPTIONS
) as SubscriptionName[];
```

> `Transport.subscribe<S>(name, params, cb)` (in api-client/transport) recovers
> `ParamsOf<S>`/`PayloadOf<S>` from this registry exactly as `invoke` recovers
> `ReqOf`/`ResOf`. `transport-firebase` reads `source` to pick the
> Firestore-listener vs RTDB-listener path; `transport-http` will later read it
> to pick SSE vs WS. The `v1.notification.badge` name keeps the `notification`
> segment even though `module: 'identity'` (the badge mutations live in
> identity) — §10.5 allows the documented `notification`→`identity` mapping.

---

## 8. API version + name helpers (`src/meta/api-version.ts`)

```ts
export const API_VERSION = "v1" as const;
export type ApiVersion = typeof API_VERSION;

/** Build/parse versioned names; keeps the `v1.<module>.<op>` convention in one place (common-api §3.1). */
export const callableName = (module: string, op: string) =>
  `${API_VERSION}.${module}.${op}` as const;

/** Split a name into parts for the integrity test (§10.2). */
export function parseCallableName(
  name: string
): { version: string; module: string; op: string } | null {
  const m = /^(v\d+)\.([a-z]+)\.([A-Za-z]+)$/.exec(name);
  return m ? { version: m[1], module: m[2], op: m[3] } : null;
}
```

> `apiVersion` on the registry frame is what lets a future `v2` dual-run during
> migration (common-api §3.1 gap #9). Defs carry their version inside `name`;
> `API_VERSION` is the canonical constant.

---

## 9. Rate tiers + limits (`src/meta/rate-tiers.ts`)

Moved out of the live `error-types.ts` (it is policy config, not error
vocabulary), but co-located here so the limiter, the registry's `rateTier`, and
contract tests share one table (common-api §9).

```ts
import type { RateTier } from "../callable/callable-def";

export interface RateLimitConfig {
  maxPerMinute: number;
  actionType: RateTier;
}

export const RATE_LIMITS: Record<RateTier, RateLimitConfig> = {
  write: { maxPerMinute: 30, actionType: "write" },
  read: { maxPerMinute: 60, actionType: "read" },
  ai: { maxPerMinute: 10, actionType: "ai" },
  auth: { maxPerMinute: 10, actionType: "auth" },
  report: { maxPerMinute: 5, actionType: "report" },
};
```

---

## 10. Contract & lint tests this layer requires (`src/__tests__/`)

### 10.1 THE tenant-id test — `no-tenant-id-in-request.test.ts` (the headline guard)

Asserts **no tenant-scoped request schema declares a `tenantId` field** — the
structural enforcement of `REVIEW` risk #1 / `common-api` §4.4 /
`SDK-SERVER-DESIGN` §7.2. `tenantId` is claim-derived; the only legal tenant id
in a request is the super-admin `tenantOverride` on a def flagged
`allowsTenantOverride`.

```ts
import { describe, it, expect } from "vitest";
import { CALLABLES, CALLABLE_NAMES } from "../callable/registry";
import { z } from "zod";

/** Walk a Zod object schema (incl. nested .data objects) and collect top-level + nested keys. */
function collectKeys(schema: z.ZodTypeAny, depth = 0): string[] {
  const def: any = (schema as any)._def;
  if (def?.typeName === "ZodObject") {
    const shape = def.shape();
    return Object.entries(shape).flatMap(([k, v]) =>
      depth < 2 ? [k, ...collectKeys(v as z.ZodTypeAny, depth + 1)] : [k]
    );
  }
  if (def?.typeName === "ZodOptional" || def?.typeName === "ZodNullable")
    return collectKeys(def.innerType, depth);
  if (def?.typeName === "ZodEffects") return collectKeys(def.schema, depth);
  if (def?.typeName === "ZodDiscriminatedUnion" || def?.typeName === "ZodUnion")
    return (def.options as z.ZodTypeAny[]).flatMap((o) =>
      collectKeys(o, depth)
    );
  return [];
}

describe("no request schema carries tenantId", () => {
  for (const name of CALLABLE_NAMES) {
    const def = CALLABLES[name];
    it(`${name} request has no tenantId field`, () => {
      const keys = collectKeys(def.requestSchema);
      expect(
        keys,
        `${name} leaks tenantId into the request body`
      ).not.toContain("tenantId");
    });

    it(`${name} only carries tenantOverride if allowsTenantOverride`, () => {
      const keys = collectKeys(def.requestSchema);
      if (keys.includes("tenantOverride")) {
        expect(
          def.allowsTenantOverride,
          `${name} has tenantOverride without the flag`
        ).toBe(true);
        expect(def.authMode).not.toBe("public");
      }
    });
  }
});
```

### 10.2 Registry integrity — `registry-integrity.test.ts`

For every entry: (a) `def.name === key`; (b)
`def.module === parseCallableName(key).module` **OR** key's name-segment is the
documented gamification/notification fold (`{notification→identity}` allowed;
gamification name-segments allowed under `levelup`/`analytics`); (c)
`parseCallableName(key)` is non-null and `version === API_VERSION`; (d) request
& response are `ZodObject`/discriminated-union (sanity); (e) **`.strict()`
enforced** — `def.requestSchema.safeParse({ ...minimal, __stray: 1 })` rejects
the stray key (catches an accidental `.passthrough()`, REVIEW D9); (f)
`def.idempotent === true` ⟺ request schema declares an `idempotencyKey` key; (g)
`def.rateTier ∈ RATE_TIERS`, `def.authMode ∈ {authed,public}`; (h) at most one
`authMode:'public'` def (`lookupTenantByCode`); (i) `CALLABLE_NAMES` has no
duplicates (guaranteed by object keys but asserted for the spread-collision case
where two module barrels claim the same name).

### 10.3 Error maps & copy — `error-maps-bijection.test.ts`

(a) `APP_ERROR_TO_HTTPS`, `HTTPS_TO_APP_ERROR`, `ERROR_MESSAGES`,
`ERROR_RECOVERY_HINTS`, `DEFAULT_RETRYABLE` each have **exactly** the
`APP_ERROR_CODES` / `FunctionsErrorCode` key set (no missing, no extra); (b)
every `APP_ERROR_TO_HTTPS` value is a valid `FunctionsErrorCode`; (c) every
`HTTPS_TO_APP_ERROR` value ∈ `APP_ERROR_CODES`; (d) round-trip soundness for the
**canonical** codes (`VALIDATION_ERROR`, `NOT_FOUND`, `PERMISSION_DENIED`,
`UNAUTHENTICATED`, `RATE_LIMITED`, `CONFLICT`):
`HTTPS_TO_APP_ERROR[APP_ERROR_TO_HTTPS[code]] === code`; (e) documents the
intentional many→one non-bijection for the rest (asserts they DON'T round-trip,
so the asymmetry is a tested contract, not an accident); (f)
`ApiErrorDetailsSchema.parse` accepts a representative `ApiErrorDetails` and
rejects an unknown extra key (strict).

### 10.4 Transitions ⊆ enums — `allowed-transitions-enum.test.ts`

For each `entity` in `ALLOWED_TRANSITIONS`: (a) the from-key set equals the
domain status enum's member set (imported `STATUS_VALUES` arrays from
`@levelup/domain`); (b) every to-state in every edge list is a member of that
enum; (c) terminal states (`archived`, `completed`, `released`, …) have `[]`;
(d) `canTransition(entity, from, to)` agrees with the table for a sampled
matrix. The `satisfies TransitionMap<XStatus>` clause is the compile-time half;
this is the runtime half.

### 10.5 Subscriptions integrity — `subscriptions-integrity.test.ts`

Mirror of §10.2 for `SUBSCRIPTIONS`: `def.name === key`; `params`/`payload` are
strict Zod objects; **no `tenantId` in `params`** (reuse `collectKeys`);
`module ∈ API_MODULES`; `source ∈ {firestore-doc,firestore-query,rtdb-node}`;
name segment matches `module` except the allow-listed `notification→identity`
mapping; `SUBSCRIPTION_NAMES` unique.

### 10.6 Pagination — `pagination.test.ts`

`PageRequest.parse({})` → `{ limit: 20 }`; `limit` clamped at min 1 / max 100
(out-of-range rejected); `pageResponse(z.object({id:z.string()}))` accepts
`{items:[],nextCursor:null}` and rejects a missing `nextCursor` and a stray
top-level key; `withPaging` merges paging onto a filter schema and stays strict.

### 10.7 Lint boundary (ESLint, not a unit test)

`eslint.config.js` `no-restricted-imports` forbids every package in §0's
forbidden list. CI runs `eslint` + a `tsc --noEmit` build; an RN-bundle smoke
build (per `SDK-SERVER-DESIGN` §7.2) confirms zero web/node coupling leaked
transitively through this package.

---

## 11. Public barrel (`src/index.ts`) — the export surface

```ts
// callable frame
export type {
  CallableDef,
  ApiModule,
  RateTier,
  AuthMode,
} from "./callable/callable-def";
export {
  API_MODULES,
  RATE_TIERS,
  defineCallable,
} from "./callable/callable-def";
export {
  CALLABLES,
  CALLABLE_NAMES,
  getCallable,
  callablesForModule,
} from "./callable/registry";
export type { CallableName, ReqOf, ResOf } from "./callable/registry";

// error model
export type { AppErrorCode } from "./error/codes";
export { APP_ERROR_CODES, DEFAULT_RETRYABLE } from "./error/codes";
export type {
  ApiErrorDetails,
  ValidationError,
  JsonValue,
} from "./error/details";
export { ApiErrorDetailsSchema, isApiErrorDetails } from "./error/details";
export type { FunctionsErrorCode } from "./error/maps";
export { APP_ERROR_TO_HTTPS, HTTPS_TO_APP_ERROR } from "./error/maps";
export { ERROR_MESSAGES, ERROR_RECOVERY_HINTS } from "./error/copy";

// pagination
export { PageRequest, pageResponse, withPaging } from "./pagination/page";
export type {
  PageRequestInput,
  PageRequestParsed,
  PageResponse,
} from "./pagination/page";

// transitions
export {
  ALLOWED_TRANSITIONS,
  canTransition,
} from "./transitions/allowed-transitions";
export type {
  TransitionMap,
  TransitionEntity,
} from "./transitions/allowed-transitions";

// subscriptions
export { defineSubscription } from "./subscriptions/subscription-def";
export type { SubscriptionDef } from "./subscriptions/subscription-def";
export { SUBSCRIPTIONS, SUBSCRIPTION_NAMES } from "./subscriptions/registry";
export type {
  SubscriptionName,
  ParamsOf,
  PayloadOf,
} from "./subscriptions/registry";

// meta
export {
  API_VERSION,
  callableName,
  parseCallableName,
} from "./meta/api-version";
export type { ApiVersion } from "./meta/api-version";
export { RATE_LIMITS } from "./meta/rate-tiers";
export type { RateLimitConfig } from "./meta/rate-tiers";
```

---

## 12. How the layers above consume this (single-line each)

| Consumer                | Uses                                                                                                                                                                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@levelup/api-client`   | `CALLABLES`/`getCallable` (validate+invoke), `ReqOf`/`ResOf` (types), `ApiErrorDetailsSchema`+`HTTPS_TO_APP_ERROR`+`DEFAULT_RETRYABLE` (`normalizeError`), `idempotent` flag (key generation), `SUBSCRIPTIONS`+`ParamsOf`/`PayloadOf` (subscribe seam) |
| `@levelup/repositories` | `canTransition`/`ALLOWED_TRANSITIONS` (UX pre-checks), `PageResponse`/`pageResponse` (cursor mgmt), `ReqOf`/`ResOf` (method types), `invalidates` (none — that's query)                                                                                |
| `@levelup/query`        | `CallableDef.invalidates` (string roots → key factories), `ResOf`/`ReqOf` (hook types), `ERROR_MESSAGES`/`ERROR_RECOVERY_HINTS` (`useApiError` copy), `SubscriptionName` (`useSubscription`)                                                           |
| `@levelup/realtime`     | `SUBSCRIPTIONS`, `SubscriptionDef`, `ParamsOf`/`PayloadOf`, `source` hint                                                                                                                                                                              |
| `functions/*` (server)  | `CALLABLES`/`callablesForModule` (router + parseRequest schema), `APP_ERROR_TO_HTTPS` (`fail()`), `canTransition` (`assertTransition` enforce), `resyncsClaims` (claim-sync lint), `RATE_LIMITS`+`rateTier` (limiter)                                  |

---

## 13. Build order & migration notes for this layer

1. Scaffold `packages/api-contract` (package.json, tsconfig
   `references: [../domain]`, eslint boundary, vitest).
2. Land `error/` first (self-contained; supersedes
   `shared-types/src/error-types.ts` — codemod
   `VALIDATION_FAILED`→`VALIDATION_ERROR`, add new codes).
3. Land `pagination/`, `meta/` (no upstream coupling beyond `@levelup/domain`
   status enums).
4. Land `callable/callable-def.ts` + `transitions/` (the latter needs
   `@levelup/domain` status enums to exist first — so `@levelup/domain` build
   step #1 of `SDK-SERVER-DESIGN` §8 must precede).
5. Define the four empty `callable/modules/*.ts` barrels; domain plans fill them
   with per-callable defs; `registry.ts` spreads them.
6. Land `subscriptions/` once domain payload schemas (`TestSessionLiveSchema`,
   etc.) exist in `@levelup/domain`.
7. Write `__tests__/` (§10) — these are the durable gate;
   `no-tenant-id-in-request.test.ts` and `registry-integrity.test.ts` run on
   every CI.
8. Delete legacy `shared-types/src/callable-types.ts` interfaces and
   `schemas/callable-schemas.ts` (types now derive via `z.infer`); the only
   remaining hand-written contract artifacts are the per-callable `*Def` files.

**Open items handed to other layers (not blocking this layer):**

- `fail()` (server) and `normalizeError()` (client) import this layer's maps but
  are implemented in `@levelup/functions-shared` / `@levelup/api-client` — keeps
  `api-contract` firebase-free.
- Final closed set of `CALLABLE_NAMES` depends on each domain plan's def list;
  `registry-integrity.test.ts` will fail loudly if a barrel and a def file
  disagree, which is the intended forcing function.
- Exact `ExamStatus`/`SubmissionStatus` members (e.g. dropping unreachable
  `'completed'`, OCR statuses — REVIEW open-Qs) are owned by
  `domains/autograde.md`; `ALLOWED_TRANSITIONS.exam`/`.submission` here update
  in lockstep and the `satisfies` clause enforces consistency at build time.
