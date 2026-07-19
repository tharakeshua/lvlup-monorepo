import * as functions from "firebase-functions/v2";
import * as admin from "firebase-admin";
import { CallableRequest } from "firebase-functions/v2/https";

export interface CallerMembership {
  uid: string;
  tenantId: string;
  role: string;
  permissions?: Record<string, boolean>;
}

/**
 * Extract and validate caller membership from custom claims.
 */
export function getCallerMembership(request: CallableRequest): CallerMembership {
  if (!request.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
  }

  const claims = request.auth.token;
  const uid = request.auth.uid;
  const tenantId = claims.tenantId as string | undefined;
  const role = claims.role as string | undefined;

  if (!tenantId || !role) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "No active tenant context. Please switch to a tenant first."
    );
  }

  return {
    uid,
    tenantId,
    role,
    permissions: claims.permissions as Record<string, boolean> | undefined,
  };
}

/**
 * Assert caller has permission for AutoGrade operations.
 * Accepts tenantAdmin, superAdmin, or teacher with the specified permission.
 */
export function assertAutogradePermission(
  caller: CallerMembership,
  requiredTenantId: string,
  teacherPermission?: string,
  options?: { allowScanner?: boolean }
): void {
  if (caller.tenantId !== requiredTenantId) {
    throw new functions.https.HttpsError("permission-denied", "Cross-tenant access denied.");
  }

  if (caller.role === "superAdmin" || caller.role === "tenantAdmin") {
    return;
  }

  if (caller.role === "teacher") {
    if (!teacherPermission) return; // No specific permission needed
    if (caller.permissions?.[teacherPermission]) return;
    throw new functions.https.HttpsError(
      "permission-denied",
      `Teacher lacks required permission: ${teacherPermission}.`
    );
  }

  if (caller.role === "scanner") {
    if (options?.allowScanner) return;
    throw new functions.https.HttpsError(
      "permission-denied",
      "Scanner role is not permitted for this operation."
    );
  }

  throw new functions.https.HttpsError(
    "permission-denied",
    `Role '${caller.role}' cannot perform this operation.`
  );
}
