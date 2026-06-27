/**
 * Composable audit/soft-delete/tenant-scope zod shapes + a `withAudit` mixin so
 * every entity schema appends audit uniformly.
 */
import { z } from "zod";
import { zTimestamp } from "./timestamp.zod.js";
import { zUserId, zTenantId } from "./branded-id.zod.js";

export const zAuditFields = {
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
  createdBy: zUserId,
  updatedBy: zUserId,
} as const;

export const zSoftDeletable = { archivedAt: zTimestamp.nullable() } as const;

export const zTenantScoped = { tenantId: zTenantId } as const;

/** entity authors: zObject({ ...fields, ...withAudit({}) }) */
export const withAudit = <T extends z.ZodRawShape>(shape: T) =>
  ({ ...shape, ...zAuditFields, ...zSoftDeletable }) as T &
    typeof zAuditFields &
    typeof zSoftDeletable;
