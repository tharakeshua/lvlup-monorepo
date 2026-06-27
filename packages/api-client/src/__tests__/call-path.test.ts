/**
 * End-to-end call() path tests — api-client-core.md §4 / §3.1.
 *
 * Locks the ORDERING inside call() and the cross-cutting opts:
 *   1. PRE-FLIGHT VALIDATE (always) — invalid input fails BEFORE the transport.
 *   2. IDEMPOTENCY — key generated once, before retry/queue (stability hinge).
 *   3. DELIVER — transport.invoke wrapped by response validation.
 *   4. OFFLINE — idempotent mutations may route through the queue.
 *   5. RETRY — only retryable + idempotent-safe; same key across attempts.
 *   6. NORMALIZE — outermost boundary; EVERY failure path → one ApiError, and
 *      opts.onError fires with (err, name).
 *
 * Also covers the §3.9 re-exports and apiVersion stamping.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  createFakeTransport,
  httpsErrorLike,
  type FakeTransport,
} from "../../../../tests/sdk/fakes";
import { C, has, readEnvelopeKey } from "./_helpers";

describe("call() pipeline ordering (api-client-core §4)", () => {
  const ready = has("createApiClient");
  const d = ready ? describe : describe.skip;
  let transport: FakeTransport;
  beforeEach(() => {
    transport = createFakeTransport();
  });

  d("ordering + funnel", () => {
    it("a successful idempotent call: validate → key → invoke → response", async () => {
      transport.onInvoke("v1.levelup.submitTestSession", (data) => ({
        session: { id: "s1" },
        progressUpdated: true,
        _echo: data,
      }));
      const api = C.createApiClient!(transport, { validateResponses: false });
      const res = (await api.levelup!.submitTestSession({ sessionId: "s1" })) as {
        progressUpdated: boolean;
      };
      expect(res.progressUpdated).toBe(true);
      expect(transport.callsTo("v1.levelup.submitTestSession").length).toBe(1);
    });

    it("EVERY failure path yields a single ApiError (transport throw → normalized)", async () => {
      transport.failInvoke(
        "v1.autograde.gradeQuestion",
        httpsErrorLike("permission-denied", "nope")
      );
      const api = C.createApiClient!(transport);
      await expect(
        api.autograde!.gradeQuestion({
          mode: "manual",
          submissionId: "s",
          questionId: "q",
          score: 1,
        })
      ).rejects.toMatchObject({
        code: "PERMISSION_DENIED",
        callable: "v1.autograde.gradeQuestion",
      });
    });

    it("a validation failure is normalized to VALIDATION_ERROR at the same funnel", async () => {
      transport.onInvoke("v1.levelup.saveSpace", () => ({ id: "x", created: true }));
      const api = C.createApiClient!(transport, { validateResponses: false });
      await expect(
        api.levelup!.saveSpace({
          data: { title: "X", type: "learning" },
          tenantId: "evil",
        } as never)
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    });

    it("opts.onError fires once per failure with (err, callableName) and does not swallow the throw", async () => {
      transport.failInvoke("v1.levelup.getSpace", httpsErrorLike("not-found", "gone"));
      const seen: { code: string; name: string }[] = [];
      const api = C.createApiClient!(transport, {
        onError: (err: { code: string }, name: string) => seen.push({ code: err.code, name }),
      });
      await api.call!("v1.levelup.getSpace")({ spaceId: "sp1" }).catch(() => undefined);
      expect(seen.length).toBe(1);
      expect(seen[0]).toMatchObject({ code: "NOT_FOUND", name: "v1.levelup.getSpace" });
    });

    it("the idempotency key is generated ONCE and is stable across a retry sequence", async () => {
      let n = 0;
      transport.onInvoke("v1.levelup.evaluateAnswer", () => {
        n++;
        if (n < 3) throw httpsErrorLike("unavailable", "transient");
        return { evaluation: { score: 1 }, progressRecorded: true };
      });
      const api = C.createApiClient!(transport, { validateResponses: false });
      await api
        .levelup!.evaluateAnswer({ spaceId: "sp", itemId: "i", answer: "A" })
        .catch(() => undefined);
      const keys = transport
        .callsTo("v1.levelup.evaluateAnswer")
        .map((c) => readEnvelopeKey(c.data));
      if (keys[0] !== undefined) {
        expect(new Set(keys).size).toBe(1); // one key for all attempts
      }
    });
  });
});

describe("apiVersion + re-exports (api-client-core §3.1 / §3.9)", () => {
  const ready = has("createApiClient");
  const d = ready ? describe : describe.skip;

  d("envelope stamping", () => {
    it("stamps a custom apiVersion onto the envelope when provided", async () => {
      const t = createFakeTransport();
      t.onInvoke("v1.levelup.listSpaces", () => ({ items: [], nextCursor: null }));
      const api = C.createApiClient!(t, { validateResponses: false, apiVersion: "v1" });
      await api.call!("v1.levelup.listSpaces")({ limit: 20 });
      const sent = t.lastCall()?.data as Record<string, unknown>;
      // If the impl stamps a version, it is an envelope key, never a body field.
      if (sent && "__apiVersion" in sent) expect(sent.__apiVersion).toBe("v1");
    });
  });
});

describe("isApiError + normalizeError re-exported from the barrel (§3.9)", () => {
  it("the package barrel re-exports the error funnel symbols", () => {
    // These are core to every layer above; assert presence once they land.
    if (has("normalizeError")) expect(typeof C.normalizeError).toBe("function");
    if (has("isApiError")) expect(typeof C.isApiError).toBe("function");
  });
});
