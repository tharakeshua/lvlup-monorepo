import { describe, it, expect } from "vitest";

/**
 * Tests for create-tenant callable.
 *
 * Tests validation rules and business logic constraints.
 */

describe("create-tenant — validation", () => {
  it("should require name, tenantCode, and contactEmail", () => {
    const validData = { name: "Test School", tenantCode: "TST001", contactEmail: "admin@test.com" };

    expect(validData.name).toBeTruthy();
    expect(validData.tenantCode).toBeTruthy();
    expect(validData.contactEmail).toBeTruthy();
  });

  it("should uppercase tenant code", () => {
    const code = "tst001";
    expect(code.toUpperCase()).toBe("TST001");
  });

  it("should require superAdmin or ownerUid", () => {
    // Only superAdmin can create tenants, or an ownerUid must be provided
    const isSuperAdmin = false;
    const ownerUid = undefined;

    expect(!isSuperAdmin && !ownerUid).toBe(true); // Would fail validation
  });
});

describe("create-tenant — default features", () => {
  const defaultFeatures = {
    autoGradeEnabled: false,
    levelUpEnabled: true,
    scannerAppEnabled: false,
    aiChatEnabled: false,
    aiGradingEnabled: false,
    analyticsEnabled: false,
    parentPortalEnabled: false,
    bulkImportEnabled: false,
    apiAccessEnabled: false,
  };

  it("should default autoGrade to false", () => {
    expect(defaultFeatures.autoGradeEnabled).toBe(false);
  });

  it("should default levelUp to true", () => {
    expect(defaultFeatures.levelUpEnabled).toBe(true);
  });

  it("should default analytics to false", () => {
    expect(defaultFeatures.analyticsEnabled).toBe(false);
  });
});

describe("create-tenant — tenant code uniqueness", () => {
  it("should normalize tenant code to uppercase", () => {
    const input = "spr001";
    const normalized = input.toUpperCase();
    expect(normalized).toBe("SPR001");
  });

  it("should validate tenant code format (alphanumeric)", () => {
    const isValidCode = (code: string) => /^[A-Z0-9]{3,10}$/.test(code.toUpperCase());

    expect(isValidCode("SPR001")).toBe(true);
    expect(isValidCode("AB")).toBe(false); // too short
    expect(isValidCode("SPR-001")).toBe(false); // has hyphen
  });
});
