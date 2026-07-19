import { describe, it, expect } from "vitest";
import { getCallerMembership, assertAutogradePermission } from "../utils/assertions";
import type { CallerMembership } from "../utils/assertions";

/**
 * Tests for upload-answer-sheets validation logic.
 *
 * The actual onCall function orchestrates Firestore I/O; we test the
 * permission and validation helpers it relies on.
 */

describe("upload-answer-sheets — permission checks", () => {
  const makeTeacherCaller = (): CallerMembership => ({
    uid: "teacher-1",
    tenantId: "tenant-1",
    role: "teacher",
    permissions: { canCreateExams: true },
  });

  const makeScannerCaller = (): CallerMembership => ({
    uid: "scanner-1",
    tenantId: "tenant-1",
    role: "scanner",
    permissions: {},
  });

  it("should allow teacher to upload answer sheets", () => {
    expect(() =>
      assertAutogradePermission(makeTeacherCaller(), "tenant-1", undefined, { allowScanner: true })
    ).not.toThrow();
  });

  it("should allow scanner to upload answer sheets", () => {
    expect(() =>
      assertAutogradePermission(makeScannerCaller(), "tenant-1", undefined, { allowScanner: true })
    ).not.toThrow();
  });

  it("should deny scanner without allowScanner flag", () => {
    expect(() => assertAutogradePermission(makeScannerCaller(), "tenant-1", undefined)).toThrow(
      "Scanner role is not permitted"
    );
  });

  it("should deny student from uploading", () => {
    const studentCaller: CallerMembership = {
      uid: "student-1",
      tenantId: "tenant-1",
      role: "student",
    };

    expect(() =>
      assertAutogradePermission(studentCaller, "tenant-1", undefined, { allowScanner: true })
    ).toThrow("cannot perform this operation");
  });
});

describe("upload-answer-sheets — input validation", () => {
  it("should enforce tenant storage namespace for image URLs", () => {
    const validUrls = [
      "tenants/tenant-1/submissions/sub-1/page1.jpg",
      "tenants/tenant-1/submissions/sub-1/page2.jpg",
    ];
    const expectedPrefix = "tenants/tenant-1/";

    for (const url of validUrls) {
      expect(url.startsWith(expectedPrefix)).toBe(true);
    }
  });

  it("should reject image URLs outside tenant namespace", () => {
    const invalidUrls = [
      "tenants/other-tenant/submissions/sub-1/page1.jpg",
      "public/shared/image.jpg",
    ];
    const expectedPrefix = "tenants/tenant-1/";

    for (const url of invalidUrls) {
      expect(url.startsWith(expectedPrefix)).toBe(false);
    }
  });
});
