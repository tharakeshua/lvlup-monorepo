/**
 * `@levelup/realtime` — public surface (transport-realtime layer §3).
 *
 * The realtime seam consumer: `RealtimeProvider`, the generic `useSubscription`, the single
 * `useServerTime` primitive, the refcount/dedupe `SubscriptionManager`, and one typed
 * convenience hook per registered subscription. Consumes only `transport.subscribe` /
 * `transport.serverTimeOffset` (the realtime half of the `Transport` seam) — imports **no**
 * `firebase/*` (all platform knowledge stays in `@levelup/transport-firebase`).
 */

// Provider + context
export { RealtimeProvider, RealtimeContext, useRealtime } from "./realtime-provider.js";
export type { RealtimeContextValue, RealtimeProviderProps } from "./realtime-provider.js";

// Generic hooks
export { useSubscription } from "./use-subscription.js";
export { useServerTime } from "./use-server-time.js";

// Dedupe registry (exported for advanced wiring / tests)
export { createSubscriptionManager, stableStringify } from "./subscription-manager.js";
export type { SubscriptionManager } from "./subscription-manager.js";
export { createServerTimeStore } from "./server-time-store.js";
export type { ServerTimeStore } from "./server-time-store.js";

// Per-subscription convenience hooks (one per SubscriptionName)
export * from "./hooks/index.js";

// Result/option/seam types
export type {
  RealtimeStatus,
  UseSubscriptionResult,
  UseSubscriptionOptions,
  ServerTime,
} from "./types.js";
export type {
  RealtimeTransport,
  SubscriptionHandle,
  SubscriptionCallbacks,
  ApiError,
} from "./seam.js";
