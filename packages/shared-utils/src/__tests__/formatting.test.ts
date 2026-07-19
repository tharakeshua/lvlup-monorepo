import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  formatNumber,
  formatPercentage,
  truncate,
  toTitleCase,
  camelToKebab,
  snakeToCamel,
  formatBytes,
  getInitials,
} from "../formatting";

describe("formatting utilities", () => {
  // ---------------------------------------------------------------------------
  // formatCurrency
  // ---------------------------------------------------------------------------
  describe("formatCurrency", () => {
    it("formats USD by default", () => {
      const result = formatCurrency(1234.56);
      expect(result).toContain("1,234.56");
      expect(result).toContain("$");
    });

    it("formats zero amount", () => {
      const result = formatCurrency(0);
      expect(result).toContain("0.00");
    });

    it("formats with INR currency", () => {
      const result = formatCurrency(1000, "INR", "en-IN");
      expect(result).toContain("1,000");
    });
  });

  // ---------------------------------------------------------------------------
  // formatNumber
  // ---------------------------------------------------------------------------
  describe("formatNumber", () => {
    it("formats integer with thousands separators", () => {
      expect(formatNumber(1234567)).toBe("1,234,567");
    });

    it("formats with decimal places", () => {
      expect(formatNumber(1234.5, 2)).toBe("1,234.50");
    });
  });

  // ---------------------------------------------------------------------------
  // formatPercentage
  // ---------------------------------------------------------------------------
  describe("formatPercentage", () => {
    it("formats whole percentage", () => {
      expect(formatPercentage(85)).toBe("85%");
    });

    it("formats percentage with decimals", () => {
      expect(formatPercentage(85.5, 1)).toBe("85.5%");
    });

    it("formats zero percentage", () => {
      expect(formatPercentage(0)).toBe("0%");
    });
  });

  // ---------------------------------------------------------------------------
  // truncate
  // ---------------------------------------------------------------------------
  describe("truncate", () => {
    it("truncates long text with ellipsis", () => {
      expect(truncate("Hello World!", 8)).toBe("Hello...");
    });

    it("returns short text unchanged", () => {
      expect(truncate("Hi", 10)).toBe("Hi");
    });

    it("returns text unchanged when exactly at limit", () => {
      expect(truncate("Hello", 5)).toBe("Hello");
    });
  });

  // ---------------------------------------------------------------------------
  // Case conversions
  // ---------------------------------------------------------------------------
  describe("toTitleCase", () => {
    it("converts lowercase to title case", () => {
      expect(toTitleCase("hello world")).toBe("Hello World");
    });

    it("handles mixed case", () => {
      expect(toTitleCase("hELLO wORLD")).toBe("Hello World");
    });
  });

  describe("camelToKebab", () => {
    it("converts camelCase to kebab-case", () => {
      expect(camelToKebab("myVariableName")).toBe("my-variable-name");
    });

    it("handles single word", () => {
      expect(camelToKebab("hello")).toBe("hello");
    });
  });

  describe("snakeToCamel", () => {
    it("converts snake_case to camelCase", () => {
      expect(snakeToCamel("my_variable_name")).toBe("myVariableName");
    });

    it("handles single word", () => {
      expect(snakeToCamel("hello")).toBe("hello");
    });
  });

  // ---------------------------------------------------------------------------
  // formatBytes
  // ---------------------------------------------------------------------------
  describe("formatBytes", () => {
    it("formats zero bytes", () => {
      expect(formatBytes(0)).toBe("0 Bytes");
    });

    it("formats bytes", () => {
      expect(formatBytes(500)).toBe("500 Bytes");
    });

    it("formats kilobytes", () => {
      expect(formatBytes(1024)).toBe("1 KB");
    });

    it("formats megabytes", () => {
      expect(formatBytes(1048576)).toBe("1 MB");
    });

    it("formats gigabytes", () => {
      expect(formatBytes(1073741824)).toBe("1 GB");
    });
  });

  // ---------------------------------------------------------------------------
  // getInitials
  // ---------------------------------------------------------------------------
  describe("getInitials", () => {
    it("gets initials from full name", () => {
      expect(getInitials("John Doe")).toBe("JD");
    });

    it("gets single initial from one word", () => {
      expect(getInitials("Alice")).toBe("A");
    });

    it("limits initials to maxLength", () => {
      expect(getInitials("John Michael Doe", 2)).toBe("JM");
    });

    it("handles extra whitespace", () => {
      expect(getInitials("  John   Doe  ")).toBe("JD");
    });
  });
});
