/**
 * `server-time-store.test.ts` — the dedupe + offset logic behind `useServerTime`
 * (transport-realtime layer §8 test #9, without a DOM renderer).
 *
 * Asserts: a single underlying `serverTimeOffset` subscription regardless of consumer count;
 * `getOffset()` tracks the latest emitted offset; last unsubscribe tears down; `now()` math
 * (`Date.now() + offsetMs`) is validated against the store offset.
 */
import { describe, it, expect, vi } from "vitest";
import { createServerTimeStore } from "../server-time-store.js";
import type { RealtimeTransport, SubscriptionHandle } from "../seam.js";

function makeFake() {
  const subs: Array<{ cb: (n: number) => void; unsub: ReturnType<typeof vi.fn> }> = [];
  const transport: Pick<RealtimeTransport, "serverTimeOffset"> = {
    serverTimeOffset: (cb: (n: number) => void): SubscriptionHandle => {
      const unsub = vi.fn();
      let active = true;
      subs.push({ cb, unsub });
      return {
        id: `st#${subs.length}`,
        get active() {
          return active;
        },
        unsubscribe() {
          active = false;
          unsub();
        },
      };
    },
  };
  return { transport, subs };
}

describe("createServerTimeStore", () => {
  it("opens ONE underlying subscription across multiple consumers", () => {
    const { transport, subs } = makeFake();
    const store = createServerTimeStore(transport);
    const off1 = store.subscribe(vi.fn());
    const off2 = store.subscribe(vi.fn());
    expect(subs).toHaveLength(1);
    off1();
    expect(subs[0].unsub).not.toHaveBeenCalled();
    off2();
    expect(subs[0].unsub).toHaveBeenCalledTimes(1);
  });

  it("tracks the latest emitted offset and fans out to all consumers", () => {
    const { transport, subs } = makeFake();
    const store = createServerTimeStore(transport);
    const a = vi.fn();
    const b = vi.fn();
    store.subscribe(a);
    store.subscribe(b);
    subs[0].cb(1234);
    expect(store.getOffset()).toBe(1234);
    expect(a).toHaveBeenCalledWith(1234);
    expect(b).toHaveBeenCalledWith(1234);
  });

  it("now() math: serverNow = Date.now() + offset", () => {
    const { transport, subs } = makeFake();
    const store = createServerTimeStore(transport);
    store.subscribe(vi.fn());
    subs[0].cb(5000);
    const fixed = 1_700_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(fixed);
    expect(Date.now() + store.getOffset()).toBe(fixed + 5000);
    vi.restoreAllMocks();
  });

  it("reopens after full teardown", () => {
    const { transport, subs } = makeFake();
    const store = createServerTimeStore(transport);
    const off = store.subscribe(vi.fn());
    off();
    store.subscribe(vi.fn());
    expect(subs).toHaveLength(2); // a fresh listener after teardown
  });
});
