/**
 * Transition pre-check helpers (SDK-LAYERS-PLAN §4.1, §3.6, §4.5).
 *
 * Every `can*`/`is*` repo pre-check is a PURE read of the SAME
 * `ALLOWED_TRANSITIONS` data the server enforces with `assertTransition` — there
 * is NO second, drifting transition table in the repos. The repo answer is
 * byte-for-byte `canTransition(domain, from, to)` from `@levelup/api-contract`
 * (re-exported from `@levelup/domain`). Pre-checks never issue a wire call.
 */
import { canTransition } from "@levelup/api-contract";
import type { TransitionDomain } from "@levelup/api-contract";

/**
 * Pure UX pre-check: may `from` transition to `to` in `domain`? Reads the FROZEN
 * `ALLOWED_TRANSITIONS` table only. Returns `false` for an unknown `from`.
 */
export function can(domain: TransitionDomain, from: string | undefined, to: string): boolean {
  if (!from) return false;
  // `canTransition` types `from` as the keyof the specific domain's map; the repo
  // pre-check accepts a runtime status string and lets the table answer (unknown
  // `from` → no targets → false). The cast is the one bridge to the typed helper.
  return canTransition(domain, from as never, to);
}
