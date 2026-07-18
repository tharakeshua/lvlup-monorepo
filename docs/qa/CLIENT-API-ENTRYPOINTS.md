# Client API entrypoints (`api-contract` + `sdk-v1`)

Short map for web and future iOS/Android clients. Companion: [`BACKEND-MOBILE-COMPAT.md`](./BACKEND-MOBILE-COMPAT.md).

---

## `@levelup/api-contract` — wire SSOT

| Item | Location |
|------|----------|
| Package | `packages/api-contract` |
| Public barrel | `packages/api-contract/src/index.ts` → import `@levelup/api-contract` |
| Version constant | `API_VERSION` (`"v1"`), helpers `callableName` / `parseCallableName` in `src/meta.ts` |
| Registry | `CALLABLES`, `CALLABLE_NAMES`, `getCallable`, `ReqOf` / `ResOf` in `src/registry.ts` |
| Per-op schemas | `src/callables/{identity,levelup,autograde,analytics}/**` |
| Errors | `AppErrorCode`, `ApiErrorDetailsSchema`, HTTPS↔app maps in `src/errors.ts` |
| Pagination | `PageRequest`, `pageResponse` in `src/pagination.ts` |
| Subscriptions | `src/subscriptions/` (RTDB/Firestore live channels) |
| Transport types | `src/transport/` (`Transport`, `StorageTransport`, …) |

**Client rule:** treat `CALLABLES[name].requestSchema` / `responseSchema` as the only request/response shapes. Do not duplicate Zod in the app.

**Invoke shape:**

```ts
import type { ReqOf, ResOf } from "@levelup/api-contract";

// Preferred: typed api-client (built from CALLABLES)
await api.levelup.getSpace({ spaceId }); // ReqOf<"v1.levelup.getSpace">

type SpaceRes = ResOf<"v1.levelup.getSpace">; // { space: ... }
```

---

## `functions/sdk-v1` — deployable backend

| Item | Location |
|------|----------|
| Package name | `@levelup/functions-sdk-v1` |
| Entrypoint | `functions/sdk-v1/src/index.ts` |
| Nested export | `export const v1 = { identity, levelup, autograde, analytics }` |
| Module barrels | `src/identity.ts`, `src/levelup.ts`, `src/autograde.ts`, `src/analytics.ts` |
| Bootstrap | `src/bootstrap.ts` (Admin init + runtime ports) — import side-effect first |
| Firebase codebase | `firebase.json` → `codebase: "sdk-v1"`, source `functions/sdk-v1` |
| Region | `asia-south1` (all mobile/web prod callables) |

**Deploy id grammar:** nested export `v1.levelup.getSpace` → Firebase function id `v1-levelup-getSpace`.

**Business logic:** stays in `@levelup/services`; sdk-v1 only wires `makeCallable(name, serviceFn)`.

**Deploy (ops):**

```bash
pnpm -F @levelup/functions-sdk-v1 build
# uses prepare-deploy-pkg.mjs via firebase predeploy
firebase deploy --only functions:sdk-v1 --project lvlup-ff6fa
```

---

## Client stack (web + React Native)

Compose once per app (already done in `apps/mobile-*/src/sdk/api.ts`):

1. `getFirebaseServices()` — Auth / Firestore / RTDB / Storage / Functions  
2. `createFirebaseTransport(services, { region: "asia-south1" })`  
3. `createApiClient(transport, { validateResponses: true })`  
4. Attach `api.auth` via `createFirebaseAuthHandle`  
5. `createRepositories(api)` → mount `@levelup/query` `ApiProvider`

Transport maps dotted contract names → dashed deploy ids in `invokeViaCallable` (`toDeployedCallableId`). Apps never call `httpsCallable` with dashed ids directly.

---

## What not to use for new mobile work

| Avoid | Prefer |
|-------|--------|
| Railway / ad-hoc REST “mobile API” | Firebase callable `v1.*` |
| `@levelup/shared-services` Firestore helpers | `@levelup/query` + repos |
| Legacy non-versioned function names | `v1-<module>-<op>` via api-client |
| Putting Admin SDK / service accounts in the app | Server-only secrets |

---

## Quick verify

```bash
pnpm -F @levelup/api-contract test
pnpm -F @levelup/transport-firebase test
pnpm -F @levelup/repositories test
pnpm -F @levelup/functions-sdk-v1 test
```
