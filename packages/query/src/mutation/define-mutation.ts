/**
 * `defineMutation(spec)` — the recipe framework (query-infra.md §6.1).
 *
 * Returns a `useXxx()` hook factory. The hook calls `repos.*` (via `useApi`),
 * applies the optional optimistic recipe in `onMutate`, rolls back in `onError`,
 * reconciles in `onSuccess`, and ALWAYS reconciles with the server by calling
 * `invalidateForCallable` in `onSettled` (so an optimistic cache never diverges).
 *
 * BUILD-TIME GUARD (defense-in-depth with the `no-optimistic-on-authority`
 * lint): constructing a mutation with an `optimistic` recipe on an
 * authority-sensitive OR non-allow-listed callable THROWS at module load.
 */
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { useApi } from "../provider/useApi.js";
import { invalidateForCallable } from "../invalidation/invalidate.js";
import { QUERY_KEYS } from "../keys/registry.js";
import { isAuthoritySensitive, isOptimisticAllowed } from "./authority.js";
import type { MutationSpec, OptimisticClient } from "./types.js";

/** Resolve the callable name from either `callable` or `name`. */
function callableOf(spec: { callable?: string; name?: string }): string {
  const name = spec.callable ?? spec.name;
  if (!name) throw new Error("[query] defineMutation: spec.callable (or spec.name) is required.");
  return name;
}

export function defineMutation<TVars = unknown, TData = unknown, TCtx = unknown>(
  spec: MutationSpec<TVars, TData, TCtx>
): () => UseMutationResult<TData, unknown, TVars, TCtx> {
  const callable = callableOf(spec);

  // ── BUILD-TIME GUARD (also lint-enforced) ────────────────────────────────
  // The closed OPTIMISTIC_ALLOWLIST is the single permit set. Membership wins
  // even for the documented authority-sensitive carve-out (recordItemAttempt is
  // optimistic *and* server-scored — CD13/A11): the optimistic patch never
  // invents a score and reconcile() trusts the authoritative response, so the
  // server still owns the canonical value. Anything NOT on the allow-list — every
  // grading/publish/lifecycle/purchase/session callable — is rejected.
  if (spec.optimistic && !isOptimisticAllowed(callable)) {
    const why = isAuthoritySensitive(callable)
      ? `it is authority-sensitive (grading/publish/lifecycle/purchase/session)`
      : `it is not on the closed OPTIMISTIC_ALLOWLIST`;
    throw new Error(
      `[query] Optimistic updates are forbidden on callable "${callable}": ${why}. ` +
        `See SDK-SERVER-DESIGN §5.5 / SDK-LAYERS-PLAN §4.4 / REVIEW §6.`
    );
  }

  return function useGeneratedMutation(): UseMutationResult<TData, unknown, TVars, TCtx> {
    const { repos } = useApi();
    const qc = useQueryClient();
    const optimistic = spec.optimistic;

    return useMutation<TData, unknown, TVars, TCtx>({
      mutationFn: (vars: TVars) => {
        if (!spec.run) {
          return Promise.reject(
            new Error(`[query] defineMutation("${callable}") has no run() implementation.`)
          );
        }
        return spec.run(repos, vars);
      },
      onMutate: optimistic
        ? async (vars: TVars) => {
            await qc.cancelQueries();
            return optimistic.apply(qc as unknown as OptimisticClient, vars, QUERY_KEYS);
          }
        : undefined,
      onError: (_err, _vars, ctx) => {
        if (optimistic && ctx !== undefined) {
          optimistic.rollback(qc as unknown as OptimisticClient, ctx as TCtx);
        }
      },
      onSuccess: (data: TData, vars: TVars, ctx) => {
        optimistic?.reconcile?.(qc as unknown as OptimisticClient, data, vars, ctx as TCtx);
      },
      onSettled: (data, _err, vars) => {
        if (spec.invalidate !== "none") {
          void invalidateForCallable(qc, callable, { vars, data });
        }
      },
    });
  };
}
