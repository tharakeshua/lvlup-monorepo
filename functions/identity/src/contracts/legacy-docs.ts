/**
 * LEGACY DOC SHAPES for the unprefixed collections this package serves
 * (`tenants/`, `users/`, `userMemberships/`, …). Ported from @levelup/shared-types
 * as part of U3.1 (DATA-MODEL-FIX-PLAN §3/§6) so that package can be deleted (U3.5).
 *
 * These are deliberately NOT the @levelup/domain entity schemas: docs at rest in
 * the legacy collections carry legacy field vocabularies (e.g. 9-flag features,
 * legacy teacher-permission keys — RR-T2-B, unresolved) and, pre-B8, Firestore
 * Timestamp objects. Casting legacy docs to domain types would be a lie; these
 * types describe what is actually at rest. Enums/roles/primitives that ARE
 * identical to domain come from domain — never redefined here.
 *
 * B8 timestamps: every timestamp field is `LegacyTimestamp` (= domain
 * `TimestampInput`): old docs hold Firestore Timestamp objects, docs written
 * after U3.1 hold canonical ISO strings. NEVER consume one directly — collapse
 * with `toTimestamp()` from @levelup/domain at the point of use.
 */
import type { TimestampInput, TenantRole, AuthProvider } from "@levelup/domain";

/** Firestore-Timestamp-or-ISO-string. Collapse with domain `toTimestamp()`. */
export type LegacyTimestamp = TimestampInput;

// Re-exported so handlers have ONE local import surface for legacy doc shapes.
export type { TenantRole, AuthProvider };

// ─────────────────────────────────────────────────────────────────────────────
// Tenant — /tenants/{tenantId}
// ─────────────────────────────────────────────────────────────────────────────

export interface TenantAddress {
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
}

export type TenantPlan = "free" | "trial" | "basic" | "premium" | "enterprise";

export type TenantStatus = "active" | "suspended" | "trial" | "expired" | "deactivated";

export interface TenantSubscription {
  plan: TenantPlan;
  expiresAt?: LegacyTimestamp;
  maxStudents?: number;
  maxTeachers?: number;
  maxSpaces?: number;
  maxExamsPerMonth?: number;
  billingCycle?: "monthly" | "annual";
  billingEmail?: string;
  currentPeriodStart?: LegacyTimestamp;
  currentPeriodEnd?: LegacyTimestamp;
  cancelAtPeriodEnd?: boolean;
}

/** Legacy 9-flag vocabulary (domain's canonical TenantFeatures has 4 flags). */
export interface TenantFeatures {
  autoGradeEnabled: boolean;
  levelUpEnabled: boolean;
  scannerAppEnabled: boolean;
  aiChatEnabled: boolean;
  aiGradingEnabled: boolean;
  analyticsEnabled: boolean;
  parentPortalEnabled: boolean;
  bulkImportEnabled: boolean;
  apiAccessEnabled: boolean;
}

export interface TenantSettings {
  geminiKeyRef?: string;
  geminiKeySet: boolean;
  defaultEvaluationSettingsId?: string;
  defaultAiModel?: string;
  timezone?: string;
  locale?: string;
  gradingPolicy?: string;
}

export interface TenantStats {
  totalStudents: number;
  totalTeachers: number;
  totalClasses: number;
  totalSpaces: number;
  totalExams: number;
  activeStudentsLast30Days?: number;
}

export interface TenantBranding {
  logoUrl?: string;
  bannerUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  favicon?: string;
}

export interface TenantUsage {
  currentStudents: number;
  currentTeachers: number;
  currentSpaces: number;
  examsThisMonth: number;
  aiCallsThisMonth: number;
  storageBytes: number;
  lastUpdated: LegacyTimestamp;
}

export interface TenantOnboarding {
  completed: boolean;
  completedSteps: string[];
  completedAt?: LegacyTimestamp;
}

export interface TenantDeactivation {
  reason?: string;
  deactivatedAt?: LegacyTimestamp;
  deactivatedBy?: string;
  previousStatus?: TenantStatus;
  reactivatedAt?: LegacyTimestamp;
  reactivatedBy?: string;
}

export interface Tenant {
  id: string;
  name: string;
  shortName?: string;
  slug: string;
  description?: string;
  tenantCode: string;
  ownerUid: string;
  trialEndsAt?: LegacyTimestamp;
  contactEmail: string;
  contactPhone?: string;
  contactPerson?: string;
  /** @deprecated Use branding.logoUrl instead */
  logoUrl?: string;
  /** @deprecated Use branding.bannerUrl instead */
  bannerUrl?: string;
  website?: string;
  address?: TenantAddress;
  status: TenantStatus;
  subscription: TenantSubscription;
  features: TenantFeatures;
  settings: TenantSettings;
  stats: TenantStats;
  branding?: TenantBranding;
  usage?: TenantUsage;
  onboarding?: TenantOnboarding;
  deactivation?: TenantDeactivation;
  createdAt: LegacyTimestamp;
  createdBy?: string;
  updatedAt: LegacyTimestamp;
  updatedBy?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// UnifiedUser — /users/{uid}
// ─────────────────────────────────────────────────────────────────────────────

export interface PurchaseRecord {
  spaceId: string;
  spaceTitle: string;
  amount: number;
  currency: string;
  purchasedAt: LegacyTimestamp;
  transactionId: string;
}

export interface ConsumerProfile {
  plan: "free" | "pro" | "premium";
  enrolledSpaceIds: string[];
  purchaseHistory: PurchaseRecord[];
  totalSpend: number;
}

export interface UnifiedUser {
  uid: string;
  email?: string | null;
  phone?: string | null;
  authProviders: AuthProvider[];
  displayName: string;
  firstName?: string | null;
  lastName?: string | null;
  photoURL?: string | null;
  country?: string;
  age?: number;
  grade?: string;
  onboardingCompleted?: boolean;
  preferences?: Record<string, unknown>;
  isSuperAdmin: boolean;
  consumerProfile?: ConsumerProfile;
  activeTenantId?: string;
  createdAt: LegacyTimestamp;
  updatedAt: LegacyTimestamp;
  lastLogin?: LegacyTimestamp;
  status: "active" | "suspended" | "deleted";
}

// ─────────────────────────────────────────────────────────────────────────────
// UserMembership — /userMemberships/{uid}_{tenantId}
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Legacy teacher-permission vocabulary. Domain's TEACHER_PERMISSION_KEYS
 * diverges (RR-T2-B — blocked on a product decision); claims pass these keys
 * through UNTRANSLATED, exactly like the v1 claim builder.
 */
export interface TeacherPermissions {
  canCreateExams?: boolean;
  canEditRubrics?: boolean;
  canManuallyGrade?: boolean;
  canViewAllExams?: boolean;
  canCreateSpaces?: boolean;
  canManageContent?: boolean;
  canViewAnalytics?: boolean;
  canConfigureAgents?: boolean;
  managedSpaceIds?: string[];
  /** Source of truth for claims classIds. */
  managedClassIds?: string[];
}

export const DEFAULT_TEACHER_PERMISSIONS: TeacherPermissions = {
  canCreateExams: true,
  canEditRubrics: true,
  canManuallyGrade: true,
  canViewAllExams: false,
  canCreateSpaces: false,
  canManageContent: false,
  canViewAnalytics: false,
  canConfigureAgents: false,
  managedSpaceIds: [],
  managedClassIds: [],
};

/** Legacy staff-permission vocabulary (see RR-T2-B note above). */
export interface StaffPermissions {
  canManageUsers: boolean;
  canManageClasses: boolean;
  canManageBilling: boolean;
  canViewAnalytics: boolean;
  canManageSettings: boolean;
  canExportData: boolean;
}

export const DEFAULT_STAFF_PERMISSIONS: StaffPermissions = {
  canManageUsers: false,
  canManageClasses: false,
  canManageBilling: false,
  canViewAnalytics: true,
  canManageSettings: false,
  canExportData: false,
};

export interface UserMembership {
  id: string;
  uid: string;
  tenantId: string;
  tenantCode: string;
  role: TenantRole;
  status: "active" | "inactive" | "suspended";
  joinSource:
    | "admin_created"
    | "bulk_import"
    | "invite_code"
    | "self_register"
    | "migration"
    | "tenant_code";
  teacherId?: string;
  studentId?: string;
  parentId?: string;
  scannerId?: string;
  schoolId?: string;
  staffId?: string;
  permissions?: TeacherPermissions;
  staffPermissions?: StaffPermissions;
  parentLinkedStudentIds?: string[];
  createdAt: LegacyTimestamp;
  updatedAt: LegacyTimestamp;
  lastActive?: LegacyTimestamp;
}

/**
 * Minimal subset of UserMembership needed to build custom claims — callers can
 * pass memberships whose audit timestamps are still write sentinels.
 */
export type MembershipClaimsInput = Pick<
  UserMembership,
  | "role"
  | "tenantId"
  | "tenantCode"
  | "permissions"
  | "staffPermissions"
  | "teacherId"
  | "studentId"
  | "parentId"
  | "parentLinkedStudentIds"
  | "staffId"
  | "scannerId"
> & {
  /** Top-level classIds (v1 membership shape); legacy docs carry permissions.managedClassIds. */
  classIds?: string[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Role profiles — /tenants/{tenantId}/students|classes/...
// ─────────────────────────────────────────────────────────────────────────────

export interface Student {
  id: string;
  tenantId: string;
  uid: string;
  rollNumber?: string;
  section?: string;
  classIds: string[];
  parentIds: string[];
  grade?: string;
  admissionNumber?: string;
  dateOfBirth?: string;
  status: "active" | "archived";
  createdAt: LegacyTimestamp;
  updatedAt: LegacyTimestamp;
}

export interface Class {
  id: string;
  tenantId: string;
  name: string;
  grade: string;
  section?: string;
  academicSessionId?: string;
  teacherIds: string[];
  studentIds: string[];
  studentCount: number;
  status: "active" | "archived";
  createdAt: LegacyTimestamp;
  updatedAt: LegacyTimestamp;
}
