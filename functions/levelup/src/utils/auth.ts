import * as admin from "firebase-admin";
import { HttpsError } from "firebase-functions/v2/https";
import type { TenantRole } from "@levelup/domain";
import type { UserMembership } from "../contracts/legacy-docs";

/**
 * Assert the caller is authenticated. Returns the caller UID.
 */
export function assertAuth(auth: { uid: string } | undefined): string {
  if (!auth?.uid) {
    throw new HttpsError("unauthenticated", "Must be logged in");
  }
  return auth.uid;
}

/**
 * Assert the caller is a teacher/admin for the tenant.
 * Checks the userMemberships collection.
 */
export async function assertTeacherOrAdmin(
  callerUid: string,
  tenantId: string
): Promise<{ role: TenantRole; membership: UserMembership }> {
  const db = admin.firestore();
  const membershipDoc = await db.doc(`userMemberships/${callerUid}_${tenantId}`).get();

  if (!membershipDoc.exists) {
    throw new HttpsError("permission-denied", "Not a member of this tenant");
  }

  const membership = membershipDoc.data() as UserMembership;
  if (membership.status !== "active") {
    throw new HttpsError("permission-denied", "Membership is not active");
  }

  const allowedRoles: TenantRole[] = ["teacher", "tenantAdmin"];
  if (!allowedRoles.includes(membership.role)) {
    throw new HttpsError("permission-denied", "Teacher or admin access required");
  }

  return { role: membership.role, membership };
}

/**
 * Assert the caller is a member of the tenant (any role).
 */
export async function assertTenantMember(
  callerUid: string,
  tenantId: string
): Promise<{ role: TenantRole; membership: UserMembership }> {
  const db = admin.firestore();
  const membershipDoc = await db.doc(`userMemberships/${callerUid}_${tenantId}`).get();

  if (!membershipDoc.exists) {
    throw new HttpsError("permission-denied", "Not a member of this tenant");
  }

  const membership = membershipDoc.data() as UserMembership;
  if (membership.status !== "active") {
    throw new HttpsError("permission-denied", "Membership is not active");
  }

  return { role: membership.role, membership };
}
