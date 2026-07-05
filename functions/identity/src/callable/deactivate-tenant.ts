import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { isoNow } from "@levelup/domain";
import { DeactivateTenantRequestSchema } from "../contracts/wire";
import { getUser, parseRequest, logTenantAction, writePlatformActivity } from "../utils";
import { enforceRateLimit } from "../utils/rate-limit";

/**
 * deactivateTenant — SuperAdmin deactivates a tenant.
 * - Sets tenant status to 'deactivated'
 * - Suspends all active user memberships
 * - Preserves data for potential reactivation
 */
export const deactivateTenant = onCall({ region: "asia-south1", cors: true }, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "Must be logged in");

  const { tenantId, reason } = parseRequest(request.data, DeactivateTenantRequestSchema);

  // SuperAdmin only
  const callerUser = await getUser(callerUid);
  if (!callerUser?.isSuperAdmin) {
    throw new HttpsError("permission-denied", "SuperAdmin only");
  }

  await enforceRateLimit(tenantId, callerUid, "write", 30);

  const db = admin.firestore();
  const tenantRef = db.doc(`tenants/${tenantId}`);
  const tenantDoc = await tenantRef.get();

  if (!tenantDoc.exists) {
    throw new HttpsError("not-found", "Tenant not found");
  }

  const tenantData = tenantDoc.data()!;
  if (tenantData.status === "deactivated") {
    throw new HttpsError("failed-precondition", "Tenant is already deactivated");
  }

  // Suspend all active memberships for this tenant
  const membershipsSnap = await db
    .collection("userMemberships")
    .where("tenantId", "==", tenantId)
    .where("status", "==", "active")
    .get();

  // Update tenant status first
  await tenantRef.update({
    status: "deactivated",
    "deactivation.reason": reason ?? null,
    // B8: timestamps at rest are canonical ISO strings.
    "deactivation.deactivatedAt": isoNow(),
    "deactivation.deactivatedBy": callerUid,
    "deactivation.previousStatus": tenantData.status,
    updatedAt: isoNow(),
    updatedBy: callerUid,
  });

  // Suspend all active memberships in chunks (Firestore batch limit is 500)
  const BATCH_CHUNK_SIZE = 450;
  const membershipDocs = membershipsSnap.docs;
  for (let i = 0; i < membershipDocs.length; i += BATCH_CHUNK_SIZE) {
    const chunk = membershipDocs.slice(i, i + BATCH_CHUNK_SIZE);
    const batch = db.batch();
    for (const membershipDoc of chunk) {
      batch.update(membershipDoc.ref, {
        status: "suspended",
        updatedAt: isoNow(),
      });
    }
    await batch.commit();
  }

  logger.info(`Deactivated tenant ${tenantId} (${membershipsSnap.size} memberships suspended)`);

  await logTenantAction(tenantId, callerUid, "deactivateTenant", {
    reason,
    membershipsSuspended: membershipsSnap.size,
  });

  await writePlatformActivity(
    "tenant_deactivated",
    callerUid,
    {
      reason,
      membershipsSuspended: membershipsSnap.size,
      tenantName: tenantData.name,
    },
    tenantId
  );

  return {
    success: true,
    membershipsSuspended: membershipsSnap.size,
  };
});
