/**
 * `CALLABLES` registry assembly + `CallableName`/`ReqOf`/`ResOf` +
 * `AUTHORITY_CALLABLES` + optimistic allow-lists (SDK-LAYERS-PLAN §3.1/§3.2/§4.4
 * / api-contract-core.md §3).
 *
 * The four module barrels — each authored on a parallel build wave and exporting
 * a named `Record<\`v1.<m>.*\`, CallableDef>` — are spread into ONE flat `as const`
 * object keyed by the versioned callable name. `as const` freezes the key set so
 * `keyof` is a literal union. `AUTHORITY_CALLABLES` is REGENERATED from the live
 * `authoritySensitive` flag (never a hand list); the optimistic allow-lists are
 * closed `as const` data the `@levelup/query` runtime guard + the
 * `no-optimistic-on-authority` lint read.
 *
 * `defineCallable` is re-exported here because the levelup module defs author
 * through `registry.js` (the autograde/analytics/identity modules author through
 * `callable-def.js` / a module-local `_shared`); both resolve to the same helper.
 */
import type { z } from "zod";
import type { ApiModule, CallableDef } from "./callable-def";
import { IDENTITY_CALLABLES } from "./callables/identity/index";
import { LEVELUP_CONTENT_CALLABLES } from "./callables/levelup/index";
import { GAMIFICATION_CALLABLES } from "./callables/levelup/gamification";
import { AUTOGRADE_CALLABLES } from "./callables/autograde/index";
import { AUTOGRADE_FOLD_CALLABLES } from "./callables/autograde/fold";
import { ANALYTICS_CALLABLES } from "./callables/analytics/index";

export { defineCallable } from "./callable-def";

/**
 * THE registry. One flat object keyed by the versioned callable name. Every
 * module barrel keys its record by the full `v1.<module>.<op>` name. The levelup
 * slice is the module's content/testsession barrel (`LEVELUP_CONTENT_CALLABLES`)
 * plus the core-owned gamification/insight fold (`GAMIFICATION_CALLABLES`) —
 * both under the `v1.levelup.*` namespace, no 5th codebase (§2.4 /
 * api-contract-core.md §3.1).
 */
export const CALLABLES = {
  ...IDENTITY_CALLABLES,
  ...LEVELUP_CONTENT_CALLABLES,
  ...GAMIFICATION_CALLABLES,
  ...AUTOGRADE_CALLABLES,
  ...AUTOGRADE_FOLD_CALLABLES,
  ...ANALYTICS_CALLABLES,
} as const;

/** Compile-time guarantee every value is a CallableDef (catches a malformed barrel). */
type _AssertAllDefs = {
  [K in keyof typeof CALLABLES]: (typeof CALLABLES)[K] extends CallableDef<unknown, unknown>
    ? true
    : never;
};
void (0 as unknown as _AssertAllDefs);

export type CallableName = keyof typeof CALLABLES;
export type ReqOf<N extends CallableName> = z.infer<(typeof CALLABLES)[N]["requestSchema"]>;
export type ResOf<N extends CallableName> = z.infer<(typeof CALLABLES)[N]["responseSchema"]>;

/** Runtime list of all names (contract tests + server router iteration). */
export const CALLABLE_NAMES = Object.keys(CALLABLES) as CallableName[];

/** Lookup with a clear failure mode (server router; never silent). */
export function getCallable<N extends CallableName>(name: N): (typeof CALLABLES)[N] {
  const def = CALLABLES[name];
  if (!def) throw new Error(`[api-contract] unknown callable: ${name}`);
  return def;
}

/** All callables for one module (a server codebase wires only its own slice). */
export function callablesForModule(module: ApiModule): CallableDef[] {
  return CALLABLE_NAMES.map((n) => CALLABLES[n] as unknown as CallableDef).filter(
    (d) => d.module === module
  );
}

/**
 * The authority-sensitive callable set — REGENERATED from the live
 * `authoritySensitive` flag (T9 / CONV-4). Never hand-maintained.
 */
export const AUTHORITY_CALLABLES = Object.freeze(
  (Object.values(CALLABLES) as unknown as CallableDef[])
    .filter((d) => d.authoritySensitive)
    .map((d) => d.name)
) as readonly CallableName[];

/**
 * The closed conservative-optimistic allow-list — the ONLY ✅ surfaces (§4.4).
 * The `@levelup/query` `defineMutation` runtime guard + the
 * `@levelup/no-optimistic-on-authority` lint both read this.
 */
export const OPTIMISTIC_ALLOWLIST = [
  "v1.levelup.recordItemAttempt",
  "v1.levelup.sendChatMessage",
  "v1.identity.markNotificationRead",
  "v1.identity.markAnnouncementRead",
  "v1.levelup.dismissInsight",
  "v1.analytics.dismissInsight",
  "v1.levelup.markAchievementsSeen",
] as const satisfies readonly CallableName[];

/**
 * Optimistic counter allow-list (SEC-08 / CONV-4). Optimistic counter patches may
 * touch ONLY these counters — no progress/score/points/rank/purchase counter.
 */
export const OPTIMISTIC_COUNTER_ALLOWLIST = ["unreadCount", "unseenCount"] as const;
