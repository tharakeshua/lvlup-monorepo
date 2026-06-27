import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { JoinTenantRequestSchema } from "@levelup/shared-types";
import {
  getUser,
  getTenant,
  assertTenantAccessible,
  buildClaimsForMembership,
  parseRequest,
} from "../utils";
import { enforceRateLimit } from "../utils/rate-limit";

interface JoinTenantRequest {
  tenantCode: string;
}

interface JoinTenantResponse {
  tenantId: string;
  membershipId: string;
  role: string;
}

/**
 * joinTenant — Allow a user to join a tenant using a tenant code.
 *
 * Creates a UserMembership with a pending role (defaults to 'student').
 * The tenant admin can later update the role/permissions.
 */
export const joinTenant = onCall({ region: "asia-south1", cors: true }, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "Must be logged in");

  const data = parseRequest(request.data, JoinTenantRequestSchema);

  if (!data.tenantCode?.trim()) {
    throw new HttpsError("invalid-argument", "tenantCode is required");
  }

  const db = admin.firestore();
  const normalizedCode = data.tenantCode.trim().toUpperCase();

  // Look up tenant by code
  const tenantCodeDoc = await db.doc(`tenantCodes/${normalizedCode}`).get();
  if (!tenantCodeDoc.exists) {
    throw new HttpsError("not-found", "Invalid tenant code");
  }

  const tenantId = tenantCodeDoc.data()!.tenantId as string;

  await enforceRateLimit(tenantId, callerUid, "auth", 10);

  // Verify the tenant is accessible
  const tenant = await getTenant(tenantId);
  assertTenantAccessible(tenant, "access");

  // Check if user already has a membership
  const membershipId = `${callerUid}_${tenantId}`;
  const existingMembership = await db.doc(`userMemberships/${membershipId}`).get();
  if (existingMembership.exists) {
    const existing = existingMembership.data()!;
    if (existing.status === "active") {
      throw new HttpsError("already-exists", "You are already a member of this organization");
    }
    // Re-activate if previously deactivated
    await existingMembership.ref.update({
      status: "active",
      updatedAt: FieldValue.serverTimestamp(),
    });

    logger.info(`Re-activated membership ${membershipId} for user ${callerUid}`);
    return { tenantId, membershipId, role: existing.role } satisfies JoinTenantResponse;
  }

  // Ensure the user doc exists
  const callerUser = await getUser(callerUid);
  if (!callerUser) {
    throw new HttpsError(
      "failed-precondition",
      "User profile not found. Please complete registration first."
    );
  }

  // Create new membership (default role: student, pending admin assignment)
  const membership = {
    id: membershipId,
    uid: callerUid,
    tenantId,
    tenantCode: normalizedCode,
    role: "student" as const,
    status: "active" as const,
    joinSource: "tenant_code" as const,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await db.doc(`userMemberships/${membershipId}`).set(membership);

  // Set custom claims for the new tenant
  const claims = buildClaimsForMembership(membership);
  await admin.auth().setCustomUserClaims(callerUid, claims);

  // Update user's activeTenantId if they don't have one
  if (!callerUser.activeTenantId) {
    await db.doc(`users/${callerUid}`).update({
      activeTenantId: tenantId,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  logger.info(`User ${callerUid} joined tenant ${tenantId} via code ${normalizedCode}`);

  return { tenantId, membershipId, role: "student" } satisfies JoinTenantResponse;
});
