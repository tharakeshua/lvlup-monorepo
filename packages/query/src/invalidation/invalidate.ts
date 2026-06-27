/**
 * `invalidateForCallable` — the ONE invalidation entrypoint (query-infra.md §5.2).
 *
 * Every mutation produced by `defineMutation` calls this in `onSettled`; domain
 * hooks never hand-write `invalidateQueries`. The graph decides scope once,
 * consistently, for all 8 apps — the fix for coarse `['tenants', tenantId, …]`
 * churn.
 *
 * Order: (1) coarse roots as `[domain]` prefix keys (always correct — React
 * Query matches by key prefix), then (2) precise `fanout` keys (narrower
 * refetch, lower churn) when a `ctx` is supplied.
 */
import { INVALIDATION_GRAPH } from "./graph.js";
import { QUERY_KEYS } from "../keys/registry.js";

/** The slice of `QueryClient` we touch (structural — RN/test friendly). */
export interface InvalidatingClient {
  invalidateQueries(filters: { queryKey: readonly unknown[] }): Promise<void> | void;
}

export async function invalidateForCallable(
  qc: InvalidatingClient,
  name: string,
  ctx?: { vars?: unknown; data?: unknown }
): Promise<void> {
  const rule = INVALIDATION_GRAPH[name];
  if (!rule) return; // unknown callable → defensive no-op (no throw)

  // 1. coarse roots — each a single-element [domain] prefix key.
  await Promise.all(
    rule.roots.map((root) => Promise.resolve(qc.invalidateQueries({ queryKey: [root] })))
  );

  // 2. precise fanout — exact detail/sub keys, only when ctx is present.
  if (rule.fanout && ctx) {
    const targets = rule.fanout({ vars: ctx.vars, data: ctx.data, keys: QUERY_KEYS });
    await Promise.all(
      targets.map((queryKey) => Promise.resolve(qc.invalidateQueries({ queryKey })))
    );
  }
}
