/**
 * The injected `Transport` seam (api-client-core.md §0 "Transport", §3.1;
 * transport-realtime.md §1).
 *
 * api-client is transport-agnostic: it NEVER imports `@levelup/transport-*` or
 * `firebase`. Instead it declares the structural `Transport` contract here and
 * receives a concrete impl by injection. The real Firebase adapter
 * (`@levelup/transport-firebase`) and any future HTTP adapter satisfy this exact
 * shape; the fake transport in `tests/sdk/fakes` is structurally assignable too.
 *
 * Kept BYTE-IDENTICAL to the `Transport` interface authored in
 * `transport-realtime.md §1` so the two surfaces never drift: `invoke` +
 * `refreshToken` are consumed by this layer; `subscribe` + `serverTimeOffset`
 * are passed through to `@levelup/realtime`/`@levelup/query`.
 */
import type { CallableName, ReqOf, ResOf } from "@levelup/api-contract";
import type { SubscriptionName, ParamsOf, PayloadOf } from "@levelup/api-contract";
import type { ApiError } from "./errors.js";

/**
 * Handle returned by every `subscribe()`/`serverTimeOffset()` call. `unsubscribe`
 * is idempotent (the realtime layer makes it refcount-aware).
 */
export interface SubscriptionHandle {
  /** Idempotent. Detaches the underlying listener. */
  unsubscribe(): void;
  /** Stable id for dedupe/debug logging. */
  readonly id: string;
  /** True until `unsubscribe()` is called. */
  readonly active: boolean;
}

/** Rich subscription callbacks; a bare `next` function is also accepted. */
export interface SubscriptionCallbacks<P> {
  next: (payload: P) => void;
  /** Normalized error from the transport (already an `ApiError` when realtime). */
  error?: (err: ApiError) => void;
  /** Fired once the first server snapshot has landed (vs a local-cache hydrate). */
  onSynced?: () => void;
}

/** Either the rich callbacks object or a bare `next` function. */
export type SubscriptionListener<P> = SubscriptionCallbacks<P> | ((payload: P) => void);

/**
 * The platform seam. The ONLY thing that differs web ↔ React Native ↔ REST is the
 * concrete object passed to `createApiClient`.
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
}
