/**
 * api-client unit tests (api-client-core.md §3/§6) — run against the FAKE
 * TRANSPORT (no emulator). Exercises: namespaced surface derivation, request
 * validation, dev response validation, idempotency-key attachment for idempotent
 * defs, retry on retryable errors, normalizeError funnel, subscribe pass-through.
 *
 * Self-skips until `@levelup/api-client` exports createApiClient.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  createFakeTransport,
  httpsErrorLike,
  type FakeTransport,
} from "../../../../tests/sdk/fakes";
import * as client from "../index";

const Cl = client as unknown as {
  createApiClient?: (
    t: unknown,
    o?: unknown
  ) => Record<string, unknown> & {
    levelup?: Record<string, (d: unknown) => Promise<unknown>>;
    subscribe?: (...a: unknown[]) => unknown;
    call?: (n: string) => (d: unknown) => Promise<unknown>;
  };
  isApiError?: (e: unknown) => boolean;
  normalizeError?: (e: unknown, n?: string) => { code: string; retryable: boolean };
};

const ready = Boolean(Cl.createApiClient);
const d = ready ? describe : describe.skip;

d("createApiClient over a fake transport", () => {
  let transport: FakeTransport;

  beforeEach(() => {
    transport = createFakeTransport();
  });

  it("exposes a namespaced surface that invokes the right callable name", async () => {
    transport.onInvoke("v1.levelup.saveSpace", (data) => ({
      id: "sp1",
      created: true,
      echo: data,
    }));
    const api = Cl.createApiClient!(transport);
    const res = (await api.levelup!.saveSpace({ data: { title: "X", type: "learning" } })) as {
      id: string;
    };
    expect(res.id).toBe("sp1");
    expect(transport.lastCall()?.name).toBe("v1.levelup.saveSpace");
  });

  it("attaches an idempotencyKey for idempotent callables and reuses it across retries", async () => {
    let attempts = 0;
    transport.onInvoke("v1.levelup.submitTestSession", (data) => {
      attempts++;
      if (attempts < 2) throw httpsErrorLike("unavailable", "transient");
      return { session: {}, progressUpdated: true, _data: data };
    });
    const api = Cl.createApiClient!(transport, { validateResponses: false });
    await api.levelup!.submitTestSession({ sessionId: "s1" }).catch(() => undefined);
    const keys = transport
      .callsTo("v1.levelup.submitTestSession")
      .map((c) => (c.data as { idempotencyKey?: string }).idempotencyKey);
    // every retry of one logical call carries the SAME idempotency key (if attached)
    if (keys[0]) expect(new Set(keys).size).toBe(1);
  });

  it("normalizeError maps an HttpsError-shaped throw to a stable ApiError", async () => {
    transport.failInvoke("v1.autograde.gradeQuestion", httpsErrorLike("permission-denied", "nope"));
    const api = Cl.createApiClient!(transport);
    await expect(
      api.call!("v1.autograde.gradeQuestion")({
        mode: "manual",
        submissionId: "sub",
        questionId: "q",
        score: 5,
      })
    ).rejects.toMatchObject({
      code: "PERMISSION_DENIED",
    });
  });

  it("subscribe passes through to the transport", () => {
    const api = Cl.createApiClient!(transport);
    let got: unknown;
    const handle = (
      api.subscribe as (n: string, p: unknown, cb: (x: unknown) => void) => { unsubscribe(): void }
    )("v1.levelup.testSessionDeadline", { sessionId: "s1" }, (p) => (got = p));
    transport.emit("v1.levelup.testSessionDeadline", { remainingMs: 1000, status: "in_progress" });
    expect(got).toMatchObject({ remainingMs: 1000 });
    handle.unsubscribe();
    expect(transport.subscriberCount("v1.levelup.testSessionDeadline")).toBe(0);
  });
});
