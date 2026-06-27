/**
 * `noop-passthrough.test.ts` — transport-realtime layer §8 test #11.
 *
 * Asserts the no-op queue: (1) executes the call exactly once and resolves to its result,
 * (2) reports `status === 'online'`, (3) preserves the `idempotencyKey` on the `QueuedCall`
 * (the day-1 prerequisite for later durable replay), (4) `flush()` resolves, and
 * (5) `onStatusChange` returns a callable no-op unsubscribe.
 */
import { describe, it, expect, vi } from "vitest";
import { createNoopOfflineQueue } from "../noop-offline-queue.js";
import type { QueuedCall } from "../offline-queue.js";

// A representative mutating callable from the registry.
type CallName = "v1.levelup.recordItemAttempt";

function makeCall(): QueuedCall<CallName> {
  return {
    name: "v1.levelup.recordItemAttempt",
    data: {
      spaceId: "space_1",
      storyPointId: "sp_1",
      itemId: "item_1",
      answer: "A",
    } as QueuedCall<CallName>["data"],
    idempotencyKey: "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b",
    enqueuedAt: "2026-06-20T00:00:00.000Z",
  };
}

describe("createNoopOfflineQueue", () => {
  it("executes the call exactly once and resolves to its result", async () => {
    const queue = createNoopOfflineQueue();
    const call = makeCall();
    const result = { progress: { itemId: "item_1" }, completed: true };
    const execute = vi.fn(async () => result as never);

    const out = await queue.enqueue(call, execute);

    expect(execute).toHaveBeenCalledTimes(1);
    expect(out).toBe(result);
  });

  it("preserves the idempotencyKey on the executed QueuedCall", async () => {
    const queue = createNoopOfflineQueue();
    const call = makeCall();
    let seenKey: string | undefined;
    await queue.enqueue(call, async (c) => {
      seenKey = c.idempotencyKey;
      return undefined as never;
    });
    expect(seenKey).toBe(call.idempotencyKey);
  });

  it("reports online status and resolves flush()", async () => {
    const queue = createNoopOfflineQueue();
    expect(queue.status).toBe("online");
    await expect(queue.flush()).resolves.toBeUndefined();
  });

  it("onStatusChange returns a no-op unsubscribe and never emits", () => {
    const queue = createNoopOfflineQueue();
    const cb = vi.fn();
    const off = queue.onStatusChange(cb);
    expect(typeof off).toBe("function");
    expect(() => off()).not.toThrow();
    expect(cb).not.toHaveBeenCalled();
  });
});
