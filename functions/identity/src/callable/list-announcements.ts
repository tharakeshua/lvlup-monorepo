import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { toTimestamp } from "@levelup/domain";
import { ListAnnouncementsRequestSchema } from "../contracts/wire";
import type { ListAnnouncementsResponse } from "../contracts/wire";
import { getUser, parseRequest } from "../utils";
import { enforceRateLimit } from "../utils/rate-limit";

export const listAnnouncements = onCall({ region: "asia-south1", cors: true }, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "Must be logged in");

  const data = parseRequest(request.data, ListAnnouncementsRequestSchema);

  await enforceRateLimit(data.tenantId ?? "global", callerUid, "read", 60);

  const callerUser = await getUser(callerUid);
  const isSuperAdmin = callerUser?.isSuperAdmin === true;
  const db = admin.firestore();
  const pageLimit = data.limit ?? 20;

  const scope = data.scope ?? (data.tenantId ? "tenant" : "platform");
  const collectionPath =
    scope === "platform" ? "announcements" : `tenants/${data.tenantId}/announcements`;

  let q: FirebaseFirestore.Query = db.collection(collectionPath).orderBy("createdAt", "desc");

  // Non-superadmin and non-tenantAdmin users only see published announcements
  if (!isSuperAdmin && data.status === undefined) {
    q = q.where("status", "==", "published");
  } else if (data.status) {
    q = q.where("status", "==", data.status);
  }

  if (data.cursor) {
    const cursorDoc = await db.doc(`${collectionPath}/${data.cursor}`).get();
    if (cursorDoc.exists) {
      q = q.startAfter(cursorDoc);
    }
  }

  q = q.limit(pageLimit + 1);

  const snap = await q.get();
  const hasMore = snap.docs.length > pageLimit;
  const docs = hasMore ? snap.docs.slice(0, pageLimit) : snap.docs;

  const announcements = docs.map((d) => {
    const raw = d.data();
    return {
      id: d.id,
      title: raw.title,
      body: raw.body,
      authorName: raw.authorName,
      scope: raw.scope,
      status: raw.status,
      targetRoles: raw.targetRoles,
      targetClassIds: raw.targetClassIds,
      // B8: timestamps at rest are canonical ISO strings; collapse legacy
      // Firestore Timestamp objects (old docs) and ISO strings uniformly.
      publishedAt: toTimestamp(raw.publishedAt),
      archivedAt: toTimestamp(raw.archivedAt),
      expiresAt: toTimestamp(raw.expiresAt),
      createdAt: toTimestamp(raw.createdAt),
      updatedAt: toTimestamp(raw.updatedAt),
    };
  });

  return {
    announcements,
    nextCursor: hasMore ? docs[docs.length - 1].id : undefined,
  } satisfies ListAnnouncementsResponse;
});
