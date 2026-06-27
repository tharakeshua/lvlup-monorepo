/**
 * `@levelup/offline` — public surface.
 *
 * The offline-queue seam (transport-realtime layer §4). v1 ships the interface plus the
 * `NoopOfflineQueue` passthrough; the durable replay implementation is deferred (ticket
 * SDK-A12). The api-client wires `createNoopOfflineQueue()` by default so v1 behavior is
 * unchanged and the day-1 `idempotencyKey` is already present for later replay.
 */
export type { OfflineQueue, OfflineStatus, QueuedCall, QueueExecutor } from "./offline-queue.js";

export { createNoopOfflineQueue } from "./noop-offline-queue.js";
