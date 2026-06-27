/**
 * Mutation-framework types (query-infra.md §6.1, SDK-LAYERS-PLAN §4.4).
 *
 * `defineMutation(spec)` is the ONE way to build a mutation hook. An optional
 * `optimistic` recipe is permitted ONLY for the closed `OPTIMISTIC_ALLOWLIST`
 * surfaces; presence on a ⚷ / non-allow-listed callable is a build error (the
 * runtime guard) + a lint error (`no-optimistic-on-authority`).
 */
import type { QUERY_KEYS } from "../keys/registry.js";

/** A minimal `QueryClient` slice the recipes + define-mutation touch. */
export interface OptimisticClient {
  getQueryData<T = unknown>(key: readonly unknown[]): T | undefined;
  setQueryData<T = unknown>(
    key: readonly unknown[],
    updater: T | ((prev: T | undefined) => T)
  ): void;
  cancelQueries(filters?: { queryKey?: readonly unknown[] }): Promise<void>;
}

export type MutationKind = "standard" | "optimistic";

/**
 * A conservative optimistic recipe: snapshot+patch before the request, restore
 * on error, and (optionally) reconcile with the authoritative response.
 */
export interface OptimisticConfig<TVars = unknown, TData = unknown, TCtx = unknown> {
  /** Snapshot + mutate the cache before the request; return rollback context. */
  apply: (qc: OptimisticClient, vars: TVars, keys: typeof QUERY_KEYS) => TCtx;
  /** Restore from snapshot on error. */
  rollback: (qc: OptimisticClient, ctx: TCtx) => void;
  /**
   * Reconcile with the authoritative response on success. Default behavior is
   * "trust the server" via the `onSettled` invalidation; recipes that must
   * write the server value (recordItemAttempt → `setQueryData(res.progress)`)
   * implement this (A11/CD13).
   */
  reconcile?: (qc: OptimisticClient, data: TData, vars: TVars, ctx: TCtx) => void;
}

/** The spec passed to `defineMutation`. `callable` and `name` are interchangeable. */
export interface MutationSpec<TVars = unknown, TData = unknown, TCtx = unknown> {
  /** The contract callable this mutation drives. Alias: `name`. */
  callable?: string;
  /** Alias of `callable` (some call sites pass `name`). */
  name?: string;
  /** repos.* method that performs the call. */
  run?: (repos: unknown, vars: TVars) => Promise<TData>;
  /**
   * Optional optimistic recipe. PRESENCE on a ⚷ / non-allow-listed callable is a
   * build error. The recipe context type (`TCtx`) is opaque to the spec (recipes
   * pick their own snapshot shape), so it is left unconstrained here.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  optimistic?: OptimisticConfig<TVars, TData, any>;
  /** Override the graph's invalidation per call site (rare). Default 'graph'. */
  invalidate?: "graph" | "none";
}
