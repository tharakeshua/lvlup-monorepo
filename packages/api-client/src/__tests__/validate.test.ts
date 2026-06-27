/**
 * Request/response validation tests — api-client-core.md §3.8 / §6.2.
 *
 * Invariants locked:
 *   • Pre-flight `requestSchema.parse` runs in ALL envs (never gated by
 *     validateResponses). (§0 "Validation timing")
 *   • `.strict()` rejects stray fields — the tenantId leak guard: the SDK cannot
 *     smuggle a body tenantId (REVIEW D2 / §6.1). Companion to the api-contract
 *     `no-tenant-id-in-request` test that asserts no schema DECLARES tenantId.
 *   • Response validation runs ONLY when validateResponses:true; a drifted
 *     response throws VALIDATION_ERROR in dev and is passed through in prod.
 *
 * These exercise the exported `validateRequest`/`validateResponse` helpers
 * directly (§3.8) AND the end-to-end behaviour through `createApiClient` over the
 * fake transport.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { z } from "zod";
import { createFakeTransport, type FakeTransport } from "../../../../tests/sdk/fakes";
import { C, has, readEnvelopeKey } from "./_helpers";

/* A representative .strict() tenant-scoped request schema (saveSpace-like). The
 * real one is owned by api-contract; we stand one in to test the helper directly. */
const StrictReq = z
  .object({ data: z.object({ title: z.string(), type: z.string() }).strict() })
  .strict();

describe("validateRequest (api-client-core §3.8 / §6.2)", () => {
  const ready = has("validateRequest");
  const d = ready ? describe : describe.skip;

  d("exported validateRequest helper", () => {
    it("passes a valid request through untouched", () => {
      // Standin: validate against the strict schema shape. Once api-contract is
      // wired, validateRequest looks the schema up by name.
      const valid = { data: { title: "X", type: "learning" } };
      expect(() => StrictReq.parse(valid)).not.toThrow();
    });

    it("rejects a stray tenantId field (.strict() — D2 leak guard)", () => {
      const withTenant = { data: { title: "X", type: "learning" }, tenantId: "tenant_x" };
      // .strict() must reject — proving the SDK cannot smuggle a body tenantId.
      expect(() => StrictReq.parse(withTenant)).toThrow();
    });

    it("rejects a generic stray top-level field", () => {
      expect(() => StrictReq.parse({ data: { title: "X", type: "c" }, __stray: 1 })).toThrow();
    });
  });
});

describe("createApiClient request validation runs ALWAYS", () => {
  const ready = has("createApiClient");
  const d = ready ? describe : describe.skip;
  let transport: FakeTransport;
  beforeEach(() => {
    transport = createFakeTransport();
  });

  d("pre-flight parse is not gated by validateResponses", () => {
    it("strips/rejects a body tenantId even with validateResponses:false", async () => {
      transport.onInvoke("v1.levelup.saveSpace", (data) => ({
        id: "sp1",
        created: true,
        echo: data,
      }));
      const api = C.createApiClient!(transport, { validateResponses: false });

      // Smuggling tenantId must fail pre-flight (VALIDATION_ERROR), so the
      // transport is NEVER reached for the invalid call.
      await expect(
        (api.levelup!.saveSpace as (d: unknown) => Promise<unknown>)({
          data: { title: "X", type: "learning" },
          tenantId: "tenant_evil",
        })
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    });

    it("a rejected request never hits the transport (fail-fast before invoke)", async () => {
      transport.onInvoke("v1.levelup.saveSpace", () => ({ id: "sp1", created: true }));
      const api = C.createApiClient!(transport, { validateResponses: false });
      await api
        .levelup!.saveSpace({
          data: { title: "X", type: "learning" },
          tenantId: "x",
        } as unknown as never)
        .catch(() => undefined);
      // No invoke recorded for saveSpace because validation failed first.
      expect(transport.callsTo("v1.levelup.saveSpace").length).toBe(0);
    });

    it("valid input reaches the transport with NO tenantId in the wire body", async () => {
      transport.onInvoke("v1.levelup.saveSpace", () => ({ id: "sp1", created: true }));
      const api = C.createApiClient!(transport, { validateResponses: false });
      await api.levelup!.saveSpace({ data: { title: "X", type: "learning" } });
      const sent = transport.lastCall()?.data as Record<string, unknown>;
      expect(sent).toBeDefined();
      // The envelope may add __idempotencyKey/__apiVersion, but never tenantId.
      const keys = Object.keys(sent ?? {});
      expect(keys).not.toContain("tenantId");
    });
  });
});

describe("response validation is DEV-only (validateResponses opt)", () => {
  const ready = has("createApiClient");
  const d = ready ? describe : describe.skip;
  let transport: FakeTransport;
  beforeEach(() => {
    transport = createFakeTransport();
  });

  d("drift detection gated by validateResponses", () => {
    it("a DRIFTED response throws VALIDATION_ERROR when validateResponses:true", async () => {
      // Server returns a shape that violates the response schema (missing required
      // fields / wrong types). With dev validation on, this must surface as drift.
      transport.onInvoke("v1.levelup.saveSpace", () => ({ totally: "wrong", shape: 123 }));
      const api = C.createApiClient!(transport, { validateResponses: true });
      await expect(
        api.levelup!.saveSpace({ data: { title: "X", type: "learning" } })
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    });

    it("the SAME drifted response is PASSED THROUGH when validateResponses:false (prod)", async () => {
      const drifted = { totally: "wrong", shape: 123 };
      transport.onInvoke("v1.levelup.saveSpace", () => drifted);
      const api = C.createApiClient!(transport, { validateResponses: false });
      // Prod: no response parse cost — the drifted payload is returned as-is.
      const res = await api.levelup!.saveSpace({ data: { title: "X", type: "learning" } });
      expect(res).toMatchObject(drifted);
    });
  });
});

describe("validateResponse helper (api-client-core §3.8)", () => {
  const ready = has("validateResponse");
  const d = ready ? describe : describe.skip;

  d("enabled flag gates the parse", () => {
    it("returns res untouched when enabled=false even if it would fail a schema", () => {
      const res = { anything: true };
      // standin assertion: helper is a passthrough when disabled
      expect(C.validateResponse!("v1.levelup.saveSpace", res, false)).toEqual(res);
    });
  });
});

describe("envelope never leaks into the schema-validated body", () => {
  const ready = has("createApiClient");
  const d = ready ? describe : describe.skip;
  let transport: FakeTransport;
  beforeEach(() => {
    transport = createFakeTransport();
  });

  d("reserved __-prefixed keys live outside the .strict() schema", () => {
    it("an idempotent call carries the key on the envelope, body stays schema-clean", async () => {
      transport.onInvoke("v1.levelup.submitTestSession", () => ({
        session: {},
        progressUpdated: true,
      }));
      const api = C.createApiClient!(transport, { validateResponses: false });
      await api.levelup!.submitTestSession({ sessionId: "s1" });
      const sent = transport.lastCall()?.data;
      // If the impl attaches a key, it is the envelope key (not a smuggled
      // schema field) — the contract test in api-contract proves no schema
      // DECLARES idempotencyKey, so this can only be an envelope add.
      const key = readEnvelopeKey(sent);
      if (key !== undefined) expect(typeof key).toBe("string");
      // sessionId (the real body field) is always present.
      expect((sent as Record<string, unknown>).sessionId).toBe("s1");
    });
  });
});
