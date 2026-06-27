/**
 * `ALLOWED_TRANSITIONS` re-export (SDK-LAYERS-PLAN §3.6 / api-contract-core.md §6
 * / MERGE-TRANSITIONS).
 *
 * The nine state machines are build-time-checked DATA authored once in
 * `@levelup/domain` (`domain/transitions/*.ts`, each `as const satisfies
 * TransitionMap<XStatus>`). This layer re-exports them verbatim so the contract,
 * repos (UX pre-checks), and server (`@levelup/access` enforcement) all read ONE
 * table — drift is impossible because there is a single definition.
 */
export { ALLOWED_TRANSITIONS, canTransition, assertTransition } from "@levelup/domain";
export type { TransitionMap, TransitionDomain } from "@levelup/domain";

// Plan §6 names the entity key set `TransitionEntity`; domain names it
// `TransitionDomain`. Re-export under the contract's documented alias too.
export type { TransitionDomain as TransitionEntity } from "@levelup/domain";
