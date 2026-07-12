import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { getFirebaseServices } from '../firebase';
import { identityCollectionCandidates } from '../firebase/collection-prefix';
import type { UserMembership } from '@levelup/shared-types';

/**
 * Firestore rules for memberships require `resource.data.uid == auth.uid`.
 * A get/list on a missing doc therefore throws permission-denied instead of
 * returning empty — treat that as "no membership" so school login can surface
 * a clear error instead of "Missing or insufficient permissions".
 *
 * Do not rely on `instanceof FirebaseError`: duplicate Firebase bundles in the
 * monorepo can break instanceof across package boundaries.
 */
function isMissingMembershipPermission(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = 'code' in err ? String((err as { code: unknown }).code) : '';
  return (
    code === 'permission-denied' ||
    code === 'firestore/permission-denied'
  );
}

function membershipKey(m: UserMembership): string {
  return m.id || `${m.uid}_${m.tenantId}`;
}

/**
 * Fetch all active memberships for a user.
 * Prefers `LVLUP_COLLECTION_PREFIX` / `v2_userMemberships` (prod SSOT), then
 * falls back to bare `userMemberships` for emulator / legacy mirrors.
 */
export async function getUserMemberships(
  uid: string,
): Promise<UserMembership[]> {
  const { db } = getFirebaseServices();
  const byId = new Map<string, UserMembership>();

  for (const colName of identityCollectionCandidates('userMemberships')) {
    try {
      const q = query(
        collection(db, colName),
        where('uid', '==', uid),
        where('status', '==', 'active'),
      );
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        const data = { id: d.id, ...(d.data() as UserMembership) };
        const key = membershipKey(data);
        // Prefer first hit (prefixed / v2_) over later legacy duplicates.
        if (!byId.has(key)) byId.set(key, data);
      }
      // If the preferred collection returned rows, stop — avoid mixing ghost tenants.
      if (snap.docs.length > 0) break;
    } catch (err) {
      if (isMissingMembershipPermission(err)) continue;
      throw err;
    }
  }

  return Array.from(byId.values());
}

/**
 * Fetch a single membership by composite key {uid}_{tenantId}.
 * Returns null if the document does not exist (or rules deny a missing doc).
 */
export async function getMembership(
  uid: string,
  tenantId: string,
): Promise<UserMembership | null> {
  const { db } = getFirebaseServices();
  const membershipId = `${uid}_${tenantId}`;

  for (const colName of identityCollectionCandidates('userMemberships')) {
    try {
      const snap = await getDoc(doc(db, colName, membershipId));
      if (snap.exists()) {
        return { id: snap.id, ...(snap.data() as UserMembership) };
      }
    } catch (err) {
      if (isMissingMembershipPermission(err)) continue;
      throw err;
    }
  }

  return null;
}
