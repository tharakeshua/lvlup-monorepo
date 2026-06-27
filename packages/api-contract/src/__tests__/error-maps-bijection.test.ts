/**
 * error-maps-bijection (SDK-LAYERS-PLAN.md §3.4 / api-contract-core.md §4 + §10.3).
 *
 * Locks the error model (the vocabulary both `fail()` (server) and
 * `normalizeError()` (client) import):
 *   • AppErrorCode has the 14 frozen members; APP_ERROR_CODES mirrors the union.
 *   • APP_ERROR_TO_HTTPS, HTTPS_TO_APP_ERROR, ERROR_MESSAGES,
 *     ERROR_RECOVERY_HINTS, DEFAULT_RETRYABLE are each TOTAL over their key set
 *     (no missing, no extra).
 *   • APP_ERROR_TO_HTTPS values ∈ FunctionsErrorCode; HTTPS_TO_APP_ERROR values
 *     ∈ APP_ERROR_CODES.
 *   • Round-trip soundness for the canonical codes; documented many→one
 *     non-bijection for the rest (asserted to NOT round-trip — the asymmetry is a
 *     tested contract, not an accident).
 *   • ApiErrorDetailsSchema parses a representative payload and rejects a stray key.
 *   • IDEMPOTENCY_CONFLICT is retryable (transient lease — §3.4).
 *
 * Self-skips per export until the contract surfaces each piece.
 */
import { describe, it, expect } from "vitest";
import * as contract from "../index";

const C = contract as unknown as {
  APP_ERROR_CODES?: readonly string[];
  DEFAULT_RETRYABLE?: Record<string, boolean>;
  APP_ERROR_TO_HTTPS?: Record<string, string>;
  HTTPS_TO_APP_ERROR?: Record<string, string>;
  ERROR_MESSAGES?: Record<string, string>;
  ERROR_RECOVERY_HINTS?: Record<string, string | null>;
  ApiErrorDetailsSchema?: { safeParse: (x: unknown) => { success: boolean } };
  isApiErrorDetails?: (x: unknown) => boolean;
};

/** The 14 frozen AppErrorCode members (§3.4). */
const EXPECTED_CODES = [
  "VALIDATION_ERROR",
  "INVALID_TRANSITION",
  "NOT_FOUND",
  "PERMISSION_DENIED",
  "UNAUTHENTICATED",
  "RATE_LIMITED",
  "QUOTA_EXCEEDED",
  "FEATURE_DISABLED",
  "TENANT_SUSPENDED",
  "CONFLICT",
  "PRECONDITION_FAILED",
  "IDEMPOTENCY_CONFLICT",
  "PAYMENT_FAILED",
  "INTERNAL_ERROR",
];

/** The 17 FunctionsErrorCode members (mirrors functions.https.FunctionsErrorCode). */
const FUNCTIONS_ERROR_CODES = [
  "ok",
  "cancelled",
  "unknown",
  "invalid-argument",
  "deadline-exceeded",
  "not-found",
  "already-exists",
  "permission-denied",
  "resource-exhausted",
  "failed-precondition",
  "aborted",
  "out-of-range",
  "unimplemented",
  "internal",
  "unavailable",
  "data-loss",
  "unauthenticated",
];

/** Canonical codes that MUST round-trip APP→HTTPS→APP (§10.3 d). */
const CANONICAL_ROUNDTRIP = [
  "VALIDATION_ERROR",
  "NOT_FOUND",
  "PERMISSION_DENIED",
  "UNAUTHENTICATED",
  "RATE_LIMITED",
  "CONFLICT",
];

const ready = Boolean(C.APP_ERROR_CODES);
const d = ready ? describe : describe.skip;

d("AppErrorCode — frozen 14-member set (§3.4)", () => {
  it("APP_ERROR_CODES === the 14 frozen members", () => {
    expect([...C.APP_ERROR_CODES!].sort()).toEqual([...EXPECTED_CODES].sort());
  });

  it("has exactly 14 codes (no drift in count)", () => {
    expect(C.APP_ERROR_CODES!.length).toBe(14);
  });

  it("has no duplicate codes", () => {
    expect(new Set(C.APP_ERROR_CODES!).size).toBe(C.APP_ERROR_CODES!.length);
  });
});

(C.APP_ERROR_TO_HTTPS ? describe : describe.skip)(
  "APP_ERROR_TO_HTTPS — total + valid (§10.3 a,b)",
  () => {
    const map = C.APP_ERROR_TO_HTTPS!;
    const fn = new Set(FUNCTIONS_ERROR_CODES);

    it("has EXACTLY the AppErrorCode key set", () => {
      expect(Object.keys(map).sort()).toEqual([...EXPECTED_CODES].sort());
    });

    it("every value is a valid FunctionsErrorCode", () => {
      const bad = Object.entries(map).filter(([, v]) => !fn.has(v));
      expect(
        bad,
        `non-FunctionsErrorCode values:\n${bad.map(([k, v]) => `${k}→${v}`).join("\n")}`
      ).toEqual([]);
    });

    it("maps the spine codes to their frozen HTTPS codes", () => {
      expect(map["VALIDATION_ERROR"]).toBe("invalid-argument");
      expect(map["NOT_FOUND"]).toBe("not-found");
      expect(map["PERMISSION_DENIED"]).toBe("permission-denied");
      expect(map["UNAUTHENTICATED"]).toBe("unauthenticated");
      expect(map["RATE_LIMITED"]).toBe("resource-exhausted");
      expect(map["CONFLICT"]).toBe("already-exists");
      expect(map["IDEMPOTENCY_CONFLICT"]).toBe("already-exists");
      expect(map["INVALID_TRANSITION"]).toBe("failed-precondition");
      expect(map["INTERNAL_ERROR"]).toBe("internal");
    });
  }
);

(C.HTTPS_TO_APP_ERROR ? describe : describe.skip)(
  "HTTPS_TO_APP_ERROR — total + valid (§10.3 a,c)",
  () => {
    const map = C.HTTPS_TO_APP_ERROR!;
    const app = new Set(EXPECTED_CODES);

    it("has EXACTLY the FunctionsErrorCode key set", () => {
      expect(Object.keys(map).sort()).toEqual([...FUNCTIONS_ERROR_CODES].sort());
    });

    it("every value ∈ APP_ERROR_CODES", () => {
      const bad = Object.entries(map).filter(([, v]) => !app.has(v));
      expect(
        bad,
        `non-AppErrorCode values:\n${bad.map(([k, v]) => `${k}→${v}`).join("\n")}`
      ).toEqual([]);
    });

    it("maps unauthenticated→UNAUTHENTICATED and not-found→NOT_FOUND", () => {
      expect(map["unauthenticated"]).toBe("UNAUTHENTICATED");
      expect(map["not-found"]).toBe("NOT_FOUND");
      expect(map["permission-denied"]).toBe("PERMISSION_DENIED");
    });
  }
);

(C.APP_ERROR_TO_HTTPS && C.HTTPS_TO_APP_ERROR ? describe : describe.skip)(
  "round-trip soundness + documented asymmetry (§10.3 d,e)",
  () => {
    const toHttps = C.APP_ERROR_TO_HTTPS!;
    const fromHttps = C.HTTPS_TO_APP_ERROR!;

    it("canonical codes round-trip APP→HTTPS→APP", () => {
      const fails: string[] = [];
      for (const code of CANONICAL_ROUNDTRIP) {
        const rt = fromHttps[toHttps[code]];
        if (rt !== code) fails.push(`${code} → ${toHttps[code]} → ${rt}`);
      }
      expect(fails, `broken round-trips:\n${fails.join("\n")}`).toEqual([]);
    });

    it("the asymmetry is real: at least one code does NOT round-trip (many→one)", () => {
      // e.g. QUOTA_EXCEEDED→resource-exhausted→RATE_LIMITED (collapses), and
      // PRECONDITION_FAILED/FEATURE_DISABLED/TENANT_SUSPENDED all → failed-precondition.
      const nonRoundtrips = EXPECTED_CODES.filter((code) => fromHttps[toHttps[code]] !== code);
      expect(nonRoundtrips.length, "expected a documented many→one collapse").toBeGreaterThan(0);
    });

    it("QUOTA_EXCEEDED collapses with RATE_LIMITED on the reverse map", () => {
      // both forward-map to resource-exhausted; reverse picks RATE_LIMITED.
      expect(toHttps["QUOTA_EXCEEDED"]).toBe("resource-exhausted");
      expect(fromHttps["resource-exhausted"]).toBe("RATE_LIMITED");
    });
  }
);

(C.DEFAULT_RETRYABLE ? describe : describe.skip)(
  "DEFAULT_RETRYABLE — total + correct retryability (§3.4)",
  () => {
    const map = C.DEFAULT_RETRYABLE!;

    it("has EXACTLY the AppErrorCode key set", () => {
      expect(Object.keys(map).sort()).toEqual([...EXPECTED_CODES].sort());
    });

    it("every value is a boolean", () => {
      for (const [k, v] of Object.entries(map)) expect(typeof v, `${k}`).toBe("boolean");
    });

    it("RATE_LIMITED, CONFLICT, INTERNAL_ERROR are retryable", () => {
      expect(map["RATE_LIMITED"]).toBe(true);
      expect(map["CONFLICT"]).toBe(true);
      expect(map["INTERNAL_ERROR"]).toBe(true);
    });

    it("IDEMPOTENCY_CONFLICT is wired as retryable (transient in-flight lease — §3.4)", () => {
      // The plan wires IDEMPOTENCY_CONFLICT into DEFAULT_RETRYABLE as retryable: a
      // transient lease that the client retries. (api-contract-core.md §4.1 shows it
      // false; SDK-LAYERS-PLAN §3.4 overrides to retryable. The frozen master plan
      // wins — assert retryable.)
      expect(map["IDEMPOTENCY_CONFLICT"]).toBe(true);
    });

    it("VALIDATION_ERROR / PERMISSION_DENIED / NOT_FOUND are NOT retryable", () => {
      expect(map["VALIDATION_ERROR"]).toBe(false);
      expect(map["PERMISSION_DENIED"]).toBe(false);
      expect(map["NOT_FOUND"]).toBe(false);
    });
  }
);

(C.ERROR_MESSAGES ? describe : describe.skip)(
  "ERROR_MESSAGES — total + non-empty (§4.4 / §10.3 a)",
  () => {
    const map = C.ERROR_MESSAGES!;
    it("has EXACTLY the AppErrorCode key set", () => {
      expect(Object.keys(map).sort()).toEqual([...EXPECTED_CODES].sort());
    });
    it("every message is a non-empty string", () => {
      for (const [k, v] of Object.entries(map)) {
        expect(typeof v, `${k}`).toBe("string");
        expect(v.length, `${k} empty`).toBeGreaterThan(0);
      }
    });
  }
);

(C.ERROR_RECOVERY_HINTS ? describe : describe.skip)(
  "ERROR_RECOVERY_HINTS — total (§4.4 / §10.3 a)",
  () => {
    const map = C.ERROR_RECOVERY_HINTS!;
    it("has EXACTLY the AppErrorCode key set", () => {
      expect(Object.keys(map).sort()).toEqual([...EXPECTED_CODES].sort());
    });
    it("every hint is a string or null", () => {
      for (const [k, v] of Object.entries(map)) {
        expect(v === null || typeof v === "string", `${k}`).toBe(true);
      }
    });
  }
);

(C.ApiErrorDetailsSchema ? describe : describe.skip)(
  "ApiErrorDetailsSchema — parse + strict (§10.3 f)",
  () => {
    const schema = C.ApiErrorDetailsSchema!;

    it("accepts a representative ApiErrorDetails", () => {
      const ok = schema.safeParse({
        code: "VALIDATION_ERROR",
        message: "The request contains invalid data.",
        validationErrors: [{ path: "data.title", message: "Required" }],
        retryable: false,
        meta: { resource: "space" },
      });
      expect(ok.success).toBe(true);
    });

    it("accepts the minimal { code, message }", () => {
      expect(schema.safeParse({ code: "NOT_FOUND", message: "gone" }).success).toBe(true);
    });

    it("rejects an unknown AppErrorCode", () => {
      expect(schema.safeParse({ code: "NOPE", message: "x" }).success).toBe(false);
    });

    it("rejects a missing message", () => {
      expect(schema.safeParse({ code: "NOT_FOUND" }).success).toBe(false);
    });

    it("is .strict() — rejects a stray key", () => {
      expect(schema.safeParse({ code: "NOT_FOUND", message: "x", stray: 1 }).success).toBe(false);
    });
  }
);

(C.isApiErrorDetails ? describe : describe.skip)("isApiErrorDetails — type guard", () => {
  const guard = C.isApiErrorDetails!;
  it("returns true for a valid payload", () => {
    expect(guard({ code: "INTERNAL_ERROR", message: "oops" })).toBe(true);
  });
  it("returns false for a non-object / malformed payload", () => {
    expect(guard(null)).toBe(false);
    expect(guard({ code: "BOGUS" })).toBe(false);
    expect(guard("string")).toBe(false);
  });
});
