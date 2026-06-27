import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { SaveAnnouncementRequestSchema } from "@levelup/shared-types";
import type { SaveAnnouncementResponse } from "@levelup/shared-types";
import { getUser, assertTenantAdminOrSuperAdmin, parseRequest } from "../utils";
import { enforceRateLimit } from "../utils/rate-limit";

export const saveAnnouncement = onCall({ region: "asia-south1", cors: true }, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "Must be logged in");

  const {
    id,
    tenantId,
    data,
    delete: shouldDelete,
  } = parseRequest(request.data, SaveAnnouncementRequestSchema);

  await enforceRateLimit(tenantId ?? "global", callerUid, "write", 30);

  const callerUser = await getUser(callerUid);
  const isSuperAdmin = callerUser?.isSuperAdmin === true;
  const db = admin.firestore();

  // Determine scope
  const scope = data.scope ?? (tenantId ? "tenant" : "platform");

  if (scope === "platform" && !isSuperAdmin) {
    throw new HttpsError("permission-denied", "Only SuperAdmin can manage platform announcements");
  }

  if (scope === "tenant") {
    if (!tenantId) {
      throw new HttpsError("invalid-argument", "tenantId required for tenant-scoped announcements");
    }
    await assertTenantAdminOrSuperAdmin(callerUid, tenantId);
  }

  // Determine collection path
  const collectionPath =
    scope === "platform" ? "announcements" : `tenants/${tenantId}/announcements`;

  if (shouldDelete && id) {
    await db.doc(`${collectionPath}/${id}`).delete();
    logger.info(`Deleted announcement ${id}`);
    return { id, deleted: true } satisfies SaveAnnouncementResponse;
  }

  if (!id) {
    // CREATE
    if (!data.title || !data.body) {
      throw new HttpsError("invalid-argument", "title and body are required");
    }

    const ref = db.collection(collectionPath).doc();
    const now = FieldValue.serverTimestamp();
    const status = data.status ?? "draft";

    await ref.set({
      id: ref.id,
      tenantId: tenantId ?? null,
      title: data.title,
      body: data.body,
      authorUid: callerUid,
      authorName: callerUser?.displayName ?? callerUser?.email ?? "Unknown",
      scope,
      targetRoles: data.targetRoles ?? [],
      targetClassIds: data.targetClassIds ?? [],
      status,
      publishedAt: status === "published" ? now : null,
      archivedAt: null,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      readBy: [],
      createdAt: now,
      updatedAt: now,
    });

    logger.info(`Created announcement ${ref.id} (scope=${scope})`);
    return { id: ref.id, created: true } satisfies SaveAnnouncementResponse;
  }

  // UPDATE
  const docRef = db.doc(`${collectionPath}/${id}`);
  const existing = await docRef.get();
  if (!existing.exists) {
    throw new HttpsError("not-found", "Announcement not found");
  }

  const updates: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (data.title !== undefined) updates.title = data.title;
  if (data.body !== undefined) updates.body = data.body;
  if (data.targetRoles !== undefined) updates.targetRoles = data.targetRoles;
  if (data.targetClassIds !== undefined) updates.targetClassIds = data.targetClassIds;
  if (data.expiresAt !== undefined)
    updates.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;

  if (data.status !== undefined) {
    updates.status = data.status;
    if (data.status === "published") {
      updates.publishedAt = FieldValue.serverTimestamp();
    } else if (data.status === "archived") {
      updates.archivedAt = FieldValue.serverTimestamp();
    }
  }

  await docRef.update(updates);
  logger.info(`Updated announcement ${id}`);
  return { id, created: false } satisfies SaveAnnouncementResponse;
});
