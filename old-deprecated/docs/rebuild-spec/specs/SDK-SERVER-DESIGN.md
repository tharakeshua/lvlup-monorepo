# SDK + Server Model — End-to-End Design

> **Scope.** The complete client-side SDK and the server-side service model for
> the Auto-LevelUp rebuild, consumed identically by **5 web apps** (teacher /
> student / admin / super-admin / parent) and **3 React Native apps**
> (learner-rn, family-rn/staff-rn, scanner-rn).
>
> **Guiding principle.** **LEAN UI + LEAN-but-AUTHORITATIVE SERVER + FAT SDK.**
> The UI is presentation and interaction only. The SDK is the client-side brain:
> contracts, typed client, repositories, caching, optimistic updates, shaping,
> batching, error normalization, retry/idempotency, pagination, realtime, and
> (later) offline. The server is the minimum that _must_ be server-side for
> **trust, authority, and integrity** — the client is untrusted, so the
> security/authority/state-integrity line never moves into the SDK.
>
> **Companion specs.** Builds on `specs/common-api.md` (API surface),
> `specs/backend-services.md` (service topology), `specs/domain-and-data.md`
> (domain model). Grounded by the data-model review at
> `status/REVIEW-domain-data-model.md` — its 13-item untrusted-client authority
> boundary is the empirical basis for §4's security column.

---

## 0. Locked decisions (this design)

| Area                 | Decision                                                                                                                                                   | Rationale                                                      |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Transport            | **ONE typed callable SDK over Firebase Cloud Functions**; REST/tRPC gateway **deferred** but transport stays pluggable behind an `invoke`/`subscribe` seam | common-api §1; one client serves web+RN+future REST            |
| Domain authoring     | **Zod-schema-first**, types via `z.infer`, `.strict()`                                                                                                     | kills the drift class (review D9, top-risk #5)                 |
| `tenantId`           | **Derived server-side from claims, never sent by the SDK** (super-admin `tenantOverride` only)                                                             | review #1 authority boundary; top-risk #1                      |
| Repositories layer   | **BUILD IT** — the domain-shaped "brain" between hooks and the typed client                                                                                | the core of "fat SDK"                                          |
| Realtime             | **Design the `subscribe()` seam now**; implementation = Firestore/RTDB listeners                                                                           | common-api §10; needed by 4 live features                      |
| Offline/sync         | **DEFER** — leave the `@levelup/offline` seam, do not build it for v1                                                                                      | user decision; revisit later                                   |
| Optimistic updates   | **Conservative** — only low-risk/high-frequency (item attempts, chat); never grading/publish/lifecycle                                                     | authority-sensitive writes must round-trip                     |
| B2C payments         | **Stub the gateway behind a real `PaymentGateway` interface**; build the real adapter later                                                                | user decision; review #8                                       |
| Scanner RN transport | **Firebase JS SDK in v1**; HTTP transport later                                                                                                            | user decision; no rewrite needed                               |
| Rubric on item       | **Store the resolved `effectiveRubric` snapshot + the source `rubricId`**                                                                                  | review §2 + open-Q resolution; traceable + no grade-time reads |
| State machines       | **`ALLOWED_TRANSITIONS` are build-time-checked data** in the contract                                                                                      | client pre-validates for UX; server enforces; review open-Q    |

---

## 1. Layered package architecture

### 1.1 The layer cake (dependency direction is strictly downward)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  APPS (LEAN UI)   5 web (Vite/React)  +  3 React Native (Expo)                 │
│  presentation + interaction ONLY. Imports: @levelup/query hooks + @levelup/    │
│  domain types. NEVER imports firebase/*, never holds business/data-access logic │
└───────────────────────────────────┬────────────────────────────────────────────┘
                                     │ uses hooks
┌───────────────────────────────────▼────────────────────────────────────────────┐
│  @levelup/query        React Query (TanStack v5) — platform-neutral             │
│  • hooks: useSpaces() useSaveSpace() useSubmitTestSession() useGradeQuestion()   │
│  • query-key factories (spaceKeys, examKeys, …) + invalidation graph             │
│  • optimistic update recipes (conservative allow-list)                           │
│  • <ApiProvider> wiring (client + queryClient + realtime + transport)            │
└───────────────────────────────────┬────────────────────────────────────────────┘
                                     │ calls
┌───────────────────────────────────▼────────────────────────────────────────────┐
│  @levelup/repositories     THE BRAIN (fat) — domain-shaped, framework-free       │
│  • repos: spaceRepo, itemRepo, examRepo, submissionRepo, progressRepo, …         │
│  • data shaping / transforms / view-model assembly                               │
│  • request building + batching + N+1 collapse                                    │
│  • pagination cursor management (opaque cursor → typed Page<T>)                   │
│  • client-side pre-validation + transition pre-checks (ALLOWED_TRANSITIONS)       │
│  • derived/computed fields the UI shouldn't recompute                            │
└───────────────────────────────────┬────────────────────────────────────────────┘
                                     │ calls
┌───────────────────────────────────▼────────────────────────────────────────────┐
│  @levelup/api-client    the typed SDK — createApiClient(transport)               │
│  • namespaced methods: api.levelup.saveSpace(req) → ResOf<...>                    │
│  • request pre-flight validate (Zod) + response validate (dev)                   │
│  • error normalization (HttpsError → ApiError) ; retry + idempotency keys        │
└───────────────────────────────────┬────────────────────────────────────────────┘
                                     │ depends on
┌───────────────────────────────────▼────────────────────────────────────────────┐
│  @levelup/api-contract    SINGLE SOURCE OF TRUTH (pure TS + zod)                  │
│  • per-callable Zod requestSchema + responseSchema + z.infer types               │
│  • CALLABLES registry (name → def) ; CallableName / ReqOf / ResOf                 │
│  • error model (AppErrorCode, ApiErrorDetails, maps)                              │
│  • PageRequest/pageResponse pagination fragment                                   │
│  • ALLOWED_TRANSITIONS state machines (build-time validated)                      │
│  • realtime subscription registry (SUBSCRIPTIONS: name → payload schema)          │
└───────────────────────────────────┬────────────────────────────────────────────┘
                                     │ depends on
┌───────────────────────────────────▼────────────────────────────────────────────┐
│  @levelup/domain   (replaces shared-types) — pure TS, ZERO firebase coupling      │
│  • Zod-first entities (.strict()) ; 17 branded IDs ; ISO-8601 Timestamp           │
│  • transport-neutral primitives (Page<T>, AuditFields, money)                     │
└──────────────────────────────────────────────────────────────────────────────────┘

  ── SIDE SEAMS (cross-cutting, injected) ────────────────────────────────────────
  @levelup/realtime    subscribe(name, params, cb) seam + SubscriptionHandle        (built now)
  @levelup/offline     queue + idempotent replay + sync   (SEAM ONLY — deferred)    (stub now)

  ── TRANSPORT ADAPTERS (injected at the app root; the ONLY platform-specific code) ─
  @levelup/transport-firebase   invokeViaCallable() + subscribeViaFirestore/RTDB     (web + RN v1)
  @levelup/transport-http       invokeViaHttp() + subscribeViaSSE/WebSocket          (future / scanner-later)
```

### 1.2 Package responsibilities & platform deps

| Package                              | Owns                                                                                                                   | Platform deps                     |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `@levelup/domain`                    | Zod-first entities, branded IDs, `Timestamp` (ISO), `Page<T>`, `AuditFields`, enums                                    | none (pure TS + zod)              |
| `@levelup/api-contract`              | per-callable req/res schemas + `z.infer`, `CALLABLES`, error model, pagination, `ALLOWED_TRANSITIONS`, `SUBSCRIPTIONS` | none (pure TS + zod)              |
| `@levelup/api-client`                | `createApiClient(transport)`, validation, error normalization, retry/idempotency                                       | none (zod + injected `Transport`) |
| `@levelup/repositories`              | domain repos, shaping, batching, cursor mgmt, transition pre-checks                                                    | none (api-client + domain)        |
| `@levelup/query`                     | React Query hooks, query-key factories, invalidation, optimistic recipes, providers                                    | `@tanstack/react-query` (RN-safe) |
| `@levelup/realtime`                  | `subscribe()` seam, `SubscriptionHandle`, payload validation                                                           | none (injected transport)         |
| `@levelup/offline` _(deferred)_      | queue, idempotent replay, conflict policy                                                                              | none (seam interface only for v1) |
| `@levelup/transport-firebase`        | `Transport` impl over Firebase callable + Firestore/RTDB listeners; region/config                                      | `firebase`                        |
| `@levelup/transport-http` _(future)_ | `Transport` impl over fetch + SSE/WS + bearer auth                                                                     | none web-specific                 |

**Why a `repositories` layer between hooks and the client (the fat-vs-lean
call).** `common-api.md` sketches hooks calling `api-client` directly. We insert
repositories because the "fat SDK" value lives exactly here: (a) **shaping** —
the wire response (e.g. a paginated `listItems` + a separate
`getStoryPointProgress`) is assembled into the view-model the UI needs, once,
shared across all 8 apps; (b) **batching / N+1 collapse** — the review flagged
N+1 fan-outs in super-admin and parent-web; repos own the batched request
building; (c) **cursor management** — opaque cursors never leak to the UI; (d)
**transition pre-checks** — `spaceRepo.canPublish(space)` reads
`ALLOWED_TRANSITIONS` so the UI disables the button without re-implementing the
rule; (e) **derived fields** — overall-score blends, completion %, "is
assessment story point" live once. Hooks then become thin React-Query wrappers
over repo methods. This keeps the UI genuinely dumb and makes RN reuse total.

### 1.3 Dependency rules (enforced by lint / `package.json` boundaries)

- **No package imports a layer above it.** `domain` ← `api-contract` ←
  `api-client` ← `repositories` ← `query` ← apps.
- **No app imports `firebase/*`, `@levelup/api-client`, or
  `@levelup/transport-*` directly** — only `@levelup/query` hooks +
  `@levelup/domain` types. (Transport is injected once at the root.)
- **`domain` and `api-contract` are pure** (no firebase, no DOM, no React) —
  this is what makes RN + functions + seed/test tooling all consume them
  verbatim.
- **`functions/*` import `@levelup/api-contract` + `@levelup/domain`** (same
  contract as the client) and `@levelup/services` + `@levelup/access` +
  `@levelup/ai` (server-only).

---

## 2. The SDK surface + one concrete end-to-end call

### 2.1 The contract registry (`@levelup/api-contract`)

```ts
export interface CallableDef<Req, Res> {
  name: CallableName; // 'v1.levelup.saveSpace'
  module: "identity" | "levelup" | "autograde" | "analytics";
  requestSchema: ZodType<Req>; // .strict()
  responseSchema: ZodType<Res>; // .strict()
  authMode: "authed" | "public"; // 'public' only for pre-auth lookups
  rateTier: "write" | "read" | "ai" | "auth" | "report";
  idempotent?: boolean; // accepts idempotencyKey; server dedupes
  invalidates?: readonly string[]; // query-key roots this mutation dirties (hint for hooks)
}

export const CALLABLES = {
  "v1.levelup.saveSpace": saveSpaceDef,
  "v1.levelup.listSpaces": listSpacesDef,
  "v1.levelup.submitTestSession": submitTestSessionDef,
  // …all ~47 (full inventory in common-api §3.3)
} as const;

export type CallableName = keyof typeof CALLABLES;
export type ReqOf<N extends CallableName> = z.infer<
  (typeof CALLABLES)[N]["requestSchema"]
>;
export type ResOf<N extends CallableName> = z.infer<
  (typeof CALLABLES)[N]["responseSchema"]
>;
```

### 2.2 The transport seam (the ONLY platform difference)

```ts
export interface Transport {
  invoke<N extends CallableName>(name: N, data: ReqOf<N>): Promise<ResOf<N>>;
  // realtime seam lives alongside invoke; see §5.6
  subscribe<S extends SubscriptionName>(
    name: S,
    params: ParamsOf<S>,
    cb: (payload: PayloadOf<S>) => void
  ): SubscriptionHandle;
}
```

### 2.3 The typed client (`@levelup/api-client`)

```ts
export function createApiClient(
  transport: Transport,
  opts?: {
    validateResponses?: boolean; // dev: catch server↔client drift
    getIdempotencyKey?: () => string; // UUID v7 per mutating call
  }
) {
  function call<N extends CallableName>(name: N) {
    const def = CALLABLES[name];
    return async (data: ReqOf<N>): Promise<ResOf<N>> => {
      const req = def.requestSchema.parse(data); // pre-flight validate (never sends tenantId)
      try {
        const res = await transport.invoke(name, req);
        if (opts?.validateResponses) def.responseSchema.parse(res);
        return res as ResOf<N>;
      } catch (e) {
        throw normalizeError(e); // HttpsError → ApiError (§5.2)
      }
    };
  }
  return {
    identity: {
      saveTenant: call("v1.identity.saveTenant"),
      switchActiveTenant: call("v1.identity.switchActiveTenant") /* … */,
    },
    levelup: {
      saveSpace: call("v1.levelup.saveSpace"),
      listSpaces: call("v1.levelup.listSpaces"),
      submitTestSession: call("v1.levelup.submitTestSession") /* … */,
    },
    autograde: {
      saveExam: call("v1.autograde.saveExam"),
      gradeQuestion: call("v1.autograde.gradeQuestion"),
      uploadAnswerSheets: call("v1.autograde.uploadAnswerSheets") /* … */,
    },
    analytics: {
      getSummary: call("v1.analytics.getSummary"),
      generateReport: call("v1.analytics.generateReport") /* … */,
    },
  };
}
export type ApiClient = ReturnType<typeof createApiClient>;
```

### 2.4 Repositories (`@levelup/repositories`) — the brain

```ts
export function createRepositories(api: ApiClient) {
  return {
    spaces: createSpaceRepo(api),
    items: createItemRepo(api),
    progress: createProgressRepo(api),
    exams: createExamRepo(api),
    submissions: createSubmissionRepo(api),
    // …
  };
}

function createSpaceRepo(api: ApiClient) {
  return {
    list: (filter?: SpaceFilter) =>
      paginate((cursor) => api.levelup.listSpaces({ ...filter, cursor })), // cursor mgmt hidden
    get: (id: SpaceId) => api.levelup.getSpace({ id }),
    save: (input: SaveSpaceInput) => api.levelup.saveSpace(input),
    /** Pure client-side pre-check for UX — server still enforces. */
    canTransition: (from: SpaceStatus, to: SpaceStatus) =>
      ALLOWED_TRANSITIONS.space[from]?.includes(to) ?? false,
  };
}
export type Repositories = ReturnType<typeof createRepositories>;
```

### 2.5 Query hooks (`@levelup/query`) — thin React layer

```ts
export const spaceKeys = {
  all: ["spaces"] as const,
  list: (f?: SpaceFilter) => [...spaceKeys.all, "list", f ?? {}] as const,
  detail: (id: SpaceId) => [...spaceKeys.all, "detail", id] as const,
};

export function useSaveSpace() {
  const { repos } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveSpaceInput) => repos.spaces.save(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: spaceKeys.all }), // narrowest correct scope
  });
}
```

### 2.6 ONE end-to-end example: a teacher publishes a space

```
[UI: SpaceEditorPage.tsx]   (LEAN)
   const { mutate, isPending } = useSaveSpace();
   <Button disabled={!repos.spaces.canTransition(space.status, 'published')}   ← pre-check (UX only)
           onClick={() => mutate({ id: space.id, data: { status: 'published' } })} />
        │  no tenantId in the call — ever
        ▼
[@levelup/query: useSaveSpace]
   mutationFn → repos.spaces.save(input);  onSuccess → invalidate spaceKeys.all
        ▼
[@levelup/repositories: spaceRepo.save]
   (optional shaping/defaults) → api.levelup.saveSpace(input)
        ▼
[@levelup/api-client: call('v1.levelup.saveSpace')]
   req = SaveSpaceRequestSchema.parse(input)   ← .strict(): rejects stray fields, no tenantId field exists
   attaches idempotencyKey (def.idempotent) → transport.invoke('v1.levelup.saveSpace', req)
        ▼
[@levelup/transport-firebase: invokeViaCallable]
   httpsCallable(functions, 'v1.levelup.saveSpace')(req)   ← Firebase forwards the ID token automatically
        ▼   ════════════ NETWORK / TRUST BOUNDARY ════════════
[SERVER onCall adapter: v1.levelup.saveSpace]   (LEAN, AUTHORITATIVE)
   ctx = buildAuthContext(request.auth)          ← tenantId, role, perms, classIds FROM CLAIMS (§3.2)
   input = parseRequest(request.data, SaveSpaceRequestSchema)
   return saveSpaceService(input, ctx)
        ▼
[@levelup/services: saveSpaceService(input, ctx)]   (transport-agnostic)
   authorize(ctx, 'space.publish', { spaceId })   ← @levelup/access (AUTHORITATIVE)
   assertTransition(space.status → 'published', ALLOWED_TRANSITIONS.space)   ← server ENFORCES
   validatePublish(space)                          ← ≥1 storyPoint, ≥1 item, timed-test duration > 0
   write under tenants/${ctx.tenantId}/spaces/${id}    ← tenantId from CTX, not body
   enqueue onSpacePublished trigger (notifications)     ← reliable side-effect, not fire-and-forget
   return { id, created: false }
        ▼   ════════════ response travels back up ════════════
[api-client] responseSchema.parse(res) (dev)  → [hook] invalidate → [UI] re-renders from fresh cache
```

The same call path runs **unchanged on React Native** — only the injected
`Transport` differs.

---

## 3. The server service model (lean but authoritative)

### 3.1 The `(input, ctx)` boundary

Every backend capability is a transport-agnostic service:
`fn(input, ctx: AuthContext): Promise<output>`. It never imports
`firebase-functions`. The `onCall` handler is a thin adapter:

```ts
export const saveSpace = onCall(
  { region: REGION, cors: true },
  async (request) => {
    const ctx = buildAuthContext(request.auth); // 1. identity/claims → ctx
    const input = parseRequest(request.data, SaveSpaceRequestSchema); // 2. Zod validate at boundary
    return saveSpaceService(input, ctx); // 3. delegate to the service
  }
);
```

A future REST/tRPC gateway builds the **same `ctx`** from a verified bearer
token and calls the **same `saveSpaceService`** — one set of services backs
web + RN + REST.

### 3.2 `AuthContext` (built server-side, never client-supplied)

```ts
interface AuthContext {
  uid: UserId;
  isSuperAdmin: boolean;
  tenantId: TenantId | null; // from claims (active tenant); NOT from request body
  role: TenantRole | null;
  permissions: Partial<Record<TeacherPermissionKey, boolean>> | null;
  staffPermissions: Partial<Record<StaffPermissionKey, boolean>> | null;
  classIds: ClassId[]; // with overflow fallback to membership-doc read
  studentIds: StudentId[]; // parent → children
  idempotencyKey?: string;
  now: () => Timestamp; // injected clock (testable, server-authoritative)
}
```

> **The tenant override exception.** Only super-admin cross-tenant operations
> accept an explicit `tenantOverride` in the request; `buildAuthContext` honors
> it **only if `ctx.isSuperAdmin`**, and the action is audited. For every other
> caller, `tenantId` is the claim's active tenant, full stop.

### 3.3 The four codebases (deploy-independent bounded contexts)

| Codebase         | Owns (authoritative)                                                                                                     | Representative callables                                                                                                                                                           | Triggers/queues                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **identity-fn**  | users, tenants, memberships, **claims**, role entities, lifecycle, bulk import, export                                   | `saveTenant`, `save{Student,Teacher,Parent,Staff,Class,AcademicSession}`, `createOrgUser`, `joinTenant`, `switchActiveTenant`, `bulkImport*`, `lookupTenantByCode` (public)        | `beforeUserCreated/beforeSignIn` (claims seed), `onMembershipWritten` (claim sync), token revocation |
| **levelup-fn**   | spaces, storyPoints, **items + AnswerKeys**, question bank, rubric presets, **test sessions**, **progress**, chat, store | `saveSpace`, `saveStoryPoint`, `saveItem`, `getItemForEdit`, `startTestSession`, `submitTestSession`, `evaluateAnswer`, `recordItemAttempt`, `purchaseSpace`, `list*`/`get*` reads | `onSpacePublished`, `expireTestSessions`, progress-updater                                           |
| **autograde-fn** | exams, submissions, **grading pipeline**, evaluation settings, DLQ                                                       | `saveExam`, `extractQuestions`, `uploadAnswerSheets`, `gradeQuestion`, `list*`/`get*` reads                                                                                        | `advancePipeline` reducer (Cloud Tasks), `onResultsReleased`, watchdog                               |
| **analytics-fn** | cross-system summaries, exam analytics, at-risk, cost rollups, reports                                                   | `getSummary`, `generateReport`, parent read endpoints                                                                                                                              | `recomputeStudentRollup` (queue), `onExamResultsReleased`, cron cost/at-risk/insights                |

Shared server-only layer: `@levelup/services` (use-cases), `@levelup/access`
(one `authorize()` policy), `@levelup/ai` (one LLM provider seam + per-tenant
Secret Manager keys + cost/quota), `@levelup/functions-shared` (`parseRequest`,
rate limit, config).

### 3.4 What "authoritative" means here

The server is the **sole writer** of: claims, memberships, answer keys, grading
outputs/scores, session deadlines & attempt counts, progress summaries,
denormalized counters, lifecycle status, purchases, and all AI cost. The SDK may
**read** projections of these (where access policy allows) and may **request**
changes, but the server computes and commits the authoritative value. See §4
security column.

---

## 4. Responsibility table — UI | SDK | SERVER

> Legend: ● owns it · ○ participates (read/UX only) · — none. The **SERVER
> column with ⚷ is the security line: it can never move into the SDK**
> regardless of how fat the SDK gets (grounded in `REVIEW-domain-data-model.md`
> §6).

| Responsibility                                                        | UI  |  SDK   | SERVER | Rationale                                                         |
| --------------------------------------------------------------------- | :-: | :----: | :----: | ----------------------------------------------------------------- |
| Rendering, layout, interaction, navigation                            |  ●  |   —    |   —    | presentation only                                                 |
| Form state, local component state                                     |  ●  |   —    |   —    | ephemeral UI                                                      |
| Domain types / entity shapes                                          |  ○  |   ●    |   ●    | `@levelup/domain`, shared verbatim                                |
| API contract (req/res schemas, registry)                              |  —  |   ●    |   ●    | `@levelup/api-contract`, one source both sides                    |
| Typed client / endpoint names                                         |  —  |   ●    |   —    | SDK owns the call surface; names live once                        |
| Request **building / batching / N+1 collapse**                        |  —  |   ●    |   —    | repositories; ergonomics                                          |
| Data **shaping / view-model assembly**                                |  —  |   ●    |   —    | repositories; shared across 8 apps                                |
| Caching + invalidation (query keys)                                   |  —  |   ●    |   —    | `@levelup/query`                                                  |
| **Optimistic updates** (conservative allow-list)                      |  —  |   ●    |   —    | UX; reconciled against authoritative response                     |
| Pagination **cursor management**                                      |  —  |   ●    |   —    | opaque cursor never reaches UI                                    |
| Client-side **pre-validation** (Zod)                                  |  —  |   ●    |   ○    | UX fast-fail; server re-validates                                 |
| Transition **pre-check** (`ALLOWED_TRANSITIONS`)                      |  ○  |   ●    |   ●    | SDK for UX (disable button); **server enforces**                  |
| Error normalization → user copy                                       |  ○  |   ●    |   ○    | SDK maps `ApiError`; server emits typed codes                     |
| Retry / **idempotency key generation**                                |  —  |   ●    |   ●    | SDK generates; **server dedupes**                                 |
| Realtime subscription seam                                            |  —  |   ●    |   ●    | SDK subscribes; server is the source                              |
| Offline queue/sync _(deferred)_                                       |  —  | (seam) |   ●    | seam only in v1; server stays source of truth                     |
| **`tenantId` resolution**                                             |  —  |   —    |   ⚷    | **claims only, never SDK body** (review #1)                       |
| **AuthN (verify identity/token)**                                     |  —  |   —    |   ⚷    | Firebase Auth; server trusts only verified token                  |
| **AuthZ / access policy**                                             |  ○  |   ○    |   ⚷    | `@levelup/access`; UI/SDK may _hint_, server decides              |
| **Custom claims** (mint/refresh/revoke)                               |  —  |   —    |   ⚷    | Admin SDK only (review #2)                                        |
| **Membership writes** (role/status/perms/links)                       |  —  |   —    |   ⚷    | Admin-SDK only (review #3)                                        |
| **AnswerKeys** (correct answers, model answers)                       |  —  |   —    |   ⚷    | server-only subcollection, deny-all (review #4)                   |
| **Grading / scoring**                                                 |  —  |   ○    |   ⚷    | SDK submits answers; server computes scores (review #5)           |
| **Test session authority** (deadline, attempts, ordering)             |  ○  |   ○    |   ⚷    | server clock + `serverDeadline`; SDK optimistic only (review #6)  |
| **Rubric guidance / thresholds** (`evaluatorGuidance`, `modelAnswer`) |  —  |   —    |   ⚷    | reading leaks how to score; authoring roles only (review #7)      |
| **Purchases / enrollment** (`consumerProfile`)                        |  —  |   ○    |   ⚷    | `purchaseSpace` CF only (review #8)                               |
| **Denormalized counters / summaries**                                 |  ○  |   ○    |   ⚷    | trigger-maintained; SDK reads, never writes (review #9)           |
| **Lifecycle status + `resultsReleased`**                              |  ○  |   ○    |   ⚷    | pipeline transitions server-only; gating server-side (review #10) |
| **Cross-domain link integrity**                                       |  —  |   ○    |   ⚷    | server existence-validates referents in-tenant (review #11)       |
| **Pre-auth tenant lookup** (school-code)                              |  ○  |   ○    |   ⚷    | dedicated callable; minimal projection only (review #12)          |
| **Storage access** (answer sheets, exports)                           |  —  |   ○    |   ⚷    | per-path tenant+role+ownership scoping (review #13)               |
| **AI calls / Gemini keys / cost / quota**                             |  —  |   —    |   ⚷    | Secret Manager; never in client bundle                            |
| Rate limiting / feature gates / quota enforcement                     |  —  |   ○    |   ⚷    | server pipeline; SDK may surface limits                           |
| Side-effects (notifications, versions, leaderboards)                  |  —  |   —    |   ●    | triggers/outbox; reliable, not fire-and-forget                    |

**The one-line rule:** _trust / authority / integrity stays on the server (⚷);
ergonomics (caching, shaping, optimism, retries, cursors, batching,
normalization) moves into the SDK._ State machines and idempotency deliberately
appear in **both** columns — the SDK does the UX half, the server does the
authoritative half.

---

## 5. Cross-cutting concerns

### 5.1 AuthContext flow (recap)

Firebase Callable forwards the caller's ID token →
`request.auth.{uid, token: PlatformClaims}` → `buildAuthContext` derives
`tenantId/role/permissions/classIds/studentIds` from **claims** (with overflow
fallback to the membership doc). The SDK never participates in this; it only
triggers `getIdToken(true)` after `switchActiveTenant` re-stamps claims.

### 5.2 Error model

One wire envelope: every `HttpsError.details` carries a typed `ApiErrorDetails`:

```ts
interface ApiErrorDetails {
  code: AppErrorCode; // VALIDATION_ERROR | INVALID_TRANSITION | QUOTA_EXCEEDED | FEATURE_DISABLED
  // | RATE_LIMITED | NOT_FOUND | PERMISSION_DENIED | TENANT_SUSPENDED | …
  message: string;
  validationErrors?: { path: string; message: string }[];
  retryable?: boolean;
  meta?: Record<string, JsonValue>;
}
```

- **Server:** `fail(code, message, extra)` throws
  `HttpsError(APP_ERROR_TO_HTTPS[code], message, details)`.
- **SDK:** `normalizeError` (in api-client) maps any thrown error → a stable
  `ApiError { code, message, retryable, validationErrors }`. The `useApiError`
  hook reads `code` first, falls back to the Firebase code, renders copy from
  `ERROR_MESSAGES`/`ERROR_RECOVERY_HINTS`.
- A global React Query error boundary surfaces non-empty-state errors (fixes
  parent-web "errors render as empty states").
- `AppErrorCode` + maps live in `@levelup/api-contract` so both sides agree.

### 5.3 Pagination

One fragment in `@levelup/api-contract`; cursors are opaque to the SDK and UI:

```ts
export const PageRequest = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});
export const pageResponse = <T extends ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
    total: z.number().optional(),
  });
```

Repositories expose `paginate()` / infinite-query helpers; the UI sees
`Page<T>` + `fetchNextPage()`, never a cursor string.

### 5.4 Idempotency

`def.idempotent` callables (`createOrgUser`, `bulkImport*`, `submitTestSession`,
`recordItemAttempt`, `evaluateAnswer`, `uploadAnswerSheets`, `purchaseSpace`)
get a UUID-v7 `idempotencyKey` generated by the api-client per call (stable
across retries). The **server dedupes** on `(uid, key)`. This makes the SDK's
retry layer safe and is mandatory once offline/replay is added later.

### 5.5 Optimistic updates (conservative)

Allow-list only — applied in `@levelup/query` recipes, reconciled against the
authoritative response:

- ✅ `recordItemAttempt` / practice progress, `sendChatMessage` (append),
  notification mark-read.
- ❌ **Never** for grading, publish/lifecycle transitions, purchases, bulk ops,
  anything in §4's ⚷ rows. Every optimistic mutation has a rollback on error and
  trusts the server's returned value on success.

### 5.6 Realtime seam (built now, Firestore impl)

A typed subscription registry parallel to `CALLABLES`:

```ts
export const SUBSCRIPTIONS = {
  "v1.levelup.testSessionDeadline": {
    params: z.object({ sessionId: z.string() }),
    payload: TestSessionLiveSchema,
  },
  "v1.levelup.chatStream": {
    params: z.object({ sessionId: z.string() }),
    payload: ChatMessageSchema,
  },
  "v1.notification.badge": {
    params: z.object({}),
    payload: NotificationStateSchema,
  },
  "v1.autograde.gradingStatus": {
    params: z.object({ submissionId: z.string() }),
    payload: SubmissionStatusSchema,
  },
} as const;
```

`transport-firebase` implements `subscribe()` via Firestore/RTDB listeners;
`transport-http` will later implement it via SSE/WebSocket. The UI consumes
realtime through `useSubscription(name, params)` hooks — identical on web + RN.
(Full realtime/sync design remains a separate spec; this is only the seam.)

### 5.7 Offline / sync (deferred — seam only)

`@levelup/offline` ships as an **interface + no-op passthrough** in v1:
`OfflineQueue { enqueue(call), flush(), status }`. The api-client is built to
_accept_ an optional queue (mutations route through it when present), so adding
real offline later is additive — no UI or repo changes. Idempotency keys (§5.4)
are the prerequisite, and they're in from day one. **Not built for v1.**

---

## 6. How web + React Native share it (transport injection)

The **only** platform-specific code is the transport adapter, wired once at each
app root:

```ts
// WEB — apps/*/src/main.tsx
const transport = createFirebaseTransport(getFirebaseServices(), { region: REGION });
const api = createApiClient(transport, { validateResponses: import.meta.env.DEV });
const repos = createRepositories(api);
root.render(<ApiProvider api={api} repos={repos} transport={transport}><App/></ApiProvider>);

// REACT NATIVE — apps-rn/*/App.tsx  (identical except env + Firebase init)
const transport = createFirebaseTransport(getFirebaseServicesRN(), { region: REGION });
const api = createApiClient(transport, { validateResponses: __DEV__ });
const repos = createRepositories(api);
<ApiProvider api={api} repos={repos} transport={transport}><App/></ApiProvider>;
```

Everything above the transport — contract, client, repositories, query hooks,
realtime, error model — is **byte-identical** across all 8 apps.
`@levelup/domain`, `@levelup/api-contract`, `@levelup/query` have zero
DOM/web/node dependencies, so RN imports them unchanged. The scanner-rn app uses
the same Firebase transport in v1 (uploads compressed images to Storage, then
calls `uploadAnswerSheets` — never writes the submission doc itself); it can
switch to `transport-http` later with no app-code change.

---

## 7. Open questions & risks

### 7.1 Open questions (carried from the data-model review + new)

1. **Realtime authority for the test clock.** The deadline is
   server-authoritative (`serverDeadline` + `/serverTimeOffset`); does the SDK's
   realtime layer also need a server-time-sync primitive exposed (e.g.
   `useServerTime()`), or do we rely on the existing RTDB offset doc?
   _(Recommend: expose a thin `useServerTime()` over the offset doc.)_
2. **Repository granularity.** Do we want one repo per entity (`spaceRepo`,
   `itemRepo`) or per bounded-context aggregate (`learningRepo`, `gradingRepo`)?
   _(Recommend: per-entity for CRUD + a few cross-entity "view" repos for
   dashboards.)_
3. **`getItemForEdit` and answer-key re-merge.** Confirmed server-only; the SDK
   never caches the re-merged (answer-bearing) item beyond the editor session —
   needs a cache-scope rule so answer keys don't leak into a shared query cache.
   _(Recommend: editor items use a non-persisted, role-gated query key, excluded
   from any future offline store.)_
4. **`ALLOWED_TRANSITIONS` shape.** Build-time-checked data per entity (`space`,
   `exam`, `submission`); confirm the union members match the `as const` status
   enums (review top-risk #5 / open-Q). The SDK imports the same table for
   pre-checks.
5. **Rubric snapshot vs id (resolved).** Decision: store **both**
   `effectiveRubric` snapshot + source `rubricId`. The SDK reads the snapshot
   for display/scoring-preview; never reads `evaluatorGuidance`/`modelAnswer`
   for non-authoring roles (server projects those out).
6. Payments interface shape — `PaymentGateway` stub returns a deterministic fake
   `transactionId`; confirm the v1 `purchaseSpace` response contract is stable
   so the real adapter is a drop-in.

### 7.2 Risks (and the design's mitigation)

| Risk                                                             | Severity | Mitigation in this design                                                                                                                                         |
| ---------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`tenantId`-from-body habit leaks into a new callable**         | High     | `tenantId` has **no field** in any request schema; `buildAuthContext` is the only source; a contract test asserts no tenant-scoped req schema declares `tenantId` |
| **Answer keys / grading guidance reach the client cache**        | High     | server projects them out by role; editor items use isolated, non-persisted cache keys (§7.1.3); deny-all rules as defense-in-depth                                |
| **Optimistic update on an authority-sensitive write**            | High     | conservative allow-list in `@levelup/query`; lint rule flags optimistic config on ⚷ mutations                                                                     |
| **Repositories layer becomes a dumping ground / god-object**     | Medium   | strict per-entity boundaries + dependency lint; repos may not import each other except via declared "view" repos                                                  |
| **Contract drift between server & SDK** (review D9/D12)          | Medium   | one `@levelup/api-contract` consumed by both; `.strict()` schemas; dev-mode response validation; emulator contract tests                                          |
| **RN pulls in a web/node-only dep transitively**                 | Medium   | `domain`/`api-contract`/`query` are pure; CI builds an RN bundle to catch accidental coupling                                                                     |
| **Realtime seam underdesigned, blocks later SSE/WS swap**        | Medium   | `subscribe()` mirrors `invoke()`; subscription registry typed now even though impl is Firestore-only                                                              |
| **Deferred offline forces a later rewrite**                      | Low      | seam + idempotency keys in from day one; api-client already routes mutations through an optional queue                                                            |
| **Migration: dual item path / field schisms** (review D1/D3/D10) | Medium   | invisible to the SDK behind `list*`/`get*` + `save*`; server absorbs the migration; SDK only ever sees the clean contract                                         |

---

## 8. Build order (SDK + server, dependency-respecting)

1. **`@levelup/domain`** — invert to Zod-first `.strict()`, brand persisted IDs,
   ISO `Timestamp`, `Page<T>`.
2. **`@levelup/api-contract`** — per-callable defs + `CALLABLES` + error model +
   pagination + `ALLOWED_TRANSITIONS` + `SUBSCRIPTIONS`; delete
   `callable-types.ts` interfaces (derive via `z.infer`).
3. **`@levelup/transport-firebase`** — `invokeViaCallable` + Firestore/RTDB
   `subscribe` + region config.
4. **`@levelup/api-client`** — `createApiClient`, validation, `normalizeError`,
   idempotency, optional offline-queue hook.
5. **Server: extract `@levelup/services`** — lift each `onCall` body into
   `fn(input, ctx)`; `buildAuthContext`; `@levelup/access` `authorize()`; add
   `list*`/`get*` read endpoints.
6. **`@levelup/repositories`** — per-entity repos + cursor `paginate()` +
   transition pre-checks + view repos.
7. **`@levelup/query`** — hooks, query-key factories, invalidation graph,
   conservative optimistic recipes, `<ApiProvider>`.
8. **`@levelup/realtime`** — `subscribe()` seam + `useSubscription` hooks
   (Firestore impl).
9. **`@levelup/offline`** — interface + no-op passthrough (seam only).
10. **Wire apps** — inject transport at each root; swap raw
    reads/`httpsCallable` for hooks; web first, then RN.

Steps 1–4 are non-behavioral and unblock everything; 5 is the server lift; 6–10
are the fat-SDK build-out.

```

```
