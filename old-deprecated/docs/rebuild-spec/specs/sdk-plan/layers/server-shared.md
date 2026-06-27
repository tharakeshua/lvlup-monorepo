# Server-Shared Layer — Full Plan (`@levelup/services` topology + `@levelup/access` + `@levelup/ai` + `@levelup/functions-shared` + repository admin adapter)

> **Domain key:** `server-shared` **Scope:** the server-only packages that sit
> **below** every callable/trigger/scheduler and **above** Firestore. This is
> the layer that makes the server "LEAN-but-AUTHORITATIVE": the four function
> codebases (identity / levelup / autograde / analytics) become thin shells of
> `onCall` adapters + thin trigger/scheduler wrappers, all delegating into
> **transport-agnostic `fn(input, ctx)` services**. **Sources reconciled:**
> `specs/SDK-SERVER-DESIGN.md` §3 (service model, four codebases, AuthContext,
> tenant override), `specs/common-api.md` §4 (auth flow, AuthContext, tenantId
> derivation), §6 (error model + `fail`), §9
> (rate-limit/quota/feature-gate/idempotency/audit),
> `status/REVIEW-domain-data-model.md` §6 (13-item authority boundary), live
> `functions/{identity,levelup,autograde,analytics}/src/{callable,triggers,schedulers,utils}`,
> live `functions/shared/src/{parse-request,rate-limit}`, live
> `packages/shared-services/src/ai/{llm-wrapper,secret-manager,cost-tracker,llm-logger,usage-quota,fallback-handler}`.
>
> **Non-negotiable principles applied (from the parent brief):**
>
> 1. **Logic lives once.** Every callable/trigger/scheduler is a thin shell over
>    `@levelup/services`. No business logic in the function entrypoints.
> 2. **Downward-only deps.** This layer consumes `@levelup/domain` +
>    `@levelup/api-contract` (pure) and nothing above. It NEVER imports
>    `@levelup/api-client`, `@levelup/repositories`, `@levelup/query`, or any
>    app.
> 3. **No direct Firestore anywhere except the repository admin adapter.**
>    `@levelup/repositories-admin` is the ONLY package that imports
>    `firebase-admin/firestore`. Services receive a `Repos` handle through
>    `ctx`; they never `import 'firebase-admin'`.
> 4. **Services never import `firebase-functions`.** A service is
>    `fn(input, ctx: AuthContext): Promise<output>`.
>    `onCall`/`onDocumentWritten`/`onSchedule` are thin adapters in
>    `@levelup/functions-shared` + the four codebases.
> 5. **ALLOWED_TRANSITIONS / error codes / schemas come from
>    `@levelup/api-contract`** — the same source the client uses. Servers
>    re-validate and enforce; clients only pre-check.

---

## 0. Package map (this layer = 5 packages)

| Package                       | Role                                                                                                                                                          | Imports (downward only)                                                                                                 | Platform deps                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `@levelup/functions-shared`   | the `onCall`/trigger/scheduler **adapters**, `buildAuthContext`, `parseRequest`, `fail`, rate-limit, config, outbox + Cloud Tasks helpers, idempotency dedupe | `@levelup/domain`, `@levelup/api-contract`, `@levelup/access`, `@levelup/services`, `@levelup/repositories-admin`       | `firebase-functions`, `firebase-admin`                                   |
| `@levelup/services`           | THE server brain — one `fn(input, ctx)` per capability (~47 callables + all trigger/scheduler use-cases)                                                      | `@levelup/domain`, `@levelup/api-contract`, `@levelup/access`, `@levelup/ai`, `@levelup/repositories-admin` (via `ctx`) | **none** (no `firebase-functions`, no direct `firebase-admin/firestore`) |
| `@levelup/access`             | the ONE `authorize(ctx, action, resource)` policy + permission/staffPermission/role key registries + `assertTransition`                                       | `@levelup/domain`, `@levelup/api-contract`                                                                              | **none**                                                                 |
| `@levelup/ai`                 | LLM provider seam, per-tenant Secret Manager keys, cost/quota/audit, circuit breaker                                                                          | `@levelup/domain`, `@levelup/api-contract`, `@levelup/repositories-admin` (for cost/quota reads/writes)                 | `@google/generative-ai`, `@google-cloud/secret-manager`                  |
| `@levelup/repositories-admin` | THE ONLY direct-Firestore code (Admin SDK). Domain-shaped server repos + batching + transactions + the realtime-source writes                                 | `@levelup/domain`, `@levelup/api-contract`                                                                              | `firebase-admin`                                                         |

**Dependency rule (lint-enforced, §8):** `domain` ← `api-contract` ←
`{access, ai, repositories-admin}` ← `services` ← `functions-shared` ←
`functions/*`. No cycles. `services` may not import `firebase-functions` or
`firebase-admin`; `repositories-admin` is the only place
`firebase-admin/firestore` is allowed.

> **Naming note.** The parent brief calls the admin data layer "the repository
> admin adapter." We package it as `@levelup/repositories-admin` (server twin of
> the client-side `@levelup/repositories`). It exposes the **same conceptual
> repos** but over Admin SDK with transactions/batching, and it is injected into
> services through `ctx.repos`, so services stay Firestore-free.

---

## 1. `@levelup/access` — the ONE authorization policy

### 1.1 File layout

```
packages/access/
  src/
    keys/
      roles.ts            // TenantRole, RoleRank, role predicates
      teacher-permissions.ts   // TeacherPermissionKey union + TEACHER_PERMISSION_KEYS
      staff-permissions.ts     // StaffPermissionKey union + STAFF_PERMISSION_KEYS
      index.ts
    actions.ts            // Action union (every authorize() verb) + ActionResourceMap
    policy.ts             // authorize(), can(), the rule table
    transitions.ts        // assertTransition() over ALLOWED_TRANSITIONS (from api-contract)
    errors.ts             // AccessDenied helper that defers to functions-shared `fail`-shape
    index.ts
  package.json
  tsconfig.json
```

### 1.2 Permission/role/staff-permission keys (the single source the rules-gen + claims + services all share)

```ts
// keys/teacher-permissions.ts  — REVIEW §1: replace stringly-typed Record<string,boolean>
export const TEACHER_PERMISSION_KEYS = [
  "canCreateExams",
  "canEditRubrics",
  "canManuallyGrade",
  "canViewAllExams",
  "canCreateSpaces",
  "canManageContent",
  "canViewAnalytics",
  "canConfigureAgents",
] as const;
export type TeacherPermissionKey = (typeof TEACHER_PERMISSION_KEYS)[number];

// keys/staff-permissions.ts
export const STAFF_PERMISSION_KEYS = [
  "canManageUsers",
  "canManageClasses",
  "canManageBilling",
  "canViewAnalytics",
  "canManageSettings",
  "canExportData",
] as const;
export type StaffPermissionKey = (typeof STAFF_PERMISSION_KEYS)[number];

// keys/roles.ts
export const TENANT_ROLES = [
  "superAdmin",
  "tenantAdmin",
  "teacher",
  "student",
  "parent",
  "staff",
  "scanner",
] as const;
export type TenantRole = (typeof TENANT_ROLES)[number];
export const ROLE_RANK: Record<TenantRole, number>; // superAdmin highest; used for "at least staff" checks
export function isStaffOrAbove(role: TenantRole | null): boolean;
export function isAuthoringRole(role: TenantRole | null): boolean; // teacher | tenantAdmin | staff(content) — gates rubric guidance reads (REVIEW §6.7)
```

> These key unions are **re-exported by `@levelup/domain`** (or live in
> `@levelup/access` and imported by domain — final home is domain so both
> rules-gen and services share them; `@levelup/access` re-exports for
> convenience). The brief lists "permission/staffPermission/role keys" as owned
> here, so canonical declaration is `@levelup/access`, with `@levelup/domain`
> importing them for the membership/claims schemas.

### 1.3 Actions (every `authorize()` verb)

```ts
// actions.ts — exhaustive verb registry; one per authority-sensitive operation
export type Action =
  // identity
  | "tenant.create"
  | "tenant.lifecycle"
  | "tenant.export"
  | "tenant.asset.upload"
  | "user.create"
  | "user.update"
  | "user.bulkImport"
  | "user.bulkStatus"
  | "membership.write"
  | "claims.sync"
  | "tenant.switch"
  | "tenant.join"
  | "class.write"
  | "session.write"
  | "session.rollover"
  | "announcement.write"
  | "notification.read"
  | "notification.markRead"
  | "user.search"
  | "preset.global.write"
  // levelup
  | "space.read"
  | "space.write"
  | "space.publish"
  | "space.archive"
  | "storyPoint.write"
  | "item.write"
  | "item.readForEdit"
  | "version.list"
  | "questionBank.write"
  | "questionBank.read"
  | "questionBank.import"
  | "rubricPreset.write"
  | "testSession.start"
  | "testSession.submit"
  | "answer.evaluate"
  | "itemAttempt.record"
  | "chat.send"
  | "progress.read"
  | "store.list"
  | "store.review"
  | "space.purchase"
  // autograde
  | "exam.read"
  | "exam.write"
  | "exam.publish"
  | "exam.results.release"
  | "questions.extract"
  | "answerSheets.upload"
  | "grade.manual"
  | "grade.retry"
  | "grade.ai"
  | "submission.read"
  | "submission.readReleased"
  // analytics
  | "summary.read"
  | "report.generate"
  | "analytics.child.read"
  | "analytics.trends.read"
  // rubric guidance (the REVIEW §6.7 leak gate)
  | "rubric.guidance.read";

/** Resource descriptor passed to authorize(); fields are optional per-action. */
export interface ResourceRef {
  tenantId?: TenantId; // target tenant (defaults to ctx.tenantId)
  spaceId?: SpaceId;
  examId?: ExamId;
  classId?: ClassId;
  studentId?: StudentId;
  submissionId?: SubmissionId;
  sessionId?: TestSessionId;
  ownerUid?: UserId; // for ownership checks
  scope?: "student" | "class" | "platform" | "health"; // getSummary.scope
}
```

### 1.4 `authorize()` — the single policy entry point

```ts
// policy.ts
export interface AuthorizeResult {
  allowed: true;
} // throws on deny (never returns false)

/**
 * The ONE authority decision. Server-side, AUTHORITATIVE. Throws PERMISSION_DENIED.
 * - super-admin short-circuits (audited at the call site).
 * - tenant-scoped actions assert resource.tenantId === ctx.tenantId (unless super-admin override).
 * - role + permission/staffPermission gating via the rule table.
 * - classId/studentId scoping uses ctx.classIds / ctx.studentIds with overflow fallback already resolved in ctx.
 */
export function authorize(
  ctx: AuthContext,
  action: Action,
  resource?: ResourceRef
): void;

/** Non-throwing variant for "can I show this button" hints that the server itself uses (rare). */
export function can(
  ctx: AuthContext,
  action: Action,
  resource?: ResourceRef
): boolean;

/** The declarative rule table — data, unit-tested for completeness against the Action union. */
export const ACCESS_RULES: Readonly<Record<Action, AccessRule>>;

interface AccessRule {
  roles: readonly TenantRole[] | "any-authed" | "super-admin-only" | "public";
  permission?: TeacherPermissionKey; // teacher granular gate
  staffPermission?: StaffPermissionKey; // staff granular gate
  tenantScoped: boolean; // assert resource.tenantId === ctx.tenantId
  ownershipCheck?: "self" | "class-member" | "linked-child" | "space-enrolled";
  superAdminBypass?: boolean; // default true
}
```

**Authority-boundary wiring (REVIEW §6 → rules):**

- `rubric.guidance.read`, `item.readForEdit` → `roles: authoring`, never
  student/parent (REVIEW §6.7, §7.1.3). Services use these to decide projection.
- `submission.readReleased` vs `submission.read` → parent/student get the
  released-only projection; the **service** picks projection by which action
  passed (the access result drives shaping, REVIEW §6.10).
- `claims.sync`, `membership.write`, `space.purchase`, `exam.results.release`,
  `grade.*` → these are `⚷` actions; `authorize` is mandatory and there is **no
  optimistic client path** (parent brief principle 5).
- `tenant.create`, `preset.global.write`, `user.search` → `super-admin-only`.

### 1.5 `assertTransition` (server ENFORCES the state machines)

```ts
// transitions.ts — reads ALLOWED_TRANSITIONS from @levelup/api-contract (the SAME table the client pre-checks)
import { ALLOWED_TRANSITIONS } from "@levelup/api-contract";

export function assertTransition<E extends keyof typeof ALLOWED_TRANSITIONS>(
  entity: E,
  from: string,
  to: string
): void; // throws fail('INVALID_TRANSITION', ...) if to ∉ ALLOWED_TRANSITIONS[entity][from]

export function canTransition<E extends keyof typeof ALLOWED_TRANSITIONS>(
  entity: E,
  from: string,
  to: string
): boolean;
```

Covers `space` (`draft→published`, `published→{archived,draft}`,
`archived→draft`), `exam`, `submission` pipeline. The throw uses the
`fail`-shape from `functions-shared` (kept decoupled via a thrown `AccessError`
that `functions-shared` maps — see §1.6).

### 1.6 Error decoupling

`@levelup/access` must not import `firebase-functions`. It throws a plain typed
error that `functions-shared` (or the test harness) maps to `HttpsError`:

```ts
// errors.ts
export class AccessError extends Error {
  constructor(
    public code: AppErrorCode,
    message: string,
    public meta?: Record<string, unknown>
  ) {
    super(message);
  }
}
export const denied = (msg: string, meta?) => {
  throw new AccessError("PERMISSION_DENIED", msg, meta);
};
export const invalidTransition = (msg: string, meta?) => {
  throw new AccessError("INVALID_TRANSITION", msg, meta);
};
```

`AppErrorCode` is imported from `@levelup/api-contract`.

---

## 2. `@levelup/functions-shared` — the thin adapter layer

> This package is the **only** one in `services`-and-below that imports
> `firebase-functions`. It turns the trust boundary into ~10 lines per
> entrypoint. The four codebases import ONLY from here + `@levelup/services`.

### 2.1 File layout

```
packages/functions-shared/
  src/
    context/
      build-auth-context.ts   // claims → AuthContext, overflow fallback, super-admin tenantOverride
      auth-context.ts         // AuthContext type + Ctx assembly (clock, repos, ai injection)
    adapters/
      on-call.ts              // makeCallable(def, service) — the thin onCall shell
      on-document.ts          // makeTrigger(...) — thin Firestore trigger shell
      on-schedule.ts          // makeScheduler(...) — thin scheduler shell
      on-task.ts              // makeTaskHandler(...) — Cloud Tasks queue consumer shell
    request/
      parse-request.ts        // Zod boundary parse → fail('VALIDATION_ERROR')
      fail.ts                 // fail(code,msg,extra) + APP_ERROR_TO_HTTPS map application
      map-error.ts            // AccessError / ZodError / unknown → HttpsError(ApiErrorDetails)
    limits/
      rate-limit.ts           // enforceRateLimit by rateTier (from def)
      feature-gate.ts         // assertFeatureEnabled
      quota.ts                // assertQuota (resource counts)
    idempotency/
      dedupe.ts               // idempotency key dedupe on (uid, key)
    outbox/
      outbox.ts               // enqueueOutbox() + outbox record shape
      cloud-tasks.ts          // enqueueTask() / pipeline-advance enqueue
    audit/
      audit.ts                // writeAudit() best-effort
    config/
      config.ts               // REGION, project, queue names, secret patterns
    index.ts
  package.json
  tsconfig.json
```

### 2.2 `AuthContext` + `buildAuthContext` (claims → ctx; the heart of the trust boundary)

```ts
// context/auth-context.ts
export interface AuthContext {
  uid: UserId;
  isSuperAdmin: boolean;
  tenantId: TenantId | null; // from claims (active tenant) — NEVER from request body (REVIEW D2/#1)
  role: TenantRole | null;
  permissions: Partial<Record<TeacherPermissionKey, boolean>> | null;
  staffPermissions: Partial<Record<StaffPermissionKey, boolean>> | null;
  classIds: ClassId[]; // overflow-resolved (see fallback below)
  studentIds: StudentId[]; // parent → linked children
  entityIds: {
    teacherId?: TeacherId;
    studentId?: StudentId;
    parentId?: ParentId;
    staffId?: StaffId;
    scannerId?: ScannerId;
  };
  idempotencyKey?: string;
  now: () => Timestamp; // injected clock — server-authoritative, testable (ISO-8601 string)
  repos: Repos; // injected admin repos (§5); services touch Firestore ONLY through this
  ai: AiGateway; // injected AI gateway (§4); services call LLMs ONLY through this
}
```

```ts
// context/build-auth-context.ts
import type { CallableRequest } from "firebase-functions/v2/https";

export interface BuildCtxOptions {
  tenantOverride?: TenantId; // honored ONLY if isSuperAdmin (audited)
  idempotencyKey?: string;
  repos: Repos; // injected (the admin adapter)
  ai: AiGateway;
  clock?: () => Timestamp; // default () => new Date().toISOString() — overridable in tests
}

export async function buildAuthContext(
  auth: CallableRequest["auth"] | undefined,
  opts: BuildCtxOptions
): Promise<AuthContext>;
```

Behavior:

1. `if (!auth) throw fail('UNAUTHENTICATED', ...)` (public callables skip via
   `def.authMode === 'public'`, which builds an _anonymous ctx_ with
   `uid='<public>'`, `tenantId=null`).
2. Reads `token: PlatformClaims` (from `@levelup/domain`). Promotes
   `isSuperAdmin` from a **claim** (REVIEW §8: no `get()` on `/users`).
3. `tenantId = isSuperAdmin && opts.tenantOverride ? opts.tenantOverride : token.tenantId ?? null`.
   The override is honored ONLY when super-admin; **every other caller's
   tenantId is the claim, full stop** (parent brief principle 4).
4. **Overflow fallback:** if `token.classIdsOverflow === true`,
   `classIds = await opts.repos.memberships.getManagedClassIds(uid, tenantId)`
   (reads the membership doc — REVIEW §1 `MAX_CLAIM_CLASS_IDS=15`). Otherwise
   `classIds = token.classIds ?? []`.
5. `studentIds = token.studentIds ?? []` (parent linked children).
6. `now = opts.clock ?? (() => new Date().toISOString())`.
7. Injects `repos` + `ai` so the service never imports them directly.
8. When `tenantOverride` is used, sets a flag the `onCall` adapter reads to
   `writeAudit('tenantOverride', ...)`.

### 2.3 The `onCall` adapter — `makeCallable` (the entire wire→service shell)

```ts
// adapters/on-call.ts
import { onCall } from "firebase-functions/v2/https";
import type { CallableName } from "@levelup/api-contract";
import { CALLABLES } from "@levelup/api-contract";

export function makeCallable<N extends CallableName>(
  name: N,
  service: (input: ReqOf<N>, ctx: AuthContext) => Promise<ResOf<N>>
) {
  const def = CALLABLES[name];
  return onCall(
    { region: REGION, cors: true /* concurrency, memory from def hints */ },
    async (request): Promise<ResOf<N>> => {
      try {
        const ctx = await buildAuthContext(request.auth, {
          tenantOverride: extractTenantOverride(
            request.data /*isSuperAdmin gate inside*/
          ),
          idempotencyKey: request.data?.idempotencyKey,
          repos: getRepos(),
          ai: getAi(),
        });
        if (def.authMode === "authed" && !ctx.uid)
          throw new AccessError("UNAUTHENTICATED", "...");
        await enforceRateLimit(ctx, def.rateTier); // §2.5
        const input = parseRequest(request.data, def.requestSchema); // §2.4 — strips/rejects tenantId field (none exists)
        if (def.idempotent && ctx.idempotencyKey) {
          const cached = await dedupe.begin(ctx, name); // §2.7
          if (cached) return cached as ResOf<N>;
        }
        const res = await service(input, ctx);
        if (def.idempotent && ctx.idempotencyKey)
          await dedupe.commit(ctx, name, res);
        if (process.env.VALIDATE_RESPONSES) def.responseSchema.parse(res); // dev contract gate
        return res;
      } catch (e) {
        throw mapError(e); // §2.6 → HttpsError(ApiErrorDetails)
      }
    }
  );
}
```

This is the canonical "thin shell." **Every one of the ~47 callables** in the
four codebases is one line:
`export const saveSpace = makeCallable('v1.levelup.saveSpace', saveSpaceService);`.

### 2.4 `parseRequest` (Zod boundary — lifted/generalized from live `functions/shared`)

```ts
// request/parse-request.ts
export function parseRequest<T>(data: unknown, schema: ZodType<T>): T;
// on failure → throw new AccessError('VALIDATION_ERROR', msg, { validationErrors: [{path,message}] })
```

Replaces the live `functions/shared/src/parse-request.ts` (which throws
`HttpsError` directly). Now it throws the transport-neutral `AccessError`; only
`mapError` produces `HttpsError`. Schemas are `.strict()` so a stray `tenantId`
field is **rejected** (contract test §8 asserts no tenant-scoped req schema
declares `tenantId`).

### 2.5 `fail` + error mapping (the §6 error model)

```ts
// request/fail.ts
export function fail(
  code: AppErrorCode,
  message: string,
  extra?: Partial<ApiErrorDetails>
): never;
// throws AccessError carrying ApiErrorDetails; functions-shared owns the HttpsError translation.

// request/map-error.ts
export function mapError(e: unknown): HttpsError;
// AccessError → HttpsError(APP_ERROR_TO_HTTPS[code], message, ApiErrorDetails{code,message,validationErrors,retryable,meta})
// ZodError    → VALIDATION_ERROR
// known firebase errors passthrough; unknown → INTERNAL (no leak of internals)
```

`AppErrorCode`, `ApiErrorDetails`, `APP_ERROR_TO_HTTPS`, `HTTPS_TO_APP_ERROR`
all imported from `@levelup/api-contract` (common-api §6.1).

### 2.6 Rate limit / feature gate / quota (the §9 pipeline)

```ts
// limits/rate-limit.ts — keyed by ctx + def.rateTier (replaces per-codebase rate-limit.ts copies)
export async function enforceRateLimit(
  ctx: AuthContext,
  tier: RateTier
): Promise<void>;
export const RATE_TIER_LIMITS: Record<RateTier, { perMinute: number }>; // write|read|ai|auth|report
// limits/feature-gate.ts
export async function assertFeatureEnabled(
  ctx: AuthContext,
  feature: keyof TenantFeatures
): Promise<void>;
// limits/quota.ts
export async function assertQuota(
  ctx: AuthContext,
  resource: "student" | "teacher" | "space" | "exam",
  batchSize?: number
): Promise<void>;
```

These read counts via `ctx.repos.tenants.get(...)` — **not** direct Firestore
(consolidating the live `identity/utils/{feature-gate,quota}.ts` + the three
duplicated `rate-limit.ts` files into one). `RateTier` from
`@levelup/api-contract`.

### 2.7 Idempotency dedupe (the §5.4 server half)

```ts
// idempotency/dedupe.ts
export const dedupe = {
  begin(ctx, name): Promise<ResOf | null>;   // returns cached response if (uid,key) already committed; else marks in-flight
  commit(ctx, name, res): Promise<void>;      // stores response keyed (uid, idempotencyKey)
};
```

Stored via `ctx.repos.idempotency.*` under
`tenants/{t}/idempotency/{uid}_{key}`. Mandatory for `createOrgUser`,
`bulkImport*`, `submitTestSession`, `recordItemAttempt`, `evaluateAnswer`,
`uploadAnswerSheets`, `purchaseSpace`.

### 2.8 Outbox + Cloud Tasks (the reliable side-effect + multi-step pipeline pattern)

```ts
// outbox/outbox.ts — transactional outbox for MUST-DELIVER side effects (replaces fire-and-forget .catch(log))
export interface OutboxRecord {
  id: string;
  type: OutboxEventType;
  tenantId: TenantId;
  payload: JsonValue;
  createdAt: Timestamp;
  status: "pending" | "delivered" | "failed";
  attempts: number;
}
export function enqueueOutbox(
  tx: TxHandle,
  rec: Omit<OutboxRecord, "id" | "status" | "attempts">
): void;
// written INSIDE the same transaction as the state change → atomic. A drain trigger/scheduler delivers.

// outbox/cloud-tasks.ts — single-writer, multi-step orchestration (autograde grading pipeline)
export async function enqueueTask<P>(
  queue: QueueName,
  handler: TaskName,
  payload: P,
  opts?: { scheduleDelaySec?: number; dedupeId?: string }
): Promise<void>;
export async function enqueuePipelineAdvance(
  submissionId: SubmissionId,
  step: PipelineStep
): Promise<void>;
```

**Pipeline-advance pattern (autograde):** `advancePipeline` is a **single-writer
reducer** consumed by a Cloud Tasks queue. Each step service does its work,
writes its projection, then `enqueuePipelineAdvance(submissionId, nextStep)` —
idempotent (the dedupe id is `(submissionId, step)`), so retries never
double-grade. `makeTaskHandler` (below) is the consumer shell.

### 2.9 Trigger / scheduler / task adapters (keep them thin)

```ts
// adapters/on-document.ts
export function makeTrigger<E>(
  ref: {
    document: string;
    eventType: "created" | "updated" | "deleted" | "written";
  },
  service: (event: TriggerEvent<E>, ctx: SystemContext) => Promise<void>
): CloudFunction;

// adapters/on-schedule.ts
export function makeScheduler(
  schedule: string, // cron
  service: (ctx: SystemContext) => Promise<void>
): CloudFunction;

// adapters/on-task.ts
export function makeTaskHandler<P>(
  queue: QueueName,
  service: (payload: P, ctx: SystemContext) => Promise<void>
): CloudFunction;
```

`SystemContext` is an `AuthContext` variant with `uid='<system>'`,
`isSuperAdmin=true`-equivalent authority **scoped to the triggering tenant**,
the injected `now/repos/ai`, but **no rate-limit/quota** (system actor).
Triggers/schedulers delegate 100% into `@levelup/services`; the entrypoint files
in `functions/*/src/triggers` become one-liners:
`export const onSpacePublished = makeTrigger({...}, onSpacePublishedService);`.

### 2.10 Audit + config

```ts
// audit/audit.ts
export async function writeAudit(
  ctx: AuthContext,
  action: string,
  target: { type: string; id: string },
  meta?: JsonValue
): Promise<void>;
// best-effort, non-blocking, ONE collection tenants/{t}/auditLogs (fix the auditLogs/auditLog split — common-api §9)

// config/config.ts
export const REGION = "asia-south1"; // single source (was hardcoded per file)
export const QUEUES = {
  gradingPipeline: "grading-pipeline",
  studentRollup: "student-rollup",
  outboxDrain: "outbox-drain",
} as const;
export const secretNameFor = (tenantId: TenantId) =>
  `tenant-${tenantId}-gemini`;
```

---

## 3. `@levelup/services` — the server brain (`fn(input, ctx)` topology)

> One file per capability, grouped by the four bounded contexts. **No file
> imports `firebase-functions` or `firebase-admin`.** All data access is
> `ctx.repos.*`; all LLM access is `ctx.ai.*`; all authority is
> `authorize(ctx, ...)`; all transitions are `assertTransition(...)`; all clock
> reads are `ctx.now()`.

### 3.1 File layout (mirrors the four codebases, deploy-independent)

```
packages/services/
  src/
    identity/
      save-tenant.ts          deactivate-tenant.ts  reactivate-tenant.ts
      export-tenant-data.ts   upload-tenant-asset.ts
      save-student.ts save-teacher.ts save-parent.ts save-staff.ts
      save-class.ts save-academic-session.ts
      create-org-user.ts      switch-active-tenant.ts  join-tenant.ts
      bulk-import-students.ts bulk-import-teachers.ts bulk-update-status.ts rollover-session.ts
      manage-notifications.ts save-announcement.ts list-announcements.ts
      search-users.ts         save-global-evaluation-preset.ts
      lookup-tenant-by-code.ts                       // public
      provision-membership.ts // shared factory (REVIEW §1) — used by save*/createOrgUser/joinTenant
      sync-membership-claims.ts // the single claim-sync primitive (common-api §4.5)
      triggers/ { before-user-created.ts, before-sign-in.ts, on-membership-written.ts, on-user-created.ts, on-user-deleted.ts, on-class-deleted.ts, on-student-deleted.ts, on-tenant-deactivated.ts }
      schedulers/ { tenant-lifecycle.ts, usage-reset.ts, cleanup-expired-exports.ts }
    levelup/
      save-space.ts save-story-point.ts save-item.ts get-item-for-edit.ts list-versions.ts
      start-test-session.ts submit-test-session.ts evaluate-answer.ts record-item-attempt.ts
      save-question-bank-item.ts list-question-bank.ts import-from-bank.ts save-rubric-preset.ts
      send-chat-message.ts save-space-review.ts list-store-spaces.ts purchase-space.ts
      list-spaces.ts get-space.ts list-story-points.ts list-items.ts
      get-space-progress.ts get-story-point-progress.ts
      progress-updater.ts     // the ONE transactional progress writer (single-writer; REVIEW §6.9)
      resolve-rubric.ts       // resolve-and-store-at-write (effectiveRubric snapshot + rubricId; REVIEW §2)
      triggers/ { on-space-published.ts, on-space-deleted.ts, on-test-session-expired.ts, cleanup-stale-sessions.ts, cleanup-inactive-chats.ts }
    autograde/
      save-exam.ts extract-questions.ts upload-answer-sheets.ts grade-question.ts
      list-exams.ts get-exam.ts list-submissions.ts get-submission.ts list-question-submissions.ts
      release-results.ts
      pipeline/ { advance-pipeline.ts, process-answer-mapping.ts, process-answer-grading.ts, finalize-submission.ts }
      triggers/ { on-exam-published.ts, on-exam-deleted.ts, on-submission-created.ts, on-question-submission-updated.ts, on-results-released.ts }
      schedulers/ { stale-submission-watchdog.ts }
    analytics/
      get-summary.ts generate-report.ts get-performance-trends.ts get-child-summary.ts list-linked-children.ts
      recompute-student-rollup.ts  // queue-driven single-writer projection
      triggers/ { on-exam-results-released.ts, on-submission-graded.ts, on-space-progress-updated.ts, on-student-summary-updated.ts, on-progress-milestone.ts, on-user-story-point-progress-write.ts, update-leaderboard.ts }
      schedulers/ { daily-cost-aggregation.ts, generate-insights.ts, nightly-at-risk-detection.ts }
    shared/
      projections.ts          // role-aware response shaping (released-only vs full; guidance strip)
      side-effects.ts         // outbox event builders (notification, version, store-mirror)
    index.ts                  // barrel: every service exported by name
  package.json
  tsconfig.json
```

### 3.2 The service signature convention (every export)

```ts
export async function saveSpaceService(
  input: ReqOf<"v1.levelup.saveSpace">,
  ctx: AuthContext
): Promise<ResOf<"v1.levelup.saveSpace">> {
  authorize(ctx, input.id ? "space.write" : "space.write", {
    spaceId: input.id,
  });
  if (input.data.status) {
    const current = await ctx.repos.spaces.get(ctx.tenantId!, input.id!);
    authorize(ctx, "space.publish", { spaceId: input.id });
    assertTransition("space", current.status, input.data.status); // server ENFORCES
    if (input.data.status === "published") validatePublish(current); // ≥1 storyPoint, ≥1 item, duration>0
  }
  const { id, created } = await ctx.repos.spaces.upsert(
    ctx.tenantId!,
    input,
    ctx.now()
  );
  await ctx.repos.tx(async (tx) => {
    // reliable side effect
    enqueueOutbox(tx, {
      type: "space.published",
      tenantId: ctx.tenantId!,
      payload: { spaceId: id },
    });
  });
  return { id, created };
}
```

This pattern repeats for all ~47. **`tenantId` always comes from `ctx`, never
`input`.** The same `saveSpaceService` is callable from the future REST gateway
(builds the same ctx) — one set of services backs web + RN + REST (SDK-SERVER
§3.1).

### 3.3 Notable service exports (by codebase) — every one is `fn(input, ctx)` of kind `service`

- **identity:** `saveTenantService`, `deactivateTenantService`,
  `reactivateTenantService`, `exportTenantDataService`,
  `uploadTenantAssetService`, `saveStudentService`, `saveTeacherService`,
  `saveParentService`, `saveStaffService`, `saveClassService`,
  `saveAcademicSessionService`, `createOrgUserService`,
  `switchActiveTenantService`, `joinTenantService`, `bulkImportStudentsService`,
  `bulkImportTeachersService`, `bulkUpdateStatusService`,
  `rolloverSessionService`, `manageNotificationsService`,
  `saveAnnouncementService`, `listAnnouncementsService`, `searchUsersService`,
  `saveGlobalEvaluationPresetService`, `lookupTenantByCodeService` _(public)_,
  plus the two **primitives** `provisionMembership(membershipInput, ctx)` and
  `syncMembershipClaims(uid, tenantId, ctx)` (Admin-SDK claim mint via
  `ctx.repos.claims.set`).
- **levelup:** `saveSpaceService`, `saveStoryPointService`, `saveItemService`
  (strips answer keys → server-only subcollection via `ctx.repos.answerKeys`),
  `getItemForEditService` (re-merges keys; gated `item.readForEdit`;
  non-persisted cache contract on the client), `listVersionsService`,
  `startTestSessionService`, `submitTestSessionService`, `evaluateAnswerService`
  (persists progress server-side → no second client call),
  `recordItemAttemptService`, `saveQuestionBankItemService`,
  `listQuestionBankService`, `importFromBankService`, `saveRubricPresetService`,
  `sendChatMessageService`, `saveSpaceReviewService`, `listStoreSpacesService`,
  `purchaseSpaceService` (⚷ only writer of `consumerProfile`),
  `listSpacesService`, `getSpaceService`, `listStoryPointsService`,
  `listItemsService`, `getSpaceProgressService`, `getStoryPointProgressService`.
  Internal: `updateProgress(tx, ...)` (single transactional writer),
  `resolveRubric(...)` (resolve-and-store snapshot).
- **autograde:** `saveExamService`, `extractQuestionsService` (AI),
  `uploadAnswerSheetsService` (single canonical ingestion;
  `uploadSource: web|scanner|rn`; server creates submission),
  `gradeQuestionService` (`mode: manual|retry|ai`), `releaseResultsService`,
  `listExamsService`, `getExamService`, `listSubmissionsService`,
  `getSubmissionService`, `listQuestionSubmissionsService` (released-only vs
  full projection). Pipeline steps (task-driven): `advancePipelineService`,
  `processAnswerMappingService`, `processAnswerGradingService`,
  `finalizeSubmissionService`.
- **analytics:** `getSummaryService` (`scope: student|class|platform|health`),
  `generateReportService` (`type`), `getPerformanceTrendsService`,
  `getChildSummaryService`, `listLinkedChildrenService`,
  `recomputeStudentRollupService` (queue single-writer).
- **trigger/scheduler services** (all `(event|ctx)`): every file under
  `*/triggers` and `*/schedulers` above is a `service` export consumed by
  `makeTrigger`/`makeScheduler`/`makeTaskHandler`.

### 3.4 Async invariants enforced in this package (parent brief principle 4)

- **Single-writer per derived value:** `progress-updater` is the only writer of
  progress; `recomputeStudentRollup` the only writer of rollups;
  `advancePipeline` the only writer of pipeline status. Triggers that would race
  are funneled into these.
- **Idempotent handlers:** every trigger/task service is safe to re-run (keyed
  by event id / `(submissionId, step)`).
- **Command-vs-projection split:** services that change state (commands) emit
  outbox/queue events; projection services (`recompute*`, `update-leaderboard`,
  summary recompute) consume them and never re-trigger commands.
- **Outbox for must-deliver:** notifications, content versions, store-listing
  mirror — written in-transaction, drained reliably.
- **Cloud Tasks for multi-step:** the grading pipeline
  (`uploadAnswerSheets → mapping → grading → finalize → releaseResults`).

---

## 4. `@levelup/ai` — the LLM provider seam + secrets + cost/quota

> Consolidates the live `packages/shared-services/src/ai/*` +
> `functions/autograde/src/utils/{llm,secret-manager,grading-queue}.ts` +
> `functions/levelup` prompts wiring into ONE injected gateway. Services call
> `ctx.ai.generate(...)`; they never construct a provider or read a secret.

### 4.1 File layout

```
packages/ai/
  src/
    gateway.ts            // createAiGateway() → AiGateway (the injected seam)
    provider/
      provider.ts         // LLMProvider interface (the seam; Gemini is one impl)
      gemini.ts           // GeminiProvider (@google/generative-ai)
    secrets/
      secret-manager.ts   // getApiKey(tenantId) via GCP Secret Manager (per-tenant)
    cost/
      cost-tracker.ts     // estimateCost, buildTokenUsage
      llm-logger.ts       // logLLMCall → llmCallLogs (audit)
      usage-quota.ts      // checkUsageQuota(tenantId) — monthly budget + daily call cap
    reliability/
      fallback-handler.ts // circuit breaker (classifyError, recordSuccess/Failure, isCircuitOpen)
      retry.ts            // exponential backoff
    prompts/
      registry.ts         // PROMPTS registry (evaluator, tutor, extraction, panopticon, relms)
    index.ts
  package.json
  tsconfig.json
```

### 4.2 The gateway seam (what services see)

```ts
// gateway.ts
export interface AiGateway {
  /** One call: resolves per-tenant key, checks quota, runs provider, logs cost, applies circuit breaker. */
  generate(req: AiRequest, ctx: AiCallContext): Promise<AiResponse>;
}
export interface AiRequest {
  purpose:
    | "question_extraction"
    | "answer_mapping"
    | "answer_grading"
    | "ai_chat"
    | "insights";
  operation: string; // e.g. 'relmsEvaluation'
  promptKey: keyof typeof PROMPTS; // from prompts/registry
  variables: Record<string, JsonValue>;
  images?: { base64: string; mimeType: string }[];
  responseSchema?: JsonSchema; // structured output
  model?: string;
  temperature?: number;
  maxTokens?: number;
}
export interface AiCallContext {
  tenantId: TenantId;
  uid: UserId;
  role: string;
  resourceType: string;
  resourceId: string;
}
export interface AiResponse<T = unknown> {
  data: T;
  tokenUsage: TokenUsage;
  cost: CostBreakdown;
  model: string;
}

export function createAiGateway(deps: {
  repos: Repos;
  projectId?: string;
}): AiGateway;
```

### 4.3 Provider seam (Gemini today, pluggable)

```ts
// provider/provider.ts
export interface LLMProvider {
  readonly name: "gemini";
  call(input: ProviderInput): Promise<ProviderOutput>;
}
// provider/gemini.ts
export function createGeminiProvider(
  apiKey: string,
  opts?: GeminiOpts
): LLMProvider;
```

### 4.4 Per-tenant secrets + cost/quota

```ts
// secrets/secret-manager.ts
export async function getApiKey(
  tenantId: TenantId,
  projectId?: string
): Promise<string>; // Secret Manager `tenant-{id}-gemini`; never in client bundle; env override for emulator
// cost/usage-quota.ts
export async function checkUsageQuota(
  repos: Repos,
  tenantId: TenantId
): Promise<QuotaCheckResult>; // monthly budget + daily cap; throws QUOTA_EXCEEDED via AccessError
// cost/cost-tracker.ts
export function estimateCost(usage: TokenUsage, model: string): CostBreakdown;
// cost/llm-logger.ts
export async function logLLMCall(
  repos: Repos,
  params: LogLLMCallParams
): Promise<void>; // → llmCallLogs (cost rollup source)
```

The gateway sequence inside `generate()`:
`checkUsageQuota → isCircuitOpen guard → getApiKey → provider.call (with retry) → recordSuccess/Failure → estimateCost → logLLMCall`.
**All AI cost is server-computed and audited** (REVIEW §6: AI keys/cost never in
client).

> **Direct-Firestore note:** `usage-quota`/`llm-logger`/`cost` read+write
> Firestore. Per principle 3 they go through `ctx.repos` (the admin adapter),
> NOT `firebase-admin` directly. The live versions import `firebase-admin`; the
> rebuild routes them through `repos.llm.*` / `repos.tenants.*`.

---

## 5. `@levelup/repositories-admin` — THE ONLY direct-Firestore code

> Server twin of the client `@levelup/repositories`. Same conceptual repos, but
> Admin SDK with transactions, batching, N+1 collapse, and the authoritative
> writes (claims, answer keys, progress, counters). Injected into every
> `ctx.repos`. **This is the single package permitted to import
> `firebase-admin/firestore`** (lint-enforced, §8).

### 5.1 File layout

```
packages/repositories-admin/
  src/
    client.ts             // getFirestore() singleton + Timestamp<->ISO edge adapters
    tx.ts                 // tx(fn) wrapper, TxHandle, batched writer
    paths.ts              // tenant-scoped path builders (ONLY place collection paths live)
    converters/           // FirestoreDataConverter per entity (ISO<->Timestamp, brand-strip on write)
    repos/
      tenants.ts users.ts memberships.ts claims.ts        // identity authority
      students.ts teachers.ts parents.ts staff.ts classes.ts sessions.ts announcements.ts notifications.ts
      spaces.ts story-points.ts items.ts answer-keys.ts   // answer-keys = server-only subcollection
      progress.ts test-sessions.ts question-bank.ts rubric-presets.ts chat.ts store.ts reviews.ts versions.ts
      exams.ts submissions.ts question-submissions.ts evaluation-settings.ts dlq.ts
      analytics.ts summaries.ts cost-summaries.ts insights.ts llm.ts leaderboard.ts
      idempotency.ts outbox.ts audit.ts rate-limits.ts
    index.ts              // createRepos() → Repos
  package.json
  tsconfig.json
```

### 5.2 The `Repos` handle + a representative repo

```ts
// index.ts
export function createRepos(): Repos;
export interface Repos {
  tx<T>(fn: (tx: TxHandle) => Promise<T>): Promise<T>;
  tenants: TenantRepo;
  users: UserRepo;
  memberships: MembershipRepo;
  claims: ClaimsRepo;
  students: StudentRepo;
  /* … */ spaces: SpaceRepo;
  items: ItemRepo;
  answerKeys: AnswerKeyRepo;
  progress: ProgressRepo;
  testSessions: TestSessionRepo;
  exams: ExamRepo;
  submissions: SubmissionRepo;
  questionSubmissions: QuestionSubmissionRepo;
  summaries: SummaryRepo;
  costSummaries: CostSummaryRepo;
  llm: LlmRepo;
  leaderboard: LeaderboardRepo;
  idempotency: IdempotencyRepo;
  outbox: OutboxRepo;
  audit: AuditRepo;
}

export interface SpaceRepo {
  get(tenantId: TenantId, id: SpaceId): Promise<Space>;
  list(
    tenantId: TenantId,
    filter: SpaceFilter,
    page: PageRequest
  ): Promise<Page<Space>>; // cursor-encoded server-side
  upsert(
    tenantId: TenantId,
    input: SaveSpaceInput,
    now: Timestamp
  ): Promise<{ id: SpaceId; created: boolean }>;
}
export interface MembershipRepo {
  get(uid: UserId, tenantId: TenantId): Promise<UserMembership | null>;
  getManagedClassIds(uid: UserId, tenantId: TenantId): Promise<ClassId[]>; // overflow fallback for buildAuthContext
  upsert(tx: TxHandle, m: UserMembership): void;
}
export interface ClaimsRepo {
  set(uid: UserId, claims: PlatformClaims): Promise<void>; // Admin Auth setCustomUserClaims (⚷ mint)
  revokeRefreshTokens(uid: UserId): Promise<void>; // lifecycle/role change
}
export interface AnswerKeyRepo {
  // ⚷ server-only subcollection (REVIEW §6.4)
  put(tx: TxHandle, itemId: ItemId, key: AnswerKey): void;
  get(itemId: ItemId): Promise<AnswerKey | null>; // grade-time + getItemForEdit only
}
```

### 5.3 Responsibilities

- **Timestamp edge adapter:** converts the domain ISO-8601 `Timestamp` ↔
  Firestore `Timestamp` at the boundary (REVIEW D4 — kills the trichotomy;
  domain stays pure ISO).
- **Brand strip on write / brand on read** via converters (REVIEW D8 — brands
  live in domain, bare strings in Firestore).
- **Cursor management:** opaque base64 cursors encoded/decoded here; services +
  clients never see raw snapshots (common-api §7).
- **Batching / N+1 collapse:** `getMany`, batched membership fetch for
  `searchUsers`, batched child summaries for `listLinkedChildren` (REVIEW
  super-admin/parent N+1).
- **Single-canonical paths:** `paths.ts` resolves the dual item-path drift
  (REVIEW D1) to ONE nested path; the rest of the system is path-agnostic.
- **Transactions:** `tx()` gives services a `TxHandle` for atomic state-change +
  outbox writes.

---

## 6. How the four codebases stay thin (deploy-independent)

Each `functions/<m>/src/index.ts` becomes a barrel of one-liners:

```ts
// functions/levelup/src/index.ts
import {
  makeCallable,
  makeTrigger,
  makeScheduler,
} from "@levelup/functions-shared";
import * as S from "@levelup/services";

export const saveSpace = makeCallable(
  "v1.levelup.saveSpace",
  S.saveSpaceService
);
export const submitTestSession = makeCallable(
  "v1.levelup.submitTestSession",
  S.submitTestSessionService
);
export const onSpacePublished = makeTrigger(
  { document: "tenants/{t}/spaces/{id}", eventType: "updated" },
  S.onSpacePublishedService
);
export const expireTestSessions = makeScheduler(
  "every 5 minutes",
  S.expireTestSessionsService
);
// … one line per callable/trigger/scheduler
```

- **No business logic** in any `functions/*` file — only wiring. The four
  codebases share NOTHING at runtime except the npm packages, so they stay
  independently deployable (SDK-SERVER §3.3).
- **Codebase boundaries match the api-contract `module` field**: a contract test
  asserts `CALLABLES[name].module` equals the codebase a callable is wired in
  (no cross-module leak like the live `callSaveSpace` exported from `auth`).
- **Triggers/schedulers** import only `@levelup/functions-shared` +
  `@levelup/services` — same thin rule.

---

## 7. End-to-end trace (recap, server half)

```
[onCall v1.levelup.saveSpace]  (functions/levelup, 1 line)
  → makeCallable:
      ctx = buildAuthContext(auth, {repos, ai})      // tenantId/role/perms/classIds FROM CLAIMS
      enforceRateLimit(ctx, 'write')
      input = parseRequest(data, SaveSpaceRequestSchema)   // .strict(): no tenantId field exists
      [idempotency dedupe if def.idempotent]
      res = saveSpaceService(input, ctx)             // @levelup/services
      [response validate in dev]
  → saveSpaceService(input, ctx):
      authorize(ctx, 'space.publish', {spaceId})     // @levelup/access (AUTHORITATIVE)
      assertTransition('space', from, 'published')   // server ENFORCES (api-contract data)
      validatePublish(space)
      ctx.repos.tx(tx => { spaces.upsert(...); enqueueOutbox(tx, 'space.published') })  // atomic + reliable
      return { id, created:false }
  → outbox-drain → onSpacePublished notification (reliable, retried)
  → mapError on any throw → HttpsError(ApiErrorDetails{code,...})
```

---

## 8. Contract + lint tests this layer requires

**Lint (no-restricted-imports / dependency-cruiser):**

1. `@levelup/services` may NOT import `firebase-functions` or `firebase-admin/*`
   (only via `ctx`).
2. ONLY `@levelup/repositories-admin` may import `firebase-admin/firestore`.
3. `@levelup/access` and `@levelup/api-contract`/`@levelup/domain` may NOT
   import any of `firebase-*`, `react`, DOM.
4. No package imports a layer above it (services↛functions-shared, etc.);
   enforced by package boundary lint.
5. No service file references `input.tenantId` (tenant comes from `ctx`) —
   custom lint rule.

**Contract tests (emulator):** 6. **Every `CALLABLES[name]` has a wired
`makeCallable` in exactly one codebase**, and `def.module` matches that
codebase. 7. **No tenant-scoped request schema declares a `tenantId` field**
(REVIEW #1 / top-risk-1) — iterate `CALLABLES`, assert schema shape has no
`tenantId` key except where `tenantOverride` is explicitly allowed (super-admin
defs). 8. **`authorize()` coverage:** `ACCESS_RULES` has an entry for every
`Action`; every `⚷` callable's service calls `authorize` before any write
(static check + emulator test that an unauthorized ctx is rejected). 9.
**`assertTransition` matches `ALLOWED_TRANSITIONS`:** every transition the
services attempt is in the contract table; status union members match (REVIEW
open-Q #4). 10. **Idempotency:** calling an idempotent service twice with the
same `(uid, key)` produces one effect + the cached response (emulator). 11.
**Claim-sync tagging:** every role/status/class/permission-changing service
calls `syncMembershipClaims` (common-api §4.5) — asserted via a registry tag +
emulator claim diff. 12. **AI cost path:** `ctx.ai.generate` always logs a cost
record and is blocked when `checkUsageQuota` fails (emulator with a fake
provider). 13. **Error mapping:** `mapError(AccessError(code))` → `HttpsError`
whose `details.code === code` for every `AppErrorCode`. 14. **Outbox
atomicity:** a service that throws after the state write leaves NO outbox record
(transaction rollback) — emulator test. 15. **buildAuthContext:** super-admin
`tenantOverride` honored only when `isSuperAdmin`; non-super-admin override is
ignored and `tenantId` stays the claim (unit test); `classIdsOverflow` triggers
the membership read.

---

## 9. Notes / open questions / drift reconciliations

- **Keys' canonical home.**
  `TeacherPermissionKey`/`StaffPermissionKey`/`TenantRole` declared in
  `@levelup/access` per the brief, but `@levelup/domain` needs them for
  membership/claims schemas — resolve by declaring in `@levelup/domain` and
  re-exporting from `@levelup/access`, OR declaring in access and importing into
  domain. Recommend **domain owns the unions, access owns the policy table**
  (keeps the downward rule clean: access→domain).
- **`functions/shared` retirement.** The live
  `functions/shared/src/{parse-request,rate-limit}.ts` are superseded by
  `@levelup/functions-shared`; the three per-codebase `rate-limit.ts` +
  `parse-request.ts` copies collapse into one. Migration deletes them.
- **AI package and Firestore.** `usage-quota`/`llm-logger`/`cost-summaries`
  currently `import 'firebase-admin'` directly (live). To honor principle 3 they
  must route through `ctx.repos.llm.*` — this is a real refactor, called out as
  test #12's pre-req.
- **SystemContext authority.** Triggers act as a system actor; they bypass
  rate-limit/quota but MUST still scope to the triggering tenant. Confirm no
  trigger ever operates cross-tenant except `analytics platform` rollups (which
  are super-admin-equivalent and audited).
- **Pipeline reducer location.** `advancePipeline` lives in
  `@levelup/services/autograde/pipeline` and is consumed by `makeTaskHandler` —
  confirm Cloud Tasks queue names/региона in `config.QUEUES` match deployment.
- **Open (carried REVIEW):** OCR pipeline stage live-or-dead, `'completed'` exam
  status semantics, `joinTenant` lazy student-doc — these affect the
  autograde/identity services' transition tables but not this layer's shape.
- **`tenantOverride` schema.** Only super-admin defs carry an optional
  `tenantOverride` field in their request schema (api-contract);
  `buildAuthContext` is the sole consumer; contract test #7 whitelists exactly
  those defs.
