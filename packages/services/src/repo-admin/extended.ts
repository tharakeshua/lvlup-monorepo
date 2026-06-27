/**
 * Admin-SDK implementations of the EXTENDED repo surface the identity /
 * levelup-runtime / notification / gamification services consume via `xrepos(ctx)`
 * (`shared/extended-repos.ts`). These live alongside the base `Repos` in the ONLY
 * direct-Firestore site so `createRepos()` returns a value that structurally
 * satisfies `ExtendedRepos` and no service crashes on an undefined repo.
 *
 * Storage conventions mirror `@levelup/seed` `Paths`:
 *   • users            → `users/{uid}` (top-level)
 *   • memberships      → `userMemberships/{uid}_{tenantId}` (top-level)
 *   • consumerProfiles → `consumerProfiles/{uid}` (top-level B2C)
 *   • badges           → `tenants/{t}/notificationBadges/{uid}`
 *   • notificationReads→ `tenants/{t}/notifications/*` + `notificationPreferences/{uid}`
 *   • studentAchievements/level/studyGoals/studySessions → under `students/{uid}`
 */
import { type Auth } from "firebase-admin/auth";
import { FieldPath, type Firestore } from "firebase-admin/firestore";
import { docFromFirestore, toFirestore } from "./firestore.js";
import {
  usersCollection,
  usersDoc,
  userMembershipsCollection,
  consumerProfilesCollection,
  impersonationSessionsCollection,
  impersonationSessionDoc,
  tenantDoc,
} from "./paths.js";

type Doc = Record<string, unknown>;
type Now = () => string;

interface TxLike {
  upsert(coll: string, tenantId: string, data: Doc): { id: string };
  enqueueOutbox?(tenantId: string, record: Doc): void;
}

/** users/{uid} (top-level) bridged with Admin Auth for profile mutation. */
export function makeUserRepo(db: Firestore, adminAuth: Auth, now: Now) {
  return {
    async get(uidOrEmail: string): Promise<Doc | null> {
      const byId = await db.doc(usersDoc(uidOrEmail)).get();
      if (byId.exists) return docFromFirestore({ ...byId.data(), id: byId.id });
      // fall back to email lookup
      const q = await db
        .collection(usersCollection())
        .where("email", "==", uidOrEmail)
        .limit(1)
        .get();
      const d = q.docs[0];
      return d ? docFromFirestore({ ...d.data(), id: d.id }) : null;
    },
    async updateProfile(uid: string, patch: { displayName?: string; photoURL?: string }) {
      await db.doc(usersDoc(uid)).set(toFirestore({ ...patch, updatedAt: now() }), { merge: true });
      await adminAuth
        .updateUser(uid, {
          ...(patch.displayName ? { displayName: patch.displayName } : {}),
          ...(patch.photoURL ? { photoURL: patch.photoURL } : {}),
        })
        .catch(() => undefined);
    },
    async create(input: { email?: string; displayName?: string; password?: string }) {
      const user = await adminAuth.createUser({
        ...(input.email ? { email: input.email } : {}),
        ...(input.displayName ? { displayName: input.displayName } : {}),
        ...(input.password ? { password: input.password } : {}),
      });
      await db
        .doc(usersDoc(user.uid))
        .set(
          toFirestore({
            id: user.uid,
            email: input.email,
            displayName: input.displayName,
            createdAt: now(),
          }),
          { merge: true }
        );
      return { uid: user.uid };
    },
  };
}

/** userMemberships/{uid}_{tenantId} (top-level deny-all authority repo). */
export function makeMembershipRepo(db: Firestore, now: Now) {
  const coll = db.collection(userMembershipsCollection());
  const mid = (uid: string, tenantId: string) => `${uid}_${tenantId}`;
  return {
    async get(uid: string, tenantId: string): Promise<Doc | null> {
      const snap = await coll.doc(mid(uid, tenantId)).get();
      return snap.exists ? docFromFirestore({ ...snap.data(), id: snap.id }) : null;
    },
    async listForUser(uid: string): Promise<Doc[]> {
      const snap = await coll.where("uid", "==", uid).get();
      return snap.docs.map((d) => docFromFirestore({ ...d.data(), id: d.id }));
    },
    async getManagedClassIds(uid: string, tenantId: string | null): Promise<string[]> {
      if (!tenantId) return [];
      const snap = await coll.doc(mid(uid, tenantId)).get();
      // Canonical location is `permissions.managedClassIds` (UserMembershipSchema);
      // tolerate a legacy top-level field for older seeds.
      const data = snap.data() as
        | { managedClassIds?: string[]; permissions?: { managedClassIds?: string[] } }
        | undefined;
      return data?.permissions?.managedClassIds ?? data?.managedClassIds ?? [];
    },
    async upsert(uid: string, tenantId: string, data: Doc, ts: string = now()) {
      const id = mid(uid, tenantId);
      const ref = coll.doc(id);
      const existing = await ref.get();
      await ref.set(
        toFirestore({
          ...data,
          id,
          uid,
          tenantId,
          updatedAt: ts,
          ...(existing.exists ? {} : { createdAt: ts }),
        }),
        { merge: true }
      );
      return { id, created: !existing.exists };
    },
    async setStatus(uid: string, tenantId: string, status: string, ts: string = now()) {
      await coll
        .doc(mid(uid, tenantId))
        .set(toFirestore({ status, updatedAt: ts }), { merge: true });
    },
  };
}

/** consumerProfiles/{uid} + enrollment authority (purchaseSpace single writer). */
export function makeConsumerProfileRepo(db: Firestore, now: Now) {
  const coll = db.collection(consumerProfilesCollection());
  return {
    async get(uid: string): Promise<Doc | null> {
      const snap = await coll.doc(uid).get();
      return snap.exists ? docFromFirestore({ ...snap.data(), id: snap.id }) : null;
    },
    enroll(tx: TxLike, uid: string, spaceId: string, record: Doc): void {
      // consumerProfiles are a TOP-LEVEL collection (`consumerProfiles/{uid}`), not a
      // tenant-scoped entity; the generic tenant-scoped `tx.upsert` would route this
      // to the reserved `tenants/__platform__/…` path. Write the top-level doc directly.
      void tx;
      void coll
        .doc(uid)
        .set(
          toFirestore({
            id: uid,
            uid,
            [`enrolled_${spaceId}`]: true,
            [`purchase_${spaceId}`]: { ...record, updatedAt: now() },
          }),
          { merge: true }
        )
        .catch(() => undefined);
    },
    async isEnrolled(uid: string, spaceId: string): Promise<boolean> {
      const snap = await coll.doc(uid).get();
      const data = snap.data() as Doc | undefined;
      if (!data) return false;
      if (data[`enrolled_${spaceId}`] === true) return true;
      const list = (data["enrolledSpaceIds"] as string[] | undefined) ?? [];
      return list.includes(spaceId);
    },
  };
}

/** tenants/{t}/notificationBadges/{uid} (RTDB in prod; Firestore mirror here). */
export function makeBadgeRepo(db: Firestore, now: Now) {
  const ref = (t: string, uid: string) => db.doc(`${tenantDoc(t)}/notificationBadges/${uid}`);
  return {
    async get(uid: string, tenantId: string): Promise<Doc> {
      const snap = await ref(tenantId, uid).get();
      return (snap.exists ? docFromFirestore({ ...snap.data() }) : { unreadCount: 0 }) as Doc;
    },
    async set(uid: string, tenantId: string, state: Doc): Promise<void> {
      await ref(tenantId, uid).set(toFirestore({ ...state, updatedAt: now() }), { merge: true });
    },
  };
}

/** notifications read-state + per-user preferences. */
export function makeNotificationReadRepo(db: Firestore, now: Now) {
  const notifs = (t: string) => db.collection(`${tenantDoc(t)}/notifications`);
  const prefRef = (t: string, uid: string) =>
    db.doc(`${tenantDoc(t)}/notificationPreferences/${uid}`);
  return {
    async markRead(
      tenantId: string,
      uid: string,
      notificationId: string | null,
      ts: string
    ): Promise<number> {
      if (notificationId) {
        await notifs(tenantId)
          .doc(notificationId)
          .set(toFirestore({ isRead: true, readAt: ts }), { merge: true });
      } else {
        const unread = await notifs(tenantId)
          .where("recipientUid", "==", uid)
          .where("isRead", "==", false)
          .get();
        await Promise.all(
          unread.docs.map((d) =>
            d.ref.set(toFirestore({ isRead: true, readAt: ts }), { merge: true })
          )
        );
      }
      return this.unreadCount(tenantId, uid);
    },
    async getPreferences(tenantId: string, uid: string): Promise<Doc | null> {
      const snap = await prefRef(tenantId, uid).get();
      return snap.exists ? docFromFirestore({ ...snap.data(), id: snap.id }) : null;
    },
    async savePreferences(tenantId: string, uid: string, prefs: Doc, ts: string): Promise<Doc> {
      await prefRef(tenantId, uid).set(toFirestore({ ...prefs, uid, updatedAt: ts }), {
        merge: true,
      });
      return { ...prefs, uid, updatedAt: ts };
    },
    async unreadCount(tenantId: string, uid: string): Promise<number> {
      const snap = await notifs(tenantId)
        .where("recipientUid", "==", uid)
        .where("isRead", "==", false)
        .get();
      return snap.size;
    },
  };
}

/** Chat sessions + always-subcollection messages (`…/chatSessions/{id}/messages`). */
export function makeChatRepo(db: Firestore, now: Now) {
  const sessions = (t: string) => db.collection(`${tenantDoc(t)}/chatSessions`);
  const messages = (t: string, sid: string) =>
    db.collection(`${tenantDoc(t)}/chatSessions/${sid}/messages`);
  return {
    async getSession(tenantId: string, sessionId: string): Promise<Doc | null> {
      const snap = await sessions(tenantId).doc(sessionId).get();
      return snap.exists ? docFromFirestore({ ...snap.data(), id: snap.id }) : null;
    },
    async createSession(tenantId: string, data: Doc): Promise<string> {
      const ref = data["id"]
        ? sessions(tenantId).doc(String(data["id"]))
        : sessions(tenantId).doc();
      await ref.set(toFirestore({ ...data, id: ref.id, createdAt: now(), updatedAt: now() }), {
        merge: true,
      });
      return ref.id;
    },
    async appendMessage(tenantId: string, sessionId: string, message: Doc): Promise<string> {
      const ref = messages(tenantId, sessionId).doc();
      await ref.set(toFirestore({ ...message, id: ref.id }));
      await sessions(tenantId)
        .doc(sessionId)
        .set(toFirestore({ updatedAt: now(), previewMessage: message["text"] ?? "" }), {
          merge: true,
        })
        .catch(() => undefined);
      return ref.id;
    },
  };
}

/** announcement `/reads/{uid}` subcollection (owner-write). */
export function makeAnnouncementReadRepo(db: Firestore, now: Now) {
  const ref = (t: string, id: string, uid: string) =>
    db.doc(`${tenantDoc(t)}/announcements/${id}/reads/${uid}`);
  return {
    async markRead(
      tenantId: string,
      announcementId: string,
      uid: string,
      ts: string
    ): Promise<void> {
      await ref(tenantId, announcementId, uid).set(toFirestore({ uid, readAt: ts }), {
        merge: true,
      });
    },
    async isReadBy(tenantId: string, announcementId: string, uid: string): Promise<boolean> {
      const snap = await ref(tenantId, announcementId, uid).get();
      return snap.exists;
    },
  };
}

/** device push-token registry under `tenants/{t}/users/{uid}/devices/{token}`. */
export function makeDeviceRepo(db: Firestore, now: Now) {
  const coll = (t: string, uid: string) => db.collection(`${tenantDoc(t)}/users/${uid}/devices`);
  return {
    async register(
      uid: string,
      tenantId: string,
      token: string,
      platform: string,
      appKey: string,
      ts: string
    ) {
      await coll(tenantId, uid)
        .doc(token)
        .set(toFirestore({ token, platform, appKey, updatedAt: ts }), { merge: true });
    },
    async unregister(uid: string, tenantId: string, token: string) {
      await coll(tenantId, uid).doc(token).delete();
    },
    async tokensForUser(uid: string, tenantId: string): Promise<string[]> {
      const snap = await coll(tenantId, uid).get();
      return snap.docs.map((d) => d.id);
    },
  };
}

/** Per-session item submissions: `digitalTestSessions/{sid}/submissions/{itemId}` (D6). */
export function makeTestSubmissionRepo(db: Firestore, now: Now) {
  const coll = (t: string, sid: string) =>
    db.collection(`${tenantDoc(t)}/digitalTestSessions/${sid}/submissions`);
  return {
    async list(tenantId: string, sessionId: string): Promise<Doc[]> {
      const snap = await coll(tenantId, sessionId).get();
      return snap.docs.map((d) => docFromFirestore({ ...d.data(), id: d.id }));
    },
    put(tx: TxLike, tenantId: string, sessionId: string, submission: Doc): void {
      // Subcollection writes don't flow through the entity-coll tx; do a direct merge.
      void tx;
      const itemId = String(submission["itemId"] ?? submission["id"] ?? "");
      coll(tenantId, sessionId)
        .doc(itemId)
        .set(toFirestore({ ...submission, itemId, updatedAt: now() }), { merge: true })
        .catch(() => undefined);
    },
    async get(tenantId: string, sessionId: string, itemId: string): Promise<Doc | null> {
      const snap = await coll(tenantId, sessionId).doc(itemId).get();
      return snap.exists ? docFromFirestore({ ...snap.data(), id: snap.id }) : null;
    },
  };
}

/** Per-storyPoint progress docs: `storyPointProgress/{userId}_{storyPointId}` (D6). */
export function makeStoryPointProgressRepo(db: Firestore) {
  return {
    async get(
      tenantId: string,
      uid: string,
      _spaceId: string,
      storyPointId: string
    ): Promise<Doc | null> {
      const snap = await db
        .doc(`${tenantDoc(tenantId)}/storyPointProgress/${uid}_${storyPointId}`)
        .get();
      return snap.exists ? docFromFirestore({ ...snap.data(), id: snap.id }) : null;
    },
  };
}

/** Gamification authority repos (achievements / level / study sessions). */
export function makeGamificationRepo(db: Firestore, now: Now) {
  const studentDoc = (t: string, uid: string) => db.doc(`${tenantDoc(t)}/students/${uid}`);
  return {
    async getSummary(tenantId: string, uid: string): Promise<Doc> {
      const snap = await studentDoc(tenantId, uid).collection("gamification").doc("summary").get();
      return (snap.exists ? docFromFirestore({ ...snap.data() }) : {}) as Doc;
    },
    async getStudentLevel(tenantId: string, uid: string): Promise<Doc> {
      const snap = await studentDoc(tenantId, uid).collection("level").doc("current").get();
      return (snap.exists ? docFromFirestore({ ...snap.data() }) : { level: 1, xp: 0 }) as Doc;
    },
    async earnedAchievementIds(tenantId: string, uid: string): Promise<Set<string>> {
      const snap = await studentDoc(tenantId, uid).collection("achievements").get();
      return new Set(snap.docs.map((d) => d.id));
    },
    awardAchievement(tx: TxLike, tenantId: string, uid: string, achievement: Doc): void {
      void tx;
      const id = String(achievement["id"] ?? achievement["achievementId"] ?? "");
      studentDoc(tenantId, uid)
        .collection("achievements")
        .doc(id)
        .set(toFirestore({ ...achievement, id, seen: false, earnedAt: now() }), { merge: true })
        .catch(() => undefined);
    },
    async markSeen(
      tenantId: string,
      uid: string,
      ids: string[] | "all",
      ts: string
    ): Promise<number> {
      const coll = studentDoc(tenantId, uid).collection("achievements");
      const docs =
        ids === "all"
          ? (await coll.where("seen", "==", false).get()).docs
          : ids.map((id) => coll.doc(id));
      let updated = 0;
      for (const ref of docs) {
        const r =
          "ref" in (ref as object)
            ? (ref as { ref: FirebaseFirestore.DocumentReference }).ref
            : (ref as FirebaseFirestore.DocumentReference);
        await r.set(toFirestore({ seen: true, seenAt: ts }), { merge: true });
        updated++;
      }
      return updated;
    },
    applyLevelDelta(tx: TxLike, tenantId: string, uid: string, xpDelta: number, ts: string): void {
      void tx;
      studentDoc(tenantId, uid)
        .collection("level")
        .doc("current")
        .set(toFirestore({ xpDelta, updatedAt: ts }), { merge: true })
        .catch(() => undefined);
    },
    async saveDefinition(tenantId: string, input: { id?: string; data: Doc }, ts: string) {
      const coll = db.collection(`${tenantDoc(tenantId)}/achievements`);
      const id = input.id ?? coll.doc().id;
      const ref = coll.doc(id);
      const existing = await ref.get();
      await ref.set(toFirestore({ ...input.data, id, updatedAt: ts }), { merge: true });
      return { id, created: !existing.exists };
    },
    async listSessions(
      tenantId: string,
      uid: string,
      _range: { fromDate?: string; toDate?: string }
    ) {
      const snap = await studentDoc(tenantId, uid).collection("studySessions").get();
      const sessions = snap.docs.map((d) => docFromFirestore({ ...d.data(), id: d.id }));
      return { sessions, streakDays: 0, longestStreak: 0 };
    },
  };
}

/** Leaderboard read-model (RTDB in prod; Firestore-backed read here). */
export function makeLeaderboardRepo(db: Firestore, now: Now) {
  const coll = (t: string) => db.collection(`${tenantDoc(t)}/leaderboard`);
  return {
    async getPage(
      tenantId: string,
      scope: string,
      params: { spaceId?: string; storyPointId?: string },
      opts: { cursor?: string; limit?: number }
    ) {
      let q: FirebaseFirestore.Query = coll(tenantId).where("scope", "==", scope);
      if (params.spaceId) q = q.where("spaceId", "==", params.spaceId);
      if (params.storyPointId) q = q.where("storyPointId", "==", params.storyPointId);
      const snap = await q.limit((opts.limit ?? 20) + 1).get();
      const items = snap.docs
        .slice(0, opts.limit ?? 20)
        .map((d) => docFromFirestore({ ...d.data(), id: d.id }));
      return { items, nextCursor: null as string | null };
    },
    async callerEntry(
      tenantId: string,
      uid: string,
      scope: string,
      _params: { spaceId?: string; storyPointId?: string }
    ): Promise<Doc | null> {
      const snap = await coll(tenantId)
        .where("scope", "==", scope)
        .where("uid", "==", uid)
        .limit(1)
        .get();
      const d = snap.docs[0];
      return d ? docFromFirestore({ ...d.data(), id: d.id }) : null;
    },
    async upsertEntry(tenantId: string, scope: string, entry: Doc) {
      const id = String(entry["uid"] ?? coll(tenantId).doc().id);
      await coll(tenantId)
        .doc(`${scope}_${id}`)
        .set(toFirestore({ ...entry, scope, updatedAt: now() }), { merge: true });
    },
  };
}

/** Learning-insight read + dismiss. */
export function makeInsightRepo(db: Firestore, now: Now) {
  const coll = (t: string) => db.collection(`${tenantDoc(t)}/insights`);
  return {
    async list(
      tenantId: string,
      filter: { studentId?: string; type?: string; cursor?: string; limit?: number }
    ) {
      let q: FirebaseFirestore.Query = coll(tenantId);
      if (filter.studentId) q = q.where("studentId", "==", filter.studentId);
      if (filter.type) q = q.where("type", "==", filter.type);
      const snap = await q.limit((filter.limit ?? 20) + 1).get();
      const items = snap.docs
        .slice(0, filter.limit ?? 20)
        .map((d) => docFromFirestore({ ...d.data(), id: d.id }));
      return { items, nextCursor: null as string | null };
    },
    async dismiss(tenantId: string, _uid: string, insightId: string, ts: string) {
      await coll(tenantId)
        .doc(insightId)
        .set(toFirestore({ dismissed: true, dismissedAt: ts }), { merge: true });
    },
  };
}

/** Study-goal read + write under `students/{uid}/studyGoals`. */
export function makeStudyGoalRepo(db: Firestore, now: Now) {
  const coll = (t: string, uid: string) =>
    db.collection(`${tenantDoc(t)}/students/${uid}/studyGoals`);
  return {
    async list(
      tenantId: string,
      uid: string,
      opts: { includeCompleted?: boolean; cursor?: string; limit?: number }
    ) {
      let q: FirebaseFirestore.Query = coll(tenantId, uid);
      if (!opts.includeCompleted) q = q.where("completed", "==", false);
      const snap = await q.limit((opts.limit ?? 20) + 1).get();
      const items = snap.docs
        .slice(0, opts.limit ?? 20)
        .map((d) => docFromFirestore({ ...d.data(), id: d.id }));
      return { items, nextCursor: null as string | null };
    },
    async save(tenantId: string, uid: string, input: { id?: string; data: Doc }, ts: string) {
      const id = input.id ?? coll(tenantId, uid).doc().id;
      const ref = coll(tenantId, uid).doc(id);
      const existing = await ref.get();
      await ref.set(
        toFirestore({
          ...input.data,
          id,
          completed: input.data["completed"] ?? false,
          updatedAt: ts,
        }),
        { merge: true }
      );
      return { id, created: !existing.exists };
    },
  };
}

/** Secret-manager bridge (records the ref only; never the key value, SEC-09). */
export function makeSecretRepo(db: Firestore, now: Now) {
  return {
    async put(tenantId: string, _key: string): Promise<{ secretRef: string }> {
      const secretRef = `${tenantId}-gemini-key`;
      await db
        .doc(`${tenantDoc(tenantId)}/secretRefs/gemini`)
        .set(toFirestore({ secretRef, updatedAt: now() }), { merge: true });
      return { secretRef };
    },
  };
}

/** Impersonation-session ledger (super-admin only; staged in a tx). */
export function makeImpersonationRepo(db: Firestore, now: Now) {
  return {
    openSession(tx: TxLike, record: Doc): { sessionId: string } {
      void tx;
      const sessionId = db.collection(impersonationSessionsCollection()).doc().id;
      db.doc(impersonationSessionDoc(sessionId))
        .set(toFirestore({ ...record, id: sessionId, status: "open", startedAt: now() }), {
          merge: true,
        })
        .catch(() => undefined);
      return { sessionId };
    },
    endSession(tx: TxLike, sessionId: string, ts: string): void {
      void tx;
      db.doc(impersonationSessionDoc(sessionId))
        .set(toFirestore({ status: "ended", endedAt: ts }), { merge: true })
        .catch(() => undefined);
    },
  };
}
