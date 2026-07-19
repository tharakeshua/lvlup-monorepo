/**
 * Firebase-free error constructors shared by the real Admin-SDK adapter and the
 * in-memory testing twin. Kept in its own module so the testing twin can import
 * `makeIdempotencyConflict` WITHOUT transitively pulling in `firebase-admin`
 * (which would break the service-unit-test purity the twin exists to provide).
 */
export const IDEMPOTENCY_CONFLICT = "IDEMPOTENCY_CONFLICT";

/**
 * The atomic-dedupe conflict (MERGE-IDEMPOTENCY). `retryable:true` — a transient
 * in-flight lease, so the client retries (wired into `DEFAULT_RETRYABLE` /
 * `mapError` downstream).
 */
export function makeIdempotencyConflict(): Error & { code: string; retryable: boolean } {
  const err = new Error(IDEMPOTENCY_CONFLICT) as Error & { code: string; retryable: boolean };
  err.code = IDEMPOTENCY_CONFLICT;
  err.retryable = true;
  return err;
}

/** Repository-domain failures are intentionally Firebase-free so the in-memory
 * twin produces the same observable error codes as the Admin SDK adapter. */
export function makeRepoError(
  code:
    | "CONFLICT"
    | "IDEMPOTENCY_CONFLICT"
    | "INVALID_TRANSITION"
    | "NOT_FOUND"
    | "PERMISSION_DENIED"
    | "PRECONDITION_FAILED"
    | "VALIDATION_ERROR",
  message: string,
  meta?: Record<string, unknown>
): Error & { code: string; meta?: Record<string, unknown> } {
  const error = new Error(message) as Error & { code: string; meta?: Record<string, unknown> };
  error.code = code;
  if (meta) error.meta = meta;
  return error;
}

export function makeLeaseConflict(message = "The current workflow lease is still active"): Error & {
  code: string;
} {
  return makeRepoError("IDEMPOTENCY_CONFLICT", message);
}
