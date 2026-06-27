/**
 * `createNoopOfflineQueue()` — the only v1 `OfflineQueue` implementation.
 *
 * A pure passthrough: `enqueue` invokes the executor immediately (no buffering),
 * `flush` resolves at once, `status` is permanently `'online'`, and `onStatusChange`
 * never fires. This makes wiring the queue into the api-client a behavioral no-op while
 * keeping the seam — and the day-1 `idempotencyKey` — in place for the eventual durable
 * implementation (transport-realtime §4 / §9.5).
 */
import type { CallableName, ResOf } from "@levelup/api-contract";
import type { OfflineQueue, OfflineStatus, QueuedCall } from "./offline-queue.js";

/**
 * Construct the no-op passthrough queue. Each call gets a fresh instance so that a future
 * durable queue can be swapped in at the same wiring site without shared mutable state.
 */
export function createNoopOfflineQueue(): OfflineQueue {
  const status: OfflineStatus = "online";

  return {
    enqueue<N extends CallableName>(
      call: QueuedCall<N>,
      execute: (call: QueuedCall<N>) => Promise<ResOf<N>>
    ): Promise<ResOf<N>> {
      // Passthrough: no buffering — invoke immediately. The `idempotencyKey` rides along on
      // `call` so a later durable queue can replay-with-dedupe with no contract change.
      return execute(call);
    },

    flush(): Promise<void> {
      // Nothing buffered in v1.
      return Promise.resolve();
    },

    get status(): OfflineStatus {
      return status;
    },

    onStatusChange(_cb: (status: OfflineStatus) => void): () => void {
      // v1 never transitions; the unsubscribe is a no-op.
      return () => {
        /* no-op */
      };
    },
  };
}
