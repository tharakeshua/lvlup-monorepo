import { describe, expect, it } from "vitest";
import { HttpsError } from "firebase-functions/v2/https";
import { mapError } from "./map-error.js";

function aiGatewayError(
  code: string,
  message: string,
  opts: { retryable?: boolean; meta?: Record<string, unknown> } = {}
) {
  return Object.assign(new Error(message), {
    name: "AiGatewayError",
    code,
    retryable: opts.retryable,
    meta: opts.meta,
  });
}

describe("mapError — AiGatewayError", () => {
  it("maps FEATURE_DISABLED without degrading to generic INTERNAL", () => {
    const err = aiGatewayError(
      "FEATURE_DISABLED",
      "No tenant or platform Gemini key is provisioned"
    );
    const mapped = mapError(err);
    expect(mapped).toBeInstanceOf(HttpsError);
    expect(mapped.message).toBe("No tenant or platform Gemini key is provisioned");
    expect((mapped.details as { code?: string }).code).toBe("FEATURE_DISABLED");
  });

  it("maps provider failures with the original message", () => {
    const err = aiGatewayError("INTERNAL_ERROR", "Failed to access the tenant Gemini key", {
      retryable: true,
      meta: { tenantId: "tn_x" },
    });
    const mapped = mapError(err);
    expect(mapped.message).toBe("Failed to access the tenant Gemini key");
    expect((mapped.details as { code?: string }).code).toBe("INTERNAL_ERROR");
    expect((mapped.details as { retryable?: boolean }).retryable).toBe(true);
  });
});
