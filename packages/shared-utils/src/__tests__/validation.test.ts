import { describe, it, expect } from "vitest";
import {
  isValidEmail,
  isValidPhone,
  isValidURL,
  isNotEmpty,
  isInRange,
  sanitizeString,
  validateRequiredFields,
} from "../validation";

describe("validation utilities", () => {
  // ---------------------------------------------------------------------------
  // isValidEmail
  // ---------------------------------------------------------------------------
  describe("isValidEmail", () => {
    it("accepts a standard email", () => {
      expect(isValidEmail("user@example.com")).toBe(true);
    });

    it("accepts email with subdomain", () => {
      expect(isValidEmail("user@mail.example.co.uk")).toBe(true);
    });

    it("rejects email without @", () => {
      expect(isValidEmail("userexample.com")).toBe(false);
    });

    it("rejects email without domain", () => {
      expect(isValidEmail("user@")).toBe(false);
    });

    it("rejects email with spaces", () => {
      expect(isValidEmail("user @example.com")).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // isValidPhone
  // ---------------------------------------------------------------------------
  describe("isValidPhone", () => {
    it("accepts a 10-digit number", () => {
      expect(isValidPhone("1234567890")).toBe(true);
    });

    it("accepts phone with country code and dashes", () => {
      expect(isValidPhone("+1-234-567-8901")).toBe(true);
    });

    it("accepts phone with parentheses", () => {
      expect(isValidPhone("(123) 456-7890")).toBe(true);
    });

    it("rejects phone with too few digits", () => {
      expect(isValidPhone("12345")).toBe(false);
    });

    it("rejects phone with letters", () => {
      expect(isValidPhone("123-abc-7890")).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // isValidURL
  // ---------------------------------------------------------------------------
  describe("isValidURL", () => {
    it("accepts a valid https URL", () => {
      expect(isValidURL("https://example.com")).toBe(true);
    });

    it("accepts a valid http URL with path", () => {
      expect(isValidURL("http://example.com/path?q=1")).toBe(true);
    });

    it("rejects a plain string", () => {
      expect(isValidURL("not-a-url")).toBe(false);
    });

    it("rejects empty string", () => {
      expect(isValidURL("")).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // isNotEmpty
  // ---------------------------------------------------------------------------
  describe("isNotEmpty", () => {
    it("returns true for non-empty string", () => {
      expect(isNotEmpty("hello")).toBe(true);
    });

    it("returns false for empty string", () => {
      expect(isNotEmpty("")).toBe(false);
    });

    it("returns false for whitespace-only string", () => {
      expect(isNotEmpty("   ")).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // isInRange
  // ---------------------------------------------------------------------------
  describe("isInRange", () => {
    it("returns true when value is within range", () => {
      expect(isInRange(5, 1, 10)).toBe(true);
    });

    it("returns true at lower boundary", () => {
      expect(isInRange(1, 1, 10)).toBe(true);
    });

    it("returns true at upper boundary", () => {
      expect(isInRange(10, 1, 10)).toBe(true);
    });

    it("returns false below range", () => {
      expect(isInRange(0, 1, 10)).toBe(false);
    });

    it("returns false above range", () => {
      expect(isInRange(11, 1, 10)).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // sanitizeString (XSS prevention)
  // ---------------------------------------------------------------------------
  describe("sanitizeString", () => {
    it("escapes angle brackets", () => {
      expect(sanitizeString('<script>alert("xss")</script>')).not.toContain("<");
      expect(sanitizeString('<script>alert("xss")</script>')).not.toContain(">");
    });

    it("escapes ampersands", () => {
      expect(sanitizeString("a & b")).toBe("a &amp; b");
    });

    it("escapes quotes", () => {
      expect(sanitizeString('"hello"')).toBe("&quot;hello&quot;");
    });

    it("returns safe string unchanged (no special chars)", () => {
      expect(sanitizeString("hello world")).toBe("hello world");
    });
  });

  // ---------------------------------------------------------------------------
  // validateRequiredFields
  // ---------------------------------------------------------------------------
  describe("validateRequiredFields", () => {
    it("returns valid when all required fields are present", () => {
      const data = { name: "Alice", email: "a@b.com" };
      const result = validateRequiredFields(data, ["name", "email"]);
      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it("returns invalid with missing fields listed", () => {
      const data = { name: "Alice", email: "" };
      const result = validateRequiredFields(data, ["name", "email"]);
      expect(result.valid).toBe(false);
      expect(result.missing).toContain("email");
    });

    it("detects null and undefined as missing", () => {
      const data = { a: null, b: undefined, c: "ok" } as any;
      const result = validateRequiredFields(data, ["a", "b", "c"]);
      expect(result.valid).toBe(false);
      expect(result.missing).toEqual(["a", "b"]);
    });
  });
});
