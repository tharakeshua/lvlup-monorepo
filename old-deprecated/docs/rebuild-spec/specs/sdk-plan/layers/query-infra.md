# Layer Plan — `@levelup/query` Infrastructure

> **Layer position.** Top of the SDK trust cake; consumed only by the 8 apps (5
> web + 3 RN). Depends strictly downward on `@levelup/repositories`,
> `@levelup/api-client` (types only, via repos), `@levelup/api-contract`,
> `@levelup/domain`, and the side-seam packages `@levelup/realtime` and
> `@levelup/offline` (seam types). Brings exactly one runtime peer the layers
> below do not: `@tanstack/react-query` v5 (+ `react`). **No firebase, no DOM,
> no node** — RN-safe.
>
> **Scope of THIS document.** The _infrastructure_ of `@levelup/query`, not the
> per-domain hooks themselves. Concretely: `ApiProvider` wiring, the query-key
> factory conventions + a typed key registry, the global cross-domain
> invalidation graph, the conservative optimistic-update recipe framework, the
> lint rule that forbids optimistic config on authority-sensitive (⚷) mutations,
> the React Query error-boundary integration, and `useApiError`. Per-domain hook
> files (`useSpaces`, `useGradeQuestion`, …) are authored _on top of_ these
> primitives and are specified by the per-domain layer plans; this doc only
> fixes the contracts they must obey.

---

## 0. What this layer fixes (grounded in the live code)

| Live problem (verified)                                                                                                                 | Fix this layer owns                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Hooks call `httpsCallable(functions, 'saveSpace')` inline (`useSpaceMutations.ts:9`) — stringly-typed, no validation                    | Hooks call `repos.*` only; `ApiProvider` injects `repos`; no app/hook touches `firebase/*`                                           |
| `tenantId` threaded through hook variables (`useSpaceMutations.ts:17,33`)                                                               | `tenantId` never appears in any key or request; keys are tenant-implicit (one client = one active tenant)                            |
| Coarse invalidation `['tenants', tenantId, 'spaces']` (`useSpaceMutations.ts:17`)                                                       | Hierarchical key factories + a **declarative invalidation graph** keyed by `invalidates` hints from `CALLABLES`                      |
| `useApiError` lives in shared-hooks, reads `error.code` ad hoc (`use-api-error.ts:29`), imports `sonner` + `import.meta.env` (web-only) | `useApiError` moves here, reads normalized `ApiError.code` from api-client, **toast transport injected** (RN-safe), no `import.meta` |
| Errors render as empty states (parent-web gap, REVIEW §6/spec §5.2)                                                                     | A real `QueryErrorResetBoundary`-based `ApiErrorBoundary` + per-query `throwOnError` policy                                          |
| No guard against optimistic updates on grading/publish/purchase (REVIEW §6 ⚷ rows; spec §5.5)                                           | `defineMutation` recipe framework + `no-optimistic-on-authority` ESLint rule wired to `CALLABLES` ⚷ flags                            |
| Duplicated `getCallable` factories, names in 3+ places                                                                                  | Names live once in `CALLABLES`; keys live once in this package's key registry                                                        |

---

## 1. Package layout

```
packages/query/
├── package.json                 # name "@levelup/query"; peerDeps react + @tanstack/react-query
├── tsconfig.json                # extends repo base; "jsx": "react-jsx"; composite project ref to repos/contract/domain
├── vitest.config.ts             # jsdom env for hook/provider tests; React Testing Library
├── eslint.config.js             # extends @levelup/eslint-config + local no-restricted-imports
├── src/
│   ├── index.ts                 # public barrel (see §10)
│   │
│   ├── provider/
│   │   ├── ApiProvider.tsx       # <ApiProvider api repos transport queryClient realtime offline notify>
│   │   ├── ApiContext.ts         # React.createContext<ApiContextValue | null>
│   │   ├── useApi.ts             # useApi(): ApiContextValue  (throws if outside provider)
│   │   ├── createQueryClient.ts  # makeQueryClient(opts): QueryClient  (default cache policy)
│   │   └── types.ts              # ApiContextValue, ApiProviderProps, NotifyAdapter, ApiProviderOptions
│   │
│   ├── keys/
│   │   ├── key-factory.ts        # createKeyFactory(domain) → {all, list, detail, …} helpers
│   │   ├── registry.ts           # QUERY_KEYS: frozen map of every domain's factory + KeyRoot union
│   │   ├── scopes.ts             # SENSITIVE_KEY_SCOPES (e.g. answer-bearing editor items: non-persisted)
│   │   └── types.ts              # QueryKey<…>, KeyRoot, KeyOf, DomainKeys
│   │
│   ├── invalidation/
│   │   ├── graph.ts              # INVALIDATION_GRAPH: CallableName → readonly KeyRoot[] (+ fanout rules)
│   │   ├── invalidate.ts         # invalidateForCallable(qc, name, vars?) — the one invalidation entrypoint
│   │   ├── derive-from-contract.ts # buildGraphFromContract(CALLABLES) — seeds graph from def.invalidates
│   │   └── types.ts              # InvalidationRule, FanoutResolver
│   │
│   ├── mutation/
│   │   ├── define-mutation.ts    # defineMutation(spec) → useXxx() factory (the recipe framework)
│   │   ├── optimistic.ts         # OptimisticRecipe<TVars,TCtx>, applyOptimistic, rollback helpers
│   │   ├── recipes/
│   │   │   ├── append-list.ts    # appendToList recipe (chat send)
│   │   │   ├── patch-detail.ts   # patchDetail recipe (mark-read, item attempt progress)
│   │   │   └── increment-counter.ts
│   │   ├── authority.ts          # isAuthoritySensitive(name): reads CALLABLES[name].authoritySensitive
│   │   └── types.ts              # MutationSpec, MutationKind, OptimisticConfig
│   │
│   ├── error/
│   │   ├── ApiErrorBoundary.tsx  # class boundary + QueryErrorResetBoundary integration
│   │   ├── useApiError.ts        # toast/copy hook (notify injected, RN-safe)
│   │   ├── error-policy.ts       # shouldThrowOnError(error), retry policy fn
│   │   └── types.ts              # ApiErrorBoundaryProps, ErrorFallbackProps
│   │
│   ├── realtime/
│   │   └── useSubscription.ts    # thin wrapper over transport.subscribe → cache write (seam consumer)
│   │
│   └── testing/
│       ├── renderWithApi.tsx     # test util: wraps in ApiProvider + fresh QueryClient w/ in-memory repos
│       └── makeMockRepos.ts      # typed repo doubles for hook tests
└── src/__contract__/
    ├── invalidation-graph.contract.test.ts
    ├── optimistic-allowlist.contract.test.ts
    ├── key-registry.contract.test.ts
    └── lint-rule.test.ts         # tests the custom ESLint rule
```

**Why `provider`/`keys`/`invalidation`/`mutation`/`error` as siblings, not
nested:** each is an independently importable concern (a per-domain hook file
imports from `keys` + `mutation`, an app root imports from `provider` +
`error`). Flat folders keep the dependency arrows inside the package acyclic:
`keys` ← `invalidation` ← `mutation`; `provider` depends on all; `error` depends
on nothing in-package except `provider` (for `useApi`).

---

## 2. Dependencies (downward-only — enforced)

```jsonc
// packages/query/package.json
{
  "name": "@levelup/query",
  "peerDependencies": { "react": ">=18", "@tanstack/react-query": "^5" },
  "dependencies": {
    "@levelup/repositories": "workspace:*",
    "@levelup/api-contract": "workspace:*", // CALLABLES, AppErrorCode, ALLOWED_TRANSITIONS, SUBSCRIPTIONS, ApiError type
    "@levelup/domain": "workspace:*", // branded IDs, Page<T>, entity types for key params
  },
}
```

- **MUST NOT depend on** `@levelup/api-client` directly (it reaches the typed
  client only through `repos`, which is what makes hooks thin),
  `@levelup/transport-*`, `firebase`, `firebase-functions`, or any DOM/web/node
  lib. `@levelup/offline` and `@levelup/realtime` are referenced as **types
  only** (their seam interfaces flow in via the `transport`/`offline` props on
  `ApiProvider`).
- `ApiClient` and `Repositories` types are re-exported _from_
  `@levelup/repositories` so this package imports `Repositories` only; it never
  names `createApiClient`.

```js
// packages/query/eslint.config.js — local guard (in addition to repo-wide boundary rule)
'no-restricted-imports': ['error', { paths: [
  { name: 'firebase', message: '@levelup/query is platform-neutral; transport is injected.' },
  { name: 'firebase/functions', message: 'No firebase in @levelup/query.' },
  { name: 'firebase/firestore', message: 'No firebase in @levelup/query.' },
  { name: '@levelup/api-client', message: 'Reach the client through repos, not directly.' },
  { name: 'sonner', message: 'Toasts go through the injected NotifyAdapter (RN-safe).' },
], patterns: [
  { group: ['@levelup/transport-*'], message: 'Transport is injected at the app root only.' },
] }],
// plus: forbid `import.meta` (RN has no import.meta.env) — custom rule `@levelup/no-import-meta`.
```

---

## 3. `ApiProvider` wiring

### 3.1 Context value & props

```ts
// provider/types.ts
import type { QueryClient } from "@tanstack/react-query";
import type { ApiClient, Repositories } from "@levelup/repositories";
import type { Transport } from "@levelup/api-contract"; // invoke + subscribe seam
import type { OfflineQueue } from "@levelup/offline"; // seam interface (no-op in v1)

/** Injected, platform-neutral toast/announcer. Web supplies a sonner adapter; RN a Toast adapter. */
export interface NotifyAdapter {
  error(
    message: string,
    opts?: { description?: string; durationMs?: number }
  ): void;
  success(message: string, opts?: { description?: string }): void;
}

export interface ApiContextValue {
  api: ApiClient; // for the rare hook that needs a raw call (reads stay in repos)
  repos: Repositories; // the brain — hooks call this
  transport: Transport; // realtime subscribe() seam lives here
  queryClient: QueryClient; // also available via useQueryClient(); exposed for imperative util
  notify: NotifyAdapter; // injected; never `sonner` directly
  offline?: OfflineQueue; // optional; seam only in v1
  isDev: boolean; // replaces import.meta.env.DEV (passed in, RN-safe)
}

export interface ApiProviderProps {
  api: ApiClient;
  repos: Repositories;
  transport: Transport;
  notify: NotifyAdapter;
  /** Bring your own client (tests, micro-frontends) or let the provider make one. */
  queryClient?: QueryClient;
  queryClientOptions?: ApiProviderOptions;
  offline?: OfflineQueue;
  isDev?: boolean; // default: false
  children: React.ReactNode;
}

export interface ApiProviderOptions {
  defaultStaleTimeMs?: number; // default 30_000
  defaultGcTimeMs?: number; // default 5 * 60_000
  retry?: number | ((failureCount: number, error: unknown) => boolean); // default = error-policy.ts
  /** Globally make read errors throw to the nearest ApiErrorBoundary (default: true for queries). */
  throwReadErrorsToBoundary?: boolean;
}
```

### 3.2 The component

```tsx
// provider/ApiProvider.tsx
export function ApiProvider(props: ApiProviderProps): JSX.Element {
  const queryClient = useMemo(
    () => props.queryClient ?? makeQueryClient(props.queryClientOptions),
    [props.queryClient] // options read once; client identity is stable across renders
  );
  const value = useMemo<ApiContextValue>(
    () => ({
      api: props.api,
      repos: props.repos,
      transport: props.transport,
      notify: props.notify,
      offline: props.offline,
      queryClient,
      isDev: props.isDev ?? false,
    }),
    [
      props.api,
      props.repos,
      props.transport,
      props.notify,
      props.offline,
      queryClient,
      props.isDev,
    ]
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ApiContext.Provider value={value}>{props.children}</ApiContext.Provider>
    </QueryClientProvider>
  );
}
```

- **`QueryClientProvider` is owned here**, not by the app — guarantees every app
  uses the same default cache policy and the same `QueryCache` `onError` wiring
  (§7). Apps that already mount a `QueryClientProvider` pass their client in via
  `queryClient` (the provider then does **not** wrap a second one — it detects
  an ambient client and skips re-wrapping; see §3.4).
- **Accessors:**
  - `useApi(): ApiContextValue` — throws
    `"useApi must be used within <ApiProvider>"` if context is null.
  - Narrow selectors so hooks don't over-subscribe: `useRepos()`,
    `useApiClient()`, `useTransport()`, `useNotify()`, `useOffline()`,
    `useIsDev()` — each `= useApi().<field>`.

### 3.3 `makeQueryClient` — the one default policy

```ts
// provider/createQueryClient.ts
export function makeQueryClient(opts?: ApiProviderOptions): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: opts?.defaultStaleTimeMs ?? 30_000,
        gcTime: opts?.defaultGcTimeMs ?? 5 * 60_000,
        retry: opts?.retry ?? defaultRetry, // from error/error-policy.ts: no retry on 4xx/⚷
        throwOnError:
          (opts?.throwReadErrorsToBoundary ?? true)
            ? shouldThrowOnError
            : false,
        refetchOnWindowFocus: false, // RN has no window; explicit + portable
      },
      mutations: {
        retry: false, // mutations never auto-retry (idempotency is server-side)
        onError: (err) => {
          /* surfaced via useApiError at call sites; boundary catches unhandled */
        },
      },
    },
    queryCache: new QueryCache({ onError: globalQueryErrorHandler }), // §7.3
  });
}
```

### 3.4 Root wiring (web + RN, byte-identical above transport)

```tsx
// WEB — apps/*/src/main.tsx
const transport = createFirebaseTransport(getFirebaseServices(), {
  region: REGION,
});
const api = createApiClient(transport, {
  validateResponses: import.meta.env.DEV,
});
const repos = createRepositories(api);
const notify = createSonnerNotify(); // app-level web adapter
root.render(
  <ApiProvider
    api={api}
    repos={repos}
    transport={transport}
    notify={notify}
    isDev={import.meta.env.DEV}
  >
    <ApiErrorBoundary>
      <App />
    </ApiErrorBoundary>
  </ApiProvider>
);

// REACT NATIVE — apps-rn/*/App.tsx  (only transport + notify + isDev differ)
const transport = createFirebaseTransport(getFirebaseServicesRN(), {
  region: REGION,
});
const api = createApiClient(transport, { validateResponses: __DEV__ });
const repos = createRepositories(api);
const notify = createRNToastNotify();
<ApiProvider
  api={api}
  repos={repos}
  transport={transport}
  notify={notify}
  isDev={__DEV__}
>
  <ApiErrorBoundary>
    <App />
  </ApiErrorBoundary>
</ApiProvider>;
```

`isDev` and `notify` are the only two things `@levelup/query` historically
pulled platform-specific (`import.meta.env.DEV`, `sonner`) — both are now
**props**, making the package RN-clean.

---

## 4. Query-key factory conventions

### 4.1 The factory

```ts
// keys/key-factory.ts
export type DomainName =
  | "spaces"
  | "storyPoints"
  | "items"
  | "progress"
  | "chat"
  | "exams"
  | "submissions"
  | "questionSubmissions"
  | "students"
  | "teachers"
  | "parents"
  | "staff"
  | "classes"
  | "sessions"
  | "tenant"
  | "memberships"
  | "announcements"
  | "notifications"
  | "analytics"
  | "reports"
  | "costs"
  | "insights"
  | "questionBank"
  | "rubricPresets"
  | "store"
  | "reviews"
  | "versions"
  | "evaluationSettings";

/** Every key starts with a single string root === DomainName, then a "kind", then opaque params. */
export function createKeyFactory<D extends DomainName>(domain: D) {
  return {
    root: () => [domain] as const,
    all: () => [domain] as const,
    list: <F extends object>(filter?: F) =>
      [domain, "list", filter ?? {}] as const,
    /** infinite/paginated list (kept distinct so invalidation can target one without the other) */
    infinite: <F extends object>(filter?: F) =>
      [domain, "infinite", filter ?? {}] as const,
    detail: (id: string) => [domain, "detail", id] as const,
    /** nested/derived sub-resource of a detail (e.g. a space's progress) */
    sub: (id: string, kind: string, params?: object) =>
      [domain, "detail", id, kind, params ?? {}] as const,
  };
}
export type KeyFactory<D extends DomainName> = ReturnType<
  typeof createKeyFactory<D>
>;
```

**Conventions (mandatory, lint-checked by `key-registry.contract.test.ts`):**

1. **Root is exactly the `DomainName` string** — never
   `['tenants', tenantId, …]`. `tenantId` is implicit (one provider = one active
   tenant; switching tenants resets the whole cache, §4.4).
2. **Second element is a finite "kind"** from `{'list','infinite','detail'}` so
   the invalidation graph can fan out by kind.
3. **Filters/params are the last element and are objects** (stable via React
   Query's structural sharing) — never positional scalars, so adding a filter
   field never shifts an existing key.
4. **Branded IDs are stringified at the boundary** — `detail(id: SpaceId)`
   accepts the brand; the array stores the underlying `string` (brands don't
   survive `as const` arrays, and that's fine).
5. **No answer-bearing data in any persisted key** — see `keys/scopes.ts`
   (§4.3).

### 4.2 The key registry (one place, typed)

```ts
// keys/registry.ts
export const spaceKeys = createKeyFactory("spaces");
export const storyPointKeys = createKeyFactory("storyPoints");
export const itemKeys = createKeyFactory("items");
export const progressKeys = createKeyFactory("progress");
export const examKeys = createKeyFactory("exams");
export const submissionKeys = createKeyFactory("submissions");
// … one per DomainName

/** Frozen registry so the invalidation graph + contract tests can iterate every root. */
export const QUERY_KEYS = Object.freeze({
  spaces: spaceKeys,
  storyPoints: storyPointKeys,
  items: itemKeys,
  progress: progressKeys,
  exams: examKeys,
  submissions: submissionKeys /* … */,
} satisfies Record<DomainName, KeyFactory<DomainName>>);

export type KeyRoot = DomainName; // the canonical invalidation unit
export type AnyQueryKey = ReturnType<
  KeyFactory<DomainName>[keyof KeyFactory<DomainName>]
>;
```

### 4.3 Answer-key cache isolation (REVIEW §6.4, open-Q 7.1.3)

```ts
// keys/scopes.ts
/** Editor items carry re-merged answer keys (getItemForEdit). These MUST NOT land in the shared,
 *  persistable cache, and MUST be excluded from any future offline store. */
export const EDIT_ITEM_SCOPE = "items:edit" as const;
export function editItemKey(itemId: string) {
  return [EDIT_ITEM_SCOPE, itemId] as const; // NOT under 'items' root → never bulk-invalidated/leaked
}
/** Predicate the offline seam + a contract test use to assert these keys are never persisted. */
export const isSensitiveKey = (key: readonly unknown[]) =>
  key[0] === EDIT_ITEM_SCOPE;
```

Hooks for `getItemForEdit` set `gcTime: 0`, `staleTime: 0`, and never appear in
the persisted set — enforced by `key-registry.contract.test.ts` (the offline
persister's `dehydrate` filter rejects `isSensitiveKey`).

### 4.4 Tenant-switch cache reset

```ts
// exported from provider/, called by the identity hook after switchActiveTenant → getIdToken(true)
export function resetForTenantSwitch(qc: QueryClient): void {
  qc.clear(); // every key is tenant-implicit; the only safe cross-tenant boundary is a full clear
}
```

---

## 5. The global invalidation graph

### 5.1 Source of truth: contract hints + explicit overrides

Each `CallableDef` already carries `invalidates?: readonly string[]`
(SDK-SERVER-DESIGN §2.1). This layer turns those hints into a typed graph and
lets a domain add **cross-domain fanouts** the contract author couldn't express
in one string list (e.g. `submitTestSession` dirties `progress` _and_ `spaces`
detail completion _and_ `analytics`).

```ts
// invalidation/types.ts
export interface InvalidationRule {
  /** Roots to invalidate wholesale (coarse-but-correct). */
  roots: readonly KeyRoot[];
  /** Optional precise targets computed from the mutation's variables/response. */
  fanout?: FanoutResolver;
}
export type FanoutResolver = (ctx: {
  vars: unknown; // the mutation input
  data: unknown; // the mutation response
  keys: typeof QUERY_KEYS;
}) => readonly (readonly unknown[])[]; // exact query keys to invalidate
```

```ts
// invalidation/graph.ts
import { CALLABLES } from "@levelup/api-contract";

/** Hand-authored cross-domain rules; merged over the contract's `invalidates` hints. */
const OVERRIDES: Partial<Record<CallableName, InvalidationRule>> = {
  "v1.levelup.submitTestSession": {
    roots: ["progress", "spaces", "storyPoints", "analytics"],
    fanout: ({ vars, keys }) => [
      keys.progress.sub((vars as any).spaceId, "space"),
      keys.spaces.detail((vars as any).spaceId),
    ],
  },
  "v1.levelup.recordItemAttempt": {
    roots: ["progress"],
    fanout: ({ vars, keys }) => [
      keys.progress.sub((vars as any).spaceId, "storyPoint", {
        storyPointId: (vars as any).storyPointId,
      }),
    ],
  },
  "v1.levelup.evaluateAnswer": { roots: ["progress"] }, // server persists progress now
  "v1.levelup.saveItem": { roots: ["items", "storyPoints", "versions"] },
  "v1.levelup.saveStoryPoint": { roots: ["storyPoints", "spaces"] },
  "v1.levelup.saveSpace": { roots: ["spaces", "store"] }, // publish mirrors store listing
  "v1.autograde.gradeQuestion": {
    roots: ["questionSubmissions", "submissions", "analytics"],
  },
  "v1.autograde.uploadAnswerSheets": { roots: ["submissions", "exams"] },
  "v1.autograde.saveExam": { roots: ["exams"] },
  "v1.identity.saveStudent": { roots: ["students", "classes", "memberships"] },
  "v1.identity.saveClass": { roots: ["classes", "students", "teachers"] },
  "v1.identity.switchActiveTenant": { roots: [] }, // handled by resetForTenantSwitch, not invalidate
  "v1.identity.manageNotifications": { roots: ["notifications"] },
  "v1.levelup.purchaseSpace": { roots: ["store", "spaces"] },
  "v1.analytics.generateReport": { roots: [] }, // produces a URL; nothing to invalidate
  // … exhaustive entry per mutating callable; reads have none.
};

export const INVALIDATION_GRAPH: Record<CallableName, InvalidationRule> =
  buildGraphFromContract(CALLABLES, OVERRIDES); // §5.2
```

```ts
// invalidation/derive-from-contract.ts
export function buildGraphFromContract(
  callables: typeof CALLABLES,
  overrides: Partial<Record<CallableName, InvalidationRule>>
): Record<CallableName, InvalidationRule> {
  const out = {} as Record<CallableName, InvalidationRule>;
  for (const name of Object.keys(callables) as CallableName[]) {
    const fromHint = (callables[name].invalidates ?? []) as readonly KeyRoot[];
    const override = overrides[name];
    out[name] = override
      ? {
          roots: dedupe([...fromHint, ...override.roots]),
          fanout: override.fanout,
        }
      : { roots: fromHint };
  }
  return out;
}
```

### 5.2 The single invalidation entrypoint

```ts
// invalidation/invalidate.ts
export async function invalidateForCallable(
  qc: QueryClient,
  name: CallableName,
  ctx?: { vars?: unknown; data?: unknown }
): Promise<void> {
  const rule = INVALIDATION_GRAPH[name];
  if (!rule) return;
  // 1. coarse roots (always correct; React Query matches by key prefix)
  await Promise.all(
    rule.roots.map((root) => qc.invalidateQueries({ queryKey: [root] }))
  );
  // 2. precise fanout (narrower refetch, lower churn)
  if (rule.fanout && ctx) {
    const targets = rule.fanout({
      vars: ctx.vars,
      data: ctx.data,
      keys: QUERY_KEYS,
    });
    await Promise.all(
      targets.map((queryKey) => qc.invalidateQueries({ queryKey }))
    );
  }
}
```

Every mutation produced by `defineMutation` (§6) calls `invalidateForCallable`
in `onSuccess` — domain hooks never hand-write `invalidateQueries`. This is the
fix for the coarse `['tenants', tenantId, 'spaces']` churn: the _graph_ decides
scope once, consistently, for all 8 apps.

### 5.3 Graph invariants (contract-tested — §9)

- **Total coverage:** every `name` in `CALLABLES` with `rateTier !== 'read'` and
  not idempotent-read has a graph entry (may be empty `roots:[]`, but must be
  _declared_ so a new mutation can't silently invalidate nothing).
- **Roots are real:** every root ∈ `DomainName`.
- **No optimistic-only mutation skips invalidation** unless explicitly marked
  `noServerEcho` (mark-read).

---

## 6. Conservative optimistic-update recipe framework

### 6.1 `defineMutation` — the one way to build a mutation hook

```ts
// mutation/types.ts
export type MutationKind = "standard" | "optimistic";

export interface MutationSpec<TVars, TData, TCtx = unknown> {
  /** The contract callable this mutation drives — drives invalidation AND the authority lint check. */
  callable: CallableName;
  /** repos.* method that performs the call. */
  run: (repos: Repositories, vars: TVars) => Promise<TData>;
  /** Optional optimistic recipe. PRESENCE here on a ⚷ callable is a BUILD ERROR (§8). */
  optimistic?: OptimisticConfig<TVars, TData, TCtx>;
  /** Override the graph's fanout per-call site if needed (rare). */
  invalidate?: "graph" | "none"; // default 'graph'
}

export interface OptimisticConfig<TVars, TData, TCtx> {
  /** Snapshot + mutate the cache before the request; return rollback context. */
  apply: (qc: QueryClient, vars: TVars, keys: typeof QUERY_KEYS) => TCtx;
  /** Restore from snapshot on error. */
  rollback: (qc: QueryClient, ctx: TCtx) => void;
  /** Reconcile with the authoritative response on success (default: trust server, invalidate). */
  reconcile?: (qc: QueryClient, data: TData, vars: TVars, ctx: TCtx) => void;
}
```

```ts
// mutation/define-mutation.ts
export function defineMutation<TVars, TData, TCtx = unknown>(
  spec: MutationSpec<TVars, TData, TCtx>
) {
  // BUILD-TIME GUARD (also lint-enforced, §8): optimistic on a ⚷ callable throws at module load in dev.
  if (spec.optimistic && isAuthoritySensitive(spec.callable)) {
    throw new Error(
      `[query] Optimistic updates are forbidden on authority-sensitive callable "${spec.callable}". ` +
        `See SDK-SERVER-DESIGN §5.5 / REVIEW §6.`
    );
  }
  return function useGeneratedMutation() {
    const { repos, notify } = useApi();
    const qc = useQueryClient();
    return useMutation<TData, unknown, TVars, TCtx>({
      mutationFn: (vars) => spec.run(repos, vars),
      onMutate: spec.optimistic
        ? async (vars) => {
            await qc.cancelQueries(); // prevent in-flight overwrite
            return spec.optimistic!.apply(qc, vars, QUERY_KEYS);
          }
        : undefined,
      onError: (_err, _vars, ctx) => {
        if (spec.optimistic && ctx) spec.optimistic.rollback(qc, ctx);
        // error surfaced by useApiError at the call site or the boundary; no toast forced here
      },
      onSuccess: (data, vars, ctx) => {
        spec.optimistic?.reconcile?.(qc, data, vars, ctx as TCtx);
      },
      onSettled: (data, _err, vars) => {
        if (spec.invalidate !== "none") {
          void invalidateForCallable(qc, spec.callable, { vars, data }); // always reconcile w/ server
        }
      },
    });
  };
}
```

**Why `onSettled` (not `onSuccess`) for invalidation:** even an optimistic
mutation must re-fetch the authoritative value after the round-trip, so the
cache never diverges from the server (the §6.4 "trust the server's returned
value" rule).

### 6.2 Allow-listed recipes (the only optimistic surfaces — spec §5.5)

```ts
// mutation/recipes/append-list.ts   → sendChatMessage (append a pending message)
export function appendToList<T>(rootKey: readonly unknown[], make: (vars: any) => T): OptimisticConfig<…>;

// mutation/recipes/patch-detail.ts  → recordItemAttempt (practice progress), notification mark-read
export function patchDetail<T>(detailKey: readonly unknown[], patch: (prev: T, vars: any) => T): OptimisticConfig<…>;

// mutation/recipes/increment-counter.ts → notification badge mark-read decrement
export function decrementBadge(badgeKey: readonly unknown[]): OptimisticConfig<…>;
```

The **closed allow-list** of callables permitted to pass `optimistic` (the ✅
set): `v1.levelup.recordItemAttempt`, `v1.levelup.sendChatMessage`,
`v1.identity.manageNotifications` (action `markRead` only). Everything else
passing `optimistic` fails the lint rule + the runtime guard.

### 6.3 Authority flag — the data the guard reads

```ts
// mutation/authority.ts
import { CALLABLES } from "@levelup/api-contract";
/** authoritySensitive is a new boolean on CallableDef (set true for every ⚷ row in REVIEW §6). */
export function isAuthoritySensitive(name: CallableName): boolean {
  return CALLABLES[name].authoritySensitive === true;
}
```

> **Contract dependency (cross-layer note):** this requires
> `@levelup/api-contract`'s `CallableDef` to gain `authoritySensitive?: boolean`
> and an exported `OPTIMISTIC_ALLOWLIST: readonly CallableName[]`. The
> api-contract layer owns adding these; this doc _consumes_ them. The ⚷ set is:
> grading (`gradeQuestion`), publish/lifecycle (`saveSpace` status, `saveExam`
> status, results-release), purchases (`purchaseSpace`), session authority
> (`submitTestSession`, `startTestSession`), all bulk ops, claims/membership
> writes. (REVIEW §6 items 1–13.)

---

## 7. Error boundary integration + `useApiError`

### 7.1 `ApiErrorBoundary`

```tsx
// error/ApiErrorBoundary.tsx
export interface ApiErrorBoundaryProps {
  fallback?: React.ComponentType<ErrorFallbackProps>; // default: <DefaultApiErrorFallback/>
  onError?: (error: ApiError) => void;
  children: React.ReactNode;
}
export interface ErrorFallbackProps {
  error: ApiError;
  reset: () => void;
}

/** Combines TanStack's QueryErrorResetBoundary with a class boundary so a thrown query/mutation
 *  error renders an explicit error UI (not an empty state — the parent-web fix, spec §5.2). */
export function ApiErrorBoundary(props: ApiErrorBoundaryProps): JSX.Element {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundaryClass
          onReset={reset}
          fallback={props.fallback ?? DefaultApiErrorFallback}
          onError={props.onError}
        >
          {props.children}
        </ErrorBoundaryClass>
      )}
    </QueryErrorResetBoundary>
  );
}
```

- `ErrorBoundaryClass` `componentDidCatch` runs the thrown error through
  `normalizeError`/`asApiError` so the fallback always receives a typed
  `ApiError { code, message, retryable, validationErrors }`.
- `reset()` calls TanStack's reset **and** the boundary's own `setState` so "Try
  again" re-runs the failed query.
- `DefaultApiErrorFallback` reads copy from
  `ERROR_MESSAGES`/`ERROR_RECOVERY_HINTS` (imported from
  `@levelup/api-contract`), shows `retryable` → a retry button.

### 7.2 `useApiError` (moved here, RN-safe)

```ts
// error/useApiError.ts
export interface UseApiErrorResult {
  /** Toast + log a single error. */
  handleError: (error: unknown, fallbackMessage?: string) => ApiError;
  /** Pure: normalize any thrown thing to a stable ApiError (no side effects). */
  toApiError: (error: unknown) => ApiError;
}
export function useApiError(): UseApiErrorResult {
  const { notify, isDev } = useApi(); // notify injected → no `sonner`; isDev → no `import.meta`
  const handleError = useCallback(
    (error: unknown, fallback?: string) => {
      const api = asApiError(error); // reads ApiError.code first, falls back to firebase code
      const copy =
        api.code === "INTERNAL_ERROR" && fallback
          ? fallback
          : (ERROR_MESSAGES[api.code] ?? api.message);
      notify.error(copy, { description: ERROR_RECOVERY_HINTS[api.code] });
      if (isDev) console.error(`[ApiError] ${api.code}:`, error);
      return api;
    },
    [notify, isDev]
  );
  return { handleError, toApiError: asApiError };
}
```

`asApiError` lives in `@levelup/api-client` as `normalizeError` and is
re-exported through `@levelup/repositories`; this hook imports the type+fn from
`@levelup/api-contract`/`repositories`, never reconstructing the firebase-code
mapping it does today (`use-api-error.ts:30-32`).

### 7.3 Global query error policy

```ts
// error/error-policy.ts
export function shouldThrowOnError(error: unknown, query: Query): boolean {
  const api = asApiError(error);
  // Auth/permission/not-found → throw to boundary (render an error UI, not empty state).
  if (
    [
      "PERMISSION_DENIED",
      "NOT_FOUND",
      "TENANT_SUSPENDED",
      "FEATURE_DISABLED",
    ].includes(api.code)
  )
    return true;
  // Background refetches with existing data → don't blow away the screen.
  return query.state.data === undefined;
}
export function defaultRetry(failureCount: number, error: unknown): boolean {
  const api = asApiError(error);
  if (api.retryable === false) return false; // 4xx/⚷ → never retry
  return failureCount < 2; // transient → up to 2 retries
}
export function globalQueryErrorHandler(error: unknown, query: Query): void {
  // last-resort logging hook; user-facing copy still comes from useApiError / boundary.
}
```

---

## 8. The lint rule: `no-optimistic-on-authority`

A custom ESLint rule shipped from `@levelup/eslint-config` (rule lives there;
**its test lives in this package** since the recipe framework is here).

```
Rule id:  @levelup/no-optimistic-on-authority
Type:     problem
Target:   CallExpression where callee.name === 'defineMutation'
```

**Logic:**

1. Find the object argument's `callable` property (a string literal
   `'v1.<module>.<op>'`).
2. Find whether an `optimistic` property is present (and not `undefined`).
3. If `optimistic` present AND `callable` value ∈ the build-time
   `AUTHORITY_SENSITIVE` set (imported from `@levelup/api-contract`'s generated
   `OPTIMISTIC_ALLOWLIST` complement) → **error**:
   `"Optimistic updates are forbidden on authority-sensitive callable '<name>' (grading/publish/lifecycle/purchase/session). See spec §5.5."`
4. Secondary check: `optimistic` present AND `callable` ∉ `OPTIMISTIC_ALLOWLIST`
   → **error** (closed allow-list: even non-⚷ callables can't opt into optimism
   unless explicitly allow-listed).

The allow-list/⚷ set is **imported from the contract package at lint time** (the
rule reads a JSON emitted by api-contract's build, `optimistic-allowlist.json`),
so adding a new ⚷ callable in the contract automatically tightens the lint with
zero rule edits. This is the static twin of the runtime guard in
`defineMutation` (§6.1) — defense in depth: the runtime guard catches dynamic
construction, the lint catches the 99% static case at PR time.

---

## 9. Contract / lint tests this layer requires

`src/__contract__/` (run against built `@levelup/api-contract`, no emulator
needed):

1. **`key-registry.contract.test.ts`**
   - Every `DomainName` has a `QUERY_KEYS[domain]` factory.
   - Every factory's `root()` returns `[domain]` and every key's first element
     is a `DomainName`.
   - `isSensitiveKey(editItemKey(x))` is `true`; no `QUERY_KEYS.*` factory ever
     produces a sensitive key.
   - Keys are JSON-serializable + structurally stable (snapshot of
     representative keys).

2. **`invalidation-graph.contract.test.ts`**
   - **Totality:** every mutating `CallableName` (rateTier `write`/`ai`/`auth`
     or `idempotent`) has an `INVALIDATION_GRAPH` entry.
   - **Valid roots:** every `roots[]` entry ∈ `DomainName`.
   - **Fanout safety:** every `fanout` resolver, given a stub
     `{vars, data, keys}`, returns arrays whose first element ∈ `DomainName` (or
     a sensitive scope — rejected).
   - **No orphan roots:** every `DomainName` referenced by some rule actually
     has a key factory.

3. **`optimistic-allowlist.contract.test.ts`**
   - `defineMutation` with `optimistic` on any `authoritySensitive` callable
     **throws** at construction.
   - `defineMutation` with `optimistic` on a non-allow-listed callable
     **throws**.
   - The three allow-listed callables construct successfully with their recipes.
   - The allow-list in this package === `OPTIMISTIC_ALLOWLIST` exported by
     `@levelup/api-contract` (drift guard — fails if the two ever disagree).

4. **`lint-rule.test.ts`** (`RuleTester`)
   - Valid:
     `defineMutation({ callable: 'v1.levelup.sendChatMessage', optimistic: {…} })`.
   - Invalid:
     `defineMutation({ callable: 'v1.autograde.gradeQuestion', optimistic: {…} })`
     → 1 error.
   - Invalid: optimistic on a non-allow-listed read-ish callable → 1 error.
   - Valid: any callable with **no** `optimistic` key.

5. **`provider.test.tsx`** (jsdom)
   - `useApi()` throws outside `<ApiProvider>`.
   - `ApiProvider` mounts a `QueryClientProvider`; `useQueryClient()` returns
     the same instance as `useApi().queryClient`.
   - `resetForTenantSwitch` clears the cache.
   - `useApiError().handleError` routes through the injected `notify` (mock),
     not `sonner`.

6. **`error-boundary.test.tsx`** (jsdom)
   - A query that throws `PERMISSION_DENIED` renders the fallback (not empty
     state).
   - A background refetch error with existing data does **not** throw to the
     boundary.
   - `reset()` re-runs the failed query.

7. **RN-purity build check** (CI, not vitest): `tsc`/bundle the package under an
   RN resolver and assert zero `firebase`/DOM/`import.meta` references (greps
   `import.meta`, `window.`, `'firebase'`).

---

## 10. Public API barrel (`src/index.ts`)

```ts
// provider
export { ApiProvider } from "./provider/ApiProvider";
export {
  useApi,
  useRepos,
  useApiClient,
  useTransport,
  useNotify,
  useOffline,
  useIsDev,
} from "./provider/useApi";
export { makeQueryClient } from "./provider/createQueryClient";
export { resetForTenantSwitch } from "./provider/reset";
export type {
  ApiContextValue,
  ApiProviderProps,
  ApiProviderOptions,
  NotifyAdapter,
} from "./provider/types";

// keys
export {
  createKeyFactory,
  QUERY_KEYS,
  spaceKeys,
  storyPointKeys,
  itemKeys,
  progressKeys,
  examKeys,
  submissionKeys /* …all */,
} from "./keys";
export { EDIT_ITEM_SCOPE, editItemKey, isSensitiveKey } from "./keys/scopes";
export type {
  DomainName,
  KeyFactory,
  KeyRoot,
  AnyQueryKey,
} from "./keys/types";

// invalidation
export {
  INVALIDATION_GRAPH,
  invalidateForCallable,
  buildGraphFromContract,
} from "./invalidation";
export type { InvalidationRule, FanoutResolver } from "./invalidation/types";

// mutation framework
export { defineMutation } from "./mutation/define-mutation";
export { appendToList, patchDetail, decrementBadge } from "./mutation/recipes";
export { isAuthoritySensitive } from "./mutation/authority";
export type {
  MutationSpec,
  OptimisticConfig,
  MutationKind,
} from "./mutation/types";

// error
export { ApiErrorBoundary } from "./error/ApiErrorBoundary";
export { useApiError } from "./error/useApiError";
export { shouldThrowOnError, defaultRetry } from "./error/error-policy";
export type {
  ApiErrorBoundaryProps,
  ErrorFallbackProps,
  UseApiErrorResult,
} from "./error/types";

// realtime seam consumer
export { useSubscription } from "./realtime/useSubscription";

// testing utils (separate entry: '@levelup/query/testing')
```

> **Not exported:** per-domain hooks (`useSpaces`, `useGradeQuestion`, …). Those
> are authored in `src/<domain>/` by the per-domain layer plans _using_
> `defineMutation` + the key factories above, and are added to the barrel by
> those plans. This document fixes only the infrastructure contract they
> consume.

---

## 11. `useSubscription` (realtime seam consumer — minimal here)

```ts
// realtime/useSubscription.ts  (full realtime design is a separate spec; this is the cache-write seam)
export function useSubscription<S extends SubscriptionName>(
  name: S,
  params: ParamsOf<S>,
  onPayload?: (payload: PayloadOf<S>, qc: QueryClient) => void
): { status: "idle" | "live" | "error" } {
  const { transport } = useApi();
  const qc = useQueryClient();
  useEffect(() => {
    const handle = transport.subscribe(name, params, (payload) =>
      onPayload
        ? onPayload(payload, qc)
        : qc.setQueryData(subscriptionKey(name, params), payload)
    );
    return () => handle.unsubscribe();
  }, [name, JSON.stringify(params)]);
  // …status tracking
}
```

Lives here (not in `@levelup/realtime`) because it's the React binding that
writes into the query cache; `@levelup/realtime` owns the transport-agnostic
`subscribe` seam + `SubscriptionHandle`.

---

## 12. Open questions / risks for this layer

1. **`authoritySensitive` + `OPTIMISTIC_ALLOWLIST` must be added to
   `@levelup/api-contract`.** This layer's lint rule and runtime guard both read
   them. Flagged as a cross-layer dependency (§6.3, §8). _Recommend:_ contract
   layer derives `authoritySensitive` directly from the ⚷ rows in REVIEW §6 so
   the two never drift.
2. **Tenant switch = full `qc.clear()`.** Correct but blunt; acceptable because
   switching is rare and re-auth already forces `getIdToken(true)`. Revisit only
   if multi-tenant tabs are introduced.
3. **`fanout` resolvers cast `vars as any`.** They read fields the contract
   guarantees but TS can't correlate `CallableName` → `vars` shape inside the
   graph map. _Recommend:_ a typed
   `defineRule<N extends CallableName>(name, rule: InvalidationRule<ReqOf<N>>)`
   builder so each resolver is typed against `ReqOf<N>` (deferred — graph
   correctness is contract-tested regardless).
4. **`throwOnError` default true for queries** changes failure UX globally;
   per-screen opt-outs use `useQuery({ throwOnError: false })`. Documented so
   domain hooks for "soft" reads (e.g. optional badges) opt out.
5. **`import.meta` ban** requires every web app to pass `isDev` explicitly;
   missing it silently disables dev response-validation logging. _Mitigation:_
   the RN-purity CI grep + a provider warning when `isDev===undefined` in a
   `process.env.NODE_ENV!=='production'` build.
