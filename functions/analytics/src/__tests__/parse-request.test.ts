/**
 * Tests for parseRequest — Zod-based callable request validation utility.
 *
 * Covers:
 *  1. Returns parsed data for valid input
 *  2. Throws invalid-argument for invalid input
 *  3. Error message includes field paths and messages
 *  4. Works with nested schemas
 *  5. Works with optional fields
 *  6. Handles multiple validation errors
 */

import { describe, it, expect, vi } from "vitest";
import { z } from "zod";

// ── Mock HttpsError ─────────────────────────────────────────────────────

vi.mock("firebase-functions/v2/https", () => ({
  HttpsError: class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

// ── Import under test (after mocks) ─────────────────────────────────────

import { parseRequest } from "../utils/parse-request";

// ── Test schemas ────────────────────────────────────────────────────────

const simpleSchema = z.object({
  tenantId: z.string(),
  scope: z.enum(["student", "class"]),
});

const nestedSchema = z.object({
  tenantId: z.string(),
  filters: z.object({
    classId: z.string(),
    startDate: z.string(),
    endDate: z.string(),
  }),
});

const schemaWithOptionals = z.object({
  tenantId: z.string(),
  name: z.string().optional(),
  limit: z.number().optional(),
  includeArchived: z.boolean().default(false),
});

const schemaWithConstraints = z.object({
  email: z.string().email(),
  age: z.number().min(0).max(150),
  tags: z.array(z.string()).min(1),
});

// ── Tests ────────────────────────────────────────────────────────────────

describe("parseRequest", () => {
  // ── Valid input ─────────────────────────────────────────────────────

  describe("valid input", () => {
    it("returns parsed data for valid input matching a simple schema", () => {
      const input = { tenantId: "tenant-1", scope: "student" };
      const result = parseRequest(input, simpleSchema);
      expect(result).toEqual({ tenantId: "tenant-1", scope: "student" });
    });

    it("returns parsed data for valid nested schema input", () => {
      const input = {
        tenantId: "tenant-1",
        filters: {
          classId: "class-1",
          startDate: "2025-01-01",
          endDate: "2025-12-31",
        },
      };
      const result = parseRequest(input, nestedSchema);
      expect(result).toEqual(input);
    });

    it("returns parsed data with optional fields omitted", () => {
      const input = { tenantId: "tenant-1" };
      const result = parseRequest(input, schemaWithOptionals);
      expect(result).toEqual({
        tenantId: "tenant-1",
        includeArchived: false, // default applied
      });
      expect(result.name).toBeUndefined();
      expect(result.limit).toBeUndefined();
    });

    it("returns parsed data with optional fields provided", () => {
      const input = {
        tenantId: "tenant-1",
        name: "Test",
        limit: 10,
        includeArchived: true,
      };
      const result = parseRequest(input, schemaWithOptionals);
      expect(result).toEqual(input);
    });

    it("strips extra properties not in the schema", () => {
      const input = { tenantId: "tenant-1", scope: "class", extraField: "ignored" };
      const result = parseRequest(input, simpleSchema);
      expect(result).toEqual({ tenantId: "tenant-1", scope: "class" });
      expect((result as any).extraField).toBeUndefined();
    });
  });

  // ── Invalid input ───────────────────────────────────────────────────

  describe("invalid input", () => {
    it("throws HttpsError with code invalid-argument for missing required field", () => {
      const input = { scope: "student" }; // missing tenantId

      try {
        parseRequest(input, simpleSchema);
        expect.fail("Expected HttpsError to be thrown");
      } catch (err: any) {
        expect(err.code).toBe("invalid-argument");
        expect(err.message).toContain("Invalid request");
      }
    });

    it("throws for invalid enum value", () => {
      const input = { tenantId: "tenant-1", scope: "admin" }; // not in enum

      try {
        parseRequest(input, simpleSchema);
        expect.fail("Expected HttpsError to be thrown");
      } catch (err: any) {
        expect(err.code).toBe("invalid-argument");
        expect(err.message).toContain("scope");
      }
    });

    it("throws for wrong type on a field", () => {
      const input = { tenantId: 123, scope: "student" }; // tenantId should be string

      try {
        parseRequest(input, simpleSchema);
        expect.fail("Expected HttpsError to be thrown");
      } catch (err: any) {
        expect(err.code).toBe("invalid-argument");
        expect(err.message).toContain("tenantId");
      }
    });

    it("throws for null input", () => {
      try {
        parseRequest(null, simpleSchema);
        expect.fail("Expected HttpsError to be thrown");
      } catch (err: any) {
        expect(err.code).toBe("invalid-argument");
      }
    });

    it("throws for undefined input", () => {
      try {
        parseRequest(undefined, simpleSchema);
        expect.fail("Expected HttpsError to be thrown");
      } catch (err: any) {
        expect(err.code).toBe("invalid-argument");
      }
    });
  });

  // ── Error message formatting ────────────────────────────────────────

  describe("error message formatting", () => {
    it("error message includes field path and validation message", () => {
      const input = { tenantId: "tenant-1" }; // missing scope

      try {
        parseRequest(input, simpleSchema);
        expect.fail("Expected error");
      } catch (err: any) {
        expect(err.message).toContain("scope");
        expect(err.message).toContain("Invalid request");
      }
    });

    it("error message includes nested field path using dot notation", () => {
      const input = {
        tenantId: "tenant-1",
        filters: {
          classId: "class-1",
          // missing startDate and endDate
        },
      };

      try {
        parseRequest(input, nestedSchema);
        expect.fail("Expected error");
      } catch (err: any) {
        expect(err.message).toContain("filters.startDate");
        expect(err.message).toContain("filters.endDate");
      }
    });

    it("error message includes multiple field errors separated by semicolons", () => {
      const input = {}; // missing tenantId and scope

      try {
        parseRequest(input, simpleSchema);
        expect.fail("Expected error");
      } catch (err: any) {
        // Both tenantId and scope are missing
        expect(err.message).toContain("tenantId");
        expect(err.message).toContain("scope");
        expect(err.message).toContain(";");
      }
    });

    it("includes constraint violation messages", () => {
      const input = {
        email: "not-an-email",
        age: -5,
        tags: [],
      };

      try {
        parseRequest(input, schemaWithConstraints);
        expect.fail("Expected error");
      } catch (err: any) {
        expect(err.code).toBe("invalid-argument");
        // Should mention the specific fields
        expect(err.message).toContain("email");
        expect(err.message).toContain("age");
        expect(err.message).toContain("tags");
      }
    });
  });

  // ── Nested schemas ──────────────────────────────────────────────────

  describe("nested schemas", () => {
    it("validates nested object fields correctly", () => {
      const input = {
        tenantId: "tenant-1",
        filters: {
          classId: "class-1",
          startDate: "2025-01-01",
          endDate: "2025-12-31",
        },
      };

      const result = parseRequest(input, nestedSchema);
      expect(result.filters.classId).toBe("class-1");
      expect(result.filters.startDate).toBe("2025-01-01");
    });

    it("throws when nested object is missing entirely", () => {
      const input = { tenantId: "tenant-1" }; // missing filters

      try {
        parseRequest(input, nestedSchema);
        expect.fail("Expected error");
      } catch (err: any) {
        expect(err.code).toBe("invalid-argument");
        expect(err.message).toContain("filters");
      }
    });

    it("throws when nested object has wrong type", () => {
      const input = { tenantId: "tenant-1", filters: "not-an-object" };

      try {
        parseRequest(input, nestedSchema);
        expect.fail("Expected error");
      } catch (err: any) {
        expect(err.code).toBe("invalid-argument");
        expect(err.message).toContain("filters");
      }
    });
  });

  // ── Optional fields ─────────────────────────────────────────────────

  describe("optional fields", () => {
    it("accepts input without optional fields", () => {
      const result = parseRequest({ tenantId: "tenant-1" }, schemaWithOptionals);
      expect(result.tenantId).toBe("tenant-1");
      expect(result.name).toBeUndefined();
    });

    it("applies default values when field is omitted", () => {
      const result = parseRequest({ tenantId: "tenant-1" }, schemaWithOptionals);
      expect(result.includeArchived).toBe(false);
    });

    it("uses provided value over default", () => {
      const result = parseRequest(
        { tenantId: "tenant-1", includeArchived: true },
        schemaWithOptionals
      );
      expect(result.includeArchived).toBe(true);
    });

    it("still validates type of optional fields when provided", () => {
      try {
        parseRequest({ tenantId: "tenant-1", limit: "not-a-number" }, schemaWithOptionals);
        expect.fail("Expected error");
      } catch (err: any) {
        expect(err.code).toBe("invalid-argument");
        expect(err.message).toContain("limit");
      }
    });
  });

  // ── Array schemas ───────────────────────────────────────────────────

  describe("array schemas", () => {
    it("validates array fields", () => {
      const result = parseRequest(
        { email: "test@example.com", age: 25, tags: ["student"] },
        schemaWithConstraints
      );
      expect(result.tags).toEqual(["student"]);
    });

    it("throws when array has wrong element type", () => {
      try {
        parseRequest({ email: "test@example.com", age: 25, tags: [123] }, schemaWithConstraints);
        expect.fail("Expected error");
      } catch (err: any) {
        expect(err.code).toBe("invalid-argument");
        expect(err.message).toContain("tags");
      }
    });

    it("throws when array is empty and min(1) is required", () => {
      try {
        parseRequest({ email: "test@example.com", age: 25, tags: [] }, schemaWithConstraints);
        expect.fail("Expected error");
      } catch (err: any) {
        expect(err.code).toBe("invalid-argument");
        expect(err.message).toContain("tags");
      }
    });
  });
});
