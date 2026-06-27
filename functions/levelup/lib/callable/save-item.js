"use strict";
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, "default", { enumerable: true, value: v });
      }
    : function (o, v) {
        o["default"] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  (function () {
    var ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          var ar = [];
          for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        };
      return ownKeys(o);
    };
    return function (mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== "default") __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveItem = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
const auth_1 = require("../utils/auth");
const firestore_2 = require("../utils/firestore");
const create_item_1 = require("./create-item");
const shared_types_1 = require("@levelup/shared-types");
const utils_1 = require("../utils");
const rate_limit_1 = require("../utils/rate-limit");
const content_version_1 = require("../utils/content-version");
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
exports.saveItem = (0, https_1.onCall)({ region: "asia-south1", cors: true }, async (request) => {
  const callerUid = (0, auth_1.assertAuth)(request.auth);
  const { id, tenantId, spaceId, storyPointId, data } = (0, utils_1.parseRequest)(
    request.data,
    shared_types_1.SaveItemRequestSchema
  );
  if (!tenantId || !spaceId || !storyPointId) {
    throw new https_1.HttpsError(
      "invalid-argument",
      "tenantId, spaceId, and storyPointId are required"
    );
  }
  await (0, auth_1.assertTeacherOrAdmin)(callerUid, tenantId);
  await (0, rate_limit_1.enforceRateLimit)(tenantId, callerUid, "write", 30);
  await (0, firestore_2.loadSpace)(tenantId, spaceId);
  const db = admin.firestore();
  // Canonical nested path; legacy flat path retained for fallback resolution.
  const nestedItemsPath = `tenants/${tenantId}/spaces/${spaceId}/storyPoints/${storyPointId}/items`;
  const flatItemsPath = `tenants/${tenantId}/spaces/${spaceId}/items`;
  const isCreate = !id;
  // Resolve an existing item's actual document path (nested first, flat fallback).
  const resolveItemPath = async (itemId) => {
    const nestedSnap = await db.doc(`${nestedItemsPath}/${itemId}`).get();
    if (nestedSnap.exists) return `${nestedItemsPath}/${itemId}`;
    return `${flatItemsPath}/${itemId}`;
  };
  // ── DELETE (soft-delete flag) ───────────────────────
  if (!isCreate && data.deleted) {
    const item = await (0, firestore_2.loadItem)(tenantId, spaceId, id, storyPointId);
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
    const statsUpdate = {
      "stats.totalItems": firestore_1.FieldValue.increment(-1),
      updatedAt: firestore_1.FieldValue.serverTimestamp(),
    };
    if (item.type === "question") {
      statsUpdate["stats.totalQuestions"] = firestore_1.FieldValue.increment(-1);
      if (item.meta?.totalPoints) {
        statsUpdate["stats.totalPoints"] = firestore_1.FieldValue.increment(-item.meta.totalPoints);
      }
    } else if (item.type === "material") {
      statsUpdate["stats.totalMaterials"] = firestore_1.FieldValue.increment(-1);
    }
    await db
      .doc(`tenants/${tenantId}/spaces/${spaceId}/storyPoints/${item.storyPointId}`)
      .update(statsUpdate);
    // Update space stats
    await db.doc(`tenants/${tenantId}/spaces/${spaceId}`).update({
      "stats.totalItems": firestore_1.FieldValue.increment(-1),
      updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    v2_1.logger.info(`Deleted item ${id} from space ${spaceId}`);
    return { id, created: false };
  }
  // ── CREATE ──────────────────────────────────────────
  if (isCreate) {
    if (!data.type || !data.payload) {
      throw new https_1.HttpsError(
        "invalid-argument",
        "type and payload are required for creation"
      );
    }
    const storyPoint = await (0, firestore_2.loadStoryPoint)(tenantId, spaceId, storyPointId);
    // Determine next orderIndex from canonical nested path.
    const lastItem = await db
      .collection(nestedItemsPath)
      .orderBy("orderIndex", "desc")
      .limit(1)
      .get();
    const nextOrder = lastItem.empty ? 0 : (lastItem.docs[0].data().orderIndex ?? 0) + 1;
    const itemRef = db.collection(nestedItemsPath).doc();
    // For timed_test storyPoints, split answer key into server-only subcollection
    let payloadToStore = { ...data.payload };
    const isTimedTest = storyPoint.type === "timed_test" || storyPoint.type === "test";
    const isQuestion = data.type === "question";
    if (isTimedTest && isQuestion && payloadToStore.questionData) {
      const answerKeyData = (0, create_item_1.extractAnswerKey)(payloadToStore);
      if (answerKeyData) {
        const akRef = db.collection(`${nestedItemsPath}/${itemRef.id}/answerKeys`).doc();
        await akRef.set({
          id: akRef.id,
          itemId: itemRef.id,
          questionType: payloadToStore.questionType,
          ...answerKeyData,
          createdAt: firestore_1.FieldValue.serverTimestamp(),
          updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        payloadToStore = (0, create_item_1.stripAnswerFromPayload)(payloadToStore);
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
      createdAt: firestore_1.FieldValue.serverTimestamp(),
      updatedAt: firestore_1.FieldValue.serverTimestamp(),
    };
    await itemRef.set(itemDoc);
    // Update storyPoint stats
    const statsUpdate = {
      "stats.totalItems": firestore_1.FieldValue.increment(1),
      updatedAt: firestore_1.FieldValue.serverTimestamp(),
    };
    if (data.type === "question") {
      statsUpdate["stats.totalQuestions"] = firestore_1.FieldValue.increment(1);
      // P0-6: prefer payload.basePoints (the editable field), fall back to
      // legacy meta.totalPoints. Mirror the chosen value so downstream readers
      // see a consistent number.
      const payloadPoints = data.payload?.basePoints;
      const points =
        typeof payloadPoints === "number"
          ? payloadPoints
          : typeof data.meta?.totalPoints === "number"
            ? data.meta.totalPoints
            : 0;
      if (points > 0) {
        statsUpdate["stats.totalPoints"] = firestore_1.FieldValue.increment(points);
      }
    } else if (data.type === "material") {
      statsUpdate["stats.totalMaterials"] = firestore_1.FieldValue.increment(1);
    }
    await db
      .doc(`tenants/${tenantId}/spaces/${spaceId}/storyPoints/${storyPointId}`)
      .update(statsUpdate);
    // Update space stats
    await db.doc(`tenants/${tenantId}/spaces/${spaceId}`).update({
      "stats.totalItems": firestore_1.FieldValue.increment(1),
      updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    (0, content_version_1.writeContentVersion)(db, tenantId, spaceId, {
      entityType: "item",
      entityId: itemRef.id,
      changeType: "created",
      changeSummary: `Created ${data.type} item "${data.title ?? "Untitled"}"`,
      changedBy: callerUid,
    }).catch((err) => v2_1.logger.warn("Failed to write content version:", err));
    v2_1.logger.info(`Created item ${itemRef.id} in space ${spaceId}`);
    return { id: itemRef.id, created: true };
  }
  // ── UPDATE ──────────────────────────────────────────
  const existingItem = await (0, firestore_2.loadItem)(tenantId, spaceId, id, storyPointId);
  const sanitized = {};
  for (const [key, value] of Object.entries(data)) {
    if (UPDATABLE_FIELDS.has(key) && value !== undefined) {
      sanitized[key] = value;
    }
  }
  if (Object.keys(sanitized).length === 0) {
    throw new https_1.HttpsError("invalid-argument", "No valid fields to update");
  }
  sanitized.updatedAt = firestore_1.FieldValue.serverTimestamp();
  const itemPath = await resolveItemPath(id);
  await db.doc(itemPath).update(sanitized);
  // P0-6: if basePoints changed, adjust stats.totalPoints by the delta.
  if (sanitized.payload && existingItem.type === "question") {
    const newPayload = sanitized.payload;
    const oldPayload = existingItem.payload;
    const newPts = typeof newPayload.basePoints === "number" ? newPayload.basePoints : 0;
    const oldPts = typeof oldPayload.basePoints === "number" ? oldPayload.basePoints : 0;
    const delta = newPts - oldPts;
    if (delta !== 0) {
      await db
        .doc(`tenants/${tenantId}/spaces/${spaceId}/storyPoints/${existingItem.storyPointId}`)
        .update({
          "stats.totalPoints": firestore_1.FieldValue.increment(delta),
          updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
    }
  }
  // If payload was updated and this is a timed test item, also update answer key
  if (sanitized.payload) {
    const payloadRecord = sanitized.payload;
    const akSnap = await db.collection(`${itemPath}/answerKeys`).limit(1).get();
    if (!akSnap.empty) {
      const answerKeyData = (0, create_item_1.extractAnswerKey)(payloadRecord);
      if (answerKeyData) {
        const akDoc = akSnap.docs[0];
        await akDoc.ref.update({
          ...answerKeyData,
          updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        const strippedPayload = (0, create_item_1.stripAnswerFromPayload)(payloadRecord);
        await db.doc(itemPath).update({ payload: strippedPayload });
      }
    }
  }
  const changedFields = Object.keys(sanitized).filter((k) => k !== "updatedAt");
  (0, content_version_1.writeContentVersion)(db, tenantId, spaceId, {
    entityType: "item",
    entityId: id,
    changeType: "updated",
    changeSummary: `Updated item fields: ${changedFields.join(", ")}`,
    changedBy: callerUid,
  }).catch((err) => v2_1.logger.warn("Failed to write content version:", err));
  v2_1.logger.info(`Updated item ${id} in space ${spaceId}`);
  return { id, created: false };
});
//# sourceMappingURL=save-item.js.map
