/**
 * AuditFields, soft-delete, tenant-scoping mixins. Collapses the three live
 * soft-delete conventions into one `archivedAt` (REVIEW D5).
 */
import type { Timestamp } from "./timestamp.js";
import type { TenantId, UserId } from "./brand.js";

export interface AuditFields {
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: UserId;
  updatedBy: UserId;
}

/** Canonical soft-delete (D5): null = live, set = archived. */
export interface SoftDeletable {
  archivedAt: Timestamp | null;
}

/** Most tenant docs carry their tenantId for collection-group queries + defense-in-depth. */
export interface TenantScoped {
  tenantId: TenantId;
}

export type AuditedEntity = AuditFields & SoftDeletable;
