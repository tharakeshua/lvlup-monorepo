import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { getFirebaseServices } from "../firebase";
import type { UserMembership } from "@levelup/shared-types";

/**
 * Fetch all active memberships for a user.
 * Queries /userMemberships where uid == uid AND status == 'active'.
 */
export async function getUserMemberships(uid: string): Promise<UserMembership[]> {
  const { db } = getFirebaseServices();

  const q = query(
    collection(db, "userMemberships"),
    where("uid", "==", uid),
    where("status", "==", "active")
  );

  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as UserMembership);
}

/**
 * Fetch a single membership by composite key {uid}_{tenantId}.
 * Returns null if the document does not exist.
 */
export async function getMembership(uid: string, tenantId: string): Promise<UserMembership | null> {
  const { db } = getFirebaseServices();
  const membershipId = `${uid}_${tenantId}`;
  const snap = await getDoc(doc(db, "userMemberships", membershipId));
  return snap.exists() ? (snap.data() as UserMembership) : null;
}
