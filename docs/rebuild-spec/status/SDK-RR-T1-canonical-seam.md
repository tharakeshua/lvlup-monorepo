# SDK Re-Review T1 — Canonical-Seam Drift: Exhaustive Trace + Promote-to-api-contract Migration Map

**Reviewer:** be-sdk 🧠 · **Mode:** READ-ONLY — no code changed, nothing pushed.
**Branch:** `staging` · **Root:** `/Users/subhang/Desktop/Projects/auto-levleup`
· **Date:** 2026-06-27 **Theme (single):** _"Canonical types promised in
`@levelup/api-contract` but built nowhere — hand-copied 3–5× and drifting."_
**Source pass:** [`SDK-REVIEW-PHASE1.md`](./SDK-REVIEW-PHASE1.md) §"Theme A" +
§"Cross-cutting recommendation".

---

## 0. TL;DR (for the gate decision)

- **8 distinct canonical types** are hand-copied across the tree, **24
  declaration sites total**, of which **6 carry real semantic drift** (not just
  duplication).
- **Recommended home: `@levelup/api-contract/src/transport/` (NOT a new
  `@levelup/seam` leaf).** Every one of these types references
  api-contract-owned generics (`CallableName`, `ReqOf/ResOf`,
  `SubscriptionName/ParamsOf/PayloadOf`, `ApiErrorDetails`), so a zero-dep leaf
  would have to depend on api-contract anyway — adding a package buys nothing
  and contradicts the docblocks already written ("`@levelup/api-contract`
  (`src/transport/transport.ts`)" appears verbatim in 4 files). **Zero cycle
  risk:** api-contract depends only on `@levelup/domain` + `zod`; none of the
  promoted types pull in firebase/react/node.
- **Collapses ~13 of the ~25 Theme-A findings** directly (TR-1, TR-2, REPO-4,
  MISC-11, LB-03/Q-DUP-1, Q-DUP-1, plus 4× paginate / 3× SaveResponse
  intra-dups) — see §5.
- **Two callouts that are NOT a "promote to api-contract" fix:**
  - **MISC-3 (AiGateway port):** the canonical home is `@levelup/ai` (already
    exports `AiGateway`), **not** api-contract — it's a server-runtime gateway,
    not a wire contract. Remedy = _import the real one_, not promote. (§4.7)
  - **One genuinely-unsafe-to-unify divergence:** the `query` layer's
    deliberately-loosened `Transport.invoke(name: string, data: unknown)` (§6) —
    it is a _looser_ structural view by design, not drift. It can still consume
    the canonical type, but must keep a widened local alias.
- **One latent runtime bug surfaced while tracing** (not in the Phase-1 list):
  `createApiClient` never attaches a `storage` property, yet `storageRepo` calls
  `api.storage.requestUploadUrl(...)`/`api.storage.upload(...)` →
  **`api.storage` is `undefined` at runtime → TypeError on first
  avatar/answer-sheet upload.** Only hidden because the repo types against the
  structural `ApiClientSeam` fiction. (§4.2)

---

## 1. Inventory — every copy of every canonical type

> Legend: ✅ = matches the proven canonical shape · ⚠️ = drifts (semantic) · 🔁
> = pure duplicate (identical text, different file) · 🪢 = looser-by-design
> structural view.

### 1.1 `Transport` (+ `SubscriptionHandle`, `SubscriptionCallbacks`/`-Listener`/`SubscribeCallback`)

| #   | File:line                                                  | `storage`?                         | `subscribe` cb param                     | error type on cb                   | notes                                                                                       |
| --- | ---------------------------------------------------------- | ---------------------------------- | ---------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------- |
| T-a | `packages/api-client/src/transport.ts:49`                  | ❌ none                            | `SubscriptionListener<P>` (rich-or-bare) | `ApiError` (api-client class)      | docblock: "Kept BYTE-IDENTICAL to transport-realtime.md §1" — **but it isn't (no storage)** |
| T-b | `packages/transport-firebase/src/transport-contract.ts:78` | ✅ **`storage: StorageTransport`** | `SubscribeCallback<P>`                   | `TransportError = ApiErrorDetails` | the only copy with `storage` → **not swappable with the others**                            |
| T-c | `packages/transport-http/src/seam.ts:53`                   | ❌ none                            | inline `Cb \| (p)=>void`                 | `TransportError = ApiErrorDetails` | "re-stated locally"; HTTP adapter has no storage                                            |
| T-d | `packages/query/src/provider/types.ts:40`                  | ❌ none                            | inline `Cb \| (p)=>void`                 | `SeamError = ApiErrorDetails`      | 🪢 **`invoke(name: string, data: unknown)`** — deliberately loosened (see §6)               |

Supporting handle/callback copies (travel with each Transport copy):

- `SubscriptionHandle` declared **4×** — `transport.ts:24`,
  `transport-contract.ts:32`, `transport-http/seam.ts:31`,
  `query/provider/types.ts:29`, **plus a 5th stripped copy**
  `repositories/src/internal/api-types.ts:78` (`{ unsubscribe(): void }` only —
  no `id`/`active`) and a 6th in `realtime/src/seam.ts:20`. → **6 copies, 2
  shapes** (full `{unsubscribe,id,active}` vs bare `{unsubscribe}`).
- `SubscriptionCallbacks<P>` declared **5×** — `transport.ts:34`,
  `transport-contract.ts:41`, `transport-http/seam.ts:41`,
  `query/provider/types.ts:22`, `realtime/seam.ts:30`. Drift: error param is
  `ApiError`(api-client) in T-a/realtime vs `ApiErrorDetails`(structural) in the
  rest.

**Proven canonical `Transport` shape (the superset all four are structurally
meant to satisfy):**

```ts
interface Transport {
  invoke<N extends CallableName>(name: N, data: ReqOf<N>): Promise<ResOf<N>>;
  subscribe<S extends SubscriptionName>(
    name: S,
    params: ParamsOf<S>,
    cb: SubscriptionListener<PayloadOf<S>>
  ): SubscriptionHandle;
  serverTimeOffset(cb: (offsetMs: number) => void): SubscriptionHandle;
  refreshToken(forceRefresh?: boolean): Promise<void>;
  storage: StorageTransport; // ← MUST be on the canonical shape; see §4.2
}
```

**Rationale on `storage`:** the only _implementer_ (`transport-firebase`)
carries it and the repo layer depends on it; an adapter without storage
(transport-http) is simply incomplete, not a different contract. Putting
`storage` on the canonical Transport makes that incompleteness a **compile error
in transport-http** (correct) instead of a silent `undefined` (current). The
`error`-callback type on the canonical seam should be **`ApiErrorDetails`** (the
wire-edge structural envelope) — `ApiError` is the api-client's _richer mapped
class_ and must not be the seam type (it would force every implementer to depend
on api-client, breaking the downward-only rule).

---

### 1.2 Storage capability (the most fragmented — 4 mismatched shapes, method-name + signature drift)

| #   | File:line                                                   | Type name                     | Upload method signature                                                                                    | request method                                                               |
| --- | ----------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| S-a | `transport-firebase/src/transport-contract.ts:69`           | `StorageTransport`            | **`uploadImage(input: UploadBytesInput)`** → `Promise<void>`                                               | `requestUploadUrl(data: ReqOf<...>)` → `Promise<ResOf<...>>`                 |
| S-b | `repositories/.../seam.ts:62`                               | `StorageCapability`           | **`upload(uploadUrl, body, contentType)`** → `Promise<void>`                                               | `requestUploadUrl(input: RequestUploadUrlInput)` → `Promise<UploadUrlGrant>` |
| S-c | _consumer_ `repositories/.../storage.ts:43-47`              | (uses S-b)                    | calls `api.storage.upload(url, body, ct)` **and** wraps its own `uploadImage(input): Promise<StoragePath>` | calls `api.storage.requestUploadUrl(input)`                                  |
| S-d | `transport-firebase/.../storage-transport.ts` (impl of S-a) | implements `StorageTransport` | implements `uploadImage`                                                                                   | implements `requestUploadUrl`                                                |

Plus the **input-type** fragmentation: `UploadBytesInput`
(`{uploadUrl, bytes, contentType}` — transport-contract.ts:53) vs
`RequestUploadUrlInput` + `UploadUrlGrant` + `UploadBody` (seam.ts:38-54) vs
`UploadImageInput` (storage.ts:25).

**The drift is load-bearing, not cosmetic:**

1. **Method-name mismatch:** repo calls `api.storage.upload(url, body, ct)`
   (S-b) but the real transport exposes `uploadImage(input)` (S-a). These are
   not assignable.
2. **Wiring gap:** `createApiClient` (create-client.ts:36-90) returns
   `{...namespaces, subscribe, call}` — **no `storage` key**.
   `grep storage packages/api-client/src` = **0 hits**. So even if names
   matched, `api.storage` is `undefined`. → **runtime TypeError** the moment
   `storageRepo.uploadImage()` runs. (Surfaced here; extends Phase-1 TR-2 from
   "fragmented" to "broken".)

**Proven canonical (recommend, in `api-contract/src/transport/storage.ts`):**

```ts
interface UploadBytesInput {
  uploadUrl: string;
  bytes: Blob | ArrayBuffer | Uint8Array;
  contentType: string;
}
interface StorageTransport {
  // transport-edge capability
  requestUploadUrl(
    d: ReqOf<"v1.autograde.requestUploadUrl">
  ): Promise<ResOf<"v1.autograde.requestUploadUrl">>;
  uploadImage(input: UploadBytesInput): Promise<void>;
}
```

The repo-facing `StorageCapability`/`UploadUrlGrant`/`UploadKind` (S-b) is a
**higher-level convenience surface** and may stay in repositories — but its
`upload(url,body,ct)` call **must** be renamed to
`uploadImage({uploadUrl,bytes,contentType})` to match the one real impl, and
`createApiClient` **must** wire `storage: transport.storage`. (Reconciliation,
not just promotion.)

---

### 1.3 `PageRequest` — 9 declarations, cursor-nullability drift

| #         | File:line                                           | `cursor` type                               | `limit`               | verdict           |
| --------- | --------------------------------------------------- | ------------------------------------------- | --------------------- | ----------------- |
| **canon** | `api-contract/src/pagination.ts:13` (zod)           | `z.string().optional()` → `cursor?: string` | `.default(20)`, 1–100 | ✅ **SSOT**       |
| P-1       | `repositories/internal/api-types.ts:48`             | `cursor?: string`                           | `limit?: number`      | ✅ matches        |
| P-2       | `repositories/gamification/api-types.ts:38`         | `cursor?: string`                           | `limit?: number`      | ✅ matches        |
| P-3       | `repositories/testsession-progress/api-types.ts:33` | `cursor?: string`                           | `limit?: number`      | ✅ matches        |
| P-4       | `repositories/autograde/api-types.ts:49`            | **`cursor?: string \| null`**               | `limit?: number`      | ⚠️ nullable drift |
| P-5       | `repositories/analytics/api-types.ts:45`            | **`cursor?: string \| null`**               | `limit?: number`      | ⚠️ nullable drift |
| P-6       | `repositories/levelup-content/_kit.ts:56`           | **`cursor?: string \| null`**               | `limit?: number`      | ⚠️ nullable drift |
| P-7       | `query/gamification/repos.ts:42`                    | `cursor?: string`                           | `limit?: number`      | 🔁 dup            |
| P-8       | `query/analytics/repos.ts:32`                       | `cursor?: string`                           | `limit?: number`      | 🔁 dup            |
| P-9       | `query/testsession-progress/repos.ts:33`            | `cursor?: string`                           | `limit?: number`      | 🔁 dup            |

Also: `domain/src/primitives/page.ts:10`
`PageParams { cursor?: Cursor; limit: number }` — the **branded,
transport-neutral** primitive (different layer, not a wire copy; keep).

**Canonical:** `cursor?: string` (optional, **not** nullable). **Caveat — a real
latent bug the unification must resolve:** `_kit.ts:102` `makePaginator` does
`fetch({ ...req, cursor: null })` on end-of-stream, i.e. it _sends_
`cursor: null`. The zod `PageRequest.strict()` accepts `undefined` but **rejects
`null`**. So the nullable copies (P-4/5/6) mask a request the contract would
reject. Fix during migration: paginators must thread `cursor: undefined` (or
omit), not `null`.

---

### 1.4 `PageResponse<T>` — 9 declarations, fully uniform (pure dup)

`{ items: T[]; nextCursor: string | null; total?: number }` — **identical** at:
`api-contract/pagination.ts:36` (canon, also the zod `pageResponse(item)`
builder at :24),
`repositories/{internal:53, gamification:44, testsession-progress:41, autograde:54, analytics:50}`,
`query/{gamification:46, analytics:36, testsession-progress:28}`, and
`repositories/levelup-content/_kit.ts:62` (named `Page<T>`). **No drift — safe
to collapse to the existing `api-contract` export.**

---

### 1.5 `SaveResponse` — drift between two families

| #         | File:line                                        | Shape                                                         | verdict                                                 |
| --------- | ------------------------------------------------ | ------------------------------------------------------------- | ------------------------------------------------------- |
| **canon** | `api-contract/callables/core/_shared.ts:9` (zod) | `{ id: string; created?: boolean; deleted?: boolean }` strict | ✅ **SSOT**                                             |
| canon-dup | `api-contract/callables/identity/_shared.ts:26`  | **identical** `{ id, created?, deleted? }`                    | 🔁 **intra-contract dup** (should re-export core)       |
| SR-1      | `repositories/internal/api-types.ts:60`          | `{ id: string; created?: boolean; deleted?: boolean }`        | ✅ matches                                              |
| SR-2      | `repositories/autograde/api-types.ts:61`         | `{ id: string; created?: boolean; deleted?: boolean }`        | ✅ matches                                              |
| SR-3      | `repositories/gamification/api-types.ts:51`      | **`SaveResponse<Id> { id: Id; created: boolean }`**           | ⚠️ generic id, `created` **required**, **no `deleted`** |
| SR-4      | `query/gamification/repos.ts:51`                 | **`SaveResponse<Id> { id: Id; created: boolean }`**           | ⚠️ same drift as SR-3                                   |
| SR-5      | `shared-types/src/callable-types.ts:35`          | `{ id: string; created: boolean }` (legacy)                   | ⚠️ legacy pkg, `created` required, no `deleted`         |

**Canonical:** `{ id: string; created?: boolean; deleted?: boolean }`. The
gamification `SaveResponse<Id>` (SR-3/4) is the drift: it generic-izes `id`
(cosmetic, lossy on the wire where it's always a string), makes `created`
**required** (the server may omit it → `undefined` is valid per contract), and
**drops `deleted`** (so a gamification delete that returns `{deleted:true}` is
mistyped). Unify to the contract shape; the branded id can be recovered at the
repo boundary if desired, not on the wire type.

---

### 1.6 `SaveInput<TData>` envelope — 1 canonical-ish, worth co-locating

`repositories/internal/api-types.ts:67`
`{ id?: string; data?: TData; delete?: boolean }`. No api-contract twin exists
as a generic (each callable re-spells `{id?, data, delete?}` inline). Low-drift;
**optional** to promote (it's a convention, not yet duplicated enough to bite).
Note only.

---

### 1.7 `Callable<Req, Res>` alias — 6 identical copies

`type Callable<Req, Res> = (req: Req) => Promise<Res>;` at:
`repositories/{internal:93, gamification:166, autograde:304, analytics:57, testsession-progress:179}`
and `repositories/views-and-storage-auth/seam.ts:133`. Pure dup, zero drift.
Trivial collapse (or just a `CallFn<Req,Res>` in the seam module).

---

### 1.8 `ApiClientLike` / `ApiClientSeam` / `ModuleNamespace` — structural views, no compile link (LB-03 / Q-DUP-1)

| #    | File:line                                         | Shape                                                                                                                                                | binds to real client?                                          |
| ---- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| AC-1 | `repositories/levelup-content/_kit.ts:36`         | `{ identity/levelup/autograde/analytics: ModuleNamespace; subscribe; call }` where `ModuleNamespace = Record<string, (d:unknown)=>Promise<unknown>>` | ❌ no — returns `Promise<unknown>` everywhere (Phase-1 REPO-7) |
| AC-2 | `repositories/views-and-storage-auth/seam.ts:149` | `ApiClientSeam { identity: IdentitySeam; storage: StorageCapability; auth: AuthCapability }`                                                         | ❌ no — `storage`/`auth` not on real client (§4.2)             |
| AC-3 | `query/provider/types.ts:52`                      | `export type ApiClientLike = object`                                                                                                                 | ❌ no — fully opaque                                           |

These are **hand-maintained structural fictions** of `@levelup/api-client`'s
`ApiClient` mapped type (`api-client/src/types.ts:28`). None imports the real
`ApiClient`, so a callable rename in the contract never breaks them — **silent
divergence**. The real `ApiClient` is derived from `CALLABLES`, so the _honest_
fix is for these consumers to import a structural-but-linked view (a
`Pick`/mapped slice of the real `ApiClient`), which requires the real
`ApiClient` type to be reachable. Today repositories declares
`@levelup/api-client` as a dep but **never imports it** (Phase-1 LB-03) — so the
link is one import away.

---

### 1.9 Subscription status enum — 4-state vs 3-state (MISC-11)

| #    | File:line                                  | States                                               | name                 |
| ---- | ------------------------------------------ | ---------------------------------------------------- | -------------------- |
| ST-1 | `realtime/src/types.ts:7`                  | **4:** `"idle" \| "connecting" \| "live" \| "error"` | `RealtimeStatus`     |
| ST-2 | `query/src/realtime/useSubscription.ts:18` | **3:** `"idle" \| "live" \| "error"`                 | `SubscriptionStatus` |

`query` ships its own `useSubscription` (Phase-1 MISC-1: the `realtime` runtime
is dead/off-path), and its 3-state enum **drops `"connecting"`** — so a UI built
on `@levelup/query` can never render a connecting spinner that the `realtime`
package's hook would expose. The two hooks are different runtimes; the _type_
should still be one. **Canonical: 4-state
`"idle" | "connecting" | "live" | "error"`** (superset; `query`'s hook can
simply never emit `"connecting"` without breaking the type). Promote as
`SubscriptionStatus` next to the seam.

> Note: `transport-http/seam.ts` (cited in Phase-1 MISC-11) restates
> `SubscriptionCallbacks`/`Handle` but does **not** declare a status enum — the
> 4-vs-3 split is precisely ST-1 vs ST-2.

---

## 2. Proven canonical variants — summary table

| Type                       | Canonical shape                                            | Lives today (best existing)                      | Drifting copies to fix                                                                         |
| -------------------------- | ---------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `Transport`                | superset **with** `storage`, cb error = `ApiErrorDetails`  | (none correct) — closest: transport-firebase T-b | T-a (no storage, claims byte-identical), T-c (no storage), T-d (looser by design — keep alias) |
| `SubscriptionHandle`       | `{ unsubscribe(): void; id: string; active: boolean }`     | transport-firebase :32                           | internal/api-types :78 (bare), all others 🔁                                                   |
| `SubscriptionCallbacks<P>` | error = `ApiErrorDetails`                                  | transport-http/realtime                          | T-a + realtime use `ApiError` class                                                            |
| `StorageTransport`         | `{ requestUploadUrl; uploadImage(UploadBytesInput) }`      | transport-firebase S-a (+ real impl S-d)         | repo `StorageCapability.upload(url,body,ct)` → rename to `uploadImage`                         |
| `PageRequest`              | `{ cursor?: string; limit?: number }`                      | api-contract pagination.ts:13                    | autograde/analytics/\_kit nullable (P-4/5/6)                                                   |
| `PageResponse<T>`          | `{ items: T[]; nextCursor: string\|null; total?: number }` | api-contract pagination.ts:36                    | none (all 🔁)                                                                                  |
| `SaveResponse`             | `{ id: string; created?: boolean; deleted?: boolean }`     | api-contract core/\_shared.ts:9                  | gamification SR-3/4 (`<Id>`, required `created`, no `deleted`)                                 |
| `Callable<Req,Res>`        | `(req: Req) => Promise<Res>`                               | (any)                                            | 6× pure dup                                                                                    |
| `SubscriptionStatus`       | `"idle"\|"connecting"\|"live"\|"error"`                    | realtime/types.ts:7                              | query 3-state ST-2                                                                             |

---

## 3. Recommended home — `@levelup/api-contract/src/transport/` (with rationale)

**Decision: promote into `api-contract`, in a new `src/transport/` subtree. Do
NOT create a `@levelup/seam` leaf.**

**Why api-contract, not a new leaf:**

1. **Every promoted type already references api-contract-owned symbols.**
   `Transport` needs `CallableName/ReqOf/ResOf` (from `registry.ts`) +
   `SubscriptionName/ParamsOf/PayloadOf` (from `subscriptions/`); the callbacks
   need `ApiErrorDetails` (from `errors.ts`). A zero-dep leaf would have to
   `import { CallableName } from "@levelup/api-contract"` → so the leaf depends
   on api-contract → and `transport-firebase`/`api-client`/`query` would then
   depend on **both** the leaf and api-contract. Net: +1 package, +1 edge, zero
   isolation gained.
2. **The docblocks already promise this exact path.** `transport-contract.ts:6`,
   `transport-http/seam.ts:5`, `realtime/seam.ts:5`, `api-client/transport.ts:1`
   all say the canonical home is _"`@levelup/api-contract`
   (`src/transport/transport.ts`)"_. The intended design _was_ api-contract; it
   just never got built.
3. **No cycle is created.** `api-contract` currently depends only on
   `@levelup/domain` + `zod` (verified `package.json`). The consumers
   (`api-client`, `transport-firebase`, `transport-http`, `repositories`,
   `query`, `realtime`) **already** depend on `api-contract`. Adding these
   exports introduces **no new edge and no cycle** — it's strictly a downward
   move of types that consumers already import api-contract for. `domain` (the
   only thing api-contract depends on) is untouched.

**Why not split into `@levelup/seam`:** the only argument for a leaf is "keep
api-contract free of transport concerns." But these _are_ contract concerns —
the `Transport` interface is the wire seam definition, exactly what an
api-contract owns. The leaf would also need a build target, tsup config,
package.json, and 6 new dependency edges for no behavioral gain.

**Proposed file layout under `packages/api-contract/src/transport/`:**

```
transport/
  transport.ts     → Transport, SubscriptionHandle, SubscriptionCallbacks,
                     SubscriptionListener, SubscriptionStatus
  storage.ts       → StorageTransport, UploadBytesInput
  index.ts         → barrel
```

Re-export from `api-contract/src/index.ts`:

```ts
export type {
  Transport,
  SubscriptionHandle,
  SubscriptionCallbacks,
  SubscriptionListener,
  SubscriptionStatus,
} from "./transport/transport";
export type { StorageTransport, UploadBytesInput } from "./transport/storage";
// SaveResponse / PageRequest / PageResponse already exported — collapse the in-tree dups onto them.
```

The `error`-callback type is `ApiErrorDetails` (already an api-contract export)
— keeps the seam free of the api-client `ApiError` class.

---

## 4. Migration map — exact import repoints + copies to delete

> Ordered so the tree typechecks after **each** step (bottom-up: define → point
> implementers → point consumers → delete copies).

### Step 1 — Author the canonical module (additive, breaks nothing)

- **Create**
  `packages/api-contract/src/transport/{transport.ts,storage.ts,index.ts}` with
  the §2 shapes.
- **Add** the re-exports to `api-contract/src/index.ts` (§3).
- **Collapse intra-contract dup:** make `identity/_shared.ts:26` re-export
  `SaveResponseSchema` from `core/_shared.ts` instead of re-declaring (it
  already re-exports `PageRequest`; do the same for `SaveResponse`).
- Build `api-contract`. ✅ No consumer touched yet.

### Step 2 — Point the implementers at the canonical `Transport`/`Storage`

| File                                                     | Action                                                                                                                                                                                                                                                                                  |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `transport-firebase/src/transport-contract.ts:32-101`    | Delete local `Transport`/`SubscriptionHandle`/`SubscriptionCallbacks`/`SubscribeCallback`/`StorageTransport`/`UploadBytesInput`; `import type {...} from "@levelup/api-contract"`. Keep the barrel re-export so internal imports (`storage-transport.ts`, `subscribe/*`) still resolve. |
| `transport-firebase/src/storage/storage-transport.ts:23` | Repoint `StorageTransport, UploadBytesInput` import to api-contract (via the barrel re-export = no change if barrel re-exports).                                                                                                                                                        |
| `transport-http/src/seam.ts:27-75`                       | Delete local `Transport`/handle/callbacks/`TransportError`; import from api-contract. **This now fails to compile** (no `storage`) — that is the **intended** signal that transport-http is an incomplete adapter; add a `storage` impl or mark the adapter explicitly partial.         |
| `realtime/src/seam.ts:16-46`                             | Delete local `SubscriptionHandle`/`SubscriptionCallbacks`; import from api-contract. Keep `RealtimeTransport` (a legit `Pick`-slice) but define it as `Pick<Transport, "subscribe" \| "serverTimeOffset">`.                                                                             |

### Step 3 — Point api-client at the canonical `Transport`

| File                                       | Action                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api-client/src/transport.ts:24-71`        | Delete local `Transport`/`SubscriptionHandle`/`SubscriptionCallbacks`/`SubscriptionListener`; `import type {...} from "@levelup/api-contract"`. **Re-export them** from here (api-client/index.ts:20-22 currently re-exports these — keep the public surface stable). The cb error type changes from `ApiError`→`ApiErrorDetails` at the seam; api-client's own `normalizeError` still produces the rich `ApiError` downstream (no behavior change, the seam just stops over-claiming). |
| `api-client/src/types.ts:28` (`ApiClient`) | **Add `storage: StorageTransport`** to the mapped type.                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `api-client/src/create-client.ts:86-90`    | **Wire it:** `return { ...namespaces, subscribe, call, storage: transport.storage }`. ← fixes the §4.2 runtime bug.                                                                                                                                                                                                                                                                                                                                                                     |

### Step 4 — Point repositories at canonical wire envelopes + Storage

| File:line                                                  | Delete                                                                        | Repoint to                                                                                                                                                |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `repositories/internal/api-types.ts:48,53,60,78,93`        | `PageRequest`,`PageResponse`,`SaveResponse`,`SubscriptionHandle`,`Callable`   | `import type { PageRequest, PageResponse, SaveResponse } from "@levelup/api-contract"`; `SubscriptionHandle` from api-contract; `Callable` → shared alias |
| `repositories/autograde/api-types.ts:49,54,61,304`         | `PageRequest`(nullable→drop),`PageResponse`,`SaveResponse`,`Callable`         | api-contract (cursor narrows to `string`)                                                                                                                 |
| `repositories/analytics/api-types.ts:45,50,57`             | `PageRequest`(nullable→drop),`PageResponse`,`Callable`                        | api-contract                                                                                                                                              |
| `repositories/gamification/api-types.ts:38,44,51,166`      | `PageRequest`,`PageResponse`,**`SaveResponse<Id>`→`SaveResponse`**,`Callable` | api-contract (lose the `<Id>` generic + required-`created`; recover branded id at repo boundary if needed)                                                |
| `repositories/testsession-progress/api-types.ts:33,41,179` | `PageRequest`,`PageResponse`,`Callable`                                       | api-contract                                                                                                                                              |
| `repositories/levelup-content/_kit.ts:56,62`               | `PageRequest`(nullable→drop),`Page<T>`→use `PageResponse<T>`                  | api-contract; keep `PageBag`/`toPage`/`makePaginator` (runtime helpers) but **fix paginator to thread `cursor: undefined` not `null`** (§1.3 caveat)      |
| `repositories/views-and-storage-auth/seam.ts:133`          | `Callable`                                                                    | shared alias                                                                                                                                              |
| `repositories/views-and-storage-auth/storage.ts:47`        | `api.storage.upload(url,body,ct)`                                             | **rename to** `api.storage.uploadImage({uploadUrl,bytes,contentType})` (match the one real impl)                                                          |
| `repositories/.../seam.ts:62` `StorageCapability.upload`   | the `upload(url,body,ct)` method                                              | replace with `uploadImage(UploadBytesInput)` OR keep the convenience surface but have it call the canonical `uploadImage`                                 |

### Step 5 — Point query at the canonical types

| File:line                                   | Delete                                                   | Repoint to                                                                                                                                                                                                                                                                           |
| ------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `query/provider/types.ts:22,29,40`          | `SubscriptionCallbacks`,`SubscriptionHandle`,`Transport` | import `SubscriptionCallbacks`/`SubscriptionHandle` from api-contract; **keep a local `Transport`** alias that _widens_ `invoke` (§6) — `type QueryTransport = Omit<Transport,"invoke"> & { invoke(n:string,d:unknown):Promise<unknown> }`, or just `Pick` the realtime half it uses |
| `query/gamification/repos.ts:42,46,51`      | `PageRequest`,`PageResponse`,`SaveResponse<Id>`          | api-contract                                                                                                                                                                                                                                                                         |
| `query/analytics/repos.ts:32,36`            | `PageRequest`,`PageResponse`                             | api-contract                                                                                                                                                                                                                                                                         |
| `query/testsession-progress/repos.ts:28,33` | `PageResponse`,`PageRequest`                             | api-contract                                                                                                                                                                                                                                                                         |
| `query/realtime/useSubscription.ts:18`      | `SubscriptionStatus` (3-state)                           | api-contract `SubscriptionStatus` (4-state; hook simply never emits `"connecting"`)                                                                                                                                                                                                  |

### Step 6 — Collapse `SubscriptionStatus` source + `Callable` alias

- `realtime/src/types.ts:7` `RealtimeStatus` → re-export `SubscriptionStatus`
  from api-contract (or alias `RealtimeStatus = SubscriptionStatus`).
- Introduce one `Callable<Req,Res>` in `api-contract/src/transport/transport.ts`
  (or a tiny `types.ts`) and delete the 6 copies.

### Step 7 — Honest structural views (LB-03 / Q-DUP-1) — _follow-on, not blocking_

- `repositories` already declares `@levelup/api-client` as a dep but never
  imports it. Have `_kit.ts:36` `ApiClientLike` and `seam.ts:149`
  `ApiClientSeam` derive from the real `ApiClient` via a `Pick`/mapped slice so
  a contract rename breaks them.
  `query/provider/types.ts:52 ApiClientLike = object` can stay opaque (it
  genuinely doesn't read) — but document that choice.

---

## 5. Findings this collapses

**Directly resolved (the promote-into-api-contract move):**

- **TR-1** — one `Transport`; the "byte-identical but isn't" lie disappears
  (storage on canonical).
- **TR-2** — one `StorageTransport`; _plus_ the migration forces the
  `upload`→`uploadImage` rename and the `createApiClient` wiring (the actual
  runtime bug).
- **REPO-4** — `PageRequest`/`PageResponse`/`SaveResponse`/`Callable` collapse
  from 5× to 1; cursor-nullability + `SaveResponse<Id>` drift eliminated.
- **MISC-11** — one `SubscriptionStatus` (4-state);
  `SubscriptionHandle`/`SubscriptionCallbacks` unified.
- **LB-03 / Q-DUP-1** — structural-view drift addressed in Step 7 (link to real
  `ApiClient`).
- **Cross-cutting (Phase-1 §"resolves ~25 findings"):** the 4× paginate kit
  duplication, the 3× `SaveResponseSchema`/2× intra-contract `SaveResponse` dup,
  the 6× `Callable` alias, the 5× `SubscriptionCallbacks`, the 6×
  `SubscriptionHandle`.

**Estimate:** ~**13 named findings + ~8 unnamed duplications** collapse →
consistent with Phase-1's "~25". Counting each declaration site removed: **~24
declaration sites → ~9 canonical types in one module.**

**Indirectly de-risked (not fixed, but the type stops lying):**

- **REPO-7** (`levelup-content` returns `Promise<unknown>`) — Step 7 gives it a
  real link.
- **F-SSOT-02** (bounded lists bypass `pageResponse`) — easier once one
  `PageResponse` exists.

---

## 6. NOT safe to unify (genuine divergence — keep distinct)

1. **`query`'s loosened `Transport.invoke(name: string, data: unknown)` (T-d,
   `query/provider/types.ts:40`).** This is **intentional**, not drift: the
   query layer is forbidden (downward-only) from importing
   `@levelup/api-client`'s `CallableName`-parameterized `invoke`, and it only
   needs the realtime `subscribe` half plus an opaque `invoke`. It _can_ import
   the canonical `SubscriptionHandle`/`SubscriptionCallbacks`, but its
   `Transport`-named alias must **widen** `invoke`. Verdict: **share the
   sub-types, keep a local widened `QueryTransport` alias** (don't force the
   strict `invoke` signature on it).

2. **`domain/src/primitives/page.ts` `PageParams`/`Page<T>`/`Cursor`
   (branded).** Different layer, on purpose: domain owns the **branded,
   transport-neutral** `Cursor`; api-contract owns the **wire** `string` cursor.
   The two are a deliberate brand/unbrand boundary, **not** a duplicate. Keep
   both.

3. **`AiGateway` port (MISC-3) — wrong target for api-contract.**
   `functions-shared/context/ports.ts:190` `AiGateway` (with
   `TokenUsage{promptTokens,completionTokens,totalTokens}`,
   `AiResponse{data,tokenUsage,cost,model}` — **no `text`**) is a _structural
   stand-in_ for `ai/src/gateway.ts:79` `AiGateway` (real
   `AiResponse{data, **text**, tokenUsage, cost, model, moderation?}`, and
   `repos-seam.ts` uses **`inputTokens`/`outputTokens`** not `promptTokens`).
   This is a server-runtime gateway, **not a wire contract** — it must **not**
   go in api-contract. The ports.ts docblock already states the intended fix:
   _"replace these local structural seams with
   `import type { AiGateway } from '@levelup/ai'`."_ Remedy = **import the real
   one** (requires `functions-shared` to add `@levelup/ai` as a dep — verified
   it currently depends on access/api-contract/domain/services but **not** ai;
   confirm `@levelup/ai` doesn't depend back on `functions-shared` before adding
   the edge — `ai` depends on api-contract/domain, so no cycle). The
   `promptTokens` vs `inputTokens` mismatch is a **real bug**
   (`ctx.ai.generate()` is typed against a fiction that omits `text` and renames
   the token fields).

4. **`shared-types/src/callable-types.ts:35` `SaveResponse` +
   `shared-hooks`/`shared-services` legacy usages.** These are the **legacy
   (pre-fat-SDK) packages** still on `@levelup/shared-types`. Out of scope for
   the fat-SDK seam; do **not** repoint them to api-contract (they're a
   separate, soon-deprecated stack). Note only — left as-is until the legacy
   stack is retired.

---

## 7. Circular-dependency analysis (explicit)

- **api-contract gaining `transport/`:** introduces **no new edge.**
  api-contract → `domain` + `zod` only (unchanged). All consumers (`api-client`,
  `transport-firebase`, `transport-http`, `repositories`, `query`, `realtime`)
  already depend on api-contract. The promoted types reference only symbols
  api-contract already owns (`CallableName`, `Req/ResOf`,
  `SubscriptionName/Params/PayloadOf`, `ApiErrorDetails`). **No cycle. Safe.**
- **MISC-3 `functions-shared`→`@levelup/ai`:** new edge `functions-shared → ai`.
  `ai → {api-contract, domain}` (no back-edge to functions-shared). **No
  cycle**, but verify in `ai/package.json` before wiring. (Separate from the
  api-contract promotion.)
- **Storage convenience surface staying in repositories:** no change to edges
  (`repositories → api-client` already declared, currently unused).

---

## 8. One-line gate recommendation

Promote the **9 canonical types** into `@levelup/api-contract/src/transport/`
(zero cycle, matches every docblock's stated intent), execute the **7-step
bottom-up repoint** in §4, and treat **TR-2's `createApiClient` storage-wiring**
as a **must-fix runtime bug** (not just a dedup) — it's the only Theme-A item
that is currently _broken at runtime_, not merely drifting. Keep §6's four
divergences distinct.

_End of RR-T1. READ-ONLY — no code changed, nothing pushed._
