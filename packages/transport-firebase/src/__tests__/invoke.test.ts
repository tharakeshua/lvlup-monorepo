/**
 * invoke unit tests (transport-realtime.md §8.2 — emulator-free variant).
 *
 * Mocks `firebase/functions` so we can assert the thin-carrier invariants without
 * an emulator:
 *   • `invokeViaCallable` forwards `data` UNCHANGED (no tenantId added, no reshape).
 *   • returns `result.data` as `ResOf<N>`.
 *   • rethrows a thrown HttpsError-shaped error UNCHANGED (api-client normalizes).
 *   • `unwrapCallableError` extracts a typed ApiErrorDetails envelope from `.details`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Functions } from "firebase/functions";

const calls: Array<{ name: string; data: unknown }> = [];
let nextResult: unknown = { ok: true };
let nextThrow: unknown = null;

vi.mock("firebase/functions", () => ({
  httpsCallable: (_functions: unknown, name: string) => (data: unknown) => {
    calls.push({ name, data });
    if (nextThrow) return Promise.reject(nextThrow);
    return Promise.resolve({ data: nextResult });
  },
}));

const { invokeViaCallable } = await import("../invoke/invoke-via-callable.js");
const { unwrapCallableError } = await import("../invoke/normalize-callable-error.js");

const fakeFunctions = {} as Functions;

describe("invokeViaCallable (§8.2)", () => {
  beforeEach(() => {
    calls.length = 0;
    nextResult = { ok: true };
    nextThrow = null;
  });

  it("forwards data unchanged with NO tenantId added and returns result.data", async () => {
    const body = { kind: "answer-sheet" as const, examId: "e1", contentType: "image/png" };
    nextResult = { uploadUrl: "https://x", path: "p", expiresAt: "2026-01-01T00:00:00.000Z" };
    const res = await invokeViaCallable(fakeFunctions, "v1.autograde.requestUploadUrl", body);

    expect(calls).toHaveLength(1);
    // The carrier resolves the function by its Firebase DEPLOYED id (dashed),
    // translated from the dotted contract name — `httpsCallable` looks up the
    // deployed id, and a Firebase function id may not contain dots. The dotted
    // name stays the registry/api-client key; only this carrier maps dots→dashes.
    expect(calls[0].name).toBe("v1-autograde-requestUploadUrl");
    expect(calls[0].data).toEqual(body);
    expect(calls[0].data).not.toHaveProperty("tenantId");
    expect(res).toEqual(nextResult);
  });

  it("rethrows a thrown HttpsError UNCHANGED (details intact)", async () => {
    nextThrow = {
      code: "functions/permission-denied",
      message: "denied",
      details: { code: "PERMISSION_DENIED", message: "denied" },
    };
    await expect(
      invokeViaCallable(fakeFunctions, "v1.autograde.requestUploadUrl", {
        kind: "answer-sheet",
        examId: "e1",
        contentType: "image/png",
      })
    ).rejects.toBe(nextThrow);
  });
});

describe("unwrapCallableError", () => {
  it("extracts a typed ApiErrorDetails envelope from .details", () => {
    const envelope = { code: "PERMISSION_DENIED", message: "denied" };
    const err = { code: "functions/permission-denied", message: "denied", details: envelope };
    expect(unwrapCallableError(err)).toEqual(envelope);
  });

  it("returns the error unchanged when details is not an ApiErrorDetails envelope", () => {
    const err = { code: "functions/internal", message: "boom" };
    expect(unwrapCallableError(err)).toBe(err);
  });
});
