/**
 * Error-normalization tests — api-client-core.md §3.3 / §6.3.
 *
 * `normalizeError` is the SINGLE funnel: every thrown error becomes a stable
 * `ApiError {code, retryable, validationErrors?, meta?, cause?, callable?,
 * httpsCode?}`. Resolution order (api-client-core §3.3, NO firebase import):
 *   1. already ApiError → return as-is (attach callable if missing)        [idempotent]
 *   2. ZodError → VALIDATION_ERROR, validationErrors from issues, retryable:false
 *   3. {details:{code: AppErrorCode}} → use the typed envelope verbatim (server fail())
 *   4. {code:'functions/<x>'} firebase-style → HTTPS_TO_APP_ERROR map, httpsCode set
 *   5. TypeError/network/AbortError → NETWORK_ERROR, retryable:true
 *   6. anything else → UNKNOWN, retryable:false, cause preserved
 *
 * Retryability defaults come from DEFAULT_RETRYABLE (api-contract-core §4.1):
 *   RATE_LIMITED/CONFLICT/INTERNAL_ERROR → true; everything else → false.
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";
import { httpsErrorLike } from "../../../../tests/sdk/fakes";
import { C, has, type ApiErrorShape } from "./_helpers";

const ready = has("normalizeError");
const d = ready ? describe : describe.skip;

function makeZodError(): unknown {
  // a real ZodError instance (case 2) — instanceof ZodError must be detectable.
  const r = z.object({ a: z.string() }).safeParse({ a: 123 });
  return r.success ? new Error("unexpected") : r.error;
}

d("normalizeError resolution order (api-client-core §3.3)", () => {
  it("1. an existing ApiError is returned as-is; callable attached if missing", () => {
    const first = C.normalizeError!(httpsErrorLike("not-found", "gone"), undefined);
    const second = C.normalizeError!(first, "v1.levelup.getSpace");
    // idempotent: same code/retryable; callable now populated.
    expect(second.code).toBe(first.code);
    expect(second.retryable).toBe(first.retryable);
    expect(second.callable).toBe("v1.levelup.getSpace");
  });

  it("2. a ZodError → VALIDATION_ERROR with validationErrors[], retryable:false", () => {
    const err = C.normalizeError!(makeZodError(), "v1.levelup.saveSpace");
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.retryable).toBe(false);
    expect(Array.isArray(err.validationErrors)).toBe(true);
    expect((err.validationErrors ?? []).length).toBeGreaterThan(0);
    expect(err.validationErrors![0]).toHaveProperty("path");
    expect(err.validationErrors![0]).toHaveProperty("message");
  });

  it("3. a server fail() envelope {details:{code:'INVALID_TRANSITION'}} is preserved verbatim", () => {
    const serverErr = {
      code: "functions/failed-precondition",
      message: "bad state",
      details: { code: "INVALID_TRANSITION", message: "cannot publish from archived" },
    };
    const err = C.normalizeError!(serverErr, "v1.levelup.publishSpace");
    // typed AppErrorCode from details wins over the raw firebase code mapping.
    expect(err.code).toBe("INVALID_TRANSITION");
    expect(err.retryable).toBe(false); // DEFAULT_RETRYABLE[INVALID_TRANSITION]
  });

  it("3. each canonical server fail() code surfaces verbatim", () => {
    const cases: Array<[string, boolean]> = [
      ["QUOTA_EXCEEDED", false],
      ["PERMISSION_DENIED", false],
      ["TENANT_SUSPENDED", false],
      ["RATE_LIMITED", true],
      ["NOT_FOUND", false],
      ["FEATURE_DISABLED", false],
      ["IDEMPOTENCY_CONFLICT", true],
      ["CONFLICT", true],
    ];
    for (const [code, retryable] of cases) {
      const err = C.normalizeError!({
        details: { code, message: code },
        code: "functions/internal",
      });
      expect(err.code, `${code} preserved`).toBe(code);
      expect(err.retryable, `${code} retryable default`).toBe(retryable);
    }
  });

  it("4. a firebase-style {code:'functions/unavailable'} maps via HTTPS_TO_APP_ERROR, httpsCode set", () => {
    const err = C.normalizeError!(
      { code: "functions/unavailable", message: "down" },
      "v1.levelup.listSpaces"
    );
    // unavailable → INTERNAL_ERROR per HTTPS_TO_APP_ERROR (api-contract-core §4.3).
    expect(err.code).toBe("INTERNAL_ERROR");
    expect(err.httpsCode).toMatch(/unavailable/);
  });

  it("4. 'functions/permission-denied' → PERMISSION_DENIED (non-retryable)", () => {
    const err = C.normalizeError!(httpsErrorLike("permission-denied", "nope"));
    expect(err.code).toBe("PERMISSION_DENIED");
    expect(err.retryable).toBe(false);
  });

  it("4. 'functions/resource-exhausted' → RATE_LIMITED (retryable)", () => {
    const err = C.normalizeError!(httpsErrorLike("resource-exhausted", "slow down"));
    expect(err.code).toBe("RATE_LIMITED");
    expect(err.retryable).toBe(true);
  });

  it("5. a TypeError / network failure → NETWORK_ERROR, retryable:true", () => {
    const err = C.normalizeError!(new TypeError("Failed to fetch"));
    expect(err.code).toBe("NETWORK_ERROR");
    expect(err.retryable).toBe(true);
  });

  it("5. an AbortError → NETWORK_ERROR, retryable:true", () => {
    const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
    const err = C.normalizeError!(abort);
    expect(err.code).toBe("NETWORK_ERROR");
    expect(err.retryable).toBe(true);
  });

  it("6. an unknown throw → UNKNOWN, retryable:false, cause preserved", () => {
    const weird = { not: "an error" };
    const err = C.normalizeError!(weird, "v1.analytics.getSummary");
    expect(err.code).toBe("UNKNOWN");
    expect(err.retryable).toBe(false);
    expect(err.cause).toBe(weird);
    expect(err.callable).toBe("v1.analytics.getSummary");
  });

  it("normalizeError is idempotent (normalize(normalize(e)) === stable)", () => {
    const once = C.normalizeError!(httpsErrorLike("aborted", "conflict"), "v1.levelup.saveSpace");
    const twice = C.normalizeError!(once);
    expect(twice.code).toBe(once.code);
    expect(twice.retryable).toBe(once.retryable);
    expect(twice.validationErrors).toEqual(once.validationErrors);
  });
});

describe("isApiError type guard (api-client-core §3.3)", () => {
  const r = has("isApiError") && has("normalizeError");
  const d2 = r ? describe : describe.skip;
  d2("true/false matrix", () => {
    it("true for a normalized ApiError", () => {
      const err = C.normalizeError!(new Error("x"));
      expect(C.isApiError!(err)).toBe(true);
    });
    it("false for a plain Error / object / undefined", () => {
      expect(C.isApiError!(new Error("plain"))).toBe(false);
      expect(C.isApiError!({ code: "NOT_FOUND" })).toBe(false);
      expect(C.isApiError!(undefined)).toBe(false);
      expect(C.isApiError!(null)).toBe(false);
    });
  });
});

describe("fromZodError builds VALIDATION_ERROR (api-client-core §3.3)", () => {
  const d3 = has("fromZodError") ? describe : describe.skip;
  d3("issues → validationErrors", () => {
    it("maps zod issues to {path,message}[] and is non-retryable", () => {
      const ze = makeZodError();
      const err = C.fromZodError!(ze, "v1.levelup.saveItem");
      expect(err.code).toBe("VALIDATION_ERROR");
      expect(err.retryable).toBe(false);
      expect((err.validationErrors ?? []).length).toBeGreaterThan(0);
      expect(err.callable).toBe("v1.levelup.saveItem");
    });
  });
});

describe("ApiError.toJSON surfaces the stable details shape (api-client-core §3.3)", () => {
  const d4 = has("normalizeError") ? describe : describe.skip;
  d4("serialization", () => {
    it("toJSON returns {code,message,...,callable?}", () => {
      const err: ApiErrorShape = C.normalizeError!(
        httpsErrorLike("not-found", "gone"),
        "v1.levelup.getSpace"
      );
      if (typeof err.toJSON === "function") {
        const json = err.toJSON() as Record<string, unknown>;
        expect(json.code).toBe("NOT_FOUND");
        expect(json).toHaveProperty("message");
      }
    });
  });
});
