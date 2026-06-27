/**
 * `patchDetail` recipe (query-infra.md §6.2) — practice-progress attempt patch,
 * notification mark-read, announcement mark-read.
 *
 * Patches a single detail/list key before the request, snapshots for rollback,
 * and optionally reconciles from the authoritative response. The
 * recordItemAttempt use (A11/CD13) supplies a `reconcile` that overwrites the
 * cache with the SERVER `{progress}` via `setQueryData` (NOT invalidate-refetch),
 * so the server's recomputed best-score wins over the optimistic in-flight patch.
 */
import { restore, snapshot, type Snapshot } from "../optimistic.js";
import type { OptimisticClient, OptimisticConfig } from "../types.js";

export interface PatchDetailOptions<TVars, TData, T> {
  /** Reconcile from the authoritative response (e.g. write `data.progress`). */
  reconcile?: (qc: OptimisticClient, data: TData, vars: TVars) => void;
}

/**
 * Build a `patchDetail` optimistic config.
 *
 * @param detailKey the exact `*.detail(id)`/`*.list(f)` key to patch
 * @param patch     pure `(prev, vars) => next` cache updater
 * @param options   optional `reconcile` from the authoritative response
 */
export function patchDetail<TVars = unknown, TData = unknown, T = unknown>(
  detailKey: readonly unknown[],
  patch: (prev: T, vars: TVars) => T,
  options?: PatchDetailOptions<TVars, TData, T>
): OptimisticConfig<TVars, TData, Snapshot<T>> {
  return {
    apply: (qc, vars) => {
      const snap = snapshot<T>(qc, detailKey);
      qc.setQueryData<T>(detailKey, (prev) => patch(prev as T, vars));
      return snap;
    },
    rollback: (qc, snap) => restore<T>(qc, snap),
    reconcile: options?.reconcile
      ? (qc, data, vars) => options.reconcile!(qc, data, vars)
      : undefined,
  };
}
