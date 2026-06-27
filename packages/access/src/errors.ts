/**
 * Transport-neutral access errors. `@levelup/access` MUST NOT import
 * `firebase-functions`; it throws a plain typed `AccessError` carrying an
 * `AppErrorCode`. `@levelup/functions-shared` (or the test harness) maps it to
 * `HttpsError` via `APP_ERROR_TO_HTTPS` (server-shared.md §1.6).
 */
import type { AppErrorCode, JsonValue } from "@levelup/api-contract";

export class AccessError extends Error {
  readonly code: AppErrorCode;
  readonly meta?: Record<string, JsonValue>;
  constructor(code: AppErrorCode, message: string, meta?: Record<string, JsonValue>) {
    super(message);
    this.name = "AccessError";
    this.code = code;
    this.meta = meta;
    // Restore prototype chain for `instanceof` across transpilation targets.
    Object.setPrototypeOf(this, AccessError.prototype);
  }
}

/** Type guard used by the error mapper in `@levelup/functions-shared`. */
export function isAccessError(e: unknown): e is AccessError {
  return (
    e instanceof AccessError || (e instanceof Error && e.name === "AccessError" && "code" in e)
  );
}

/** Throw PERMISSION_DENIED. */
export function denied(message: string, meta?: Record<string, JsonValue>): never {
  throw new AccessError("PERMISSION_DENIED", message, meta);
}

/** Throw INVALID_TRANSITION. */
export function invalidTransition(message: string, meta?: Record<string, JsonValue>): never {
  throw new AccessError("INVALID_TRANSITION", message, meta);
}

/** Throw UNAUTHENTICATED (no/invalid token reaching authorize). */
export function unauthenticated(message: string, meta?: Record<string, JsonValue>): never {
  throw new AccessError("UNAUTHENTICATED", message, meta);
}
