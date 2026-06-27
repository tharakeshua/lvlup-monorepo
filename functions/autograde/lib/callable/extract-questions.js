"use strict";
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
exports.extractQuestions = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const shared_types_1 = require("@levelup/shared-types");
const assertions_1 = require("../utils/assertions");
const firestore_helpers_1 = require("../utils/firestore-helpers");
const llm_1 = require("../utils/llm");
const utils_1 = require("../utils");
const rate_limit_1 = require("../utils/rate-limit");
const extraction_1 = require("../prompts/extraction");
const image_quality_1 = require("../utils/image-quality");
exports.extractQuestions = (0, https_1.onCall)(
  { region: "asia-south1", timeoutSeconds: 540, memory: "2GiB", cors: true },
  async (request) => {
    const caller = (0, assertions_1.getCallerMembership)(request);
    const data = (0, utils_1.parseRequest)(
      request.data,
      shared_types_1.ExtractQuestionsRequestSchema
    );
    (0, assertions_1.assertAutogradePermission)(caller, data.tenantId, "canCreateExams");
    await (0, rate_limit_1.enforceRateLimit)(data.tenantId, caller.uid, "ai", 10);
    const exam = await (0, firestore_helpers_1.getExam)(data.tenantId, data.examId);
    if (!exam) {
      throw new https_1.HttpsError("not-found", `Exam ${data.examId} not found.`);
    }
    const mode = data.mode ?? "full";
    if (mode === "full" && exam.status !== "question_paper_uploaded") {
      throw new https_1.HttpsError(
        "failed-precondition",
        `Exam must be in 'question_paper_uploaded' status. Current: '${exam.status}'.`
      );
    }
    if (mode === "single" && !data.questionNumber) {
      throw new https_1.HttpsError(
        "invalid-argument",
        'questionNumber is required when mode is "single".'
      );
    }
    if (!exam.questionPaper?.images?.length) {
      throw new https_1.HttpsError("failed-precondition", "No question paper images found.");
    }
    // Download images as base64
    const bucket = admin.storage().bucket();
    const images = [];
    for (const imagePath of exam.questionPaper.images) {
      const file = bucket.file(imagePath);
      const [buffer] = await file.download();
      const [metadata] = await file.getMetadata();
      images.push({
        base64: buffer.toString("base64"),
        mimeType: metadata.contentType || "image/jpeg",
      });
    }
    // Run image quality pre-check
    const qualityReport = (0, image_quality_1.assessImageQuality)(images);
    if (!qualityReport.overallAcceptable) {
      console.warn(
        `[extractQuestions] Image quality warnings for exam ${data.examId}:`,
        qualityReport.warnings
      );
    }
    // Call Gemini via LLMWrapper
    const apiKey = await (0, llm_1.getGeminiApiKey)(data.tenantId);
    const llm = new llm_1.LLMWrapper({
      provider: "gemini",
      apiKey,
      defaultModel: "gemini-2.5-flash",
      enableLogging: true,
    });
    // ── Single-question re-extraction mode ──────────────────────────────────
    if (mode === "single") {
      const singlePrompt = `Re-extract ONLY question ${data.questionNumber} from the attached question paper image(s).

Return a JSON object with this exact schema:
{
  "questions": [
    {
      "questionNumber": "${data.questionNumber}",
      "text": "Full question text with LaTeX for math",
      "maxMarks": 5,
      "hasDiagram": false,
      "questionType": "standard",
      "extractionConfidence": 0.95,
      "readabilityIssue": false,
      "rubric": {
        "criteria": [
          { "name": "Criterion description", "maxPoints": 5 }
        ]
      }
    }
  ]
}

Focus ONLY on question ${data.questionNumber}. Extract it with maximum accuracy.
The sum of all criteria maxPoints MUST equal maxMarks.`;
      const singleResult = await llm.call(
        singlePrompt,
        {
          clientId: data.tenantId,
          userId: caller.uid,
          userRole: caller.role,
          purpose: "question_extraction",
          operation: "reExtractSingleQuestion",
          resourceType: "exam",
          resourceId: data.examId,
          temperature: 0.1,
          maxTokens: 4096,
        },
        {
          images,
          systemPrompt: extraction_1.EXTRACTION_SYSTEM_PROMPT,
          responseMimeType: "application/json",
        }
      );
      const singleExtracted = (0, extraction_1.parseExtractionResponse)(singleResult.text);
      if (singleExtracted.questions.length === 0) {
        throw new https_1.HttpsError(
          "internal",
          `Failed to re-extract question ${data.questionNumber}.`
        );
      }
      const q = singleExtracted.questions[0];
      const db = admin.firestore();
      const qRef = db.doc(
        `tenants/${data.tenantId}/exams/${data.examId}/questions/${data.questionNumber}`
      );
      const now = firestore_1.FieldValue.serverTimestamp();
      await qRef.update({
        text: q.text,
        maxMarks: q.maxMarks,
        rubric: {
          criteria: q.rubric.criteria.map((c, ci) => ({
            id: `c${ci + 1}`,
            name: c.name,
            description: c.description ?? "",
            maxPoints: c.maxPoints,
          })),
          scoringMode: "criteria_based",
          dimensions: [],
        },
        questionType: q.questionType ?? "standard",
        extractionConfidence: q.extractionConfidence ?? 0.8,
        readabilityIssue: q.readabilityIssue ?? false,
        reExtractedAt: now,
        updatedAt: now,
      });
      return {
        success: true,
        questions: [q],
        warnings: [],
        metadata: {
          questionCount: 1,
          tokensUsed: singleResult.tokens.input + singleResult.tokens.output,
          cost: singleResult.cost.total,
          extractedAt: new Date().toISOString(),
          imageQualityAcceptable: qualityReport.overallAcceptable,
          mode: "single",
        },
      };
    }
    // ── Full extraction mode ─────────────────────────────────────────────────
    const result = await llm.call(
      extraction_1.EXTRACTION_USER_PROMPT,
      {
        clientId: data.tenantId,
        userId: caller.uid,
        userRole: caller.role,
        purpose: "question_extraction",
        operation: "extractQuestions",
        resourceType: "exam",
        resourceId: data.examId,
        temperature: 0.1,
        maxTokens: 65536,
      },
      {
        images,
        systemPrompt: extraction_1.EXTRACTION_SYSTEM_PROMPT,
        responseMimeType: "application/json",
      }
    );
    // Parse and validate
    const extracted = (0, extraction_1.parseExtractionResponse)(result.text);
    // Save questions to Firestore
    const db = admin.firestore();
    const batch = db.batch();
    const questionsCol = db.collection(`tenants/${data.tenantId}/exams/${data.examId}/questions`);
    const now = firestore_1.FieldValue.serverTimestamp();
    // Build validation warnings for teacher review
    const extractionWarnings = [...qualityReport.warnings];
    // Validate question numbering for sequential order
    const questionNumbers = extracted.questions.map((q) => q.questionNumber);
    const numericParts = questionNumbers
      .map((qn) => parseInt(qn.replace(/[^0-9]/g, ""), 10))
      .filter((n) => !isNaN(n));
    if (numericParts.length > 1) {
      for (let i = 1; i < numericParts.length; i++) {
        if (numericParts[i] !== numericParts[i - 1] + 1) {
          extractionWarnings.push(
            `Question numbering gap: Q${questionNumbers[i - 1]} → Q${questionNumbers[i]}. A question may be missing.`
          );
        }
      }
    }
    const savedQuestions = extracted.questions.map((q, index) => {
      // Flag low-confidence extractions
      if (q.extractionConfidence !== undefined && q.extractionConfidence < 0.7) {
        extractionWarnings.push(
          `Q${q.questionNumber}: Low extraction confidence (${Math.round(q.extractionConfidence * 100)}%). Review recommended.`
        );
      }
      if (q.readabilityIssue) {
        extractionWarnings.push(
          `Q${q.questionNumber}: Readability issue detected. Some text may be inaccurate.`
        );
      }
      const qRef = questionsCol.doc(q.questionNumber);
      const questionDoc = {
        id: q.questionNumber,
        examId: data.examId,
        text: q.text,
        maxMarks: q.maxMarks,
        order: index,
        rubric: {
          criteria: q.rubric.criteria.map((c, ci) => ({
            id: `c${ci + 1}`,
            name: c.name,
            description: c.description ?? "",
            maxPoints: c.maxPoints,
          })),
          scoringMode: "criteria_based",
          dimensions: [],
        },
        questionType: q.questionType ?? "standard",
        extractionConfidence: q.extractionConfidence ?? 0.8,
        readabilityIssue: q.readabilityIssue ?? false,
        subQuestions: (q.subQuestions ?? []).map((sq) => ({
          label: sq.label,
          text: sq.text,
          maxMarks: sq.maxMarks,
          rubric: sq.rubric
            ? {
                criteria: sq.rubric.criteria.map((c, ci) => ({
                  id: `c${ci + 1}`,
                  name: c.name,
                  description: c.description ?? "",
                  maxPoints: c.maxPoints,
                })),
                scoringMode: "criteria_based",
              }
            : null,
        })),
        extractedBy: "ai",
        extractedAt: now,
        createdAt: now,
        updatedAt: now,
      };
      batch.set(qRef, questionDoc);
      return questionDoc;
    });
    // Update exam status
    const examRef = db.doc(`tenants/${data.tenantId}/exams/${data.examId}`);
    batch.update(examRef, {
      status: "question_paper_extracted",
      "questionPaper.extractedAt": now,
      "questionPaper.questionCount": extracted.questions.length,
      updatedAt: now,
    });
    await batch.commit();
    return {
      success: true,
      questions: savedQuestions,
      warnings: extractionWarnings,
      metadata: {
        questionCount: extracted.questions.length,
        tokensUsed: result.tokens.input + result.tokens.output,
        cost: result.cost.total,
        extractedAt: new Date().toISOString(),
        imageQualityAcceptable: qualityReport.overallAcceptable,
      },
    };
  }
);
//# sourceMappingURL=extract-questions.js.map
