/**
 * Circuit breaker (server-shared.md §4.1 `reliability/fallback-handler.ts`).
 * Trips per (tenant,model) after consecutive failures so a dead/over-loaded
 * provider stops burning quota and latency. While OPEN the gateway short-circuits
 * with a retryable INTERNAL_ERROR; after a cooldown it goes HALF_OPEN and lets one
 * probe through. `classifyError` decides which provider errors count as transient.
 */

export type CircuitState = "closed" | "open" | "half_open";

export interface CircuitBreakerOptions {
  /** Consecutive failures before the circuit opens. */
  failureThreshold?: number;
  /** Cooldown before a half-open probe is allowed (ms). */
  cooldownMs?: number;
  /** Clock (injectable for tests). */
  now?: () => number;
}

interface CircuitEntry {
  state: CircuitState;
  failures: number;
  openedAt: number;
}

export interface CircuitBreaker {
  /** Throws-equivalent guard: returns false when the circuit is open (blocked). */
  isCircuitOpen(key: string): boolean;
  recordSuccess(key: string): void;
  recordFailure(key: string): void;
  /** Inspect state (tests/metrics). */
  stateOf(key: string): CircuitState;
}

/** Classify whether a provider error is transient (retry / count toward trip). */
export function classifyError(err: unknown): "transient" | "permanent" {
  const status = (err as { status?: number; code?: number | string })?.status;
  const code = (err as { status?: number; code?: number | string })?.code;
  const n =
    typeof status === "number"
      ? status
      : typeof code === "number"
        ? code
        : Number((err as { statusCode?: number })?.statusCode);
  if (n === 429 || n === 503 || n === 500 || n === 502 || n === 504) return "transient";
  const msg = String((err as { message?: string })?.message ?? "").toLowerCase();
  if (
    msg.includes("timeout") ||
    msg.includes("etimedout") ||
    msg.includes("econnreset") ||
    msg.includes("overloaded") ||
    msg.includes("unavailable") ||
    msg.includes("rate limit")
  ) {
    return "transient";
  }
  return "permanent";
}

export function createCircuitBreaker(opts: CircuitBreakerOptions = {}): CircuitBreaker {
  const failureThreshold = opts.failureThreshold ?? 5;
  const cooldownMs = opts.cooldownMs ?? 30_000;
  const now = opts.now ?? (() => Date.now());
  const circuits = new Map<string, CircuitEntry>();

  const entry = (key: string): CircuitEntry => {
    let e = circuits.get(key);
    if (!e) {
      e = { state: "closed", failures: 0, openedAt: 0 };
      circuits.set(key, e);
    }
    return e;
  };

  return {
    isCircuitOpen(key: string): boolean {
      const e = entry(key);
      if (e.state === "open" && now() - e.openedAt >= cooldownMs) {
        e.state = "half_open";
        return false; // allow a single probe
      }
      return e.state === "open";
    },
    recordSuccess(key: string): void {
      const e = entry(key);
      e.failures = 0;
      e.state = "closed";
      e.openedAt = 0;
    },
    recordFailure(key: string): void {
      const e = entry(key);
      e.failures += 1;
      if (e.state === "half_open" || e.failures >= failureThreshold) {
        e.state = "open";
        e.openedAt = now();
      }
    },
    stateOf(key: string): CircuitState {
      return entry(key).state;
    },
  };
}
