/**
 * The realtime half of the `Transport` seam — re-stated locally.
 *
 * SOURCE OF TRUTH: the canonical `Transport` / `SubscriptionHandle` /
 * `SubscriptionCallbacks` interfaces live in `@levelup/api-contract`
 * (`src/transport/transport.ts`) so the api-client (consumer of `invoke`) and the
 * transport adapters (implementers) share one shape without a cycle (transport-realtime
 * layer §1/§3). `@levelup/realtime` consumes only the `subscribe` / `serverTimeOffset`
 * half. That canonical home is authored on a parallel build wave; until the typecheck/fix
 * wave promotes these symbols into the api-contract barrel, this package re-states the seam
 * exactly (the layer plan explicitly permits re-stating it) so it compiles independently and
 * imports **no** `firebase/*` (all platform knowledge stays in `@levelup/transport-firebase`).
 */
import type { SubscriptionName, ParamsOf, PayloadOf, ApiErrorDetails } from "@levelup/api-contract";

/** Structural error shape carried over the seam (api-client owns the concrete `ApiError`). */
export type ApiError = ApiErrorDetails;

/** Idempotent, refcount-aware handle to a live subscription. */
export interface SubscriptionHandle {
  /** Idempotent. Detaches the underlying listener (refcount-aware in the manager). */
  unsubscribe(): void;
  /** Stable id for dedupe / debug logging. */
  readonly id: string;
  /** True until `unsubscribe()` is called. */
  readonly active: boolean;
}

/** Subscription consumer callbacks. */
export interface SubscriptionCallbacks<P> {
  next: (payload: P) => void;
  error?: (err: ApiError) => void;
  /** Fired once the first server snapshot has been received (vs a local-cache hydrate). */
  onSynced?: () => void;
}

/**
 * The slice of the `Transport` contract `@levelup/realtime` consumes. The full `Transport`
 * additionally carries `invoke` (api-client) and `refreshToken` (meRepo) — out of scope here.
 */
export interface RealtimeTransport {
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
}

export type { SubscriptionName, ParamsOf, PayloadOf };
