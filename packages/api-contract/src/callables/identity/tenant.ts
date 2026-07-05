/**
 * Tenant lifecycle + settings/features + platform-config callables (identity).
 *
 * Super-admin cross-tenant ops carry an OPTIONAL `tenantOverride` (never a body
 * `tenantId` — §8 D2 / `no-tenant-id-in-request`) and set `allowsTenantOverride`.
 * Lifecycle transitions (deactivate/reactivate) + secret handling (geminiApiKey →
 * Secret Manager) are `authoritySensitive`. Schemas are `.strict()`.
 */
import { z } from "zod";
import {
  TenantPublicViewSchema,
  TenantSchema,
  zTenantId,
  zTenantStatus,
  zTenantPlan,
  TenantFeaturesSchema,
  TenantSettingsSchema,
  TenantBrandingSchema,
} from "@levelup/domain";
import {
  defineCallable,
  pageResponse,
  withPaging,
  PageRequest,
  SaveResponseSchema,
  type CallableDef,
} from "./_shared.js";

/** Slim super-admin tenant row (list projection — no ⚷ counters beyond status). */
export const TenantSummarySchema = z
  .object({
    id: zTenantId,
    name: z.string(),
    slug: z.string(),
    status: zTenantStatus,
    plan: zTenantPlan,
    totalStudents: z.number().int(),
    totalTeachers: z.number().int(),
    createdAt: z.string(),
  })
  .strict();

// ── saveTenant ───────────────────────────────────────────────────────────────
export const SaveTenantRequestSchema = z
  .object({
    id: zTenantId.optional(),
    data: z
      .object({
        name: z.string().optional(),
        shortName: z.string().optional(),
        // Public join code (e.g. "SUB001"). On CREATE the server writes the
        // `tenantCodes/{tenantCode}` index so `lookupTenantByCode`/`joinTenant`
        // resolve it; it is the tenant's stable human-facing code (≠ tenantId).
        tenantCode: z.string().optional(),
        slug: z.string().optional(),
        contactEmail: z.string().optional(),
        contactPhone: z.string().optional(),
        plan: zTenantPlan.optional(),
        features: TenantFeaturesSchema.optional(),
        settings: TenantSettingsSchema.optional(),
        branding: TenantBrandingSchema.optional(),
        // Plaintext key on the WIRE only; the server stores a Secret Manager ref
        // (geminiKeyRef) and never persists/returns the value (§authority #8).
        geminiApiKey: z.string().optional(),
      })
      .strict(),
    delete: z.boolean().optional(),
  })
  .strict();
export type SaveTenantRequest = z.infer<typeof SaveTenantRequestSchema>;

export const saveTenant = defineCallable({
  name: "v1.identity.saveTenant",
  module: "identity",
  requestSchema: SaveTenantRequestSchema,
  responseSchema: SaveResponseSchema,
  authMode: "authed",
  rateTier: "write",
  invalidates: ["tenants"],
  authoritySensitive: true,
});

// ── deactivateTenant ──────────────────────────────────────────────────────────
export const DeactivateTenantRequestSchema = z
  .object({
    tenantOverride: zTenantId,
    reason: z.string().optional(),
  })
  .strict();
export type DeactivateTenantRequest = z.infer<typeof DeactivateTenantRequestSchema>;

export const DeactivateTenantResponseSchema = z
  .object({ tenantId: zTenantId, status: zTenantStatus })
  .strict();

export const deactivateTenant = defineCallable({
  name: "v1.identity.deactivateTenant",
  module: "identity",
  requestSchema: DeactivateTenantRequestSchema,
  responseSchema: DeactivateTenantResponseSchema,
  authMode: "authed",
  rateTier: "write",
  allowsTenantOverride: true,
  invalidates: ["tenants", "memberships"],
  authoritySensitive: true,
});

// ── reactivateTenant ──────────────────────────────────────────────────────────
export const ReactivateTenantRequestSchema = z.object({ tenantOverride: zTenantId }).strict();
export type ReactivateTenantRequest = z.infer<typeof ReactivateTenantRequestSchema>;

export const reactivateTenant = defineCallable({
  name: "v1.identity.reactivateTenant",
  module: "identity",
  requestSchema: ReactivateTenantRequestSchema,
  responseSchema: DeactivateTenantResponseSchema,
  authMode: "authed",
  rateTier: "write",
  allowsTenantOverride: true,
  invalidates: ["tenants", "memberships"],
  authoritySensitive: true,
});

// ── exportTenantData (C9: per-collection scope) ───────────────────────────────
export const EXPORT_COLLECTIONS = [
  "students",
  "teachers",
  "parents",
  "classes",
  "exams",
  "analytics",
  "all",
] as const;
export const zExportCollection = z.enum(EXPORT_COLLECTIONS);
export type ExportCollection = (typeof EXPORT_COLLECTIONS)[number];

export const ExportTenantDataRequestSchema = z
  .object({
    tenantOverride: zTenantId.optional(),
    scope: zExportCollection,
    collections: z.array(zExportCollection).optional(),
  })
  .strict();
export type ExportTenantDataRequest = z.infer<typeof ExportTenantDataRequestSchema>;

export const ExportTenantDataResponseSchema = z
  .object({ downloadUrl: z.string(), expiresAt: z.string() })
  .strict();

export const exportTenantData = defineCallable({
  name: "v1.identity.exportTenantData",
  module: "identity",
  requestSchema: ExportTenantDataRequestSchema,
  responseSchema: ExportTenantDataResponseSchema,
  authMode: "authed",
  rateTier: "report",
  allowsTenantOverride: true,
});

// ── listExportJobs (C9) ───────────────────────────────────────────────────────
export const ExportJobSchema = z
  .object({
    id: z.string(),
    scope: zExportCollection,
    status: z.enum(["pending", "running", "completed", "failed", "expired"]),
    downloadUrl: z.string().nullable(),
    requestedAt: z.string(),
    completedAt: z.string().nullable(),
    expiresAt: z.string().nullable(),
  })
  .strict();

export const ListExportJobsRequestSchema = PageRequest;
export type ListExportJobsRequest = z.infer<typeof ListExportJobsRequestSchema>;

export const listExportJobs = defineCallable({
  name: "v1.identity.listExportJobs",
  module: "identity",
  requestSchema: ListExportJobsRequestSchema,
  responseSchema: pageResponse(ExportJobSchema),
  authMode: "authed",
  rateTier: "read",
});

// ── uploadTenantAsset ─────────────────────────────────────────────────────────
export const UploadTenantAssetRequestSchema = z
  .object({
    kind: z.enum(["logo", "banner", "favicon"]),
    contentType: z.string(),
    bytesBase64: z.string(),
  })
  .strict();
export type UploadTenantAssetRequest = z.infer<typeof UploadTenantAssetRequestSchema>;

export const UploadTenantAssetResponseSchema = z.object({ assetUrl: z.string() }).strict();

export const uploadTenantAsset = defineCallable({
  name: "v1.identity.uploadTenantAsset",
  module: "identity",
  requestSchema: UploadTenantAssetRequestSchema,
  responseSchema: UploadTenantAssetResponseSchema,
  authMode: "authed",
  rateTier: "write",
  invalidates: ["tenants"],
});

// ── lookupTenantByCode (PUBLIC — pre-auth) ────────────────────────────────────
export const LookupTenantByCodeRequestSchema = z.object({ tenantCode: z.string() }).strict();
export type LookupTenantByCodeRequest = z.infer<typeof LookupTenantByCodeRequestSchema>;

export const lookupTenantByCode = defineCallable({
  name: "v1.identity.lookupTenantByCode",
  module: "identity",
  requestSchema: LookupTenantByCodeRequestSchema,
  // The ONLY shape returned pre-auth (REVIEW §6.12 — no enumeration leak).
  responseSchema: TenantPublicViewSchema,
  authMode: "public",
  rateTier: "auth",
});

// ── saveTenantSettings (C11) ──────────────────────────────────────────────────
export const SaveTenantSettingsRequestSchema = z
  .object({
    tenantOverride: zTenantId.optional(),
    data: TenantSettingsSchema,
  })
  .strict();
export type SaveTenantSettingsRequest = z.infer<typeof SaveTenantSettingsRequestSchema>;

export const saveTenantSettings = defineCallable({
  name: "v1.identity.saveTenantSettings",
  module: "identity",
  requestSchema: SaveTenantSettingsRequestSchema,
  responseSchema: SaveResponseSchema,
  authMode: "authed",
  rateTier: "write",
  allowsTenantOverride: true,
  invalidates: ["tenants"],
});

// ── saveTenantFeatures (C30) ──────────────────────────────────────────────────
export const SaveTenantFeaturesRequestSchema = z
  .object({
    tenantOverride: zTenantId,
    features: TenantFeaturesSchema,
  })
  .strict();
export type SaveTenantFeaturesRequest = z.infer<typeof SaveTenantFeaturesRequestSchema>;

export const saveTenantFeatures = defineCallable({
  name: "v1.identity.saveTenantFeatures",
  module: "identity",
  requestSchema: SaveTenantFeaturesRequestSchema,
  responseSchema: SaveResponseSchema,
  authMode: "authed",
  rateTier: "write",
  allowsTenantOverride: true,
  invalidates: ["tenants"],
});

// ── bulkApplyTenantFeatures (C30) ─────────────────────────────────────────────
export const BulkApplyTenantFeaturesRequestSchema = z
  .object({
    tenantIds: z.array(zTenantId).min(1),
    featureKey: z.enum(["autograde", "levelup", "analytics", "store"]),
    enabled: z.boolean(),
  })
  .strict();
export type BulkApplyTenantFeaturesRequest = z.infer<typeof BulkApplyTenantFeaturesRequestSchema>;

export const BulkApplyTenantFeaturesResponseSchema = z
  .object({
    updated: z.number().int(),
    errors: z.array(z.object({ tenantId: zTenantId, error: z.string() }).strict()),
  })
  .strict();

export const bulkApplyTenantFeatures = defineCallable({
  name: "v1.identity.bulkApplyTenantFeatures",
  module: "identity",
  requestSchema: BulkApplyTenantFeaturesRequestSchema,
  responseSchema: BulkApplyTenantFeaturesResponseSchema,
  authMode: "authed",
  rateTier: "write",
  idempotent: true,
  idempotencyKey: "transport",
  // explicit `tenantIds[]` target list (not a single-tenant override) — super-admin.
  invalidates: ["tenants"],
});

// ── getPlatformConfig (C31) ───────────────────────────────────────────────────
export const PlatformConfigSchema = z
  .object({
    trialLength: z.number().int(),
    supportEmail: z.string(),
    branding: TenantBrandingSchema.optional(),
    defaultFeatures: TenantFeaturesSchema,
    maintenanceMode: z.boolean(),
    aiConfigPresent: z.boolean(),
  })
  .strict();

export const GetPlatformConfigRequestSchema = z.object({}).strict();
export type GetPlatformConfigRequest = z.infer<typeof GetPlatformConfigRequestSchema>;

export const getPlatformConfig = defineCallable({
  name: "v1.identity.getPlatformConfig",
  module: "identity",
  requestSchema: GetPlatformConfigRequestSchema,
  responseSchema: PlatformConfigSchema,
  authMode: "authed",
  rateTier: "read",
});

// ── savePlatformConfig (C31 — maintenance flag never optimistic) ──────────────
export const SavePlatformConfigRequestSchema = z
  .object({
    data: z
      .object({
        trialLength: z.number().int().optional(),
        supportEmail: z.string().optional(),
        branding: TenantBrandingSchema.optional(),
        defaultFeatures: TenantFeaturesSchema.optional(),
        maintenanceMode: z.boolean().optional(),
      })
      .strict(),
  })
  .strict();
export type SavePlatformConfigRequest = z.infer<typeof SavePlatformConfigRequestSchema>;

export const SavePlatformConfigResponseSchema = z.object({ saved: z.literal(true) }).strict();

export const savePlatformConfig = defineCallable({
  name: "v1.identity.savePlatformConfig",
  module: "identity",
  requestSchema: SavePlatformConfigRequestSchema,
  responseSchema: SavePlatformConfigResponseSchema,
  authMode: "authed",
  rateTier: "write",
  invalidates: ["platformConfig"],
  authoritySensitive: true,
});

// ── reads: getTenant / listTenants ────────────────────────────────────────────
export const GetTenantRequestSchema = z.object({ tenantOverride: zTenantId.optional() }).strict();
export type GetTenantRequest = z.infer<typeof GetTenantRequestSchema>;

export const getTenant = defineCallable({
  name: "v1.identity.getTenant",
  module: "identity",
  requestSchema: GetTenantRequestSchema,
  responseSchema: TenantSchema,
  authMode: "authed",
  rateTier: "read",
  allowsTenantOverride: true,
});

export const ListTenantsRequestSchema = withPaging(
  z.object({
    status: zTenantStatus.optional(),
    plan: zTenantPlan.optional(),
    q: z.string().optional(),
  })
);
export type ListTenantsRequest = z.infer<typeof ListTenantsRequestSchema>;

export const listTenants = defineCallable({
  name: "v1.identity.listTenants",
  module: "identity",
  requestSchema: ListTenantsRequestSchema,
  responseSchema: pageResponse(TenantSummarySchema),
  authMode: "authed",
  rateTier: "read",
});

export const TENANT_CALLABLES = {
  saveTenant,
  deactivateTenant,
  reactivateTenant,
  exportTenantData,
  listExportJobs,
  uploadTenantAsset,
  lookupTenantByCode,
  saveTenantSettings,
  saveTenantFeatures,
  bulkApplyTenantFeatures,
  getPlatformConfig,
  savePlatformConfig,
  getTenant,
  listTenants,
} as const satisfies Record<string, CallableDef>;
