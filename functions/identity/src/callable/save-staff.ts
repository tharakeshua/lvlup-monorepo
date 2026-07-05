/**
 * saveStaff — Update staff member details and permissions.
 *
 * Uses the consolidated upsert pattern:
 * - id present → update existing staff member
 */

import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { isoNow } from "@levelup/domain";
import type { TenantRole } from "@levelup/domain";
import { SaveStaffRequestSchema } from "../contracts/wire";
import type { StaffPermissions } from "../contracts/legacy-docs";
import {
  assertTenantAdminOrSuperAdmin,
  buildClaimsForMembership,
  getUser,
  parseRequest,
  logTenantAction,
} from "../utils";
import { enforceRateLimit } from "../utils/rate-limit";

export const saveStaff = onCall({ region: "asia-south1", cors: true }, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "Must be logged in");

  const { id, tenantId, data } = parseRequest(request.data, SaveStaffRequestSchema);

  if (!tenantId) {
    throw new HttpsError("invalid-argument", "tenantId is required");
  }

  await assertTenantAdminOrSuperAdmin(callerUid, tenantId);
  await enforceRateLimit(tenantId, callerUid, "write", 30);

  const db = admin.firestore();

  if (!id) {
    throw new HttpsError("invalid-argument", "Staff creation should use createOrgUser");
  }

  // Update staff doc
  const staffRef = db.doc(`tenants/${tenantId}/staff/${id}`);
  const staffDoc = await staffRef.get();

  if (!staffDoc.exists) {
    throw new HttpsError("not-found", `Staff member ${id} not found`);
  }

  const updates: Record<string, unknown> = {
    // B8: timestamps at rest are canonical ISO strings.
    updatedAt: isoNow(),
  };

  if (data.department !== undefined) updates.department = data.department;
  if (data.status !== undefined) updates.status = data.status;

  await staffRef.update(updates);

  // Update membership permissions if staffPermissions provided
  if (data.staffPermissions) {
    const staffData = staffDoc.data();
    if (staffData?.uid) {
      const membershipId = `${staffData.uid}_${tenantId}`;
      const membershipRef = db.doc(`userMemberships/${membershipId}`);
      const membershipDoc = await membershipRef.get();

      if (membershipDoc.exists) {
        await membershipRef.update({
          staffPermissions: data.staffPermissions,
          updatedAt: isoNow(),
        });

        // Refresh custom claims with new permissions. This REPLACES the target
        // user's claims (DEP-1 bug class): fetch their user doc so a super-admin
        // keeps `isSuperAdmin` across the re-mint.
        const membershipData = membershipDoc.data()!;
        const targetUser = await getUser(staffData.uid);
        const claims = buildClaimsForMembership(
          {
            tenantId,
            tenantCode: membershipData.tenantCode as string,
            role: membershipData.role as TenantRole,
            staffPermissions: data.staffPermissions as StaffPermissions,
          },
          { isSuperAdmin: targetUser?.isSuperAdmin === true }
        );
        await admin.auth().setCustomUserClaims(staffData.uid, claims);
      }
    }
  }

  await logTenantAction(tenantId, callerUid, "updateStaff", { staffId: id });

  return { id, created: false };
});
