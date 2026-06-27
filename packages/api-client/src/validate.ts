/**
 * Request / response validation helpers (api-client-core.md §3.8 / §6.2).
 *
 *  - `validateRequest` runs the registry `.strict()` `requestSchema.parse` in
 *    EVERY env. This is the correctness gate that strips/REJECTS stray fields —
 *    including any smuggled body `tenantId` (D2). A failure is funneled through
 *    `normalizeError` → `VALIDATION_ERROR`, so the transport is never reached.
 *  - `validateResponse` parses the `responseSchema` ONLY when `enabled` (DEV).
 *    It is a pure passthrough in prod (no parse cost); a drift in dev surfaces as
 *    `VALIDATION_ERROR`.
 */
import { getCallable } from "@levelup/api-contract";
import type { CallableName, ReqOf, ResOf } from "@levelup/api-contract";
import { normalizeError } from "./errors.js";

/**
 * Parse-or-throw-`ApiError`. ALWAYS runs (every env). `.strict()` drops stray
 * fields incl. any tenantId. The thrown error is already a normalized `ApiError`.
 */
export function validateRequest<N extends CallableName>(name: N, data: unknown): ReqOf<N> {
  const def = getCallable(name);
  try {
    return def.requestSchema.parse(data) as ReqOf<N>;
  } catch (e) {
    throw normalizeError(e, name);
  }
}

/**
 * DEV-only response parse. When `enabled` is false the response is returned
 * untouched (prod path, no cost). When enabled, a drift throws a normalized
 * `VALIDATION_ERROR`.
 */
export function validateResponse<N extends CallableName>(
  name: N,
  res: unknown,
  enabled: boolean
): ResOf<N> {
  if (!enabled) return res as ResOf<N>;
  const def = getCallable(name);
  try {
    return def.responseSchema.parse(res) as ResOf<N>;
  } catch (e) {
    throw normalizeError(e, name);
  }
}
