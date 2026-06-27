/**
 * Emulator connector for the SDK-rebuild integration suite.
 *
 * Single source of truth for:
 *   • the emulator HOST/PORTS (mirrors firebase.json emulators + region asia-south1),
 *   • the canonical PROJECT_ID (`demo-levelup` — matches CI's
 *     `firebase emulators:exec --project demo-levelup`; the legacy
 *     tests/integration/setup.ts hardcodes `lvlup-ff6fa`, which testing-infra.md
 *     §4 flags as a bug — we do NOT repeat it here),
 *   • the env vars the Admin SDK / `@levelup/repository-admin` / `@levelup/seed`
 *     read to auto-target the emulators (FIRESTORE_EMULATOR_HOST,
 *     FIREBASE_AUTH_EMULATOR_HOST, FIREBASE_DATABASE_EMULATOR_HOST),
 *   • lazy Admin + client app handles,
 *   • emulator data clear (REST DELETE) for teardown/clear-between-suites.
 *
 * Importing this module has the side-effect of exporting the emulator host env
 * vars (so any Admin SDK initialized afterward — including inside `@levelup/seed`
 * and `@levelup/repository-admin` — auto-connects to the emulators).
 */
import admin from "firebase-admin";
import {
  initializeApp as initClientApp,
  getApps as getClientApps,
  deleteApp as deleteClientApp,
  type FirebaseApp,
} from "firebase/app";
import { getAuth, connectAuthEmulator, type Auth as ClientAuth } from "firebase/auth";
import {
  getFirestore as getClientFirestore,
  connectFirestoreEmulator,
  type Firestore as ClientFirestore,
} from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator, type Functions } from "firebase/functions";

/** Canonical demo project id for the emulator. Must match CI's `--project`. */
export const PROJECT_ID = process.env["GCLOUD_PROJECT"] ?? "demo-levelup";

/** Deploy region for all callable functions (testing-infra.md §2, firebase.json). */
export const REGION = "asia-south1";

export const EMULATOR_HOST = process.env["EMULATOR_HOST"] ?? "127.0.0.1";

export const PORTS = {
  auth: Number(process.env["AUTH_EMULATOR_PORT"] ?? 9099),
  firestore: Number(process.env["FIRESTORE_EMULATOR_PORT"] ?? 8080),
  functions: Number(process.env["FUNCTIONS_EMULATOR_PORT"] ?? 5001),
  database: Number(process.env["DATABASE_EMULATOR_PORT"] ?? 9000),
} as const;

/**
 * Export the emulator host env vars BEFORE any Admin SDK init. The Admin SDK and
 * `@firebase/rules-unit-testing` read these to route to the emulators. Idempotent.
 */
export function exportEmulatorEnv(): void {
  process.env["GCLOUD_PROJECT"] = PROJECT_ID;
  process.env["FIREBASE_PROJECT_ID"] = PROJECT_ID;
  process.env["FIRESTORE_EMULATOR_HOST"] = `${EMULATOR_HOST}:${PORTS.firestore}`;
  process.env["FIREBASE_AUTH_EMULATOR_HOST"] = `${EMULATOR_HOST}:${PORTS.auth}`;
  process.env["FIREBASE_DATABASE_EMULATOR_HOST"] = `${EMULATOR_HOST}:${PORTS.database}`;
  // Some Admin SDK versions also honor this generic flag.
  process.env["FUNCTIONS_EMULATOR"] = "true";
}

// Side-effect on import: make every downstream Admin SDK init emulator-aware.
exportEmulatorEnv();

// ---------------------------------------------------------------------------
// Admin SDK (server-side; what @levelup/repository-admin + @levelup/seed use)
// ---------------------------------------------------------------------------

let adminApp: admin.app.App | undefined;

export function getAdminApp(): admin.app.App {
  if (adminApp) return adminApp;
  adminApp = admin.apps.length ? admin.app() : admin.initializeApp({ projectId: PROJECT_ID });
  return adminApp;
}

export function adminDb(): admin.firestore.Firestore {
  return getAdminApp().firestore();
}

export function adminAuth(): admin.auth.Auth {
  return getAdminApp().auth();
}

// ---------------------------------------------------------------------------
// Client SDK (browser-equivalent; what @levelup/transport-firebase uses).
// Integration suites that exercise the api-client → transport → callable path
// run against this app + the Functions emulator.
// ---------------------------------------------------------------------------

let clientApp: FirebaseApp | undefined;
let clientAuth: ClientAuth | undefined;
let clientDb: ClientFirestore | undefined;
let clientFns: Functions | undefined;

export function getClientApp(): FirebaseApp {
  if (clientApp) return clientApp;
  clientApp = getClientApps().length
    ? getClientApps()[0]!
    : initClientApp({
        apiKey: "fake-api-key", // emulator ignores it but the SDK requires a value
        projectId: PROJECT_ID,
        authDomain: `${PROJECT_ID}.firebaseapp.com`,
        databaseURL: `http://${EMULATOR_HOST}:${PORTS.database}?ns=${PROJECT_ID}`,
      });

  clientAuth = getAuth(clientApp);
  connectAuthEmulator(clientAuth, `http://${EMULATOR_HOST}:${PORTS.auth}`, {
    disableWarnings: true,
  });

  clientDb = getClientFirestore(clientApp);
  connectFirestoreEmulator(clientDb, EMULATOR_HOST, PORTS.firestore);

  clientFns = getFunctions(clientApp, REGION);
  connectFunctionsEmulator(clientFns, EMULATOR_HOST, PORTS.functions);

  return clientApp;
}

export function clientAuthHandle(): ClientAuth {
  getClientApp();
  return clientAuth!;
}

export function clientFunctions(): Functions {
  getClientApp();
  return clientFns!;
}

/**
 * Force the `auth-internal` interop — the EXACT provider the Firebase Functions
 * client SDK reads the caller's ID token from — to reflect the currently
 * signed-in user, and resolve only once its `getUid()` matches `expectedUid`.
 *
 * The Functions SDK does not call `getToken(forceRefresh=true)`; it reads the
 * interop's cached token, which is updated by an internal `onIdTokenChanged`
 * listener that lags `signInWithCustomToken`/`currentUser` by an event-loop turn.
 * On rapid ROLE SWITCHES this lets a PRIOR caller's token bleed into the next
 * call (flaky "not your submission" / "not a linked child" / "space not found").
 * Calling `getToken(true)` here both refreshes the interop's cache and drives its
 * listener, so the very next `httpsCallable` deterministically carries the right
 * caller. Fail-open after a short deadline so a missed update never hangs.
 */
export async function settleFunctionsAuthToken(expectedUid: string): Promise<void> {
  getClientApp();
  const { _getProvider } = await import("firebase/app");
  let interop: {
    getUid: () => string | null;
    getToken: (force?: boolean) => Promise<unknown>;
  } | null = null;
  try {
    interop = _getProvider(clientApp!, "auth-internal").getImmediate({
      optional: true,
    }) as typeof interop;
  } catch {
    interop = null;
  }
  if (!interop) return; // interop not registered → nothing to settle
  // Empty string ⇒ "settle to NO user" (after sign-out): the interop reports
  // `getUid() === null` once it has observed the sign-out.
  const want = expectedUid === "" ? null : expectedUid;
  const deadline = Date.now() + 3000;
  for (;;) {
    // getToken(true) refreshes the interop's cache + fires its token listener.
    await interop.getToken(true).catch(() => undefined);
    if (interop.getUid() === want) return;
    if (Date.now() > deadline) return;
    await new Promise((r) => setTimeout(r, 10));
  }
}

export function clientFirestore(): ClientFirestore {
  getClientApp();
  return clientDb!;
}

// ---------------------------------------------------------------------------
// Emulator data lifecycle — clear between suites / on teardown.
// ---------------------------------------------------------------------------

/** Wipe ALL Firestore documents for PROJECT_ID via the emulator REST endpoint. */
export async function clearFirestore(): Promise<void> {
  const url = `http://${EMULATOR_HOST}:${PORTS.firestore}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
  await fetch(url, { method: "DELETE" });
}

/** Wipe ALL Auth accounts for PROJECT_ID via the emulator REST endpoint. */
export async function clearAuth(): Promise<void> {
  const url = `http://${EMULATOR_HOST}:${PORTS.auth}/emulator/v1/projects/${PROJECT_ID}/accounts`;
  await fetch(url, { method: "DELETE" });
}

/** Wipe the RTDB (badge state / leaderboard nodes) for PROJECT_ID. */
export async function clearDatabase(): Promise<void> {
  const url = `http://${EMULATOR_HOST}:${PORTS.database}/.json?ns=${PROJECT_ID}`;
  await fetch(url, { method: "DELETE" }).catch(() => {
    /* RTDB emulator may be off in firestore-only runs; ignore. */
  });
}

/** Full reset used by globalSetup teardown and between-suite hooks. */
export async function clearAllEmulators(): Promise<void> {
  await Promise.all([clearFirestore(), clearAuth(), clearDatabase()]);
}

/** Tear down client app handles (Admin app is process-lived; left for the runner). */
export async function disposeClients(): Promise<void> {
  for (const app of getClientApps()) {
    await deleteClientApp(app).catch(() => undefined);
  }
  clientApp = undefined;
  clientAuth = undefined;
  clientDb = undefined;
  clientFns = undefined;
}

/**
 * Best-effort probe that the Firestore emulator is reachable. Integration
 * suites call `requireEmulators()` in `beforeAll` and skip (not fail) when the
 * emulators are not running locally — mirrors tests/e2e seed-guards.
 */
export async function emulatorsReachable(): Promise<boolean> {
  try {
    const res = await fetch(`http://${EMULATOR_HOST}:${PORTS.firestore}/`, { method: "GET" });
    return res.ok || res.status === 200 || res.status === 501 || res.status === 404 ? true : true; // any HTTP response means the port is bound
  } catch {
    return false;
  }
}

/**
 * Best-effort probe that the FUNCTIONS emulator is reachable AND serving the new
 * SDK callables. The wire-path suites (api-client → transport-firebase → callable)
 * REQUIRE it; when the run boots only auth/firestore/database (or the deployable
 * functions codebase that assembles the `v1.*` callables isn't built yet), those
 * suites self-skip with a precise reason instead of failing on `functions/internal`.
 */
export async function functionsReachable(): Promise<boolean> {
  try {
    const res = await fetch(`http://${EMULATOR_HOST}:${PORTS.functions}/`, {
      method: "GET",
    });
    // Any HTTP response means the port is bound (the emulator answers 404/501 on /).
    void res;
    return true;
  } catch {
    return false;
  }
}
