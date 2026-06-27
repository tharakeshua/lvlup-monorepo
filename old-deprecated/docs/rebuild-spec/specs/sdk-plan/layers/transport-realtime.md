# SDK Layer Plan — `@levelup/transport-firebase` + `@levelup/realtime` + `@levelup/offline`

> **Layer scope.** The three _side-seam / transport-adapter_ packages of the SDK
> layer cake: the **only platform-specific code**
> (`@levelup/transport-firebase`), the **realtime seam** (`@levelup/realtime` —
> built now, Firestore/RTDB impl), and the **offline seam** (`@levelup/offline`
> — interface + no-op passthrough, deferred). Plus the **future-stub shape** for
> `@levelup/transport-http`.
>
> **Grounding.** SDK-SERVER-DESIGN §1 (layer cake), §2.2 (Transport seam), §5.6
> (realtime seam), §5.7 (offline deferred), §6 (transport injection web+RN),
> §7.1 open-Q #1 (`useServerTime()`). common-api §5.1 (transport seam), §10
> (realtime parallel concern). REVIEW §6 #6 (test-clock authority is
> server-side: `serverDeadline` + `/serverTimeOffset`, never client clock).
>
> **Non-negotiables this layer honors.**
>
> 1. **LEAN UI / LEAN-AUTHORITATIVE SERVER / FAT SDK** — this layer is _thin
>    glue_: it carries bytes and validates payload shape at the wire edge. **No
>    domain logic, no shaping, no derived fields** live here (those live in
>    `@levelup/repositories`). The realtime layer's only "logic" is payload
>    Zod-validation + handle lifecycle.
> 2. **Trust-layered, strictly-downward deps.** `transport-firebase`,
>    `realtime`, `offline` all depend **only** on `@levelup/api-contract` (+
>    `@levelup/domain` transitively) and the injected platform SDK (`firebase`).
>    They **never** import `@levelup/api-client`, `@levelup/repositories`,
>    `@levelup/query`, or each other (except `transport-firebase` → `realtime`
>    types via `api-contract` shared interface). See §7.
> 3. **NO direct Firestore anywhere except the repository admin adapter (server)
>    and THIS transport adapter.** `transport-firebase` is the single
>    client-side place `firebase/firestore`, `firebase/database`, and
>    `firebase/functions` are imported. Enforced by `no-restricted-imports` lint
>    everywhere else (§8).
> 4. `tenantId` is **never** added to a callable payload here — the transport
>    forwards the ID token and the **server** derives tenant from claims. This
>    layer has no `tenantId` knowledge at all.
> 5. Realtime is **read-only**. Subscriptions stream server-authoritative
>    projections; the SDK never writes through a subscription. The test clock's
>    `serverDeadline` is streamed, not computed here.

---

## 0. Package set & responsibilities

| Package                       | Built when                  | Owns                                                                                                                                                                                                                                  | Platform deps                                                |
| ----------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `@levelup/transport-firebase` | **now** (build step 3)      | `Transport` impl: `invokeViaCallable` (callable, region cfg, ID-token forwarding, error pass-through), `subscribeViaFirestore`, `subscribeViaRTDB`, the subscription→source resolver, region/config module, server-time offset reader | `firebase` (`app`,`functions`,`firestore`,`database`,`auth`) |
| `@levelup/realtime`           | **now** (build step 8)      | `subscribe()` seam re-export, `SubscriptionHandle`, `RealtimeProvider`, `useSubscription`, `useServerTime`, per-subscription convenience hooks, payload validation wrapper, dedupe/refcount registry                                  | `react` (peer), nothing web/node-specific                    |
| `@levelup/offline`            | **stub now** (build step 9) | `OfflineQueue` interface + `createNoopOfflineQueue()` passthrough; `QueuedCall` type; status enum. **No real queue in v1.**                                                                                                           | none                                                         |
| `@levelup/transport-http`     | **future stub**             | `invokeViaHttp` + `subscribeViaSSE`/`subscribeViaWebSocket` shape only (signatures, no impl)                                                                                                                                          | none web-specific (`fetch`/`EventSource`)                    |

Dependency direction (all strictly downward, never upward, never sideways into
client/repos/query):

```
@levelup/domain  ←  @levelup/api-contract  ←  { transport-firebase, realtime, offline, transport-http }
                                                        │ (firebase / react peer / fetch)
                                              injected at app root into → @levelup/api-client + @levelup/query
```

---

## 1. The `Transport` contract (defined in `@levelup/api-contract`, implemented here)

> **Source of truth.** The `Transport` interface itself lives in
> `@levelup/api-contract` (`src/transport/transport.ts`) so both
> `@levelup/api-client` (consumer) and the transport adapters (implementers)
> reference one shape without a cycle. This layer plan re-states it for
> completeness and **implements** it; it does not re-declare it.

```ts
// @levelup/api-contract  (referenced, not owned by this layer)
import type { CallableName, ReqOf, ResOf } from "./callables";
import type { SubscriptionName, ParamsOf, PayloadOf } from "./subscriptions";

export interface SubscriptionHandle {
  /** Idempotent. Detaches the underlying listener (refcount-aware in the realtime layer). */
  unsubscribe(): void;
  /** Stable id for dedupe/debug logging. */
  readonly id: string;
  /** True until unsubscribe() is called. */
  readonly active: boolean;
}

export interface SubscriptionCallbacks<P> {
  next: (payload: P) => void;
  error?: (err: ApiError) => void; // ApiError from api-contract error model
  /** Fired once the first server snapshot has been received (vs local-cache hydrate). */
  onSynced?: () => void;
}

export interface Transport {
  invoke<N extends CallableName>(name: N, data: ReqOf<N>): Promise<ResOf<N>>;

  subscribe<S extends SubscriptionName>(
    name: S,
    params: ParamsOf<S>,
    cb: SubscriptionCallbacks<PayloadOf<S>> | ((payload: PayloadOf<S>) => void)
  ): SubscriptionHandle;

  /** Server-time primitive (SDK-SERVER §7.1.1). Resolves the RTDB /.info/serverTimeOffset value.
   *  Returns offset in ms (serverNow ≈ Date.now() + offset). Subscribable for drift. */
  serverTimeOffset(cb: (offsetMs: number) => void): SubscriptionHandle;

  /** Token seam used by meRepo.switchTenant: force a fresh ID token after claims re-stamp
   *  (identity domain open-Q #4). No-op for transports without Firebase Auth. */
  refreshToken(forceRefresh?: boolean): Promise<void>;
}
```

`@levelup/transport-firebase` exports a factory returning a `Transport`.
`@levelup/realtime` consumes the `subscribe` / `serverTimeOffset` half;
`@levelup/api-client` consumes the `invoke` / `refreshToken` half. Neither knows
the concrete implementation.

---

## 2. `@levelup/transport-firebase`

### 2.1 File layout

```
packages/transport-firebase/
  package.json                         # name @levelup/transport-firebase; deps: firebase, @levelup/api-contract
  tsconfig.json
  src/
    index.ts                           # public barrel
    create-firebase-transport.ts       # createFirebaseTransport(services, opts) → Transport
    config/
      region.ts                        # REGION const + resolveRegion(opts) + EMULATOR_HOSTS
      firebase-services.ts             # FirebaseTransportServices type (subset of app's FirebaseServices)
    invoke/
      invoke-via-callable.ts           # invokeViaCallable(functions, name, data) → ResOf<N>
      normalize-callable-error.ts      # FunctionsError → throw-through (api-client owns ApiError mapping)
    subscribe/
      subscribe.ts                     # subscribe(name, params, cb) — dispatches to source resolver
      subscription-sources.ts          # SUBSCRIPTION_SOURCES: name → SourceDescriptor (firestore|rtdb)
      subscribe-via-firestore.ts       # subscribeViaFirestore(db, descriptor, params, cb)
      subscribe-via-rtdb.ts            # subscribeViaRTDB(rtdb, descriptor, params, cb)
      validate-payload.ts              # parse snapshot → PayloadOf<S> via SUBSCRIPTIONS[name].payload
    server-time/
      server-time-offset.ts            # serverTimeOffset(rtdb, cb) over /.info/serverTimeOffset
    auth/
      refresh-token.ts                 # refreshToken(auth, force) → getIdToken(true)
  __tests__/
    invoke.contract.test.ts
    subscribe-firestore.test.ts
    subscribe-rtdb.test.ts
    subscription-sources.coverage.test.ts
    server-time.test.ts
    no-direct-firestore-leak.lint.test.ts   # asserts only this pkg imports firebase/firestore|database
```

### 2.2 Exported symbols & signatures

**`config/firebase-services.ts`**

```ts
/** Minimal slice of the app's FirebaseServices this transport needs. Keeps the adapter
 *  decoupled from the full app-level service bag. */
export interface FirebaseTransportServices {
  functions: import("firebase/functions").Functions;
  db: import("firebase/firestore").Firestore;
  rtdb: import("firebase/database").Database;
  auth: import("firebase/auth").Auth;
}
```

**`config/region.ts`**

```ts
export const DEFAULT_REGION = "asia-south1" as const; // single source; kills per-file hardcode (common-api §8 mapping)
export type FunctionsRegion = string;
export interface RegionOptions {
  region?: FunctionsRegion;
  emulator?: EmulatorConfig;
}
export interface EmulatorConfig {
  functionsHost?: string;
  functionsPort?: number;
  firestoreHost?: string;
  firestorePort?: number;
  databaseHost?: string;
  databasePort?: number;
}
export function resolveRegion(opts?: RegionOptions): FunctionsRegion; // opts.region ?? DEFAULT_REGION
```

> Note: region is bound when `getFunctions(app, region)` is called by the app;
> the transport accepts the already-regioned `Functions` instance via
> `services.functions`. `resolveRegion` exists so the app root (and the future
> http transport) share one default. The transport does **not** call
> `initializeFirebase` — that stays in the app's `getFirebaseServices()` (today
> `shared-services/firebase/config.ts`).

**`invoke/invoke-via-callable.ts`**

```ts
export function invokeViaCallable<N extends CallableName>(
  functions: Functions,
  name: N,
  data: ReqOf<N>
): Promise<ResOf<N>>;
//  impl: httpsCallable(functions, name)(data).then(r => r.data as ResOf<N>)
//  • Firebase forwards the caller's ID token automatically — NO manual auth header.
//  • NO tenantId added. NO request reshaping. NO Zod here (api-client validates req pre-flight
//    and res in dev — single validation owner, this layer stays thin).
//  • On FunctionsError: rethrow UNCHANGED — api-client's normalizeError owns HttpsError→ApiError.
```

**`invoke/normalize-callable-error.ts`**

```ts
/** Pass-through marker: extracts the structured details Firebase nests under err.details so
 *  api-client.normalizeError sees the typed ApiErrorDetails envelope (api-contract error model).
 *  Does NOT map codes — only unwraps the Functions transport envelope. */
export function unwrapCallableError(err: unknown): unknown;
```

**`subscribe/subscription-sources.ts`** — the wire-location table (this is the
only place that knows _where_ each subscription's data physically lives; mirrors
`CALLABLES`-style data table):

```ts
export type SubscriptionBackend = "firestore" | "rtdb";

export interface FirestoreSourceDescriptor<S extends SubscriptionName> {
  backend: "firestore";
  /** Builds the doc path OR a (collectionPath + constraints) query from typed params. */
  resolve: (
    params: ParamsOf<S>
  ) =>
    | { docPath: string }
    | { collectionPath: string; where: QueryConstraintSpec[] };
}
export interface RtdbSourceDescriptor<S extends SubscriptionName> {
  backend: "rtdb";
  resolve: (params: ParamsOf<S>) => { nodePath: string };
}
export type SourceDescriptor<S extends SubscriptionName> =
  | FirestoreSourceDescriptor<S>
  | RtdbSourceDescriptor<S>;

/** EXHAUSTIVE map keyed by SubscriptionName — a build-time `satisfies Record<SubscriptionName, …>`
 *  forces a descriptor for every registered subscription (coverage test §8). */
export const SUBSCRIPTION_SOURCES = {
  // ── Firestore-backed (doc/query listeners) ──
  "v1.levelup.testSessionDeadline": {
    backend: "firestore",
    resolve: ({ sessionId }) => ({
      docPath: `__tenant__/digitalTestSessions/${sessionId}`,
    }),
  },
  "v1.levelup.chatStream": {
    backend: "firestore",
    resolve: ({ sessionId }) => ({
      collectionPath: `__tenant__/chatSessions/${sessionId}/messages`,
      where: [["orderBy", "createdAt", "asc"]],
    }),
  },
  "v1.levelup.spaceProgressLive": {
    backend: "firestore",
    resolve: ({ spaceId, userId }) => ({
      docPath: `__tenant__/spaceProgress/${userId}_${spaceId}`,
    }),
  },
  "v1.autograde.gradingStatus": {
    backend: "firestore",
    resolve: ({ submissionId }) => ({
      docPath: `__tenant__/submissions/${submissionId}`,
    }),
  },
  "v1.autograde.examGrading": {
    backend: "firestore",
    resolve: ({ examId }) => ({
      collectionPath: `__tenant__/submissions`,
      where: [["where", "examId", "==", examId]],
    }),
  },
  // ── RTDB-backed (read-only projections) ──
  "v1.notification.badge": {
    backend: "rtdb",
    resolve: () => ({ nodePath: `notifications/__tenant__/__uid__` }),
  },
  "v1.analytics.leaderboard": {
    backend: "rtdb",
    resolve: ({ scope, spaceId, storyPointId }) => ({
      nodePath: leaderboardNode(scope, spaceId, storyPointId),
    }),
  },
} as const satisfies { [S in SubscriptionName]: SourceDescriptor<S> };
```

> **`__tenant__` / `__uid__` placeholders.** The descriptor cannot know
> `tenantId`/`uid` (claim-derived, never client-supplied for _writes_). For
> **reads/subscriptions** the path needs the active tenant + uid to locate the
> doc. These are resolved at `subscribe()` time from `services.auth.currentUser`
> (uid) and the **claim** on the current ID token (`tenantId`) — read-only,
> never from caller input. A `PathContext { tenantId, uid }` is derived once per
> `createFirebaseTransport` and refreshed on `onIdTokenChanged`. This keeps
> tenant scoping authoritative even on the read path.

**`subscribe/subscribe-via-firestore.ts`**

```ts
export function subscribeViaFirestore<S extends SubscriptionName>(
  db: Firestore,
  descriptor: FirestoreSourceDescriptor<S>,
  params: ParamsOf<S>,
  ctx: PathContext,
  cb: SubscriptionCallbacks<PayloadOf<S>>
): SubscriptionHandle;
//  • Builds doc(db, path) → onSnapshot, OR query(collection, ...constraints) → onSnapshot.
//  • Each snapshot → validatePayload(name, snap) → cb.next(payload).
//  • snap.metadata.fromCache === false (first server snapshot) → cb.onSynced?.()
//  • onSnapshot error → cb.error?.(toApiError(err)).
//  • Returns SubscriptionHandle whose unsubscribe() calls the Firestore unsubscriber (idempotent).
```

**`subscribe/subscribe-via-rtdb.ts`**

```ts
export function subscribeViaRTDB<S extends SubscriptionName>(
  rtdb: Database,
  descriptor: RtdbSourceDescriptor<S>,
  params: ParamsOf<S>,
  ctx: PathContext,
  cb: SubscriptionCallbacks<PayloadOf<S>>
): SubscriptionHandle;
//  • ref(rtdb, nodePath) → onValue(ref, snap => cb.next(validatePayload(name, snap.val())))
//  • READ-ONLY: never set()/update()/push() — realtime is read-only (principle 5).
//  • onValue error → cb.error?.(toApiError(err)); off(ref) on unsubscribe.
```

**`subscribe/validate-payload.ts`**

```ts
/** Single payload-shape gate at the wire edge. Uses SUBSCRIPTIONS[name].payload (api-contract).
 *  In dev: throws on parse failure (surfaces drift like the api-client res-validate).
 *  In prod: best-effort parse; on failure routes through cb.error (RATE of stream must not crash UI). */
export function validatePayload<S extends SubscriptionName>(
  name: S,
  raw: unknown,
  mode: "dev" | "prod"
): PayloadOf<S>;
```

**`subscribe/subscribe.ts`** — the dispatcher wired into the `Transport`:

```ts
export function createSubscribe(
  services: FirebaseTransportServices,
  getCtx: () => PathContext,
  mode: "dev" | "prod"
) {
  return function subscribe<S extends SubscriptionName>(
    name: S,
    params: ParamsOf<S>,
    cb: SubscriptionCallbacks<PayloadOf<S>> | ((p: PayloadOf<S>) => void)
  ): SubscriptionHandle {
    const callbacks = typeof cb === "function" ? { next: cb } : cb;
    const descriptor = SUBSCRIPTION_SOURCES[name];
    return descriptor.backend === "firestore"
      ? subscribeViaFirestore(
          services.db,
          descriptor,
          params,
          getCtx(),
          callbacks
        )
      : subscribeViaRTDB(
          services.rtdb,
          descriptor,
          params,
          getCtx(),
          callbacks
        );
  };
}
```

**`server-time/server-time-offset.ts`**

```ts
export function createServerTimeOffset(rtdb: Database) {
  return function serverTimeOffset(
    cb: (offsetMs: number) => void
  ): SubscriptionHandle {
    // ref(rtdb, '/.info/serverTimeOffset') → onValue(snap => cb(snap.val() ?? 0))
    // REVIEW §6 #6: the test clock is server-authoritative; this is the ONLY client-side
    // server-time primitive. serverNow = Date.now() + offsetMs.
  };
}
```

**`auth/refresh-token.ts`**

```ts
export function createRefreshToken(auth: Auth) {
  return async function refreshToken(force = true): Promise<void> {
    // await auth.currentUser?.getIdToken(force)  — used after switchActiveTenant re-stamps claims
    // (identity domain open-Q #4). Also refreshes the cached PathContext.tenantId.
  };
}
```

**`create-firebase-transport.ts`** — the public factory:

```ts
export interface FirebaseTransportOptions {
  region?: FunctionsRegion; // default DEFAULT_REGION (transport doesn't re-region functions)
  validatePayloads?: boolean; // dev: strict subscription payload parse (default false in prod)
  emulator?: EmulatorConfig; // optional, mirrors initializeFirebase emulator wiring
}

export function createFirebaseTransport(
  services: FirebaseTransportServices,
  opts?: FirebaseTransportOptions
): Transport;
//  • Derives PathContext { tenantId, uid } from services.auth on init + onIdTokenChanged.
//  • Returns { invoke, subscribe, serverTimeOffset, refreshToken } fully wired.
```

**`index.ts` barrel exports:** `createFirebaseTransport`,
`FirebaseTransportOptions`, `FirebaseTransportServices`, `DEFAULT_REGION`,
`resolveRegion`, `SUBSCRIPTION_SOURCES` (for the coverage test only), and the
low-level `invokeViaCallable` / `subscribeViaFirestore` / `subscribeViaRTDB`
(exported for unit testing + future reuse, not for app consumption).

### 2.3 What this package deliberately does NOT do

- **No Zod request/response validation** on `invoke` (owned by api-client —
  single validation point).
- **No `ApiError` _mapping_** (owned by api-client `normalizeError`); it only
  _unwraps_ the Functions envelope so the typed details survive.
- **No domain shaping / view-model assembly / derived fields** (owned by
  repositories).
- **No query-cache / invalidation knowledge** (owned by `@levelup/query`).
- **No `tenantId` in any callable payload, ever.**
- **No writes through realtime** (subscriptions are read-only).

---

## 3. `@levelup/realtime` (the seam + React hooks)

### 3.1 File layout

```
packages/realtime/
  package.json                  # name @levelup/realtime; deps: @levelup/api-contract; peer: react
  src/
    index.ts
    realtime-provider.tsx       # <RealtimeProvider transport={...}> + RealtimeContext
    use-subscription.ts         # useSubscription(name, params, opts?) — the generic hook
    use-server-time.ts          # useServerTime() over serverTimeOffset
    subscription-manager.ts     # refcount/dedupe registry over transport.subscribe (multi-consumer fan-out)
    hooks/                      # thin per-subscription convenience hooks (typed wrappers)
      use-test-session-deadline.ts
      use-chat-stream.ts
      use-space-progress-live.ts
      use-grading-status.ts
      use-exam-grading.ts
      use-notification-badge.ts
      use-leaderboard-live.ts
    types.ts                    # UseSubscriptionResult<P>, RealtimeStatus
  __tests__/
    use-subscription.test.tsx
    subscription-manager.dedupe.test.ts
    use-server-time.test.tsx
    hooks-coverage.test.ts      # one convenience hook per SubscriptionName
```

### 3.2 Exported symbols & signatures

**`realtime-provider.tsx`**

```ts
export interface RealtimeContextValue {
  transport: Pick<Transport, "subscribe" | "serverTimeOffset">;
}
export const RealtimeContext: React.Context<RealtimeContextValue | null>;
export function RealtimeProvider(props: {
  transport: Transport;
  children: React.ReactNode;
}): JSX.Element;
export function useRealtime(): RealtimeContextValue; // throws if outside provider
```

> In practice `<ApiProvider>` (in `@levelup/query`) renders
> `<RealtimeProvider transport={transport}>` internally so apps wire one
> provider — but `RealtimeProvider` is independently usable (RN, tests).

**`types.ts`**

```ts
export type RealtimeStatus = "idle" | "connecting" | "live" | "error";
export interface UseSubscriptionResult<P> {
  data: P | undefined; // latest payload
  status: RealtimeStatus;
  error: ApiError | undefined;
  synced: boolean; // first server snapshot received
}
export interface UseSubscriptionOptions {
  enabled?: boolean; // gate (e.g. don't subscribe until sessionId known)
  onData?: (p: unknown) => void;
}
```

**`subscription-manager.ts`** — dedupe so N components subscribing the same
`(name, params)` share ONE underlying listener (N+1 collapse on the realtime
side):

```ts
export interface SubscriptionManager {
  subscribe<S extends SubscriptionName>(
    name: S,
    params: ParamsOf<S>,
    cb: SubscriptionCallbacks<PayloadOf<S>>
  ): SubscriptionHandle;
}
export function createSubscriptionManager(
  transport: Pick<Transport, "subscribe">
): SubscriptionManager;
//  • Keys by `${name}:${stableStringify(params)}`. Refcounts handles; last unsubscribe tears down.
//  • Replays the last payload to late subscribers immediately (warm fan-out).
```

**`use-subscription.ts`** — the generic hook every convenience hook wraps:

```ts
export function useSubscription<S extends SubscriptionName>(
  name: S,
  params: ParamsOf<S>,
  opts?: UseSubscriptionOptions
): UseSubscriptionResult<PayloadOf<S>>;
//  • Reads manager from context; subscribes on mount / params change; unsubscribes on unmount.
//  • Stores latest payload in state; tracks status + synced. Stable across web + RN (no DOM).
```

**`use-server-time.ts`**

```ts
export interface ServerTime {
  offsetMs: number;
  now: () => number;
  toServerDate: (d?: Date) => Date;
}
export function useServerTime(): ServerTime;
//  • Subscribes transport.serverTimeOffset once (manager-deduped). now() = Date.now()+offsetMs.
//  • Resolves SDK-SERVER §7.1 open-Q #1: the single client-side server-time primitive.
//  • Consumed by the test-runtime UI for the countdown; REPOS compute remainingMs(session, serverNow)
//    using this value — the hook only supplies authoritative time, never the deadline logic.
```

**`hooks/*` — typed convenience wrappers** (one per registered subscription;
each is ~3 lines over `useSubscription`, exists so call sites read domain-named
and the coverage test can assert completeness):

```ts
export const useTestSessionDeadline = (sessionId: string, opts?) =>
  useSubscription("v1.levelup.testSessionDeadline", { sessionId }, opts);
export const useChatStream = (sessionId: string, opts?) =>
  useSubscription("v1.levelup.chatStream", { sessionId }, opts);
export const useSpaceProgressLive = (spaceId: string, userId: string, opts?) =>
  useSubscription("v1.levelup.spaceProgressLive", { spaceId, userId }, opts);
export const useGradingStatus = (submissionId: string, opts?) =>
  useSubscription("v1.autograde.gradingStatus", { submissionId }, opts);
export const useExamGrading = (examId: string, opts?) =>
  useSubscription("v1.autograde.examGrading", { examId }, opts);
export const useNotificationBadge = (opts?) =>
  useSubscription("v1.notification.badge", {}, opts);
export const useLeaderboardLive = (
  filter: { scope; spaceId?; storyPointId? },
  opts?
) => useSubscription("v1.analytics.leaderboard", filter, opts);
```

**`index.ts` barrel:** `RealtimeProvider`, `useRealtime`, `useSubscription`,
`useServerTime`, `createSubscriptionManager`, all `hooks/*`, and the
`UseSubscriptionResult`/`RealtimeStatus`/ `UseSubscriptionOptions`/`ServerTime`
types.

### 3.3 What `@levelup/realtime` deliberately does NOT do

- **No Firestore/RTDB imports** — it only consumes `transport.subscribe` /
  `transport.serverTimeOffset`. (The Firestore/RTDB knowledge is 100% in
  `transport-firebase`.)
- **No domain shaping** — e.g. `mergeLive(snapshotPage, rtdbPayload)` and
  `assignRanks` (analytics leaderboard) live in **repositories**, not here.
  Hooks return the raw validated payload; repos/query reconcile it with REST
  first-paint.
- **No deadline computation** — `useServerTime()` supplies time;
  `testSessionRepo.remainingMs(...)` (repositories) computes remaining. REVIEW
  §6 #6.

---

## 4. `@levelup/offline` (seam only — DEFERRED, no-op passthrough)

> SDK-SERVER §5.7 / common-api §9 idempotency. Ships as **interface + no-op
> passthrough** so the api-client can route mutations through an optional queue
> _today_ with zero behavior change, making the later real implementation purely
> additive (no UI/repo/contract changes). **Not built for v1.**

### 4.1 File layout

```
packages/offline/
  package.json        # name @levelup/offline; deps: @levelup/api-contract; ZERO runtime deps
  src/
    index.ts
    offline-queue.ts          # OfflineQueue interface + QueuedCall + OfflineStatus
    noop-offline-queue.ts     # createNoopOfflineQueue() — passthrough impl (the only v1 impl)
  __tests__/
    noop-passthrough.test.ts  # asserts enqueue() executes immediately + preserves idempotencyKey
```

### 4.2 Exported symbols & signatures

```ts
export type OfflineStatus = "online" | "offline" | "syncing";

export interface QueuedCall<N extends CallableName = CallableName> {
  name: N;
  data: ReqOf<N>;
  idempotencyKey: string; // §5.4 — generated by api-client; the prerequisite that's in from day 1
  enqueuedAt: string; // ISO Timestamp
}

export interface OfflineQueue {
  /** v1 no-op: invokes immediately via the provided executor and returns its result. */
  enqueue<N extends CallableName>(
    call: QueuedCall<N>,
    execute: (c: QueuedCall<N>) => Promise<ResOf<N>>
  ): Promise<ResOf<N>>;
  /** v1 no-op: resolves immediately (nothing buffered). */
  flush(): Promise<void>;
  /** v1: always 'online'. */
  readonly status: OfflineStatus;
  /** v1 no-op unsubscribe. */
  onStatusChange(cb: (s: OfflineStatus) => void): () => void;
}

export function createNoopOfflineQueue(): OfflineQueue;
//  enqueue → execute(call) directly (no buffering); flush → Promise.resolve(); status → 'online'.
```

> **api-client integration (downstream, noted here for the seam contract).**
> `createApiClient(transport, { offlineQueue? })` defaults to
> `createNoopOfflineQueue()`. Mutating calls go
> `offlineQueue.enqueue({ name, data, idempotencyKey }, c => transport.invoke(c.name, c.data))`.
> With the no-op queue this is identical to a direct invoke — so v1 behavior is
> unchanged and v1 idempotency keys are already present for the eventual real
> replay.

---

## 5. `@levelup/transport-http` (FUTURE — stub shape only)

> SDK-SERVER §1 / common-api §5.1. Documented now so the seam stays swap-ready
> (scanner-rn / REST / third parties later). **No implementation in v1** — this
> section is the shape contract a future build fills in. Same `Transport`
> interface, so app code never changes.

### 5.1 Intended file layout (future)

```
packages/transport-http/
  src/
    create-http-transport.ts   # createHttpTransport({ baseUrl, getBearerToken }) → Transport
    invoke/invoke-via-http.ts  # POST {baseUrl}/v1/<module>/<op> with Authorization: Bearer <token>
    subscribe/
      subscribe-via-sse.ts     # EventSource(`${baseUrl}/v1/sub/<name>?...`) → cb
      subscribe-via-ws.ts      # WebSocket fallback for bidirectional/low-latency
    server-time/server-time.ts # GET /v1/server-time → offset (SSE keep-alive for drift)
```

### 5.2 Future signatures (shape only)

```ts
export interface HttpTransportOptions {
  baseUrl: string;
  getBearerToken: () => Promise<string>; // verified ID token / session token, forwarded as Bearer
  fetchImpl?: typeof fetch; // RN/node polyfill seam
}
export function createHttpTransport(opts: HttpTransportOptions): Transport;

export function invokeViaHttp<N extends CallableName>(
  opts,
  name: N,
  data: ReqOf<N>
): Promise<ResOf<N>>;
//  POST baseUrl + '/' + name.replace(/\./g,'/')  body { data }  → { result } | { error: ApiErrorDetails }
export function subscribeViaSSE<S extends SubscriptionName>(
  opts,
  name: S,
  params,
  cb
): SubscriptionHandle;
export function subscribeViaWebSocket<S extends SubscriptionName>(
  opts,
  name: S,
  params,
  cb
): SubscriptionHandle;
```

> The HTTP error response body carries the **same `ApiErrorDetails` envelope**
> as the callable transport, so api-client's `normalizeError` works unchanged
> across transports.

---

## 6. App-root wiring (web + RN, identical above the transport)

```ts
// WEB — apps/*/src/main.tsx
const services = getFirebaseServices();                                  // existing shared firebase init (asia-south1)
const transport = createFirebaseTransport(services, { region: DEFAULT_REGION,
                                                      validatePayloads: import.meta.env.DEV });
const api   = createApiClient(transport, { validateResponses: import.meta.env.DEV,
                                           offlineQueue: createNoopOfflineQueue() });
const repos = createRepositories(api);
root.render(
  <ApiProvider api={api} repos={repos} transport={transport}>   {/* wraps RealtimeProvider internally */}
    <App/>
  </ApiProvider>,
);

// REACT NATIVE — apps-rn/*/App.tsx  (identical except Firebase init + env flag)
const transport = createFirebaseTransport(getFirebaseServicesRN(), { validatePayloads: __DEV__ });
// …same api/repos/ApiProvider…
```

The transport is the **only** line that differs per platform; the scanner-rn app
uses the same Firebase transport in v1 and can swap `createFirebaseTransport` →
`createHttpTransport` later with **no app-code change** (same `Transport`
shape).

---

## 7. Dependency rules (this layer)

| Package                     | MAY import                                                                                                     | MUST NOT import                                                                                                                                                   |
| --------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `transport-firebase`        | `@levelup/api-contract` (+ `@levelup/domain` transitively), `firebase/{app,functions,firestore,database,auth}` | `@levelup/api-client`, `@levelup/repositories`, `@levelup/query`, `@levelup/realtime`, `@levelup/offline`, `react`                                                |
| `realtime`                  | `@levelup/api-contract`, `react` (peer)                                                                        | `firebase/*` (all Firestore/RTDB knowledge stays in transport-firebase), `@levelup/api-client`, `@levelup/repositories`, `@levelup/query`, `@levelup/transport-*` |
| `offline`                   | `@levelup/api-contract`                                                                                        | everything else (zero runtime deps)                                                                                                                               |
| `transport-http` _(future)_ | `@levelup/api-contract`, `fetch`/`EventSource`/`WebSocket`                                                     | `firebase/*`, client/repos/query/realtime                                                                                                                         |

**Strictly downward:** none of these import a layer above (`api-client`,
`repositories`, `query`, apps). The
`Transport`/`SubscriptionHandle`/`SubscriptionCallbacks` types they
implement/consume live in `@levelup/api-contract`, the lowest shared point — so
there is **no cycle** and api-client can depend on the same interface from
below.

---

## 8. Contract & lint tests this layer requires

**`transport-firebase`**

1. **`subscription-sources.coverage.test.ts`** —
   `SUBSCRIPTION_SOURCES satisfies Record<SubscriptionName,…>` compiles; a
   runtime test asserts `Object.keys(SUBSCRIPTION_SOURCES)` ⊇
   `Object.keys(SUBSCRIPTIONS)` (every registered subscription has a
   wire-location). Fails the build when a new subscription is added to
   `api-contract` without a source descriptor.
2. **`invoke.contract.test.ts`** (emulator) — for a sample callable per module:
   `invokeViaCallable` forwards `data` unchanged, returns `result.data`, adds
   **no** `tenantId`, and rethrows a thrown `HttpsError` with its `details`
   intact (so api-client can normalize). Asserts the request body has no
   `tenantId` field (REVIEW §6 #1 / risk-table "tenantId-from-body").
3. **`subscribe-firestore.test.ts` / `subscribe-rtdb.test.ts`** (emulator) —
   write a doc/node, assert the handle's `cb.next` fires with a
   **payload-validated** value, `onSynced` fires on first server snapshot, and
   `unsubscribe()` detaches (no further callbacks; idempotent on double-call).
4. **`server-time.test.ts`** — `serverTimeOffset` emits a number from
   `/.info/serverTimeOffset`; handle unsubscribes cleanly.
5. **`no-direct-firestore-leak.lint.test.ts`** — `no-restricted-imports`
   config + a meta-test asserting `firebase/firestore` and `firebase/database`
   are imported **only** under `packages/transport-firebase/src/**` across the
   monorepo (the single-Firestore-source rule, principle 3).
6. **Read-only realtime lint** — AST/grep assertion that `subscribe-via-rtdb.ts`
   / `subscribe-via-firestore.ts` contain no
   `set`/`update`/`push`/`setDoc`/`updateDoc`/`addDoc`/`deleteDoc`
   (subscriptions never write).

**`realtime`** 7. **`hooks-coverage.test.ts`** — there is exactly one exported
convenience hook per `SubscriptionName` (and none orphaned) — keeps the hook
surface in lockstep with the registry. 8.
**`subscription-manager.dedupe.test.ts`** — two
`useSubscription(name, sameParams)` consumers create **one** underlying
`transport.subscribe` call; last unsubscribe tears down; late subscriber gets
the replayed last payload. 9. **`use-server-time.test.tsx`** — `now()` =
`Date.now() + offsetMs`; single underlying offset subscription regardless of
consumer count. 10. **`no-firebase-in-realtime.lint.test.ts`** — `realtime`
source imports **no** `firebase/*` (all platform knowledge in
transport-firebase).

**`offline`** 11. **`noop-passthrough.test.ts`** —
`createNoopOfflineQueue().enqueue(call, exec)` calls `exec(call)` exactly once
and resolves to its result; `status === 'online'`; `idempotencyKey` is preserved
on the `QueuedCall` (the day-1 prerequisite for later replay, §5.4).

**Cross-cutting** 12. **Dependency-boundary lint** (eslint
`no-restricted-imports` / `dependency-cruiser`) — encodes the §7 table: none of
these four packages import `api-client`/`repositories`/`query`/apps;
`realtime`/`offline` don't import `firebase/*`; packages don't import each other
except via `api-contract` types.

---

## 9. Open questions / risks for this layer

1. **Realtime path scoping on reads.** Subscriptions need `{tenantId, uid}` to
   locate docs/nodes, but `tenantId` is claim-derived (never client input).
   Resolution: derive `PathContext` from `services.auth` current token +
   `onIdTokenChanged`, refreshed by `refreshToken()` after `switchActiveTenant`.
   **Confirm** the active-tenant claim is readable from the decoded ID token
   client-side (it is the claim the server stamps) — if not, a one-time `getMe`
   seeds it. Until then the `__tenant__` placeholder resolution is the one piece
   needing the identity layer's claim shape.
2. **`useServerTime()` vs `serverDeadline`-only.** SDK-SERVER §7.1 open-Q #1 +
   levelup domain open-Q — recommendation taken: expose the thin
   `useServerTime()` over `/.info/serverTimeOffset`; the deadline itself stays
   in the streamed `testSessionDeadline` payload (server-authoritative). Repos
   do the subtraction, not this layer.
3. **Firestore vs RTDB split per subscription is data, not code**
   (`SUBSCRIPTION_SOURCES`). If a subscription later migrates backends (e.g.
   notification badge Firestore→RTDB), only the descriptor + path change;
   hooks/UI untouched. The coverage test guards completeness; it does **not**
   guard that the chosen backend matches the producer — that pairing is asserted
   in the owning domain spec (analytics/notification = RTDB;
   testSession/chat/grading = Firestore).
4. **`examGrading` aggregate query cost.** It's a `submissions where examId==`
   collection listener; on large exams this fans many docs. Mitigation belongs
   server-side (a maintained aggregate doc the subscription points at instead of
   a live query) — flagged to the autograde domain; this layer can subscribe
   either shape via a descriptor swap with no hook change.
5. **Offline replay ordering (future).** When the real `@levelup/offline` lands,
   `enqueue` must preserve FIFO + per-`idempotencyKey` dedupe; the no-op seam
   already carries the key so the contract is ready. No v1 work.
6. **`transport-http` SSE auth refresh (future).** Long-lived SSE connections
   need bearer-token refresh mid-stream; the `getBearerToken` seam supports
   re-fetch, but reconnect-on-401 policy is a future-build decision, not v1.
