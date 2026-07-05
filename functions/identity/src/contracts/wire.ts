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
import { z } from "zod";
import type { Timestamp } from "@levelup/domain";

// ── Validation constants (ported) ─────────────────────────────────────────
const MAX_SHORT_TEXT = 200;
const MAX_MEDIUM_TEXT = 2000;
const MAX_ARRAY_ITEMS = 100;
const MAX_BULK_ITEMS = 500;

/** Firestore document ID pattern (no slashes, non-empty). */
export const firestoreId = z
  .string()
  .min(1, "ID cannot be empty")
  .max(1500)
  .regex(/^[^/]+$/, "ID cannot contain slashes");

// ── Generic save pattern ──────────────────────────────────────────────────

/** v1 successor: api-contract `SaveResponseSchema` (adds `archived?`). */
export interface SaveResponse {
  id: string;
  created: boolean;
}

// ── Tenant ────────────────────────────────────────────────────────────────

/** v1 successor: api-contract identity/tenant `SaveTenantRequestSchema`. */
export const SaveTenantRequestSchema = z.object({
  id: firestoreId.optional(),
  data: z.object({
    name: z.string().max(MAX_SHORT_TEXT).optional(),
    shortName: z.string().max(MAX_SHORT_TEXT).optional(),
    description: z.string().max(MAX_MEDIUM_TEXT).optional(),
    contactEmail: z.string().email("Invalid email format").max(MAX_SHORT_TEXT).optional(),
    contactPhone: z.string().max(20).nullable().optional(),
    contactPerson: z.string().max(MAX_SHORT_TEXT).nullable().optional(),
    logoUrl: z.string().nullable().optional(),
    bannerUrl: z.string().nullable().optional(),
    website: z.string().nullable().optional(),
    address: z
      .object({
        street: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        country: z.string().optional(),
        zipCode: z.string().optional(),
      })
      .optional(),
    status: z.enum(["active", "suspended", "trial", "expired", "deactivated"]).optional(),
    subscription: z
      .object({
        plan: z.enum(["free", "trial", "basic", "premium", "enterprise"]).optional(),
        maxStudents: z.number().optional(),
        maxTeachers: z.number().optional(),
        maxSpaces: z.number().optional(),
        maxExamsPerMonth: z.number().optional(),
        billingCycle: z.enum(["monthly", "annual"]).optional(),
        billingEmail: z.string().optional(),
        cancelAtPeriodEnd: z.boolean().optional(),
      })
      .passthrough()
      .optional(),
    features: z
      .object({
        autoGradeEnabled: z.boolean().optional(),
        levelUpEnabled: z.boolean().optional(),
        scannerAppEnabled: z.boolean().optional(),
        aiChatEnabled: z.boolean().optional(),
        aiGradingEnabled: z.boolean().optional(),
        analyticsEnabled: z.boolean().optional(),
        parentPortalEnabled: z.boolean().optional(),
        bulkImportEnabled: z.boolean().optional(),
        apiAccessEnabled: z.boolean().optional(),
      })
      .optional(),
    settings: z
      .object({
        geminiKeyRef: z.string().optional(),
        geminiKeySet: z.boolean().optional(),
        defaultEvaluationSettingsId: z.string().optional(),
        defaultAiModel: z.string().optional(),
        timezone: z.string().optional(),
        locale: z.string().optional(),
        gradingPolicy: z.string().optional(),
      })
      .optional(),
    branding: z
      .object({
        logoUrl: z.string().optional(),
        bannerUrl: z.string().optional(),
        primaryColor: z.string().optional(),
        accentColor: z.string().optional(),
        favicon: z.string().optional(),
      })
      .optional(),
    onboarding: z
      .object({
        completed: z.boolean().optional(),
        completedSteps: z.array(z.string()).optional(),
      })
      .optional(),
    geminiApiKey: z.string().optional(),
  }),
});

/** v1 successor: api-contract `DeactivateTenantRequestSchema` (`tenantId`→`tenantOverride`). */
export const DeactivateTenantRequestSchema = z.object({
  tenantId: firestoreId,
  reason: z.string().max(MAX_MEDIUM_TEXT).optional(),
});

/** v1 successor: api-contract `ReactivateTenantRequestSchema` (`tenantId`→`tenantOverride`). */
export const ReactivateTenantRequestSchema = z.object({
  tenantId: firestoreId,
});

/** v1 successor: api-contract `ExportTenantDataRequestSchema` (scope-based shape). */
export const ExportTenantDataRequestSchema = z.object({
  tenantId: firestoreId,
  format: z.enum(["json", "csv"]),
  collections: z.array(z.enum(["students", "teachers", "classes", "exams", "submissions"])),
});

export interface ExportTenantDataResponse {
  downloadUrl: string;
  expiresAt: string;
  recordCount: number;
}

// ── Org entities ──────────────────────────────────────────────────────────

/** v1 successor: api-contract identity/entities `SaveStaffRequestSchema`. */
export const SaveStaffRequestSchema = z.object({
  id: firestoreId.optional(),
  tenantId: firestoreId,
  data: z.object({
    uid: z.string().optional(),
    department: z.string().optional(),
    staffPermissions: z
      .object({
        canManageUsers: z.boolean().optional(),
        canManageClasses: z.boolean().optional(),
        canManageBilling: z.boolean().optional(),
        canViewAnalytics: z.boolean().optional(),
        canManageSettings: z.boolean().optional(),
        canExportData: z.boolean().optional(),
      })
      .optional(),
    status: z.enum(["active", "archived"]).optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    password: z.string().optional(),
  }),
});

/** v1 successor: api-contract identity/entities `SaveClassRequestSchema`. */
export const SaveClassRequestSchema = z.object({
  id: firestoreId.optional(),
  tenantId: firestoreId,
  data: z.object({
    name: z.string().max(MAX_SHORT_TEXT).optional(),
    grade: z.string().max(20).optional(),
    section: z.string().max(20).optional(),
    academicSessionId: firestoreId.optional(),
    teacherIds: z.array(firestoreId).max(MAX_ARRAY_ITEMS).optional(),
    status: z.enum(["active", "archived", "deleted"]).optional(),
  }),
});

/** v1 successor: api-contract identity/entities `SaveStudentRequestSchema`. */
export const SaveStudentRequestSchema = z.object({
  id: firestoreId.optional(),
  tenantId: firestoreId,
  data: z.object({
    uid: z.string().optional(),
    rollNumber: z.string().max(50).optional(),
    section: z.string().max(20).optional(),
    classIds: z.array(firestoreId).max(MAX_ARRAY_ITEMS).optional(),
    parentIds: z.array(firestoreId).max(MAX_ARRAY_ITEMS).optional(),
    grade: z.string().max(20).optional(),
    admissionNumber: z.string().max(50).optional(),
    dateOfBirth: z.string().max(20).optional(),
    status: z.enum(["active", "archived"]).optional(),
    firstName: z.string().max(MAX_SHORT_TEXT).optional(),
    lastName: z.string().max(MAX_SHORT_TEXT).optional(),
    email: z.string().email("Invalid email format").max(MAX_SHORT_TEXT).optional(),
    phone: z.string().max(20).optional(),
    password: z.string().min(6).max(128).optional(),
  }),
});

/** v1 successor: api-contract identity/entities `SaveTeacherRequestSchema` (record-based permissions). */
export const SaveTeacherRequestSchema = z.object({
  id: firestoreId.optional(),
  tenantId: firestoreId,
  data: z.object({
    uid: z.string().optional(),
    subjects: z.array(z.string().max(MAX_SHORT_TEXT)).max(MAX_ARRAY_ITEMS).optional(),
    designation: z.string().max(MAX_SHORT_TEXT).optional(),
    classIds: z.array(firestoreId).max(MAX_ARRAY_ITEMS).optional(),
    permissions: z
      .object({
        canCreateExams: z.boolean().optional(),
        canEditRubrics: z.boolean().optional(),
        canManuallyGrade: z.boolean().optional(),
        canViewAllExams: z.boolean().optional(),
        canCreateSpaces: z.boolean().optional(),
        canManageContent: z.boolean().optional(),
        canViewAnalytics: z.boolean().optional(),
        canConfigureAgents: z.boolean().optional(),
        managedSpaceIds: z.array(z.string()).optional(),
        managedClassIds: z.array(z.string()).optional(),
      })
      .optional(),
    status: z.enum(["active", "archived"]).optional(),
    firstName: z.string().max(MAX_SHORT_TEXT).optional(),
    lastName: z.string().max(MAX_SHORT_TEXT).optional(),
    email: z.string().email("Invalid email format").max(MAX_SHORT_TEXT).optional(),
    phone: z.string().max(20).optional(),
    password: z.string().min(6).max(128).optional(),
  }),
});

/** v1 successor: api-contract identity/entities `SaveParentRequestSchema` (`childStudentIds`→`studentIds`). */
export const SaveParentRequestSchema = z.object({
  id: firestoreId.optional(),
  tenantId: firestoreId,
  data: z.object({
    uid: z.string().optional(),
    childStudentIds: z.array(firestoreId).max(MAX_ARRAY_ITEMS).optional(),
    status: z.enum(["active", "archived"]).optional(),
    firstName: z.string().max(MAX_SHORT_TEXT).optional(),
    lastName: z.string().max(MAX_SHORT_TEXT).optional(),
    email: z.string().email("Invalid email format").max(MAX_SHORT_TEXT).optional(),
    phone: z.string().max(20).optional(),
    password: z.string().min(6).max(128).optional(),
  }),
});

/** v1 successor: api-contract identity/entities `SaveAcademicSessionRequestSchema` (zIsoDate dates). */
export const SaveAcademicSessionRequestSchema = z.object({
  id: firestoreId.optional(),
  tenantId: firestoreId,
  data: z.object({
    name: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    isCurrent: z.boolean().optional(),
    status: z.enum(["active", "archived"]).optional(),
  }),
});

// ── Users ─────────────────────────────────────────────────────────────────

/** v1 successor: api-contract identity/users `BulkImportStudentsRequestSchema` (`students`→`rows`). */
export const BulkImportStudentsRequestSchema = z.object({
  tenantId: firestoreId,
  students: z
    .array(
      z.object({
        firstName: z.string().min(1).max(MAX_SHORT_TEXT),
        lastName: z.string().min(1).max(MAX_SHORT_TEXT),
        rollNumber: z.string().min(1).max(50),
        email: z.string().email().max(MAX_SHORT_TEXT).optional(),
        phone: z.string().max(20).optional(),
        classId: firestoreId.optional(),
        className: z.string().max(MAX_SHORT_TEXT).optional(),
        section: z.string().max(20).optional(),
        parentFirstName: z.string().max(MAX_SHORT_TEXT).optional(),
        parentLastName: z.string().max(MAX_SHORT_TEXT).optional(),
        parentEmail: z.string().email().max(MAX_SHORT_TEXT).optional(),
        parentPhone: z.string().max(20).optional(),
      })
    )
    .max(MAX_BULK_ITEMS, "Maximum 500 students per import"),
  dryRun: z.boolean(),
});

/** v1 successor: api-contract identity/users `CreateOrgUserRequestSchema`. */
export const CreateOrgUserRequestSchema = z.object({
  tenantId: firestoreId,
  role: z.enum(["teacher", "student", "parent", "scanner", "staff"]),
  email: z.string().email("Invalid email format").max(MAX_SHORT_TEXT).optional(),
  rollNumber: z.string().max(50).optional(),
  firstName: z.string().min(1, "First name is required").max(MAX_SHORT_TEXT),
  lastName: z.string().min(1, "Last name is required").max(MAX_SHORT_TEXT),
  password: z.string().min(6, "Password must be at least 6 characters").max(128).optional(),
  phone: z.string().max(20).optional(),
  classIds: z.array(firestoreId).max(MAX_ARRAY_ITEMS).optional(),
  subjects: z.array(z.string().max(MAX_SHORT_TEXT)).max(MAX_ARRAY_ITEMS).optional(),
  linkedStudentIds: z.array(firestoreId).max(MAX_ARRAY_ITEMS).optional(),
});

/** v1 successor: api-contract identity/users `SwitchActiveTenantRequestSchema` (`tenantId`→`targetTenantId`). */
export const SwitchActiveTenantRequestSchema = z.object({
  tenantId: firestoreId,
});

/** v1 successor: api-contract identity/users `JoinTenantRequestSchema`. */
export const JoinTenantRequestSchema = z.object({
  tenantCode: z.string().min(1, "Tenant code is required").max(50),
});

// ── Platform ──────────────────────────────────────────────────────────────

/** v1 successor: api-contract identity/platform `SaveGlobalEvaluationPresetRequestSchema` (rubricSnapshot shape). */
export const SaveGlobalPresetRequestSchema = z.object({
  id: z.string().optional(),
  data: z
    .object({
      name: z.string().optional(),
      description: z.string().optional(),
      isDefault: z.boolean().optional(),
      isPublic: z.boolean().optional(),
      enabledDimensions: z
        .array(
          z.object({
            id: z.string(),
            name: z.string(),
            description: z.string(),
            icon: z.string().optional(),
            priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
            promptGuidance: z.string(),
            enabled: z.boolean(),
            isDefault: z.boolean(),
            isCustom: z.boolean(),
            expectedFeedbackCount: z.number().optional(),
            weight: z.number(),
            scoringScale: z.number(),
          })
        )
        .optional(),
      displaySettings: z
        .object({
          showStrengths: z.boolean(),
          showKeyTakeaway: z.boolean(),
          prioritizeByImportance: z.boolean(),
        })
        .optional(),
    })
    .optional(),
  delete: z.boolean().optional(),
});

// ── Announcements & notifications ─────────────────────────────────────────

/** v1 successor: api-contract identity/notifications `SaveAnnouncementRequestSchema`. */
export const SaveAnnouncementRequestSchema = z.object({
  id: z.string().optional(),
  tenantId: z.string().optional(),
  data: z.object({
    title: z.string().max(200).optional(),
    body: z.string().max(5000).optional(),
    scope: z.enum(["platform", "tenant"]).optional(),
    targetRoles: z.array(z.string()).max(10).optional(),
    targetClassIds: z.array(z.string()).max(100).optional(),
    status: z.enum(["draft", "published", "archived"]).optional(),
    expiresAt: z.string().optional(),
  }),
  delete: z.boolean().optional(),
});

export interface SaveAnnouncementResponse {
  id: string;
  created?: boolean;
  deleted?: boolean;
}

/** v1 successor: api-contract identity/notifications `ListAnnouncementsRequestSchema` (paginated). */
export const ListAnnouncementsRequestSchema = z.object({
  tenantId: z.string().optional(),
  scope: z.enum(["platform", "tenant"]).optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  limit: z.number().min(1).max(100).optional(),
  cursor: z.string().optional(),
});

/** B8: timestamps out are canonical ISO strings (were raw Firestore objects pre-U3.1). */
export interface ListAnnouncementsResponse {
  announcements: Array<{
    id: string;
    title: string;
    body: string;
    authorName: string;
    scope: "platform" | "tenant";
    status: "draft" | "published" | "archived";
    targetRoles?: string[];
    targetClassIds?: string[];
    publishedAt?: Timestamp | null;
    archivedAt?: Timestamp | null;
    expiresAt?: Timestamp | null;
    createdAt: Timestamp | null;
    updatedAt: Timestamp | null;
  }>;
  nextCursor?: string;
}

/** v1 successor: SPLIT into listNotifications / markNotificationRead / getNotificationBadge. */
export const ManageNotificationsRequestSchema = z.object({
  tenantId: firestoreId,
  action: z.enum(["list", "markRead"]),
  limit: z.number().optional(),
  cursor: z.string().optional(),
  notificationId: z.string().optional(),
  markAllRead: z.boolean().optional(),
});

/** B8: `createdAt` out is a canonical ISO string. */
export interface ManageNotificationsResponse {
  notifications?: Array<{
    id: string;
    type: string;
    title: string;
    body: string;
    isRead: boolean;
    createdAt: Timestamp | null;
    entityType?: string;
    entityId?: string;
    actionUrl?: string;
  }>;
  nextCursor?: string;
  success?: boolean;
}
