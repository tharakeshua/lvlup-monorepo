/**
 * Tenant (school / institution) types.
 * Collection: /tenants/{tenantId}
 */

import type { FirestoreTimestamp } from "./user";

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
  expiresAt?: FirestoreTimestamp;
  maxStudents?: number;
  maxTeachers?: number;
  maxSpaces?: number;
  maxExamsPerMonth?: number;
  billingCycle?: "monthly" | "annual";
  billingEmail?: string;
  currentPeriodStart?: FirestoreTimestamp;
  currentPeriodEnd?: FirestoreTimestamp;
  cancelAtPeriodEnd?: boolean;
}

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
  lastUpdated: FirestoreTimestamp;
}

export interface TenantOnboarding {
  completed: boolean;
  completedSteps: string[];
  completedAt?: FirestoreTimestamp;
}

export interface TenantDeactivation {
  reason?: string;
  deactivatedAt?: FirestoreTimestamp;
  deactivatedBy?: string;
  previousStatus?: TenantStatus;
  reactivatedAt?: FirestoreTimestamp;
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

  /** Convenience field: when the trial period ends (set during creation for trial plans) */
  trialEndsAt?: FirestoreTimestamp;

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

  createdAt: FirestoreTimestamp;
  createdBy?: string;
  updatedAt: FirestoreTimestamp;
  updatedBy?: string;
}
