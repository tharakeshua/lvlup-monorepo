import * as admin from "firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { assertAuth, assertTeacherOrAdmin } from "../utils/auth";
import { enforceRateLimit } from "../utils/rate-limit";
import { z } from "zod";

const ListVersionsRequestSchema = z.object({
  tenantId: z.string().min(1),
  spaceId: z.string().min(1),
  entityType: z.enum(["space", "storyPoint", "item"]).optional(),
  entityId: z.string().optional(),
  limit: z.number().min(1).max(100).optional(),
  startAfter: z.string().optional(),
});

export interface ListVersionsResponse {
  versions: Array<{
    id: string;
    version: number;
    entityType: string;
    entityId: string;
    changeType: string;
    changeSummary: string;
    changedBy: string;
    changedAt: Timestamp | null;
  }>;
  hasMore: boolean;
  lastId: string | null;
}

export const listVersions = onCall({ region: "asia-south1", cors: true }, async (request) => {
  const callerUid = assertAuth(request.auth);
  const parsed = ListVersionsRequestSchema.parse(request.data);
  const { tenantId, spaceId, entityType, entityId, limit: queryLimit = 20, startAfter } = parsed;

  await assertTeacherOrAdmin(callerUid, tenantId);
  await enforceRateLimit(tenantId, callerUid, "read", 60);

  const db = admin.firestore();
  const versionsPath = `tenants/${tenantId}/spaces/${spaceId}/versions`;

  let q: admin.firestore.Query = db.collection(versionsPath).orderBy("changedAt", "desc");

  if (entityType) {
    q = q.where("entityType", "==", entityType);
  }
  if (entityId) {
    q = q.where("entityId", "==", entityId);
  }

  if (startAfter) {
    const cursorDoc = await db.doc(`${versionsPath}/${startAfter}`).get();
    if (cursorDoc.exists) {
      q = q.startAfter(cursorDoc);
    }
  }

  const snap = await q.limit(queryLimit + 1).get();
  const hasMore = snap.docs.length > queryLimit;
  const docs = hasMore ? snap.docs.slice(0, queryLimit) : snap.docs;

  const versions = docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      version: data.version ?? 0,
      entityType: data.entityType ?? "space",
      entityId: data.entityId ?? "",
      changeType: data.changeType ?? "updated",
      changeSummary: data.changeSummary ?? "",
      changedBy: data.changedBy ?? "",
      changedAt: data.changedAt ?? null,
    };
  });

  return {
    versions,
    hasMore,
    lastId: docs.length > 0 ? docs[docs.length - 1].id : null,
  } satisfies ListVersionsResponse;
});
