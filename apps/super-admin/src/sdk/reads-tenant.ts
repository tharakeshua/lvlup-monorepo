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
import { collection, getDocs, query, where, orderBy, limit } from "firebase/firestore";
import { getFirebaseServices } from "@levelup/shared-services";

export interface TenantAuditLogEntry {
  id: string;
  action: string;
  actorEmail: string;
  actorUid: string;
  tenantId: string;
  metadata: Record<string, unknown>;
  createdAt: { seconds?: number; toDate?: () => Date };
}

export interface TenantAuditLogPage {
  entries: TenantAuditLogEntry[];
  hasMore: boolean;
}

/**
 * Read up to `pageSize` audit-log entries for a tenant, newest first, optionally
 * filtered by action. Fetches `pageSize + 1` to derive `hasMore`.
 */
export async function listTenantAuditLog(
  tenantId: string,
  actionFilter: string,
  pageSize: number
): Promise<TenantAuditLogPage> {
  const { db } = getFirebaseServices();

  const q =
    actionFilter !== "all"
      ? query(
          collection(db, "platformActivityLog"),
          where("tenantId", "==", tenantId),
          where("action", "==", actionFilter),
          orderBy("createdAt", "desc"),
          limit(pageSize + 1)
        )
      : query(
          collection(db, "platformActivityLog"),
          where("tenantId", "==", tenantId),
          orderBy("createdAt", "desc"),
          limit(pageSize + 1)
        );

  const snap = await getDocs(q);
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TenantAuditLogEntry);
  return {
    entries: docs.slice(0, pageSize),
    hasMore: docs.length > pageSize,
  };
}
