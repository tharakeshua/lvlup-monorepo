/**
 * gradeQuestion — Consolidated endpoint replacing:
 *   manualGradeQuestion, retryFailedQuestions
 *
 * - mode: 'manual' → grade a single question with manual override
 * - mode: 'retry'  → retry failed AI grading for a submission
 * - mode: 'ai'     → run AI grading synchronously on a single question
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import type {
  GradeQuestionRequest,
  GradeQuestionResponse,
  QuestionSubmission,
} from "@levelup/shared-types";
import { GradeQuestionRequestSchema } from "@levelup/shared-types";
import { getCallerMembership, assertAutogradePermission } from "../utils/assertions";
import {
  getSubmission,
  getQuestionSubmissions,
  getExamQuestions,
} from "../utils/firestore-helpers";
import { calculateSubmissionSummary } from "../utils/grading-helpers";
import { processAnswerGrading } from "../pipeline/process-answer-grading";
import { parseRequest } from "../utils";
import { enforceRateLimit } from "../utils/rate-limit";

export const gradeQuestion = onCall(
  { region: "asia-south1", memory: "4GiB", timeoutSeconds: 540, cors: true },
  async (request): Promise<GradeQuestionResponse> => {
    const caller = getCallerMembership(request);
    const data = parseRequest(request.data, GradeQuestionRequestSchema);

    if (!data.tenantId || !data.mode) {
      throw new HttpsError("invalid-argument", "Missing required fields: tenantId, mode.");
    }

    assertAutogradePermission(caller, data.tenantId, "canGradeSubmissions");

    await enforceRateLimit(data.tenantId, caller.uid, "ai", 10);

    if (data.mode === "manual") {
      return handleManualGrade(caller, data);
    }

    if (data.mode === "retry") {
      return handleRetry(caller, data);
    }

    if (data.mode === "ai") {
      return handleAiGrade(data);
    }

    throw new HttpsError(
      "invalid-argument",
      `Invalid mode: '${data.mode}'. Must be 'manual', 'retry', or 'ai'.`
    );
  }
);

// ── Manual grading ────────────────────────────────────────────────────────

async function handleManualGrade(
  caller: { uid: string },
  data: GradeQuestionRequest
): Promise<GradeQuestionResponse> {
  if (!data.submissionId || !data.questionId || data.score === undefined) {
    throw new HttpsError(
      "invalid-argument",
      "Manual mode requires: submissionId, questionId, score."
    );
  }

  if (!data.feedback || data.feedback.trim().length === 0) {
    throw new HttpsError("invalid-argument", "Override reason/feedback is required.");
  }

  const submission = await getSubmission(data.tenantId, data.submissionId);
  if (!submission) {
    throw new HttpsError("not-found", `Submission ${data.submissionId} not found.`);
  }

  // Load the exam question to validate score
  const questions = await getExamQuestions(data.tenantId, submission.examId);
  const question = questions.find((q) => q.id === data.questionId);
  if (!question) {
    throw new HttpsError("not-found", `Question ${data.questionId} not found.`);
  }

  if (data.score < 0 || data.score > question.maxMarks) {
    throw new HttpsError("invalid-argument", `Score must be between 0 and ${question.maxMarks}.`);
  }

  const db = admin.firestore();
  const qsRef = db.doc(
    `tenants/${data.tenantId}/submissions/${data.submissionId}/questionSubmissions/${data.questionId}`
  );
  const qsDoc = await qsRef.get();
  const now = admin.firestore.FieldValue.serverTimestamp();

  if (!qsDoc.exists) {
    // Create a new question submission for manual grading
    await qsRef.set({
      id: data.questionId,
      submissionId: data.submissionId,
      questionId: data.questionId,
      examId: submission.examId,
      mapping: { pageIndices: [], imageUrls: [], scoutedAt: now },
      gradingStatus: "manual",
      gradingRetryCount: 0,
      manualOverride: {
        score: data.score,
        reason: data.feedback.trim(),
        overriddenBy: caller.uid,
        overriddenAt: now,
        originalScore: 0,
      },
      createdAt: now,
      updatedAt: now,
    });
  } else {
    const existing = qsDoc.data()!;
    const originalScore = existing.evaluation?.score ?? existing.manualOverride?.score ?? 0;
    const newStatus = existing.gradingStatus === "graded" ? "overridden" : "manual";

    await qsRef.update({
      gradingStatus: newStatus,
      manualOverride: {
        score: data.score,
        reason: data.feedback.trim(),
        overriddenBy: caller.uid,
        overriddenAt: now,
        originalScore,
      },
      updatedAt: now,
    });
  }

  // Recalculate submission summary in a transaction
  const totalQuestions = questions.length;
  await db.runTransaction(async (txn) => {
    const allQsSnap = await txn.get(
      db.collection(`tenants/${data.tenantId}/submissions/${data.submissionId}/questionSubmissions`)
    );
    const allQs = allQsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as QuestionSubmission);
    const summary = calculateSubmissionSummary(allQs, totalQuestions);

    const allGraded = summary.questionsGraded === totalQuestions;
    const newPipelineStatus = allGraded ? "grading_complete" : submission.pipelineStatus;

    txn.update(db.doc(`tenants/${data.tenantId}/submissions/${data.submissionId}`), {
      summary: { ...summary, completedAt: allGraded ? now : null },
      pipelineStatus: newPipelineStatus,
      updatedAt: now,
    });
  });

  // Increment AI usage counter for manual grading that involved AI evaluation
  const aiDb = admin.firestore();
  await aiDb.doc(`tenants/${data.tenantId}`).update({
    "usage.aiCallsThisMonth": admin.firestore.FieldValue.increment(1),
    "usage.lastUpdated": admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true, updatedScore: data.score };
}

// ── Retry failed questions ────────────────────────────────────────────────

async function handleRetry(
  caller: { uid: string },
  data: GradeQuestionRequest
): Promise<GradeQuestionResponse> {
  if (!data.submissionId) {
    throw new HttpsError("invalid-argument", "Retry mode requires: submissionId.");
  }

  const submission = await getSubmission(data.tenantId, data.submissionId);
  if (!submission) {
    throw new HttpsError("not-found", `Submission ${data.submissionId} not found.`);
  }

  if (submission.pipelineStatus !== "grading_partial") {
    throw new HttpsError(
      "failed-precondition",
      `Submission must be in 'grading_partial' status. Current: '${submission.pipelineStatus}'.`
    );
  }

  const questionSubs = await getQuestionSubmissions(data.tenantId, data.submissionId);
  const failedQs = questionSubs.filter((qs) => {
    if (qs.gradingStatus !== "failed") return false;
    if (data.questionIds?.length) return data.questionIds.includes(qs.questionId);
    return true;
  });

  if (failedQs.length === 0) {
    throw new HttpsError("not-found", "No failed questions found to retry.");
  }

  const db = admin.firestore();
  const batch = db.batch();
  const now = admin.firestore.FieldValue.serverTimestamp();

  // Reset failed questions to pending
  for (const qs of failedQs) {
    const qsRef = db.doc(
      `tenants/${data.tenantId}/submissions/${data.submissionId}/questionSubmissions/${qs.id}`
    );
    batch.update(qsRef, {
      gradingStatus: "pending",
      gradingError: admin.firestore.FieldValue.delete(),
      updatedAt: now,
    });
  }

  // Update submission pipeline status to grading
  const subRef = db.doc(`tenants/${data.tenantId}/submissions/${data.submissionId}`);
  batch.update(subRef, {
    pipelineStatus: "grading",
    updatedAt: now,
  });

  await batch.commit();

  return {
    success: true,
    retriedCount: failedQs.length,
  };
}

// ── AI grade a single question ────────────────────────────────────────────

async function handleAiGrade(data: GradeQuestionRequest): Promise<GradeQuestionResponse> {
  if (!data.submissionId || !data.questionId) {
    throw new HttpsError("invalid-argument", "AI mode requires: submissionId, questionId.");
  }

  const submission = await getSubmission(data.tenantId, data.submissionId);
  if (!submission) {
    throw new HttpsError("not-found", `Submission ${data.submissionId} not found.`);
  }

  const db = admin.firestore();
  const qsRef = db.doc(
    `tenants/${data.tenantId}/submissions/${data.submissionId}/questionSubmissions/${data.questionId}`
  );
  const qsDoc = await qsRef.get();
  if (!qsDoc.exists) {
    throw new HttpsError(
      "not-found",
      `Question submission ${data.questionId} not found. Wait for scouting to complete.`
    );
  }

  const qs = qsDoc.data() as QuestionSubmission;
  if (!qs.mapping?.imageUrls?.length) {
    throw new HttpsError(
      "failed-precondition",
      "No answer-sheet pages mapped to this question. Cannot grade — re-run scouting first."
    );
  }

  const now = admin.firestore.FieldValue.serverTimestamp();

  // Reset to pending so processAnswerGrading picks it up; clear stale errors.
  await qsRef.update({
    gradingStatus: "pending",
    gradingRetryCount: 0,
    gradingError: admin.firestore.FieldValue.delete(),
    updatedAt: now,
  });

  // Set submission to grading; the trigger may fire but processAnswerGrading
  // is idempotent because it filters to gradingStatus === 'pending'.
  await db.doc(`tenants/${data.tenantId}/submissions/${data.submissionId}`).update({
    pipelineStatus: "grading",
    updatedAt: now,
  });

  // Run grading inline so the caller gets the result synchronously.
  await processAnswerGrading(data.tenantId, data.submissionId);

  const updated = await qsRef.get();
  const updatedQs = updated.data() as QuestionSubmission | undefined;

  return {
    success: true,
    updatedScore: updatedQs?.evaluation?.score,
    gradingStatus: updatedQs?.gradingStatus,
  };
}
