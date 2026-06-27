/**
 * Exponential-backoff retry for transient provider failures
 * (server-shared.md §4.1 `reliability/retry.ts`). Only retries errors the caller
 * classifies as retryable; deterministic jitter keeps tests reproducible when an
 * injected RNG is supplied.
 */

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Returns true if the error should be retried. */
  isRetryable: (err: unknown) => boolean;
  /** Sleep impl (injectable for tests). */
  sleep?: (ms: number) => Promise<void>;
  /** [0,1) jitter source (injectable for tests). */
  rng?: () => number;
}

const defaultSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 250;
  const maxDelayMs = opts.maxDelayMs ?? 4000;
  const sleep = opts.sleep ?? defaultSleep;
  const rng = opts.rng ?? Math.random;

  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt >= maxAttempts || !opts.isRetryable(err)) break;
      const exp = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      const jitter = exp * 0.25 * rng();
      await sleep(exp + jitter);
    }
  }
  throw lastErr;
}
