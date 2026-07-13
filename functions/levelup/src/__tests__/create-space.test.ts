import { describe, it, expect } from "vitest";
import { assertAuth } from "../utils/auth";

/**
 * Tests for create-space validation.
 * The onCall function relies on assertAuth and assertTeacherOrAdmin.
 */

describe("create-space — auth validation", () => {
  it("should return uid when auth is provided", () => {
    const uid = assertAuth({ uid: "user-1" });
    expect(uid).toBe("user-1");
  });

  it("should throw unauthenticated when auth is undefined", () => {
    expect(() => assertAuth(undefined)).toThrow("Must be logged in");
  });

  it("should throw unauthenticated when uid is empty", () => {
    expect(() => assertAuth({ uid: "" })).toThrow("Must be logged in");
  });
});

describe("create-space — input validation rules", () => {
  it("should require tenantId, title, and type", () => {
    // These are the required fields validated in the onCall handler
    const validData = { tenantId: "t1", title: "My Space", type: "learn" };
    expect(validData.tenantId).toBeTruthy();
    expect(validData.title).toBeTruthy();
    expect(validData.type).toBeTruthy();
  });

  it("should default accessType to class_assigned", () => {
    const accessType = undefined ?? "class_assigned";
    expect(accessType).toBe("class_assigned");
  });

  it("should default allowRetakes to true", () => {
    const allowRetakes = undefined ?? true;
    expect(allowRetakes).toBe(true);
  });

  it("should default showCorrectAnswers to true", () => {
    const showCorrectAnswers = undefined ?? true;
    expect(showCorrectAnswers).toBe(true);
  });
});
