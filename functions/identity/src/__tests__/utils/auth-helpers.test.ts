import { describe, it, expect } from "vitest";
import { sanitizeRollNumber, generateTempPassword, generateSlug } from "../../utils/auth-helpers";

describe("sanitizeRollNumber", () => {
  it("should lowercase and keep alphanumeric + hyphens + underscores", () => {
    expect(sanitizeRollNumber("2024-035")).toBe("2024-035");
    expect(sanitizeRollNumber("ROLL_123")).toBe("roll_123");
  });

  it("should remove special characters", () => {
    expect(sanitizeRollNumber("roll#123!@")).toBe("roll123");
    expect(sanitizeRollNumber("a b c")).toBe("abc");
  });

  it("should handle empty string", () => {
    expect(sanitizeRollNumber("")).toBe("");
  });

  it("should handle string with only special chars", () => {
    expect(sanitizeRollNumber("!@#$%")).toBe("");
  });
});

describe("generateTempPassword", () => {
  it("should generate 8-character password", () => {
    const pw = generateTempPassword();
    expect(pw).toHaveLength(8);
  });

  it("should only contain non-ambiguous characters", () => {
    const allowed = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    for (let i = 0; i < 100; i++) {
      const pw = generateTempPassword();
      for (const ch of pw) {
        expect(allowed).toContain(ch);
      }
    }
  });

  it("should generate different passwords", () => {
    const passwords = new Set(Array.from({ length: 50 }, () => generateTempPassword()));
    // Statistically should have many unique values
    expect(passwords.size).toBeGreaterThan(40);
  });
});

describe("generateSlug", () => {
  it("should create URL-friendly slug", () => {
    expect(generateSlug("Springfield Academy")).toBe("springfield-academy");
  });

  it("should remove leading/trailing hyphens", () => {
    expect(generateSlug("  Hello World  ")).toBe("hello-world");
  });

  it("should handle special characters", () => {
    expect(generateSlug("St. Mary's School")).toBe("st-mary-s-school");
  });

  it("should collapse multiple hyphens", () => {
    expect(generateSlug("A --- B")).toBe("a-b");
  });

  it("should handle empty string", () => {
    expect(generateSlug("")).toBe("");
  });
});
