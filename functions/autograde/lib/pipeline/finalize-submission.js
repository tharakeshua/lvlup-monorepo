"use strict";
/**
 * finalizeSubmission — Aggregates question scores and calculates final grade.
 *
 * Called after all questions are graded (pipelineStatus → grading_complete).
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
exports.finalizeSubmission = finalizeSubmission;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const firestore_helpers_1 = require("../utils/firestore-helpers");
const grading_helpers_1 = require("../utils/grading-helpers");
const notification_sender_1 = require("../utils/notification-sender");
async function finalizeSubmission(tenantId, submissionId) {
  const db = admin.firestore();
  const now = firestore_1.FieldValue.serverTimestamp();
  const subDoc = await db.doc(`tenants/${tenantId}/submissions/${submissionId}`).get();
  if (!subDoc.exists) throw new Error(`Submission ${submissionId} not found.`);
  const subData = subDoc.data();
  const examId = subData.examId;
  const questionSubs = await (0, firestore_helpers_1.getQuestionSubmissions)(
    tenantId,
    submissionId
  );
  const questions = await (0, firestore_helpers_1.getExamQuestions)(tenantId, examId);
  const summary = (0, grading_helpers_1.calculateSubmissionSummary)(questionSubs, questions.length);
  // Build linked space feedback if exam has a linked space
  const examData = (await db.doc(`tenants/${tenantId}/exams/${examId}`).get()).data();
  let linkedSpaceFeedback;
  if (examData?.linkedSpaceId && examData?.linkedSpaceTitle) {
    linkedSpaceFeedback = `Improve your score by practicing with "${examData.linkedSpaceTitle}".`;
  }
  // Update submission with final summary
  await db.doc(`tenants/${tenantId}/submissions/${submissionId}`).update({
    summary: {
      ...summary,
      completedAt: now,
      ...(linkedSpaceFeedback && { linkedSpaceFeedback }),
    },
    pipelineStatus: "ready_for_review",
    updatedAt: now,
  });
  // Increment exam stats
  const examRef = db.doc(`tenants/${tenantId}/exams/${examId}`);
  await examRef.update({
    "stats.gradedSubmissions": firestore_1.FieldValue.increment(1),
    updatedAt: now,
  });
  // Send grading completion notification to exam creator
  const studentName = subData.studentName ?? "A student";
  if (examData?.createdBy) {
    (0, notification_sender_1.sendNotification)({
      tenantId,
      recipientId: examData.createdBy,
      recipientRole: "teacher",
      type: "grading_complete",
      title: "Grading Complete",
      body: `${studentName}'s submission has been graded: ${summary.totalScore}/${summary.maxScore} (${summary.grade})`,
      entityType: "submission",
      entityId: submissionId,
      actionUrl: `/exams/${examId}/submissions/${submissionId}`,
    }).catch((err) => console.warn("[finalizeSubmission] Notification failed:", err));
  }
  // Check if all submissions for this exam are now graded — send batch summary
  const allSubsSnap = await db
    .collection(`tenants/${tenantId}/submissions`)
    .where("examId", "==", examId)
    .get();
  const totalSubs = allSubsSnap.size;
  const gradedSubs = allSubsSnap.docs.filter((d) => {
    const status = d.data().pipelineStatus;
    return status === "ready_for_review" || status === "reviewed";
  }).length;
  if (gradedSubs === totalSubs && totalSubs > 1 && examData?.createdBy) {
    (0, notification_sender_1.sendNotification)({
      tenantId,
      recipientId: examData.createdBy,
      recipientRole: "teacher",
      type: "all_grading_complete",
      title: "All Submissions Graded",
      body: `All ${totalSubs} submissions for "${examData.title}" have been graded and are ready for review.`,
      entityType: "exam",
      entityId: examId,
      actionUrl: `/exams/${examId}/submissions`,
    }).catch((err) => console.warn("[finalizeSubmission] Batch notification failed:", err));
  }
  console.log(
    `Finalized submission ${submissionId}: ${summary.totalScore}/${summary.maxScore} (${summary.grade})`
  );
}
//# sourceMappingURL=finalize-submission.js.map
