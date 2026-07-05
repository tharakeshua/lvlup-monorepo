/**
 * Parity-gap reads for super-admin tenant pages.
 *
 * The platform activity / tenant audit log (`platformActivityLog`) has NO
 * callable equivalent in @levelup/api-contract, so it cannot go through
 * @levelup/query. This module is the ONLY place in apps/super-admin allowed to
 * touch `firebase/firestore` directly (mirrors the SDK composition root rule):
 * it reads through the shared-services Firebase handle and is consumed from the
 * component via a plain TanStack `useQuery`.
 *
 * REPORTED GAP: tenant audit log needs a `listTenantAuditLog` (or
 * `listPlatformActivity`) callable on the identity contract.
 */
import { getSdk } from "./api";

export interface TenantAuditLogEntry {
  id: string;
  action: string;
  actorEmail: string;
  actorUid: string;
  tenantId: string;
  metadata: Record<string, unknown>;
  /** Canonical ISO timestamp (the v1 callable view). */
  createdAt: string;
}

export interface TenantAuditLogPage {
  entries: TenantAuditLogEntry[];
  hasMore: boolean;
}

/**
 * Read up to `pageSize` audit-log entries for a tenant, newest first, optionally
 * filtered by action.
 *
 * U2.4+5 cutover: the direct `platformActivityLog` query is rules-denied — the
 * v1 `listPlatformActivity` callable is the sanctioned path; `tenantOverride`
 * doubles as the per-tenant feed filter server-side.
 */
export async function listTenantAuditLog(
  tenantId: string,
  actionFilter: string,
  pageSize: number
): Promise<TenantAuditLogPage> {
  const { api } = getSdk();
  const res = await api.analytics.listPlatformActivity({
    tenantOverride: tenantId,
    ...(actionFilter !== "all" ? { action: actionFilter } : {}),
    limit: pageSize,
  } as never);
  return {
    entries: res.items as unknown as TenantAuditLogEntry[],
    hasMore: res.nextCursor != null,
  };
}
