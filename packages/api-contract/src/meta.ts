/**
 * API version + name helpers + rate limits (SDK-LAYERS-PLAN §3.2/§9 /
 * api-contract-core.md §8/§9).
 *
 * `API_VERSION` is the canonical constant a future `v2` dual-run keys off.
 * `RATE_LIMITS` is co-located with the registry's `rateTier` so the limiter,
 * the def field, and the contract tests share one table.
 */
import type { RateTier } from "./callable-def";

export const API_VERSION = "v1" as const;
export type ApiVersion = typeof API_VERSION;

/** Build a versioned name; keeps the `v1.<module>.<op>` convention in one place. */
export const callableName = (module: string, op: string): string =>
  `${API_VERSION}.${module}.${op}`;

/** Split a name into parts for the integrity test (§10.2). Null if malformed. */
export function parseCallableName(
  name: string
): { version: string; module: string; op: string } | null {
  const m = /^(v\d+)\.([a-z]+)\.([A-Za-z]+)$/.exec(name);
  return m ? { version: m[1]!, module: m[2]!, op: m[3]! } : null;
}

export interface RateLimitConfig {
  maxPerMinute: number;
  actionType: RateTier;
}

export const RATE_LIMITS: Record<RateTier, RateLimitConfig> = {
  write: { maxPerMinute: 30, actionType: "write" },
  read: { maxPerMinute: 60, actionType: "read" },
  ai: { maxPerMinute: 10, actionType: "ai" },
  auth: { maxPerMinute: 10, actionType: "auth" },
  report: { maxPerMinute: 5, actionType: "report" },
};
