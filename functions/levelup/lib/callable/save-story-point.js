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
exports.saveStoryPoint = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
const auth_1 = require("../utils/auth");
const firestore_2 = require("../utils/firestore");
const domain_1 = require("@levelup/domain");
const wire_1 = require("../contracts/wire");
const utils_1 = require("../utils");
const rate_limit_1 = require("../utils/rate-limit");
const content_version_1 = require("../utils/content-version");
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
exports.saveStoryPoint = (0, https_1.onCall)(
  { region: "asia-south1", cors: true },
  async (request) => {
    const callerUid = (0, auth_1.assertAuth)(request.auth);
    const { id, tenantId, spaceId, data } = (0, utils_1.parseRequest)(
      request.data,
      wire_1.SaveStoryPointRequestSchema
    );
    if (!tenantId || !spaceId) {
      throw new https_1.HttpsError("invalid-argument", "tenantId and spaceId are required");
    }
    await (0, auth_1.assertTeacherOrAdmin)(callerUid, tenantId);
    await (0, rate_limit_1.enforceRateLimit)(tenantId, callerUid, "write", 30);
    await (0, firestore_2.loadSpace)(tenantId, spaceId);
    const db = admin.firestore();
    const basePath = `tenants/${tenantId}/spaces/${spaceId}/storyPoints`;
    const isCreate = !id;
    // ── DELETE (soft-delete flag) ───────────────────────
    if (!isCreate && data.deleted) {
      await (0, firestore_2.loadStoryPoint)(tenantId, spaceId, id);
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
      const spaceUpdates = {
        "stats.totalStoryPoints": firestore_1.FieldValue.increment(-1),
        updatedAt: (0, domain_1.isoNow)(),
      };
      if (totalItemsDeleted > 0) {
        spaceUpdates["stats.totalItems"] = firestore_1.FieldValue.increment(-totalItemsDeleted);
      }
      await db.doc(`tenants/${tenantId}/spaces/${spaceId}`).update(spaceUpdates);
      v2_1.logger.info(
        `Deleted storyPoint ${id} and ${totalItemsDeleted} items from space ${spaceId}`
      );
      return { id, created: false };
    }
    // ── CREATE ──────────────────────────────────────────
    if (isCreate) {
      if (!data.title || !data.type) {
        throw new https_1.HttpsError(
          "invalid-argument",
          "title and type are required for creation"
        );
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
        createdAt: (0, domain_1.isoNow)(),
        updatedAt: (0, domain_1.isoNow)(),
      };
      await spRef.set(storyPointDoc);
      // Update space stats
      await db.doc(`tenants/${tenantId}/spaces/${spaceId}`).update({
        "stats.totalStoryPoints": firestore_1.FieldValue.increment(1),
        updatedAt: (0, domain_1.isoNow)(),
      });
      (0, content_version_1.writeContentVersion)(db, tenantId, spaceId, {
        entityType: "storyPoint",
        entityId: spRef.id,
        changeType: "created",
        changeSummary: `Created story point "${data.title}"`,
        changedBy: callerUid,
      }).catch((err) => v2_1.logger.warn("Failed to write content version:", err));
      v2_1.logger.info(`Created storyPoint ${spRef.id} in space ${spaceId}`);
      return { id: spRef.id, created: true };
    }
    // ── UPDATE ──────────────────────────────────────────
    await (0, firestore_2.loadStoryPoint)(tenantId, spaceId, id);
    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
      if (UPDATABLE_FIELDS.has(key) && value !== undefined) {
        sanitized[key] = value;
      }
    }
    if (Object.keys(sanitized).length === 0) {
      throw new https_1.HttpsError("invalid-argument", "No valid fields to update");
    }
    sanitized.updatedAt = (0, domain_1.isoNow)();
    await db.doc(`${basePath}/${id}`).update(sanitized);
    const changedFields = Object.keys(sanitized).filter((k) => k !== "updatedAt");
    (0, content_version_1.writeContentVersion)(db, tenantId, spaceId, {
      entityType: "storyPoint",
      entityId: id,
      changeType: "updated",
      changeSummary: `Updated story point fields: ${changedFields.join(", ")}`,
      changedBy: callerUid,
    }).catch((err) => v2_1.logger.warn("Failed to write content version:", err));
    v2_1.logger.info(`Updated storyPoint ${id} in space ${spaceId}`);
    return { id, created: false };
  }
);
//# sourceMappingURL=save-story-point.js.map
