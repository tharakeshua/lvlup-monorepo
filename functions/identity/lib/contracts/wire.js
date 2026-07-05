"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManageNotificationsRequestSchema =
  exports.ListAnnouncementsRequestSchema =
  exports.SaveAnnouncementRequestSchema =
  exports.SaveGlobalPresetRequestSchema =
  exports.JoinTenantRequestSchema =
  exports.SwitchActiveTenantRequestSchema =
  exports.CreateOrgUserRequestSchema =
  exports.BulkImportStudentsRequestSchema =
  exports.SaveAcademicSessionRequestSchema =
  exports.SaveParentRequestSchema =
  exports.SaveTeacherRequestSchema =
  exports.SaveStudentRequestSchema =
  exports.SaveClassRequestSchema =
  exports.SaveStaffRequestSchema =
  exports.ExportTenantDataRequestSchema =
  exports.ReactivateTenantRequestSchema =
  exports.DeactivateTenantRequestSchema =
  exports.SaveTenantRequestSchema =
  exports.firestoreId =
    void 0;
/**
 * WIRE-PRESERVING request schemas + response types for the legacy identity
 * callables. Ported verbatim from @levelup/shared-types (U3.1, DATA-MODEL-FIX-PLAN
 * §3/§6) so that package can be deleted (U3.5).
 *
 * These deliberately do NOT adopt the @levelup/api-contract v1 request shapes:
 * the v1 contract renamed fields (`tenantId`→`tenantOverride`,
 * `students`→`rows`, SaveGlobalPreset→SaveGlobalEvaluationPreset, …) and this
 * package serves the DEPLOYED legacy wire. Changing the wire here would break
 * legacy clients without a version bump — the v1 shapes already live in
 * `functions/sdk-v1`. Each schema notes its v1 successor; this file dies with
 * the legacy stack.
 *
 * B8 note: timestamps in RESPONSES from migrated handlers are canonical ISO
 * strings (domain `Timestamp`), never Firestore Timestamp objects.
 */
const zod_1 = require("zod");
// ── Validation constants (ported) ─────────────────────────────────────────
const MAX_SHORT_TEXT = 200;
const MAX_MEDIUM_TEXT = 2000;
const MAX_ARRAY_ITEMS = 100;
const MAX_BULK_ITEMS = 500;
/** Firestore document ID pattern (no slashes, non-empty). */
exports.firestoreId = zod_1.z
  .string()
  .min(1, "ID cannot be empty")
  .max(1500)
  .regex(/^[^/]+$/, "ID cannot contain slashes");
// ── Tenant ────────────────────────────────────────────────────────────────
/** v1 successor: api-contract identity/tenant `SaveTenantRequestSchema`. */
exports.SaveTenantRequestSchema = zod_1.z.object({
  id: exports.firestoreId.optional(),
  data: zod_1.z.object({
    name: zod_1.z.string().max(MAX_SHORT_TEXT).optional(),
    shortName: zod_1.z.string().max(MAX_SHORT_TEXT).optional(),
    description: zod_1.z.string().max(MAX_MEDIUM_TEXT).optional(),
    contactEmail: zod_1.z.string().email("Invalid email format").max(MAX_SHORT_TEXT).optional(),
    contactPhone: zod_1.z.string().max(20).nullable().optional(),
    contactPerson: zod_1.z.string().max(MAX_SHORT_TEXT).nullable().optional(),
    logoUrl: zod_1.z.string().nullable().optional(),
    bannerUrl: zod_1.z.string().nullable().optional(),
    website: zod_1.z.string().nullable().optional(),
    address: zod_1.z
      .object({
        street: zod_1.z.string().optional(),
        city: zod_1.z.string().optional(),
        state: zod_1.z.string().optional(),
        country: zod_1.z.string().optional(),
        zipCode: zod_1.z.string().optional(),
      })
      .optional(),
    status: zod_1.z.enum(["active", "suspended", "trial", "expired", "deactivated"]).optional(),
    subscription: zod_1.z
      .object({
        plan: zod_1.z.enum(["free", "trial", "basic", "premium", "enterprise"]).optional(),
        maxStudents: zod_1.z.number().optional(),
        maxTeachers: zod_1.z.number().optional(),
        maxSpaces: zod_1.z.number().optional(),
        maxExamsPerMonth: zod_1.z.number().optional(),
        billingCycle: zod_1.z.enum(["monthly", "annual"]).optional(),
        billingEmail: zod_1.z.string().optional(),
        cancelAtPeriodEnd: zod_1.z.boolean().optional(),
      })
      .passthrough()
      .optional(),
    features: zod_1.z
      .object({
        autoGradeEnabled: zod_1.z.boolean().optional(),
        levelUpEnabled: zod_1.z.boolean().optional(),
        scannerAppEnabled: zod_1.z.boolean().optional(),
        aiChatEnabled: zod_1.z.boolean().optional(),
        aiGradingEnabled: zod_1.z.boolean().optional(),
        analyticsEnabled: zod_1.z.boolean().optional(),
        parentPortalEnabled: zod_1.z.boolean().optional(),
        bulkImportEnabled: zod_1.z.boolean().optional(),
        apiAccessEnabled: zod_1.z.boolean().optional(),
      })
      .optional(),
    settings: zod_1.z
      .object({
        geminiKeyRef: zod_1.z.string().optional(),
        geminiKeySet: zod_1.z.boolean().optional(),
        defaultEvaluationSettingsId: zod_1.z.string().optional(),
        defaultAiModel: zod_1.z.string().optional(),
        timezone: zod_1.z.string().optional(),
        locale: zod_1.z.string().optional(),
        gradingPolicy: zod_1.z.string().optional(),
      })
      .optional(),
    branding: zod_1.z
      .object({
        logoUrl: zod_1.z.string().optional(),
        bannerUrl: zod_1.z.string().optional(),
        primaryColor: zod_1.z.string().optional(),
        accentColor: zod_1.z.string().optional(),
        favicon: zod_1.z.string().optional(),
      })
      .optional(),
    onboarding: zod_1.z
      .object({
        completed: zod_1.z.boolean().optional(),
        completedSteps: zod_1.z.array(zod_1.z.string()).optional(),
      })
      .optional(),
    geminiApiKey: zod_1.z.string().optional(),
  }),
});
/** v1 successor: api-contract `DeactivateTenantRequestSchema` (`tenantId`→`tenantOverride`). */
exports.DeactivateTenantRequestSchema = zod_1.z.object({
  tenantId: exports.firestoreId,
  reason: zod_1.z.string().max(MAX_MEDIUM_TEXT).optional(),
});
/** v1 successor: api-contract `ReactivateTenantRequestSchema` (`tenantId`→`tenantOverride`). */
exports.ReactivateTenantRequestSchema = zod_1.z.object({
  tenantId: exports.firestoreId,
});
/** v1 successor: api-contract `ExportTenantDataRequestSchema` (scope-based shape). */
exports.ExportTenantDataRequestSchema = zod_1.z.object({
  tenantId: exports.firestoreId,
  format: zod_1.z.enum(["json", "csv"]),
  collections: zod_1.z.array(
    zod_1.z.enum(["students", "teachers", "classes", "exams", "submissions"])
  ),
});
// ── Org entities ──────────────────────────────────────────────────────────
/** v1 successor: api-contract identity/entities `SaveStaffRequestSchema`. */
exports.SaveStaffRequestSchema = zod_1.z.object({
  id: exports.firestoreId.optional(),
  tenantId: exports.firestoreId,
  data: zod_1.z.object({
    uid: zod_1.z.string().optional(),
    department: zod_1.z.string().optional(),
    staffPermissions: zod_1.z
      .object({
        canManageUsers: zod_1.z.boolean().optional(),
        canManageClasses: zod_1.z.boolean().optional(),
        canManageBilling: zod_1.z.boolean().optional(),
        canViewAnalytics: zod_1.z.boolean().optional(),
        canManageSettings: zod_1.z.boolean().optional(),
        canExportData: zod_1.z.boolean().optional(),
      })
      .optional(),
    status: zod_1.z.enum(["active", "archived"]).optional(),
    firstName: zod_1.z.string().optional(),
    lastName: zod_1.z.string().optional(),
    email: zod_1.z.string().optional(),
    phone: zod_1.z.string().optional(),
    password: zod_1.z.string().optional(),
  }),
});
/** v1 successor: api-contract identity/entities `SaveClassRequestSchema`. */
exports.SaveClassRequestSchema = zod_1.z.object({
  id: exports.firestoreId.optional(),
  tenantId: exports.firestoreId,
  data: zod_1.z.object({
    name: zod_1.z.string().max(MAX_SHORT_TEXT).optional(),
    grade: zod_1.z.string().max(20).optional(),
    section: zod_1.z.string().max(20).optional(),
    academicSessionId: exports.firestoreId.optional(),
    teacherIds: zod_1.z.array(exports.firestoreId).max(MAX_ARRAY_ITEMS).optional(),
    status: zod_1.z.enum(["active", "archived", "deleted"]).optional(),
  }),
});
/** v1 successor: api-contract identity/entities `SaveStudentRequestSchema`. */
exports.SaveStudentRequestSchema = zod_1.z.object({
  id: exports.firestoreId.optional(),
  tenantId: exports.firestoreId,
  data: zod_1.z.object({
    uid: zod_1.z.string().optional(),
    rollNumber: zod_1.z.string().max(50).optional(),
    section: zod_1.z.string().max(20).optional(),
    classIds: zod_1.z.array(exports.firestoreId).max(MAX_ARRAY_ITEMS).optional(),
    parentIds: zod_1.z.array(exports.firestoreId).max(MAX_ARRAY_ITEMS).optional(),
    grade: zod_1.z.string().max(20).optional(),
    admissionNumber: zod_1.z.string().max(50).optional(),
    dateOfBirth: zod_1.z.string().max(20).optional(),
    status: zod_1.z.enum(["active", "archived"]).optional(),
    firstName: zod_1.z.string().max(MAX_SHORT_TEXT).optional(),
    lastName: zod_1.z.string().max(MAX_SHORT_TEXT).optional(),
    email: zod_1.z.string().email("Invalid email format").max(MAX_SHORT_TEXT).optional(),
    phone: zod_1.z.string().max(20).optional(),
    password: zod_1.z.string().min(6).max(128).optional(),
  }),
});
/** v1 successor: api-contract identity/entities `SaveTeacherRequestSchema` (record-based permissions). */
exports.SaveTeacherRequestSchema = zod_1.z.object({
  id: exports.firestoreId.optional(),
  tenantId: exports.firestoreId,
  data: zod_1.z.object({
    uid: zod_1.z.string().optional(),
    subjects: zod_1.z.array(zod_1.z.string().max(MAX_SHORT_TEXT)).max(MAX_ARRAY_ITEMS).optional(),
    designation: zod_1.z.string().max(MAX_SHORT_TEXT).optional(),
    classIds: zod_1.z.array(exports.firestoreId).max(MAX_ARRAY_ITEMS).optional(),
    permissions: zod_1.z
      .object({
        canCreateExams: zod_1.z.boolean().optional(),
        canEditRubrics: zod_1.z.boolean().optional(),
        canManuallyGrade: zod_1.z.boolean().optional(),
        canViewAllExams: zod_1.z.boolean().optional(),
        canCreateSpaces: zod_1.z.boolean().optional(),
        canManageContent: zod_1.z.boolean().optional(),
        canViewAnalytics: zod_1.z.boolean().optional(),
        canConfigureAgents: zod_1.z.boolean().optional(),
        managedSpaceIds: zod_1.z.array(zod_1.z.string()).optional(),
        managedClassIds: zod_1.z.array(zod_1.z.string()).optional(),
      })
      .optional(),
    status: zod_1.z.enum(["active", "archived"]).optional(),
    firstName: zod_1.z.string().max(MAX_SHORT_TEXT).optional(),
    lastName: zod_1.z.string().max(MAX_SHORT_TEXT).optional(),
    email: zod_1.z.string().email("Invalid email format").max(MAX_SHORT_TEXT).optional(),
    phone: zod_1.z.string().max(20).optional(),
    password: zod_1.z.string().min(6).max(128).optional(),
  }),
});
/** v1 successor: api-contract identity/entities `SaveParentRequestSchema` (`childStudentIds`→`studentIds`). */
exports.SaveParentRequestSchema = zod_1.z.object({
  id: exports.firestoreId.optional(),
  tenantId: exports.firestoreId,
  data: zod_1.z.object({
    uid: zod_1.z.string().optional(),
    childStudentIds: zod_1.z.array(exports.firestoreId).max(MAX_ARRAY_ITEMS).optional(),
    status: zod_1.z.enum(["active", "archived"]).optional(),
    firstName: zod_1.z.string().max(MAX_SHORT_TEXT).optional(),
    lastName: zod_1.z.string().max(MAX_SHORT_TEXT).optional(),
    email: zod_1.z.string().email("Invalid email format").max(MAX_SHORT_TEXT).optional(),
    phone: zod_1.z.string().max(20).optional(),
    password: zod_1.z.string().min(6).max(128).optional(),
  }),
});
/** v1 successor: api-contract identity/entities `SaveAcademicSessionRequestSchema` (zIsoDate dates). */
exports.SaveAcademicSessionRequestSchema = zod_1.z.object({
  id: exports.firestoreId.optional(),
  tenantId: exports.firestoreId,
  data: zod_1.z.object({
    name: zod_1.z.string().optional(),
    startDate: zod_1.z.string().optional(),
    endDate: zod_1.z.string().optional(),
    isCurrent: zod_1.z.boolean().optional(),
    status: zod_1.z.enum(["active", "archived"]).optional(),
  }),
});
// ── Users ─────────────────────────────────────────────────────────────────
/** v1 successor: api-contract identity/users `BulkImportStudentsRequestSchema` (`students`→`rows`). */
exports.BulkImportStudentsRequestSchema = zod_1.z.object({
  tenantId: exports.firestoreId,
  students: zod_1.z
    .array(
      zod_1.z.object({
        firstName: zod_1.z.string().min(1).max(MAX_SHORT_TEXT),
        lastName: zod_1.z.string().min(1).max(MAX_SHORT_TEXT),
        rollNumber: zod_1.z.string().min(1).max(50),
        email: zod_1.z.string().email().max(MAX_SHORT_TEXT).optional(),
        phone: zod_1.z.string().max(20).optional(),
        classId: exports.firestoreId.optional(),
        className: zod_1.z.string().max(MAX_SHORT_TEXT).optional(),
        section: zod_1.z.string().max(20).optional(),
        parentFirstName: zod_1.z.string().max(MAX_SHORT_TEXT).optional(),
        parentLastName: zod_1.z.string().max(MAX_SHORT_TEXT).optional(),
        parentEmail: zod_1.z.string().email().max(MAX_SHORT_TEXT).optional(),
        parentPhone: zod_1.z.string().max(20).optional(),
      })
    )
    .max(MAX_BULK_ITEMS, "Maximum 500 students per import"),
  dryRun: zod_1.z.boolean(),
});
/** v1 successor: api-contract identity/users `CreateOrgUserRequestSchema`. */
exports.CreateOrgUserRequestSchema = zod_1.z.object({
  tenantId: exports.firestoreId,
  role: zod_1.z.enum(["teacher", "student", "parent", "scanner", "staff"]),
  email: zod_1.z.string().email("Invalid email format").max(MAX_SHORT_TEXT).optional(),
  rollNumber: zod_1.z.string().max(50).optional(),
  firstName: zod_1.z.string().min(1, "First name is required").max(MAX_SHORT_TEXT),
  lastName: zod_1.z.string().min(1, "Last name is required").max(MAX_SHORT_TEXT),
  password: zod_1.z.string().min(6, "Password must be at least 6 characters").max(128).optional(),
  phone: zod_1.z.string().max(20).optional(),
  classIds: zod_1.z.array(exports.firestoreId).max(MAX_ARRAY_ITEMS).optional(),
  subjects: zod_1.z.array(zod_1.z.string().max(MAX_SHORT_TEXT)).max(MAX_ARRAY_ITEMS).optional(),
  linkedStudentIds: zod_1.z.array(exports.firestoreId).max(MAX_ARRAY_ITEMS).optional(),
});
/** v1 successor: api-contract identity/users `SwitchActiveTenantRequestSchema` (`tenantId`→`targetTenantId`). */
exports.SwitchActiveTenantRequestSchema = zod_1.z.object({
  tenantId: exports.firestoreId,
});
/** v1 successor: api-contract identity/users `JoinTenantRequestSchema`. */
exports.JoinTenantRequestSchema = zod_1.z.object({
  tenantCode: zod_1.z.string().min(1, "Tenant code is required").max(50),
});
// ── Platform ──────────────────────────────────────────────────────────────
/** v1 successor: api-contract identity/platform `SaveGlobalEvaluationPresetRequestSchema` (rubricSnapshot shape). */
exports.SaveGlobalPresetRequestSchema = zod_1.z.object({
  id: zod_1.z.string().optional(),
  data: zod_1.z
    .object({
      name: zod_1.z.string().optional(),
      description: zod_1.z.string().optional(),
      isDefault: zod_1.z.boolean().optional(),
      isPublic: zod_1.z.boolean().optional(),
      enabledDimensions: zod_1.z
        .array(
          zod_1.z.object({
            id: zod_1.z.string(),
            name: zod_1.z.string(),
            description: zod_1.z.string(),
            icon: zod_1.z.string().optional(),
            priority: zod_1.z.enum(["HIGH", "MEDIUM", "LOW"]),
            promptGuidance: zod_1.z.string(),
            enabled: zod_1.z.boolean(),
            isDefault: zod_1.z.boolean(),
            isCustom: zod_1.z.boolean(),
            expectedFeedbackCount: zod_1.z.number().optional(),
            weight: zod_1.z.number(),
            scoringScale: zod_1.z.number(),
          })
        )
        .optional(),
      displaySettings: zod_1.z
        .object({
          showStrengths: zod_1.z.boolean(),
          showKeyTakeaway: zod_1.z.boolean(),
          prioritizeByImportance: zod_1.z.boolean(),
        })
        .optional(),
    })
    .optional(),
  delete: zod_1.z.boolean().optional(),
});
// ── Announcements & notifications ─────────────────────────────────────────
/** v1 successor: api-contract identity/notifications `SaveAnnouncementRequestSchema`. */
exports.SaveAnnouncementRequestSchema = zod_1.z.object({
  id: zod_1.z.string().optional(),
  tenantId: zod_1.z.string().optional(),
  data: zod_1.z.object({
    title: zod_1.z.string().max(200).optional(),
    body: zod_1.z.string().max(5000).optional(),
    scope: zod_1.z.enum(["platform", "tenant"]).optional(),
    targetRoles: zod_1.z.array(zod_1.z.string()).max(10).optional(),
    targetClassIds: zod_1.z.array(zod_1.z.string()).max(100).optional(),
    status: zod_1.z.enum(["draft", "published", "archived"]).optional(),
    expiresAt: zod_1.z.string().optional(),
  }),
  delete: zod_1.z.boolean().optional(),
});
/** v1 successor: api-contract identity/notifications `ListAnnouncementsRequestSchema` (paginated). */
exports.ListAnnouncementsRequestSchema = zod_1.z.object({
  tenantId: zod_1.z.string().optional(),
  scope: zod_1.z.enum(["platform", "tenant"]).optional(),
  status: zod_1.z.enum(["draft", "published", "archived"]).optional(),
  limit: zod_1.z.number().min(1).max(100).optional(),
  cursor: zod_1.z.string().optional(),
});
/** v1 successor: SPLIT into listNotifications / markNotificationRead / getNotificationBadge. */
exports.ManageNotificationsRequestSchema = zod_1.z.object({
  tenantId: exports.firestoreId,
  action: zod_1.z.enum(["list", "markRead"]),
  limit: zod_1.z.number().optional(),
  cursor: zod_1.z.string().optional(),
  notificationId: zod_1.z.string().optional(),
  markAllRead: zod_1.z.boolean().optional(),
});
//# sourceMappingURL=wire.js.map
