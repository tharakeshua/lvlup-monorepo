"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertTenantAccessible = assertTenantAccessible;
exports.assertTenantAdminOrSuperAdmin = assertTenantAdminOrSuperAdmin;
const https_1 = require("firebase-functions/v2/https");
const firestore_helpers_1 = require("./firestore-helpers");
/** Statuses that allow full write operations (create users, import, etc.). */
const WRITE_ALLOWED_STATUSES = ["active"];
/** Statuses that allow read/switch operations (users can still access). */
const ACCESS_ALLOWED_STATUSES = ["active", "trial"];
/**
 * Assert a tenant is accessible for the given operation type.
 * - 'write': only active tenants (creating users, importing, etc.)
 * - 'access': active or trial tenants (switching, reading data, etc.)
 */
function assertTenantAccessible(tenant, operation) {
  if (!tenant) {
    throw new https_1.HttpsError("not-found", "Tenant not found");
  }
  const allowed = operation === "write" ? WRITE_ALLOWED_STATUSES : ACCESS_ALLOWED_STATUSES;
  if (!allowed.includes(tenant.status)) {
    throw new https_1.HttpsError(
      "failed-precondition",
      `Tenant is not ${operation === "write" ? "active" : "accessible"} (status: ${tenant.status})`
    );
  }
}
/** Assert the caller is a TenantAdmin for the given tenant, or a SuperAdmin. */
async function assertTenantAdminOrSuperAdmin(callerUid, tenantId) {
  if (!callerUid) throw new https_1.HttpsError("unauthenticated", "Must be logged in");
  const callerUser = await (0, firestore_helpers_1.getUser)(callerUid);
  if (callerUser?.isSuperAdmin) return;
  const membership = await (0, firestore_helpers_1.getMembership)(callerUid, tenantId);
  if (membership?.role !== "tenantAdmin" || membership?.status !== "active") {
    throw new https_1.HttpsError("permission-denied", "Must be TenantAdmin or SuperAdmin");
  }
}
//# sourceMappingURL=assertions.js.map
