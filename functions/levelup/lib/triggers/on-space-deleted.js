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
exports.onSpaceDeleted = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const firestore_2 = require("firebase-functions/v2/firestore");
const v2_1 = require("firebase-functions/v2");
/**
 * Firestore trigger: cascade delete when a space is deleted.
 *
 * Cleans up:
 * - All storyPoints
 * - All items (and their answerKeys subcollections)
 * - All agents
 * - All digitalTestSessions for this space
 * - All spaceProgress for this space
 * - All chatSessions for this space
 * - RTDB leaderboard data
 */
exports.onSpaceDeleted = (0, firestore_2.onDocumentDeleted)(
  {
    document: "tenants/{tenantId}/spaces/{spaceId}",
    region: "asia-south1",
  },
  async (event) => {
    const { tenantId, spaceId } = event.params;
    const db = admin.firestore();
    v2_1.logger.info(`Cascading delete for space ${spaceId} in tenant ${tenantId}`);
    // Delete storyPoints
    await deleteCollection(db, `tenants/${tenantId}/spaces/${spaceId}/storyPoints`);
    // Delete items (and their answerKeys)
    const itemsSnap = await db.collection(`tenants/${tenantId}/spaces/${spaceId}/items`).get();
    for (const itemDoc of itemsSnap.docs) {
      // Delete answerKeys subcollection first
      await deleteCollection(db, `${itemDoc.ref.path}/answerKeys`);
      await itemDoc.ref.delete();
    }
    // Delete agents
    await deleteCollection(db, `tenants/${tenantId}/spaces/${spaceId}/agents`);
    // Delete test sessions for this space
    const sessionsSnap = await db
      .collection(`tenants/${tenantId}/digitalTestSessions`)
      .where("spaceId", "==", spaceId)
      .get();
    if (!sessionsSnap.empty) {
      await deleteDocs(db, sessionsSnap.docs);
    }
    // Delete space progress (including storyPointProgress subcollections)
    const progressSnap = await db
      .collection(`tenants/${tenantId}/spaceProgress`)
      .where("spaceId", "==", spaceId)
      .get();
    if (!progressSnap.empty) {
      for (const progressDoc of progressSnap.docs) {
        // Delete storyPointProgress subcollection first
        await deleteCollection(db, `${progressDoc.ref.path}/storyPointProgress`);
      }
      await deleteDocs(db, progressSnap.docs);
    }
    // Delete chat sessions for this space
    const chatSnap = await db
      .collection(`tenants/${tenantId}/chatSessions`)
      .where("spaceId", "==", spaceId)
      .get();
    if (!chatSnap.empty) {
      await deleteDocs(db, chatSnap.docs);
    }
    // Clean up RTDB leaderboard
    try {
      const rtdb = admin.database();
      await rtdb.ref(`leaderboards/${tenantId}/${spaceId}`).remove();
    } catch (err) {
      v2_1.logger.warn("Failed to clean up RTDB leaderboard", err);
    }
    // Update tenant stats
    await db.doc(`tenants/${tenantId}`).update({
      "stats.totalSpaces": firestore_1.FieldValue.increment(-1),
      updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    v2_1.logger.info(`Cascade delete complete for space ${spaceId}`);
  }
);
/**
 * Delete all documents in a collection using chunked batches (max 450 per batch).
 */
async function deleteCollection(db, path) {
  const snapshot = await db.collection(path).limit(450).get();
  if (snapshot.empty) return;
  const batch = db.batch();
  for (const doc of snapshot.docs) {
    batch.delete(doc.ref);
  }
  await batch.commit();
  // Recurse if there might be more
  if (snapshot.size === 450) {
    await deleteCollection(db, path);
  }
}
/**
 * Delete an array of document snapshots in chunked batches (max 450 per batch).
 */
async function deleteDocs(db, docs) {
  for (let i = 0; i < docs.length; i += 450) {
    const chunk = docs.slice(i, i + 450);
    const batch = db.batch();
    for (const d of chunk) {
      batch.delete(d.ref);
    }
    await batch.commit();
  }
}
//# sourceMappingURL=on-space-deleted.js.map
