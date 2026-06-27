/**
 * The `Transport` seam — re-stated locally for this package.
 *
 * SOURCE OF TRUTH: the canonical `Transport` / `SubscriptionHandle` /
 * `SubscriptionCallbacks` interfaces live in `@levelup/api-contract`
 * (`src/transport/transport.ts`) so both `@levelup/api-client` (the consumer) and the
 * transport adapters (the implementers) reference one shape without a dependency cycle
 * (transport-realtime layer §1). That canonical home is authored on a parallel build
 * wave; until the typecheck/fix wave promotes these symbols into the api-contract barrel,
 * this package re-states the seam exactly (the layer plan explicitly permits re-stating
 * the interface, never re-owning it) so it compiles independently.
 *
 * The `error` channel carries the typed `ApiErrorDetails` envelope from `@levelup/api-contract`
 * (the real `ApiError` class is produced by `@levelup/api-client.normalizeError`; this seam
 * only needs the structural error shape).
 */
import type {
  CallableName,
  ReqOf,
  ResOf,
  SubscriptionName,
  ParamsOf,
  PayloadOf,
  ApiErrorDetails,
} from "@levelup/api-contract";

/** Structural error shape carried over the seam (the api-client owns the concrete `ApiError`). */
export type TransportError = ApiErrorDetails;

/** Idempotent, refcount-aware handle to a live subscription. */
export interface SubscriptionHandle {
  /** Idempotent. Detaches the underlying listener. */
  unsubscribe(): void;
  /** Stable id for dedupe / debug logging. */
  readonly id: string;
  /** True until `unsubscribe()` is called. */
  readonly active: boolean;
}

/** Subscription consumer callbacks. */
export interface SubscriptionCallbacks<P> {
  next: (payload: P) => void;
  error?: (err: TransportError) => void;
  /** Fired once the first server snapshot has been received (vs a local-cache hydrate). */
  onSynced?: () => void;
}

/**
 * The platform-agnostic transport contract. `@levelup/api-client` consumes
 * `invoke` / `refreshToken`; `@levelup/realtime` consumes `subscribe` /
 * `serverTimeOffset`. Neither knows the concrete implementation.
 */
export interface Transport {
  invoke<N extends CallableName>(name: N, data: ReqOf<N>): Promise<ResOf<N>>;

  subscribe<S extends SubscriptionName>(
    name: S,
    params: ParamsOf<S>,
    cb: SubscriptionCallbacks<PayloadOf<S>> | ((payload: PayloadOf<S>) => void)
  ): SubscriptionHandle;

  /**
   * Server-time primitive. Resolves the server clock offset in ms
   * (`serverNow ≈ Date.now() + offsetMs`). Subscribable for drift.
   */
  serverTimeOffset(cb: (offsetMs: number) => void): SubscriptionHandle;

  /**
   * Force a fresh auth token after claims re-stamp (e.g. `switchActiveTenant`).
   * No-op for transports without an auth layer.
   */
  refreshToken(forceRefresh?: boolean): Promise<void>;
}

export type { CallableName, ReqOf, ResOf, SubscriptionName, ParamsOf, PayloadOf };
