/**
 * onExamResultsReleased — Firestore trigger that computes ExamAnalytics
 * when an exam's status changes to 'results_released'.
 *
 * Triggers on: /tenants/{tenantId}/exams/{examId}
 */

import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { median, standardDeviation } from "../utils/aggregation-helpers";
import type { ExamAnalytics } from "@levelup/shared-types";

export const onExamResultsReleased = onDocumentUpdated(
  {
    document: "tenants/{tenantId}/exams/{examId}",
    region: "asia-south1",
    memory: "512MiB",
  },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    // Only trigger when status changes to results_released
    if (before.status === "results_released" || after.status !== "results_released") {
      return;
    }

    const { tenantId, examId } = event.params;
    const db = admin.firestore();

    // Fetch all submissions for this exam
    const submissionsSnap = await db
      .collection(`tenants/${tenantId}/submissions`)
      .where("examId", "==", examId)
      .get();

    const totalSubmissions = submissionsSnap.size;
    if (totalSubmissions === 0) return;

    const scores: number[] = [];
    const percentages: number[] = [];
    let gradedCount = 0;
    const totalMarks = after.totalMarks || 1;
    const passingMarks = after.passingMarks || 0;
    let passCount = 0;

    // Per-question aggregation
    const questionData: Record<
      string,
      { totalScore: number; maxScore: number; attemptCount: number; totalAttempts: number }
    > = {};

    // Grade distribution
    const gradeDistribution: Record<string, number> = {};

    // Class breakdown
    const classData: Record<string, { totalScore: number; count: number; passCount: number }> = {};

    // Pre-fetch all question submissions in parallel batches of 10
    const BATCH_SIZE = 10;
    const submissionDocs = submissionsSnap.docs;
    const qSubmissionResults: admin.firestore.QuerySnapshot[] = [];

    for (let i = 0; i < submissionDocs.length; i += BATCH_SIZE) {
      const batch = submissionDocs.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map((d) =>
          db.collection(`tenants/${tenantId}/submissions/${d.id}/questionSubmissions`).get()
        )
      );
      qSubmissionResults.push(...batchResults);
    }

    for (let idx = 0; idx < submissionDocs.length; idx++) {
      const doc = submissionDocs[idx];
      const sub = doc.data();

      const obtained = sub.summary?.totalMarksObtained ?? 0;
      const percentage = totalMarks > 0 ? (obtained / totalMarks) * 100 : 0;

      if (sub.pipelineStatus === "grading_complete" || sub.pipelineStatus === "results_released") {
        gradedCount++;
        scores.push(obtained);
        percentages.push(percentage);

        if (obtained >= passingMarks) passCount++;

        // Grade bucket
        const grade = getGrade(percentage);
        gradeDistribution[grade] = (gradeDistribution[grade] ?? 0) + 1;

        // Class aggregation
        const classId = sub.classId as string;
        if (classId) {
          if (!classData[classId]) {
            classData[classId] = { totalScore: 0, count: 0, passCount: 0 };
          }
          classData[classId].totalScore += obtained;
          classData[classId].count++;
          if (obtained >= passingMarks) classData[classId].passCount++;
        }
      }

      // Aggregate question-level data from pre-fetched question submissions
      const qSubmissionsSnap = qSubmissionResults[idx];

      for (const qDoc of qSubmissionsSnap.docs) {
        const qs = qDoc.data();
        const qId = qs.questionId as string;
        if (!questionData[qId]) {
          questionData[qId] = { totalScore: 0, maxScore: 0, attemptCount: 0, totalAttempts: 0 };
        }
        questionData[qId].totalAttempts++;
        if (qs.evaluation) {
          questionData[qId].totalScore += qs.evaluation.score ?? 0;
          questionData[qId].maxScore = Math.max(
            questionData[qId].maxScore,
            qs.evaluation.maxScore ?? 0
          );
          questionData[qId].attemptCount++;
        }
      }
    }

    const avgScore = scores.length > 0 ? scores.reduce((s, v) => s + v, 0) / scores.length : 0;
    const avgPercentage =
      percentages.length > 0 ? percentages.reduce((s, v) => s + v, 0) / percentages.length : 0;

    // Build question analytics
    const questionAnalytics: Record<
      string,
      {
        questionId: string;
        avgScore: number;
        maxScore: number;
        avgPercentage: number;
        difficultyIndex: number;
        discriminationIndex: number;
        commonMistakes: string[];
        commonStrengths: string[];
      }
    > = {};

    for (const [qId, data] of Object.entries(questionData)) {
      const qAvg = data.attemptCount > 0 ? data.totalScore / data.attemptCount : 0;
      const qMaxScore = data.maxScore || 1;
      const difficultyIndex = qMaxScore > 0 ? qAvg / qMaxScore : 0;

      questionAnalytics[qId] = {
        questionId: qId,
        avgScore: qAvg,
        maxScore: qMaxScore,
        avgPercentage: difficultyIndex * 100,
        difficultyIndex,
        discriminationIndex: 0, // requires upper/lower group analysis, computed separately
        commonMistakes: [],
        commonStrengths: [],
      };
    }

    // Build class breakdown
    const classBreakdown: Record<
      string,
      {
        classId: string;
        className: string;
        avgScore: number;
        passRate: number;
        submissionCount: number;
      }
    > = {};

    for (const [classId, data] of Object.entries(classData)) {
      classBreakdown[classId] = {
        classId,
        className: classId, // caller can enrich with class name later
        avgScore: data.count > 0 ? data.totalScore / data.count : 0,
        passRate: data.count > 0 ? data.passCount / data.count : 0,
        submissionCount: data.count,
      };
    }

    // Score distribution buckets
    const buckets = [
      { min: 0, max: 20, count: 0 },
      { min: 20, max: 40, count: 0 },
      { min: 40, max: 60, count: 0 },
      { min: 60, max: 80, count: 0 },
      { min: 80, max: 100, count: 0 },
    ];
    for (const pct of percentages) {
      const bucket =
        buckets.find((b) => pct >= b.min && pct < b.max) ?? buckets[buckets.length - 1];
      bucket.count++;
    }

    const analytics: Omit<ExamAnalytics, "computedAt" | "lastUpdatedAt"> & {
      computedAt: FieldValue;
      lastUpdatedAt: FieldValue;
    } = {
      id: examId,
      tenantId,
      examId,
      totalSubmissions,
      gradedSubmissions: gradedCount,
      avgScore,
      avgPercentage,
      passRate: gradedCount > 0 ? passCount / gradedCount : 0,
      medianScore: median(scores),
      scoreDistribution: { buckets, gradeDistribution },
      questionAnalytics,
      classBreakdown,
      topicPerformance: {}, // populated separately if topic tags exist
      computedAt: FieldValue.serverTimestamp(),
      lastUpdatedAt: FieldValue.serverTimestamp(),
    };

    await db.doc(`tenants/${tenantId}/examAnalytics/${examId}`).set(analytics);

    console.log(
      `Computed exam analytics for ${examId}: ${gradedCount}/${totalSubmissions} graded, avg ${avgPercentage.toFixed(1)}%`
    );
  }
);

function getGrade(percentage: number): string {
  if (percentage >= 90) return "A+";
  if (percentage >= 80) return "A";
  if (percentage >= 70) return "B+";
  if (percentage >= 60) return "B";
  if (percentage >= 50) return "C";
  if (percentage >= 40) return "D";
  return "F";
}
