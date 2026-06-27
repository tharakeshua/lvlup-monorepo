# S-student-web — App Transport / SDK Config (Slice B → GATE B output)

How the student-web app root wires the **fat SDK**
(`@levelup/transport-firebase` + `@levelup/api-client` + `@levelup/query`
`ApiProvider`) to the **deployed** `v1.*` Cloud Functions on the real project,
and how it flips to the local emulator for dev.

The deployed `v1.levelup.*` callables were verified end-to-end against the
v2\_-prefixed seed in GATE B — see the verify results at the bottom of the run
report.

---

## (a) PROD — project `lvlup-ff6fa`

| Thing               | Value                                                                                                                                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Firebase project    | `lvlup-ff6fa` (project number `504506746594`)                                                                                                                                                                                  |
| Functions region    | `asia-south1`                                                                                                                                                                                                                  |
| Functions base URL  | `https://asia-south1-lvlup-ff6fa.cloudfunctions.net`                                                                                                                                                                           |
| Callable id grammar | dotted contract `v1.<module>.<op>` → deployed id `v1-<module>-<op>` (Firebase forbids dots; the transport maps dots→dashes in `invokeViaCallable`/`toDeployedCallableId`). e.g. `v1.levelup.getSpace` → `v1-levelup-getSpace`. |

Web config (safe to ship — Firebase web API keys are public identifiers;
security is enforced server-side in every callable via Firebase ID-token
verification + claims):

```ts
const firebaseConfig = {
  apiKey: "AIzaSyCnH1XXcLRVMPCvtjBGotCh_86hOJ2AV2E",
  authDomain: "lvlup-ff6fa.firebaseapp.com",
  projectId: "lvlup-ff6fa",
  appId: "1:504506746594:web:aac69e81f25dd95c5f80bb",
};
```

**The `LVLUP_COLLECTION_PREFIX=v2_` prefix is SERVER-SIDE ONLY.** It is set in
`functions/sdk-v1/.env.lvlup-ff6fa` and read by the Admin-SDK `repo-admin` paths
inside the functions. The app NEVER sees it: there are no client Firestore reads
— the client stays **deny-all on Firestore**, and ALL data flows through the
callables (which read/write the `v2_`-prefixed collections on the server). The
web config above carries no prefix and needs none.

---

## (b) EMULATOR DEV — project `demo-levelup`

| Thing              | Value                                                                                                     |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| Firebase project   | `demo-levelup` (demo project; no real creds needed)                                                       |
| Functions emulator | `connectFunctionsEmulator(functions, 'localhost', 5001)`                                                  |
| Auth emulator      | `connectAuthEmulator(auth, 'http://localhost:9099')`                                                      |
| Collection prefix  | **empty** (`.env.demo-levelup` has no `LVLUP_COLLECTION_PREFIX`, so the emulator/demo data is unprefixed) |

The functions region in the emulator is still `asia-south1` (the codebase binds
the region at definition time); `getFunctions(app, 'asia-south1')` then
`connectFunctionsEmulator(...)` routes those calls to the local emulator.

---

## (c) App-root wiring snippet

A single env flag (`VITE_USE_EMULATOR`) selects dev vs prod. The transport is
the ONLY place `firebase/{functions,firestore,database,auth,storage}` may be
imported.

```ts
// app/firebase.ts ────────────────────────────────────────────────────────────
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';

const USE_EMULATOR = import.meta.env.VITE_USE_EMULATOR === 'true';
const REGION = 'asia-south1';

const firebaseConfig = USE_EMULATOR
  ? { projectId: 'demo-levelup', apiKey: 'demo', appId: 'demo' }
  : {
      apiKey: 'AIzaSyCnH1XXcLRVMPCvtjBGotCh_86hOJ2AV2E',
      authDomain: 'lvlup-ff6fa.firebaseapp.com',
      projectId: 'lvlup-ff6fa',
      appId: '1:504506746594:web:aac69e81f25dd95c5f80bb',
    };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const functions = getFunctions(app, REGION); // region bound here; transport does NOT re-region
const db = getFirestore(app);
const rtdb = getDatabase(app);
const storage = getStorage(app);

if (USE_EMULATOR) {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFunctionsEmulator(functions, 'localhost', 5001);
  // (optional) connectFirestoreEmulator / connectDatabaseEmulator / connectStorageEmulator
}

export const firebaseServices = { functions, db, rtdb, auth, storage };

// app/api.ts ──────────────────────────────────────────────────────────────────
import { createFirebaseTransport } from '@levelup/transport-firebase';
import { createApiClient } from '@levelup/api-client';
import { firebaseServices } from './firebase';

const isDev = import.meta.env.DEV;

// FirebaseTransportServices = { functions, db, rtdb, auth, storage }
export const transport = createFirebaseTransport(firebaseServices, {
  validatePayloads: isDev,        // dev-only request/subscription Zod gate
});

export const api = createApiClient(transport, {
  validateResponses: isDev,       // dev-only response Zod gate (single validation owner)
});

// app/root.tsx ──────────────────────────────────────────────────────────────────
import { ApiProvider } from '@levelup/query';
import { buildRepositories } from '@levelup/repositories'; // the read "brain" over the api client
import { api, transport } from './api';
import { sonnerNotify } from './notify'; // NotifyAdapter (web: sonner)

const repos = buildRepositories(api);    // Repositories surface the hooks read through

export function Root({ children }: { children: React.ReactNode }) {
  return (
    <ApiProvider
      api={api}
      repos={repos}
      transport={transport}
      notify={sonnerNotify}
      isDev={import.meta.env.DEV}
    >
      {children}
    </ApiProvider>
  );
}
```

Notes:

- `validatePayloads` / `validateResponses` are **dev-only** Zod gates
  (`import.meta.env.DEV`); prod runs lean (no response re-validation on the wire
  path).
- Firebase auto-forwards the signed-in user's ID token on every callable — no
  manual `Authorization` header, no `tenantId` in the request body (the server
  derives tenant from the `tenantId` claim; a forged body `tenantId` is rejected
  by the `.strict()` parse).
- The student app is **deny-all on Firestore**; reads come from callables + the
  realtime subscribe seam (RTDB-backed), never direct Firestore queries.

---

## GATE B note for the app team (deployed-callable state)

- `v1.levelup.*` callables are deployed (region `asia-south1`) and the read path
  is verified: `listSpaces`, `getSpace`, `getSpaceProgress` return the seeded v2
  data, and the `getItemForEdit`-as-student trust boundary is enforced
  (`permission-denied`).
- Each deployed callable's underlying Cloud Run service needs `allUsers` →
  `roles/run.invoker` (the standard public-callable binding; security is the
  in-function ID-token check). This was applied to the 7 student-vertical
  callables; the remaining `v1.*` services still need it if/when the rest of the
  codebase is deployed.
- Two follow-ups block `listStoryPoints` / `listItems` / `recordItemAttempt`
  end-to-end (data/infra, NOT app or transport config) — see the GATE B run
  report:
  1. story-point docs were seeded under the nested path but the runtime reads
     the flat `tenants/{t}/storyPoints` mirror;
  2. two `items` COLLECTION_GROUP indexes need deploying (added to
     `firestore.indexes.json`).

```

```
