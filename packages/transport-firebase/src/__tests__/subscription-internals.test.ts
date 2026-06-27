/**
 * Subscription internals unit tests (transport-realtime.md §2.2) — emulator-free.
 *
 * Covers the pure pieces the Firestore/RTDB subscribers compose:
 *   • validatePayload: dev throws on drift; prod wraps in PayloadValidationError.
 *   • toTransportError: firebase listener-code → AppErrorCode coercion.
 *   • SUBSCRIPTION_SOURCES resolve(): produces placeholdered doc/query/node targets.
 *   • applyPathContext: substitutes __tenant__ / __uid__ from a PathContext.
 */
import { describe, it, expect } from "vitest";
import { validatePayload, PayloadValidationError } from "../subscribe/validate-payload.js";
import { toTransportError } from "../subscribe/to-transport-error.js";
import { SUBSCRIPTION_SOURCES, applyPathContext } from "../subscribe/subscription-sources.js";

describe("validatePayload", () => {
  const good = {
    remainingMs: 1000,
    serverDeadline: "2026-01-01T00:00:00.000Z",
    status: "in_progress",
  };

  it("parses a valid payload (prod) and returns the typed value", () => {
    const out = validatePayload("v1.levelup.testSessionDeadline", good, "prod");
    expect(out).toMatchObject({ remainingMs: 1000 });
  });

  it("throws the ZodError in dev on drift", () => {
    expect(() =>
      validatePayload("v1.levelup.testSessionDeadline", { remainingMs: -1 }, "dev")
    ).toThrow();
  });

  it("throws a PayloadValidationError in prod on drift (routed through cb.error by callers)", () => {
    expect(() => validatePayload("v1.levelup.testSessionDeadline", { nope: true }, "prod")).toThrow(
      PayloadValidationError
    );
  });
});

describe("toTransportError", () => {
  it("coerces permission-denied → PERMISSION_DENIED", () => {
    expect(toTransportError({ code: "permission-denied", message: "no" })).toEqual({
      code: "PERMISSION_DENIED",
      message: "no",
      retryable: false,
    });
  });
  it("falls back to INTERNAL_ERROR for unknown/no code", () => {
    expect(toTransportError({}).code).toBe("INTERNAL_ERROR");
  });
});

describe("SUBSCRIPTION_SOURCES resolve + applyPathContext", () => {
  const ctx = { tenantId: "TEN", uid: "U1" };

  it("firestore-doc descriptor resolves a placeholdered doc path; ctx substitutes", () => {
    const d = SUBSCRIPTION_SOURCES["v1.levelup.testSessionDeadline"];
    expect(d.backend).toBe("firestore");
    const target = d.resolve({ sessionId: "s1" });
    expect(target).toMatchObject({ kind: "doc" });
    if (target.kind === "doc") {
      expect(target.path).toContain("__tenant__");
      expect(applyPathContext(target.path, ctx)).toContain("tenants/TEN/");
      expect(applyPathContext(target.path, ctx)).not.toContain("__tenant__");
    }
  });

  it("self-scoped channel embeds __uid__ and substitutes from ctx", () => {
    const d = SUBSCRIPTION_SOURCES["v1.levelup.studentLevelLive"];
    const target = (d.resolve as () => ReturnType<typeof d.resolve>)();
    if (target.kind === "doc") {
      expect(applyPathContext(target.path, ctx)).toBe("tenants/TEN/students/U1/level/current");
    }
  });

  it("rtdb descriptor resolves a node path (notification badge)", () => {
    const d = SUBSCRIPTION_SOURCES["v1.notification.badge"];
    expect(d.backend).toBe("rtdb");
    const target = (d.resolve as () => ReturnType<typeof d.resolve>)();
    expect(target.kind).toBe("rtdb");
    if (target.kind === "rtdb") {
      expect(applyPathContext(target.nodePath, ctx)).toBe("notifications/TEN/U1");
    }
  });

  it("chatStream resolves an ordered query target", () => {
    const d = SUBSCRIPTION_SOURCES["v1.levelup.chatStream"];
    const target = d.resolve({ sessionId: "s1" });
    expect(target.kind).toBe("query");
    if (target.kind === "query") {
      expect(target.constraints).toContainEqual(["orderBy", "createdAt", "asc"]);
    }
  });
});
