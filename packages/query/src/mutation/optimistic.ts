/**
 * Optimistic helpers (query-infra.md §6). Snapshot/restore primitives the
 * allow-listed recipes share. All cache transitions go through `setQueryData`
 * (never a direct mutation) so React Query's structural sharing holds.
 */
import type { OptimisticClient } from "./types.js";

/** A recorded snapshot of one cache key (for rollback). */
export interface Snapshot<T = unknown> {
  readonly key: readonly unknown[];
  readonly prev: T | undefined;
}

/** Snapshot the current value at `key`. */
export function snapshot<T = unknown>(qc: OptimisticClient, key: readonly unknown[]): Snapshot<T> {
  return { key, prev: qc.getQueryData<T>(key) };
}

/** Restore a previously-taken snapshot. */
export function restore<T = unknown>(qc: OptimisticClient, snap: Snapshot<T>): void {
  qc.setQueryData<T>(snap.key, snap.prev as T);
}
