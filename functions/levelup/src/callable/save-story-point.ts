import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { assertAuth, assertTeacherOrAdmin } from "../utils/auth";
import { loadSpace, loadStoryPoint } from "../utils/firestore";
import { SaveStoryPointRequestSchema } from "@levelup/shared-types";
import type { SaveStoryPointRequest, SaveResponse } from "@levelup/shared-types";
import { parseRequest } from "../utils";
import { enforceRateLimit } from "../utils/rate-limit";
import { writeContentVersion } from "../utils/content-version";

const UPDATABLE_FIELDS = new Set([
  "title",
  "description",
  "type",
  "sections",
  "assessmentConfig",
  "defaultRubric",
  "difficulty",
  "estimatedTimeMinutes",
  "orderIndex",
]);

/**
 * Consolidated story-point endpoint — replaces: createStoryPoint, updateStoryPoint, deleteStoryPoint
 *
 * No id → create new story point
 * id present → update existing story point
 * data.deleted = true → delete story point + all items within it, decrement stats
 */
export const saveStoryPoint = onCall({ region: "asia-south1", cors: true }, async (request) => {
  const callerUid = assertAuth(request.auth);
  const { id, tenantId, spaceId, data } = parseRequest(request.data, SaveStoryPointRequestSchema);

  if (!tenantId || !spaceId) {
    throw new HttpsError("invalid-argument", "tenantId and spaceId are required");
  }

  await assertTeacherOrAdmin(callerUid, tenantId);
  await enforceRateLimit(tenantId, callerUid, "write", 30);
  await loadSpace(tenantId, spaceId);

  const db = admin.firestore();
  const basePath = `tenants/${tenantId}/spaces/${spaceId}/storyPoints`;
  const isCreate = !id;

  // ── DELETE (soft-delete flag) ───────────────────────
  if (!isCreate && data.deleted) {
    await loadStoryPoint(tenantId, spaceId, id);

    // Find and delete all items within this story point
    const itemsSnap = await db
      .collection(`tenants/${tenantId}/spaces/${spaceId}/items`)
      .where("storyPointId", "==", id)
      .get();

    let totalItemsDeleted = 0;
    for (const itemDoc of itemsSnap.docs) {
      // Delete answer keys subcollection for each item
      const akSnap = await db.collection(`${itemDoc.ref.path}/answerKeys`).get();
      if (!akSnap.empty) {
        const batch = db.batch();
        for (const akDoc of akSnap.docs) {
          batch.delete(akDoc.ref);
        }
        await batch.commit();
      }
      await itemDoc.ref.delete();
      totalItemsDeleted++;
    }

    // Delete the story point document
    await db.doc(`${basePath}/${id}`).delete();

    // Decrement space stats
    const spaceUpdates: Record<string, unknown> = {
      "stats.totalStoryPoints": FieldValue.increment(-1),
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (totalItemsDeleted > 0) {
      spaceUpdates["stats.totalItems"] = FieldValue.increment(-totalItemsDeleted);
    }
    await db.doc(`tenants/${tenantId}/spaces/${spaceId}`).update(spaceUpdates);

    logger.info(`Deleted storyPoint ${id} and ${totalItemsDeleted} items from space ${spaceId}`);
    return { id, created: false } satisfies SaveResponse;
  }

  // ── CREATE ──────────────────────────────────────────
  if (isCreate) {
    if (!data.title || !data.type) {
      throw new HttpsError("invalid-argument", "title and type are required for creation");
    }

    // Determine next orderIndex
    const lastSp = await db.collection(basePath).orderBy("orderIndex", "desc").limit(1).get();
    const nextOrder = lastSp.empty ? 0 : (lastSp.docs[0].data().orderIndex ?? 0) + 1;

    const spRef = db.collection(basePath).doc();

    const storyPointDoc = {
      id: spRef.id,
      spaceId,
      tenantId,
      title: data.title,
      description: data.description ?? null,
      orderIndex: data.orderIndex ?? nextOrder,
      type: data.type,
      sections: data.sections ?? [],
      assessmentConfig: data.assessmentConfig ?? null,
      defaultRubric: data.defaultRubric ?? null,
      difficulty: data.difficulty ?? null,
      estimatedTimeMinutes: data.estimatedTimeMinutes ?? null,
      stats: { totalItems: 0, totalQuestions: 0, totalMaterials: 0, totalPoints: 0 },
      createdBy: callerUid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    await spRef.set(storyPointDoc);

    // Update space stats
    await db.doc(`tenants/${tenantId}/spaces/${spaceId}`).update({
      "stats.totalStoryPoints": FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });

    writeContentVersion(db, tenantId, spaceId, {
      entityType: "storyPoint",
      entityId: spRef.id,
      changeType: "created",
      changeSummary: `Created story point "${data.title}"`,
      changedBy: callerUid,
    }).catch((err) => logger.warn("Failed to write content version:", err));

    logger.info(`Created storyPoint ${spRef.id} in space ${spaceId}`);
    return { id: spRef.id, created: true } satisfies SaveResponse;
  }

  // ── UPDATE ──────────────────────────────────────────
  await loadStoryPoint(tenantId, spaceId, id);

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (UPDATABLE_FIELDS.has(key) && value !== undefined) {
      sanitized[key] = value;
    }
  }

  if (Object.keys(sanitized).length === 0) {
    throw new HttpsError("invalid-argument", "No valid fields to update");
  }

  sanitized.updatedAt = FieldValue.serverTimestamp();
  await db.doc(`${basePath}/${id}`).update(sanitized);

  const changedFields = Object.keys(sanitized).filter((k) => k !== "updatedAt");
  writeContentVersion(db, tenantId, spaceId, {
    entityType: "storyPoint",
    entityId: id,
    changeType: "updated",
    changeSummary: `Updated story point fields: ${changedFields.join(", ")}`,
    changedBy: callerUid,
  }).catch((err) => logger.warn("Failed to write content version:", err));

  logger.info(`Updated storyPoint ${id} in space ${spaceId}`);
  return { id, created: false } satisfies SaveResponse;
});
