import { HttpsError } from "firebase-functions/v2/https";
import type { Tenant } from "../contracts/legacy-docs";
import { getUser, getMembership } from "./firestore-helpers";

/** Statuses that allow full write operations (create users, import, etc.). */
const WRITE_ALLOWED_STATUSES: Tenant["status"][] = ["active"];

/** Statuses that allow read/switch operations (users can still access). */
const ACCESS_ALLOWED_STATUSES: Tenant["status"][] = ["active", "trial"];

/**
 * Assert a tenant is accessible for the given operation type.
 * - 'write': only active tenants (creating users, importing, etc.)
 * - 'access': active or trial tenants (switching, reading data, etc.)
 */
export function assertTenantAccessible(tenant: Tenant | null, operation: "write" | "access"): void {
  if (!tenant) {
    throw new HttpsError("not-found", "Tenant not found");
  }

  const allowed = operation === "write" ? WRITE_ALLOWED_STATUSES : ACCESS_ALLOWED_STATUSES;
  if (!allowed.includes(tenant.status)) {
    throw new HttpsError(
      "failed-precondition",
      `Tenant is not ${operation === "write" ? "active" : "accessible"} (status: ${tenant.status})`
    );
  }
}

/** Assert the caller is a TenantAdmin for the given tenant, or a SuperAdmin. */
export async function assertTenantAdminOrSuperAdmin(
  callerUid: string | undefined,
  tenantId: string
): Promise<void> {
  if (!callerUid) throw new HttpsError("unauthenticated", "Must be logged in");

  const callerUser = await getUser(callerUid);
  if (callerUser?.isSuperAdmin) return;

  const membership = await getMembership(callerUid, tenantId);
  if (membership?.role !== "tenantAdmin" || membership?.status !== "active") {
    throw new HttpsError("permission-denied", "Must be TenantAdmin or SuperAdmin");
  }
}
