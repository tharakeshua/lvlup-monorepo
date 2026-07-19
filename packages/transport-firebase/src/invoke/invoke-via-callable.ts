/**
 * `invokeViaCallable` (transport-realtime.md §2.2 invoke/invoke-via-callable.ts).
 *
 * The thin callable carrier:
 *   httpsCallable(functions, deployedId(name))(data).then(r => r.data as ResOf<N>)
 *
 * Invariants this layer honors:
 *   • Firebase forwards the caller's ID token automatically — NO manual auth header.
 *   • NO `tenantId` added. NO request reshaping. The server derives tenant from claims.
 *   • NO Zod here — api-client validates the request pre-flight and the response in
 *     dev (single validation owner; this layer stays thin).
 *   • On `FunctionsError`: rethrow UNCHANGED so api-client's `normalizeError` owns the
 *     `HttpsError → ApiError` mapping. The typed `details` envelope survives intact.
 *
 * ── Dotted contract name → dashed deployed id (the wire-path reconciliation) ──
 * The api-contract registry keys callables by their DOTTED contract name (e.g.
 * `v1.levelup.saveSpace`). Firebase derives a function's deployed/emulator id from
 * its nested export path joined with DASHES and forbids dots in a function id (the
 * sdk-v1 codebase exports `v1.<module>.<op>` → registered id `v1-<module>-<op>`).
 * `httpsCallable` resolves a function by its DEPLOYED id, so this carrier translates
 * dots→dashes before the call. This is the single mapping site; the contract name
 * stays dotted everywhere else (registry key, api-client, typing).
 */
import { httpsCallable, type Functions } from "firebase/functions";
import { CALLABLES, type CallableName, type ReqOf, type ResOf } from "@levelup/api-contract";

/**
 * firebase-js-sdk's `httpsCallable` default client deadline is 70s — it aborts the
 * request client-side even though the Cloud Function keeps running. AI-tier
 * callables (the live two-pass extraction, grading kicks) can legitimately run to
 * the server's 540s ceiling, so we widen the client deadline to match for those.
 * Contract-driven (`rateTier === "ai"`), never per-callable.
 */
const AI_CLIENT_TIMEOUT_MS = 540_000;

/**
 * Map a dotted contract name to the Firebase-deployed function id.
 * `v1.levelup.saveSpace` → `v1-levelup-saveSpace`. Firebase derives the id from
 * the nested export tree joined with dashes (dots are illegal in a function id).
 */
export function toDeployedCallableId(name: CallableName): string {
  return name.replace(/\./g, "-");
}

export async function invokeViaCallable<N extends CallableName>(
  functions: Functions,
  name: N,
  data: ReqOf<N>
): Promise<ResOf<N>> {
  // httpsCallable is typed <Request, Response>; the registry's ReqOf/ResOf are the
  // single source of truth, so we bind the callable to those exact shapes. The
  // resolver target is the DEPLOYED id (dashed), not the dotted contract name.
  const isAiTier = (CALLABLES[name] as { rateTier?: string } | undefined)?.rateTier === "ai";
  const callable = httpsCallable<ReqOf<N>, ResOf<N>>(
    functions,
    toDeployedCallableId(name),
    isAiTier ? { timeout: AI_CLIENT_TIMEOUT_MS } : undefined
  );
  const result = await callable(data);
  return result.data;
}
