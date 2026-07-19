/**
 * Tenant (+ nested subscription/features/settings/stats/branding/usage/onboarding/
 * deactivation embeds) and the TenantCodeIndex + TenantPublicView projections.
 * `stats`/`usage` are ⚷ trigger-maintained. `settings.geminiKeyRef` is a Secret
 * Manager ref only — never the key value.
 */
import { z } from "zod";
import { zObject } from "../../authoring/strict.js";
import { zTenantId, zTenantCode, zUserId } from "../../primitives/branded-id.zod.js";
import { zTimestamp } from "../../primitives/timestamp.zod.js";
import { zTenantStatus, zTenantPlan } from "../../enums/tenant.js";

export const TenantSubscriptionSchema = zObject({
  plan: zTenantPlan,
  maxStudents: z.number().int().optional(),
  maxTeachers: z.number().int().optional(),
  maxExamsPerMonth: z.number().int().optional(),
  maxAiCallsPerMonth: z.number().int().optional(),
  renewsAt: zTimestamp.nullable(),
});
export type TenantSubscription = z.infer<typeof TenantSubscriptionSchema>;

export const TenantFeaturesSchema = zObject({
  autograde: z.boolean().optional(),
  levelup: z.boolean().optional(),
  analytics: z.boolean().optional(),
  store: z.boolean().optional(),
  // Conversational AI is explicit-on: omitted means disabled. The root switch
  // and the mode-specific switch must both be true before a session can start.
  conversations: z.boolean().optional(),
  conversationTutor: z.boolean().optional(),
  conversationQuestionHelp: z.boolean().optional(),
  conversationAssessment: z.boolean().optional(),
});
export type TenantFeatures = z.infer<typeof TenantFeaturesSchema>;

export const TenantSettingsSchema = zObject({
  // Secret Manager reference ONLY — never the key value.
  geminiKeyRef: z.string().optional(),
  timezone: z.string().optional(),
  locale: z.string().optional(),
  gradingScale: z.string().optional(),
});
export type TenantSettings = z.infer<typeof TenantSettingsSchema>;

export const TenantStatsSchema = zObject({
  totalStudents: z.number().int().default(0),
  totalTeachers: z.number().int().default(0),
  totalClasses: z.number().int().default(0),
  totalExams: z.number().int().default(0),
  totalSpaces: z.number().int().default(0),
});
export type TenantStats = z.infer<typeof TenantStatsSchema>;

export const TenantUsageSchema = zObject({
  examsThisMonth: z.number().int().default(0),
  aiCallsThisMonth: z.number().int().default(0),
  resetAt: zTimestamp.nullable(),
});
export type TenantUsage = z.infer<typeof TenantUsageSchema>;

export const TenantBrandingSchema = zObject({
  logoUrl: z.string().optional(),
  bannerUrl: z.string().optional(),
  faviconUrl: z.string().optional(),
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
});
export type TenantBranding = z.infer<typeof TenantBrandingSchema>;

export const TenantOnboardingSchema = zObject({
  completed: z.boolean().default(false),
  steps: z.array(z.string()).optional(),
  completedAt: zTimestamp.nullable(),
});
export type TenantOnboarding = z.infer<typeof TenantOnboardingSchema>;

export const TenantDeactivationSchema = zObject({
  reason: z.string().optional(),
  deactivatedBy: zUserId.optional(),
  deactivatedAt: zTimestamp.nullable(),
});
export type TenantDeactivation = z.infer<typeof TenantDeactivationSchema>;

export const TenantSchema = zObject({
  id: zTenantId,
  name: z.string(),
  shortName: z.string().optional(),
  slug: z.string(),
  tenantCode: zTenantCode,
  ownerUid: zUserId,
  status: zTenantStatus,
  subscription: TenantSubscriptionSchema,
  features: TenantFeaturesSchema,
  settings: TenantSettingsSchema,
  stats: TenantStatsSchema,
  usage: TenantUsageSchema.optional(),
  branding: TenantBrandingSchema.optional(),
  onboarding: TenantOnboardingSchema.optional(),
  deactivation: TenantDeactivationSchema.optional(),
  contactEmail: z.string().optional(),
  contactPhone: z.string().optional(),
  trialEndsAt: zTimestamp.nullable(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
  createdBy: zUserId,
  updatedBy: zUserId,
});
export type Tenant = z.infer<typeof TenantSchema>;

export const TenantCodeIndexSchema = zObject({
  tenantId: zTenantId,
  createdAt: zTimestamp,
});
export type TenantCodeIndex = z.infer<typeof TenantCodeIndexSchema>;

export const TenantPublicViewSchema = zObject({
  tenantId: zTenantId,
  name: z.string(),
  status: zTenantStatus,
  // Pre-auth trial-expiry signal (login gates). Optional: deployed backends that
  // predate this field must keep passing literal-true response validation.
  trialEndsAt: zTimestamp.nullable().optional(),
  branding: TenantBrandingSchema.optional(),
});
export type TenantPublicView = z.infer<typeof TenantPublicViewSchema>;

/** Login/access gate outcome for a tenant — the ONE place apps decide it. */
export type TenantAccessDecision =
  | { allowed: true; trial: boolean }
  | { allowed: false; reason: "trial_expired" | "inactive" };

/**
 * SSOT access gate over tenant status (used by every app's school-code login and
 * session gates). `trial` tenants have FULL access until `trialEndsAt` passes;
 * a missing/null `trialEndsAt` never locks a trial out (fail-open: the server is
 * the enforcement authority, this gate only shapes UX). `expired` is the
 * post-trial terminal status; everything else non-active is plain inactive.
 */
export function evaluateTenantAccess(
  tenant: { status: string; trialEndsAt?: string | null },
  now: Date = new Date()
): TenantAccessDecision {
  if (tenant.status === "active") return { allowed: true, trial: false };
  if (tenant.status === "trial") {
    const ends = tenant.trialEndsAt ? Date.parse(tenant.trialEndsAt) : Number.NaN;
    if (Number.isFinite(ends) && ends <= now.getTime()) {
      return { allowed: false, reason: "trial_expired" };
    }
    return { allowed: true, trial: true };
  }
  if (tenant.status === "expired") return { allowed: false, reason: "trial_expired" };
  return { allowed: false, reason: "inactive" };
}
