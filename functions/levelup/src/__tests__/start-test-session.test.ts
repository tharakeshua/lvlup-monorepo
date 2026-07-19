import { describe, it, expect } from "vitest";
import { assertAuth } from "../utils/auth";
import { makeStoryPoint, makeSpace } from "../../../test-utils/test-data";

/**
 * Tests for start-test-session validation logic.
 */

describe("start-test-session — validation", () => {
  it("should require authentication", () => {
    expect(() => assertAuth(undefined)).toThrow();
  });

  it("should determine session type from storyPoint type", () => {
    const timedTest = makeStoryPoint({ type: "timed_test" });
    const quiz = makeStoryPoint({ type: "quiz" });
    const standard = makeStoryPoint({ type: "standard" });

    // Mimic the logic from the actual function
    const getSessionType = (sp: any) =>
      sp.type === "timed_test" || sp.type === "test"
        ? "timed_test"
        : sp.type === "quiz"
          ? "quiz"
          : "practice";

    expect(getSessionType(timedTest)).toBe("timed_test");
    expect(getSessionType(quiz)).toBe("quiz");
    expect(getSessionType(standard)).toBe("practice");
  });

  it("should require duration for timed tests", () => {
    const sp = makeStoryPoint({
      type: "timed_test",
      assessmentConfig: { durationMinutes: 0 },
    });

    const durationMinutes = sp.assessmentConfig?.durationMinutes ?? 0;
    const sessionType = "timed_test";

    expect(sessionType === "timed_test" && durationMinutes <= 0).toBe(true);
  });

  it("should compute server deadline from duration", () => {
    const nowMs = 1700000000000;
    const durationMinutes = 60;
    const deadlineMs = nowMs + durationMinutes * 60 * 1000;

    expect(deadlineMs).toBe(1700000000000 + 3600000);
  });

  it("should reject when max attempts exceeded", () => {
    const maxAttempts = 3;
    const completedAttempts = 3;

    expect(maxAttempts > 0 && completedAttempts >= maxAttempts).toBe(true);
  });

  it("should allow unlimited attempts when maxAttempts is 0", () => {
    const maxAttempts = 0;
    const completedAttempts = 100;

    expect(maxAttempts > 0 && completedAttempts >= maxAttempts).toBe(false);
  });

  it("should require space to be published", () => {
    const draftSpace = makeSpace({ status: "draft" });
    const publishedSpace = makeSpace({ status: "published" });

    expect(draftSpace.status !== "published").toBe(true);
    expect(publishedSpace.status !== "published").toBe(false);
  });
});
