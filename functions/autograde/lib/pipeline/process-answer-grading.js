"use strict";
/**
 * processAnswerGrading — RELMS per-question grading pipeline worker.
 *
 * Grades each pending QuestionSubmission using Gemini with the RELMS prompt.
 * Resolves the rubric chain and builds dynamic prompts per question.
 * Includes quota checks, per-batch progress updates, and graceful degradation.
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
exports.processAnswerGrading = processAnswerGrading;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const firestore_helpers_1 = require("../utils/firestore-helpers");
const grading_helpers_1 = require("../utils/grading-helpers");
const llm_1 = require("../utils/llm");
const relms_1 = require("../prompts/relms");
const grading_queue_1 = require("../utils/grading-queue");
const MAX_QUESTION_RETRIES = 3;
const GRADING_BATCH_SIZE = 5;
const CONFIDENCE_REVIEW_THRESHOLD = 0.7;
const CONFIDENCE_AUTO_APPROVE_THRESHOLD = 0.9;
/**
 * Maps raw error strings to user-friendly messages for display in the teacher UI.
 */
function formatGradingError(rawError) {
  const lower = rawError.toLowerCase();
  if (lower.includes("quota") || lower.includes("budget"))
    return "AI usage quota exceeded for this month. Please contact your administrator to increase the limit, or grade this question manually.";
  if (lower.includes("circuit") || lower.includes("temporarily"))
    return "The AI grading service is temporarily unavailable due to repeated errors. It will recover automatically — please retry in a few minutes.";
  if (lower.includes("rate limit"))
    return "Too many grading requests sent in a short period. Please wait a moment and retry.";
  if (lower.includes("timeout"))
    return "The AI took too long to respond. This can happen with complex answers. Please retry.";
  if (lower.includes("invalid") && lower.includes("response"))
    return "The AI returned an unexpected response format. This question needs manual grading or a retry.";
  if (lower.includes("not found")) return rawError; // Already descriptive
  if (lower.includes("blank") || lower.includes("empty"))
    return "No answer content detected for this question. The answer sheet may be blank.";
  return `AI grading error: ${rawError}`;
}
async function processAnswerGrading(tenantId, submissionId) {
  const db = admin.firestore();
  const now = firestore_1.FieldValue.serverTimestamp();
  // Check usage quota before starting grading
  try {
    // Dynamic import to avoid circular deps — usage-quota is in shared-services
    const { checkUsageQuota } = await Promise.resolve().then(() =>
      __importStar(require("@levelup/shared-services/ai"))
    );
    const quotaResult = await checkUsageQuota(tenantId);
    if (!quotaResult.allowed) {
      console.warn(
        `[processAnswerGrading] Quota exceeded for tenant ${tenantId}: ${quotaResult.warningMessage}`
      );
      await db.doc(`tenants/${tenantId}/submissions/${submissionId}`).update({
        pipelineStatus: "manual_review_needed",
        pipelineError: quotaResult.warningMessage ?? "AI usage quota exceeded.",
        updatedAt: now,
      });
      return;
    }
    if (quotaResult.warningMessage) {
      console.warn(
        `[processAnswerGrading] Quota warning for tenant ${tenantId}: ${quotaResult.warningMessage}`
      );
    }
  } catch (quotaErr) {
    // Don't block grading on quota check failure — log and continue
    console.warn("[processAnswerGrading] Quota check failed, proceeding:", quotaErr);
  }
  const submission = await (0, firestore_helpers_1.getSubmission)(tenantId, submissionId);
  if (!submission) throw new Error(`Submission ${submissionId} not found.`);
  const exam = await (0, firestore_helpers_1.getExam)(tenantId, submission.examId);
  if (!exam) throw new Error(`Exam ${submission.examId} not found.`);
  const questions = await (0, firestore_helpers_1.getExamQuestions)(tenantId, submission.examId);
  const questionMap = new Map(questions.map((q) => [q.id, q]));
  const questionSubs = await (0, firestore_helpers_1.getQuestionSubmissions)(
    tenantId,
    submissionId
  );
  const pendingQs = questionSubs.filter((qs) => qs.gradingStatus === "pending");
  if (pendingQs.length === 0) {
    console.log(`No pending questions for ${submissionId}. Skipping grading.`);
    return;
  }
  // Load evaluation settings
  let examEvalSettings = null;
  let tenantDefaultSettings = null;
  if (exam.gradingConfig.evaluationSettingsId) {
    examEvalSettings = await (0, firestore_helpers_1.getEvaluationSettings)(
      tenantId,
      exam.gradingConfig.evaluationSettingsId
    );
  }
  // Load tenant defaults
  const tenantDoc = await db.doc(`tenants/${tenantId}`).get();
  const tenantData = tenantDoc.data();
  if (tenantData?.settings?.defaultEvaluationSettingsId) {
    tenantDefaultSettings = await (0, firestore_helpers_1.getEvaluationSettings)(
      tenantId,
      tenantData.settings.defaultEvaluationSettingsId
    );
  }
  // Initialize LLM
  const apiKey = await (0, llm_1.getGeminiApiKey)(tenantId);
  const llm = new llm_1.LLMWrapper({
    provider: "gemini",
    apiKey,
    defaultModel: "gemini-2.5-flash",
    enableLogging: true,
  });
  const bucket = admin.storage().bucket();
  // Load evaluation confidence thresholds from tenant settings
  const tenantSettings = tenantData?.settings;
  const confidenceThreshold = tenantSettings?.confidenceThreshold ?? CONFIDENCE_REVIEW_THRESHOLD;
  const autoApproveThreshold =
    tenantSettings?.autoApproveThreshold ?? CONFIDENCE_AUTO_APPROVE_THRESHOLD;
  // Grade questions in batches using Promise.allSettled for concurrency
  await (0, grading_queue_1.processBatch)(
    pendingQs,
    async (qs) => {
      const question = questionMap.get(qs.questionId);
      if (!question) {
        console.warn(`Question ${qs.questionId} not found. Marking as failed.`);
        await markQuestionFailed(db, tenantId, submissionId, qs.id, "Question not found in exam.");
        return;
      }
      try {
        await gradeQuestion(
          db,
          bucket,
          llm,
          tenantId,
          submissionId,
          qs,
          question,
          examEvalSettings,
          tenantDefaultSettings,
          confidenceThreshold,
          autoApproveThreshold
        );
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const friendlyError = formatGradingError(errorMsg);
        console.error(`Failed to grade Q${qs.questionId} for ${submissionId}:`, errorMsg);
        const retryCount = (qs.gradingRetryCount ?? 0) + 1;
        if (retryCount >= MAX_QUESTION_RETRIES) {
          // Graceful degradation: mark as needs_review when circuit breaker or quota errors,
          // so teachers can manually grade instead of treating as a hard failure
          const isServiceIssue =
            errorMsg.includes("circuit") ||
            errorMsg.includes("quota") ||
            errorMsg.includes("temporarily") ||
            errorMsg.includes("rate limit");
          if (isServiceIssue) {
            await markQuestionNeedsReview(db, tenantId, submissionId, qs.id, friendlyError);
          } else {
            await markQuestionFailed(db, tenantId, submissionId, qs.id, friendlyError);
          }
          // Create DLQ entry
          const dlqRef = db.collection(`tenants/${tenantId}/gradingDeadLetter`).doc();
          await dlqRef.set({
            id: dlqRef.id,
            submissionId,
            questionSubmissionId: qs.id,
            pipelineStep: "grading",
            error: errorMsg,
            attempts: retryCount,
            lastAttemptAt: now,
            createdAt: now,
          });
        } else {
          // Mark for retry
          const qsRef = db.doc(
            `tenants/${tenantId}/submissions/${submissionId}/questionSubmissions/${qs.id}`
          );
          await qsRef.update({
            gradingStatus: "pending",
            gradingRetryCount: retryCount,
            gradingError: friendlyError,
            updatedAt: now,
          });
        }
      }
    },
    { batchSize: GRADING_BATCH_SIZE },
    async (batchNum, totalBatches) => {
      console.log(
        `[processAnswerGrading] Batch ${batchNum}/${totalBatches} complete for ${submissionId}`
      );
      // Write per-batch progress to Firestore for real-time UI updates
      const subRef = db.doc(`tenants/${tenantId}/submissions/${submissionId}`);
      await subRef
        .update({
          "gradingProgress.batchesCompleted": batchNum,
          "gradingProgress.totalBatches": totalBatches,
          "gradingProgress.percentComplete": Math.round((batchNum / totalBatches) * 100),
          "gradingProgress.updatedAt": firestore_1.FieldValue.serverTimestamp(),
        })
        .catch((err) => {
          console.warn("[processAnswerGrading] Failed to update batch progress:", err);
        });
    }
  );
  // After all questions processed, determine final status using a transaction
  // to avoid race conditions with onQuestionSubmissionUpdated triggers
  await db.runTransaction(async (txn) => {
    const allQsSnap = await txn.get(
      db.collection(`tenants/${tenantId}/submissions/${submissionId}/questionSubmissions`)
    );
    let gradedCount = 0;
    let failedCount = 0;
    let pendingCount = 0;
    let needsReviewCount = 0;
    let totalGradingCostUsd = 0;
    for (const doc of allQsSnap.docs) {
      const qs = doc.data();
      switch (qs.gradingStatus) {
        case "graded":
        case "manual":
        case "overridden":
          gradedCount++;
          break;
        case "needs_review":
          needsReviewCount++;
          gradedCount++; // Count as graded for pipeline progress
          break;
        case "failed":
          failedCount++;
          break;
        default:
          pendingCount++;
          break;
      }
      // Accumulate cost from graded questions
      if (qs.evaluation?.costUsd) {
        totalGradingCostUsd += qs.evaluation.costUsd;
      }
    }
    if (pendingCount > 0) return; // Still processing
    const subRef = db.doc(`tenants/${tenantId}/submissions/${submissionId}`);
    const totalQuestions = allQsSnap.size;
    if (failedCount > 0 && gradedCount > 0) {
      txn.update(subRef, {
        pipelineStatus: "grading_partial",
        "summary.questionsGraded": gradedCount,
        "summary.totalQuestions": totalQuestions,
        "summary.needsReviewCount": needsReviewCount,
        updatedAt: now,
      });
    } else if (failedCount > 0 && gradedCount === 0) {
      txn.update(subRef, {
        pipelineStatus: "manual_review_needed",
        updatedAt: now,
      });
    } else if (gradedCount === totalQuestions) {
      txn.update(subRef, {
        pipelineStatus: "grading_complete",
        "summary.needsReviewCount": needsReviewCount,
        updatedAt: now,
      });
    }
    // Increment per-exam total grading cost (Task 4.2)
    if (totalGradingCostUsd > 0) {
      const examId = (await txn.get(subRef)).data()?.examId;
      if (examId) {
        const examRef = db.doc(`tenants/${tenantId}/exams/${examId}`);
        txn.update(examRef, {
          "stats.totalGradingCostUsd": firestore_1.FieldValue.increment(totalGradingCostUsd),
          updatedAt: now,
        });
      }
    }
  });
}
async function gradeQuestion(
  db,
  bucket,
  llm,
  tenantId,
  submissionId,
  qs,
  question,
  examEvalSettings,
  tenantDefaultSettings,
  confidenceThreshold = CONFIDENCE_REVIEW_THRESHOLD,
  autoApproveThreshold = CONFIDENCE_AUTO_APPROVE_THRESHOLD
) {
  const now = firestore_1.FieldValue.serverTimestamp();
  const qsRef = db.doc(
    `tenants/${tenantId}/submissions/${submissionId}/questionSubmissions/${qs.id}`
  );
  // Mark as processing
  await qsRef.update({ gradingStatus: "processing", updatedAt: now });
  // Resolve rubric chain
  const { rubric, dimensions } = (0, grading_helpers_1.resolveRubric)(
    question,
    examEvalSettings,
    tenantDefaultSettings
  );
  // Download answer images (with timing)
  const imageDownloadStart = Date.now();
  const images = [];
  for (const imagePath of qs.mapping.imageUrls) {
    const file = bucket.file(imagePath);
    const [buffer] = await file.download();
    const [metadata] = await file.getMetadata();
    images.push({
      base64: buffer.toString("base64"),
      mimeType: metadata.contentType || "image/jpeg",
    });
  }
  const imageDownloadMs = Date.now() - imageDownloadStart;
  if (images.length === 0) {
    // No answer images — score 0
    await qsRef.update({
      gradingStatus: "graded",
      evaluation: {
        score: 0,
        maxScore: question.maxMarks,
        correctness: 0,
        percentage: 0,
        strengths: [],
        weaknesses: ["No answer found for this question."],
        missingConcepts: [],
        confidence: 1,
        mistakeClassification: "None",
        gradedAt: now,
      },
      updatedAt: now,
    });
    return;
  }
  // Build RELMS prompt
  const userPrompt = (0, relms_1.buildRELMSUserPrompt)(question, rubric, dimensions);
  const llmCallStart = Date.now();
  const result = await llm.call(
    userPrompt,
    {
      clientId: tenantId,
      userId: "system",
      userRole: "system",
      purpose: "answer_grading",
      operation: "relmsEvaluation",
      resourceType: "questionSubmission",
      resourceId: `${submissionId}/${qs.questionId}`,
      temperature: 0.1,
      // Gemini 2.5 thinking tokens count against this. Rubric breakdown +
      // structured feedback + strengths/weaknesses easily exceeds 4096 budget
      // once thinking is included. Give it room.
      maxTokens: 8192,
    },
    {
      images,
      systemPrompt: relms_1.RELMS_SYSTEM_PROMPT,
      responseMimeType: "application/json",
    }
  );
  const llmCallMs = Date.now() - llmCallStart;
  // Parse response
  const grading = (0, relms_1.parseRELMSResponse)(result.text, question.maxMarks);
  // Transform to UnifiedEvaluationResult
  const confidence = grading.confidence_score ?? 0.8;
  const evaluation = {
    score: grading.rubric_score,
    maxScore: grading.max_rubric_score,
    correctness: grading.max_rubric_score > 0 ? grading.rubric_score / grading.max_rubric_score : 0,
    percentage:
      grading.max_rubric_score > 0
        ? Math.round((grading.rubric_score / grading.max_rubric_score) * 100)
        : 0,
    structuredFeedback: grading.structuredFeedback ?? {},
    strengths: grading.strengths,
    weaknesses: grading.weaknesses,
    missingConcepts: grading.missingConcepts,
    rubricBreakdown: grading.rubric_breakdown,
    summary: grading.summary,
    confidence,
    mistakeClassification: grading.mistake_classification ?? "None",
    tokensUsed: { input: result.tokens.input, output: result.tokens.output },
    costUsd: result.cost.total,
    latencyMs: result.latencyMs,
    timingMs: {
      imageDownload: imageDownloadMs,
      llmCall: llmCallMs,
      total: Date.now() - imageDownloadStart,
    },
    model: result.model,
    dimensionsUsed: dimensions.map((d) => d.id),
    gradedAt: now,
  };
  // Confidence-based grading status routing
  let gradingStatus;
  let reviewSuggested = false;
  if (confidence < confidenceThreshold) {
    gradingStatus = "needs_review";
    reviewSuggested = true;
    console.log(
      `Q${qs.questionId} flagged for review: confidence ${confidence} < threshold ${confidenceThreshold}`
    );
  } else if (confidence >= autoApproveThreshold) {
    gradingStatus = "graded";
  } else {
    gradingStatus = "graded";
    reviewSuggested = true;
  }
  // Save
  await qsRef.update({
    gradingStatus,
    reviewSuggested,
    evaluation,
    updatedAt: now,
  });
  console.log(
    `Graded Q${qs.questionId} for ${submissionId}: ${grading.rubric_score}/${grading.max_rubric_score} (confidence: ${confidence}, status: ${gradingStatus})`
  );
}
async function markQuestionFailed(db, tenantId, submissionId, questionSubmissionId, error) {
  const qsRef = db.doc(
    `tenants/${tenantId}/submissions/${submissionId}/questionSubmissions/${questionSubmissionId}`
  );
  await qsRef.update({
    gradingStatus: "failed",
    gradingError: error,
    updatedAt: firestore_1.FieldValue.serverTimestamp(),
  });
}
async function markQuestionNeedsReview(db, tenantId, submissionId, questionSubmissionId, error) {
  const qsRef = db.doc(
    `tenants/${tenantId}/submissions/${submissionId}/questionSubmissions/${questionSubmissionId}`
  );
  await qsRef.update({
    gradingStatus: "needs_review",
    reviewSuggested: true,
    gradingError: `AI grading unavailable: ${error}. Manual review required.`,
    updatedAt: firestore_1.FieldValue.serverTimestamp(),
  });
}
//# sourceMappingURL=process-answer-grading.js.map
