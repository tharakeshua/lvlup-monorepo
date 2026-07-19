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
import { createSecretWriter, type SecretWriter } from "@levelup/ai";
import type { TenantId } from "@levelup/domain";
import { docFromFirestore, toFirestore } from "./firestore.js";
import {
  usersCollection,
  usersDoc,
  userMembershipsCollection,
  consumerProfilesCollection,
  impersonationSessionsCollection,
  impersonationSessionDoc,
  tenantDoc,
  storyPointProgressDoc,
  spaceReviewsPath,
  spaceReviewDoc,
  spaceVersionsPath,
  platformActivityLogCollection,
  userProviderKeyDoc,
  userProviderKeysCollection,
  userProviderKeyDocId,
  keyMetadataDoc,
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
      await db.doc(usersDoc(user.uid)).set(
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
    async updateSession(tenantId: string, sessionId: string, patch: Doc): Promise<void> {
      await sessions(tenantId)
        .doc(sessionId)
        .set(toFirestore({ ...patch, updatedAt: now() }), { merge: true });
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
    async listMessages(tenantId: string, sessionId: string): Promise<Doc[]> {
      // Ordered by `timestamp` — the same field `appendMessage` writes (ISO strings
      // sort chronologically). An `orderBy` on a field a doc lacks silently drops it,
      // so this MUST match the written field (was mis-set to `createdAt` in chatStream).
      const snap = await messages(tenantId, sessionId).orderBy("timestamp", "asc").get();
      return snap.docs.map((d) => docFromFirestore({ ...d.data(), id: d.id }));
    },
    async listSessions(
      tenantId: string,
      uid: string,
      filter: { spaceId?: string; itemId?: string; cursor?: string; limit?: number }
    ): Promise<{ items: Doc[]; nextCursor: string | null }> {
      const limit = filter.limit ?? 20;
      let q: FirebaseFirestore.Query = sessions(tenantId).where("userId", "==", uid);
      if (filter.spaceId) q = q.where("spaceId", "==", filter.spaceId);
      if (filter.itemId) q = q.where("itemId", "==", filter.itemId);
      q = q.orderBy("updatedAt", "desc");
      if (filter.cursor) q = q.startAfter(filter.cursor);
      const snap = await q.limit(limit + 1).get();
      const docs = snap.docs
        .slice(0, limit)
        .map((d) => docFromFirestore({ ...d.data(), id: d.id }));
      const nextCursor =
        snap.size > limit ? String(docs[docs.length - 1]?.["updatedAt"] ?? "") || null : null;
      return { items: docs, nextCursor };
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

/**
 * Per-storyPoint progress docs, NESTED under spaceProgress (U2.2 canonical, the
 * rule-blessed form): `spaceProgress/{uid}_{spaceId}/storyPointProgress/{storyPointId}`.
 * This is the path the levelup progress-updater trigger writes and firestore.rules
 * blesses; the former root-level `storyPointProgress/{uid}_{storyPointId}` form was
 * unwritten-at-runtime and rule-less (removed under U2.2).
 */
export function makeStoryPointProgressRepo(db: Firestore) {
  return {
    async get(
      tenantId: string,
      uid: string,
      spaceId: string,
      storyPointId: string
    ): Promise<Doc | null> {
      const snap = await db.doc(storyPointProgressDoc(tenantId, uid, spaceId, storyPointId)).get();
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

/**
 * Secret-manager bridge (SEC-09). Writes the tenant's Gemini key VALUE into GCP
 * Secret Manager via the shared `@levelup/ai` writer (Admin credentials), then
 * records a pointer doc — NEVER the key value — under the tenant. The secret name
 * is `secretNameFor(tenantId)` (`tenant-{tenantId}-gemini`), the SAME name the AI
 * resolver reads, so a written key is always found. The writer is injectable for
 * tests (mock Secret Manager client); it defaults to a real client in prod.
 *
 * PREVIOUS P0: this used to record `{tenantId}-gemini-key` and never call Secret
 * Manager, so the resolver's `tenant-{tenantId}-gemini` lookup always missed →
 * FEATURE_DISABLED for every freshly onboarded tenant.
 */
export function makeSecretRepo(
  db: Firestore,
  now: Now,
  writer: SecretWriter = createSecretWriter()
) {
  return {
    async put(tenantId: string, key: string): Promise<{ secretRef: string }> {
      const secretRef = await writer.writeSecret(tenantId as TenantId, key);
      await db
        .doc(`${tenantDoc(tenantId)}/secretRefs/gemini`)
        .set(toFirestore({ secretRef, updatedAt: now() }), { merge: true });
      return { secretRef };
    },
  };
}

/**
 * Per-user BYOK provider-key metadata repo (top-level `userProviderKeys/{uid}:{provider}`).
 * Stores ONLY the opaque Secret Manager ref + masked hint + status — never the key
 * value (that is written to Secret Manager by the keys service via `@levelup/ai`).
 */
export function makeUserProviderKeyRepo(db: Firestore, now: Now) {
  return {
    async get(uid: string, provider: string): Promise<Doc | null> {
      const snap = await db.doc(userProviderKeyDoc(uid, provider)).get();
      return snap.exists ? docFromFirestore({ ...snap.data(), id: snap.id }) : null;
    },
    async listByUser(uid: string): Promise<Doc[]> {
      const snap = await db
        .collection(userProviderKeysCollection())
        .where("userId", "==", uid)
        .get();
      return snap.docs.map((d) => docFromFirestore({ ...d.data(), id: d.id }));
    },
    async upsert(
      uid: string,
      provider: string,
      data: Doc,
      ts?: string
    ): Promise<{ created: boolean }> {
      const ref = db.doc(userProviderKeyDoc(uid, provider));
      const existing = await ref.get();
      const created = !existing.exists;
      const stamp = ts ?? now();
      await ref.set(
        toFirestore({
          ...data,
          id: userProviderKeyDocId(uid, provider),
          userId: uid,
          provider,
          updatedAt: stamp,
          ...(created ? { createdAt: stamp } : {}),
        }),
        { merge: true }
      );
      return { created };
    },
    async patch(uid: string, provider: string, patch: Doc, ts?: string): Promise<void> {
      await db
        .doc(userProviderKeyDoc(uid, provider))
        .set(toFirestore({ ...patch, updatedAt: ts ?? now() }), { merge: true });
    },
    async delete(uid: string, provider: string): Promise<void> {
      await db.doc(userProviderKeyDoc(uid, provider)).delete();
    },
  };
}

/** Masked/status/version metadata for tenant + platform owned keys. */
export function makeKeyMetaRepo(db: Firestore, now: Now) {
  return {
    async get(scopeKey: string): Promise<Doc | null> {
      const snap = await db.doc(keyMetadataDoc(scopeKey)).get();
      return snap.exists ? docFromFirestore({ ...snap.data(), id: snap.id }) : null;
    },
    async put(scopeKey: string, data: Doc, ts?: string): Promise<void> {
      await db
        .doc(keyMetadataDoc(scopeKey))
        .set(toFirestore({ ...data, updatedAt: ts ?? now() }), { merge: true });
    },
    async delete(scopeKey: string): Promise<void> {
      await db.doc(keyMetadataDoc(scopeKey)).delete();
    },
  };
}

/**
 * B2C store reviews — `spaces/{spaceId}/reviews/{uid}` (one doc per reviewer,
 * keyed by uid so a re-review is an upsert, mirroring `@levelup/seed` Paths).
 */
export function makeSpaceReviewRepo(db: Firestore, now: Now) {
  return {
    async get(tenantId: string, spaceId: string, uid: string): Promise<Doc | null> {
      const snap = await db.doc(spaceReviewDoc(tenantId, spaceId, uid)).get();
      return snap.exists ? docFromFirestore({ ...snap.data(), id: snap.id }) : null;
    },
    async upsert(
      tenantId: string,
      spaceId: string,
      uid: string,
      data: Doc
    ): Promise<{ id: string; created: boolean }> {
      const ref = db.doc(spaceReviewDoc(tenantId, spaceId, uid));
      const existing = await ref.get();
      const created = !existing.exists;
      const ts = now();
      await ref.set(
        toFirestore({
          ...data,
          id: uid,
          updatedAt: ts,
          ...(created ? { createdAt: ts } : {}),
        }),
        { merge: true }
      );
      return { id: uid, created };
    },
    async list(
      tenantId: string,
      spaceId: string,
      filter: { cursor?: string; limit?: number } = {}
    ): Promise<{ items: Doc[]; nextCursor: string | null }> {
      const limit = filter.limit ?? 20;
      let q: FirebaseFirestore.Query = db
        .collection(spaceReviewsPath(tenantId, spaceId))
        .orderBy("createdAt", "desc")
        .orderBy(FieldPath.documentId());
      if (filter.cursor) {
        const [v, id] = filter.cursor.split("|");
        q = q.startAfter(v, id);
      }
      const snap = await q.limit(limit + 1).get();
      const page = snap.docs.slice(0, limit);
      const docs = page.map((d) => docFromFirestore({ ...d.data(), id: d.id }));
      const last = page[page.length - 1];
      const nextCursor =
        snap.size > limit && last ? `${String(last.get("createdAt") ?? "")}|${last.id}` : null;
      return { items: docs, nextCursor };
    },
  };
}

/**
 * ContentVersion change-log — legacy-compatible `spaces/{spaceId}/versions`
 * subcollection (the SAME path `functions/levelup` wrote, so migrated tenants'
 * existing history is readable). `add` computes the next per-entity version the
 * same way the legacy writer did.
 */
export function makeContentVersionRepo(db: Firestore, now: Now) {
  const coll = (t: string, s: string) => db.collection(spaceVersionsPath(t, s));
  return {
    async list(
      tenantId: string,
      spaceId: string,
      filter: { cursor?: string; limit?: number } = {}
    ): Promise<{ items: Doc[]; nextCursor: string | null }> {
      const limit = filter.limit ?? 20;
      let q: FirebaseFirestore.Query = coll(tenantId, spaceId)
        .orderBy("changedAt", "desc")
        .orderBy(FieldPath.documentId());
      if (filter.cursor) {
        const [v, id] = filter.cursor.split("|");
        q = q.startAfter(v, id);
      }
      const snap = await q.limit(limit + 1).get();
      const page = snap.docs.slice(0, limit);
      const docs = page.map((d) => docFromFirestore({ ...d.data(), id: d.id }));
      const last = page[page.length - 1];
      const nextCursor =
        snap.size > limit && last ? `${String(last.get("changedAt") ?? "")}|${last.id}` : null;
      return { items: docs, nextCursor };
    },
    async add(
      tenantId: string,
      spaceId: string,
      entry: {
        entityType: string;
        entityId: string;
        changeType: string;
        changeSummary: string;
        changedBy: string;
      }
    ): Promise<string> {
      const lastSnap = await coll(tenantId, spaceId)
        .where("entityType", "==", entry.entityType)
        .where("entityId", "==", entry.entityId)
        .orderBy("version", "desc")
        .limit(1)
        .get();
      const nextVersion = lastSnap.empty
        ? 1
        : ((lastSnap.docs[0]?.data()["version"] as number | undefined) ?? 0) + 1;
      const ref = coll(tenantId, spaceId).doc();
      await ref.set(toFirestore({ id: ref.id, version: nextVersion, ...entry, changedAt: now() }));
      return ref.id;
    },
  };
}

/**
 * Top-level `platformActivityLog` ledger (super-admin dashboard feed — the
 * U2.4+5 replacement for the app's rules-denied direct SDK read). Ordered by
 * `createdAt` desc, the same field the legacy writer stamped.
 */
export function makePlatformActivityRepo(db: Firestore) {
  return {
    async list(
      filter: { action?: string; tenantId?: string; cursor?: string; limit?: number } = {}
    ): Promise<{ items: Doc[]; nextCursor: string | null }> {
      const limit = filter.limit ?? 20;
      let q: FirebaseFirestore.Query = db.collection(platformActivityLogCollection());
      if (filter.tenantId) q = q.where("tenantId", "==", filter.tenantId);
      if (filter.action) q = q.where("action", "==", filter.action);
      q = q.orderBy("createdAt", "desc").orderBy(FieldPath.documentId());
      if (filter.cursor) {
        const [v, id] = filter.cursor.split("|");
        q = q.startAfter(v, id);
      }
      const snap = await q.limit(limit + 1).get();
      const page = snap.docs.slice(0, limit);
      const docs = page.map((d) => docFromFirestore({ ...d.data(), id: d.id }));
      const last = page[page.length - 1];
      const nextCursor =
        snap.size > limit && last ? `${String(last.get("createdAt") ?? "")}|${last.id}` : null;
      return { items: docs, nextCursor };
    },
  };
}

/**
 * Canonical `tenants/{t}/costSummaries` accessor (U3.3 path shape: ONE collection,
 * doc ids `daily_YYYY-MM-DD` / `monthly_YYYY-MM`). `daily`/`monthly` single-doc
 * getters keep the `@levelup/ai` quota fast-path seam; the `listDaily`/
 * `listMonthly` range reads back the getCostSummary callable (doc-id range —
 * index-free).
 */
export function makeCostSummariesRepo(db: Firestore) {
  const coll = (t: string) => db.collection(`${tenantDoc(t)}/costSummaries`);
  const byIdRange = async (
    tenantId: string,
    prefix: "daily_" | "monthly_",
    startKey: string,
    endKey: string,
    limit: number
  ): Promise<Doc[]> => {
    const snap = await coll(tenantId)
      .orderBy(FieldPath.documentId())
      .startAt(`${prefix}${startKey}`)
      .endAt(`${prefix}${endKey}`)
      .limit(limit)
      .get();
    return snap.docs.map((d) => docFromFirestore({ ...d.data(), id: d.id }));
  };
  return {
    async daily(tenantId: string, dateYmd: string): Promise<Doc | null> {
      const snap = await coll(tenantId).doc(`daily_${dateYmd}`).get();
      return snap.exists ? (snap.data() as Doc) : null;
    },
    async monthly(tenantId: string, monthYm: string): Promise<Doc | null> {
      const snap = await coll(tenantId).doc(`monthly_${monthYm}`).get();
      return snap.exists ? (snap.data() as Doc) : null;
    },
    async listDaily(
      tenantId: string,
      filter: { date?: string; from?: string; to?: string; limit?: number } = {}
    ): Promise<Doc[]> {
      const start = filter.date ?? filter.from ?? "";
      const end = filter.date ?? filter.to ?? "9999-12-31";
      return byIdRange(tenantId, "daily_", start, end, filter.limit ?? 100);
    },
    async listMonthly(
      tenantId: string,
      filter: { month?: string; limit?: number } = {}
    ): Promise<Doc[]> {
      const start = filter.month ?? "";
      const end = filter.month ?? "9999-12";
      return byIdRange(tenantId, "monthly_", start, end, filter.limit ?? 100);
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
