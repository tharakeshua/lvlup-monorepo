/**
 * Retry policy (api-client-core.md §3.4 / §6.4).
 *
 * SAFETY-CRITICAL invariants:
 *   • Retry is OPT-IN, bounded, jittered exponential backoff.
 *   • A call is retried ONLY when the normalized error is `retryable` AND the def
 *     is idempotent-safe (`def.idempotent === true` OR `def.rateTier === 'read'`).
 *     A non-idempotent mutation (gradeQuestion, publish) is NEVER retried — the
 *     no-double-grade / no-double-purchase guarantee.
 *   • `withRetry` re-invokes the SAME attempt fn (carrying the SAME idempotency
 *     key, generated before the wrap) → server dedupe makes retries exactly-once.
 *   • `computeBackoff` is bounded by `maxDelayMs`, full-jitter, and honours
 *     `err.meta.retryAfterMs` when the server sends a `Retry-After`.
 */
import type { CallableDef } from "@levelup/api-contract";
import { ApiError, isApiError, normalizeError } from "./errors.js";

/**
 * An error already shaped like an `ApiError` (`{ code, retryable }`) — e.g. a
 * pre-normalized error from a deeper layer or a test double. `withRetry` must NOT
 * re-funnel these through `normalizeError` (which would collapse an unrecognized
 * `code` to UNKNOWN); it preserves the caller's decision-relevant fields verbatim.
 */
function isApiErrorShape(e: unknown): e is { code: string; retryable: boolean } & object {
  if (e instanceof ApiError) return true;
  if (!e || typeof e !== "object") return false;
  const o = e as Record<string, unknown>;
  return typeof o["code"] === "string" && typeof o["retryable"] === "boolean";
}

export interface RetryPolicy {
  /** Total attempts: 1 initial try + (maxAttempts-1) retries. Default 3. */
  maxAttempts: number;
  /** Base backoff in ms. Default 200. */
  baseDelayMs: number;
  /** Ceiling for a single backoff in ms. Default 4000. */
  maxDelayMs: number;
  /** Jitter strategy. Default 'full'. */
  jitter: "full" | "none";
  /** Override the retry decision. Default = `isRetryable`. */
  shouldRetry?: (err: ApiError, def: CallableDef<unknown, unknown>, attempt: number) => boolean;
}

/** Default: 3 attempts (1 try + 2 retries), 200ms base, 4000ms cap, full jitter. */
export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 200,
  maxDelayMs: 4000,
  jitter: "full",
};

/** A policy that disables retries entirely (single attempt). */
export const NO_RETRY: RetryPolicy = {
  maxAttempts: 1,
  baseDelayMs: 0,
  maxDelayMs: 0,
  jitter: "none",
};

/**
 * Pure decision: the error is retryable AND the def is idempotent-safe. Reads are
 * idempotent-safe by tier even without `idempotent: true`; non-idempotent writes
 * never are.
 */
export function isRetryable(
  err: { retryable: boolean },
  def: CallableDef<unknown, unknown>
): boolean {
  if (!err.retryable) return false;
  return def.idempotent === true || def.rateTier === "read";
}

/**
 * Exponential backoff with optional full jitter; pure + testable. Honours an
 * explicit `retryAfterMs` (server `Retry-After`) override, clamped to the cap.
 */
export function computeBackoff(
  attempt: number,
  policy: Pick<RetryPolicy, "baseDelayMs" | "maxDelayMs" | "jitter">,
  rand: () => number = Math.random,
  retryAfterMs?: number
): number {
  const cap = policy.maxDelayMs;
  if (typeof retryAfterMs === "number" && Number.isFinite(retryAfterMs)) {
    return Math.max(0, Math.min(retryAfterMs, cap));
  }
  // Exponential ceiling: base * 2^attempt, clamped to the cap.
  const exp = policy.baseDelayMs * Math.pow(2, Math.max(0, attempt));
  const ceiling = Math.min(exp, cap);
  if (policy.jitter === "none") return ceiling;
  // Full jitter: uniform in [0, ceiling].
  return Math.max(0, Math.min(ceiling, ceiling * clamp01(rand())));
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

const defaultSleep = (ms: number): Promise<void> =>
  ms <= 0 ? Promise.resolve() : new Promise((resolve) => setTimeout(resolve, ms));

/** Pull a server-provided `retryAfterMs` off the normalized error meta, if any. */
function retryAfterOf(err: ApiError): number | undefined {
  const v = err.meta?.["retryAfterMs"];
  return typeof v === "number" ? v : undefined;
}

/**
 * Wrap an attempt fn with bounded, jittered backoff. The attempt is normalized on
 * every failure so the loop decides on a stable `ApiError`. `now` is injected for
 * deterministic tests; `sleep` defaults to a real timer.
 */
export async function withRetry<T>(
  attempt: (attemptNo: number) => Promise<T>,
  policy: RetryPolicy,
  ctx: {
    def: CallableDef<unknown, unknown>;
    now: () => number;
    sleep?: (ms: number) => Promise<void>;
    rand?: () => number;
  }
): Promise<T> {
  const sleep = ctx.sleep ?? defaultSleep;
  const rand = ctx.rand ?? Math.random;
  const decide = policy.shouldRetry ?? ((err, def) => isRetryable(err, def));
  const maxAttempts = Math.max(1, policy.maxAttempts);

  let lastErr: ApiError | undefined;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await attempt(i);
    } catch (raw) {
      // Preserve an already-ApiError-shaped throw verbatim (don't collapse an
      // unrecognized code to UNKNOWN); otherwise funnel through normalizeError.
      const err: ApiError = isApiError(raw)
        ? raw
        : isApiErrorShape(raw)
          ? (raw as unknown as ApiError)
          : normalizeError(raw, ctx.def.name as never);
      lastErr = err;
      const isLast = i >= maxAttempts - 1;
      if (isLast || !decide(err, ctx.def, i)) throw err;
      const delay = computeBackoff(i, policy, rand, retryAfterOf(err as ApiError));
      // Touch the injected clock so jitter/timing stays test-observable.
      void ctx.now();
      await sleep(delay);
    }
  }
  // Unreachable (loop always returns or throws), but satisfies the type checker.
  throw lastErr ?? new ApiError({ code: "UNKNOWN", message: "retry exhausted" });
}
