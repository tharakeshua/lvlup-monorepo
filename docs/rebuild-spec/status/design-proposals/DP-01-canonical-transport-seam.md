# DP-1 · Canonical transport seam in `@levelup/api-contract`

**Wave:** W1 (spine) · **Status:** design-only · **Evidence:**
`SDK-RR-T1-canonical-seam.md`, R1/R3.

## Problem

8 canonical types are hand-copied across **24 declaration sites**, 6 with real
semantic drift:

- `Transport` ×4 (`api-client/transport.ts:49`,
  `transport-firebase/transport-contract.ts:78`, `transport-http/seam.ts:53`,
  `query/provider/types.ts:40`) — only firebase carries `storage` → **not
  swappable**; api-client claims "byte-identical" but isn't.
- `SubscriptionHandle` ×6 (2 shapes); `SubscriptionCallbacks` ×5
  (`ApiError`-class vs `ApiErrorDetails`); `SubscriptionStatus` 4-state
  (`realtime/types.ts:7`) vs 3-state (`query useSubscription:18`, drops
  `connecting`).
- `Storage` ×4 mismatched (`uploadImage(input)` vs `upload(url,body,ct)`).
  **LIVE RUNTIME BUG:** `createApiClient` never attaches `.storage` (0 grep
  hits) yet `storageRepo` calls `api.storage.*` → TypeError on first upload.
- `PageRequest` ×9 (autograde/analytics/\_kit use `cursor?:string|null` vs
  canonical `cursor?:string`; `_kit` paginator sends `cursor:null` the strict
  contract rejects). `PageResponse` ×9 (uniform). `SaveResponse` (gamification
  `{created required, no deleted}` vs canonical `{id,created?,deleted?}`).
  `Callable` alias ×6.

## Target design

Create `packages/api-contract/src/transport/` as the **single home**:

```
api-contract/src/transport/
  transport.ts        // Transport, StorageTransport
  subscription.ts     // SubscriptionHandle, SubscriptionCallbacks, SubscriptionStatus
  envelope.ts         // PageRequest, PageResponse, SaveResponse<Id>, Callable<Req,Res>
  index.ts
```

Every implementer (`transport-firebase`, `transport-http`, `realtime`) and
consumer (`api-client`, all `repositories/**/api-types.ts`, `query/provider`)
imports from here. `ApiClientLike` becomes `Pick<ApiClient, …>` of the _real_
surface.

**Why api-contract, not a new `@levelup/seam` leaf:** these types reference
api-contract-owned generics
(`CallableName`/`ReqOf`/`SubscriptionName`/`ParamsOf`/`ApiErrorDetails`) — a
leaf would depend on api-contract anyway (+1 pkg, +6 edges, 0 gain). **Zero
cycle risk:** api-contract deps = `domain` + `zod`; all consumers already import
it. Matches 4 docblocks that already promise this exact path.

**By-construction wins:** one `Transport` with `storage` → `transport-http`'s
missing storage is a _compile error_ (correct: it's a stub); wiring
`transport.storage` in `createApiClient` kills the runtime bug.

## Migration (7 bottom-up steps; typecheck after each)

1. Author `transport/` module + collapse the intra-contract `SaveResponse` dup
   (`core/_shared` + `identity/_shared`).
2. Point implementers (`transport-firebase`/`http`/`realtime`) at it —
   `transport-http` now fails compile on missing storage = correct signal.
3. Point `api-client` at it **+ wire `transport.storage` in `createApiClient`**
   (fixes runtime bug) + add `storage` to the `ApiClient` mapped type.
4. Repositories: 5 `api-types.ts` + `_kit` + rename storage
   `upload→uploadImage`.
5. Query: repos + provider (keep the widened `QueryTransport` alias).
6. Collapse `SubscriptionStatus` + `Callable`.
7. Honest `ApiClientLike` via `Pick` of the real `ApiClient`.

## Explicitly NOT unified (4)

1. query's `invoke(string, unknown)` — intentional downward widening (share
   sub-types, keep widened alias).
2. domain `PageParams`/`Cursor` — deliberate branded/wire boundary.
3. **AiGateway port** — canonical home is `@levelup/ai`, not api-contract
   (server-runtime gateway, not wire). Fix = `functions-shared` imports the real
   gateway (adds `@levelup/ai` dep, no cycle); the
   `promptTokens`-vs-`inputTokens` + missing-`text` mismatch is a real bug to
   fix here.
4. `shared-types` legacy `SaveResponse` — out of scope (deprecating).

## Tests

- A "no duplicate canonical type" lint/test asserting these symbols are declared
  only under `api-contract/src/transport/`.
- `createApiClient(...).storage` is defined (regression for the runtime bug).

## Closes

TR-1, TR-2 (incl. runtime bug — **must-fix, not dedup**), REPO-4, MISC-3,
MISC-11, LB-03/Q-DUP-1, + ~8 dup clusters.
