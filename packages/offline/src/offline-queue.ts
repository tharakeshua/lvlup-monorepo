/**
 * `@levelup/offline` — the offline-queue seam contract.
 *
 * SDK-LAYERS-PLAN §3.3 / transport-realtime layer §4 / SDK-SERVER §5.7. Ships as
 * **interface only** in v1 so the api-client can route mutations through an optional
 * queue *today* with zero behavior change (the `NoopOfflineQueue` passthrough). The
 * later real implementation is then purely additive — no UI / repo / contract changes.
 *
 * Dependency direction (strictly downward): this package imports **only**
 * `@levelup/api-contract` (+ `@levelup/domain` transitively). Zero runtime deps.
 *
 * The single day-1 prerequisite carried here is the **`idempotencyKey`** on every
 * `QueuedCall`: the api-client generates a UUIDv7 retry key per mutating call, and
 * carrying it from day 1 means the eventual durable replay can FIFO-dedupe without a
 * schema change (transport-realtime §4 / §9.5).
 */
import type { CallableName, ReqOf, ResOf } from "@levelup/api-contract";

/** Connectivity status surfaced to the UI. v1 (no-op) is always `'online'`. */
export type OfflineStatus = "online" | "offline" | "syncing";

/**
 * A single mutating callable buffered (or, in v1, immediately executed) by the queue.
 *
 * `idempotencyKey` is the api-client-generated UUIDv7 retry key — the prerequisite that
 * must be present from day 1 so a future durable queue can replay-with-dedupe.
 */
export interface QueuedCall<N extends CallableName = CallableName> {
  /** Versioned callable name (`v1.<module>.<op>`). */
  readonly name: N;
  /** The validated request payload (never carries `tenantId` — claim-derived server-side). */
  readonly data: ReqOf<N>;
  /** api-client-generated UUIDv7 idempotency key (§5.4). The day-1 replay prerequisite. */
  readonly idempotencyKey: string;
  /** ISO-8601 timestamp the call was enqueued. */
  readonly enqueuedAt: string;
}

/** Executor the queue defers to in order to actually invoke a call (the transport invoke). */
export type QueueExecutor = <N extends CallableName>(call: QueuedCall<N>) => Promise<ResOf<N>>;

/**
 * The offline-queue seam. v1 ships only `NoopOfflineQueue` (passthrough). A future durable
 * implementation (scanner replay) fills in real buffering behind this same interface.
 */
export interface OfflineQueue {
  /**
   * Route a mutating call through the queue.
   *
   * **v1 (no-op):** invokes `execute(call)` immediately and returns its result — identical
   * to a direct `transport.invoke`, so v1 behavior is unchanged.
   *
   * **future (durable):** buffers when offline, replays FIFO on reconnect, deduped per
   * `idempotencyKey`.
   */
  enqueue<N extends CallableName>(
    call: QueuedCall<N>,
    execute: (call: QueuedCall<N>) => Promise<ResOf<N>>
  ): Promise<ResOf<N>>;

  /** v1 (no-op): resolves immediately (nothing buffered). future: drains the buffer. */
  flush(): Promise<void>;

  /** Current connectivity status. v1: always `'online'`. */
  readonly status: OfflineStatus;

  /**
   * Subscribe to status transitions. Returns an unsubscribe fn.
   * v1 (no-op): never emits; the unsubscribe is a no-op.
   */
  onStatusChange(cb: (status: OfflineStatus) => void): () => void;
}
