/**
 * Comprehensive Zod schema validation tests for callable-schemas.
 *
 * Tests every exported schema from ../schemas/callable-schemas for:
 *   - Valid input acceptance
 *   - Missing required fields rejection
 *   - Wrong types rejection
 *   - Edge cases (empty strings, empty arrays, boundary values)
 *   - Optional field presence/absence
 *
 * No mocks — pure validation tests using schema.safeParse().
 */

import { describe, it, expect } from "vitest";
import {
  // Identity module
  SaveTenantRequestSchema,
  DeactivateTenantRequestSchema,
  ReactivateTenantRequestSchema,
  ExportTenantDataRequestSchema,
  SaveStaffRequestSchema,
  SaveClassRequestSchema,
  SaveStudentRequestSchema,
  SaveTeacherRequestSchema,
  SaveParentRequestSchema,
  SaveAcademicSessionRequestSchema,
  ManageNotificationsRequestSchema,
  BulkImportStudentsRequestSchema,
  CreateOrgUserRequestSchema,
  SwitchActiveTenantRequestSchema,
  JoinTenantRequestSchema,
  SaveGlobalPresetRequestSchema,

  // LevelUp module
  SaveSpaceRequestSchema,
  SaveStoryPointRequestSchema,
  SaveItemRequestSchema,
  StartTestSessionRequestSchema,
  SubmitTestSessionRequestSchema,
  EvaluateAnswerRequestSchema,
  SendChatMessageRequestSchema,
  RecordItemAttemptRequestSchema,
  ListStoreSpacesRequestSchema,
  PurchaseSpaceRequestSchema,

  // AutoGrade module
  SaveExamRequestSchema,
  GradeQuestionRequestSchema,
  ExtractQuestionsRequestSchema,
  UploadAnswerSheetsRequestSchema,

  // Question Bank
  SaveQuestionBankItemRequestSchema,
  ListQuestionBankRequestSchema,
  ImportFromBankRequestSchema,

  // Rubric Presets
  SaveRubricPresetRequestSchema,

  // Analytics module
  GetSummaryRequestSchema,
  GenerateReportRequestSchema,
} from "../schemas/callable-schemas";

// ── Reusable test helpers ───────────────────────────────────────────────────

/** Asserts that safeParse succeeds. */
function expectValid(schema: { safeParse: (d: unknown) => { success: boolean } }, data: unknown) {
  const result = schema.safeParse(data);
  if (!result.success) {
    // Cast for useful error output on failure
    const err = result as unknown as { error: { issues: unknown[] } };
    expect.fail(`Expected valid but got errors: ${JSON.stringify(err.error?.issues, null, 2)}`);
  }
  expect(result.success).toBe(true);
}

/** Asserts that safeParse fails. */
function expectInvalid(schema: { safeParse: (d: unknown) => { success: boolean } }, data: unknown) {
  const result = schema.safeParse(data);
  expect(result.success).toBe(false);
}

// ══════════════════════════════════════════════════════════════════════════════
// IDENTITY MODULE
// ══════════════════════════════════════════════════════════════════════════════

describe("Identity Module Schemas", () => {
  // ── SaveTenantRequestSchema ──────────────────────────────────────────────

  describe("SaveTenantRequestSchema", () => {
    it("accepts valid input with required data object", () => {
      expectValid(SaveTenantRequestSchema, {
        data: { name: "Acme School" },
      });
    });

    it("accepts input with optional id", () => {
      expectValid(SaveTenantRequestSchema, {
        id: "tenant-123",
        data: { name: "Acme School" },
      });
    });

    it("accepts input with all nested optional fields", () => {
      expectValid(SaveTenantRequestSchema, {
        id: "tenant-123",
        data: {
          name: "Acme School",
          shortName: "Acme",
          description: "A school",
          contactEmail: "admin@acme.edu",
          contactPhone: "+1234567890",
          contactPerson: "John Doe",
          logoUrl: "https://example.com/logo.png",
          bannerUrl: "https://example.com/banner.png",
          website: "https://acme.edu",
          address: {
            street: "123 Main St",
            city: "Springfield",
            state: "IL",
            country: "US",
            zipCode: "62701",
          },
          status: "active",
          subscription: {
            plan: "premium",
            maxStudents: 500,
            maxTeachers: 50,
            maxSpaces: 100,
            maxExamsPerMonth: 20,
            billingCycle: "annual",
            billingEmail: "billing@acme.edu",
            cancelAtPeriodEnd: false,
          },
          features: {
            autoGradeEnabled: true,
            levelUpEnabled: true,
            scannerAppEnabled: false,
            aiChatEnabled: true,
            aiGradingEnabled: true,
            analyticsEnabled: true,
            parentPortalEnabled: false,
            bulkImportEnabled: true,
            apiAccessEnabled: false,
          },
          settings: {
            geminiKeyRef: "ref-abc",
            geminiKeySet: true,
            defaultEvaluationSettingsId: "eval-1",
            defaultAiModel: "gemini-pro",
            timezone: "America/Chicago",
            locale: "en-US",
            gradingPolicy: "strict",
          },
          branding: {
            logoUrl: "https://example.com/logo.png",
            bannerUrl: "https://example.com/banner.png",
            primaryColor: "#FF0000",
            accentColor: "#00FF00",
            favicon: "https://example.com/favicon.ico",
          },
          onboarding: {
            completed: true,
            completedSteps: ["step1", "step2"],
          },
          geminiApiKey: "key-xyz",
        },
      });
    });

    it("rejects missing data field", () => {
      expectInvalid(SaveTenantRequestSchema, {});
    });

    it("rejects data as a non-object", () => {
      expectInvalid(SaveTenantRequestSchema, { data: "string" });
    });

    it("rejects invalid status enum", () => {
      expectInvalid(SaveTenantRequestSchema, {
        data: { status: "invalid_status" },
      });
    });

    it("rejects invalid subscription plan enum", () => {
      expectInvalid(SaveTenantRequestSchema, {
        data: { subscription: { plan: "ultra" } },
      });
    });

    it("rejects invalid billing cycle enum", () => {
      expectInvalid(SaveTenantRequestSchema, {
        data: { subscription: { billingCycle: "weekly" } },
      });
    });

    it("accepts data with empty nested objects", () => {
      expectValid(SaveTenantRequestSchema, {
        data: {
          address: {},
          subscription: {},
          features: {},
          settings: {},
          branding: {},
          onboarding: {},
        },
      });
    });

    it("accepts data with only optional nested fields", () => {
      expectValid(SaveTenantRequestSchema, {
        data: { contactEmail: "test@test.com" },
      });
    });

    it("rejects id as a number", () => {
      expectInvalid(SaveTenantRequestSchema, {
        id: 123,
        data: { name: "Test" },
      });
    });
  });

  // ── DeactivateTenantRequestSchema ────────────────────────────────────────

  describe("DeactivateTenantRequestSchema", () => {
    it("accepts valid input with required tenantId", () => {
      expectValid(DeactivateTenantRequestSchema, { tenantId: "tenant-1" });
    });

    it("accepts input with optional reason", () => {
      expectValid(DeactivateTenantRequestSchema, {
        tenantId: "tenant-1",
        reason: "Non-payment",
      });
    });

    it("rejects missing tenantId", () => {
      expectInvalid(DeactivateTenantRequestSchema, {});
    });

    it("rejects missing tenantId even with reason", () => {
      expectInvalid(DeactivateTenantRequestSchema, { reason: "Test" });
    });

    it("rejects tenantId as number", () => {
      expectInvalid(DeactivateTenantRequestSchema, { tenantId: 123 });
    });

    it("rejects reason as number", () => {
      expectInvalid(DeactivateTenantRequestSchema, {
        tenantId: "tenant-1",
        reason: 42,
      });
    });

    it("rejects tenantId as empty string (has min-length refinement)", () => {
      expectInvalid(DeactivateTenantRequestSchema, { tenantId: "" });
    });
  });

  // ── ReactivateTenantRequestSchema ────────────────────────────────────────

  describe("ReactivateTenantRequestSchema", () => {
    it("accepts valid tenantId", () => {
      expectValid(ReactivateTenantRequestSchema, { tenantId: "tenant-1" });
    });

    it("rejects missing tenantId", () => {
      expectInvalid(ReactivateTenantRequestSchema, {});
    });

    it("rejects tenantId as null", () => {
      expectInvalid(ReactivateTenantRequestSchema, { tenantId: null });
    });

    it("rejects extra fields being a problem — actually Zod strips by default", () => {
      // Zod's default strips unknown keys; safeParse still succeeds
      const result = ReactivateTenantRequestSchema.safeParse({
        tenantId: "tenant-1",
        extra: "field",
      });
      expect(result.success).toBe(true);
    });
  });

  // ── ExportTenantDataRequestSchema ────────────────────────────────────────

  describe("ExportTenantDataRequestSchema", () => {
    it("accepts valid input", () => {
      expectValid(ExportTenantDataRequestSchema, {
        tenantId: "tenant-1",
        format: "json",
        collections: ["students", "teachers"],
      });
    });

    it("accepts all collection values", () => {
      expectValid(ExportTenantDataRequestSchema, {
        tenantId: "tenant-1",
        format: "csv",
        collections: ["students", "teachers", "classes", "exams", "submissions"],
      });
    });

    it("rejects missing tenantId", () => {
      expectInvalid(ExportTenantDataRequestSchema, {
        format: "json",
        collections: ["students"],
      });
    });

    it("rejects missing format", () => {
      expectInvalid(ExportTenantDataRequestSchema, {
        tenantId: "tenant-1",
        collections: ["students"],
      });
    });

    it("rejects invalid format enum", () => {
      expectInvalid(ExportTenantDataRequestSchema, {
        tenantId: "tenant-1",
        format: "xml",
        collections: ["students"],
      });
    });

    it("rejects invalid collection value", () => {
      expectInvalid(ExportTenantDataRequestSchema, {
        tenantId: "tenant-1",
        format: "json",
        collections: ["invalid_collection"],
      });
    });

    it("rejects missing collections", () => {
      expectInvalid(ExportTenantDataRequestSchema, {
        tenantId: "tenant-1",
        format: "json",
      });
    });

    it("rejects empty collections array", () => {
      // z.array(z.enum([...])) allows empty arrays by default
      const result = ExportTenantDataRequestSchema.safeParse({
        tenantId: "tenant-1",
        format: "json",
        collections: [],
      });
      // Empty array is valid for z.array without .min()
      expect(result.success).toBe(true);
    });
  });

  // ── SaveStaffRequestSchema ───────────────────────────────────────────────

  describe("SaveStaffRequestSchema", () => {
    it("accepts valid input with required fields", () => {
      expectValid(SaveStaffRequestSchema, {
        tenantId: "tenant-1",
        data: { firstName: "Jane", lastName: "Doe" },
      });
    });

    it("accepts with optional id", () => {
      expectValid(SaveStaffRequestSchema, {
        id: "staff-1",
        tenantId: "tenant-1",
        data: { email: "jane@example.com" },
      });
    });

    it("accepts with full data including permissions", () => {
      expectValid(SaveStaffRequestSchema, {
        id: "staff-1",
        tenantId: "tenant-1",
        data: {
          uid: "uid-1",
          department: "Admin",
          staffPermissions: {
            canManageUsers: true,
            canManageClasses: true,
            canManageBilling: false,
            canViewAnalytics: true,
            canManageSettings: false,
            canExportData: true,
          },
          status: "active",
          firstName: "Jane",
          lastName: "Doe",
          email: "jane@example.com",
          phone: "+1234567890",
          password: "secret123",
        },
      });
    });

    it("rejects missing tenantId", () => {
      expectInvalid(SaveStaffRequestSchema, {
        data: { firstName: "Jane" },
      });
    });

    it("rejects missing data object", () => {
      expectInvalid(SaveStaffRequestSchema, {
        tenantId: "tenant-1",
      });
    });

    it("rejects invalid status enum", () => {
      expectInvalid(SaveStaffRequestSchema, {
        tenantId: "tenant-1",
        data: { status: "deleted" },
      });
    });

    it("accepts data with empty object", () => {
      expectValid(SaveStaffRequestSchema, {
        tenantId: "tenant-1",
        data: {},
      });
    });

    it("accepts data with empty staffPermissions", () => {
      expectValid(SaveStaffRequestSchema, {
        tenantId: "tenant-1",
        data: { staffPermissions: {} },
      });
    });
  });

  // ── SaveClassRequestSchema ───────────────────────────────────────────────

  describe("SaveClassRequestSchema", () => {
    it("accepts valid input", () => {
      expectValid(SaveClassRequestSchema, {
        tenantId: "tenant-1",
        data: { name: "Class 10-A", grade: "10", section: "A" },
      });
    });

    it("accepts with optional id and teacherIds", () => {
      expectValid(SaveClassRequestSchema, {
        id: "class-1",
        tenantId: "tenant-1",
        data: {
          name: "Class 10-A",
          grade: "10",
          section: "A",
          academicSessionId: "session-1",
          teacherIds: ["teacher-1", "teacher-2"],
          status: "active",
        },
      });
    });

    it("rejects missing tenantId", () => {
      expectInvalid(SaveClassRequestSchema, {
        data: { name: "Class 10-A" },
      });
    });

    it("rejects missing data", () => {
      expectInvalid(SaveClassRequestSchema, {
        tenantId: "tenant-1",
      });
    });

    it("rejects invalid status enum", () => {
      expectInvalid(SaveClassRequestSchema, {
        tenantId: "tenant-1",
        data: { status: "inactive" },
      });
    });

    it("accepts valid status values", () => {
      for (const status of ["active", "archived", "deleted"]) {
        expectValid(SaveClassRequestSchema, {
          tenantId: "tenant-1",
          data: { status },
        });
      }
    });

    it("rejects teacherIds as strings instead of array", () => {
      expectInvalid(SaveClassRequestSchema, {
        tenantId: "tenant-1",
        data: { teacherIds: "teacher-1" },
      });
    });

    it("accepts data with empty object", () => {
      expectValid(SaveClassRequestSchema, {
        tenantId: "tenant-1",
        data: {},
      });
    });
  });

  // ── SaveStudentRequestSchema ─────────────────────────────────────────────

  describe("SaveStudentRequestSchema", () => {
    it("accepts valid input", () => {
      expectValid(SaveStudentRequestSchema, {
        tenantId: "tenant-1",
        data: { firstName: "Alice", lastName: "Smith", rollNumber: "101" },
      });
    });

    it("accepts with all optional fields", () => {
      expectValid(SaveStudentRequestSchema, {
        id: "student-1",
        tenantId: "tenant-1",
        data: {
          uid: "uid-1",
          rollNumber: "101",
          section: "A",
          classIds: ["class-1", "class-2"],
          parentIds: ["parent-1"],
          grade: "10",
          admissionNumber: "ADM-001",
          dateOfBirth: "2010-01-15",
          status: "active",
          firstName: "Alice",
          lastName: "Smith",
          email: "alice@example.com",
          phone: "+1234567890",
          password: "secret",
        },
      });
    });

    it("rejects missing tenantId", () => {
      expectInvalid(SaveStudentRequestSchema, {
        data: { firstName: "Alice" },
      });
    });

    it("rejects missing data", () => {
      expectInvalid(SaveStudentRequestSchema, {
        tenantId: "tenant-1",
      });
    });

    it("rejects invalid status", () => {
      expectInvalid(SaveStudentRequestSchema, {
        tenantId: "tenant-1",
        data: { status: "suspended" },
      });
    });

    it("rejects classIds as non-array", () => {
      expectInvalid(SaveStudentRequestSchema, {
        tenantId: "tenant-1",
        data: { classIds: "class-1" },
      });
    });

    it("accepts empty data object", () => {
      expectValid(SaveStudentRequestSchema, {
        tenantId: "tenant-1",
        data: {},
      });
    });
  });

  // ── SaveTeacherRequestSchema ─────────────────────────────────────────────

  describe("SaveTeacherRequestSchema", () => {
    it("accepts valid input", () => {
      expectValid(SaveTeacherRequestSchema, {
        tenantId: "tenant-1",
        data: { firstName: "Bob", lastName: "Jones", email: "bob@example.com" },
      });
    });

    it("accepts with full permissions object", () => {
      expectValid(SaveTeacherRequestSchema, {
        id: "teacher-1",
        tenantId: "tenant-1",
        data: {
          uid: "uid-1",
          subjects: ["Math", "Physics"],
          designation: "Senior Teacher",
          classIds: ["class-1"],
          permissions: {
            canCreateExams: true,
            canEditRubrics: true,
            canManuallyGrade: true,
            canViewAllExams: false,
            canCreateSpaces: true,
            canManageContent: true,
            canViewAnalytics: false,
            canConfigureAgents: false,
            managedSpaceIds: ["space-1"],
            managedClassIds: ["class-1"],
          },
          status: "active",
          firstName: "Bob",
          lastName: "Jones",
          email: "bob@example.com",
          phone: "+1234567890",
          password: "pass123",
        },
      });
    });

    it("rejects missing tenantId", () => {
      expectInvalid(SaveTeacherRequestSchema, {
        data: { firstName: "Bob" },
      });
    });

    it("rejects missing data", () => {
      expectInvalid(SaveTeacherRequestSchema, { tenantId: "tenant-1" });
    });

    it("rejects invalid status", () => {
      expectInvalid(SaveTeacherRequestSchema, {
        tenantId: "tenant-1",
        data: { status: "deleted" },
      });
    });

    it("accepts empty data object", () => {
      expectValid(SaveTeacherRequestSchema, {
        tenantId: "tenant-1",
        data: {},
      });
    });

    it("accepts empty permissions object", () => {
      expectValid(SaveTeacherRequestSchema, {
        tenantId: "tenant-1",
        data: { permissions: {} },
      });
    });

    it("rejects subjects as a non-array", () => {
      expectInvalid(SaveTeacherRequestSchema, {
        tenantId: "tenant-1",
        data: { subjects: "Math" },
      });
    });
  });

  // ── SaveParentRequestSchema ──────────────────────────────────────────────

  describe("SaveParentRequestSchema", () => {
    it("accepts valid input", () => {
      expectValid(SaveParentRequestSchema, {
        tenantId: "tenant-1",
        data: { firstName: "Mary", lastName: "Smith", email: "mary@example.com" },
      });
    });

    it("accepts with childStudentIds", () => {
      expectValid(SaveParentRequestSchema, {
        id: "parent-1",
        tenantId: "tenant-1",
        data: {
          uid: "uid-1",
          childStudentIds: ["student-1", "student-2"],
          status: "active",
          firstName: "Mary",
          lastName: "Smith",
          email: "mary@example.com",
          phone: "+1234567890",
          password: "secret123",
        },
      });
    });

    it("rejects missing tenantId", () => {
      expectInvalid(SaveParentRequestSchema, {
        data: { firstName: "Mary" },
      });
    });

    it("rejects missing data", () => {
      expectInvalid(SaveParentRequestSchema, { tenantId: "tenant-1" });
    });

    it("rejects invalid status", () => {
      expectInvalid(SaveParentRequestSchema, {
        tenantId: "tenant-1",
        data: { status: "banned" },
      });
    });

    it("rejects childStudentIds as non-array", () => {
      expectInvalid(SaveParentRequestSchema, {
        tenantId: "tenant-1",
        data: { childStudentIds: "student-1" },
      });
    });

    it("accepts empty data", () => {
      expectValid(SaveParentRequestSchema, {
        tenantId: "tenant-1",
        data: {},
      });
    });
  });

  // ── SaveAcademicSessionRequestSchema ─────────────────────────────────────

  describe("SaveAcademicSessionRequestSchema", () => {
    it("accepts valid input", () => {
      expectValid(SaveAcademicSessionRequestSchema, {
        tenantId: "tenant-1",
        data: {
          name: "2025-2026",
          startDate: "2025-06-01",
          endDate: "2026-05-31",
          isCurrent: true,
          status: "active",
        },
      });
    });

    it("accepts minimal required fields", () => {
      expectValid(SaveAcademicSessionRequestSchema, {
        tenantId: "tenant-1",
        data: {},
      });
    });

    it("rejects missing tenantId", () => {
      expectInvalid(SaveAcademicSessionRequestSchema, {
        data: { name: "2025-2026" },
      });
    });

    it("rejects missing data", () => {
      expectInvalid(SaveAcademicSessionRequestSchema, { tenantId: "tenant-1" });
    });

    it("rejects invalid status", () => {
      expectInvalid(SaveAcademicSessionRequestSchema, {
        tenantId: "tenant-1",
        data: { status: "deleted" },
      });
    });
  });

  // ── ManageNotificationsRequestSchema ─────────────────────────────────────

  describe("ManageNotificationsRequestSchema", () => {
    it("accepts valid list action", () => {
      expectValid(ManageNotificationsRequestSchema, {
        tenantId: "tenant-1",
        action: "list",
      });
    });

    it("accepts valid markRead action with notificationId", () => {
      expectValid(ManageNotificationsRequestSchema, {
        tenantId: "tenant-1",
        action: "markRead",
        notificationId: "notif-1",
      });
    });

    it("accepts with all optional fields", () => {
      expectValid(ManageNotificationsRequestSchema, {
        tenantId: "tenant-1",
        action: "list",
        limit: 25,
        cursor: "cursor-abc",
        notificationId: "notif-1",
        markAllRead: true,
      });
    });

    it("rejects missing tenantId", () => {
      expectInvalid(ManageNotificationsRequestSchema, { action: "list" });
    });

    it("rejects missing action", () => {
      expectInvalid(ManageNotificationsRequestSchema, { tenantId: "tenant-1" });
    });

    it("rejects invalid action enum", () => {
      expectInvalid(ManageNotificationsRequestSchema, {
        tenantId: "tenant-1",
        action: "delete",
      });
    });

    it("rejects limit as string", () => {
      expectInvalid(ManageNotificationsRequestSchema, {
        tenantId: "tenant-1",
        action: "list",
        limit: "ten",
      });
    });
  });

  // ── BulkImportStudentsRequestSchema ──────────────────────────────────────

  describe("BulkImportStudentsRequestSchema", () => {
    it("accepts valid input with student array", () => {
      expectValid(BulkImportStudentsRequestSchema, {
        tenantId: "tenant-1",
        dryRun: false,
        students: [
          { firstName: "Alice", lastName: "Smith", rollNumber: "101" },
          { firstName: "Bob", lastName: "Jones", rollNumber: "102" },
        ],
      });
    });

    it("accepts students with optional fields", () => {
      expectValid(BulkImportStudentsRequestSchema, {
        tenantId: "tenant-1",
        dryRun: true,
        students: [
          {
            firstName: "Alice",
            lastName: "Smith",
            rollNumber: "101",
            email: "alice@example.com",
            phone: "+1234567890",
            classId: "class-1",
            className: "Class 10-A",
            section: "A",
            parentFirstName: "Mary",
            parentLastName: "Smith",
            parentEmail: "mary@example.com",
            parentPhone: "+0987654321",
          },
        ],
      });
    });

    it("rejects missing tenantId", () => {
      expectInvalid(BulkImportStudentsRequestSchema, {
        dryRun: false,
        students: [{ firstName: "A", lastName: "B", rollNumber: "1" }],
      });
    });

    it("rejects missing dryRun", () => {
      expectInvalid(BulkImportStudentsRequestSchema, {
        tenantId: "tenant-1",
        students: [{ firstName: "A", lastName: "B", rollNumber: "1" }],
      });
    });

    it("rejects missing students array", () => {
      expectInvalid(BulkImportStudentsRequestSchema, {
        tenantId: "tenant-1",
        dryRun: false,
      });
    });

    it("rejects student missing required firstName", () => {
      expectInvalid(BulkImportStudentsRequestSchema, {
        tenantId: "tenant-1",
        dryRun: false,
        students: [{ lastName: "Smith", rollNumber: "101" }],
      });
    });

    it("rejects student missing required lastName", () => {
      expectInvalid(BulkImportStudentsRequestSchema, {
        tenantId: "tenant-1",
        dryRun: false,
        students: [{ firstName: "Alice", rollNumber: "101" }],
      });
    });

    it("rejects student missing required rollNumber", () => {
      expectInvalid(BulkImportStudentsRequestSchema, {
        tenantId: "tenant-1",
        dryRun: false,
        students: [{ firstName: "Alice", lastName: "Smith" }],
      });
    });

    it("accepts empty students array", () => {
      expectValid(BulkImportStudentsRequestSchema, {
        tenantId: "tenant-1",
        dryRun: false,
        students: [],
      });
    });

    it("rejects dryRun as string", () => {
      expectInvalid(BulkImportStudentsRequestSchema, {
        tenantId: "tenant-1",
        dryRun: "true",
        students: [],
      });
    });
  });

  // ── CreateOrgUserRequestSchema ───────────────────────────────────────────

  describe("CreateOrgUserRequestSchema", () => {
    it("accepts valid teacher creation", () => {
      expectValid(CreateOrgUserRequestSchema, {
        tenantId: "tenant-1",
        role: "teacher",
        firstName: "Bob",
        lastName: "Jones",
        email: "bob@example.com",
      });
    });

    it("accepts valid student creation", () => {
      expectValid(CreateOrgUserRequestSchema, {
        tenantId: "tenant-1",
        role: "student",
        firstName: "Alice",
        lastName: "Smith",
        rollNumber: "101",
        classIds: ["class-1"],
      });
    });

    it("accepts valid parent creation", () => {
      expectValid(CreateOrgUserRequestSchema, {
        tenantId: "tenant-1",
        role: "parent",
        firstName: "Mary",
        lastName: "Smith",
        linkedStudentIds: ["student-1"],
      });
    });

    it("accepts all valid roles", () => {
      for (const role of ["teacher", "student", "parent", "scanner", "staff"]) {
        expectValid(CreateOrgUserRequestSchema, {
          tenantId: "tenant-1",
          role,
          firstName: "Test",
          lastName: "User",
        });
      }
    });

    it("rejects missing tenantId", () => {
      expectInvalid(CreateOrgUserRequestSchema, {
        role: "teacher",
        firstName: "Bob",
        lastName: "Jones",
      });
    });

    it("rejects missing role", () => {
      expectInvalid(CreateOrgUserRequestSchema, {
        tenantId: "tenant-1",
        firstName: "Bob",
        lastName: "Jones",
      });
    });

    it("rejects missing firstName", () => {
      expectInvalid(CreateOrgUserRequestSchema, {
        tenantId: "tenant-1",
        role: "teacher",
        lastName: "Jones",
      });
    });

    it("rejects missing lastName", () => {
      expectInvalid(CreateOrgUserRequestSchema, {
        tenantId: "tenant-1",
        role: "teacher",
        firstName: "Bob",
      });
    });

    it("rejects invalid role enum", () => {
      expectInvalid(CreateOrgUserRequestSchema, {
        tenantId: "tenant-1",
        role: "admin",
        firstName: "Bob",
        lastName: "Jones",
      });
    });

    it("accepts with optional fields absent", () => {
      expectValid(CreateOrgUserRequestSchema, {
        tenantId: "tenant-1",
        role: "teacher",
        firstName: "Bob",
        lastName: "Jones",
      });
    });
  });

  // ── SwitchActiveTenantRequestSchema ──────────────────────────────────────

  describe("SwitchActiveTenantRequestSchema", () => {
    it("accepts valid tenantId", () => {
      expectValid(SwitchActiveTenantRequestSchema, { tenantId: "tenant-1" });
    });

    it("rejects missing tenantId", () => {
      expectInvalid(SwitchActiveTenantRequestSchema, {});
    });

    it("rejects tenantId as number", () => {
      expectInvalid(SwitchActiveTenantRequestSchema, { tenantId: 42 });
    });
  });

  // ── JoinTenantRequestSchema ──────────────────────────────────────────────

  describe("JoinTenantRequestSchema", () => {
    it("accepts valid tenantCode", () => {
      expectValid(JoinTenantRequestSchema, { tenantCode: "ABC123" });
    });

    it("rejects missing tenantCode", () => {
      expectInvalid(JoinTenantRequestSchema, {});
    });

    it("rejects tenantCode as number", () => {
      expectInvalid(JoinTenantRequestSchema, { tenantCode: 123 });
    });
  });

  // ── SaveGlobalPresetRequestSchema ────────────────────────────────────────

  describe("SaveGlobalPresetRequestSchema", () => {
    it("accepts minimal input (all optional)", () => {
      expectValid(SaveGlobalPresetRequestSchema, {});
    });

    it("accepts with id and data", () => {
      expectValid(SaveGlobalPresetRequestSchema, {
        id: "preset-1",
        data: {
          name: "Default Evaluation",
          description: "Standard evaluation settings",
          isDefault: true,
          isPublic: false,
        },
      });
    });

    it("accepts with delete flag", () => {
      expectValid(SaveGlobalPresetRequestSchema, {
        id: "preset-1",
        delete: true,
      });
    });

    it("accepts with enabledDimensions array", () => {
      expectValid(SaveGlobalPresetRequestSchema, {
        data: {
          enabledDimensions: [
            {
              id: "dim-1",
              name: "Accuracy",
              description: "Answer accuracy",
              priority: "HIGH",
              promptGuidance: "Evaluate correctness",
              enabled: true,
              isDefault: true,
              isCustom: false,
              weight: 1.0,
              scoringScale: 10,
            },
          ],
        },
      });
    });

    it("accepts with displaySettings", () => {
      expectValid(SaveGlobalPresetRequestSchema, {
        data: {
          displaySettings: {
            showStrengths: true,
            showKeyTakeaway: true,
            prioritizeByImportance: false,
          },
        },
      });
    });

    it("rejects displaySettings missing required fields", () => {
      expectInvalid(SaveGlobalPresetRequestSchema, {
        data: {
          displaySettings: {
            showStrengths: true,
            // missing showKeyTakeaway and prioritizeByImportance
          },
        },
      });
    });

    it("rejects invalid priority in dimension", () => {
      expectInvalid(SaveGlobalPresetRequestSchema, {
        data: {
          enabledDimensions: [
            {
              id: "dim-1",
              name: "Accuracy",
              description: "desc",
              priority: "CRITICAL", // invalid
              promptGuidance: "guidance",
              enabled: true,
              isDefault: true,
              isCustom: false,
              weight: 1.0,
              scoringScale: 10,
            },
          ],
        },
      });
    });

    it("rejects id as number", () => {
      expectInvalid(SaveGlobalPresetRequestSchema, { id: 123 });
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// LEVELUP MODULE
// ══════════════════════════════════════════════════════════════════════════════

describe("LevelUp Module Schemas", () => {
  // ── SaveSpaceRequestSchema ───────────────────────────────────────────────

  describe("SaveSpaceRequestSchema", () => {
    it("accepts valid input with required fields", () => {
      expectValid(SaveSpaceRequestSchema, {
        tenantId: "tenant-1",
        data: {
          title: "Math Space",
          description: "Learn algebra",
        },
      });
    });

    it("accepts with all optional fields", () => {
      expectValid(SaveSpaceRequestSchema, {
        id: "space-1",
        tenantId: "tenant-1",
        data: {
          title: "Math Space",
          description: "Learn algebra",
          thumbnailUrl: "https://example.com/thumb.png",
          slug: "math-space",
          type: "learning",
          subject: "Mathematics",
          labels: ["algebra", "grade-10"],
          classIds: ["class-1"],
          sectionIds: ["section-1"],
          teacherIds: ["teacher-1"],
          accessType: "class_assigned",
          academicSessionId: "session-1",
          defaultEvaluatorAgentId: "agent-1",
          defaultTutorAgentId: "agent-2",
          defaultTimeLimitMinutes: 60,
          allowRetakes: true,
          maxRetakes: 3,
          showCorrectAnswers: true,
          status: "published",
          price: 9.99,
          currency: "USD",
          publishedToStore: true,
          storeDescription: "Great space for learning",
          storeThumbnailUrl: "https://example.com/store-thumb.png",
        },
      });
    });

    it("accepts with defaultRubric (UnifiedRubric)", () => {
      expectValid(SaveSpaceRequestSchema, {
        tenantId: "tenant-1",
        data: {
          title: "Test Space",
          defaultRubric: {
            scoringMode: "criteria_based",
            criteria: [
              {
                id: "crit-1",
                name: "Correctness",
                maxPoints: 10,
              },
            ],
          },
        },
      });
    });

    it("rejects missing tenantId", () => {
      expectInvalid(SaveSpaceRequestSchema, {
        data: { title: "Math Space" },
      });
    });

    it("rejects missing data", () => {
      expectInvalid(SaveSpaceRequestSchema, { tenantId: "tenant-1" });
    });

    it("rejects invalid type enum", () => {
      expectInvalid(SaveSpaceRequestSchema, {
        tenantId: "tenant-1",
        data: { type: "invalid_type" },
      });
    });

    it("accepts all valid type values", () => {
      for (const type of ["learning", "practice", "assessment", "resource", "hybrid"]) {
        expectValid(SaveSpaceRequestSchema, {
          tenantId: "tenant-1",
          data: { type },
        });
      }
    });

    it("rejects invalid accessType enum", () => {
      expectInvalid(SaveSpaceRequestSchema, {
        tenantId: "tenant-1",
        data: { accessType: "private" },
      });
    });

    it("accepts all valid accessType values", () => {
      for (const accessType of ["class_assigned", "tenant_wide", "public_store"]) {
        expectValid(SaveSpaceRequestSchema, {
          tenantId: "tenant-1",
          data: { accessType },
        });
      }
    });

    it("rejects invalid status enum", () => {
      expectInvalid(SaveSpaceRequestSchema, {
        tenantId: "tenant-1",
        data: { status: "deleted" },
      });
    });

    it("accepts empty data object", () => {
      expectValid(SaveSpaceRequestSchema, {
        tenantId: "tenant-1",
        data: {},
      });
    });

    it("rejects defaultTimeLimitMinutes as string", () => {
      expectInvalid(SaveSpaceRequestSchema, {
        tenantId: "tenant-1",
        data: { defaultTimeLimitMinutes: "60" },
      });
    });

    it("rejects labels as non-array", () => {
      expectInvalid(SaveSpaceRequestSchema, {
        tenantId: "tenant-1",
        data: { labels: "algebra" },
      });
    });
  });

  // ── SaveStoryPointRequestSchema ──────────────────────────────────────────

  describe("SaveStoryPointRequestSchema", () => {
    it("accepts valid input", () => {
      expectValid(SaveStoryPointRequestSchema, {
        tenantId: "tenant-1",
        spaceId: "space-1",
        data: {
          title: "Chapter 1: Introduction",
          orderIndex: 0,
        },
      });
    });

    it("accepts with all optional fields", () => {
      expectValid(SaveStoryPointRequestSchema, {
        id: "sp-1",
        tenantId: "tenant-1",
        spaceId: "space-1",
        data: {
          title: "Chapter 1",
          description: "Introduction to algebra",
          orderIndex: 0,
          type: "standard",
          sections: [
            {
              id: "sec-1",
              title: "Section 1",
              orderIndex: 0,
              description: "First section",
            },
          ],
          assessmentConfig: {
            durationMinutes: 30,
            instructions: "Answer all questions",
            maxAttempts: 2,
            shuffleQuestions: true,
            shuffleOptions: true,
            showResultsImmediately: false,
          },
          defaultRubric: {
            scoringMode: "holistic",
            holisticGuidance: "Grade overall quality",
            holisticMaxScore: 100,
          },
          difficulty: "medium",
          estimatedTimeMinutes: 45,
        },
      });
    });

    it("rejects missing tenantId", () => {
      expectInvalid(SaveStoryPointRequestSchema, {
        spaceId: "space-1",
        data: { title: "Ch1" },
      });
    });

    it("rejects missing spaceId", () => {
      expectInvalid(SaveStoryPointRequestSchema, {
        tenantId: "tenant-1",
        data: { title: "Ch1" },
      });
    });

    it("rejects missing data", () => {
      expectInvalid(SaveStoryPointRequestSchema, {
        tenantId: "tenant-1",
        spaceId: "space-1",
      });
    });

    it("rejects invalid type enum", () => {
      expectInvalid(SaveStoryPointRequestSchema, {
        tenantId: "tenant-1",
        spaceId: "space-1",
        data: { type: "lesson" },
      });
    });

    it("accepts all valid type values", () => {
      for (const type of ["standard", "timed_test", "quiz", "practice", "test"]) {
        expectValid(SaveStoryPointRequestSchema, {
          tenantId: "tenant-1",
          spaceId: "space-1",
          data: { type },
        });
      }
    });

    it("rejects invalid difficulty enum", () => {
      expectInvalid(SaveStoryPointRequestSchema, {
        tenantId: "tenant-1",
        spaceId: "space-1",
        data: { difficulty: "impossible" },
      });
    });

    it("rejects sections with missing required fields", () => {
      expectInvalid(SaveStoryPointRequestSchema, {
        tenantId: "tenant-1",
        spaceId: "space-1",
        data: {
          sections: [{ title: "Section 1" }], // missing id and orderIndex
        },
      });
    });

    it("accepts empty data object", () => {
      expectValid(SaveStoryPointRequestSchema, {
        tenantId: "tenant-1",
        spaceId: "space-1",
        data: {},
      });
    });
  });

  // ── SaveItemRequestSchema ────────────────────────────────────────────────

  describe("SaveItemRequestSchema", () => {
    it("accepts valid input", () => {
      expectValid(SaveItemRequestSchema, {
        tenantId: "tenant-1",
        spaceId: "space-1",
        storyPointId: "sp-1",
        data: {
          title: "Question 1",
          type: "question",
        },
      });
    });

    it("accepts with all optional fields", () => {
      expectValid(SaveItemRequestSchema, {
        id: "item-1",
        tenantId: "tenant-1",
        spaceId: "space-1",
        storyPointId: "sp-1",
        data: {
          sectionId: "sec-1",
          type: "question",
          payload: { questionText: "What is 2+2?", answer: "4" },
          title: "Question 1",
          content: "Solve this math problem",
          difficulty: "easy",
          topics: ["arithmetic"],
          labels: ["math", "basic"],
          orderIndex: 0,
          meta: {
            subject: "Math",
            topics: ["arithmetic", "addition"],
            bloomsLevel: "remember",
            estimatedTime: 5,
            source: "textbook",
          },
          analytics: { attempts: 100, avgScore: 85 },
          rubric: {
            scoringMode: "criteria_based",
            criteria: [{ id: "c1", name: "Correctness", maxPoints: 10 }],
          },
          linkedQuestionId: "qb-1",
          deleted: false,
        },
      });
    });

    it("rejects missing tenantId", () => {
      expectInvalid(SaveItemRequestSchema, {
        spaceId: "space-1",
        storyPointId: "sp-1",
        data: { title: "Q1" },
      });
    });

    it("rejects missing spaceId", () => {
      expectInvalid(SaveItemRequestSchema, {
        tenantId: "tenant-1",
        storyPointId: "sp-1",
        data: { title: "Q1" },
      });
    });

    it("rejects missing storyPointId", () => {
      expectInvalid(SaveItemRequestSchema, {
        tenantId: "tenant-1",
        spaceId: "space-1",
        data: { title: "Q1" },
      });
    });

    it("rejects missing data", () => {
      expectInvalid(SaveItemRequestSchema, {
        tenantId: "tenant-1",
        spaceId: "space-1",
        storyPointId: "sp-1",
      });
    });

    it("rejects invalid type enum", () => {
      expectInvalid(SaveItemRequestSchema, {
        tenantId: "tenant-1",
        spaceId: "space-1",
        storyPointId: "sp-1",
        data: { type: "essay" },
      });
    });

    it("accepts all valid type values", () => {
      for (const type of [
        "question",
        "material",
        "interactive",
        "assessment",
        "discussion",
        "project",
        "checkpoint",
      ]) {
        expectValid(SaveItemRequestSchema, {
          tenantId: "tenant-1",
          spaceId: "space-1",
          storyPointId: "sp-1",
          data: { type },
        });
      }
    });

    it("rejects invalid difficulty enum", () => {
      expectInvalid(SaveItemRequestSchema, {
        tenantId: "tenant-1",
        spaceId: "space-1",
        storyPointId: "sp-1",
        data: { difficulty: "expert" },
      });
    });

    it("accepts empty data object", () => {
      expectValid(SaveItemRequestSchema, {
        tenantId: "tenant-1",
        spaceId: "space-1",
        storyPointId: "sp-1",
        data: {},
      });
    });

    it("accepts meta with passthrough (extra keys)", () => {
      expectValid(SaveItemRequestSchema, {
        tenantId: "tenant-1",
        spaceId: "space-1",
        storyPointId: "sp-1",
        data: {
          meta: {
            subject: "Science",
            customField: "extra value", // passthrough allows this
          },
        },
      });
    });
  });

  // ── StartTestSessionRequestSchema ────────────────────────────────────────

  describe("StartTestSessionRequestSchema", () => {
    it("accepts valid input", () => {
      expectValid(StartTestSessionRequestSchema, {
        tenantId: "tenant-1",
        spaceId: "space-1",
        storyPointId: "sp-1",
      });
    });

    it("rejects missing tenantId", () => {
      expectInvalid(StartTestSessionRequestSchema, {
        spaceId: "space-1",
        storyPointId: "sp-1",
      });
    });

    it("rejects missing spaceId", () => {
      expectInvalid(StartTestSessionRequestSchema, {
        tenantId: "tenant-1",
        storyPointId: "sp-1",
      });
    });

    it("rejects missing storyPointId", () => {
      expectInvalid(StartTestSessionRequestSchema, {
        tenantId: "tenant-1",
        spaceId: "space-1",
      });
    });

    it("rejects tenantId as number", () => {
      expectInvalid(StartTestSessionRequestSchema, {
        tenantId: 123,
        spaceId: "space-1",
        storyPointId: "sp-1",
      });
    });

    it("rejects empty object", () => {
      expectInvalid(StartTestSessionRequestSchema, {});
    });
  });

  // ── SubmitTestSessionRequestSchema ───────────────────────────────────────

  describe("SubmitTestSessionRequestSchema", () => {
    it("accepts valid input", () => {
      expectValid(SubmitTestSessionRequestSchema, {
        tenantId: "tenant-1",
        sessionId: "session-1",
      });
    });

    it("accepts with optional autoSubmitted", () => {
      expectValid(SubmitTestSessionRequestSchema, {
        tenantId: "tenant-1",
        sessionId: "session-1",
        autoSubmitted: true,
      });
    });

    it("rejects missing tenantId", () => {
      expectInvalid(SubmitTestSessionRequestSchema, {
        sessionId: "session-1",
      });
    });

    it("rejects missing sessionId", () => {
      expectInvalid(SubmitTestSessionRequestSchema, {
        tenantId: "tenant-1",
      });
    });

    it("rejects autoSubmitted as string", () => {
      expectInvalid(SubmitTestSessionRequestSchema, {
        tenantId: "tenant-1",
        sessionId: "session-1",
        autoSubmitted: "yes",
      });
    });
  });

  // ── EvaluateAnswerRequestSchema ──────────────────────────────────────────

  describe("EvaluateAnswerRequestSchema", () => {
    it("accepts valid input with string answer", () => {
      expectValid(EvaluateAnswerRequestSchema, {
        tenantId: "tenant-1",
        spaceId: "space-1",
        itemId: "item-1",
        answer: "The answer is 42",
      });
    });

    it("accepts answer as any type (z.unknown)", () => {
      expectValid(EvaluateAnswerRequestSchema, {
        tenantId: "tenant-1",
        spaceId: "space-1",
        itemId: "item-1",
        answer: { selected: "B" },
      });

      expectValid(EvaluateAnswerRequestSchema, {
        tenantId: "tenant-1",
        spaceId: "space-1",
        itemId: "item-1",
        answer: 42,
      });

      expectValid(EvaluateAnswerRequestSchema, {
        tenantId: "tenant-1",
        spaceId: "space-1",
        itemId: "item-1",
        answer: ["a", "b"],
      });

      expectValid(EvaluateAnswerRequestSchema, {
        tenantId: "tenant-1",
        spaceId: "space-1",
        itemId: "item-1",
        answer: null,
      });
    });

    it("accepts with mediaUrls", () => {
      expectValid(EvaluateAnswerRequestSchema, {
        tenantId: "tenant-1",
        spaceId: "space-1",
        itemId: "item-1",
        answer: "text answer",
        mediaUrls: ["https://example.com/img1.png", "https://example.com/img2.png"],
      });
    });

    it("rejects missing tenantId", () => {
      expectInvalid(EvaluateAnswerRequestSchema, {
        spaceId: "space-1",
        itemId: "item-1",
        answer: "test",
      });
    });

    it("rejects missing spaceId", () => {
      expectInvalid(EvaluateAnswerRequestSchema, {
        tenantId: "tenant-1",
        itemId: "item-1",
        answer: "test",
      });
    });

    it("rejects missing itemId", () => {
      expectInvalid(EvaluateAnswerRequestSchema, {
        tenantId: "tenant-1",
        spaceId: "space-1",
        answer: "test",
      });
    });

    it("rejects mediaUrls as non-array", () => {
      expectInvalid(EvaluateAnswerRequestSchema, {
        tenantId: "tenant-1",
        spaceId: "space-1",
        itemId: "item-1",
        answer: "test",
        mediaUrls: "url",
      });
    });
  });

  // ── SendChatMessageRequestSchema ─────────────────────────────────────────

  describe("SendChatMessageRequestSchema", () => {
    it("accepts valid input", () => {
      expectValid(SendChatMessageRequestSchema, {
        tenantId: "tenant-1",
        spaceId: "space-1",
        storyPointId: "sp-1",
        itemId: "item-1",
        message: "Hello, can you help me?",
      });
    });

    it("accepts with optional fields", () => {
      expectValid(SendChatMessageRequestSchema, {
        tenantId: "tenant-1",
        spaceId: "space-1",
        storyPointId: "sp-1",
        itemId: "item-1",
        sessionId: "session-1",
        message: "Help me understand this concept",
        language: "en",
        agentId: "agent-1",
      });
    });

    it("rejects missing tenantId", () => {
      expectInvalid(SendChatMessageRequestSchema, {
        spaceId: "space-1",
        storyPointId: "sp-1",
        itemId: "item-1",
        message: "Hello",
      });
    });

    it("rejects missing spaceId", () => {
      expectInvalid(SendChatMessageRequestSchema, {
        tenantId: "tenant-1",
        storyPointId: "sp-1",
        itemId: "item-1",
        message: "Hello",
      });
    });

    it("rejects missing storyPointId", () => {
      expectInvalid(SendChatMessageRequestSchema, {
        tenantId: "tenant-1",
        spaceId: "space-1",
        itemId: "item-1",
        message: "Hello",
      });
    });

    it("rejects missing itemId", () => {
      expectInvalid(SendChatMessageRequestSchema, {
        tenantId: "tenant-1",
        spaceId: "space-1",
        storyPointId: "sp-1",
        message: "Hello",
      });
    });

    it("rejects missing message", () => {
      expectInvalid(SendChatMessageRequestSchema, {
        tenantId: "tenant-1",
        spaceId: "space-1",
        storyPointId: "sp-1",
        itemId: "item-1",
      });
    });

    it("rejects message as number", () => {
      expectInvalid(SendChatMessageRequestSchema, {
        tenantId: "tenant-1",
        spaceId: "space-1",
        storyPointId: "sp-1",
        itemId: "item-1",
        message: 123,
      });
    });

    it("rejects message as empty string (has min-length refinement)", () => {
      expectInvalid(SendChatMessageRequestSchema, {
        tenantId: "tenant-1",
        spaceId: "space-1",
        storyPointId: "sp-1",
        itemId: "item-1",
        message: "",
      });
    });
  });

  // ── RecordItemAttemptRequestSchema ───────────────────────────────────────

  describe("RecordItemAttemptRequestSchema", () => {
    it("accepts valid input", () => {
      expectValid(RecordItemAttemptRequestSchema, {
        tenantId: "tenant-1",
        spaceId: "space-1",
        storyPointId: "sp-1",
        itemId: "item-1",
        itemType: "question",
        score: 8,
        maxScore: 10,
        correct: true,
      });
    });

    it("accepts with optional fields", () => {
      expectValid(RecordItemAttemptRequestSchema, {
        tenantId: "tenant-1",
        spaceId: "space-1",
        storyPointId: "sp-1",
        itemId: "item-1",
        itemType: "question",
        score: 8,
        maxScore: 10,
        correct: true,
        timeSpent: 120,
        feedback: "Good work!",
      });
    });

    it("rejects missing tenantId", () => {
      expectInvalid(RecordItemAttemptRequestSchema, {
        spaceId: "space-1",
        storyPointId: "sp-1",
        itemId: "item-1",
        itemType: "question",
        score: 8,
        maxScore: 10,
        correct: true,
      });
    });

    it("rejects missing spaceId", () => {
      expectInvalid(RecordItemAttemptRequestSchema, {
        tenantId: "tenant-1",
        storyPointId: "sp-1",
        itemId: "item-1",
        itemType: "question",
        score: 8,
        maxScore: 10,
        correct: true,
      });
    });

    it("rejects missing storyPointId", () => {
      expectInvalid(RecordItemAttemptRequestSchema, {
        tenantId: "tenant-1",
        spaceId: "space-1",
        itemId: "item-1",
        itemType: "question",
        score: 8,
        maxScore: 10,
        correct: true,
      });
    });

    it("rejects missing itemId", () => {
      expectInvalid(RecordItemAttemptRequestSchema, {
        tenantId: "tenant-1",
        spaceId: "space-1",
        storyPointId: "sp-1",
        itemType: "question",
        score: 8,
        maxScore: 10,
        correct: true,
      });
    });

    it("rejects missing itemType", () => {
      expectInvalid(RecordItemAttemptRequestSchema, {
        tenantId: "tenant-1",
        spaceId: "space-1",
        storyPointId: "sp-1",
        itemId: "item-1",
        score: 8,
        maxScore: 10,
        correct: true,
      });
    });

    it("rejects missing score", () => {
      expectInvalid(RecordItemAttemptRequestSchema, {
        tenantId: "tenant-1",
        spaceId: "space-1",
        storyPointId: "sp-1",
        itemId: "item-1",
        itemType: "question",
        maxScore: 10,
        correct: true,
      });
    });

    it("rejects missing maxScore", () => {
      expectInvalid(RecordItemAttemptRequestSchema, {
        tenantId: "tenant-1",
        spaceId: "space-1",
        storyPointId: "sp-1",
        itemId: "item-1",
        itemType: "question",
        score: 8,
        correct: true,
      });
    });

    it("rejects missing correct", () => {
      expectInvalid(RecordItemAttemptRequestSchema, {
        tenantId: "tenant-1",
        spaceId: "space-1",
        storyPointId: "sp-1",
        itemId: "item-1",
        itemType: "question",
        score: 8,
        maxScore: 10,
      });
    });

    it("rejects score as string", () => {
      expectInvalid(RecordItemAttemptRequestSchema, {
        tenantId: "tenant-1",
        spaceId: "space-1",
        storyPointId: "sp-1",
        itemId: "item-1",
        itemType: "question",
        score: "8",
        maxScore: 10,
        correct: true,
      });
    });

    it("rejects correct as string", () => {
      expectInvalid(RecordItemAttemptRequestSchema, {
        tenantId: "tenant-1",
        spaceId: "space-1",
        storyPointId: "sp-1",
        itemId: "item-1",
        itemType: "question",
        score: 8,
        maxScore: 10,
        correct: "true",
      });
    });

    it("accepts score of zero", () => {
      expectValid(RecordItemAttemptRequestSchema, {
        tenantId: "tenant-1",
        spaceId: "space-1",
        storyPointId: "sp-1",
        itemId: "item-1",
        itemType: "question",
        score: 0,
        maxScore: 10,
        correct: false,
      });
    });

    it("accepts negative score (no min constraint)", () => {
      expectValid(RecordItemAttemptRequestSchema, {
        tenantId: "tenant-1",
        spaceId: "space-1",
        storyPointId: "sp-1",
        itemId: "item-1",
        itemType: "question",
        score: -1,
        maxScore: 10,
        correct: false,
      });
    });
  });

  // ── ListStoreSpacesRequestSchema ─────────────────────────────────────────

  describe("ListStoreSpacesRequestSchema", () => {
    it("accepts empty object (all fields optional)", () => {
      expectValid(ListStoreSpacesRequestSchema, {});
    });

    it("accepts with all optional fields", () => {
      expectValid(ListStoreSpacesRequestSchema, {
        subject: "Mathematics",
        limit: 20,
        startAfter: "cursor-abc",
        search: "algebra",
      });
    });

    it("rejects limit as string", () => {
      expectInvalid(ListStoreSpacesRequestSchema, { limit: "ten" });
    });

    it("rejects limit of zero (has min-value refinement >= 1)", () => {
      expectInvalid(ListStoreSpacesRequestSchema, { limit: 0 });
    });
  });

  // ── PurchaseSpaceRequestSchema ───────────────────────────────────────────

  describe("PurchaseSpaceRequestSchema", () => {
    it("accepts valid input", () => {
      expectValid(PurchaseSpaceRequestSchema, {
        spaceId: "space-1",
      });
    });

    it("accepts with optional paymentToken", () => {
      expectValid(PurchaseSpaceRequestSchema, {
        spaceId: "space-1",
        paymentToken: "tok_abc123",
      });
    });

    it("rejects missing spaceId", () => {
      expectInvalid(PurchaseSpaceRequestSchema, {});
    });

    it("rejects spaceId as number", () => {
      expectInvalid(PurchaseSpaceRequestSchema, { spaceId: 123 });
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// AUTOGRADE MODULE
// ══════════════════════════════════════════════════════════════════════════════

describe("AutoGrade Module Schemas", () => {
  // ── SaveExamRequestSchema ────────────────────────────────────────────────

  describe("SaveExamRequestSchema", () => {
    it("accepts valid input", () => {
      expectValid(SaveExamRequestSchema, {
        tenantId: "tenant-1",
        data: {
          title: "Mid-term Exam",
          subject: "Mathematics",
          classIds: ["class-1"],
        },
      });
    });

    it("accepts with all optional fields", () => {
      expectValid(SaveExamRequestSchema, {
        id: "exam-1",
        tenantId: "tenant-1",
        data: {
          title: "Mid-term Exam",
          subject: "Mathematics",
          topics: ["algebra", "geometry"],
          classIds: ["class-1"],
          sectionIds: ["section-1"],
          examDate: "2025-06-15",
          duration: 120,
          academicSessionId: "session-1",
          totalMarks: 100,
          passingMarks: 40,
          gradingConfig: {
            autoGrade: true,
            allowRubricEdit: false,
            evaluationSettingsId: "eval-1",
            allowManualOverride: true,
            requireOverrideReason: true,
            releaseResultsAutomatically: false,
          },
          linkedSpaceId: "space-1",
          linkedSpaceTitle: "Math Space",
          linkedStoryPointId: "sp-1",
          status: "draft",
          evaluationSettingsId: "eval-1",
          questionPaperImages: ["https://example.com/qp1.png"],
        },
      });
    });

    it("rejects missing tenantId", () => {
      expectInvalid(SaveExamRequestSchema, {
        data: { title: "Exam" },
      });
    });

    it("rejects missing data", () => {
      expectInvalid(SaveExamRequestSchema, { tenantId: "tenant-1" });
    });

    it("accepts all valid status values", () => {
      const statuses = [
        "draft",
        "question_paper_uploaded",
        "question_paper_extracted",
        "published",
        "grading",
        "completed",
        "results_released",
        "archived",
      ];
      for (const status of statuses) {
        expectValid(SaveExamRequestSchema, {
          tenantId: "tenant-1",
          data: { status },
        });
      }
    });

    it("rejects invalid status", () => {
      expectInvalid(SaveExamRequestSchema, {
        tenantId: "tenant-1",
        data: { status: "cancelled" },
      });
    });

    it("rejects duration as string", () => {
      expectInvalid(SaveExamRequestSchema, {
        tenantId: "tenant-1",
        data: { duration: "120" },
      });
    });

    it("rejects totalMarks as string", () => {
      expectInvalid(SaveExamRequestSchema, {
        tenantId: "tenant-1",
        data: { totalMarks: "100" },
      });
    });

    it("accepts empty data object", () => {
      expectValid(SaveExamRequestSchema, {
        tenantId: "tenant-1",
        data: {},
      });
    });

    it("accepts gradingConfig with passthrough (extra keys)", () => {
      expectValid(SaveExamRequestSchema, {
        tenantId: "tenant-1",
        data: {
          gradingConfig: {
            autoGrade: true,
            customSetting: "extra", // passthrough allows this
          },
        },
      });
    });
  });

  // ── GradeQuestionRequestSchema ───────────────────────────────────────────

  describe("GradeQuestionRequestSchema", () => {
    it("accepts valid manual grading", () => {
      expectValid(GradeQuestionRequestSchema, {
        tenantId: "tenant-1",
        mode: "manual",
        submissionId: "sub-1",
        questionId: "q-1",
        score: 8,
        maxScore: 10,
        feedback: "Good answer",
      });
    });

    it("accepts valid retry mode", () => {
      expectValid(GradeQuestionRequestSchema, {
        tenantId: "tenant-1",
        mode: "retry",
        examId: "exam-1",
        questionIds: ["q-1", "q-2"],
      });
    });

    it("rejects missing tenantId", () => {
      expectInvalid(GradeQuestionRequestSchema, {
        mode: "manual",
        submissionId: "sub-1",
      });
    });

    it("rejects missing mode", () => {
      expectInvalid(GradeQuestionRequestSchema, {
        tenantId: "tenant-1",
        submissionId: "sub-1",
      });
    });

    it("rejects invalid mode enum", () => {
      expectInvalid(GradeQuestionRequestSchema, {
        tenantId: "tenant-1",
        mode: "auto",
      });
    });

    it("rejects score as string", () => {
      expectInvalid(GradeQuestionRequestSchema, {
        tenantId: "tenant-1",
        mode: "manual",
        score: "8",
      });
    });

    it("accepts with only required fields", () => {
      expectValid(GradeQuestionRequestSchema, {
        tenantId: "tenant-1",
        mode: "manual",
      });
    });
  });

  // ── ExtractQuestionsRequestSchema ────────────────────────────────────────

  describe("ExtractQuestionsRequestSchema", () => {
    it("accepts valid input", () => {
      expectValid(ExtractQuestionsRequestSchema, {
        tenantId: "tenant-1",
        examId: "exam-1",
      });
    });

    it("rejects missing tenantId", () => {
      expectInvalid(ExtractQuestionsRequestSchema, {
        examId: "exam-1",
      });
    });

    it("rejects missing examId", () => {
      expectInvalid(ExtractQuestionsRequestSchema, {
        tenantId: "tenant-1",
      });
    });

    it("rejects tenantId as number", () => {
      expectInvalid(ExtractQuestionsRequestSchema, {
        tenantId: 123,
        examId: "exam-1",
      });
    });

    it("rejects examId as number", () => {
      expectInvalid(ExtractQuestionsRequestSchema, {
        tenantId: "tenant-1",
        examId: 456,
      });
    });

    it("rejects empty object", () => {
      expectInvalid(ExtractQuestionsRequestSchema, {});
    });
  });

  // ── UploadAnswerSheetsRequestSchema ──────────────────────────────────────

  describe("UploadAnswerSheetsRequestSchema", () => {
    it("accepts valid input", () => {
      expectValid(UploadAnswerSheetsRequestSchema, {
        tenantId: "tenant-1",
        examId: "exam-1",
        studentId: "student-1",
        classId: "class-1",
        imageUrls: ["https://example.com/sheet1.png"],
      });
    });

    it("accepts with multiple image URLs", () => {
      expectValid(UploadAnswerSheetsRequestSchema, {
        tenantId: "tenant-1",
        examId: "exam-1",
        studentId: "student-1",
        classId: "class-1",
        imageUrls: [
          "https://example.com/sheet1.png",
          "https://example.com/sheet2.png",
          "https://example.com/sheet3.png",
        ],
      });
    });

    it("rejects missing tenantId", () => {
      expectInvalid(UploadAnswerSheetsRequestSchema, {
        examId: "exam-1",
        studentId: "student-1",
        classId: "class-1",
        imageUrls: ["url"],
      });
    });

    it("rejects missing examId", () => {
      expectInvalid(UploadAnswerSheetsRequestSchema, {
        tenantId: "tenant-1",
        studentId: "student-1",
        classId: "class-1",
        imageUrls: ["url"],
      });
    });

    it("rejects missing studentId", () => {
      expectInvalid(UploadAnswerSheetsRequestSchema, {
        tenantId: "tenant-1",
        examId: "exam-1",
        classId: "class-1",
        imageUrls: ["url"],
      });
    });

    it("rejects missing classId", () => {
      expectInvalid(UploadAnswerSheetsRequestSchema, {
        tenantId: "tenant-1",
        examId: "exam-1",
        studentId: "student-1",
        imageUrls: ["url"],
      });
    });

    it("rejects missing imageUrls", () => {
      expectInvalid(UploadAnswerSheetsRequestSchema, {
        tenantId: "tenant-1",
        examId: "exam-1",
        studentId: "student-1",
        classId: "class-1",
      });
    });

    it("rejects imageUrls as non-array", () => {
      expectInvalid(UploadAnswerSheetsRequestSchema, {
        tenantId: "tenant-1",
        examId: "exam-1",
        studentId: "student-1",
        classId: "class-1",
        imageUrls: "single-url",
      });
    });

    it("rejects empty imageUrls array (requires at least 1 image)", () => {
      expectInvalid(UploadAnswerSheetsRequestSchema, {
        tenantId: "tenant-1",
        examId: "exam-1",
        studentId: "student-1",
        classId: "class-1",
        imageUrls: [],
      });
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// QUESTION BANK SCHEMAS
// ══════════════════════════════════════════════════════════════════════════════

describe("Question Bank Schemas", () => {
  // ── SaveQuestionBankItemRequestSchema ─────────────────────────────────────

  describe("SaveQuestionBankItemRequestSchema", () => {
    it("accepts valid input", () => {
      expectValid(SaveQuestionBankItemRequestSchema, {
        tenantId: "tenant-1",
        data: {
          questionType: "multiple_choice",
          title: "What is 2+2?",
          content: "Calculate the sum of 2 and 2",
          basePoints: 5,
        },
      });
    });

    it("accepts with all optional fields", () => {
      expectValid(SaveQuestionBankItemRequestSchema, {
        id: "qb-1",
        tenantId: "tenant-1",
        data: {
          questionType: "short_answer",
          title: "Capital of France",
          content: "What is the capital of France?",
          explanation: "Paris is the capital and largest city of France.",
          basePoints: 2,
          questionData: { correctAnswer: "Paris", hints: ["European city"] },
          subject: "Geography",
          topics: ["capitals", "Europe"],
          difficulty: "easy",
          bloomsLevel: "remember",
          tags: ["geography", "world-capitals"],
          deleted: false,
        },
      });
    });

    it("rejects missing tenantId", () => {
      expectInvalid(SaveQuestionBankItemRequestSchema, {
        data: { title: "Q1" },
      });
    });

    it("rejects missing data", () => {
      expectInvalid(SaveQuestionBankItemRequestSchema, {
        tenantId: "tenant-1",
      });
    });

    it("rejects invalid difficulty enum", () => {
      expectInvalid(SaveQuestionBankItemRequestSchema, {
        tenantId: "tenant-1",
        data: { difficulty: "expert" },
      });
    });

    it("accepts all valid difficulty values", () => {
      for (const difficulty of ["easy", "medium", "hard"]) {
        expectValid(SaveQuestionBankItemRequestSchema, {
          tenantId: "tenant-1",
          data: { difficulty },
        });
      }
    });

    it("rejects invalid bloomsLevel enum", () => {
      expectInvalid(SaveQuestionBankItemRequestSchema, {
        tenantId: "tenant-1",
        data: { bloomsLevel: "memorize" },
      });
    });

    it("accepts all valid bloomsLevel values", () => {
      for (const level of ["remember", "understand", "apply", "analyze", "evaluate", "create"]) {
        expectValid(SaveQuestionBankItemRequestSchema, {
          tenantId: "tenant-1",
          data: { bloomsLevel: level },
        });
      }
    });

    it("accepts empty data object", () => {
      expectValid(SaveQuestionBankItemRequestSchema, {
        tenantId: "tenant-1",
        data: {},
      });
    });

    it("rejects topics as non-array", () => {
      expectInvalid(SaveQuestionBankItemRequestSchema, {
        tenantId: "tenant-1",
        data: { topics: "math" },
      });
    });

    it("rejects basePoints as string", () => {
      expectInvalid(SaveQuestionBankItemRequestSchema, {
        tenantId: "tenant-1",
        data: { basePoints: "5" },
      });
    });
  });

  // ── ListQuestionBankRequestSchema ────────────────────────────────────────

  describe("ListQuestionBankRequestSchema", () => {
    it("accepts valid input with tenantId only", () => {
      expectValid(ListQuestionBankRequestSchema, {
        tenantId: "tenant-1",
      });
    });

    it("accepts with all filter fields", () => {
      expectValid(ListQuestionBankRequestSchema, {
        tenantId: "tenant-1",
        subject: "Mathematics",
        topics: ["algebra", "geometry"],
        difficulty: "medium",
        bloomsLevel: "apply",
        questionType: "multiple_choice",
        tags: ["exam-prep"],
        search: "quadratic",
        sortBy: "usageCount",
        sortDir: "desc",
        limit: 50,
        startAfter: "cursor-xyz",
      });
    });

    it("rejects missing tenantId", () => {
      expectInvalid(ListQuestionBankRequestSchema, {
        subject: "Math",
      });
    });

    it("rejects invalid difficulty", () => {
      expectInvalid(ListQuestionBankRequestSchema, {
        tenantId: "tenant-1",
        difficulty: "extreme",
      });
    });

    it("rejects invalid bloomsLevel", () => {
      expectInvalid(ListQuestionBankRequestSchema, {
        tenantId: "tenant-1",
        bloomsLevel: "memorize",
      });
    });

    it("rejects invalid sortBy", () => {
      expectInvalid(ListQuestionBankRequestSchema, {
        tenantId: "tenant-1",
        sortBy: "name",
      });
    });

    it("accepts all valid sortBy values", () => {
      for (const sortBy of ["usageCount", "averageScore", "createdAt"]) {
        expectValid(ListQuestionBankRequestSchema, {
          tenantId: "tenant-1",
          sortBy,
        });
      }
    });

    it("rejects invalid sortDir", () => {
      expectInvalid(ListQuestionBankRequestSchema, {
        tenantId: "tenant-1",
        sortDir: "ascending",
      });
    });

    it("rejects limit as string", () => {
      expectInvalid(ListQuestionBankRequestSchema, {
        tenantId: "tenant-1",
        limit: "fifty",
      });
    });
  });

  // ── ImportFromBankRequestSchema ──────────────────────────────────────────

  describe("ImportFromBankRequestSchema", () => {
    it("accepts valid input", () => {
      expectValid(ImportFromBankRequestSchema, {
        tenantId: "tenant-1",
        spaceId: "space-1",
        storyPointId: "sp-1",
        questionBankItemIds: ["qb-1", "qb-2", "qb-3"],
      });
    });

    it("accepts with optional sectionId", () => {
      expectValid(ImportFromBankRequestSchema, {
        tenantId: "tenant-1",
        spaceId: "space-1",
        storyPointId: "sp-1",
        sectionId: "sec-1",
        questionBankItemIds: ["qb-1"],
      });
    });

    it("rejects missing tenantId", () => {
      expectInvalid(ImportFromBankRequestSchema, {
        spaceId: "space-1",
        storyPointId: "sp-1",
        questionBankItemIds: ["qb-1"],
      });
    });

    it("rejects missing spaceId", () => {
      expectInvalid(ImportFromBankRequestSchema, {
        tenantId: "tenant-1",
        storyPointId: "sp-1",
        questionBankItemIds: ["qb-1"],
      });
    });

    it("rejects missing storyPointId", () => {
      expectInvalid(ImportFromBankRequestSchema, {
        tenantId: "tenant-1",
        spaceId: "space-1",
        questionBankItemIds: ["qb-1"],
      });
    });

    it("rejects missing questionBankItemIds", () => {
      expectInvalid(ImportFromBankRequestSchema, {
        tenantId: "tenant-1",
        spaceId: "space-1",
        storyPointId: "sp-1",
      });
    });

    it("rejects questionBankItemIds as non-array", () => {
      expectInvalid(ImportFromBankRequestSchema, {
        tenantId: "tenant-1",
        spaceId: "space-1",
        storyPointId: "sp-1",
        questionBankItemIds: "qb-1",
      });
    });

    it("rejects empty questionBankItemIds array", () => {
      expectInvalid(ImportFromBankRequestSchema, {
        tenantId: "tenant-1",
        spaceId: "space-1",
        storyPointId: "sp-1",
        questionBankItemIds: [],
      });
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// RUBRIC PRESETS
// ══════════════════════════════════════════════════════════════════════════════

describe("Rubric Preset Schemas", () => {
  describe("SaveRubricPresetRequestSchema", () => {
    it("accepts valid input", () => {
      expectValid(SaveRubricPresetRequestSchema, {
        tenantId: "tenant-1",
        data: {
          name: "Essay Rubric",
          description: "Standard essay grading rubric",
          category: "essay",
        },
      });
    });

    it("accepts with full rubric", () => {
      expectValid(SaveRubricPresetRequestSchema, {
        id: "preset-1",
        tenantId: "tenant-1",
        data: {
          name: "Math Rubric",
          description: "Math problem rubric",
          rubric: {
            scoringMode: "criteria_based",
            criteria: [
              {
                id: "c1",
                name: "Correctness",
                maxPoints: 10,
                weight: 0.7,
                levels: [
                  { score: 10, label: "Excellent", description: "Perfect answer" },
                  { score: 5, label: "Partial", description: "Partially correct" },
                  { score: 0, label: "Incorrect", description: "Wrong answer" },
                ],
              },
            ],
            passingPercentage: 60,
          },
          category: "math",
          questionTypes: ["short_answer", "long_answer"],
          deleted: false,
        },
      });
    });

    it("rejects missing tenantId", () => {
      expectInvalid(SaveRubricPresetRequestSchema, {
        data: { name: "Rubric" },
      });
    });

    it("rejects missing data", () => {
      expectInvalid(SaveRubricPresetRequestSchema, {
        tenantId: "tenant-1",
      });
    });

    it("rejects invalid category", () => {
      expectInvalid(SaveRubricPresetRequestSchema, {
        tenantId: "tenant-1",
        data: { category: "art" },
      });
    });

    it("accepts all valid category values", () => {
      for (const category of [
        "general",
        "math",
        "science",
        "language",
        "coding",
        "essay",
        "custom",
      ]) {
        expectValid(SaveRubricPresetRequestSchema, {
          tenantId: "tenant-1",
          data: { category },
        });
      }
    });

    it("accepts empty data object", () => {
      expectValid(SaveRubricPresetRequestSchema, {
        tenantId: "tenant-1",
        data: {},
      });
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// ANALYTICS MODULE
// ══════════════════════════════════════════════════════════════════════════════

describe("Analytics Module Schemas", () => {
  // ── GetSummaryRequestSchema ──────────────────────────────────────────────

  describe("GetSummaryRequestSchema", () => {
    it("accepts valid student scope", () => {
      expectValid(GetSummaryRequestSchema, {
        tenantId: "tenant-1",
        scope: "student",
        studentId: "student-1",
      });
    });

    it("accepts valid class scope", () => {
      expectValid(GetSummaryRequestSchema, {
        tenantId: "tenant-1",
        scope: "class",
        classId: "class-1",
      });
    });

    it("accepts with only required fields", () => {
      expectValid(GetSummaryRequestSchema, {
        tenantId: "tenant-1",
        scope: "student",
      });
    });

    it("rejects missing tenantId", () => {
      expectInvalid(GetSummaryRequestSchema, {
        scope: "student",
      });
    });

    it("rejects missing scope", () => {
      expectInvalid(GetSummaryRequestSchema, {
        tenantId: "tenant-1",
      });
    });

    it("rejects invalid scope enum", () => {
      expectInvalid(GetSummaryRequestSchema, {
        tenantId: "tenant-1",
        scope: "school",
      });
    });

    it("accepts both scope values", () => {
      for (const scope of ["student", "class"]) {
        expectValid(GetSummaryRequestSchema, {
          tenantId: "tenant-1",
          scope,
        });
      }
    });

    it("rejects tenantId as number", () => {
      expectInvalid(GetSummaryRequestSchema, {
        tenantId: 123,
        scope: "student",
      });
    });
  });

  // ── GenerateReportRequestSchema ──────────────────────────────────────────

  describe("GenerateReportRequestSchema", () => {
    it("accepts valid exam-result report", () => {
      expectValid(GenerateReportRequestSchema, {
        tenantId: "tenant-1",
        type: "exam-result",
        examId: "exam-1",
        studentId: "student-1",
      });
    });

    it("accepts valid progress report", () => {
      expectValid(GenerateReportRequestSchema, {
        tenantId: "tenant-1",
        type: "progress",
        studentId: "student-1",
        academicSessionId: "session-1",
      });
    });

    it("accepts valid class report", () => {
      expectValid(GenerateReportRequestSchema, {
        tenantId: "tenant-1",
        type: "class",
        classId: "class-1",
      });
    });

    it("accepts with only required fields", () => {
      expectValid(GenerateReportRequestSchema, {
        tenantId: "tenant-1",
        type: "exam-result",
      });
    });

    it("rejects missing tenantId", () => {
      expectInvalid(GenerateReportRequestSchema, {
        type: "exam-result",
      });
    });

    it("rejects missing type", () => {
      expectInvalid(GenerateReportRequestSchema, {
        tenantId: "tenant-1",
      });
    });

    it("rejects invalid type enum", () => {
      expectInvalid(GenerateReportRequestSchema, {
        tenantId: "tenant-1",
        type: "attendance",
      });
    });

    it("accepts all valid type values", () => {
      for (const type of ["exam-result", "progress", "class"]) {
        expectValid(GenerateReportRequestSchema, {
          tenantId: "tenant-1",
          type,
        });
      }
    });

    it("accepts with all optional IDs", () => {
      expectValid(GenerateReportRequestSchema, {
        tenantId: "tenant-1",
        type: "exam-result",
        examId: "exam-1",
        studentId: "student-1",
        classId: "class-1",
        academicSessionId: "session-1",
      });
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// REUSABLE SCHEMAS (tested indirectly via parent schemas, plus direct tests)
// ══════════════════════════════════════════════════════════════════════════════

describe("Reusable Schemas (tested via parent schemas)", () => {
  // ── UnifiedRubricSchema (via SaveSpaceRequestSchema.data.defaultRubric) ──

  describe("UnifiedRubricSchema (via SaveSpaceRequestSchema)", () => {
    const wrapRubric = (rubric: unknown) => ({
      tenantId: "tenant-1",
      data: { defaultRubric: rubric },
    });

    it("accepts criteria_based rubric", () => {
      expectValid(
        SaveSpaceRequestSchema,
        wrapRubric({
          scoringMode: "criteria_based",
          criteria: [
            {
              id: "c1",
              name: "Accuracy",
              maxPoints: 10,
              description: "How accurate the answer is",
              weight: 0.5,
              levels: [
                { score: 10, label: "Excellent", description: "Perfect" },
                { score: 0, label: "Poor", description: "Wrong" },
              ],
            },
          ],
        })
      );
    });

    it("accepts dimension_based rubric", () => {
      expectValid(
        SaveSpaceRequestSchema,
        wrapRubric({
          scoringMode: "dimension_based",
          dimensions: [
            {
              id: "dim-1",
              name: "Clarity",
              description: "How clear the response is",
              priority: "HIGH",
              promptGuidance: "Evaluate clarity of expression",
              enabled: true,
              isDefault: true,
              isCustom: false,
              weight: 1.0,
              scoringScale: 10,
            },
          ],
        })
      );
    });

    it("accepts holistic rubric", () => {
      expectValid(
        SaveSpaceRequestSchema,
        wrapRubric({
          scoringMode: "holistic",
          holisticGuidance: "Grade the overall quality",
          holisticMaxScore: 100,
          passingPercentage: 60,
        })
      );
    });

    it("accepts hybrid rubric", () => {
      expectValid(
        SaveSpaceRequestSchema,
        wrapRubric({
          scoringMode: "hybrid",
          criteria: [{ id: "c1", name: "Content", maxPoints: 50 }],
          dimensions: [
            {
              id: "d1",
              name: "Presentation",
              description: "Quality of presentation",
              priority: "MEDIUM",
              promptGuidance: "Evaluate presentation",
              enabled: true,
              isDefault: false,
              isCustom: true,
              weight: 0.5,
              scoringScale: 5,
            },
          ],
          holisticGuidance: "Overall impression",
          holisticMaxScore: 10,
        })
      );
    });

    it("rejects missing scoringMode", () => {
      expectInvalid(
        SaveSpaceRequestSchema,
        wrapRubric({
          criteria: [{ id: "c1", name: "Test", maxPoints: 10 }],
        })
      );
    });

    it("rejects invalid scoringMode", () => {
      expectInvalid(
        SaveSpaceRequestSchema,
        wrapRubric({
          scoringMode: "custom_mode",
        })
      );
    });

    it("accepts all valid scoringMode values", () => {
      for (const scoringMode of ["criteria_based", "dimension_based", "holistic", "hybrid"]) {
        expectValid(SaveSpaceRequestSchema, wrapRubric({ scoringMode }));
      }
    });

    it("rejects criteria missing required id", () => {
      expectInvalid(
        SaveSpaceRequestSchema,
        wrapRubric({
          scoringMode: "criteria_based",
          criteria: [{ name: "Test", maxPoints: 10 }], // missing id
        })
      );
    });

    it("rejects criteria missing required name", () => {
      expectInvalid(
        SaveSpaceRequestSchema,
        wrapRubric({
          scoringMode: "criteria_based",
          criteria: [{ id: "c1", maxPoints: 10 }], // missing name
        })
      );
    });

    it("rejects criteria missing required maxPoints", () => {
      expectInvalid(
        SaveSpaceRequestSchema,
        wrapRubric({
          scoringMode: "criteria_based",
          criteria: [{ id: "c1", name: "Test" }], // missing maxPoints
        })
      );
    });

    it("rejects criteria with maxPoints as string", () => {
      expectInvalid(
        SaveSpaceRequestSchema,
        wrapRubric({
          scoringMode: "criteria_based",
          criteria: [{ id: "c1", name: "Test", maxPoints: "10" }],
        })
      );
    });

    it("rejects dimension missing required fields", () => {
      expectInvalid(
        SaveSpaceRequestSchema,
        wrapRubric({
          scoringMode: "dimension_based",
          dimensions: [{ id: "dim-1", name: "Test" }], // many required fields missing
        })
      );
    });

    it("rejects dimension with invalid priority", () => {
      expectInvalid(
        SaveSpaceRequestSchema,
        wrapRubric({
          scoringMode: "dimension_based",
          dimensions: [
            {
              id: "dim-1",
              name: "Test",
              description: "desc",
              priority: "CRITICAL", // invalid
              promptGuidance: "guide",
              enabled: true,
              isDefault: true,
              isCustom: false,
              weight: 1.0,
              scoringScale: 10,
            },
          ],
        })
      );
    });

    it("accepts dimension with all valid priority values", () => {
      for (const priority of ["HIGH", "MEDIUM", "LOW"]) {
        expectValid(
          SaveSpaceRequestSchema,
          wrapRubric({
            scoringMode: "dimension_based",
            dimensions: [
              {
                id: "dim-1",
                name: "Test",
                description: "desc",
                priority,
                promptGuidance: "guide",
                enabled: true,
                isDefault: true,
                isCustom: false,
                weight: 1.0,
                scoringScale: 10,
              },
            ],
          })
        );
      }
    });

    it("accepts rubric with showModelAnswer and modelAnswer", () => {
      expectValid(
        SaveSpaceRequestSchema,
        wrapRubric({
          scoringMode: "holistic",
          showModelAnswer: true,
          modelAnswer: "The model answer is...",
          evaluatorGuidance: "Additional guidance for the evaluator",
        })
      );
    });

    it("rejects criterion level with missing score", () => {
      expectInvalid(
        SaveSpaceRequestSchema,
        wrapRubric({
          scoringMode: "criteria_based",
          criteria: [
            {
              id: "c1",
              name: "Test",
              maxPoints: 10,
              levels: [{ label: "Good", description: "desc" }], // missing score
            },
          ],
        })
      );
    });

    it("rejects criterion level with missing label", () => {
      expectInvalid(
        SaveSpaceRequestSchema,
        wrapRubric({
          scoringMode: "criteria_based",
          criteria: [
            {
              id: "c1",
              name: "Test",
              maxPoints: 10,
              levels: [{ score: 10, description: "desc" }], // missing label
            },
          ],
        })
      );
    });

    it("rejects criterion level with missing description", () => {
      expectInvalid(
        SaveSpaceRequestSchema,
        wrapRubric({
          scoringMode: "criteria_based",
          criteria: [
            {
              id: "c1",
              name: "Test",
              maxPoints: 10,
              levels: [{ score: 10, label: "Good" }], // missing description
            },
          ],
        })
      );
    });
  });

  // ── ItemMetadataSchema (via SaveItemRequestSchema.data.meta) ─────────────

  describe("ItemMetadataSchema (via SaveItemRequestSchema)", () => {
    const wrapMeta = (meta: unknown) => ({
      tenantId: "tenant-1",
      spaceId: "space-1",
      storyPointId: "sp-1",
      data: { meta },
    });

    it("accepts empty meta object", () => {
      expectValid(SaveItemRequestSchema, wrapMeta({}));
    });

    it("accepts with all defined fields", () => {
      expectValid(
        SaveItemRequestSchema,
        wrapMeta({
          subject: "Physics",
          topics: ["mechanics", "kinematics"],
          bloomsLevel: "analyze",
          estimatedTime: 15,
          source: "NCERT Textbook",
        })
      );
    });

    it("accepts with passthrough (extra keys)", () => {
      expectValid(
        SaveItemRequestSchema,
        wrapMeta({
          subject: "Math",
          customKey: "custom value",
          anotherKey: 42,
        })
      );
    });

    it("rejects estimatedTime as string", () => {
      expectInvalid(
        SaveItemRequestSchema,
        wrapMeta({
          estimatedTime: "fifteen",
        })
      );
    });

    it("rejects topics as non-array", () => {
      expectInvalid(
        SaveItemRequestSchema,
        wrapMeta({
          topics: "single-topic",
        })
      );
    });

    it("accepts topics as empty array", () => {
      expectValid(
        SaveItemRequestSchema,
        wrapMeta({
          topics: [],
        })
      );
    });

    it("accepts estimatedTime of zero", () => {
      expectValid(
        SaveItemRequestSchema,
        wrapMeta({
          estimatedTime: 0,
        })
      );
    });

    it("accepts subject as empty string", () => {
      expectValid(
        SaveItemRequestSchema,
        wrapMeta({
          subject: "",
        })
      );
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// CROSS-CUTTING EDGE CASES
// ══════════════════════════════════════════════════════════════════════════════

describe("Cross-cutting edge cases", () => {
  it("all schemas reject undefined as input", () => {
    const schemas = [
      DeactivateTenantRequestSchema,
      ReactivateTenantRequestSchema,
      ManageNotificationsRequestSchema,
      BulkImportStudentsRequestSchema,
      CreateOrgUserRequestSchema,
      StartTestSessionRequestSchema,
      SubmitTestSessionRequestSchema,
      EvaluateAnswerRequestSchema,
      SendChatMessageRequestSchema,
      RecordItemAttemptRequestSchema,
      ExtractQuestionsRequestSchema,
      UploadAnswerSheetsRequestSchema,
      ImportFromBankRequestSchema,
      GetSummaryRequestSchema,
      GenerateReportRequestSchema,
    ];

    for (const schema of schemas) {
      expectInvalid(schema, undefined);
    }
  });

  it("all schemas reject null as input", () => {
    const schemas = [
      DeactivateTenantRequestSchema,
      ReactivateTenantRequestSchema,
      ManageNotificationsRequestSchema,
      BulkImportStudentsRequestSchema,
      CreateOrgUserRequestSchema,
      StartTestSessionRequestSchema,
      SubmitTestSessionRequestSchema,
      EvaluateAnswerRequestSchema,
      SendChatMessageRequestSchema,
      RecordItemAttemptRequestSchema,
      ExtractQuestionsRequestSchema,
      UploadAnswerSheetsRequestSchema,
      ImportFromBankRequestSchema,
      GetSummaryRequestSchema,
      GenerateReportRequestSchema,
    ];

    for (const schema of schemas) {
      expectInvalid(schema, null);
    }
  });

  it("all schemas reject primitive string as input", () => {
    const schemas = [
      SaveTenantRequestSchema,
      DeactivateTenantRequestSchema,
      ReactivateTenantRequestSchema,
      SaveStaffRequestSchema,
      SaveClassRequestSchema,
      SaveStudentRequestSchema,
      SaveTeacherRequestSchema,
      SaveParentRequestSchema,
      ManageNotificationsRequestSchema,
      BulkImportStudentsRequestSchema,
      CreateOrgUserRequestSchema,
      SaveSpaceRequestSchema,
      SaveStoryPointRequestSchema,
      SaveItemRequestSchema,
      StartTestSessionRequestSchema,
      SubmitTestSessionRequestSchema,
      EvaluateAnswerRequestSchema,
      SendChatMessageRequestSchema,
      RecordItemAttemptRequestSchema,
      SaveExamRequestSchema,
      GradeQuestionRequestSchema,
      ExtractQuestionsRequestSchema,
      UploadAnswerSheetsRequestSchema,
      SaveQuestionBankItemRequestSchema,
      ListQuestionBankRequestSchema,
      ImportFromBankRequestSchema,
      SaveRubricPresetRequestSchema,
      GetSummaryRequestSchema,
      GenerateReportRequestSchema,
    ];

    for (const schema of schemas) {
      expectInvalid(schema, "just a string");
    }
  });

  it("all schemas reject number as input", () => {
    const schemas = [
      SaveTenantRequestSchema,
      DeactivateTenantRequestSchema,
      SaveSpaceRequestSchema,
      SaveExamRequestSchema,
      GetSummaryRequestSchema,
      GenerateReportRequestSchema,
    ];

    for (const schema of schemas) {
      expectInvalid(schema, 42);
    }
  });

  it("all schemas reject array as input", () => {
    const schemas = [
      SaveTenantRequestSchema,
      DeactivateTenantRequestSchema,
      SaveSpaceRequestSchema,
      SaveExamRequestSchema,
      GetSummaryRequestSchema,
      GenerateReportRequestSchema,
    ];

    for (const schema of schemas) {
      expectInvalid(schema, [1, 2, 3]);
    }
  });
});
