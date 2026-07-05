"use strict";
/**
 * onExamResultsReleased — Firestore trigger that computes ExamAnalytics
 * when an exam's status changes to 'results_released'.
 *
 * Triggers on: /tenants/{tenantId}/exams/{examId}
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
exports.onExamResultsReleased = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = __importStar(require("firebase-admin"));
const domain_1 = require("@levelup/domain");
const aggregation_helpers_1 = require("../utils/aggregation-helpers");
exports.onExamResultsReleased = (0, firestore_1.onDocumentUpdated)(
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
    const scores = [];
    const percentages = [];
    let gradedCount = 0;
    const totalMarks = after.totalMarks || 1;
    const passingMarks = after.passingMarks || 0;
    let passCount = 0;
    // Per-question aggregation
    const questionData = {};
    // Grade distribution
    const gradeDistribution = {};
    // Class breakdown
    const classData = {};
    // Pre-fetch all question submissions in parallel batches of 10
    const BATCH_SIZE = 10;
    const submissionDocs = submissionsSnap.docs;
    const qSubmissionResults = [];
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
        // Grade bucket — canonical 8-letter scale via domain (U1.2/B5; the
        // former local 7-letter table intentionally diverged on 33–59%).
        const grade = (0, domain_1.gradeForPercentage)(percentage);
        gradeDistribution[grade] = (gradeDistribution[grade] ?? 0) + 1;
        // Class aggregation
        const classId = sub.classId;
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
        const qId = qs.questionId;
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
    const questionAnalytics = {};
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
    const classBreakdown = {};
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
    const analytics = {
      id: examId,
      tenantId,
      examId,
      totalSubmissions,
      gradedSubmissions: gradedCount,
      avgScore,
      avgPercentage,
      passRate: gradedCount > 0 ? passCount / gradedCount : 0,
      medianScore: (0, aggregation_helpers_1.median)(scores),
      scoreDistribution: { buckets, gradeDistribution },
      questionAnalytics,
      classBreakdown,
      topicPerformance: {}, // populated separately if topic tags exist
      computedAt: (0, domain_1.isoNow)(), // B8: ISO strings are canonical at rest
      lastUpdatedAt: (0, domain_1.isoNow)(),
    };
    await db.doc(`tenants/${tenantId}/examAnalytics/${examId}`).set(analytics);
    console.log(
      `Computed exam analytics for ${examId}: ${gradedCount}/${totalSubmissions} graded, avg ${avgPercentage.toFixed(1)}%`
    );
  }
);
//# sourceMappingURL=on-exam-results-released.js.map
