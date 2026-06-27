import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { SwitchActiveTenantRequestSchema } from "@levelup/shared-types";
import {
  getMembership,
  getTenant,
  assertTenantAccessible,
  buildClaimsForMembership,
  parseRequest,
} from "../utils";
import { enforceRateLimit } from "../utils/rate-limit";

interface SwitchActiveTenantRequest {
  tenantId: string;
}

interface SwitchActiveTenantResponse {
  success: boolean;
  role: string;
}

/**
 * switchActiveTenant — Switch a user's active tenant context.
 *
 * Validates the user has an active membership in the target tenant,
 * updates custom claims to reflect the new tenant, and updates the
 * user's activeTenantId.
 */
export const switchActiveTenant = onCall({ region: "asia-south1", cors: true }, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "Must be logged in");

  const data = parseRequest(request.data, SwitchActiveTenantRequestSchema);

  if (!data.tenantId) {
    throw new HttpsError("invalid-argument", "tenantId is required");
  }

  await enforceRateLimit(data.tenantId, callerUid, "auth", 10);

  // Verify the user has an active membership in this tenant
  const membership = await getMembership(callerUid, data.tenantId);
  if (!membership || membership.status !== "active") {
    throw new HttpsError("permission-denied", "No active membership found for this tenant");
  }

  // Verify the tenant is accessible
  const tenant = await getTenant(data.tenantId);
  assertTenantAccessible(tenant, "access");

  // Build and set new custom claims for this tenant
  const claims = buildClaimsForMembership(membership);
  await admin.auth().setCustomUserClaims(callerUid, claims);

  // Update user's activeTenantId
  await admin.firestore().doc(`users/${callerUid}`).update({
    activeTenantId: data.tenantId,
    updatedAt: FieldValue.serverTimestamp(),
  });

  logger.info(`User ${callerUid} switched to tenant ${data.tenantId} (role: ${membership.role})`);

  return { success: true, role: membership.role } satisfies SwitchActiveTenantResponse;
});
