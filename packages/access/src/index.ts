/**
 * `@levelup/access` — the ONE authorization policy + key registries + the
 * server-side state-machine enforcement helper. Pure TS (no firebase/DOM/React).
 *
 *   `@levelup/domain` ← `@levelup/api-contract` ← **`@levelup/access`** ← services …
 */

// keys (re-exported from @levelup/domain + policy helpers)
export * from "./keys/index.js";

// actions + context + resource shapes
export type { Action, ResourceRef, AccessContext } from "./actions.js";
export { ACTIONS } from "./actions.js";

// the policy
export type { AccessRule } from "./policy.js";
export { authorize, can, ACCESS_RULES } from "./policy.js";

// transitions
export type { TransitionEntityKey } from "./transitions.js";
export { assertTransition, canTransition, ALLOWED_TRANSITIONS } from "./transitions.js";

// errors (transport-neutral)
export {
  AccessError,
  isAccessError,
  denied,
  invalidTransition,
  unauthenticated,
} from "./errors.js";
