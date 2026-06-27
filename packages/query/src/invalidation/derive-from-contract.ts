/**
 * `buildGraphFromContract(CALLABLES, OVERRIDES)` (query-infra.md §5.1).
 *
 * Seeds the graph from each mutating def's `invalidates` hint, then merges the
 * hand-authored cross-domain OVERRIDES (deduping roots so a hint + an override
 * naming the same root collapse to one). Reads (no `invalidates`, no override)
 * are omitted — they carry no rule.
 */
import type { KeyRoot } from "../keys/types.js";
import type { InvalidationRule } from "./types.js";

/** Minimal structural view of a contract callable def (just what we read). */
interface CallableLike {
  readonly invalidates?: readonly string[];
}

/** Stable de-dupe preserving first-seen order. */
function dedupe<T>(xs: readonly T[]): T[] {
  return Array.from(new Set(xs));
}

/**
 * Build the full graph. Generic over the callables map so the contract test can
 * drive it with a tiny stub, while production passes the real `CALLABLES`.
 */
export function buildGraphFromContract<C extends Record<string, CallableLike>>(
  callables: C,
  overrides: Partial<Record<keyof C & string, InvalidationRule>>
): Record<keyof C & string, InvalidationRule> {
  const out = {} as Record<keyof C & string, InvalidationRule>;
  const merge = (
    fromHint: readonly KeyRoot[],
    override: InvalidationRule | undefined
  ): InvalidationRule => {
    if (!override) return { roots: dedupe(fromHint) };
    // `replace:true` lets an override SUPPRESS the contract hint (so the rule can
    // be empty even when the contract declares roots) — switchActiveTenant /
    // generateReport (§4.4/§5.1). Otherwise hint + override roots are merged.
    const roots = override.replace
      ? dedupe(override.roots)
      : dedupe([...fromHint, ...override.roots]);
    return { roots, fanout: override.fanout };
  };
  for (const name of Object.keys(callables) as (keyof C & string)[]) {
    const fromHint = (callables[name].invalidates ?? []) as readonly KeyRoot[];
    out[name] = merge(fromHint, overrides[name]);
  }
  // Any override naming a callable not present in `callables` is still honored
  // (defensive: keeps hand-authored cross-domain rules even if a hint is absent).
  for (const name of Object.keys(overrides) as (keyof C & string)[]) {
    if (out[name]) continue;
    out[name] = merge([], overrides[name]);
  }
  return out;
}
