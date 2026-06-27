/**
 * `fail()` — the §6 error model entry point (server-shared.md §2.5).
 *
 * Services + adapters throw the transport-neutral `AccessError` (from
 * `@levelup/access`) carrying an `ApiErrorDetails`. ONLY `mapError` (map-error.ts)
 * produces an `HttpsError`, so the rest of the stack stays firebase-free.
 */
import { AccessError } from "@levelup/access";
import type { AppErrorCode, ApiErrorDetails, JsonValue } from "@levelup/api-contract";

/**
 * Throw a typed application error. `extra` may carry `validationErrors`,
 * `retryable`, and `meta`. Never returns (`: never`).
 */
export function fail(
  code: AppErrorCode,
  message: string,
  extra?: Partial<Omit<ApiErrorDetails, "code" | "message">>
): never {
  const meta = buildMeta(code, extra);
  throw new AccessError(code, message, meta);
}

function buildMeta(
  _code: AppErrorCode,
  extra?: Partial<Omit<ApiErrorDetails, "code" | "message">>
): Record<string, JsonValue> | undefined {
  if (!extra) return undefined;
  const meta: Record<string, JsonValue> = { ...(extra.meta ?? {}) };
  if (extra.validationErrors) {
    meta.validationErrors = extra.validationErrors as unknown as JsonValue;
  }
  if (extra.retryable !== undefined) {
    meta.retryable = extra.retryable;
  }
  return Object.keys(meta).length > 0 ? meta : undefined;
}

export { AccessError };
