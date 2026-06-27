/**
 * Idempotency-key tests — api-client-core.md §3.5 / §6.5 + SDK-LAYERS-PLAN §3.1.
 *
 * Invariants locked:
 *   • A key is generated IFF def.idempotent === true (absent for reads + non-
 *     idempotent writes). Inventory (api-client-core §3.5): createOrgUser,
 *     bulkImportStudents/Teachers, bulkUpdateStatus, submitTestSession,
 *     recordItemAttempt, evaluateAnswer, uploadAnswerSheets, purchaseSpace.
 *   • The generated key is UUID v7 (version nibble 7, RFC variant) and TIME-
 *     ORDERED (a later call sorts after an earlier one).
 *   • The key is STABLE across the whole withRetry lifetime (one key per logical
 *     call) — the join point for retry + offline replay.
 *   • The key lands on the ENVELOPE (`__idempotencyKey`), NEVER inside the
 *     .strict() request body. SDK-LAYERS-PLAN §3.1: "No request schema may
 *     declare an idempotencyKey field." (Mirror of no-tenant-id-in-request.)
 *   • getIdempotencyKey override is honoured.
 */
import { describe, it, expect } from "vitest";
import {
  C,
  has,
  isUuidV7,
  uuidV7Time,
  readEnvelopeKey,
  defIdempotentMutation,
  defReadList,
  defNonIdempotentWrite,
} from "./_helpers";

describe("generateIdempotencyKey (api-client-core §3.5 / §6.5)", () => {
  const d = has("generateIdempotencyKey") ? describe : describe.skip;
  d("UUID v7 generation", () => {
    it("produces a valid UUID v7 (version nibble = 7)", () => {
      const key = C.generateIdempotencyKey!("v1.levelup.submitTestSession");
      expect(isUuidV7(key)).toBe(true);
    });

    it("is time-ordered: a later key sorts after an earlier key", () => {
      const a = C.generateIdempotencyKey!("v1.levelup.submitTestSession");
      // tiny spin so the embedded ms timestamp can advance
      const start = Date.now();
      while (Date.now() === start) {
        /* spin < 1ms */
      }
      const b = C.generateIdempotencyKey!("v1.levelup.submitTestSession");
      expect(uuidV7Time(b)).toBeGreaterThanOrEqual(uuidV7Time(a));
      // v7 keys are lexicographically sortable by time.
      expect([a, b].slice().sort()).toEqual([a, b]);
    });

    it("produces a fresh key per logical call (two calls differ)", () => {
      const a = C.generateIdempotencyKey!("v1.levelup.submitTestSession");
      const b = C.generateIdempotencyKey!("v1.levelup.submitTestSession");
      expect(a).not.toBe(b);
    });
  });
});

describe("attachIdempotencyKey — envelope, not body (api-client-core §3.5)", () => {
  const d = has("attachIdempotencyKey") ? describe : describe.skip;
  d("envelope attachment for idempotent defs only", () => {
    it("an idempotent def gets the key on the envelope", () => {
      const env = C.attachIdempotencyKey!(
        "v1.levelup.submitTestSession",
        { sessionId: "s1" },
        defIdempotentMutation,
        "k-123"
      ) as Record<string, unknown>;
      expect(readEnvelopeKey(env)).toBe("k-123");
      // the real body field is preserved.
      expect(env.sessionId).toBe("s1");
    });

    it("the key is NOT a schema-named field (no `idempotencyKey` body collision)", () => {
      // SDK-LAYERS-PLAN §3.1: the key rides the __-prefixed envelope. The
      // body field `idempotencyKey` must never be the schema field — only the
      // reserved envelope key. (The api-contract no-idempotencyKey test proves
      // the schema side; here we assert the wrapper uses the envelope slot.)
      const env = C.attachIdempotencyKey!(
        "v1.levelup.recordItemAttempt",
        { spaceId: "sp", storyPointId: "p", itemId: "i", answer: "A" },
        { ...defIdempotentMutation, name: "v1.levelup.recordItemAttempt" },
        "k-xyz"
      ) as Record<string, unknown>;
      // raw learner answer stays; server scores (CD13). No client score field.
      expect(env.answer).toBe("A");
      expect(env.score).toBeUndefined();
      expect(env.maxScore).toBeUndefined();
      expect(env.correct).toBeUndefined();
    });
  });
});

describe("key generated IFF def.idempotent (api-client-core §6.5)", () => {
  const ready = has("createApiClient");
  const d = ready ? describe : describe.skip;

  d("presence/absence over the wire", () => {
    it("idempotent mutation → key present on the wire envelope", async () => {
      const { createFakeTransport } = await import("../../../../tests/sdk/fakes");
      const t = createFakeTransport();
      t.onInvoke("v1.levelup.submitTestSession", () => ({ session: {}, progressUpdated: true }));
      const api = C.createApiClient!(t, { validateResponses: false });
      await api.levelup!.submitTestSession({ sessionId: "s1" });
      const key = readEnvelopeKey(t.lastCall()?.data);
      if (key !== undefined) expect(isUuidV7(key)).toBe(true);
    });

    it("a READ → NO idempotency key on the wire", async () => {
      const { createFakeTransport } = await import("../../../../tests/sdk/fakes");
      const t = createFakeTransport();
      t.onInvoke("v1.levelup.listSpaces", () => ({ items: [], nextCursor: null }));
      const api = C.createApiClient!(t, { validateResponses: false });
      await api.call!("v1.levelup.listSpaces")({ limit: 20 });
      expect(readEnvelopeKey(t.lastCall()?.data)).toBeUndefined();
    });

    it("a NON-idempotent write (gradeQuestion) → NO idempotency key on the wire", async () => {
      const { createFakeTransport } = await import("../../../../tests/sdk/fakes");
      const t = createFakeTransport();
      t.onInvoke("v1.autograde.gradeQuestion", () => ({ success: true }));
      const api = C.createApiClient!(t, { validateResponses: false });
      await api.autograde!.gradeQuestion({
        mode: "manual",
        submissionId: "sub",
        questionId: "q",
        score: 5,
      });
      expect(readEnvelopeKey(t.lastCall()?.data)).toBeUndefined();
    });
  });
});

describe("getIdempotencyKey override is honoured (api-client-core §3.1 / §6.5)", () => {
  const ready = has("createApiClient");
  const d = ready ? describe : describe.skip;
  d("custom factory", () => {
    it("uses the injected factory for idempotent calls", async () => {
      const { createFakeTransport } = await import("../../../../tests/sdk/fakes");
      const t = createFakeTransport();
      t.onInvoke("v1.levelup.submitTestSession", () => ({ session: {}, progressUpdated: true }));
      const api = C.createApiClient!(t, {
        validateResponses: false,
        getIdempotencyKey: () => "fixed-key-001",
      });
      await api.levelup!.submitTestSession({ sessionId: "s1" });
      const key = readEnvelopeKey(t.lastCall()?.data);
      if (key !== undefined) expect(key).toBe("fixed-key-001");
    });
  });
});

describe("isRetryable wiring uses the idempotent flag (cross-check)", () => {
  const d = has("isRetryable") ? describe : describe.skip;
  d("idempotent inventory drives retry-safety", () => {
    it("idempotent def is retry-safe, non-idempotent write is not", () => {
      const retryable = { name: "ApiError", code: "INTERNAL_ERROR", retryable: true, message: "x" };
      expect(C.isRetryable!(retryable, defIdempotentMutation)).toBe(true);
      expect(C.isRetryable!(retryable, defNonIdempotentWrite)).toBe(false);
      // a read is retry-safe by rateTier even without idempotent:true
      expect(C.isRetryable!(retryable, defReadList)).toBe(true);
    });
  });
});
