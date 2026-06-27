/**
 * `subscription-manager.dedupe.test.ts` — transport-realtime layer §8 test #8.
 *
 * Two consumers of the same `(name, params)` create ONE underlying `transport.subscribe`;
 * the last unsubscribe tears it down; a late subscriber gets the replayed last payload +
 * synced state; `unsubscribe()` is idempotent; differing params open distinct listeners.
 */
import { describe, it, expect, vi } from "vitest";
import { createSubscriptionManager, stableStringify } from "../subscription-manager.js";
import type { RealtimeTransport, SubscriptionCallbacks, SubscriptionHandle } from "../seam.js";

/** A fake transport whose `subscribe` records calls and lets the test drive emissions. */
function makeFakeTransport() {
  const calls: Array<{
    name: string;
    params: unknown;
    cb: SubscriptionCallbacks<unknown>;
    handle: SubscriptionHandle & { unsub: ReturnType<typeof vi.fn> };
  }> = [];

  const transport: Pick<RealtimeTransport, "subscribe"> = {
    subscribe: ((name: string, params: unknown, cb: SubscriptionCallbacks<unknown>) => {
      const unsub = vi.fn();
      let active = true;
      const handle = {
        id: `fake#${calls.length}`,
        get active() {
          return active;
        },
        unsubscribe() {
          active = false;
          unsub();
        },
        unsub,
      };
      calls.push({ name, params, cb, handle });
      return handle;
    }) as RealtimeTransport["subscribe"],
  };

  return { transport, calls };
}

describe("createSubscriptionManager", () => {
  it("shares ONE underlying subscribe across two same-key consumers", () => {
    const { transport, calls } = makeFakeTransport();
    const mgr = createSubscriptionManager(transport);

    const a = vi.fn();
    const b = vi.fn();
    const ha = mgr.subscribe("v1.notification.badge", {}, { next: a });
    const hb = mgr.subscribe("v1.notification.badge", {}, { next: b });

    expect(calls).toHaveLength(1); // single underlying listener

    // Emit through the underlying callback → both consumers receive it.
    calls[0].cb.next({ unreadCount: 3 });
    expect(a).toHaveBeenCalledWith({ unreadCount: 3 });
    expect(b).toHaveBeenCalledWith({ unreadCount: 3 });

    // First unsubscribe does NOT tear down; second one does.
    ha.unsubscribe();
    expect(calls[0].handle.unsub).not.toHaveBeenCalled();
    hb.unsubscribe();
    expect(calls[0].handle.unsub).toHaveBeenCalledTimes(1);
  });

  it("replays the last payload + synced to a late subscriber", () => {
    const { transport, calls } = makeFakeTransport();
    const mgr = createSubscriptionManager(transport);

    const first = vi.fn();
    mgr.subscribe("v1.notification.badge", {}, { next: first });
    calls[0].cb.next({ unreadCount: 7 });
    calls[0].cb.onSynced?.();

    const late = vi.fn();
    const lateSynced = vi.fn();
    mgr.subscribe("v1.notification.badge", {}, { next: late, onSynced: lateSynced });

    expect(calls).toHaveLength(1); // still one listener
    expect(late).toHaveBeenCalledWith({ unreadCount: 7 }); // warm replay
    expect(lateSynced).toHaveBeenCalledTimes(1);
  });

  it("unsubscribe is idempotent", () => {
    const { transport, calls } = makeFakeTransport();
    const mgr = createSubscriptionManager(transport);
    const h = mgr.subscribe("v1.notification.badge", {}, { next: vi.fn() });
    h.unsubscribe();
    h.unsubscribe();
    expect(calls[0].handle.unsub).toHaveBeenCalledTimes(1);
  });

  it("differing params open distinct underlying listeners", () => {
    const { transport, calls } = makeFakeTransport();
    const mgr = createSubscriptionManager(transport);
    mgr.subscribe("v1.levelup.testSessionDeadline", { sessionId: "a" }, { next: vi.fn() });
    mgr.subscribe("v1.levelup.testSessionDeadline", { sessionId: "b" }, { next: vi.fn() });
    expect(calls).toHaveLength(2);
  });

  it("routes errors to all consumers and replays last error to late subscribers", () => {
    const { transport, calls } = makeFakeTransport();
    const mgr = createSubscriptionManager(transport);
    const err = vi.fn();
    mgr.subscribe("v1.notification.badge", {}, { next: vi.fn(), error: err });
    const apiErr = { code: "INTERNAL_ERROR" as const, message: "boom" };
    calls[0].cb.error?.(apiErr);
    expect(err).toHaveBeenCalledWith(apiErr);

    const lateErr = vi.fn();
    mgr.subscribe("v1.notification.badge", {}, { next: vi.fn(), error: lateErr });
    expect(lateErr).toHaveBeenCalledWith(apiErr);
  });
});

describe("stableStringify", () => {
  it("is order-independent for object keys", () => {
    expect(stableStringify({ a: 1, b: 2 })).toBe(stableStringify({ b: 2, a: 1 }));
  });
  it("distinguishes different values", () => {
    expect(stableStringify({ sessionId: "a" })).not.toBe(stableStringify({ sessionId: "b" }));
  });
});
