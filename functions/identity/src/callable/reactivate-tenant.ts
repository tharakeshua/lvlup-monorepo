import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { ReactivateTenantRequestSchema } from "@levelup/shared-types";
import { getUser, parseRequest, logTenantAction, writePlatformActivity } from "../utils";
import { enforceRateLimit } from "../utils/rate-limit";

/**
 * reactivateTenant — SuperAdmin reactivates a deactivated tenant.
 * - Restores tenant to its previous status (or 'active')
 * - Reactivates all memberships that were suspended during deactivation
 */
export const reactivateTenant = onCall({ region: "asia-south1", cors: true }, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "Must be logged in");

  const { tenantId } = parseRequest(request.data, ReactivateTenantRequestSchema);

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
  if (tenantData.status !== "deactivated") {
    throw new HttpsError("failed-precondition", "Tenant is not deactivated");
  }

  // Restore to previous status or default to 'active'
  const restoredStatus = tenantData.deactivation?.previousStatus ?? "active";

  // Reactivate all suspended memberships
  const membershipsSnap = await db
    .collection("userMemberships")
    .where("tenantId", "==", tenantId)
    .where("status", "==", "suspended")
    .get();

  // Update tenant status first
  await tenantRef.update({
    status: restoredStatus,
    "deactivation.reactivatedAt": FieldValue.serverTimestamp(),
    "deactivation.reactivatedBy": callerUid,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: callerUid,
  });

  // Reactivate memberships in chunks (Firestore batch limit is 500)
  const BATCH_CHUNK_SIZE = 450;
  const membershipDocs = membershipsSnap.docs;
  for (let i = 0; i < membershipDocs.length; i += BATCH_CHUNK_SIZE) {
    const chunk = membershipDocs.slice(i, i + BATCH_CHUNK_SIZE);
    const batch = db.batch();
    for (const membershipDoc of chunk) {
      batch.update(membershipDoc.ref, {
        status: "active",
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  }

  logger.info(`Reactivated tenant ${tenantId} (${membershipsSnap.size} memberships restored)`);

  await logTenantAction(tenantId, callerUid, "reactivateTenant", {
    restoredStatus,
    membershipsReactivated: membershipsSnap.size,
  });

  await writePlatformActivity(
    "tenant_reactivated",
    callerUid,
    {
      restoredStatus,
      membershipsReactivated: membershipsSnap.size,
      tenantName: tenantData.name,
    },
    tenantId
  );

  return {
    success: true,
    membershipsReactivated: membershipsSnap.size,
  };
});
