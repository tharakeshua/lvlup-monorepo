import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { UnifiedUser, UserMembership, Tenant, TenantRole } from "@levelup/shared-types";

const db = () => admin.firestore();

/** Get a user document by UID. */
export async function getUser(uid: string): Promise<UnifiedUser | null> {
  const doc = await db().doc(`users/${uid}`).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as unknown as UnifiedUser;
}

/** Get a membership document. */
export async function getMembership(uid: string, tenantId: string): Promise<UserMembership | null> {
  const doc = await db().doc(`userMemberships/${uid}_${tenantId}`).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as unknown as UserMembership;
}

/** Get a tenant document. */
export async function getTenant(tenantId: string): Promise<Tenant | null> {
  const doc = await db().doc(`tenants/${tenantId}`).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as unknown as Tenant;
}

/** Atomically increment or decrement a tenant stat counter. */
export async function updateTenantStats(
  tenantId: string,
  role: TenantRole,
  operation: "increment" | "decrement"
): Promise<void> {
  const delta = operation === "increment" ? 1 : -1;

  const fieldMap: Partial<Record<TenantRole, string>> = {
    student: "stats.totalStudents",
    teacher: "stats.totalTeachers",
  };

  const field = fieldMap[role];
  if (!field) return;

  await db()
    .doc(`tenants/${tenantId}`)
    .update({
      [field]: FieldValue.increment(delta),
      updatedAt: FieldValue.serverTimestamp(),
    });
}
