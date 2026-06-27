/**
 * Request-envelope helpers (api-client-core.md §3.1 / §7 "Envelope vs body").
 *
 * Two reserved, `__`-prefixed envelope fields ride OUTSIDE the `.strict()` request
 * schema so no schema must declare them:
 *   - `__idempotencyKey` — added by `idempotency.ts` for `def.idempotent` calls.
 *   - `__apiVersion`     — the contract `apiVersion` stamped on every call.
 * The transport unwraps them; the server reads them pre-validation. Keeping them
 * here (not in the body) is what lets every request schema stay `.strict()`-clean.
 */
import type { CallableDef, CallableName, ReqOf } from "@levelup/api-contract";

/** The reserved envelope key carrying the API version. */
export const API_VERSION_ENVELOPE_KEY = "__apiVersion" as const;

/**
 * Stamp the api version onto the wire envelope (clone, never mutate the caller's
 * body). Used for non-idempotent calls (idempotent calls layer the version under
 * `attachIdempotencyKey` via `withEnvelope`).
 */
export function withApiVersion<N extends CallableName>(
  req: ReqOf<N>,
  _def: CallableDef<unknown, unknown>,
  apiVersion: string
): ReqOf<N> & { [API_VERSION_ENVELOPE_KEY]?: string } {
  return {
    ...(req as object),
    [API_VERSION_ENVELOPE_KEY]: apiVersion,
  } as ReqOf<N> & { [API_VERSION_ENVELOPE_KEY]?: string };
}
