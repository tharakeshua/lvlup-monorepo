/**
 * onSubmissionGraded — Firestore trigger that recalculates the AutoGrade
 * section of a student's progress summary when a submission is graded.
 *
 * Triggers on: /tenants/{tenantId}/submissions/{submissionId}
 * Condition: status changes to 'graded' or 'results_released'
 */

import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { isoNow } from "@levelup/domain";
import {
  computeOverallScore,
  identifyStrengthsAndWeaknesses,
  legacyMillis,
  topN,
} from "../utils/aggregation-helpers";
import type { StudentAutogradeMetrics, RecentExamEntry } from "../contracts/legacy-docs";

const GRADED_STATUSES = new Set(["graded", "grading_complete", "results_released"]);

export const onSubmissionGraded = onDocumentUpdated(
  {
    document: "tenants/{tenantId}/submissions/{submissionId}",
    region: "asia-south1",
    memory: "512MiB",
  },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    // Only process when pipeline status transitions to a graded state
    if (GRADED_STATUSES.has(before.pipelineStatus) || !GRADED_STATUSES.has(after.pipelineStatus)) {
      return;
    }

    const { tenantId } = event.params;
    const studentId = after.studentId as string;

    const db = admin.firestore();

    // Fetch all graded submissions for this student in this tenant
    const submissionsSnap = await db
      .collection(`tenants/${tenantId}/submissions`)
      .where("studentId", "==", studentId)
      .where("pipelineStatus", "in", [...GRADED_STATUSES])
      .get();

    // Build exam lookup for titles and subjects
    const examIds = [...new Set(submissionsSnap.docs.map((d) => d.data().examId as string))];
    const examMap = new Map<string, { title: string; subject: string; totalMarks: number }>();

    // Batch fetch exams (max 30 per in query)
    for (let i = 0; i < examIds.length; i += 30) {
      const batch = examIds.slice(i, i + 30);
      const examsSnap = await db
        .collection(`tenants/${tenantId}/exams`)
        .where(admin.firestore.FieldPath.documentId(), "in", batch)
        .get();
      for (const doc of examsSnap.docs) {
        const e = doc.data();
        examMap.set(doc.id, {
          title: e.title,
          subject: e.subject,
          totalMarks: e.totalMarks,
        });
      }
    }

    // Aggregate metrics
    let totalMarksObtained = 0;
    let totalMarksAvailable = 0;
    const subjectData: Record<string, { totalScore: number; count: number }> = {};
    const recentExams: RecentExamEntry[] = [];

    for (const doc of submissionsSnap.docs) {
      const sub = doc.data();
      const exam = examMap.get(sub.examId);
      if (!exam) continue;

      const obtained = sub.summary?.totalMarksObtained ?? 0;
      const available = exam.totalMarks || 1;
      const score = available > 0 ? obtained / available : 0;

      totalMarksObtained += obtained;
      totalMarksAvailable += available;

      // Subject breakdown
      if (!subjectData[exam.subject]) {
        subjectData[exam.subject] = { totalScore: 0, count: 0 };
      }
      subjectData[exam.subject].totalScore += score;
      subjectData[exam.subject].count += 1;

      recentExams.push({
        examId: sub.examId,
        examTitle: exam.title,
        score,
        percentage: score * 100,
        date: sub.updatedAt,
      });
    }

    const completedExams = submissionsSnap.size;
    const averageScore = totalMarksAvailable > 0 ? totalMarksObtained / totalMarksAvailable : 0;

    const subjectBreakdown: Record<string, { avgScore: number; examCount: number }> = {};
    for (const [subject, data] of Object.entries(subjectData)) {
      subjectBreakdown[subject] = {
        avgScore: data.count > 0 ? data.totalScore / data.count : 0,
        examCount: data.count,
      };
    }

    // Sort recent exams by date descending, keep top 10
    // B8: date may be a Firestore Timestamp object OR an ISO string.
    const sortedRecent = topN(recentExams, 10, (e) => legacyMillis(e.date));

    const autograde: StudentAutogradeMetrics = {
      totalExams: examIds.length,
      completedExams,
      averageScore,
      averagePercentage: averageScore * 100,
      totalMarksObtained,
      totalMarksAvailable,
      subjectBreakdown,
      recentExams: sortedRecent,
    };

    // Use a transaction for atomic read-modify-write to prevent concurrent overwrites
    const summaryRef = db.doc(`tenants/${tenantId}/studentProgressSummaries/${studentId}`);

    await db.runTransaction(async (transaction) => {
      const existingSummary = (await transaction.get(summaryRef)).data();

      const levelupBreakdown = existingSummary?.levelup?.subjectBreakdown ?? {};
      const { strengths, weaknesses } = identifyStrengthsAndWeaknesses(
        subjectBreakdown,
        levelupBreakdown
      );

      const levelupAvgCompletion = existingSummary?.levelup?.averageCompletion ?? 0;
      const overallScore = computeOverallScore(averageScore, levelupAvgCompletion);

      transaction.set(
        summaryRef,
        {
          id: studentId,
          tenantId,
          studentId,
          autograde,
          overallScore,
          strengthAreas: strengths,
          weaknessAreas: weaknesses,
          lastUpdatedAt: isoNow(), // B8: ISO strings are canonical at rest
        },
        { merge: true }
      );
    });

    console.log(
      `Updated autograde summary for student ${studentId}: ${completedExams} exams, avg ${(averageScore * 100).toFixed(1)}%`
    );
  }
);
