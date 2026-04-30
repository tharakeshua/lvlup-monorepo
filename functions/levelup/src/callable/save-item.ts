import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { assertAuth, assertTeacherOrAdmin } from "../utils/auth";
import { loadSpace, loadStoryPoint, loadItem } from "../utils/firestore";
import { extractAnswerKey, stripAnswerFromPayload } from "./create-item";
import { SaveItemRequestSchema } from "@levelup/shared-types";
import type { SaveItemRequest, SaveResponse } from "@levelup/shared-types";
import { parseRequest } from "../utils";
import { enforceRateLimit } from "../utils/rate-limit";
import { writeContentVersion } from "../utils/content-version";

const UPDATABLE_FIELDS = new Set([
  "payload",
  "title",
  "content",
  "difficulty",
  "topics",
  "labels",
  "meta",
  "analytics",
  "rubric",
  "sectionId",
  "orderIndex",
  "attachments",
]);

/**
 * Consolidated item endpoint — replaces: createItem, updateItem, deleteItem
 *
 * No id → create new item
 * id present → update existing item
 * data.deleted = true → soft-delete (actually hard-deletes document + answer keys, decrements stats)
 */
export const saveItem = onCall({ region: "asia-south1", cors: true }, async (request) => {
  const callerUid = assertAuth(request.auth);
  const { id, tenantId, spaceId, storyPointId, data } = parseRequest(
    request.data,
    SaveItemRequestSchema
  );

  if (!tenantId || !spaceId || !storyPointId) {
    throw new HttpsError("invalid-argument", "tenantId, spaceId, and storyPointId are required");
  }

  await assertTeacherOrAdmin(callerUid, tenantId);
  await enforceRateLimit(tenantId, callerUid, "write", 30);
  await loadSpace(tenantId, spaceId);

  const db = admin.firestore();
  // Canonical nested path; legacy flat path retained for fallback resolution.
  const nestedItemsPath = `tenants/${tenantId}/spaces/${spaceId}/storyPoints/${storyPointId}/items`;
  const flatItemsPath = `tenants/${tenantId}/spaces/${spaceId}/items`;
  const isCreate = !id;

  // Resolve an existing item's actual document path (nested first, flat fallback).
  const resolveItemPath = async (itemId: string): Promise<string> => {
    const nestedSnap = await db.doc(`${nestedItemsPath}/${itemId}`).get();
    if (nestedSnap.exists) return `${nestedItemsPath}/${itemId}`;
    return `${flatItemsPath}/${itemId}`;
  };

  // ── DELETE (soft-delete flag) ───────────────────────
  if (!isCreate && data.deleted) {
    const item = await loadItem(tenantId, spaceId, id, storyPointId);
    const itemPath = await resolveItemPath(id);

    // Delete answer keys subcollection
    const akSnap = await db.collection(`${itemPath}/answerKeys`).get();
    if (!akSnap.empty) {
      const batch = db.batch();
      for (const akDoc of akSnap.docs) {
        batch.delete(akDoc.ref);
      }
      await batch.commit();
    }

    // Delete the item document
    await db.doc(itemPath).delete();

    // Update storyPoint stats
    const statsUpdate: Record<string, unknown> = {
      "stats.totalItems": admin.firestore.FieldValue.increment(-1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (item.type === "question") {
      statsUpdate["stats.totalQuestions"] = admin.firestore.FieldValue.increment(-1);
      if (item.meta?.totalPoints) {
        statsUpdate["stats.totalPoints"] = admin.firestore.FieldValue.increment(
          -item.meta.totalPoints
        );
      }
    } else if (item.type === "material") {
      statsUpdate["stats.totalMaterials"] = admin.firestore.FieldValue.increment(-1);
    }

    await db
      .doc(`tenants/${tenantId}/spaces/${spaceId}/storyPoints/${item.storyPointId}`)
      .update(statsUpdate);

    // Update space stats
    await db.doc(`tenants/${tenantId}/spaces/${spaceId}`).update({
      "stats.totalItems": admin.firestore.FieldValue.increment(-1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info(`Deleted item ${id} from space ${spaceId}`);
    return { id, created: false } satisfies SaveResponse;
  }

  // ── CREATE ──────────────────────────────────────────
  if (isCreate) {
    if (!data.type || !data.payload) {
      throw new HttpsError("invalid-argument", "type and payload are required for creation");
    }

    const storyPoint = await loadStoryPoint(tenantId, spaceId, storyPointId);

    // Determine next orderIndex from canonical nested path.
    const lastItem = await db
      .collection(nestedItemsPath)
      .orderBy("orderIndex", "desc")
      .limit(1)
      .get();
    const nextOrder = lastItem.empty ? 0 : (lastItem.docs[0].data().orderIndex ?? 0) + 1;

    const itemRef = db.collection(nestedItemsPath).doc();

    // For timed_test storyPoints, split answer key into server-only subcollection
    let payloadToStore = { ...data.payload } as Record<string, unknown>;
    const isTimedTest = storyPoint.type === "timed_test" || storyPoint.type === "test";
    const isQuestion = data.type === "question";

    if (isTimedTest && isQuestion && payloadToStore.questionData) {
      const answerKeyData = extractAnswerKey(payloadToStore);
      if (answerKeyData) {
        const akRef = db.collection(`${nestedItemsPath}/${itemRef.id}/answerKeys`).doc();
        await akRef.set({
          id: akRef.id,
          itemId: itemRef.id,
          questionType: payloadToStore.questionType,
          ...answerKeyData,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        payloadToStore = stripAnswerFromPayload(payloadToStore);
      }
    }

    const itemDoc = {
      id: itemRef.id,
      spaceId,
      storyPointId,
      sectionId: data.sectionId ?? null,
      tenantId,
      type: data.type,
      payload: payloadToStore,
      title: data.title ?? null,
      content: data.content ?? null,
      difficulty: data.difficulty ?? null,
      topics: data.topics ?? [],
      labels: data.labels ?? [],
      orderIndex: data.orderIndex ?? nextOrder,
      meta: data.meta ?? null,
      analytics: null,
      rubric: data.rubric ?? null,
      createdBy: callerUid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await itemRef.set(itemDoc);

    // Update storyPoint stats
    const statsUpdate: Record<string, unknown> = {
      "stats.totalItems": admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (data.type === "question") {
      statsUpdate["stats.totalQuestions"] = admin.firestore.FieldValue.increment(1);
      if (data.meta?.totalPoints && typeof data.meta.totalPoints === "number") {
        statsUpdate["stats.totalPoints"] = admin.firestore.FieldValue.increment(
          data.meta.totalPoints
        );
      }
    } else if (data.type === "material") {
      statsUpdate["stats.totalMaterials"] = admin.firestore.FieldValue.increment(1);
    }

    await db
      .doc(`tenants/${tenantId}/spaces/${spaceId}/storyPoints/${storyPointId}`)
      .update(statsUpdate);

    // Update space stats
    await db.doc(`tenants/${tenantId}/spaces/${spaceId}`).update({
      "stats.totalItems": admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    writeContentVersion(db, tenantId, spaceId, {
      entityType: "item",
      entityId: itemRef.id,
      changeType: "created",
      changeSummary: `Created ${data.type} item "${data.title ?? "Untitled"}"`,
      changedBy: callerUid,
    }).catch((err) => logger.warn("Failed to write content version:", err));

    logger.info(`Created item ${itemRef.id} in space ${spaceId}`);
    return { id: itemRef.id, created: true } satisfies SaveResponse;
  }

  // ── UPDATE ──────────────────────────────────────────
  await loadItem(tenantId, spaceId, id, storyPointId);

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (UPDATABLE_FIELDS.has(key) && value !== undefined) {
      sanitized[key] = value;
    }
  }

  if (Object.keys(sanitized).length === 0) {
    throw new HttpsError("invalid-argument", "No valid fields to update");
  }

  sanitized.updatedAt = admin.firestore.FieldValue.serverTimestamp();

  const itemPath = await resolveItemPath(id);
  await db.doc(itemPath).update(sanitized);

  // If payload was updated and this is a timed test item, also update answer key
  if (sanitized.payload) {
    const payloadRecord = sanitized.payload as Record<string, unknown>;
    const akSnap = await db.collection(`${itemPath}/answerKeys`).limit(1).get();
    if (!akSnap.empty) {
      const answerKeyData = extractAnswerKey(payloadRecord);
      if (answerKeyData) {
        const akDoc = akSnap.docs[0];
        await akDoc.ref.update({
          ...answerKeyData,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        const strippedPayload = stripAnswerFromPayload(payloadRecord);
        await db.doc(itemPath).update({ payload: strippedPayload });
      }
    }
  }

  const changedFields = Object.keys(sanitized).filter((k) => k !== "updatedAt");
  writeContentVersion(db, tenantId, spaceId, {
    entityType: "item",
    entityId: id,
    changeType: "updated",
    changeSummary: `Updated item fields: ${changedFields.join(", ")}`,
    changedBy: callerUid,
  }).catch((err) => logger.warn("Failed to write content version:", err));

  logger.info(`Updated item ${id} in space ${spaceId}`);
  return { id, created: false } satisfies SaveResponse;
});
