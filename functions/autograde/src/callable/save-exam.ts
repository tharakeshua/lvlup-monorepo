/**
 * saveExam — Consolidated endpoint replacing:
 *   createExam, updateExam, publishExam, releaseExamResults, linkExamToSpace
 *
 * - No `id` in request → create new exam
 * - `id` present → update existing exam (including status transitions)
 * - Status transitions validated server-side using ExamStatus from shared-types
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { SaveExamRequest, SaveResponse } from "@levelup/shared-types";
import type { ExamStatus } from "@levelup/shared-types";
import { SaveExamRequestSchema } from "@levelup/shared-types";
import { getCallerMembership, assertAutogradePermission } from "../utils/assertions";
import { getExam, getExamQuestions } from "../utils/firestore-helpers";
import { parseRequest } from "../utils";
import { enforceRateLimit } from "../utils/rate-limit";

/** Valid transitions from each status. */
const VALID_STATUS_TRANSITIONS: Record<string, ExamStatus[]> = {
  draft: ["question_paper_uploaded"],
  question_paper_uploaded: ["question_paper_extracted"],
  question_paper_extracted: ["published"],
  published: ["grading"],
  grading: ["completed"],
  completed: ["results_released"],
  results_released: ["archived"],
};

/** Statuses that allow field updates (non-status changes). */
const UPDATABLE_STATUSES = new Set<string>([
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

export const saveExam = onCall(
  { region: "asia-south1", memory: "512MiB", timeoutSeconds: 300, cors: true },
  async (request): Promise<SaveResponse> => {
    const caller = getCallerMembership(request);
    const { id, tenantId, data } = parseRequest(request.data, SaveExamRequestSchema);

    if (!tenantId) {
      throw new HttpsError("invalid-argument", "Missing required field: tenantId.");
    }

    await enforceRateLimit(tenantId, caller.uid, "write", 30);

    const db = admin.firestore();
    const now = FieldValue.serverTimestamp();

    // ── CREATE ──────────────────────────────────────────────────────────
    if (!id) {
      assertAutogradePermission(caller, tenantId, "canCreateExams");

      if (!data.title || !data.subject || !data.classIds?.length) {
        throw new HttpsError(
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
        examDate: data.examDate ? Timestamp.fromDate(new Date(data.examDate)) : null,
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
        status: (hasQuestionPaper ? "question_paper_uploaded" : "draft") as ExamStatus,
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
        "usage.examsThisMonth": FieldValue.increment(1),
        "usage.lastUpdated": FieldValue.serverTimestamp(),
      });

      return { id: examRef.id, created: true };
    }

    // ── UPDATE (id present) ────────────────────────────────────────────
    const exam = await getExam(tenantId, id);
    if (!exam) {
      throw new HttpsError("not-found", `Exam ${id} not found.`);
    }

    const requestedStatus = data.status;

    // ── Status transition: published ────────────────────────────────
    if (requestedStatus === "published") {
      assertAutogradePermission(caller, tenantId, "canCreateExams");

      if (exam.status !== "question_paper_extracted") {
        throw new HttpsError(
          "failed-precondition",
          `Exam must be in 'question_paper_extracted' status to publish. Current: '${exam.status}'.`
        );
      }

      // Verify questions exist
      const questions = await getExamQuestions(tenantId, id);
      if (questions.length === 0) {
        throw new HttpsError("failed-precondition", "Cannot publish exam with no questions.");
      }

      // Validate rubrics — each question must have criteria summing to maxMarks
      for (const q of questions) {
        if (!q.rubric?.criteria?.length) {
          throw new HttpsError("failed-precondition", `Question ${q.id} has no rubric criteria.`);
        }
        const criteriaSum = q.rubric.criteria.reduce(
          (sum: number, c: { maxPoints: number }) => sum + c.maxPoints,
          0
        );
        if (criteriaSum !== q.maxMarks) {
          throw new HttpsError(
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
      assertAutogradePermission(caller, tenantId, "canReleaseResults");

      const validStatuses = ["grading", "completed", "grading_complete", "results_released"];
      if (!validStatuses.includes(exam.status)) {
        throw new HttpsError(
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
        const { sendBulkNotifications } = await import("../utils/notification-sender");
        const studentUids = new Set<string>();
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
      assertAutogradePermission(caller, tenantId, "canCreateExams");

      const allowed = VALID_STATUS_TRANSITIONS[exam.status];
      if (!allowed || !allowed.includes(requestedStatus)) {
        throw new HttpsError(
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
    assertAutogradePermission(caller, tenantId, "canCreateExams");

    if (!UPDATABLE_STATUSES.has(exam.status)) {
      throw new HttpsError("failed-precondition", `Cannot update exam in '${exam.status}' status.`);
    }

    const isPostPublish = exam.status === "published";

    // Filter to allowed fields only
    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (key === "status") continue; // handled above
      if (!ALLOWED_DATA_FIELDS.has(key)) continue;
      if (isPostPublish && POST_PUBLISH_LOCKED_FIELDS.has(key)) {
        throw new HttpsError(
          "failed-precondition",
          `Field '${key}' cannot be changed after the exam is published.`
        );
      }

      if (key === "gradingConfig") {
        if (typeof value !== "object" || value === null || Array.isArray(value)) {
          throw new HttpsError("invalid-argument", "gradingConfig must be a plain object.");
        }
        const sanitized: Record<string, unknown> = {};
        for (const [gk, gv] of Object.entries(value as Record<string, unknown>)) {
          if (GRADING_CONFIG_ALLOWED.has(gk)) {
            sanitized[gk] = gv;
          }
        }
        filtered[key] = sanitized;
      } else if (key === "examDate" && typeof value === "string") {
        filtered[key] = Timestamp.fromDate(new Date(value));
      } else {
        filtered[key] = value;
      }
    }

    if (Object.keys(filtered).length === 0) {
      throw new HttpsError("invalid-argument", "No valid fields to update.");
    }

    filtered.updatedAt = now;

    await db.doc(`tenants/${tenantId}/exams/${id}`).update(filtered);

    return { id, created: false };
  }
);
