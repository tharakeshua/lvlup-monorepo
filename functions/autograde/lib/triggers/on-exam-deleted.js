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
exports.onExamDeleted = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const firestore_2 = require("firebase-functions/v2/firestore");
const v2_1 = require("firebase-functions/v2");
/**
 * Firestore trigger: cascade delete when an exam is deleted.
 *
 * Cleans up:
 * - All submissions for this exam
 * - All questionSubmissions (subcollections of submissions)
 * - All examQuestions (subcollection of exam)
 * - Exam analytics document
 */
exports.onExamDeleted = (0, firestore_2.onDocumentDeleted)(
  {
    document: "tenants/{tenantId}/exams/{examId}",
    region: "asia-south1",
  },
  async (event) => {
    const { tenantId, examId } = event.params;
    const db = admin.firestore();
    v2_1.logger.info(`Cascading delete for exam ${examId} in tenant ${tenantId}`);
    // Delete exam questions subcollection
    await deleteCollection(db, `tenants/${tenantId}/exams/${examId}/questions`);
    // Delete all submissions and their questionSubmissions
    const submissionsSnap = await db
      .collection(`tenants/${tenantId}/submissions`)
      .where("examId", "==", examId)
      .get();
    for (const submissionDoc of submissionsSnap.docs) {
      // Delete questionSubmissions subcollection first
      await deleteCollection(db, `${submissionDoc.ref.path}/questionSubmissions`);
      await submissionDoc.ref.delete();
    }
    // Delete exam analytics if it exists
    const analyticsRef = db.doc(`tenants/${tenantId}/examAnalytics/${examId}`);
    const analyticsDoc = await analyticsRef.get();
    if (analyticsDoc.exists) {
      await analyticsRef.delete();
    }
    // Update tenant stats
    await db.doc(`tenants/${tenantId}`).update({
      "stats.totalExams": firestore_1.FieldValue.increment(-1),
      updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    v2_1.logger.info(
      `Cascade delete complete for exam ${examId}: ${submissionsSnap.size} submissions deleted`
    );
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
//# sourceMappingURL=on-exam-deleted.js.map
