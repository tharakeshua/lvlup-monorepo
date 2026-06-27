/**
 * Idempotency-key generation + envelope attachment (api-client-core.md §3.5 /
 * §6.5; SDK-LAYERS-PLAN §3.1).
 *
 * A UUID v7 (time-ordered) key is generated ONCE per logical call for
 * `def.idempotent` callables, stays STABLE across `withRetry` re-invocations and
 * (later) offline replay — it is the join point for both. The key rides a thin
 * `__idempotencyKey` ENVELOPE field OUTSIDE the `.strict()` request schema, so no
 * request schema ever has to declare it. The server reads it pre-validation and
 * dedupes on `(uid, __idempotencyKey)`.
 */
import { v7 as uuidv7 } from "uuid";
import type { CallableDef, CallableName, ReqOf } from "@levelup/api-contract";

/** The reserved envelope key the key rides on (never a schema-declared body field). */
export const IDEMPOTENCY_ENVELOPE_KEY = "__idempotencyKey" as const;

/** Factory signature for overriding key generation (tests, deterministic replay). */
export type IdempotencyKeyFactory = (name: CallableName) => string;

/**
 * Default factory — UUID v7 (version nibble = 7, time-ordered so keys sort by
 * creation time). One fresh key per logical call.
 */
export const generateIdempotencyKey: IdempotencyKeyFactory = (_name: CallableName): string =>
  uuidv7();

/**
 * Attach the key to the wire ENVELOPE for `def.idempotent` callables. Returns a
 * shallow clone of the request body with the reserved `__idempotencyKey` field
 * added — leaving the schema-validated body fields untouched.
 */
export function attachIdempotencyKey<N extends CallableName>(
  _name: N,
  req: ReqOf<N>,
  _def: CallableDef<unknown, unknown>,
  key: string
): ReqOf<N> & { [IDEMPOTENCY_ENVELOPE_KEY]?: string } {
  return {
    ...(req as object),
    [IDEMPOTENCY_ENVELOPE_KEY]: key,
  } as ReqOf<N> & { [IDEMPOTENCY_ENVELOPE_KEY]?: string };
}
