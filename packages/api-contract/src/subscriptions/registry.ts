/**
 * `SUBSCRIPTIONS` registry assembly (SDK-LAYERS-PLAN §3.3 / api-contract-core §7.2).
 *
 * Mirrors the `CALLABLES` assembly pattern: the per-channel defs are AUTHORED in
 * the `callables/subscriptions/*` module files (colocated with their slim payload
 * schemas) and spread here into one frozen registry. This keeps the registry frame
 * (this layer) decoupled from def authoring while giving one import surface.
 *
 * `as const satisfies Record<string, SubscriptionDef<any,any>>` re-narrows the
 * spread record and locks `SubscriptionName = keyof typeof SUBSCRIPTIONS`. The
 * integrity test (`subscriptions-integrity.test.ts`) asserts `def.name === key`,
 * strict params/payload, no `tenantId` in params, and the `module` name-segment
 * agreement (with the allow-listed `notification → identity` fold).
 */
import type { z } from "zod";
import type { SubscriptionDef } from "./subscription-def.js";
import { SUBSCRIPTION_DEFS } from "../callables/subscriptions/index.js";

export const SUBSCRIPTIONS = {
  ...SUBSCRIPTION_DEFS,
} as const satisfies Record<string, SubscriptionDef<any, any>>;

/** The exhaustive set of realtime channel names. */
export type SubscriptionName = keyof typeof SUBSCRIPTIONS;

/** `.strict()` params type for a channel, recovered via `z.infer`. */
export type ParamsOf<S extends SubscriptionName> = z.infer<(typeof SUBSCRIPTIONS)[S]["params"]>;

/** Slim-projection payload type for a channel, recovered via `z.infer`. */
export type PayloadOf<S extends SubscriptionName> = z.infer<(typeof SUBSCRIPTIONS)[S]["payload"]>;

/** Runtime list of channel names (registry coverage tests + transport iteration). */
export const SUBSCRIPTION_NAMES = Object.keys(SUBSCRIPTIONS) as SubscriptionName[];
