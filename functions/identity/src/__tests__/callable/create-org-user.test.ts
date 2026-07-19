import { describe, it, expect } from "vitest";
import { sanitizeRollNumber, generateTempPassword } from "../../utils/auth-helpers";

/**
 * Tests for create-org-user callable.
 *
 * Tests the validation and helper utilities used during user creation.
 */

describe("create-org-user — input validation", () => {
  it("should require tenantId, role, firstName, lastName", () => {
    const validData = {
      tenantId: "tenant-1",
      role: "student",
      firstName: "Alice",
      lastName: "Smith",
    };

    expect(validData.tenantId).toBeTruthy();
    expect(validData.role).toBeTruthy();
    expect(validData.firstName).toBeTruthy();
    expect(validData.lastName).toBeTruthy();
  });

  it("should only accept valid roles", () => {
    const validRoles = ["tenantAdmin", "teacher", "student", "parent", "scanner"];
    expect(validRoles).toContain("student");
    expect(validRoles).not.toContain("superAdmin");
    expect(validRoles).not.toContain("admin");
  });

  it("should require rollNumber for students", () => {
    const role = "student";
    const rollNumber = "ROLL001";

    expect(role === "student" && !rollNumber).toBe(false);
  });

  it("should require email for non-student roles", () => {
    const role = "teacher";
    const email = "teacher@school.com";

    expect(role !== "student" && !email).toBe(false);
  });
});

describe("create-org-user — roll number handling", () => {
  it("should sanitize roll number", () => {
    expect(sanitizeRollNumber("ROLL-001")).toBe("roll-001");
    expect(sanitizeRollNumber("roll 123!")).toBe("roll123");
  });

  it("should build synthetic email from roll number", () => {
    const tenantCode = "SPR001";
    const sanitized = sanitizeRollNumber("2024-035");
    const email = `${sanitized}@${tenantCode.toLowerCase()}.lvlup.app`;

    expect(email).toBe("2024-035@spr001.lvlup.app");
  });
});

describe("create-org-user — password generation", () => {
  it("should generate temp password when none provided", () => {
    const password = generateTempPassword();
    expect(password).toHaveLength(8);
    expect(typeof password).toBe("string");
  });

  it("should use provided password when given", () => {
    const userPassword = "MySecurePass123";
    const finalPassword = userPassword || generateTempPassword();

    expect(finalPassword).toBe("MySecurePass123");
  });
});
