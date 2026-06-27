/**
 * Invalidation graph types (query-infra.md §5.1, SDK-LAYERS-PLAN §4.3).
 */
import type { QUERY_KEYS } from "../keys/registry.js";
import type { KeyRoot } from "../keys/types.js";

/** A declarative invalidation rule for one callable. */
export interface InvalidationRule {
  /** Roots to invalidate wholesale (coarse-but-correct; React Query prefix-matches). */
  readonly roots: readonly KeyRoot[];
  /** Optional precise targets computed from the mutation's variables/response. */
  readonly fanout?: FanoutResolver;
  /**
   * When `true`, the override's `roots` REPLACE the contract's `invalidates`
   * hint instead of merging with it. Used for the "reset / no-cache" callables
   * the contract hints at but the query layer handles differently:
   * `switchActiveTenant` (a full `resetForTenantSwitch` clear supersedes any
   * coarse roots, §4.4) and `generateReport` (a signed-URL response, nothing to
   * invalidate, §5.1). Without this, `buildGraphFromContract` would re-merge the
   * hint roots and the rule could never be empty.
   */
  readonly replace?: boolean;
}

/** Computes exact query keys to invalidate from a mutation's vars/response. */
export type FanoutResolver = (ctx: {
  /** the mutation input */
  vars: unknown;
  /** the mutation response */
  data: unknown;
  /** the typed key registry */
  keys: typeof QUERY_KEYS;
}) => readonly (readonly unknown[])[];
