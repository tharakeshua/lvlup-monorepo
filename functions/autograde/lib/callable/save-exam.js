"use strict";
/**
 * saveExam — Consolidated endpoint replacing:
 *   createExam, updateExam, publishExam, releaseExamResults, linkExamToSpace
 *
 * - No `id` in request → create new exam
 * - `id` present → update existing exam (including status transitions)
 * - Status transitions validated server-side using ExamStatus from shared-types
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
exports.saveExam = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const shared_types_1 = require("@levelup/shared-types");
const assertions_1 = require("../utils/assertions");
const firestore_helpers_1 = require("../utils/firestore-helpers");
const utils_1 = require("../utils");
const rate_limit_1 = require("../utils/rate-limit");
/** Valid transitions from each status. */
const VALID_STATUS_TRANSITIONS = {
  draft: ["question_paper_uploaded"],
  question_paper_uploaded: ["question_paper_extracted"],
  question_paper_extracted: ["published"],
  published: ["grading"],
  grading: ["completed"],
  completed: ["results_released"],
  results_released: ["archived"],
};
/** Statuses that allow field updates (non-status changes). */
const UPDATABLE_STATUSES = new Set([
  "draft",
  "question_paper_uploaded",
  "question_paper_extracted",
  "published",
]);
const ALLOWED_DATA_FIELDS = new Set([
  "title",
  "subject",
  "topics",
  "classIds",
  "sectionIds",
  "examDate",
  "duration",
  "totalMarks",
  "passingMarks",
  "academicSessionId",
  "gradingConfig",
  "evaluationSettingsId",
  "linkedSpaceId",
  "linkedSpaceTitle",
  "linkedStoryPointId",
]);
/**
 * Fields that change the grading contract (totals, rubric config, evaluation
 * settings). Once an exam is published, these are frozen so scores already
 * captured remain meaningful. Non-grading fields (title, subject, classIds,
 * sectionIds, schedule, linked space) remain editable.
 */
const POST_PUBLISH_LOCKED_FIELDS = new Set([
  "totalMarks",
  "passingMarks",
  "gradingConfig",
  "evaluationSettingsId",
]);
const GRADING_CONFIG_ALLOWED = new Set([
  "autoGrade",
  "allowRubricEdit",
  "evaluationSettingsId",
  "allowManualOverride",
  "requireOverrideReason",
  "releaseResultsAutomatically",
]);
exports.saveExam = (0, https_1.onCall)(
  { region: "asia-south1", memory: "512MiB", timeoutSeconds: 300, cors: true },
  async (request) => {
    const caller = (0, assertions_1.getCallerMembership)(request);
    const { id, tenantId, data } = (0, utils_1.parseRequest)(
      request.data,
      shared_types_1.SaveExamRequestSchema
    );
    if (!tenantId) {
      throw new https_1.HttpsError("invalid-argument", "Missing required field: tenantId.");
    }
    await (0, rate_limit_1.enforceRateLimit)(tenantId, caller.uid, "write", 30);
    const db = admin.firestore();
    const now = firestore_1.FieldValue.serverTimestamp();
    // ── CREATE ──────────────────────────────────────────────────────────
    if (!id) {
      (0, assertions_1.assertAutogradePermission)(caller, tenantId, "canCreateExams");
      if (!data.title || !data.subject || !data.classIds?.length) {
        throw new https_1.HttpsError(
          "invalid-argument",
          "Missing required fields: title, subject, classIds."
        );
      }
      const examRef = db.collection(`tenants/${tenantId}/exams`).doc();
      const hasQuestionPaper = data.questionPaperImages && data.questionPaperImages.length > 0;
      await examRef.set({
        id: examRef.id,
        tenantId,
        title: data.title,
        subject: data.subject,
        topics: data.topics ?? [],
        classIds: data.classIds,
        sectionIds: data.sectionIds ?? [],
        examDate: data.examDate ? firestore_1.Timestamp.fromDate(new Date(data.examDate)) : null,
        duration: data.duration ?? 0,
        totalMarks: data.totalMarks ?? 0,
        passingMarks: data.passingMarks ?? 0,
        academicSessionId: data.academicSessionId ?? null,
        gradingConfig: {
          autoGrade: data.gradingConfig?.autoGrade ?? true,
          allowRubricEdit: data.gradingConfig?.allowRubricEdit ?? true,
          allowManualOverride: data.gradingConfig?.allowManualOverride ?? true,
          requireOverrideReason: data.gradingConfig?.requireOverrideReason ?? true,
          releaseResultsAutomatically: data.gradingConfig?.releaseResultsAutomatically ?? false,
          evaluationSettingsId: data.gradingConfig?.evaluationSettingsId ?? null,
        },
        questionPaper: hasQuestionPaper
          ? {
              images: data.questionPaperImages,
              uploadedAt: now,
            }
          : null,
        linkedSpaceId: data.linkedSpaceId ?? null,
        linkedSpaceTitle: data.linkedSpaceTitle ?? null,
        linkedStoryPointId: data.linkedStoryPointId ?? null,
        evaluationSettingsId: data.evaluationSettingsId ?? null,
        status: hasQuestionPaper ? "question_paper_uploaded" : "draft",
        stats: {
          totalSubmissions: 0,
          gradedSubmissions: 0,
          avgScore: 0,
          passRate: 0,
        },
        createdBy: caller.uid,
        createdAt: now,
        updatedAt: now,
      });
      // Increment usage counter for exams this month
      await db.doc(`tenants/${tenantId}`).update({
        "usage.examsThisMonth": firestore_1.FieldValue.increment(1),
        "usage.lastUpdated": firestore_1.FieldValue.serverTimestamp(),
      });
      return { id: examRef.id, created: true };
    }
    // ── UPDATE (id present) ────────────────────────────────────────────
    const exam = await (0, firestore_helpers_1.getExam)(tenantId, id);
    if (!exam) {
      throw new https_1.HttpsError("not-found", `Exam ${id} not found.`);
    }
    const requestedStatus = data.status;
    // ── Status transition: published ────────────────────────────────
    if (requestedStatus === "published") {
      (0, assertions_1.assertAutogradePermission)(caller, tenantId, "canCreateExams");
      if (exam.status !== "question_paper_extracted") {
        throw new https_1.HttpsError(
          "failed-precondition",
          `Exam must be in 'question_paper_extracted' status to publish. Current: '${exam.status}'.`
        );
      }
      // Verify questions exist
      const questions = await (0, firestore_helpers_1.getExamQuestions)(tenantId, id);
      if (questions.length === 0) {
        throw new https_1.HttpsError(
          "failed-precondition",
          "Cannot publish exam with no questions."
        );
      }
      // Validate rubrics — each question must have criteria summing to maxMarks
      for (const q of questions) {
        if (!q.rubric?.criteria?.length) {
          throw new https_1.HttpsError(
            "failed-precondition",
            `Question ${q.id} has no rubric criteria.`
          );
        }
        const criteriaSum = q.rubric.criteria.reduce((sum, c) => sum + c.maxPoints, 0);
        if (criteriaSum !== q.maxMarks) {
          throw new https_1.HttpsError(
            "failed-precondition",
            `Question ${q.id}: rubric criteria sum (${criteriaSum}) != maxMarks (${q.maxMarks}).`
          );
        }
      }
      await db.doc(`tenants/${tenantId}/exams/${id}`).update({
        status: "published",
        updatedAt: now,
      });
      return { id, created: false };
    }
    // ── Status transition: results_released ─────────────────────────
    if (requestedStatus === "results_released") {
      (0, assertions_1.assertAutogradePermission)(caller, tenantId, "canReleaseResults");
      const validStatuses = ["grading", "completed", "grading_complete", "results_released"];
      if (!validStatuses.includes(exam.status)) {
        throw new https_1.HttpsError(
          "failed-precondition",
          `Cannot release results for exam in '${exam.status}' status.`
        );
      }
      // Query submissions to release
      let query = db
        .collection(`tenants/${tenantId}/submissions`)
        .where("examId", "==", id)
        .where("resultsReleased", "==", false);
      // Use classIds from data to optionally filter
      if (data.classIds?.length) {
        query = query.where("classId", "in", data.classIds);
      }
      const snap = await query.get();
      let releasedCount = 0;
      if (!snap.empty) {
        const batchSize = 450;
        let batch = db.batch();
        let batchCount = 0;
        for (const doc of snap.docs) {
          const subData = doc.data();
          const releasableStatuses = ["grading_complete", "ready_for_review", "reviewed"];
          if (!releasableStatuses.includes(subData.pipelineStatus)) continue;
          batch.update(doc.ref, {
            resultsReleased: true,
            resultsReleasedAt: now,
            resultsReleasedBy: caller.uid,
            updatedAt: now,
          });
          releasedCount++;
          batchCount++;
          if (batchCount >= batchSize) {
            await batch.commit();
            batch = db.batch();
            batchCount = 0;
          }
        }
        if (batchCount > 0) {
          await batch.commit();
        }
      }
      // Update exam status
      await db.doc(`tenants/${tenantId}/exams/${id}`).update({
        status: "results_released",
        updatedAt: now,
      });
      // Send notifications to students and parents
      try {
        const { sendBulkNotifications } = await Promise.resolve().then(() =>
          __importStar(require("../utils/notification-sender"))
        );
        const studentUids = new Set();
        for (const doc of snap.docs) {
          const subData = doc.data();
          if (subData.studentUid) studentUids.add(subData.studentUid);
        }
        if (studentUids.size > 0) {
          await sendBulkNotifications(Array.from(studentUids), {
            tenantId,
            recipientRole: "student",
            type: "exam_results_released",
            title: "Exam Results Released",
            body: `Results for "${exam.title ?? "your exam"}" are now available.`,
            entityType: "exam",
            entityId: id,
            actionUrl: `/results`,
          });
        }
      } catch (err) {
        // Non-blocking: log but don't fail the release
        console.warn("Failed to send result release notifications:", err);
      }
      return { id, created: false };
    }
    // ── Generic status transition (other statuses) ──────────────────
    if (requestedStatus && requestedStatus !== exam.status) {
      (0, assertions_1.assertAutogradePermission)(caller, tenantId, "canCreateExams");
      const allowed = VALID_STATUS_TRANSITIONS[exam.status];
      if (!allowed || !allowed.includes(requestedStatus)) {
        throw new https_1.HttpsError(
          "failed-precondition",
          `Invalid status transition: '${exam.status}' → '${requestedStatus}'.`,
          {
            currentStatus: exam.status,
            requestedStatus,
            allowedTransitions: allowed ?? [],
          }
        );
      }
      await db.doc(`tenants/${tenantId}/exams/${id}`).update({
        status: requestedStatus,
        updatedAt: now,
      });
      return { id, created: false };
    }
    // ── Field updates (no status change) ────────────────────────────
    (0, assertions_1.assertAutogradePermission)(caller, tenantId, "canCreateExams");
    if (!UPDATABLE_STATUSES.has(exam.status)) {
      throw new https_1.HttpsError(
        "failed-precondition",
        `Cannot update exam in '${exam.status}' status.`
      );
    }
    const isPostPublish = exam.status === "published";
    // Filter to allowed fields only
    const filtered = {};
    for (const [key, value] of Object.entries(data)) {
      if (key === "status") continue; // handled above
      if (!ALLOWED_DATA_FIELDS.has(key)) continue;
      if (isPostPublish && POST_PUBLISH_LOCKED_FIELDS.has(key)) {
        throw new https_1.HttpsError(
          "failed-precondition",
          `Field '${key}' cannot be changed after the exam is published.`
        );
      }
      if (key === "gradingConfig") {
        if (typeof value !== "object" || value === null || Array.isArray(value)) {
          throw new https_1.HttpsError("invalid-argument", "gradingConfig must be a plain object.");
        }
        const sanitized = {};
        for (const [gk, gv] of Object.entries(value)) {
          if (GRADING_CONFIG_ALLOWED.has(gk)) {
            sanitized[gk] = gv;
          }
        }
        filtered[key] = sanitized;
      } else if (key === "examDate" && typeof value === "string") {
        filtered[key] = firestore_1.Timestamp.fromDate(new Date(value));
      } else {
        filtered[key] = value;
      }
    }
    if (Object.keys(filtered).length === 0) {
      throw new https_1.HttpsError("invalid-argument", "No valid fields to update.");
    }
    filtered.updatedAt = now;
    await db.doc(`tenants/${tenantId}/exams/${id}`).update(filtered);
    return { id, created: false };
  }
);
//# sourceMappingURL=save-exam.js.map
