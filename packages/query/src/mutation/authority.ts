/**
 * Authority flag + optimistic allow-lists (query-infra.md §6.2/§6.3,
 * SDK-LAYERS-PLAN §4.4). The contract package is the SSOT for both lists; this
 * module re-exports them (drift-guarded by `optimistic-allowlist.contract.test`)
 * and exposes `isAuthoritySensitive` / `isOptimisticAllowed`.
 */
import {
  CALLABLES,
  OPTIMISTIC_ALLOWLIST as CONTRACT_OPTIMISTIC_ALLOWLIST,
  OPTIMISTIC_COUNTER_ALLOWLIST as CONTRACT_OPTIMISTIC_COUNTER_ALLOWLIST,
} from "@levelup/api-contract";

/** The closed conservative-optimistic allow-list — the ONLY ✅ surfaces. */
export const OPTIMISTIC_ALLOWLIST: readonly string[] = CONTRACT_OPTIMISTIC_ALLOWLIST;

/** Optimistic counter allow-list — `decrementBadge`/`incrementCounter` may touch ONLY these. */
export const OPTIMISTIC_COUNTER_ALLOWLIST: readonly string[] =
  CONTRACT_OPTIMISTIC_COUNTER_ALLOWLIST;

const ALLOWED = new Set<string>(OPTIMISTIC_ALLOWLIST);

/** True iff the callable carries `authoritySensitive: true` in the contract. */
export function isAuthoritySensitive(name: string): boolean {
  const def = (CALLABLES as Record<string, { authoritySensitive?: boolean } | undefined>)[name];
  return def?.authoritySensitive === true;
}

/** True iff the callable is on the closed optimistic allow-list. */
export function isOptimisticAllowed(name: string): boolean {
  return ALLOWED.has(name);
}
