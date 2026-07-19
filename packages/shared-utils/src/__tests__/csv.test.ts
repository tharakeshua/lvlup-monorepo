import { describe, it, expect } from "vitest";
import { parseCSVContent, parseCSVLine, generateCSVTemplate, generateCredentialsCSV } from "../csv";

describe("CSV utilities", () => {
  // ---------------------------------------------------------------------------
  // parseCSVLine
  // ---------------------------------------------------------------------------
  describe("parseCSVLine", () => {
    it("parses simple comma-separated values", () => {
      expect(parseCSVLine("a,b,c")).toEqual(["a", "b", "c"]);
    });

    it("handles quoted fields with commas", () => {
      expect(parseCSVLine('"hello, world",b,c')).toEqual(["hello, world", "b", "c"]);
    });

    it("trims whitespace from fields", () => {
      expect(parseCSVLine(" a , b , c ")).toEqual(["a", "b", "c"]);
    });
  });

  // ---------------------------------------------------------------------------
  // parseCSVContent — valid student CSV
  // ---------------------------------------------------------------------------
  describe("parseCSVContent", () => {
    const validCSV = [
      "rollNumber,firstName,lastName,email,classIds,parentFirstName,parentLastName,parentEmail,parentPhone,dateOfBirth,phone",
      "001,John,Doe,john@school.com,class1,Jane,Doe,jane@parent.com,+1234567890,2010-01-15,+1234567891",
      '002,Alice,Smith,alice@school.com,"class1,class2",Bob,Smith,bob@parent.com,+1234567892,2010-03-20,',
    ].join("\n");

    it("parses students with all fields", () => {
      const result = parseCSVContent(validCSV);
      expect(result.students).toHaveLength(2);
      expect(result.errors).toHaveLength(0);

      const john = result.students[0]!;
      expect(john.rollNumber).toBe("001");
      expect(john.firstName).toBe("John");
      expect(john.lastName).toBe("Doe");
      expect(john.email).toBe("john@school.com");
      expect(john.classIds).toEqual(["class1"]);
    });

    it("parses parents and links them to students", () => {
      const result = parseCSVContent(validCSV);
      expect(result.parents).toHaveLength(2);

      const janeParent = result.parents.find((p) => p.email === "jane@parent.com");
      expect(janeParent).toBeDefined();
      expect(janeParent!.studentEmails).toContain("john@school.com");
    });

    it("deduplicates parents by email and links multiple students", () => {
      const csv = [
        "rollNumber,firstName,lastName,email,classIds,parentFirstName,parentLastName,parentEmail",
        "001,John,Doe,john@school.com,class1,Jane,Doe,jane@parent.com",
        "002,Alice,Doe,alice@school.com,class1,Jane,Doe,jane@parent.com",
      ].join("\n");

      const result = parseCSVContent(csv);
      expect(result.parents).toHaveLength(1);
      expect(result.parents[0]!.studentEmails).toHaveLength(2);
    });

    it("returns error for empty CSV", () => {
      const result = parseCSVContent("");
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]!.message).toContain("empty");
    });

    it("returns error for missing required headers", () => {
      const csv = "name,age\nJohn,10";
      const result = parseCSVContent(csv);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]!.message).toContain("Missing required headers");
    });

    it("reports validation errors for rows with missing required fields", () => {
      const csv = [
        "rollNumber,firstName,lastName,email,classIds",
        ",John,Doe,john@school.com,class1",
      ].join("\n");

      const result = parseCSVContent(csv);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.students).toHaveLength(0);
    });

    it("reports validation error for invalid email", () => {
      const csv = [
        "rollNumber,firstName,lastName,email,classIds",
        "001,John,Doe,not-an-email,class1",
      ].join("\n");

      const result = parseCSVContent(csv);
      expect(result.errors.some((e) => e.field === "email")).toBe(true);
    });

    it("adds warning when classIds are empty", () => {
      const csv = [
        "rollNumber,firstName,lastName,email,classIds",
        "001,John,Doe,john@school.com,",
      ].join("\n");

      const result = parseCSVContent(csv);
      expect(result.warnings.some((w) => w.field === "classIds")).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // generateCSVTemplate
  // ---------------------------------------------------------------------------
  describe("generateCSVTemplate", () => {
    it("includes required headers", () => {
      const template = generateCSVTemplate();
      expect(template).toContain("rollNumber");
      expect(template).toContain("firstName");
      expect(template).toContain("email");
      expect(template).toContain("classIds");
    });

    it("includes example data rows", () => {
      const template = generateCSVTemplate();
      const lines = template.split("\n");
      expect(lines.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ---------------------------------------------------------------------------
  // generateCredentialsCSV
  // ---------------------------------------------------------------------------
  describe("generateCredentialsCSV", () => {
    it("generates CSV with student and parent credentials", () => {
      const csv = generateCredentialsCSV(
        [{ email: "student@test.com", tempPassword: "pass123" }],
        [{ email: "parent@test.com", tempPassword: "pass456" }]
      );
      expect(csv).toContain("Student,student@test.com,pass123");
      expect(csv).toContain("Parent,parent@test.com,pass456");
      expect(csv).toContain("Type,Email,Temporary Password");
    });
  });
});
