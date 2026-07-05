/**
 * Subscription internals unit tests (transport-realtime.md §2.2) — emulator-free.
 *
 * Covers the pure pieces the Firestore/RTDB subscribers compose:
 *   • validatePayload: dev throws on drift; prod wraps in PayloadValidationError.
 *   • toTransportError: firebase listener-code → AppErrorCode coercion.
 *   • SUBSCRIPTION_SOURCES resolve(): produces placeholdered RTDB node targets.
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

  it("U2.6: testSessionDeadline is an RTDB node under the OWNER uid segment", () => {
    const d = SUBSCRIPTION_SOURCES["v1.levelup.testSessionDeadline"];
    expect(d.backend).toBe("rtdb");
    const target = d.resolve({ sessionId: "s1" });
    expect(target.kind).toBe("rtdb");
    if (target.kind === "rtdb") {
      expect(target.nodePath).toBe("testSessionLive/__tenant__/__uid__/s1");
      expect(applyPathContext(target.nodePath, ctx)).toBe("testSessionLive/TEN/U1/s1");
    }
  });

  it("U2.6: studentLevelLive is a self-scoped RTDB node (__uid__ substituted)", () => {
    const d = SUBSCRIPTION_SOURCES["v1.levelup.studentLevelLive"];
    expect(d.backend).toBe("rtdb");
    const target = (d.resolve as () => ReturnType<typeof d.resolve>)();
    expect(target.kind).toBe("rtdb");
    if (target.kind === "rtdb") {
      expect(applyPathContext(target.nodePath, ctx)).toBe("studentLevelLive/TEN/U1");
    }
  });

  it("U2.6: spaceProgressLive keys the node by the userId PARAM (not __uid__)", () => {
    const d = SUBSCRIPTION_SOURCES["v1.levelup.spaceProgressLive"];
    expect(d.backend).toBe("rtdb");
    const target = d.resolve({ spaceId: "sp1", userId: "learner1" });
    expect(target.kind).toBe("rtdb");
    if (target.kind === "rtdb") {
      expect(applyPathContext(target.nodePath, ctx)).toBe("spaceProgressLive/TEN/learner1/sp1");
    }
  });

  it("U2.6: achievementUnlock reads the self-scoped `latest` unlock-event node", () => {
    const d = SUBSCRIPTION_SOURCES["v1.levelup.achievementUnlock"];
    expect(d.backend).toBe("rtdb");
    const target = (d.resolve as () => ReturnType<typeof d.resolve>)();
    expect(target.kind).toBe("rtdb");
    if (target.kind === "rtdb") {
      expect(applyPathContext(target.nodePath, ctx)).toBe("achievementUnlocks/TEN/U1/latest");
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

  it("AG-5: gradingStatus is an RTDB node at the submission `status` leaf", () => {
    const d = SUBSCRIPTION_SOURCES["v1.autograde.gradingStatus"];
    expect(d.backend).toBe("rtdb");
    const target = d.resolve({ submissionId: "sub1" });
    expect(target.kind).toBe("rtdb");
    if (target.kind === "rtdb") {
      // Reads the payload LEAF (`/status`), never the gate sibling (`ownerStudentId`).
      expect(target.nodePath).toBe("gradingProgress/__tenant__/submission/sub1/status");
      expect(applyPathContext(target.nodePath, ctx)).toBe(
        "gradingProgress/TEN/submission/sub1/status"
      );
    }
  });

  it("AG-5: examGrading is an RTDB node at the exam `agg` leaf (O(1) aggregate)", () => {
    const d = SUBSCRIPTION_SOURCES["v1.autograde.examGrading"];
    expect(d.backend).toBe("rtdb");
    const target = d.resolve({ examId: "exam1" });
    expect(target.kind).toBe("rtdb");
    if (target.kind === "rtdb") {
      expect(applyPathContext(target.nodePath, ctx)).toBe("gradingProgress/TEN/exam/exam1/agg");
    }
  });

  it("CHAT-1: chatStream is the self-scoped RTDB bump node (content never in RTDB)", () => {
    const d = SUBSCRIPTION_SOURCES["v1.levelup.chatStream"];
    expect(d.backend).toBe("rtdb");
    const target = d.resolve({ sessionId: "s1" });
    expect(target.kind).toBe("rtdb");
    expect(target.nodePath).toBe("chatBump/__tenant__/__uid__/s1");
    expect(applyPathContext(target.nodePath, ctx)).toBe("chatBump/TEN/U1/s1");
  });
});
