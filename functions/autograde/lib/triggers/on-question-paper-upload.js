"use strict";
/**
 * onQuestionPaperUpload — Cloud Storage trigger.
 *
 * Fires when a file is uploaded to the question paper path:
 *   tenants/{tenantId}/exams/{examId}/question-paper/{filename}
 *
 * Updates the exam document with the uploaded image paths and transitions
 * status from 'draft' to 'question_paper_uploaded'.
 */
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
exports.onQuestionPaperUpload = void 0;
const storage_1 = require("firebase-functions/v2/storage");
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
/** Expected path pattern: tenants/{tenantId}/exams/{examId}/question-paper/{filename} */
const QP_PATH_REGEX = /^tenants\/([^/]+)\/exams\/([^/]+)\/question-paper\/(.+)$/;
exports.onQuestionPaperUpload = (0, storage_1.onObjectFinalized)(
  {
    region: "asia-south1",
    memory: "256MiB",
    bucket: undefined, // default bucket
  },
  async (event) => {
    const filePath = event.data.name;
    if (!filePath) return;
    const match = filePath.match(QP_PATH_REGEX);
    if (!match) return; // Not a question paper upload
    const [, tenantId, examId] = match;
    const contentType = event.data.contentType ?? "";
    // Only process image files
    if (!contentType.startsWith("image/")) {
      console.warn(`Ignoring non-image file in question-paper path: ${filePath} (${contentType})`);
      return;
    }
    console.log(`Question paper image uploaded: ${filePath} for exam ${examId}`);
    const db = admin.firestore();
    const examRef = db.doc(`tenants/${tenantId}/exams/${examId}`);
    const now = firestore_1.FieldValue.serverTimestamp();
    await db.runTransaction(async (txn) => {
      const examDoc = await txn.get(examRef);
      if (!examDoc.exists) {
        console.error(`Exam ${examId} not found in tenant ${tenantId}. Ignoring upload.`);
        return;
      }
      const exam = examDoc.data();
      // Only process if exam is in draft or question_paper_uploaded status
      if (exam.status !== "draft" && exam.status !== "question_paper_uploaded") {
        console.warn(
          `Exam ${examId} is in '${exam.status}' status. Ignoring question paper upload.`
        );
        return;
      }
      // Append the new image path to the existing images array
      const existingImages = exam.questionPaper?.images ?? [];
      if (existingImages.includes(filePath)) {
        console.warn(`Image ${filePath} already recorded for exam ${examId}. Skipping.`);
        return;
      }
      const updatedImages = [...existingImages, filePath];
      txn.update(examRef, {
        "questionPaper.images": updatedImages,
        status: "question_paper_uploaded",
        updatedAt: now,
      });
    });
    console.log(`Exam ${examId} updated with question paper image: ${filePath}`);
  }
);
//# sourceMappingURL=on-question-paper-upload.js.map
