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
/** Firestore document ID pattern (no slashes, non-empty). */
export declare const firestoreId: z.ZodString;
/** v1 successor: api-contract `SaveResponseSchema` (adds `archived?`). */
export interface SaveResponse {
  id: string;
  created: boolean;
}
/** v1 successor: api-contract identity/tenant `SaveTenantRequestSchema`. */
export declare const SaveTenantRequestSchema: z.ZodObject<
  {
    id: z.ZodOptional<z.ZodString>;
    data: z.ZodObject<
      {
        name: z.ZodOptional<z.ZodString>;
        shortName: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
        contactEmail: z.ZodOptional<z.ZodString>;
        contactPhone: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        contactPerson: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        logoUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        bannerUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        website: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        address: z.ZodOptional<
          z.ZodObject<
            {
              street: z.ZodOptional<z.ZodString>;
              city: z.ZodOptional<z.ZodString>;
              state: z.ZodOptional<z.ZodString>;
              country: z.ZodOptional<z.ZodString>;
              zipCode: z.ZodOptional<z.ZodString>;
            },
            z.core.$strip
          >
        >;
        status: z.ZodOptional<
          z.ZodEnum<{
            trial: "trial";
            active: "active";
            suspended: "suspended";
            expired: "expired";
            deactivated: "deactivated";
          }>
        >;
        subscription: z.ZodOptional<
          z.ZodObject<
            {
              plan: z.ZodOptional<
                z.ZodEnum<{
                  free: "free";
                  trial: "trial";
                  basic: "basic";
                  premium: "premium";
                  enterprise: "enterprise";
                }>
              >;
              maxStudents: z.ZodOptional<z.ZodNumber>;
              maxTeachers: z.ZodOptional<z.ZodNumber>;
              maxSpaces: z.ZodOptional<z.ZodNumber>;
              maxExamsPerMonth: z.ZodOptional<z.ZodNumber>;
              billingCycle: z.ZodOptional<
                z.ZodEnum<{
                  monthly: "monthly";
                  annual: "annual";
                }>
              >;
              billingEmail: z.ZodOptional<z.ZodString>;
              cancelAtPeriodEnd: z.ZodOptional<z.ZodBoolean>;
            },
            z.core.$loose
          >
        >;
        features: z.ZodOptional<
          z.ZodObject<
            {
              autoGradeEnabled: z.ZodOptional<z.ZodBoolean>;
              levelUpEnabled: z.ZodOptional<z.ZodBoolean>;
              scannerAppEnabled: z.ZodOptional<z.ZodBoolean>;
              aiChatEnabled: z.ZodOptional<z.ZodBoolean>;
              aiGradingEnabled: z.ZodOptional<z.ZodBoolean>;
              analyticsEnabled: z.ZodOptional<z.ZodBoolean>;
              parentPortalEnabled: z.ZodOptional<z.ZodBoolean>;
              bulkImportEnabled: z.ZodOptional<z.ZodBoolean>;
              apiAccessEnabled: z.ZodOptional<z.ZodBoolean>;
            },
            z.core.$strip
          >
        >;
        settings: z.ZodOptional<
          z.ZodObject<
            {
              geminiKeyRef: z.ZodOptional<z.ZodString>;
              geminiKeySet: z.ZodOptional<z.ZodBoolean>;
              defaultEvaluationSettingsId: z.ZodOptional<z.ZodString>;
              defaultAiModel: z.ZodOptional<z.ZodString>;
              timezone: z.ZodOptional<z.ZodString>;
              locale: z.ZodOptional<z.ZodString>;
              gradingPolicy: z.ZodOptional<z.ZodString>;
            },
            z.core.$strip
          >
        >;
        branding: z.ZodOptional<
          z.ZodObject<
            {
              logoUrl: z.ZodOptional<z.ZodString>;
              bannerUrl: z.ZodOptional<z.ZodString>;
              primaryColor: z.ZodOptional<z.ZodString>;
              accentColor: z.ZodOptional<z.ZodString>;
              favicon: z.ZodOptional<z.ZodString>;
            },
            z.core.$strip
          >
        >;
        onboarding: z.ZodOptional<
          z.ZodObject<
            {
              completed: z.ZodOptional<z.ZodBoolean>;
              completedSteps: z.ZodOptional<z.ZodArray<z.ZodString>>;
            },
            z.core.$strip
          >
        >;
        geminiApiKey: z.ZodOptional<z.ZodString>;
      },
      z.core.$strip
    >;
  },
  z.core.$strip
>;
/** v1 successor: api-contract `DeactivateTenantRequestSchema` (`tenantId`→`tenantOverride`). */
export declare const DeactivateTenantRequestSchema: z.ZodObject<
  {
    tenantId: z.ZodString;
    reason: z.ZodOptional<z.ZodString>;
  },
  z.core.$strip
>;
/** v1 successor: api-contract `ReactivateTenantRequestSchema` (`tenantId`→`tenantOverride`). */
export declare const ReactivateTenantRequestSchema: z.ZodObject<
  {
    tenantId: z.ZodString;
  },
  z.core.$strip
>;
/** v1 successor: api-contract `ExportTenantDataRequestSchema` (scope-based shape). */
export declare const ExportTenantDataRequestSchema: z.ZodObject<
  {
    tenantId: z.ZodString;
    format: z.ZodEnum<{
      json: "json";
      csv: "csv";
    }>;
    collections: z.ZodArray<
      z.ZodEnum<{
        classes: "classes";
        students: "students";
        teachers: "teachers";
        exams: "exams";
        submissions: "submissions";
      }>
    >;
  },
  z.core.$strip
>;
export interface ExportTenantDataResponse {
  downloadUrl: string;
  expiresAt: string;
  recordCount: number;
}
/** v1 successor: api-contract identity/entities `SaveStaffRequestSchema`. */
export declare const SaveStaffRequestSchema: z.ZodObject<
  {
    id: z.ZodOptional<z.ZodString>;
    tenantId: z.ZodString;
    data: z.ZodObject<
      {
        uid: z.ZodOptional<z.ZodString>;
        department: z.ZodOptional<z.ZodString>;
        staffPermissions: z.ZodOptional<
          z.ZodObject<
            {
              canManageUsers: z.ZodOptional<z.ZodBoolean>;
              canManageClasses: z.ZodOptional<z.ZodBoolean>;
              canManageBilling: z.ZodOptional<z.ZodBoolean>;
              canViewAnalytics: z.ZodOptional<z.ZodBoolean>;
              canManageSettings: z.ZodOptional<z.ZodBoolean>;
              canExportData: z.ZodOptional<z.ZodBoolean>;
            },
            z.core.$strip
          >
        >;
        status: z.ZodOptional<
          z.ZodEnum<{
            active: "active";
            archived: "archived";
          }>
        >;
        firstName: z.ZodOptional<z.ZodString>;
        lastName: z.ZodOptional<z.ZodString>;
        email: z.ZodOptional<z.ZodString>;
        phone: z.ZodOptional<z.ZodString>;
        password: z.ZodOptional<z.ZodString>;
      },
      z.core.$strip
    >;
  },
  z.core.$strip
>;
/** v1 successor: api-contract identity/entities `SaveClassRequestSchema`. */
export declare const SaveClassRequestSchema: z.ZodObject<
  {
    id: z.ZodOptional<z.ZodString>;
    tenantId: z.ZodString;
    data: z.ZodObject<
      {
        name: z.ZodOptional<z.ZodString>;
        grade: z.ZodOptional<z.ZodString>;
        section: z.ZodOptional<z.ZodString>;
        academicSessionId: z.ZodOptional<z.ZodString>;
        teacherIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
        status: z.ZodOptional<
          z.ZodEnum<{
            active: "active";
            deleted: "deleted";
            archived: "archived";
          }>
        >;
      },
      z.core.$strip
    >;
  },
  z.core.$strip
>;
/** v1 successor: api-contract identity/entities `SaveStudentRequestSchema`. */
export declare const SaveStudentRequestSchema: z.ZodObject<
  {
    id: z.ZodOptional<z.ZodString>;
    tenantId: z.ZodString;
    data: z.ZodObject<
      {
        uid: z.ZodOptional<z.ZodString>;
        rollNumber: z.ZodOptional<z.ZodString>;
        section: z.ZodOptional<z.ZodString>;
        classIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
        parentIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
        grade: z.ZodOptional<z.ZodString>;
        admissionNumber: z.ZodOptional<z.ZodString>;
        dateOfBirth: z.ZodOptional<z.ZodString>;
        status: z.ZodOptional<
          z.ZodEnum<{
            active: "active";
            archived: "archived";
          }>
        >;
        firstName: z.ZodOptional<z.ZodString>;
        lastName: z.ZodOptional<z.ZodString>;
        email: z.ZodOptional<z.ZodString>;
        phone: z.ZodOptional<z.ZodString>;
        password: z.ZodOptional<z.ZodString>;
      },
      z.core.$strip
    >;
  },
  z.core.$strip
>;
/** v1 successor: api-contract identity/entities `SaveTeacherRequestSchema` (record-based permissions). */
export declare const SaveTeacherRequestSchema: z.ZodObject<
  {
    id: z.ZodOptional<z.ZodString>;
    tenantId: z.ZodString;
    data: z.ZodObject<
      {
        uid: z.ZodOptional<z.ZodString>;
        subjects: z.ZodOptional<z.ZodArray<z.ZodString>>;
        designation: z.ZodOptional<z.ZodString>;
        classIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
        permissions: z.ZodOptional<
          z.ZodObject<
            {
              canCreateExams: z.ZodOptional<z.ZodBoolean>;
              canEditRubrics: z.ZodOptional<z.ZodBoolean>;
              canManuallyGrade: z.ZodOptional<z.ZodBoolean>;
              canViewAllExams: z.ZodOptional<z.ZodBoolean>;
              canCreateSpaces: z.ZodOptional<z.ZodBoolean>;
              canManageContent: z.ZodOptional<z.ZodBoolean>;
              canViewAnalytics: z.ZodOptional<z.ZodBoolean>;
              canConfigureAgents: z.ZodOptional<z.ZodBoolean>;
              managedSpaceIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
              managedClassIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
            },
            z.core.$strip
          >
        >;
        status: z.ZodOptional<
          z.ZodEnum<{
            active: "active";
            archived: "archived";
          }>
        >;
        firstName: z.ZodOptional<z.ZodString>;
        lastName: z.ZodOptional<z.ZodString>;
        email: z.ZodOptional<z.ZodString>;
        phone: z.ZodOptional<z.ZodString>;
        password: z.ZodOptional<z.ZodString>;
      },
      z.core.$strip
    >;
  },
  z.core.$strip
>;
/** v1 successor: api-contract identity/entities `SaveParentRequestSchema` (`childStudentIds`→`studentIds`). */
export declare const SaveParentRequestSchema: z.ZodObject<
  {
    id: z.ZodOptional<z.ZodString>;
    tenantId: z.ZodString;
    data: z.ZodObject<
      {
        uid: z.ZodOptional<z.ZodString>;
        childStudentIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
        status: z.ZodOptional<
          z.ZodEnum<{
            active: "active";
            archived: "archived";
          }>
        >;
        firstName: z.ZodOptional<z.ZodString>;
        lastName: z.ZodOptional<z.ZodString>;
        email: z.ZodOptional<z.ZodString>;
        phone: z.ZodOptional<z.ZodString>;
        password: z.ZodOptional<z.ZodString>;
      },
      z.core.$strip
    >;
  },
  z.core.$strip
>;
/** v1 successor: api-contract identity/entities `SaveAcademicSessionRequestSchema` (zIsoDate dates). */
export declare const SaveAcademicSessionRequestSchema: z.ZodObject<
  {
    id: z.ZodOptional<z.ZodString>;
    tenantId: z.ZodString;
    data: z.ZodObject<
      {
        name: z.ZodOptional<z.ZodString>;
        startDate: z.ZodOptional<z.ZodString>;
        endDate: z.ZodOptional<z.ZodString>;
        isCurrent: z.ZodOptional<z.ZodBoolean>;
        status: z.ZodOptional<
          z.ZodEnum<{
            active: "active";
            archived: "archived";
          }>
        >;
      },
      z.core.$strip
    >;
  },
  z.core.$strip
>;
/** v1 successor: api-contract identity/users `BulkImportStudentsRequestSchema` (`students`→`rows`). */
export declare const BulkImportStudentsRequestSchema: z.ZodObject<
  {
    tenantId: z.ZodString;
    students: z.ZodArray<
      z.ZodObject<
        {
          firstName: z.ZodString;
          lastName: z.ZodString;
          rollNumber: z.ZodString;
          email: z.ZodOptional<z.ZodString>;
          phone: z.ZodOptional<z.ZodString>;
          classId: z.ZodOptional<z.ZodString>;
          className: z.ZodOptional<z.ZodString>;
          section: z.ZodOptional<z.ZodString>;
          parentFirstName: z.ZodOptional<z.ZodString>;
          parentLastName: z.ZodOptional<z.ZodString>;
          parentEmail: z.ZodOptional<z.ZodString>;
          parentPhone: z.ZodOptional<z.ZodString>;
        },
        z.core.$strip
      >
    >;
    dryRun: z.ZodBoolean;
  },
  z.core.$strip
>;
/** v1 successor: api-contract identity/users `CreateOrgUserRequestSchema`. */
export declare const CreateOrgUserRequestSchema: z.ZodObject<
  {
    tenantId: z.ZodString;
    role: z.ZodEnum<{
      teacher: "teacher";
      student: "student";
      parent: "parent";
      scanner: "scanner";
      staff: "staff";
    }>;
    email: z.ZodOptional<z.ZodString>;
    rollNumber: z.ZodOptional<z.ZodString>;
    firstName: z.ZodString;
    lastName: z.ZodString;
    password: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    classIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    subjects: z.ZodOptional<z.ZodArray<z.ZodString>>;
    linkedStudentIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
  },
  z.core.$strip
>;
/** v1 successor: api-contract identity/users `SwitchActiveTenantRequestSchema` (`tenantId`→`targetTenantId`). */
export declare const SwitchActiveTenantRequestSchema: z.ZodObject<
  {
    tenantId: z.ZodString;
  },
  z.core.$strip
>;
/** v1 successor: api-contract identity/users `JoinTenantRequestSchema`. */
export declare const JoinTenantRequestSchema: z.ZodObject<
  {
    tenantCode: z.ZodString;
  },
  z.core.$strip
>;
/** v1 successor: api-contract identity/platform `SaveGlobalEvaluationPresetRequestSchema` (rubricSnapshot shape). */
export declare const SaveGlobalPresetRequestSchema: z.ZodObject<
  {
    id: z.ZodOptional<z.ZodString>;
    data: z.ZodOptional<
      z.ZodObject<
        {
          name: z.ZodOptional<z.ZodString>;
          description: z.ZodOptional<z.ZodString>;
          isDefault: z.ZodOptional<z.ZodBoolean>;
          isPublic: z.ZodOptional<z.ZodBoolean>;
          enabledDimensions: z.ZodOptional<
            z.ZodArray<
              z.ZodObject<
                {
                  id: z.ZodString;
                  name: z.ZodString;
                  description: z.ZodString;
                  icon: z.ZodOptional<z.ZodString>;
                  priority: z.ZodEnum<{
                    HIGH: "HIGH";
                    MEDIUM: "MEDIUM";
                    LOW: "LOW";
                  }>;
                  promptGuidance: z.ZodString;
                  enabled: z.ZodBoolean;
                  isDefault: z.ZodBoolean;
                  isCustom: z.ZodBoolean;
                  expectedFeedbackCount: z.ZodOptional<z.ZodNumber>;
                  weight: z.ZodNumber;
                  scoringScale: z.ZodNumber;
                },
                z.core.$strip
              >
            >
          >;
          displaySettings: z.ZodOptional<
            z.ZodObject<
              {
                showStrengths: z.ZodBoolean;
                showKeyTakeaway: z.ZodBoolean;
                prioritizeByImportance: z.ZodBoolean;
              },
              z.core.$strip
            >
          >;
        },
        z.core.$strip
      >
    >;
    delete: z.ZodOptional<z.ZodBoolean>;
  },
  z.core.$strip
>;
/** v1 successor: api-contract identity/notifications `SaveAnnouncementRequestSchema`. */
export declare const SaveAnnouncementRequestSchema: z.ZodObject<
  {
    id: z.ZodOptional<z.ZodString>;
    tenantId: z.ZodOptional<z.ZodString>;
    data: z.ZodObject<
      {
        title: z.ZodOptional<z.ZodString>;
        body: z.ZodOptional<z.ZodString>;
        scope: z.ZodOptional<
          z.ZodEnum<{
            platform: "platform";
            tenant: "tenant";
          }>
        >;
        targetRoles: z.ZodOptional<z.ZodArray<z.ZodString>>;
        targetClassIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
        status: z.ZodOptional<
          z.ZodEnum<{
            archived: "archived";
            draft: "draft";
            published: "published";
          }>
        >;
        expiresAt: z.ZodOptional<z.ZodString>;
      },
      z.core.$strip
    >;
    delete: z.ZodOptional<z.ZodBoolean>;
  },
  z.core.$strip
>;
export interface SaveAnnouncementResponse {
  id: string;
  created?: boolean;
  deleted?: boolean;
}
/** v1 successor: api-contract identity/notifications `ListAnnouncementsRequestSchema` (paginated). */
export declare const ListAnnouncementsRequestSchema: z.ZodObject<
  {
    tenantId: z.ZodOptional<z.ZodString>;
    scope: z.ZodOptional<
      z.ZodEnum<{
        platform: "platform";
        tenant: "tenant";
      }>
    >;
    status: z.ZodOptional<
      z.ZodEnum<{
        archived: "archived";
        draft: "draft";
        published: "published";
      }>
    >;
    limit: z.ZodOptional<z.ZodNumber>;
    cursor: z.ZodOptional<z.ZodString>;
  },
  z.core.$strip
>;
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
export declare const ManageNotificationsRequestSchema: z.ZodObject<
  {
    tenantId: z.ZodString;
    action: z.ZodEnum<{
      list: "list";
      markRead: "markRead";
    }>;
    limit: z.ZodOptional<z.ZodNumber>;
    cursor: z.ZodOptional<z.ZodString>;
    notificationId: z.ZodOptional<z.ZodString>;
    markAllRead: z.ZodOptional<z.ZodBoolean>;
  },
  z.core.$strip
>;
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
