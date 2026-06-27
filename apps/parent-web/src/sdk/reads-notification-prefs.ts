/**
 * App-local read/write for parent-web's bespoke 5-boolean notification toggles.
 *
 * SDK GAP (accepted, app-local exception — FE-Lead decision): the @levelup
 * identity SDK models notification preferences as `{ enabledTypes: string[];
 * muteUntil }`, which cannot represent parent-web's 5 independent boolean toggles
 * (email / push / examResults / progressMilestones / teacherMessages). Those live
 * in a bespoke `tenants/{tid}/notificationPreferences/{uid}` document the SDK does
 * not model. Until a backend prefs model carries the booleans, we keep this read
 * + write here.
 *
 * Direct `firebase/firestore` is permitted ONLY inside `src/sdk` (the app's single
 * Firebase composition root) — pages and `src/hooks` stay firestore-clean. We
 * reuse `getFirebaseServices().db`, i.e. the SAME default Firebase app the SDK and
 * login share, so reads run with the signed-in parent's auth.
 */
import { doc, getDoc, setDoc } from "firebase/firestore";

import { getFirebaseServices } from "./firebase";

export interface NotificationPreferences {
  emailNotifs: boolean;
  pushNotifs: boolean;
  examResults: boolean;
  progressMilestones: boolean;
  teacherMessages: boolean;
}

export const DEFAULT_PREFS: NotificationPreferences = {
  emailNotifs: true,
  pushNotifs: true,
  examResults: true,
  progressMilestones: true,
  teacherMessages: true,
};

/** Read the parent's 5-toggle prefs, defaults filled for any missing field. */
export async function getNotificationPrefs(
  tenantId: string,
  userId: string
): Promise<NotificationPreferences> {
  const { db } = getFirebaseServices();
  const ref = doc(db, `tenants/${tenantId}/notificationPreferences`, userId);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    return { ...DEFAULT_PREFS, ...snap.data() } as NotificationPreferences;
  }
  return DEFAULT_PREFS;
}

/** Persist the parent's 5-toggle prefs (merge — never clobbers unrelated fields). */
export async function saveNotificationPrefs(
  tenantId: string,
  userId: string,
  prefs: NotificationPreferences
): Promise<void> {
  const { db } = getFirebaseServices();
  const ref = doc(db, `tenants/${tenantId}/notificationPreferences`, userId);
  await setDoc(ref, prefs, { merge: true });
}
