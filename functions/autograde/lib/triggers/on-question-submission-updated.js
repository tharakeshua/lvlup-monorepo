"use strict";
/**
 * onQuestionSubmissionUpdated — Checks if all questions are graded and
 * triggers submission finalization.
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
exports.onQuestionSubmissionUpdatedV2 = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = __importStar(require("firebase-admin"));
const firestore_2 = require("firebase-admin/firestore");
exports.onQuestionSubmissionUpdatedV2 = (0, firestore_1.onDocumentUpdated)(
  {
    document: "tenants/{tenantId}/submissions/{submissionId}/questionSubmissions/{questionId}",
    region: "asia-south1",
    memory: "256MiB",
  },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;
    const { tenantId, submissionId } = event.params;
    const prevStatus = before.gradingStatus;
    const newStatus = after.gradingStatus;
    // Only act when a question finishes grading
    if (prevStatus === newStatus) return;
    const terminalStatuses = ["graded", "manual", "overridden", "needs_review", "failed"];
    if (!terminalStatuses.includes(newStatus)) return;
    const db = admin.firestore();
    // Check all question submissions
    const allQsSnap = await db
      .collection(`tenants/${tenantId}/submissions/${submissionId}/questionSubmissions`)
      .get();
    if (allQsSnap.empty) return;
    let gradedCount = 0;
    let failedCount = 0;
    let pendingCount = 0;
    let needsReviewCount = 0;
    for (const doc of allQsSnap.docs) {
      const qs = doc.data();
      switch (qs.gradingStatus) {
        case "graded":
        case "manual":
        case "overridden":
          gradedCount++;
          break;
        case "needs_review":
          // Counts as graded for pipeline progress; teacher review is the
          // gate, not the pipeline. Matches the inline transaction in
          // processAnswerGrading.
          needsReviewCount++;
          gradedCount++;
          break;
        case "failed":
          failedCount++;
          break;
        default:
          pendingCount++;
          break;
      }
    }
    const totalQuestions = allQsSnap.size;
    const now = firestore_2.FieldValue.serverTimestamp();
    const subRef = db.doc(`tenants/${tenantId}/submissions/${submissionId}`);
    if (pendingCount > 0) {
      // Still processing, do nothing
      return;
    }
    if (failedCount > 0 && gradedCount > 0) {
      // Partial grading
      await subRef.update({
        pipelineStatus: "grading_partial",
        "summary.questionsGraded": gradedCount,
        "summary.totalQuestions": totalQuestions,
        updatedAt: now,
      });
    } else if (failedCount > 0 && gradedCount === 0) {
      // All failed
      await subRef.update({
        pipelineStatus: "manual_review_needed",
        updatedAt: now,
      });
    } else if (gradedCount === totalQuestions) {
      // All graded — trigger finalization
      await subRef.update({
        pipelineStatus: "grading_complete",
        "summary.needsReviewCount": needsReviewCount,
        updatedAt: now,
      });
    }
  }
);
//# sourceMappingURL=on-question-submission-updated.js.map
