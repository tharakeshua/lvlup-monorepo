/**
 * The `Transport` contract this adapter IMPLEMENTS (transport-realtime.md §1).
 *
 * The plan locates the canonical `Transport` / `SubscriptionHandle` /
 * `SubscriptionCallbacks` interfaces in `@levelup/api-contract`
 * (`src/transport/transport.ts`) so api-client (consumer) and the transport
 * adapters (implementers) reference one shape without a cycle. Until that module
 * is published from api-contract, the implementer re-declares the structurally
 * identical shape here and re-exports it from the barrel; the typecheck/fix wave
 * collapses the two into the api-contract import. The shape is byte-for-byte the
 * one the shared `createFakeTransport()` fake satisfies (tests/sdk/fakes).
 *
 * This file imports ONLY `@levelup/api-contract` types — no firebase, no upward deps.
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

/**
 * The wire-edge error envelope surfaced through subscription `error` callbacks.
 * The transport only carries the typed `ApiErrorDetails` envelope; api-client owns
 * the richer `ApiError` *mapping*. Aliased here so the contract reads cleanly.
 */
export type TransportError = ApiErrorDetails;

export interface SubscriptionHandle {
  /** Idempotent. Detaches the underlying listener (refcount-aware in the realtime layer). */
  unsubscribe(): void;
  /** Stable id for dedupe/debug logging. */
  readonly id: string;
  /** True until `unsubscribe()` is called. */
  readonly active: boolean;
}

export interface SubscriptionCallbacks<P> {
  next: (payload: P) => void;
  /** Wire-edge error (an `ApiErrorDetails` envelope; api-client maps to `ApiError`). */
  error?: (err: TransportError) => void;
  /** Fired once the first server snapshot has been received (vs local-cache hydrate). */
  onSynced?: () => void;
}

/** `next`-only function form or the full callbacks object — both accepted by `subscribe`. */
export type SubscribeCallback<P> = SubscriptionCallbacks<P> | ((payload: P) => void);

/** Signed-PUT upload input (the only client Storage write mechanism, §3.7). */
export interface UploadBytesInput {
  /** The signed PUT URL returned by `v1.autograde.requestUploadUrl` et al. */
  uploadUrl: string;
  /** The raw bytes to PUT (Blob/File in browsers, Uint8Array/ArrayBuffer elsewhere). */
  bytes: Blob | ArrayBuffer | Uint8Array;
  /** Content-Type the signed URL was minted for (must match the sign-time pin). */
  contentType: string;
}

/**
 * Storage capability — the ONLY client Storage site (§3.7). `requestUploadUrl` is a
 * thin alias over the `v1.autograde.requestUploadUrl` callable (so it goes through
 * the same `invoke` path / ID-token forwarding); `uploadImage` consumes the signed
 * PUT URL with a direct `fetch` (no firebase/storage SDK round-trip needed for a
 * signed PUT, but the `storage` service is wired for emulator/host resolution).
 */
export interface StorageTransport {
  /** Request a signed PUT URL via the `requestUploadUrl` callable (no `tenantId`). */
  requestUploadUrl(
    data: ReqOf<"v1.autograde.requestUploadUrl">
  ): Promise<ResOf<"v1.autograde.requestUploadUrl">>;
  /** Consume a signed PUT URL: uploads bytes, resolves once the object is stored. */
  uploadImage(input: UploadBytesInput): Promise<void>;
}

export interface Transport {
  invoke<N extends CallableName>(name: N, data: ReqOf<N>): Promise<ResOf<N>>;

  subscribe<S extends SubscriptionName>(
    name: S,
    params: ParamsOf<S>,
    cb: SubscribeCallback<PayloadOf<S>>
  ): SubscriptionHandle;

  /**
   * Server-time primitive (SDK-SERVER §7.1.1). Resolves the RTDB
   * `/.info/serverTimeOffset` value. Offset in ms (`serverNow ≈ Date.now() + offset`).
   */
  serverTimeOffset(cb: (offsetMs: number) => void): SubscriptionHandle;

  /**
   * Token seam used by `meRepo.switchTenant`: force a fresh ID token after claims
   * re-stamp (identity open-Q #4). No-op for transports without Firebase Auth.
   */
  refreshToken(forceRefresh?: boolean): Promise<void>;

  /** Storage capability — the only client Storage site (§3.7). */
  storage: StorageTransport;
}
