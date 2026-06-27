/**
 * `shape.test.ts` — the future stub is typed and inert (transport-realtime §5).
 *
 * Asserts: (1) `createHttpTransport` returns an object satisfying the `Transport` shape,
 * (2) `invoke` rejects (not implemented), (3) `subscribe`/`serverTimeOffset` return an
 * idempotently-unsubscribable handle, (4) `callableToHttpPath` maps dotted names to REST paths.
 */
import { describe, it, expect, vi } from "vitest";
import { createHttpTransport } from "../create-http-transport.js";
import { callableToHttpPath, invokeViaHttp } from "../invoke/invoke-via-http.js";

const opts = {
  baseUrl: "https://api.example.test",
  getBearerToken: vi.fn(async () => "token"),
};

describe("@levelup/transport-http (future stub)", () => {
  it("createHttpTransport returns a Transport-shaped object", () => {
    const t = createHttpTransport(opts);
    expect(typeof t.invoke).toBe("function");
    expect(typeof t.subscribe).toBe("function");
    expect(typeof t.serverTimeOffset).toBe("function");
    expect(typeof t.refreshToken).toBe("function");
  });

  it("invoke rejects as not-implemented in v1", async () => {
    const t = createHttpTransport(opts);
    await expect(t.invoke("v1.identity.getMe", {})).rejects.toThrow(/future stub/i);
    await expect(invokeViaHttp(opts, "v1.identity.getMe", {})).rejects.toThrow(/future stub/i);
  });

  it("subscribe returns an idempotently-unsubscribable handle", () => {
    const t = createHttpTransport(opts);
    const h = t.subscribe("v1.notification.badge", {}, () => {});
    expect(h.active).toBe(true);
    h.unsubscribe();
    expect(h.active).toBe(false);
    expect(() => h.unsubscribe()).not.toThrow();
  });

  it("serverTimeOffset returns a handle and refreshToken resolves", async () => {
    const t = createHttpTransport(opts);
    const h = t.serverTimeOffset(() => {});
    expect(h.active).toBe(true);
    await expect(t.refreshToken()).resolves.toBeUndefined();
  });

  it("callableToHttpPath maps dotted names to REST paths", () => {
    expect(callableToHttpPath("v1.identity.getMe")).toBe("v1/identity/getMe");
  });
});
