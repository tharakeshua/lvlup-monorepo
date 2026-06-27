/**
 * onQuestionSubmissionUpdated — Checks if all questions are graded and
 * triggers submission finalization.
 */

import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export const onQuestionSubmissionUpdatedV2 = onDocumentUpdated(
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
    const now = FieldValue.serverTimestamp();
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
