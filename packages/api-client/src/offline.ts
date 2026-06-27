/**
 * Offline-queue SEAM (api-client-core.md §3.6 / §6.6).
 *
 * v1 is a seam only: api-client accepts an optional `OfflineQueue`. When present,
 * ONLY `def.idempotent` mutations route through it (replay safety hinges on the
 * idempotency key being mandatory on every queued call). Reads and non-idempotent
 * writes always go direct. The default `NoopOfflineQueue` delivers immediately —
 * building the real persistent queue later requires NO change to this surface or
 * to any layer above.
 */
import type { CallableName, ReqOf, ResOf } from "@levelup/api-contract";

/**
 * A call captured for (possibly deferred) delivery. `idempotencyKey` is mandatory
 * — it is the replay-safety join point. `deliver` is the bound network call the
 * queue invokes when it is ready to flush; a real persistent queue rebuilds it on
 * replay from `(name, data, idempotencyKey)`.
 */
export interface QueuedCall<N extends CallableName = CallableName> {
  name: N;
  data: ReqOf<N>;
  idempotencyKey: string;
  enqueuedAt: number;
  /** The bound delivery thunk (network call). Optional on the public wire shape. */
  deliver?: () => Promise<ResOf<N>>;
}

export interface OfflineQueue {
  /** Resolves when the call is eventually delivered (or rejects if dropped). */
  enqueue<N extends CallableName>(call: QueuedCall<N>): Promise<ResOf<N>>;
  /** Force a flush of any pending calls. */
  flush(): Promise<void>;
  readonly status: "idle" | "flushing" | "offline";
}

/**
 * v1 default: an immediate-passthrough queue. It performs the call's bound
 * `deliver` synchronously (no persistence, no deferral) so behaviour is identical
 * to a direct send while keeping the seam in place.
 */
export class NoopOfflineQueue implements OfflineQueue {
  readonly status: "idle" | "flushing" | "offline" = "idle";

  async enqueue<N extends CallableName>(call: QueuedCall<N>): Promise<ResOf<N>> {
    if (call.deliver) return call.deliver();
    return undefined as unknown as ResOf<N>;
  }

  async flush(): Promise<void> {
    /* no pending state to flush */
  }
}

/**
 * Route a call through the queue when a queue is present (api-client gates this to
 * `def.idempotent` mutations before calling). With no queue, `deliver` is invoked
 * directly. The bound `deliver` is attached to the `QueuedCall` so the queue owns
 * the actual network call and the replay key travels with it.
 */
export function routeThroughQueue<N extends CallableName>(
  queue: OfflineQueue | undefined,
  name: N,
  data: ReqOf<N>,
  key: string,
  deliver: () => Promise<ResOf<N>>
): Promise<ResOf<N>> {
  if (!queue) return deliver();
  return queue.enqueue<N>({
    name,
    data,
    idempotencyKey: key,
    enqueuedAt: Date.now(),
    deliver,
  });
}
