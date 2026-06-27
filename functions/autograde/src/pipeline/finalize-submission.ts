/**
 * finalizeSubmission — Aggregates question scores and calculates final grade.
 *
 * Called after all questions are graded (pipelineStatus → grading_complete).
 */

import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { getQuestionSubmissions, getExamQuestions } from "../utils/firestore-helpers";
import { calculateSubmissionSummary } from "../utils/grading-helpers";
import { sendNotification } from "../utils/notification-sender";

export async function finalizeSubmission(tenantId: string, submissionId: string): Promise<void> {
  const db = admin.firestore();
  const now = FieldValue.serverTimestamp();

  const subDoc = await db.doc(`tenants/${tenantId}/submissions/${submissionId}`).get();
  if (!subDoc.exists) throw new Error(`Submission ${submissionId} not found.`);

  const subData = subDoc.data()!;
  const examId = subData.examId;

  const questionSubs = await getQuestionSubmissions(tenantId, submissionId);
  const questions = await getExamQuestions(tenantId, examId);

  const summary = calculateSubmissionSummary(questionSubs, questions.length);

  // Build linked space feedback if exam has a linked space
  const examData = (await db.doc(`tenants/${tenantId}/exams/${examId}`).get()).data();
  let linkedSpaceFeedback: string | undefined;
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
    "stats.gradedSubmissions": FieldValue.increment(1),
    updatedAt: now,
  });

  // Send grading completion notification to exam creator
  const studentName = subData.studentName ?? "A student";
  if (examData?.createdBy) {
    sendNotification({
      tenantId,
      recipientId: examData.createdBy as string,
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
    sendNotification({
      tenantId,
      recipientId: examData.createdBy as string,
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
