/**
 * Shared helpers for the async-authority integration suite
 * (tests/sdk/integration/async-authority/*.test.ts).
 *
 * These suites assert the AUTHORITATIVE SERVER behavior + the trust boundary
 * end-to-end against the Firebase emulator + the seeded contract tenant
 * (SDK-LAYERS-PLAN.md §3.1, §4.4, §5.3, §6, server-shared.md §8). They exercise
 * the REAL service path through the Functions emulator carrying a genuine signed
 * ID token (so claims are server-decoded, never trusted from the body), and read
 * back authoritative state via the Admin SDK.
 *
 * Authoring constraints honored (parent brief):
 *   • files live ONLY under tests/sdk/integration/async-authority/ (+ this helper),
 *   • they reuse the existing harness (emulator connect, seed-load, claims mint),
 *   • they self-SKIP (not fail) when emulators/seed/contract are unavailable, so
 *     the file stays green in the parallel-build window; CI runs them under
 *     `firebase emulators:exec --project demo-levelup`.
 *
 * The later validation phase reconciles any callable/field names that drift from
 * the frozen plan; ALL such assumptions are localized to this helper + the
 * per-file constants so a single edit re-points the suite.
 */
import { httpsCallable, type Functions, type HttpsCallableResult } from "firebase/functions";
import { clientFunctions, adminDb, adminAuth, REGION } from "../../harness/emulator";
import { signInAsDemoUser, signOutClient, type Role } from "../../harness/auth-context";
// Resolve callables by their Firebase DEPLOYED id (dashed), translated from the
// dotted contract name — the same convention `@levelup/transport-firebase` uses
// (a function id may not contain dots; the v1.* codebase deploys `v1-<module>-<op>`).
import { toDeployedCallableId } from "@levelup/transport-firebase";
import type { CallableName } from "@levelup/api-contract";
import { requireFunctions } from "../../harness/per-test-setup";
import {
  CONTRACT_TENANT_KEY,
  DEMO_USER_KEYS,
  DEMO_CONTENT_KEYS,
  localSeedId,
} from "../../harness/fixtures-ids";

export { REGION };

/** The deterministic contract tenant every async-authority suite runs against. */
export const TENANT_ID = localSeedId("tenant", CONTRACT_TENANT_KEY);

/** Well-known seeded ids the suites reference by name (harness-local mirror of seedId). */
export const IDS = {
  tenant: TENANT_ID,
  space: localSeedId("space", DEMO_CONTENT_KEYS.space),
  storyPoint: localSeedId("sp", DEMO_CONTENT_KEYS.storyPoint),
  item: localSeedId("item", DEMO_CONTENT_KEYS.item),
  exam: localSeedId("exam", DEMO_CONTENT_KEYS.exam),
  examQuestion: localSeedId("examq", DEMO_CONTENT_KEYS.examQuestion),
  class: localSeedId("class", DEMO_CONTENT_KEYS.class),
  session: localSeedId("session", DEMO_CONTENT_KEYS.session),
} as const;

export function uidFor(role: Role): string {
  return localSeedId("uid", DEMO_USER_KEYS[role]);
}

/**
 * The single skip-gate every async-authority suite uses in `beforeAll`.
 * Returns a reason string when the suite cannot run locally, else null.
 */
export function asyncAuthoritySkip(): string | null {
  return requireFunctions();
}

/** True when the suite should self-skip (used in `describe.skipIf`). */
export function shouldSkip(): boolean {
  return Boolean(asyncAuthoritySkip());
}

/**
 * Invoke a callable through the REAL client→Functions-emulator path, signed in as
 * `role` (so the server decodes genuine claims). `role: 'public'` invokes without
 * a session. Returns the unwrapped `res.data`.
 */
export async function callAs<TReq = unknown, TRes = unknown>(
  name: string,
  data: TReq,
  role: Role | "public"
): Promise<TRes> {
  await signOutClient();
  if (role !== "public") await signInAsDemoUser(role);
  const fns: Functions = clientFunctions();
  const callable = httpsCallable<TReq, TRes>(fns, toDeployedCallableId(name as CallableName));
  const res: HttpsCallableResult<TRes> = await callable(data);
  return res.data;
}

/**
 * Invoke a callable and capture the thrown error code (Firebase `HttpsError` /
 * `FunctionsError`). Resolves to `{ ok: true, data }` on success or
 * `{ ok: false, code, message }` on failure — never throws. The `code` is the
 * `details.code` (our `AppErrorCode`) when present, else the firebase `code`.
 */
export async function tryCallAs<TReq = unknown, TRes = unknown>(
  name: string,
  data: TReq,
  role: Role | "public"
): Promise<{ ok: true; data: TRes } | { ok: false; code: string; message: string }> {
  try {
    const data2 = await callAs<TReq, TRes>(name, data, role);
    return { ok: true, data: data2 };
  } catch (e) {
    const err = e as { code?: string; message?: string; details?: { code?: string } };
    return {
      ok: false,
      code: err.details?.code ?? err.code ?? "UNKNOWN",
      message: err.message ?? String(e),
    };
  }
}

/** AppErrorCode / FunctionsError values that mean "the trust boundary blocked you". */
export const DENY_CODES = new Set([
  "PERMISSION_DENIED",
  "permission-denied",
  "UNAUTHENTICATED",
  "unauthenticated",
  "NOT_FOUND",
  "not-found",
  "FAILED_PRECONDITION",
  "failed-precondition",
  "PRECONDITION_FAILED",
  "INVALID_ARGUMENT",
  "invalid-argument",
  "VALIDATION_ERROR",
]);

export function isDeny(code: string): boolean {
  return DENY_CODES.has(code);
}

// ---------------------------------------------------------------------------
// Admin-SDK reads of AUTHORITATIVE state (what the server actually persisted).
// The client can never reach these paths; only the test harness (Admin) can,
// to assert the server wrote/withheld the ⚷ field.
// ---------------------------------------------------------------------------

/** A tenant-scoped Firestore doc ref via the Admin SDK. */
export function tdoc(...segments: string[]) {
  return adminDb().doc(["tenants", TENANT_ID, ...segments].join("/"));
}

/** A tenant-scoped Firestore collection ref via the Admin SDK. */
export function tcol(...segments: string[]) {
  return adminDb().collection(["tenants", TENANT_ID, ...segments].join("/"));
}

/** Read a tenant-scoped doc's data (or null). */
export async function readDoc(...segments: string[]): Promise<Record<string, unknown> | null> {
  const snap = await tdoc(...segments).get();
  return snap.exists ? (snap.data() as Record<string, unknown>) : null;
}

/** Decode a user's current custom claims from the Auth emulator (Admin SDK). */
export async function readClaims(uid: string): Promise<Record<string, unknown>> {
  const user = await adminAuth().getUser(uid);
  return (user.customClaims ?? {}) as Record<string, unknown>;
}

/** The `tokensValidAfterTime` (revocation fence) for a user, in ms (0 if never set). */
export async function tokensValidAfterMs(uid: string): Promise<number> {
  const user = await adminAuth().getUser(uid);
  const t = user.tokensValidAfterTime;
  return t ? new Date(t).getTime() : 0;
}

/** Sleep (used sparingly for at-least-once delivery settling — not for ordering). */
export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
