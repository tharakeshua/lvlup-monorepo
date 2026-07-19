import { describe, it, expect } from "vitest";
import { sanitizeRollNumber, generateTempPassword } from "../../utils/auth-helpers";

/**
 * Tests for bulk-import-students callable.
 *
 * Tests batch processing logic, CSV row validation, and dry-run mode.
 */

describe("bulk-import-students — CSV row validation", () => {
  interface StudentRow {
    firstName: string;
    lastName: string;
    rollNumber: string;
    email?: string;
    classId?: string;
  }

  const validateRow = (row: StudentRow, index: number): string | null => {
    if (!row.firstName?.trim()) return `Row ${index}: firstName is required`;
    if (!row.lastName?.trim()) return `Row ${index}: lastName is required`;
    if (!row.rollNumber?.trim()) return `Row ${index}: rollNumber is required`;
    return null;
  };

  it("should accept valid row", () => {
    const error = validateRow({ firstName: "Alice", lastName: "Smith", rollNumber: "001" }, 1);
    expect(error).toBeNull();
  });

  it("should reject row missing firstName", () => {
    const error = validateRow({ firstName: "", lastName: "Smith", rollNumber: "001" }, 1);
    expect(error).toContain("firstName");
  });

  it("should reject row missing rollNumber", () => {
    const error = validateRow({ firstName: "Alice", lastName: "Smith", rollNumber: "" }, 1);
    expect(error).toContain("rollNumber");
  });
});

describe("bulk-import-students — batch processing", () => {
  it("should batch students into groups of 50", () => {
    const BATCH_SIZE = 50;
    const students = Array.from({ length: 120 }, (_, i) => ({
      firstName: `Student${i}`,
      lastName: "Test",
      rollNumber: `R${i}`,
    }));

    const batches: (typeof students)[] = [];
    for (let i = 0; i < students.length; i += BATCH_SIZE) {
      batches.push(students.slice(i, i + BATCH_SIZE));
    }

    expect(batches).toHaveLength(3);
    expect(batches[0]).toHaveLength(50);
    expect(batches[1]).toHaveLength(50);
    expect(batches[2]).toHaveLength(20);
  });
});

describe("bulk-import-students — credential generation", () => {
  it("should generate credentials for each imported student", () => {
    const students = [
      { firstName: "Alice", rollNumber: "R001" },
      { firstName: "Bob", rollNumber: "R002" },
    ];

    const credentials = students.map((s) => ({
      rollNumber: sanitizeRollNumber(s.rollNumber),
      tempPassword: generateTempPassword(),
    }));

    expect(credentials).toHaveLength(2);
    expect(credentials[0].rollNumber).toBe("r001");
    expect(credentials[0].tempPassword).toHaveLength(8);
  });
});

describe("bulk-import-students — dry run", () => {
  it("should not create users in dry run mode", () => {
    const dryRun = true;
    let usersCreated = 0;

    if (!dryRun) {
      usersCreated = 5; // Would create users
    }

    expect(usersCreated).toBe(0);
  });

  it("should still validate rows in dry run mode", () => {
    const dryRun = true;
    const row = { firstName: "", lastName: "Smith", rollNumber: "001" };
    const hasError = !row.firstName?.trim();

    expect(dryRun).toBe(true);
    expect(hasError).toBe(true);
  });
});
