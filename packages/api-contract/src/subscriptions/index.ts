/**
 * Subscriptions public surface (SDK-LAYERS-PLAN §3.3 / api-contract-core §7).
 *
 * The core `src/index.ts` re-exports from here. Downstream consumers:
 *   - `@levelup/api-client` — `SUBSCRIPTIONS` + `ParamsOf`/`PayloadOf` (subscribe seam)
 *   - `@levelup/realtime`   — `SubscriptionDef` + `source` hint
 *   - `@levelup/query`      — `SubscriptionName` (`useSubscription`)
 */
export {
  defineSubscription,
  type SubscriptionDef,
  type SubscriptionSource,
} from "./subscription-def.js";

export {
  SUBSCRIPTIONS,
  SUBSCRIPTION_NAMES,
  type SubscriptionName,
  type ParamsOf,
  type PayloadOf,
} from "./registry.js";

// Per-channel defs + slim-projection schemas/types (colocated authoring surface).
export * from "../callables/subscriptions/index.js";
