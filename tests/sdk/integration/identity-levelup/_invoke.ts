/**
 * Shared wire-invocation helper for the `identity-levelup` integration suite.
 *
 * Every test in this folder exercises the REAL trust boundary end-to-end:
 *
 *   api-client → @levelup/transport-firebase → Functions emulator
 *     → makeCallable (functions-shared) → buildAuthContext (claims → ctx)
 *       → @levelup/services fn(input, ctx) → @levelup/repository-admin (Admin SDK)
 *         → Firestore/Auth emulator
 *
 * The caller carries a GENUINE signed-in ID token minted by the Auth emulator
 * (via `signInAsDemoUser`), so `tenantId`/role/permissions are derived from
 * decoded claims exactly as in prod (REVIEW §6.1/D2). No request body ever
 * carries `tenantId` — the entire point of these tests.
 *
 * Two invocation styles, both against the SAME deployed callable:
 *   • `invoke(name, data, role)` — happy-path; throws the raw callable error.
 *   • `invokeExpectError(name, data, role)` — captures `{code,message}` from the
 *     normalized `HttpsError(ApiErrorDetails)` the server `fail()`/`mapError`
 *     produces (server-shared §2.5), so trust-boundary REJECTIONS are assertable.
 *
 * Self-skip surface: `skipReason()` returns a non-null string when the emulators
 * or the seed aren't available locally; callers gate their `describe` with
 * `describe.skipIf(...)` so the file stays green in the parallel-build window and
 * goes live under `firebase emulators:exec` in the validation phase.
 */
import { requireFunctions } from "../../harness/per-test-setup";
import { signInAsDemoUser, signOutClient } from "../../harness/auth-context";
import type { Role } from "../../harness/auth-context";
import { clientFunctions } from "../../harness/emulator";
import { localSeedId, CONTRACT_TENANT_KEY } from "../../harness/fixtures-ids";
// The wire path resolves a callable by its Firebase DEPLOYED id (dashed), which the
// transport translates from the dotted contract name. The deployable v1.* codebase
// exports `v1.<module>.<op>` (nested) → Firebase registers `v1-<module>-<op>` (a
// function id may not contain dots). The harness invokes by the SAME convention as
// `@levelup/transport-firebase` (single source of truth), so the emulator resolves
// the function instead of returning `functions/not-found`.
import { toDeployedCallableId } from "@levelup/transport-firebase";
import type { CallableName } from "@levelup/api-contract";

export type WireRole = Role | "public";

/** Resolve the single contract-tenant id every assertion here references. */
export const CONTRACT_TENANT_ID = localSeedId("tenant", CONTRACT_TENANT_KEY);

/** Skip-reason resolver (emulator/seed/functions availability) — null when runnable. */
export function skipReason(): string | null {
  return requireFunctions();
}

/** Normalized error captured off a rejected callable. */
export interface CapturedError {
  /** `ApiErrorDetails.code` (AppErrorCode) lifted from `error.details`. */
  code: string | undefined;
  /** Firebase HttpsError `code` (e.g. 'permission-denied') as a fallback. */
  httpsCode: string | undefined;
  message: string;
  raw: unknown;
}

/** Sign the client in as `role` (no-op for the synthetic 'public' caller). */
async function authAs(role: WireRole): Promise<{ uid: string }> {
  if (role === "public") {
    await signOutClient();
    return { uid: "<public>" };
  }
  const { uid } = await signInAsDemoUser(role);
  return { uid };
}

/**
 * Invoke a deployed callable by registry name through the client SDK, carrying
 * the signed-in token. Returns the live `res.data`. Throws on callable error.
 */
export async function invoke<T = unknown>(name: string, data: unknown, role: WireRole): Promise<T> {
  const { httpsCallable } = await import("firebase/functions");
  await authAs(role);
  const callable = httpsCallable(clientFunctions(), toDeployedCallableId(name as CallableName));
  const res = await callable(data);
  return res.data as T;
}

/**
 * Invoke expecting the trust boundary to REJECT. Captures the normalized error
 * shape (the server maps every domain error through `fail()`→HttpsError with an
 * `ApiErrorDetails{code}` payload). If the call unexpectedly SUCCEEDS, returns
 * `{ ok: true, data }` so the test can fail with a clear "boundary did not
 * reject" message rather than a confusing throw.
 */
export async function invokeExpectError(
  name: string,
  data: unknown,
  role: WireRole
): Promise<{ ok: false; error: CapturedError } | { ok: true; data: unknown }> {
  const { httpsCallable } = await import("firebase/functions");
  await authAs(role);
  const callable = httpsCallable(clientFunctions(), toDeployedCallableId(name as CallableName));
  try {
    const res = await callable(data);
    return { ok: true, data: res.data };
  } catch (e) {
    const err = e as {
      code?: string;
      message?: string;
      details?: { code?: string; message?: string };
    };
    return {
      ok: false,
      error: {
        code: err.details?.code,
        httpsCode: err.code,
        message: err.message ?? String(e),
        raw: e,
      },
    };
  }
}

/**
 * True when a captured error denotes a trust-boundary denial — accepts either the
 * SDK `AppErrorCode` (`PERMISSION_DENIED`/`UNAUTHENTICATED`) or the raw Firebase
 * https code (`permission-denied`/`unauthenticated`), since the precise surface
 * depends on which layer rejected first.
 */
export function isDenied(err: CapturedError): boolean {
  return (
    err.code === "PERMISSION_DENIED" ||
    err.code === "UNAUTHENTICATED" ||
    err.httpsCode === "permission-denied" ||
    err.httpsCode === "unauthenticated"
  );
}

/** True when a captured error denotes an illegal state-machine transition. */
export function isInvalidTransition(err: CapturedError): boolean {
  return (
    err.code === "INVALID_TRANSITION" ||
    err.httpsCode === "failed-precondition" ||
    /transition/i.test(err.message)
  );
}

/** Deep scan a live response for any answer-key/guidance/cost field name (⚷ leak). */
const SENSITIVE_KEY_RE =
  /\b(correctAnswer|acceptableAnswers|evaluationGuidance|modelAnswer|evaluatorGuidance|promptGuidance|systemPrompt|costUsd|cost|tokenUsage|geminiApiKey|geminiKey)\b/;

export function leaksSensitiveKey(res: unknown): string | null {
  const json = JSON.stringify(res ?? null);
  const m = SENSITIVE_KEY_RE.exec(json);
  return m ? m[1] : null;
}
