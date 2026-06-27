/**
 * `appendToList` recipe (query-infra.md §6.2) — optimistic chat send.
 *
 * Appends a pending item (the user's message) to a list key before the request;
 * rolls back the whole list on error. Non-destructive: prior items keep order.
 */
import { restore, snapshot, type Snapshot } from "../optimistic.js";
import type { OptimisticConfig } from "../types.js";

export function appendToList<TVars = unknown, TData = unknown, T = unknown>(
  rootKey: readonly unknown[],
  make: (vars: TVars) => T
): OptimisticConfig<TVars, TData, Snapshot<T[]>> {
  return {
    apply: (qc, vars) => {
      const snap = snapshot<T[]>(qc, rootKey);
      qc.setQueryData<T[]>(rootKey, (prev) => [...(prev ?? []), make(vars)]);
      return snap;
    },
    rollback: (qc, snap) => restore<T[]>(qc, snap),
  };
}
