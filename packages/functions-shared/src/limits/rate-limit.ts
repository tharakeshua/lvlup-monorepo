/**
 * Rate limiting keyed by `(subject, rateTier)` (server-shared.md §2.6).
 * Replaces the three duplicated per-codebase `rate-limit.ts` copies with one.
 * Counts go through `ctx.repos.rateLimits` — NOT direct Firestore.
 */
import type { RateTier } from "@levelup/api-contract";
import type { AuthContext } from "../context/auth-context.js";
import { fail } from "../request/fail.js";

/** Per-minute allowances per tier. */
export const RATE_TIER_LIMITS: Record<RateTier, { perMinute: number }> = {
  read: { perMinute: 600 },
  write: { perMinute: 120 },
  ai: { perMinute: 30 },
  auth: { perMinute: 20 },
  report: { perMinute: 10 },
};

/** 1-minute fixed window key (UTC). */
function windowKey(now: () => string): string {
  const iso = now();
  // YYYY-MM-DDTHH:MM — minute granularity.
  return iso.slice(0, 16);
}

/** System actors (`<system>`) and anonymous public callers are not rate-limited here. */
function isExempt(ctx: AuthContext): boolean {
  return ctx.uid === "<system>";
}

export async function enforceRateLimit(ctx: AuthContext, tier: RateTier): Promise<void> {
  if (isExempt(ctx)) return;
  const limit = RATE_TIER_LIMITS[tier];
  const subject = `${String(ctx.tenantId ?? "none")}:${String(ctx.uid)}`;
  const count = await ctx.repos.rateLimits.hit(subject, tier, windowKey(ctx.now));
  if (count > limit.perMinute) {
    fail("RATE_LIMITED", `rate limit exceeded for tier ${tier}`, {
      retryable: true,
      meta: { tier, limit: limit.perMinute, retryAfterMs: 60_000 },
    });
  }
}
