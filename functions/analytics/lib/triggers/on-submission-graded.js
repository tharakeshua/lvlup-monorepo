"use strict";
/**
 * onSubmissionGraded — Firestore trigger that recalculates the AutoGrade
 * section of a student's progress summary when a submission is graded.
 *
 * Triggers on: /tenants/{tenantId}/submissions/{submissionId}
 * Condition: status changes to 'graded' or 'results_released'
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
exports.onSubmissionGraded = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = __importStar(require("firebase-admin"));
const domain_1 = require("@levelup/domain");
const aggregation_helpers_1 = require("../utils/aggregation-helpers");
const GRADED_STATUSES = new Set(["graded", "grading_complete", "results_released"]);
exports.onSubmissionGraded = (0, firestore_1.onDocumentUpdated)(
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
    const studentId = after.studentId;
    const db = admin.firestore();
    // Fetch all graded submissions for this student in this tenant
    const submissionsSnap = await db
      .collection(`tenants/${tenantId}/submissions`)
      .where("studentId", "==", studentId)
      .where("pipelineStatus", "in", [...GRADED_STATUSES])
      .get();
    // Build exam lookup for titles and subjects
    const examIds = [...new Set(submissionsSnap.docs.map((d) => d.data().examId))];
    const examMap = new Map();
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
    const subjectData = {};
    const recentExams = [];
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
    const subjectBreakdown = {};
    for (const [subject, data] of Object.entries(subjectData)) {
      subjectBreakdown[subject] = {
        avgScore: data.count > 0 ? data.totalScore / data.count : 0,
        examCount: data.count,
      };
    }
    // Sort recent exams by date descending, keep top 10
    // B8: date may be a Firestore Timestamp object OR an ISO string.
    const sortedRecent = (0, aggregation_helpers_1.topN)(recentExams, 10, (e) =>
      (0, aggregation_helpers_1.legacyMillis)(e.date)
    );
    const autograde = {
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
      const { strengths, weaknesses } = (0, aggregation_helpers_1.identifyStrengthsAndWeaknesses)(
        subjectBreakdown,
        levelupBreakdown
      );
      const levelupAvgCompletion = existingSummary?.levelup?.averageCompletion ?? 0;
      const overallScore = (0, aggregation_helpers_1.computeOverallScore)(
        averageScore,
        levelupAvgCompletion
      );
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
          lastUpdatedAt: (0, domain_1.isoNow)(), // B8: ISO strings are canonical at rest
        },
        { merge: true }
      );
    });
    console.log(
      `Updated autograde summary for student ${studentId}: ${completedExams} exams, avg ${(averageScore * 100).toFixed(1)}%`
    );
  }
);
//# sourceMappingURL=on-submission-graded.js.map
