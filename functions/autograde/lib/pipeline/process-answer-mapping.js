"use strict";
/**
 * processAnswerMapping — Panopticon scouting pipeline worker.
 *
 * Maps answer sheet pages to questions using Gemini's large context window.
 * Creates QuestionSubmission documents for each mapped question.
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
exports.processAnswerMapping = processAnswerMapping;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const firestore_helpers_1 = require("../utils/firestore-helpers");
const llm_1 = require("../utils/llm");
const panopticon_1 = require("../prompts/panopticon");
async function processAnswerMapping(tenantId, submissionId) {
  const db = admin.firestore();
  const now = firestore_1.FieldValue.serverTimestamp();
  const submission = await (0, firestore_helpers_1.getSubmission)(tenantId, submissionId);
  if (!submission) throw new Error(`Submission ${submissionId} not found.`);
  const exam = await (0, firestore_helpers_1.getExam)(tenantId, submission.examId);
  if (!exam) throw new Error(`Exam ${submission.examId} not found.`);
  const questions = await (0, firestore_helpers_1.getExamQuestions)(tenantId, submission.examId);
  if (questions.length === 0) throw new Error("No questions found for exam.");
  const questionIds = questions.map((q) => q.id);
  // Download question paper and answer sheet images as base64
  const bucket = admin.storage().bucket();
  const images = [];
  // Question paper images first (for context)
  if (exam.questionPaper?.images) {
    for (const imagePath of exam.questionPaper.images) {
      const file = bucket.file(imagePath);
      const [buffer] = await file.download();
      const [metadata] = await file.getMetadata();
      images.push({
        base64: buffer.toString("base64"),
        mimeType: metadata.contentType || "image/jpeg",
      });
    }
  }
  // Answer sheet images
  const answerImages = [];
  for (const imagePath of submission.answerSheets.images) {
    const file = bucket.file(imagePath);
    const [buffer] = await file.download();
    const [metadata] = await file.getMetadata();
    const img = {
      base64: buffer.toString("base64"),
      mimeType: metadata.contentType || "image/jpeg",
    };
    images.push(img);
    answerImages.push(img);
  }
  // Call Gemini
  const apiKey = await (0, llm_1.getGeminiApiKey)(tenantId);
  const llm = new llm_1.LLMWrapper({
    provider: "gemini",
    apiKey,
    defaultModel: "gemini-2.5-flash",
    enableLogging: true,
  });
  const userPrompt = (0, panopticon_1.buildPanopticonUserPrompt)(questionIds);
  const result = await llm.call(
    userPrompt,
    {
      clientId: tenantId,
      userId: "system",
      userRole: "system",
      purpose: "answer_mapping",
      operation: "panopticonScouting",
      resourceType: "submission",
      resourceId: submissionId,
      temperature: 0.1,
      // Gemini 2.5 Flash spends thinking tokens against this budget. With many
      // questions + answer pages, 4096 truncates the response (observed empirically:
      // ~320-char outputs hitting MAX_TOKENS). Bump well above the worst case.
      maxTokens: 16384,
    },
    {
      images,
      systemPrompt: panopticon_1.PANOPTICON_SYSTEM_PROMPT,
      responseMimeType: "application/json",
    }
  );
  // Parse and validate
  const scouting = (0, panopticon_1.parsePanopticonResponse)(
    result.text,
    questionIds,
    submission.answerSheets.images.length
  );
  // Create QuestionSubmission documents (chunked at 450 to stay under Firestore 500-op limit)
  const BATCH_LIMIT = 450;
  const batches = [];
  let currentBatch = db.batch();
  let opsInBatch = 0;
  for (const question of questions) {
    if (opsInBatch >= BATCH_LIMIT) {
      batches.push(currentBatch);
      currentBatch = db.batch();
      opsInBatch = 0;
    }
    const pageIndices = scouting.routing_map[question.id] ?? [];
    const mappedImageUrls = pageIndices.map((idx) => submission.answerSheets.images[idx]);
    const qsRef = db.doc(
      `tenants/${tenantId}/submissions/${submissionId}/questionSubmissions/${question.id}`
    );
    currentBatch.set(qsRef, {
      id: question.id,
      submissionId,
      questionId: question.id,
      examId: submission.examId,
      mapping: {
        pageIndices,
        imageUrls: mappedImageUrls,
        scoutedAt: now,
      },
      gradingStatus: "pending",
      gradingRetryCount: 0,
      createdAt: now,
      updatedAt: now,
    });
    opsInBatch++;
  }
  // Save scouting result to submission
  const subRef = db.doc(`tenants/${tenantId}/submissions/${submissionId}`);
  currentBatch.update(subRef, {
    scoutingResult: {
      routingMap: scouting.routing_map,
      confidence: scouting.confidence ?? {},
      completedAt: now,
    },
    pipelineStatus: "scouting_complete",
    updatedAt: now,
  });
  batches.push(currentBatch);
  for (const batch of batches) {
    await batch.commit();
  }
  console.log(`Scouting complete for ${submissionId}: ${questions.length} questions mapped.`);
}
//# sourceMappingURL=process-answer-mapping.js.map
