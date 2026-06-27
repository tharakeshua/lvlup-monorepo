/**
 * `decrementBadge` / `incrementCounter` recipes (query-infra.md §6.2,
 * SEC-08 / CONV-4).
 *
 * Optimistic counter patches may touch ONLY the counters in the closed
 * `OPTIMISTIC_COUNTER_ALLOWLIST` (`unreadCount`, `unseenCount`) — never a
 * progress/score/points/rank/purchase counter. The recipe asserts the field is
 * allow-listed at construction (defense-in-depth with the contract test).
 *
 * `decrementBadge` decrements by one and CLAMPS at 0 (never negative); rollback
 * restores the prior count.
 */
import { OPTIMISTIC_COUNTER_ALLOWLIST } from "../authority.js";
import { restore, snapshot, type Snapshot } from "../optimistic.js";
import type { OptimisticConfig } from "../types.js";

type CounterDoc = Record<string, number> & { [k: string]: number };

function assertCounterAllowed(field: string): void {
  if (!OPTIMISTIC_COUNTER_ALLOWLIST.includes(field)) {
    throw new Error(
      `[query] counter "${field}" is not on OPTIMISTIC_COUNTER_ALLOWLIST ` +
        `(${OPTIMISTIC_COUNTER_ALLOWLIST.join(", ")}). Authority counters must never ` +
        `be optimistically patched (SEC-08 / CONV-4).`
    );
  }
}

/** Build a recipe that adjusts a read-state counter by `delta` (clamped ≥ 0). */
export function incrementCounter<TVars = unknown, TData = unknown>(
  counterKey: readonly unknown[],
  delta: number,
  field = "unreadCount"
): OptimisticConfig<TVars, TData, Snapshot<CounterDoc>> {
  assertCounterAllowed(field);
  return {
    apply: (qc) => {
      const snap = snapshot<CounterDoc>(qc, counterKey);
      qc.setQueryData<CounterDoc>(counterKey, (prev) => {
        const current = (prev?.[field] ?? 0) as number;
        const next = Math.max(0, current + delta);
        return { ...(prev ?? ({} as CounterDoc)), [field]: next };
      });
      return snap;
    },
    rollback: (qc, snap) => restore<CounterDoc>(qc, snap),
  };
}

/** Decrement a read-state badge counter by one (clamped at 0). */
export function decrementBadge<TVars = unknown, TData = unknown>(
  badgeKey: readonly unknown[],
  field = "unreadCount"
): OptimisticConfig<TVars, TData, Snapshot<CounterDoc>> {
  return incrementCounter<TVars, TData>(badgeKey, -1, field);
}
