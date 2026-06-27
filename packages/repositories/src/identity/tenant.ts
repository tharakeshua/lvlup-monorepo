/**
 * `tenantRepo` (SDK-LAYERS-PLAN §4.1, identity.md "tenantRepo").
 *
 * Super-admin tenant list/get + save + lifecycle verbs (deactivate/reactivate —
 * §4.5 DX-5 explicit lifecycle, never a `save()` status flip) + export/asset +
 * the pre-auth `lookupByCode` (returns ONLY `TenantPublicView`). `canTransition`
 * is a pure read of the FROZEN `tenant` machine. Derived `computeSeatsRemaining`
 * / `isWritable` are computed locally from an already-fetched tenant.
 */
import type { Tenant, TenantId, TenantPublicView } from "@levelup/domain";
import type {
  ApiClient,
  ListTenantsRequest,
  SaveInput,
  SaveResponse,
  TenantLifecycleResponse,
  TenantSummary,
  ExportTenantDataRequest,
  ExportTenantDataResponse,
  UploadTenantAssetRequest,
  UploadTenantAssetResponse,
} from "../internal/api-types.js";
import { paginate, type PageBag } from "../internal/paginate.js";
import { can } from "../internal/transitions.js";

/** Tenant statuses from which writes are still allowed (UX gate). */
const WRITABLE_STATUSES = new Set(["trial", "active"]);

export interface TenantRepo {
  list(filter?: ListTenantsRequest): Promise<PageBag<TenantSummary>>;
  paginate(filter?: ListTenantsRequest): Promise<PageBag<TenantSummary>>;
  get(tenantOverride?: TenantId | string): Promise<Tenant>;
  save(input: SaveInput<Record<string, unknown>>): Promise<SaveResponse>;
  deactivate(tenantOverride: TenantId | string, reason?: string): Promise<TenantLifecycleResponse>;
  reactivate(tenantOverride: TenantId | string): Promise<TenantLifecycleResponse>;
  exportData(input: ExportTenantDataRequest): Promise<ExportTenantDataResponse>;
  uploadAsset(input: UploadTenantAssetRequest): Promise<UploadTenantAssetResponse>;
  /** Pre-auth lookup — returns ONLY `TenantPublicView` (no enumeration leak). */
  lookupByCode(code: string): Promise<TenantPublicView>;
  /** Pure `tenant` machine pre-check. No wire call. */
  canTransition(from: string | undefined, to: string): boolean;
  /** Derived: is this tenant in a writable status? Computed locally. */
  isWritable(tenant: { status?: string }): boolean;
  /** Derived: seats left = subscription max − usage current (best-effort, local). */
  computeSeatsRemaining(tenant: TenantSeatsShape): number | null;
}

interface TenantSeatsShape {
  subscription?: { maxStudents?: number; maxUsers?: number } | null;
  usage?: { currentStudents?: number; currentUsers?: number } | null;
}

export function createTenantRepo(api: ApiClient): TenantRepo {
  return {
    list: (filter = {}) => paginate(api.identity.listTenants, filter),
    paginate: (filter = {}) => paginate(api.identity.listTenants, filter),
    get: (tenantOverride) =>
      api.identity.getTenant(tenantOverride ? { tenantOverride: tenantOverride as TenantId } : {}),
    save: (input) => api.identity.saveTenant(input),
    deactivate: (tenantOverride, reason) =>
      api.identity.deactivateTenant({ tenantOverride: tenantOverride as TenantId, reason }),
    reactivate: (tenantOverride) =>
      api.identity.reactivateTenant({ tenantOverride: tenantOverride as TenantId }),
    exportData: (input) => api.identity.exportTenantData(input),
    uploadAsset: (input) => api.identity.uploadTenantAsset(input),
    lookupByCode: (code) => api.identity.lookupTenantByCode({ tenantCode: code }),
    canTransition: (from, to) => can("tenant", from, to),
    isWritable: (tenant) => (tenant.status ? WRITABLE_STATUSES.has(tenant.status) : false),
    computeSeatsRemaining: (tenant) => {
      const max = tenant.subscription?.maxStudents ?? tenant.subscription?.maxUsers;
      const used = tenant.usage?.currentStudents ?? tenant.usage?.currentUsers;
      if (max == null || used == null) return null;
      return Math.max(0, max - used);
    },
  };
}
