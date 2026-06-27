# Common API Layer — Rebuild Spec

> **Scope.** This section specifies the single, unified API layer that every
> Auto-LevelUp client consumes: the 5 web apps (`teacher-web`, `student-web`,
> `admin-web`, `super-admin`, `parent-web`) **and** the new React Native apps
> (learner RN, and the planned answer-sheet scanner). It defines the API
> surface, the auth flow, the shared typed client SDK that lives in `packages/`,
> the error model, pagination, and exactly how each piece maps onto today's
> Firebase callables.
>
> **Design principle.** Keep every core concept that exists today (the `save*`
> upsert pattern, server-validated status state machines, path-based tenant
> isolation, the User/Membership/Claims identity triad, Zod-at-the-boundary, the
> auth→validate→authorize→rate-limit→mutate→side-effect pipeline). Fix the
> _structural_ problems that block a single shared client: scattered contracts,
> two competing consumption paths, stringly-typed endpoint names, partial
> validation, inconsistent pagination/errors, and direct Firestore reads in the
> UI.

---

## 1. Goals & Non-Goals

### Goals

1. **One contract, all clients.** A single typed contract package consumed
   verbatim by web, React Native, Cloud Functions, seed/test tooling — no
   duplicated or inline request/response types.
2. **One consumption path.** Every read and write in every app goes through the
   same typed client SDK. No app ever imports `firebase/firestore` or calls
   `httpsCallable(...)` with a stringly-typed name.
3. **Transport-agnostic.** Firebase Callable stays the default transport, but
   the client talks to an `invoke(name, data)` seam so a future HTTPS/REST
   gateway (needed by the scanner device and third parties) can be slotted in
   without touching app code.
4. **RN-ready.** The SDK and the data hooks have zero DOM/web dependencies and
   run unchanged under React Native.
5. **Validated both directions.** Requests validated server-side (already true);
   responses validated client-side in dev to catch contract drift across two
   platforms.

### Non-Goals (this section)

- Re-architecting the AI/LLM gateway (covered in the AI spec).
- The Firestore security-rules rewrite (covered in the auth/access spec) — rules
  remain _defense-in-depth_ behind this API.
- Realtime transport (test-session deadline, chat streaming, notification
  badges, grading status) — flagged in §10 as a parallel concern with its own
  contract.

---

## 2. Architecture Overview

```
                          ┌──────────────────────────────────────────────┐
   WEB (5 apps)           │             React Native (2 apps)             │
   teacher / student /    │       learner-rn  /  scanner-rn               │
   admin / super / parent │                                              │
        │                 │                  │                            │
        ▼                 ▼                  ▼                            ▼
   ┌────────────────────────────────────────────────────────────────────────┐
   │  packages/shared-hooks   (React Query hooks — platform neutral)          │
   │   useSpaces() / useSaveSpace() / useGradeQuestion() / useSummary() ...    │
   └────────────────────────────────────────────────────────────────────────┘
        │ calls only ▼ (never firebase/* directly)
   ┌────────────────────────────────────────────────────────────────────────┐
   │  packages/api-client    (typed SDK over a callable REGISTRY)              │
   │   api.levelup.saveSpace(req) -> validated Res                            │
   │   api.identity.switchActiveTenant(req)                                   │
   │   transport: invoke(name, data) — injectable                            │
   └────────────────────────────────────────────────────────────────────────┘
        │ depends on ▼
   ┌────────────────────────────────────────────────────────────────────────┐
   │  packages/api-contract  (SINGLE SOURCE OF TRUTH)                         │
   │   per-callable Zod schema + z.infer types + registry entry              │
   │   error model + pagination fragment + state machines                    │
   └────────────────────────────────────────────────────────────────────────┘
        │ shared by ▼                                   ▲ also imported by
   ┌──────────────────────────────────┐   ┌──────────────────────────────────┐
   │ packages/shared-firebase          │   │ functions/{identity,levelup,      │
   │  (client SDK transport adapter)   │   │  autograde,analytics}             │
   │  invokeViaCallable(name,data)     │   │  thin onCall adapters → services  │
   └──────────────────────────────────┘   └──────────────────────────────────┘
                                                       │
                                              ┌──────────────────────────────┐
                                              │ functions/<m>/src/services    │
                                              │ transport-agnostic business    │
                                              │ logic taking an AuthContext    │
                                              └──────────────────────────────┘
```

**Key shift from today:** Reads no longer hit Firestore from the browser. Today
`~30` hook files and the stores call `firebase/firestore` directly against
`tenants/{tenantId}/...` (see shared-packages report §4.1–4.3). In the rebuild,
_every_ read is a callable/endpoint behind `api-client`. This is the
prerequisite for React Native (no Firestore SDK path coupling), for a future
REST gateway, and for server-side aggregation (kills the N+1 read fan-outs the
status reports flagged in `super-admin` LLMUsagePage and `parent-web`).

### New packages

| Package                    | Responsibility                                                                                                                                   | Platform deps                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| `packages/api-contract`    | All request/response Zod schemas + inferred types, the callable registry, error model, pagination fragment, `ALLOWED_TRANSITIONS` state machines | none (pure TS + zod)            |
| `packages/api-client`      | The typed SDK: `createApiClient(transport)` → namespaced methods; response validation in dev                                                     | none (zod + injected transport) |
| `packages/shared-firebase` | Firebase client SDK adapter implementing the `Transport` interface (`invokeViaCallable`), auth handle, region config                             | `firebase`                      |

`shared-types` keeps the **domain** model; `api-contract` keeps the **wire**
contract and derives from `shared-types` domain types where a request embeds a
domain object. `shared-hooks` becomes platform-neutral (only
`@tanstack/react-query` + `api-client`). `shared-ui` becomes presentational
only.

---

## 3. API Surface

The API is RPC-style **typed callables** (keeping Firebase Callable as
transport). Each callable has a **stable name**, a **request schema**, and a
**response schema**, registered once. We keep the deployed `~47`-callable
surface (api-layer report §1) but organize it into a versioned, namespaced
registry.

### 3.1 Naming & versioning

- Callable names are versioned by prefix: `v1.<module>.<operation>` (e.g.
  `v1.levelup.saveSpace`). The registry carries `apiVersion` so a future `v2`
  can be dual-run for migrations — closing the api-layer report's gap #9 (no
  versioning).
- Operations follow the **`save*` upsert** convention (no `id` = create, `id`
  present = update, lifecycle = field/state-machine transitions,
  `data.deleted = true` = soft-delete). This is already implemented for
  `saveSpace`/`saveExam`/`saveStudent`/... and is carried forward verbatim.
- **Combined-mode endpoints** keep their discriminator field:
  `gradeQuestion.mode`, `getSummary.scope`, `generateReport.type`,
  `manageNotifications.action`.

### 3.2 Registry shape (`packages/api-contract`)

```ts
// One entry per callable. requestSchema/responseSchema are zod.
export interface CallableDef<Req, Res> {
  name: string; // 'v1.levelup.saveSpace'
  module: ApiModule; // 'identity' | 'levelup' | 'autograde' | 'analytics'
  requestSchema: ZodType<Req>;
  responseSchema: ZodType<Res>;
  authMode: "authed" | "public"; // 'public' only for pre-auth lookups
  rateTier: "write" | "read" | "ai" | "auth" | "report";
}

export const CALLABLES = {
  "v1.levelup.saveSpace": saveSpaceDef,
  "v1.levelup.saveItem": saveItemDef,
  // ...all ~47
} as const;

export type CallableName = keyof typeof CALLABLES;
export type ReqOf<N extends CallableName> = z.infer<
  (typeof CALLABLES)[N]["requestSchema"]
>;
export type ResOf<N extends CallableName> = z.infer<
  (typeof CALLABLES)[N]["responseSchema"]
>;
```

Types are **derived** via `z.infer` from the schema — eliminating the
hand-written `callable-types.ts` interfaces that today drift from the Zod
schemas (identity report §4.7, api-layer report §4.1). Each callable lives in
one file colocating its schema + type.

### 3.3 Module-by-module endpoint inventory (carried forward)

> Listed as `name (request → response)`. Every list endpoint uses the unified
> pagination fragment (§7). `tenantId` is **no longer in the request body for
> normal calls** — it is derived server-side from the caller's active-tenant
> claim (§4.4). Only super-admin cross-tenant ops accept an explicit
> `tenantOverride`.

**identity** (`functions/identity`)

- `v1.identity.saveTenant` (super-admin) — create/update tenant; transactional
  tenantCode reservation, default feature seeding, creator membership.
- `v1.identity.deactivateTenant` / `v1.identity.reactivateTenant` — soft
  lifecycle; suspends/restores memberships + revokes refresh tokens (auth-access
  spec).
- `v1.identity.exportTenantData` → `{ downloadUrl, expiresAt }` (signed Storage
  URL).
- `v1.identity.uploadTenantAsset` → `{ assetUrl }`.
- `v1.identity.saveStudent` / `saveTeacher` / `saveParent` / `saveStaff` /
  `saveClass` / `saveAcademicSession` — consolidated upsert →
  `SaveResponse{ id, created }`. Create branch also provisions membership +
  claims via one factory (identity report rec #3).
- `v1.identity.createOrgUser` — Auth user + entity + membership + claims (saga +
  idempotency key, identity report rec #4).
- `v1.identity.switchActiveTenant` → `{ tenantId }` — rebuilds claims for target
  tenant, forces token refresh client-side.
- `v1.identity.joinTenant` — self-join by tenant code (creates lazily-backed
  student profile).
- `v1.identity.bulkImportStudents` / `bulkImportTeachers` / `bulkUpdateStatus` /
  `rolloverSession` — bulk ops, batched, idempotent.
- `v1.identity.manageNotifications` (`action: 'list' | 'markRead'`).
- `v1.identity.saveAnnouncement` / `listAnnouncements`.
- `v1.identity.searchUsers` (super-admin) — batched membership fetch (no N+1).
- `v1.identity.saveGlobalEvaluationPreset` (super-admin).
- `v1.identity.lookupTenantByCode` (**public**) — minimal pre-auth projection
  `{ tenantId, name, branding }` only (auth-access spec; closes the
  tenant-enumeration leak).

**levelup** (`functions/levelup`)

- `v1.levelup.saveSpace` — upsert + `ALLOWED_TRANSITIONS` (`draft→published`,
  `published→{archived,draft}`, `archived→draft`) + `validatePublish` +
  store-listing side effect.
- `v1.levelup.saveStoryPoint` / `v1.levelup.saveItem` — upsert + delete;
  `saveItem` strips answer keys into the server-only subcollection.
- `v1.levelup.getItemForEdit` — re-merges stripped answer keys for the editor.
- `v1.levelup.listVersions` — paginated content-version history.
- `v1.levelup.startTestSession` / `submitTestSession` — server-authoritative
  timed-test runtime.
- `v1.levelup.evaluateAnswer` — single-answer eval; in the rebuild it **persists
  progress server-side** (levelup report rec #7), so clients no longer make a
  second `recordItemAttempt` call.
- `v1.levelup.recordItemAttempt` — non-test attempt → transactional progress
  writer.
- `v1.levelup.saveQuestionBankItem` / `listQuestionBank` / `importFromBank` /
  `saveRubricPreset`.
- `v1.levelup.sendChatMessage` — Socratic tutor (response schema concrete, not
  `unknown`).
- `v1.levelup.saveSpaceReview` / `listStoreSpaces` / `purchaseSpace`.
- **New read endpoints** replacing direct Firestore reads in student/teacher UI:
  `v1.levelup.listSpaces`, `v1.levelup.getSpace`, `v1.levelup.listStoryPoints`,
  `v1.levelup.listItems`, `v1.levelup.getSpaceProgress`,
  `v1.levelup.getStoryPointProgress`. These wrap the same documents the hooks
  read today (`tenants/{t}/spaces/...`) behind the API seam.

**autograde** (`functions/autograde`)

- `v1.autograde.saveExam` — upsert + status state machine.
- `v1.autograde.extractQuestions` — AI question/rubric extraction (concrete
  response schema).
- `v1.autograde.uploadAnswerSheets` — **single canonical ingestion path**
  (uploadSource `web | scanner | rn`); server creates the submission. The
  GCS-trigger path is removed (autograde report rec). This is the endpoint the
  scanner RN app calls.
- `v1.autograde.gradeQuestion` (`mode: 'manual' | 'retry' | 'ai'`) —
  human-in-the-loop override + retry.
- **New read endpoints**: `v1.autograde.listExams`, `v1.autograde.getExam`,
  `v1.autograde.listSubmissions`, `v1.autograde.getSubmission`,
  `v1.autograde.listQuestionSubmissions` (released-only projection for
  parent/student; full for teacher) — replaces parent-web/teacher-web direct
  Firestore reads and folds the `resultsReleased` gate into the server
  projection.

**analytics** (`functions/analytics`)

- `v1.analytics.getSummary`
  (`scope: 'student' | 'class' | 'platform' | 'health'`).
- `v1.analytics.generateReport` (`type: 'exam-result' | 'progress' | 'class'`) →
  `{ pdfUrl, expiresAt }`.
- **New**: `v1.analytics.getPerformanceTrends`, `v1.analytics.getChildSummary`,
  `v1.analytics.listLinkedChildren` — server-side aggregation for parent-web
  (parent-web report rec; removes client fan-out and the missing-rule access
  gaps for `studentProgressSummaries`).

---

## 4. Auth Flow

Auth is **Firebase Authentication** with the existing three-layer identity model
— unchanged conceptually (identity report §1.4, auth-access report). The API
layer standardizes how that identity reaches every callable.

### 4.1 Identity model (kept verbatim)

- `/users/{uid}` — `UnifiedUser` (`isSuperAdmin`, `activeTenantId`,
  `consumerProfile`).
- `/userMemberships/{uid}_{tenantId}` — `UserMembership`, one role per (user,
  tenant), source of truth for role + granular permissions.
- **Custom claims** (`PlatformClaims`) — minimal JWT cache read on the rules hot
  path; `MAX_CLAIM_CLASS_IDS=15` with `classIdsOverflow` fallback.

### 4.2 Login flows (kept)

- **B2B tenant login:** two-step school-code → email/password. Step 1 calls the
  **public** `v1.identity.lookupTenantByCode`; step 2 is Firebase email/password
  sign-in.
- **B2C consumer:** standard email/password / Google; no membership, served from
  `platform_public`.
- **Tenant switching:** `v1.identity.switchActiveTenant` rebuilds claims for the
  target tenant and the client forces `getIdToken(true)`. Claims are
  single-tenant at a time (carried forward from `auth-store.switchTenant`).

### 4.3 How auth attaches to every call

Firebase Callable already forwards the caller's ID token; `request.auth` gives
the server `{ uid, token: PlatformClaims }`. The rebuild formalizes a
server-side `AuthContext`:

```ts
interface AuthContext {
  uid: string;
  isSuperAdmin: boolean;
  activeTenantId: string | null; // from claims, NOT request body
  role: TenantRole | null;
  permissions: TeacherPermissions | StaffPermissions | null;
  classIds: string[]; // with overflow fallback to membership doc
  studentIds: string[];
}
```

Every business-logic service takes `(input, ctx: AuthContext)` (identity report
rec #1, levelup report rec #2). The `onCall` handler builds `ctx` from
`request.auth`, parses+validates `input`, then calls the service. A future REST
gateway builds the same `ctx` from a verified bearer token and calls the
identical service — this is the seam that makes one API serve web + RN + REST.

### 4.4 tenantId derivation (changed)

Today `tenantId` is a required field on nearly every request body (api-layer
report §4.8). In the rebuild:

- Normal callers: `tenantId` is **omitted from the request**; the server uses
  `ctx.activeTenantId`.
- Super-admin cross-tenant ops: an explicit `tenantOverride` field is allowed
  and audited.

This shrinks every request shape and removes the "wrong tenant" bug class.
Path-based isolation (`tenants/{tenantId}/...`) is unchanged — only the _source_
of `tenantId` changes (claim, not body).

### 4.5 Claim freshness & revocation

The auth-access spec adds `revokeRefreshTokens(uid)` on membership suspend /
tenant deactivate / role change, and a single
`syncMembershipClaims(uid, tenantId)` primitive called by every
role/status/class/permission-changing callable. The API layer's contribution:
every such callable in the registry is tagged so a lint/contract test asserts it
calls `syncMembershipClaims` (prevents the saveStudent/saveTeacher stale-claim
bugs from recurring).

---

## 5. Shared Typed Client SDK (`packages/api-client`)

### 5.1 Transport seam

```ts
export interface Transport {
  invoke<N extends CallableName>(name: N, data: ReqOf<N>): Promise<ResOf<N>>;
}
```

- **Web & RN today:** `invokeViaCallable` in `packages/shared-firebase` wraps
  `httpsCallable(functions, name)` (region `asia-south1`, from config — not
  hardcoded per file).
- **Future REST/scanner device:** `invokeViaHttp` POSTs `{ name, data }` (or
  `/v1/<module>/<op>`) with a bearer token.

The app never sees the transport — it only sees `api`.

### 5.2 The client

```ts
export function createApiClient(
  transport: Transport,
  opts?: { validateResponses?: boolean }
) {
  function call<N extends CallableName>(name: N) {
    const def = CALLABLES[name];
    return async (data: ReqOf<N>): Promise<ResOf<N>> => {
      const req = def.requestSchema.parse(data); // pre-flight validate
      const res = await transport.invoke(name, req as ReqOf<N>);
      if (opts?.validateResponses) def.responseSchema.parse(res); // dev: catch drift
      return res as ResOf<N>;
    };
  }
  return {
    identity: {
      saveTenant: call("v1.identity.saveTenant"),
      switchActiveTenant: call("v1.identity.switchActiveTenant"),
      // ...
    },
    levelup: { saveSpace: call("v1.levelup.saveSpace") /* ... */ },
    autograde: { gradeQuestion: call("v1.autograde.gradeQuestion") /* ... */ },
    analytics: { getSummary: call("v1.analytics.getSummary") /* ... */ },
  };
}
export type ApiClient = ReturnType<typeof createApiClient>;
```

This removes the **duplicated `getCallable<Req,Res>` factory copy-pasted into
every `*-callables.ts`** and the **stringly-typed names in 3+ places**
(api-layer report §4.3). The name lives once in the registry.

### 5.3 Hooks consume the client only

`packages/shared-hooks` becomes platform-neutral and depends only on
`@tanstack/react-query` + `api-client`:

```ts
export function useSaveSpace() {
  const api = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: ReqOf<"v1.levelup.saveSpace">) =>
      api.levelup.saveSpace(req),
    onSuccess: (_r, req) =>
      qc.invalidateQueries({ queryKey: spaceKeys.list(req.tenantOverride) }),
  });
}
```

- One consumption path (api-layer report rec #3): hooks never call
  `httpsCallable` directly.
- Hierarchical **query-key factories** centralized in `shared-hooks` (e.g.
  `spaceKeys`, `examKeys`) so invalidation is the narrowest correct scope —
  fixes the coarse `["tenants", tenantId]` invalidation in admin-web.
- These hooks run unchanged in React Native (no DOM).

### 5.4 Provider wiring per platform

```ts
// web (apps/*/main.tsx) and RN (App.tsx) — only difference is the transport
const api = createApiClient(invokeViaCallable(getFirebaseServices().functions),
                            { validateResponses: import.meta.env.DEV });
<ApiClientProvider client={api}><QueryClientProvider ...>...</></>
```

---

## 6. Error Model

Today handlers throw raw
`HttpsError('failed-precondition' | 'invalid-argument', ...)` and the documented
`{ error: { code, message, details } }` envelope is aspirational (api-layer
report §1 error contract, §4.5). The rebuild makes the envelope real and stable
on the wire.

### 6.1 Wire envelope

Every error is an `HttpsError` whose `details` **always** carries a typed
payload:

```ts
interface ApiErrorDetails {
  code: AppErrorCode; // 'VALIDATION_ERROR' | 'INVALID_TRANSITION' | 'QUOTA_EXCEEDED'
  // | 'FEATURE_DISABLED' | 'RATE_LIMITED' | 'NOT_FOUND'
  // | 'PERMISSION_DENIED' | 'TENANT_SUSPENDED' | ...
  message: string; // user-safe default; client may localize via ERROR_MESSAGES
  validationErrors?: { path: string; message: string }[]; // from Zod parseRequest
  retryable?: boolean;
  meta?: Record<string, JsonValue>;
}
```

`AppErrorCode`, `ERROR_MESSAGES`, `ERROR_RECOVERY_HINTS`, and the
`HTTPS_TO_APP_ERROR` / `APP_ERROR_TO_HTTPS` maps move into `api-contract` (they
exist today in `shared-types/error-types.ts`).

### 6.2 Server helper

```ts
function fail(
  code: AppErrorCode,
  message: string,
  extra?: Partial<ApiErrorDetails>
): never {
  throw new HttpsError(APP_ERROR_TO_HTTPS[code], message, {
    code,
    message,
    ...extra,
  });
}
```

`parseRequest` (Zod) maps failures to
`fail('VALIDATION_ERROR', ..., { validationErrors })`. State-machine violations
throw `fail('INVALID_TRANSITION', ...)` using the shared `ALLOWED_TRANSITIONS`
(now in `api-contract`, so the client can pre-validate transitions before
calling).

### 6.3 Client mapping

`useApiError` (already exists in shared-hooks) reads `error.details.code` first,
falls back to the Firebase code. The toast/recovery copy comes from
`ERROR_MESSAGES`/`ERROR_RECOVERY_HINTS`. A global React Query error boundary
surfaces non-empty-state errors (fixes parent-web's "errors render as empty
states" gap).

---

## 7. Pagination

Today three different shapes coexist (`cursor`/`nextCursor`,
`startAfter`/`lastId`/`hasMore`) — api-layer report §4.7. The rebuild has
exactly **one** reusable fragment in `api-contract`:

```ts
export const PageRequest = z.object({
  cursor: z.string().optional(), // opaque, server-encoded (Firestore doc path/snapshot)
  limit: z.number().int().min(1).max(100).default(20),
});
export const pageResponse = <T extends ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(), // null = end
    total: z.number().optional(), // only when cheaply known (count() aggregate)
  });
```

Every list endpoint (`listVersions`, `listQuestionBank`, `listStoreSpaces`,
`listAnnouncements`, `listSubmissions`, `searchUsers`, …) uses this. The
`cursor` is opaque to the client (a base64 of the Firestore cursor today; a row
key under a REST gateway tomorrow) — RN and web share identical paging logic.

---

## 8. Mapping to Existing Callables

The rebuild is a **re-organization, not a rewrite** of the backend logic.
Mapping:

| Current                                                                                                                                                                        | Rebuild                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `httpsCallable(functions, 'saveSpace')` scattered in hooks + `callSaveSpace` wrapper in `shared-services/auth`                                                                 | `api.levelup.saveSpace` via registry `v1.levelup.saveSpace`; one definition       |
| `callable-types.ts` interfaces + `callable-schemas.ts` Zod (two sources)                                                                                                       | one `*Def` per callable in `api-contract`; types via `z.infer`                    |
| `tenantId` in every request body                                                                                                                                               | derived from `ctx.activeTenantId`; `tenantOverride` only for super-admin          |
| Inline request types in `shared-services` (`StartTestSessionRequest`, `EvaluateAnswerRequest`, `SendChatMessageRequest`, `ExtractQuestionsRequest`, `CreateOrgUserRequest`, …) | promoted into `api-contract` schemas                                              |
| Cross-module leak (`callSaveSpace` exported from `auth` module)                                                                                                                | `api.levelup.*` vs `api.identity.*` — module boundary matches function module     |
| Direct `firebase/firestore` reads in `~30` hooks + stores                                                                                                                      | `v1.<module>.list*/get*` read endpoints; hooks call `api-client`                  |
| `gradeQuestion.mode`, `getSummary.scope`, `generateReport.type`, `manageNotifications.action`                                                                                  | unchanged (discriminated combined-mode endpoints kept)                            |
| `onCall` handler holds business logic                                                                                                                                          | `onCall` is a thin adapter → `functions/<m>/src/services/*` taking `(input, ctx)` |
| Region hardcoded `asia-south1` per file                                                                                                                                        | single config in `shared-firebase`/functions config module                        |
| Unvalidated `create-item.ts`, `list-versions.ts`; ad-hoc feature-callable validation                                                                                           | every callable validates via its registry `requestSchema`                         |
| `SaveItemRequest.data.payload: z.record(unknown)`                                                                                                                              | `z.discriminatedUnion('questionType', ...)` (levelup report rec #3)               |

Backend services keep the strong pieces verbatim: `progress-updater.ts` (single
transactional progress writer), answer-key isolation, rubric inheritance,
server-authoritative sessions, `ALLOWED_TRANSITIONS` state machines, the
confidence-based HITL grading routing, and per-tenant Secret Manager keys.

---

## 9. Cross-cutting Concerns

- **Rate limiting / quota / feature gates:** unchanged pipeline
  (`enforceRateLimit`, `assertQuota`, `assertFeatureEnabled`). `rateTier` is
  declared in the registry so the limiter and contract tests agree on the tier
  per callable.
- **Reliable side effects:** replace fire-and-forget `.catch(log)`
  (notifications, content versions, store mirror) with Firestore triggers or a
  transactional outbox so they retry (api-layer report rec #9, levelup report
  rec #6). The API contract is unaffected; only delivery becomes reliable.
- **Idempotency:** mutating callables that create external state
  (`createOrgUser`, `bulkImport*`, `submitTestSession`, `recordItemAttempt`,
  `purchaseSpace`) accept an optional `idempotencyKey` in the contract; the
  server dedupes (identity report rec #4, levelup report rec #7/#12).
- **Audit:** every mutating service writes to one audit-log collection (fix the
  `auditLogs`/`auditLog` split) best-effort, non-blocking.

---

## 10. Realtime (parallel concern, noted not designed here)

Four features are realtime today: test-session deadline, chat streaming,
notification badges (RTDB), grading status. These do **not** fit the
request/response callable model. The rebuild keeps them behind a separate,
also-typed `realtime-contract` (subscription name → payload schema) so RN and
web subscribe identically. For RN, prefer Firestore/RTDB listeners via
`shared-firebase` behind a `subscribe(name, params, cb)` seam mirroring
`invoke`. If Firestore is ever dropped, this seam is where SSE/WebSocket slots
in. (Full design deferred to the realtime/sync spec.)

---

## 11. Migration Note (from current code)

1. **Create `packages/api-contract`.** Move every Zod schema from
   `shared-types/src/schemas/callable-schemas.ts` and every inline request type
   from `shared-services` into one-file-per-callable defs; derive types via
   `z.infer`; delete `callable-types.ts` interfaces. Add the registry, error
   model, pagination fragment, and `ALLOWED_TRANSITIONS`.
2. **Create `packages/shared-firebase`** with `invokeViaCallable` + region
   config; **create `packages/api-client`** with `createApiClient`.
3. **Backend:** extract business logic from each `onCall` handler into
   `functions/<m>/src/services/*` taking `(input, ctx)`; the handler becomes
   parse → build `ctx` → service → return. Add response schemas; validate
   `payload` with the discriminated union; derive `tenantId` from claims.
4. **Add read endpoints** (`list*`/`get*`) for everything the UI currently reads
   directly from Firestore.
5. **Migrate hooks:** rewrite `shared-hooks/queries/*` to call `api-client`;
   delete direct `firebase/firestore` reads and the duplicated `getCallable`
   factories; centralize query-key factories. Dual-run is unnecessary because
   names are versioned (`v1.*`); old function names can alias to v1 during
   cutover.
6. **Apps:** swap raw reads/`httpsCallable` for hooks; wire `ApiClientProvider`
   in each `main.tsx`/RN `App.tsx`.
7. **Delete** the dead `organizations/{orgId}/...` generic
   `FirestoreService`/`StorageService`/`RealtimeDBService` (never used by live
   paths) and stale `docs/shared-packages.md`/`API_REDESIGN.md` (regenerate the
   endpoint inventory from the registry).
8. **Tests:** add contract tests asserting request+response schema validity per
   callable against the emulator (testing-infra report) — the durable backend
   gate, replacing the single thin `callable-schemas.test.ts`.
