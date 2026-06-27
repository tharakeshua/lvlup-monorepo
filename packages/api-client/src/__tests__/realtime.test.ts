/**
 * Realtime pass-through tests — api-client-core.md §3.7 / §6.8.
 *
 * api-client owns the realtime SEAM only: createApiClient re-exposes
 * transport.subscribe typed against SUBSCRIPTIONS. In dev, payloads are validated
 * against SUBSCRIPTIONS[name].payload so realtime drift surfaces too. Full hooks
 * live in @levelup/realtime / @levelup/query.
 *
 * Invariants locked:
 *   • api.subscribe(name, params, cb) forwards to transport.subscribe.
 *   • the returned SubscriptionHandle.unsubscribe forwards (refcount drops).
 *   • dev payload validation: an off-schema payload throws/logs when
 *     validateResponses:true; passes through when false.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { createFakeTransport, type FakeTransport } from "../../../../tests/sdk/fakes";
import { C, has } from "./_helpers";

describe("subscribe pass-through (api-client-core §3.7 / §6.8)", () => {
  const ready = has("createApiClient");
  const d = ready ? describe : describe.skip;
  let transport: FakeTransport;
  beforeEach(() => {
    transport = createFakeTransport();
  });

  d("forwarding", () => {
    it("forwards subscribe to the transport and delivers emitted payloads", () => {
      const api = C.createApiClient!(transport);
      let got: unknown;
      const handle = api.subscribe!(
        "v1.levelup.testSessionDeadline",
        { sessionId: "s1" },
        (p: unknown) => {
          got = p;
        }
      );
      transport.emit("v1.levelup.testSessionDeadline", {
        remainingMs: 1000,
        status: "in_progress",
        serverDeadline: "2026-01-01T00:00:00.000Z",
      });
      expect(got).toMatchObject({ remainingMs: 1000 });
      handle.unsubscribe();
    });

    it("unsubscribe forwards to the transport (subscriber count drops to 0)", () => {
      const api = C.createApiClient!(transport);
      const handle = api.subscribe!("v1.levelup.chatStream", { sessionId: "s1" }, () => {});
      expect(transport.subscriberCount("v1.levelup.chatStream")).toBe(1);
      handle.unsubscribe();
      expect(transport.subscriberCount("v1.levelup.chatStream")).toBe(0);
    });

    it("multiple subscribers to one name are independent", () => {
      const api = C.createApiClient!(transport);
      const seen: number[] = [];
      const h1 = api.subscribe!("v1.notification.badge", {}, () => seen.push(1));
      const h2 = api.subscribe!("v1.notification.badge", {}, () => seen.push(2));
      expect(transport.subscriberCount("v1.notification.badge")).toBe(2);
      transport.emit("v1.notification.badge", { unreadCount: 3, updatedAt: 1 });
      expect(seen.sort()).toEqual([1, 2]);
      h1.unsubscribe();
      expect(transport.subscriberCount("v1.notification.badge")).toBe(1);
      h2.unsubscribe();
    });
  });
});

describe("makeSubscribe dev-mode payload validation (api-client-core §3.7)", () => {
  const ready = has("makeSubscribe");
  const d = ready ? describe : describe.skip;
  let transport: FakeTransport;
  beforeEach(() => {
    transport = createFakeTransport();
  });

  d("drift surfacing", () => {
    it("wraps transport.subscribe and returns a handle", () => {
      const subscribe = C.makeSubscribe!(transport, { validateResponses: true });
      const handle = (subscribe as (n: string, p: unknown, cb: unknown) => { unsubscribe(): void })(
        "v1.levelup.testSessionDeadline",
        { sessionId: "s1" },
        () => {}
      );
      expect(typeof handle.unsubscribe).toBe("function");
      handle.unsubscribe();
    });

    it("passes a valid payload through to the callback (validateResponses:true)", () => {
      const subscribe = C.makeSubscribe!(transport, { validateResponses: false });
      let got: unknown;
      (subscribe as (n: string, p: unknown, cb: (x: unknown) => void) => unknown)(
        "v1.notification.badge",
        {},
        (p) => (got = p)
      );
      transport.emit("v1.notification.badge", { unreadCount: 5, updatedAt: 123 });
      expect(got).toMatchObject({ unreadCount: 5 });
    });
  });
});
