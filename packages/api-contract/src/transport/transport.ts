/**
 * Canonical `Transport` seam (DP-1 / transport-realtime.md §1).
 *
 * THE single home for the platform-agnostic transport contract that the
 * implementers (`@levelup/transport-firebase`, `@levelup/transport-http`,
 * `@levelup/realtime`) satisfy and the consumers (`@levelup/api-client`,
 * `@levelup/repositories`, `@levelup/query`) reference — promoted here so the 24
 * hand-copied declaration sites collapse to one shape with zero drift.
 *
 * Why api-contract: every type below references api-contract-owned generics
 * (`CallableName`/`ReqOf`/`ResOf`, `SubscriptionName`/`ParamsOf`/`PayloadOf`,
 * `ApiErrorDetails`), so this is a strictly-downward move — no new dependency
 * edge, no cycle (api-contract depends only on `@levelup/domain` + `zod`).
 *
 * The subscription `error` callback carries the wire-edge `ApiErrorDetails`
 * envelope — NOT the api-client `ApiError` class (which would force every
 * implementer to depend on api-client, breaking the downward-only rule).
 */
import type { CallableName, ReqOf, ResOf } from "../registry.js";
import type { SubscriptionName, ParamsOf, PayloadOf } from "../subscriptions/index.js";
import type { ApiErrorDetails } from "../errors.js";
import type { StorageTransport } from "./storage.js";

/**
 * Handle returned by every `subscribe()`/`serverTimeOffset()` call. `unsubscribe`
 * is idempotent (the realtime layer makes it refcount-aware).
 */
export interface SubscriptionHandle {
  /** Idempotent. Detaches the underlying listener (refcount-aware in the realtime layer). */
  unsubscribe(): void;
  /** Stable id for dedupe/debug logging. */
  readonly id: string;
  /** True until `unsubscribe()` is called. */
  readonly active: boolean;
}

/** Rich subscription callbacks; a bare `next` function is also accepted. */
export interface SubscriptionCallbacks<P> {
  next: (payload: P) => void;
  /** Wire-edge error (an `ApiErrorDetails` envelope; api-client maps to `ApiError`). */
  error?: (err: ApiErrorDetails) => void;
  /** Fired once the first server snapshot has been received (vs a local-cache hydrate). */
  onSynced?: () => void;
}

/** Either the rich callbacks object or a bare `next` function — both accepted by `subscribe`. */
export type SubscriptionListener<P> = SubscriptionCallbacks<P> | ((payload: P) => void);

/**
 * Lifecycle of a subscription as surfaced to the UI. Canonical 4-state superset —
 * a 3-state hook (e.g. `@levelup/query`'s `useSubscription`) simply never emits
 * `"connecting"` without breaking the type.
 */
export type SubscriptionStatus = "idle" | "connecting" | "live" | "error";

/** A single namespaced callable: typed request in → typed response out. */
export type Callable<Req, Res> = (req: Req) => Promise<Res>;

/**
 * The platform seam. The ONLY thing that differs web ↔ React Native ↔ REST is the
 * concrete object passed to `createApiClient`. `invoke`/`refreshToken`/`storage`
 * are consumed by api-client; `subscribe`/`serverTimeOffset` by realtime/query.
 */
export interface Transport {
  /** RPC: validated request in → typed response out. */
  invoke<N extends CallableName>(name: N, data: ReqOf<N>): Promise<ResOf<N>>;

  /** Realtime seam: subscribe to a slim-projection channel. */
  subscribe<S extends SubscriptionName>(
    name: S,
    params: ParamsOf<S>,
    cb: SubscriptionListener<PayloadOf<S>>
  ): SubscriptionHandle;

  /**
   * Server-time primitive — resolves the RTDB `/.info/serverTimeOffset` value
   * (`serverNow ≈ Date.now() + offset`). Subscribable for drift.
   */
  serverTimeOffset(cb: (offsetMs: number) => void): SubscriptionHandle;

  /**
   * Force a fresh ID token after a claims re-stamp (meRepo.switchTenant). No-op
   * for transports without Firebase Auth.
   */
  refreshToken(forceRefresh?: boolean): Promise<void>;

  /**
   * Storage capability — the only client Storage site (§3.7). On the canonical
   * shape so an adapter without it (transport-http) is a COMPILE error (correct:
   * it's an incomplete stub) rather than a silent `undefined` at runtime.
   */
  storage: StorageTransport;
}
