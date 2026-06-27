# @levelup/api-client — Core Layer Plan

> **Layer key:** `api-client-core` **Package:** `@levelup/api-client` **Position
> in the cake:** `@levelup/domain` ← `@levelup/api-contract` ←
> **`@levelup/api-client`** ← `@levelup/repositories` ← `@levelup/query` ← apps.
> **Owns:** `createApiClient(transport, opts)` — the typed, namespaced call
> surface; pre-flight request validation; dev-mode response validation;
> `normalizeError` (`HttpsError`/anything → `ApiError`); retry policy; UUID-v7
> `idempotencyKey` generation for `def.idempotent` callables; the optional
> offline-queue routing hook; the realtime `subscribe()` pass-through. **Does
> NOT own:** schemas (those are `@levelup/api-contract`), entities
> (`@levelup/domain`), shaping/batching/cursors (`@levelup/repositories`),
> React/caching (`@levelup/query`), the actual transport impl
> (`@levelup/transport-*`). **Sources reconciled:** `specs/SDK-SERVER-DESIGN.md`
> §2.3, §5.2, §5.4, §5.7; `specs/common-api.md` §5, §6, §7;
> `status/REVIEW-domain-data-model.md` §6 (authority boundary), §7 (idempotency,
> tenantId).
>
> **Principle applied:** LEAN UI + LEAN-AUTHORITATIVE SERVER + FAT SDK. This
> layer is pure ergonomics + safety: it validates, normalizes, retries, and keys
> idempotency so every layer above it can be dumb. It holds **zero authority**
> (no `tenantId`, no auth decisions, no scoring) and **zero framework** (no
> React, no DOM, no firebase, no node-only API) — so it runs byte-identical on
> web + React Native.

---

## 0. Locked decisions (this layer)

| Area              | Decision                                                                                                                                                                                                                                             | Rationale                                                                                                                                                          |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Validation timing | **Request validated ALWAYS** (`requestSchema.parse` pre-flight, every env); **response validated in DEV only** (`validateResponses` opt)                                                                                                             | request validation is a correctness gate that strips stray fields incl. any stray `tenantId` (`.strict()`); response validation is a drift detector with prod cost |
| tenantId          | **No `tenantId` field exists in any tenant-scoped request schema**; `.strict()` parse would reject it anyway                                                                                                                                         | REVIEW §6.1 / D2 — the #1 authority boundary; enforced by contract test, not by this layer's runtime                                                               |
| Idempotency key   | **UUID v7** (time-ordered), generated **once per logical call** by api-client for `def.idempotent` callables; **stable across retries**; injected as `__idempotencyKey` envelope field                                                               | SDK-SERVER §5.4; server dedupes on `(uid, key)`; v7 gives sortable keys for server-side outbox/replay                                                              |
| Retry             | **Opt-in, bounded, jittered exponential backoff**; retries ONLY on `retryable === true` (network / `UNAVAILABLE` / `DEADLINE_EXCEEDED` / `RATE_LIMITED`) **and** only idempotent-safe calls (`def.idempotent === true` OR `def.rateTier === 'read'`) | never silently re-run a non-idempotent mutation (double grade / double purchase)                                                                                   |
| Error model       | **`normalizeError` is the single funnel** — every thrown error becomes a stable `ApiError`; copy/recovery hints live in `@levelup/api-contract` maps, surfaced by `@levelup/query`'s `useApiError`                                                   | SDK-SERVER §5.2; one envelope both sides                                                                                                                           |
| Offline           | **Seam only in v1** — api-client accepts an optional `OfflineQueue`; when present, _idempotent mutations_ route through it; default is a no-op passthrough                                                                                           | SDK-SERVER §5.7; idempotency keys are the prerequisite and they ship day one                                                                                       |
| Realtime          | **Pass-through only** — `createApiClient` re-exposes `transport.subscribe` typed against `SUBSCRIPTIONS`; full realtime hooks live in `@levelup/realtime`/`@levelup/query`                                                                           | SDK-SERVER §5.6 — keep the seam, don't build the impl here                                                                                                         |
| Transport         | **Injected `Transport`**; api-client never imports `firebase`                                                                                                                                                                                        | the ONLY platform-specific code is the transport adapter (SDK-SERVER §6)                                                                                           |
| Clock             | **Injected `now()`** (default `Date.now`) for backoff jitter + key timestamp seeding — testable                                                                                                                                                      | deterministic tests                                                                                                                                                |

---

## 1. Package layout

```
packages/api-client/
├── package.json            # name @levelup/api-client; deps: @levelup/domain, @levelup/api-contract, uuid (v7); peerless
├── tsconfig.json           # extends root; "composite": true; references domain + api-contract
├── src/
│   ├── index.ts            # public barrel — re-exports the symbols in §3
│   ├── create-client.ts    # createApiClient(transport, opts) + the call() factory + namespacing
│   ├── types.ts            # ApiClient, ApiClientOptions, CallFn, ApiClientNamespaces, internal Ctx types
│   ├── validate.ts         # validateRequest / validateResponse (wrap zod .parse, throw normalized)
│   ├── errors.ts           # normalizeError, ApiError class, isApiError, fromZodError, fromTransportError
│   ├── retry.ts            # withRetry(fn, policy), DEFAULT_RETRY_POLICY, computeBackoff, isRetryable
│   ├── idempotency.ts      # generateIdempotencyKey (uuid v7), IdempotencyKeyFactory, attachIdempotencyKey
│   ├── offline.ts          # OfflineQueue interface, NoopOfflineQueue, routeThroughQueue
│   ├── envelope.ts         # RequestEnvelope helpers: wraps __idempotencyKey / __apiVersion onto the wire payload
│   ├── realtime.ts         # makeSubscribe(transport) — typed pass-through over SUBSCRIPTIONS
│   └── namespaces.ts       # buildNamespaces(call): maps every CALLABLE → api.<module>.<op>
└── test/
    ├── create-client.test.ts
    ├── validate.test.ts
    ├── errors.test.ts
    ├── retry.test.ts
    ├── idempotency.test.ts
    ├── offline.test.ts
    ├── namespaces.contract.test.ts   # asserts every CALLABLE is reachable + correctly namespaced
    └── boundary.lint.test.ts         # asserts no firebase/react/dom import escapes the package
```

> **`namespaces.ts` generation.** To avoid a hand-maintained method table
> drifting from `CALLABLES`, `buildNamespaces` derives the namespaced object
> **from the registry at construction time** (groups by `def.module`, derives
> the method key from the operation segment of `name`). The public `ApiClient`
> _type_ is then a mapped type over `CALLABLES` (§3.2) so it stays exhaustive at
> compile time with zero manual upkeep.

---

## 2. Dependencies (downward-only — enforced)

| Depends on                            | Why                                                                                                                                                                                        | Allowed?                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| `@levelup/api-contract`               | `CALLABLES`, `CallableName`, `ReqOf`, `ResOf`, `SUBSCRIPTIONS`, `SubscriptionName`, `ParamsOf`, `PayloadOf`, `AppErrorCode`, `ApiErrorDetails`, `HTTPS_TO_APP_ERROR`, `APP_ERROR_TO_HTTPS` | ✅ one layer down                                |
| `@levelup/domain`                     | `JsonValue`, branded-ID passthrough types (only for `ApiError.meta` typing)                                                                                                                | ✅ two layers down                               |
| `uuid` (or a tiny inlined v7 impl)    | UUID v7 generation                                                                                                                                                                         | ✅ leaf util, RN-safe, no node-only API          |
| `@levelup/transport-*`                | — **NEVER imported**; injected as `Transport`                                                                                                                                              | ❌ forbidden (would invert the seam)             |
| `firebase`, `firebase-functions`      | — **NEVER**                                                                                                                                                                                | ❌ forbidden (platform coupling; functions-only) |
| `react`, `@tanstack/react-query`, DOM | — **NEVER**                                                                                                                                                                                | ❌ forbidden (RN/node reuse)                     |

**Lint enforcement** (`no-restricted-imports` in the package's ESLint config):

```jsonc
"no-restricted-imports": ["error", { "paths": [
  { "name": "firebase", "message": "api-client must stay transport-agnostic; inject Transport." },
  { "name": "firebase/functions", "message": "no firebase in api-client." },
  { "name": "firebase-functions", "message": "server-only." },
  { "name": "react", "message": "api-client is framework-free." },
  { "name": "@tanstack/react-query", "message": "lives in @levelup/query." }
], "patterns": [
  { "group": ["@levelup/transport-*"], "message": "transport is injected, never imported." },
  { "group": ["@levelup/repositories", "@levelup/query", "@levelup/realtime"], "message": "no upward imports." }
]}]
```

---

## 3. Public API — every exported symbol

### 3.1 The factory

```ts
/**
 * Build the typed, namespaced SDK over an injected transport.
 * The ONLY platform difference is `transport`; everything else is identical web↔RN.
 */
export function createApiClient(
  transport: Transport,
  opts?: ApiClientOptions
): ApiClient;

export interface ApiClientOptions {
  /** DEV: run responseSchema.parse(res) to catch server↔client drift. Default: false. */
  validateResponses?: boolean;
  /** Override the idempotency-key generator (default = uuidv7-based). Stable across retries of one call. */
  getIdempotencyKey?: IdempotencyKeyFactory;
  /** Retry policy for retryable + idempotent-safe calls. Default = DEFAULT_RETRY_POLICY. Pass `false` to disable. */
  retry?: RetryPolicy | false;
  /** Optional offline queue; when present, idempotent mutations route through it (v1 default: NoopOfflineQueue). */
  offlineQueue?: OfflineQueue;
  /** Injected clock for backoff jitter + key seeding (testable). Default: Date.now. */
  now?: () => number;
  /** Hook fired on every normalized error (telemetry/log). Must not throw. */
  onError?: (err: ApiError, name: CallableName) => void;
  /** apiVersion stamped onto the envelope; defaults to API_VERSION from the contract. */
  apiVersion?: string;
}
```

### 3.2 The client type (mapped over the registry — exhaustive, zero manual upkeep)

```ts
import type {
  CALLABLES,
  CallableName,
  ReqOf,
  ResOf,
} from "@levelup/api-contract";

/** A single callable method: req in → res out, fully typed off the registry. */
export type CallFn<N extends CallableName> = (
  data: ReqOf<N>
) => Promise<ResOf<N>>;

/** Extracts the module of a callable name at the type level: 'v1.levelup.saveSpace' → 'levelup'. */
type ModuleOf<N extends CallableName> = (typeof CALLABLES)[N]["module"];
/** Extracts the operation segment: 'v1.levelup.saveSpace' → 'saveSpace'. */
type OpOf<N extends string> = N extends `${string}.${string}.${infer Op}`
  ? Op
  : never;

/** The namespaced surface, derived structurally from CALLABLES so it can never drift. */
export type ApiClient = {
  [M in ModuleOf<CallableName>]: {
    [N in CallableName as ModuleOf<N> extends M ? OpOf<N> : never]: CallFn<N>;
  };
} & {
  /** Typed realtime pass-through (seam; impl in @levelup/transport-* / @levelup/realtime). */
  subscribe: SubscribeFn;
  /** Escape hatch for repositories that need a name they hold dynamically. Still validated. */
  call<N extends CallableName>(name: N): CallFn<N>;
};
```

Result shape (illustrative, fully derived):

```ts
api.identity.saveTenant(req); // v1.identity.saveTenant
api.identity.switchActiveTenant(req);
api.levelup.saveSpace(req); // v1.levelup.saveSpace
api.levelup.submitTestSession(req); // idempotent → keyed + retry-safe
api.autograde.gradeQuestion(req); // NEVER auto-retried (non-idempotent mutation)
api.analytics.getSummary(req);
api.subscribe("v1.levelup.testSessionDeadline", { sessionId }, cb);
```

### 3.3 Error surface

```ts
/** Stable client-side error. The single type every layer above catches. */
export class ApiError extends Error {
  readonly code: AppErrorCode; // from contract; falls back to 'UNKNOWN'
  readonly retryable: boolean;
  readonly validationErrors?: { path: string; message: string }[];
  readonly meta?: Record<string, JsonValue>;
  readonly cause?: unknown; // original thrown error (HttpsError / ZodError / network)
  readonly callable?: CallableName; // which call produced it (set by the funnel)
  readonly httpsCode?: string; // raw firebase code if present (for useApiError fallback)
  constructor(init: ApiErrorInit);
  toJSON(): ApiErrorDetails & { callable?: CallableName };
}

export interface ApiErrorInit {
  code: AppErrorCode;
  message: string;
  retryable?: boolean;
  validationErrors?: { path: string; message: string }[];
  meta?: Record<string, JsonValue>;
  cause?: unknown;
  callable?: CallableName;
  httpsCode?: string;
}

/** Map ANY thrown error → ApiError. The single normalization funnel. */
export function normalizeError(e: unknown, callable?: CallableName): ApiError;

/** Type guard for callers (query error boundary, repos). */
export function isApiError(e: unknown): e is ApiError;

/** Build an ApiError from a ZodError (request/response validation failures). */
export function fromZodError(e: ZodError, callable?: CallableName): ApiError; // → code VALIDATION_ERROR

/** Build an ApiError from a transport/HttpsError-shaped object (duck-typed; no firebase import). */
export function fromTransportError(
  e: unknown,
  callable?: CallableName
): ApiError;
```

`normalizeError` resolution order (no `firebase` import — duck-typed):

1. Already an `ApiError` → return as-is (attach `callable` if missing).
2. `ZodError` → `fromZodError` → `code: VALIDATION_ERROR`, `validationErrors`
   from `e.issues`, `retryable: false`.
3. Object with `details.code` matching an `AppErrorCode` → use the typed
   `ApiErrorDetails` verbatim (this is the server's `fail()` envelope, §5.2).
4. Object with a firebase-style `code` string (e.g. `'functions/unavailable'`) →
   map via `HTTPS_TO_APP_ERROR`, set `httpsCode`, derive `retryable` from the
   resulting code.
5. `TypeError`/network/`AbortError`/offline → `code: NETWORK_ERROR`,
   `retryable: true`.
6. Anything else → `code: UNKNOWN`, `retryable: false`, `cause: e`.

### 3.4 Retry

```ts
export interface RetryPolicy {
  maxAttempts: number; // default 3 (1 try + 2 retries)
  baseDelayMs: number; // default 200
  maxDelayMs: number; // default 4000
  jitter: "full" | "none"; // default 'full'
  /** Decide retryability given the normalized error + def. Default = isRetryable. */
  shouldRetry?: (
    err: ApiError,
    def: CallableDef<unknown, unknown>,
    attempt: number
  ) => boolean;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy;

/** Pure decision: retryable error AND idempotent-safe (def.idempotent || rateTier==='read'). */
export function isRetryable(
  err: ApiError,
  def: CallableDef<unknown, unknown>
): boolean;

/** Wrap an attempt fn with bounded, jittered backoff. now() injected for tests. */
export function withRetry<T>(
  attempt: (attemptNo: number) => Promise<T>,
  policy: RetryPolicy,
  ctx: {
    def: CallableDef<unknown, unknown>;
    now: () => number;
    sleep?: (ms: number) => Promise<void>;
  }
): Promise<T>;

/** Exponential backoff with full jitter; pure + testable. */
export function computeBackoff(
  attempt: number,
  policy: RetryPolicy,
  rand?: () => number
): number;
```

**Retry safety invariant:** `withRetry` re-invokes `attempt` with the **same**
`idempotencyKey` (the key is generated once, _before_ `withRetry` wraps the call
— see §4 flow), so a server-side dedupe makes retries exactly-once.
Non-idempotent mutations (`gradeQuestion`, `saveSpace` publish, `purchaseSpace`
is idempotent-keyed but its retry is still gated by `def.idempotent`) never
satisfy `isRetryable` and therefore run at-most-once.

### 3.5 Idempotency

```ts
export type IdempotencyKeyFactory = (name: CallableName) => string;

/** Default factory: UUID v7 (time-ordered). One key per logical call, reused across retries. */
export const generateIdempotencyKey: IdempotencyKeyFactory;

/** Attach the key to the wire envelope for def.idempotent callables only. */
export function attachIdempotencyKey<N extends CallableName>(
  name: N,
  req: ReqOf<N>,
  def: CallableDef<unknown, unknown>,
  key: string
): ReqOf<N> & { __idempotencyKey?: string };
```

- Generated **only** when `def.idempotent === true`. Inventory (SDK-SERVER
  §5.4): `createOrgUser`, `bulkImportStudents`, `bulkImportTeachers`,
  `bulkUpdateStatus`, `submitTestSession`, `recordItemAttempt`,
  `evaluateAnswer`, `uploadAnswerSheets`, `purchaseSpace`.
- Carried as a reserved envelope field `__idempotencyKey` (NOT a schema field —
  so `.strict()` request schemas stay clean; the envelope wrapper adds/strips it
  outside the schema). Server reads it from the envelope, dedupes on
  `(uid, __idempotencyKey)`.
- Stable across the whole `withRetry` lifetime and (later) across offline replay
  — the key is the join point for both.

### 3.6 Offline (seam only — v1)

```ts
export interface QueuedCall<N extends CallableName = CallableName> {
  name: N;
  data: ReqOf<N>;
  idempotencyKey: string; // mandatory — replay safety hinge
  enqueuedAt: number;
}

export interface OfflineQueue {
  /** Returns a promise that resolves when the call is eventually delivered (or rejects if dropped). */
  enqueue<N extends CallableName>(call: QueuedCall<N>): Promise<ResOf<N>>;
  flush(): Promise<void>;
  readonly status: "idle" | "flushing" | "offline";
}

/** v1 default: passthrough — calls `deliver` immediately, no persistence. */
export class NoopOfflineQueue implements OfflineQueue {
  /* immediate-deliver */
}

/** Internal: route a call through the queue when offlineQueue is present AND def.idempotent. */
export function routeThroughQueue<N extends CallableName>(
  queue: OfflineQueue | undefined,
  name: N,
  data: ReqOf<N>,
  key: string,
  deliver: () => Promise<ResOf<N>>
): Promise<ResOf<N>>;
```

Only `def.idempotent` mutations are queue-eligible (replay must be safe). Reads
and non-idempotent writes always go direct. Building the real queue later
requires **no change** to api-client's public surface or to any layer above it.

### 3.7 Realtime pass-through

```ts
import type {
  SubscriptionName,
  ParamsOf,
  PayloadOf,
  SubscriptionHandle,
} from "@levelup/api-contract";

export type SubscribeFn = <S extends SubscriptionName>(
  name: S,
  params: ParamsOf<S>,
  cb: (payload: PayloadOf<S>) => void
) => SubscriptionHandle;

/** Wrap transport.subscribe with dev-mode payload validation off SUBSCRIPTIONS[name].payload. */
export function makeSubscribe(
  transport: Transport,
  opts: Pick<ApiClientOptions, "validateResponses">
): SubscribeFn;
```

Identical seam shape to `invoke`; impl is Firestore/RTDB in
`@levelup/transport-firebase`, SSE/WS later in `@levelup/transport-http`. In
dev, payloads are validated against `SUBSCRIPTIONS[name].payload` so realtime
drift surfaces too.

### 3.8 Validation helpers (exported for repositories/tests)

```ts
/** Parse-or-throw-ApiError; ALWAYS runs (every env). Strips stray fields via .strict() (incl. any tenantId). */
export function validateRequest<N extends CallableName>(
  name: N,
  data: unknown
): ReqOf<N>;

/** DEV-only response parse; logs+throws on drift when enabled, passthrough otherwise. */
export function validateResponse<N extends CallableName>(
  name: N,
  res: unknown,
  enabled: boolean
): ResOf<N>;
```

### 3.9 Re-exports (convenience, so consumers import one package)

`Transport`, `CallableName`, `ReqOf`, `ResOf`, `AppErrorCode`, `ApiErrorDetails`
are re-exported from `@levelup/api-contract` through the barrel so
repositories/query don't reach two packages deep for the common names.

---

## 4. The end-to-end call path (inside `call()`)

```ts
function call<N extends CallableName>(name: N): CallFn<N> {
  const def = CALLABLES[name];
  return async (data: ReqOf<N>): Promise<ResOf<N>> => {
    try {
      // 1. PRE-FLIGHT VALIDATE — always. .strict() rejects stray fields incl. any tenantId leak.
      const req = validateRequest(name, data);

      // 2. IDEMPOTENCY — generate ONCE (before retry/queue) for def.idempotent callables.
      const key = def.idempotent
        ? (opts.getIdempotencyKey ?? generateIdempotencyKey)(name)
        : undefined;
      const envelope = key
        ? attachIdempotencyKey(name, req, def, key)
        : withApiVersion(req, def);

      // 3. DELIVER — the unit retry/queue wrap. Same envelope (same key) on every attempt.
      const deliver = () =>
        validateResponse(
          name,
          await transport.invoke(name, envelope),
          !!opts.validateResponses
        );

      // 4. OFFLINE ROUTING — idempotent mutations may route through the queue (v1: noop passthrough).
      const send =
        def.idempotent && opts.offlineQueue
          ? () => routeThroughQueue(opts.offlineQueue, name, req, key!, deliver)
          : deliver;

      // 5. RETRY — only retryable + idempotent-safe; same key across attempts → exactly-once on server.
      const policy =
        opts.retry === false ? NO_RETRY : (opts.retry ?? DEFAULT_RETRY_POLICY);
      return await withRetry((n) => send(), policy, {
        def,
        now: opts.now ?? Date.now,
      });
    } catch (e) {
      const err = normalizeError(e, name); // 6. NORMALIZE — single funnel → ApiError
      opts.onError?.(err, name);
      throw err;
    }
  };
}
```

Ordering rationale: validate (cheap fail-fast) → key (before any retry so it's
stable) → wrap retry/queue around delivery → normalize at the outermost boundary
so EVERY failure path (validation, transport, response-drift) yields one
`ApiError`.

---

## 5. Provider wiring (how apps consume this layer)

This layer is constructed once at each app root; everything above is
byte-identical web↔RN (only `transport` differs):

```ts
// WEB — apps/*/src/main.tsx
const transport = createFirebaseTransport(getFirebaseServices(), {
  region: REGION,
});
const api = createApiClient(transport, {
  validateResponses: import.meta.env.DEV,
});

// REACT NATIVE — apps-rn/*/App.tsx  (identical except env)
const transport = createFirebaseTransport(getFirebaseServicesRN(), {
  region: REGION,
});
const api = createApiClient(transport, { validateResponses: __DEV__ });
```

`@levelup/repositories` receives `api` (never the transport); `@levelup/query`'s
`<ApiProvider>` holds `{ api, repos, transport }`.

---

## 6. Contract / lint tests this layer requires

> Test runner: `vitest`. No emulator needed for this layer (transport is
> mocked); a thin emulator round-trip lives in the cross-cutting contract-test
> suite, not here.

### 6.1 Namespacing / registry-coverage contract tests (`namespaces.contract.test.ts`)

- **Exhaustiveness:** for every `name` in `CALLABLES`, `api[module][op]` is a
  function reachable and resolves the same `name` (group/op derivation matches
  the registry). Fails if a callable is added without a method.
- **No orphan methods:** every method on the namespaced surface maps back to
  exactly one `CALLABLES` key.
- **Module grouping integrity:** `ModuleOf`/`OpOf` derivation produces no
  `never`/collision (two callables can't derive the same `module.op`).
- **Type-level exhaustiveness:** a `tsd`/`expectType` assertion that
  `keyof ApiClient` ⊇ the four modules and each method's param = `ReqOf<N>`,
  return = `Promise<ResOf<N>>`.

### 6.2 Request-validation tests (`validate.test.ts`)

- Pre-flight `.parse` runs in **all** envs (not gated by `validateResponses`).
- **tenantId leak guard:** for a representative tenant-scoped callable, passing
  `{ ...valid, tenantId: 'x' }` is **rejected** (`.strict()`), proving the SDK
  cannot smuggle a body tenantId (REVIEW D2/§6.1). (Companion to the
  contract-level test asserting no request schema _declares_ `tenantId`.)
- Stray-field rejection generally; valid input passes untouched.
- Response validation runs **only** when `validateResponses: true`; a drifted
  response throws `VALIDATION_ERROR` in dev and is **passed through** in prod.

### 6.3 Error-normalization tests (`errors.test.ts`)

- `ZodError` → `VALIDATION_ERROR` with `validationErrors` populated,
  `retryable: false`.
- Server `fail()` envelope
  (`details.code = 'INVALID_TRANSITION' | 'QUOTA_EXCEEDED' | 'PERMISSION_DENIED' | 'TENANT_SUSPENDED' | 'RATE_LIMITED' | 'NOT_FOUND' | 'FEATURE_DISABLED'`)
  → preserved verbatim into `ApiError`.
- Firebase-style `{ code: 'functions/unavailable' }` (duck-typed, no firebase
  import) → mapped via `HTTPS_TO_APP_ERROR`, `httpsCode` set, `retryable`
  derived.
- Network/`AbortError`/`TypeError` → `NETWORK_ERROR`, `retryable: true`.
- Unknown → `UNKNOWN`, `retryable: false`, `cause` preserved.
- `isApiError` guard true/false matrix; `normalizeError(apiErr)` is idempotent.

### 6.4 Retry tests (`retry.test.ts`)

- `computeBackoff` is bounded by `maxDelayMs`, monotonic-in-expectation,
  full-jitter within range (seeded `rand`).
- **Non-idempotent mutation is NEVER retried** even on a retryable error
  (`gradeQuestion`, publish): `isRetryable` returns false because
  `def.idempotent !== true && def.rateTier !== 'read'`. This is the
  safety-critical test (no double grade/purchase).
- Read (`rateTier: 'read'`) on `UNAVAILABLE` → retried up to `maxAttempts`.
- Idempotent mutation (`submitTestSession`) retried with the **same**
  `idempotencyKey` on every attempt (assert key stability across attempts).
- `retry: false` disables retries; exhausted attempts re-throw the last
  normalized error.

### 6.5 Idempotency tests (`idempotency.test.ts`)

- Key generated **iff** `def.idempotent`; absent for reads/non-idempotent
  writes.
- Generated key is UUID v7 (version nibble = 7, time-ordered: later calls sort
  after earlier).
- `getIdempotencyKey` override is honored.
- `__idempotencyKey` lands on the **envelope**, never inside the
  schema-validated body (so `.strict()` is unaffected).

### 6.6 Offline-seam tests (`offline.test.ts`)

- With no queue: idempotent + non-idempotent both go direct.
- With `NoopOfflineQueue`: idempotent mutation routes through `enqueue` (which
  immediately delivers); reads + non-idempotent writes bypass the queue.
- `QueuedCall.idempotencyKey` is always set for queued calls.

### 6.7 Boundary lint test (`boundary.lint.test.ts` + ESLint rule)

- Static assert (grep/AST) that no `src/**` file imports `firebase`,
  `firebase-functions`, `react`, `@tanstack/react-query`,
  `@levelup/transport-*`, or any upward
  `@levelup/{repositories,query,realtime}`.
- CI builds an **RN bundle** of `@levelup/api-client` to catch accidental
  node-only/DOM coupling (mirrors SDK-SERVER §7.2 RN-bundle gate).

### 6.8 Realtime pass-through test (`create-client.test.ts`)

- `api.subscribe(name, params, cb)` forwards to `transport.subscribe`; in dev,
  an off-schema payload throws/logs; returns a `SubscriptionHandle` whose
  `unsubscribe` is forwarded.

---

## 7. Open questions / risks (this layer)

| Item                                                                                                                                             | Disposition                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Envelope vs body for `__idempotencyKey`/`__apiVersion`.** Putting them in the body would force every `.strict()` request schema to allow them. | **Resolved:** carry them on a thin envelope wrapper outside the schema; transport unwraps. Requires the contract to reserve `__`-prefixed envelope keys and the server `parseRequest` to read them pre-validation. Cross-check with the api-contract layer plan. |
| **`HttpsError` duck-typing.** We refuse to import `firebase` here, so `fromTransportError` pattern-matches `{ code, message, details }`.         | Acceptable; the transport layer may also pre-normalize to a neutral shape. Keep both paths in `normalizeError`.                                                                                                                                                  |
| **Retry on `RATE_LIMITED`.** Server may send `Retry-After`/`meta.retryAfterMs`.                                                                  | `computeBackoff` honors `err.meta.retryAfterMs` when present (overrides jittered backoff for that attempt).                                                                                                                                                      |
| **UUID v7 availability on RN/Hermes.**                                                                                                           | Use a dependency-light v7 (or inline ~30-line impl) with no node `crypto` hard-dependency; fall back to `crypto.getRandomValues` (present in RN + browsers).                                                                                                     |
| **Response validation cost in prod.**                                                                                                            | Gated off by default (`validateResponses: false` in prod); only the request parse runs always.                                                                                                                                                                   |
| **Where does `useApiError` live?**                                                                                                               | Not here — it's a `@levelup/query` hook reading `ApiError.code` → `ERROR_MESSAGES`/`ERROR_RECOVERY_HINTS` (from api-contract). This layer only produces the stable `ApiError`.                                                                                   |

---

## 8. Build order (within step 4 of the global plan)

1. `errors.ts` (`ApiError`, `normalizeError`, the maps wiring) — depended on by
   everything.
2. `validate.ts` (request always, response dev) on top of `errors`.
3. `idempotency.ts` (uuid v7 factory + envelope attach).
4. `retry.ts` (`isRetryable` + `withRetry` + backoff).
5. `offline.ts` (interface + `NoopOfflineQueue` + `routeThroughQueue`).
6. `envelope.ts` + `realtime.ts` (`makeSubscribe`).
7. `namespaces.ts` + `create-client.ts` (assemble `call()` per §4, build
   namespaced surface).
8. `index.ts` barrel + all `test/*`. Non-behavioral; unblocks
   `@levelup/repositories` (step 6 global).
