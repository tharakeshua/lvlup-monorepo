import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { ExtractQuestionsRequestSchema } from "@levelup/shared-types";
import { getCallerMembership, assertAutogradePermission } from "../utils/assertions";
import { getExam } from "../utils/firestore-helpers";
import { LLMWrapper, getGeminiApiKey } from "../utils/llm";
import { parseRequest } from "../utils";
import { enforceRateLimit } from "../utils/rate-limit";
import {
  EXTRACTION_SYSTEM_PROMPT,
  EXTRACTION_USER_PROMPT,
  parseExtractionResponse,
  type ExtractedQuestion,
} from "../prompts/extraction";
import { assessImageQuality } from "../utils/image-quality";

interface ExtractQuestionsRequest {
  tenantId: string;
  examId: string;
}

export const extractQuestions = onCall(
  { region: "asia-south1", timeoutSeconds: 540, memory: "2GiB", cors: true },
  async (request) => {
    const caller = getCallerMembership(request);
    const data = parseRequest(request.data, ExtractQuestionsRequestSchema);

    assertAutogradePermission(caller, data.tenantId, "canCreateExams");

    await enforceRateLimit(data.tenantId, caller.uid, "ai", 10);

    const exam = await getExam(data.tenantId, data.examId);
    if (!exam) {
      throw new HttpsError("not-found", `Exam ${data.examId} not found.`);
    }

    const mode = data.mode ?? "full";

    if (mode === "full" && exam.status !== "question_paper_uploaded") {
      throw new HttpsError(
        "failed-precondition",
        `Exam must be in 'question_paper_uploaded' status. Current: '${exam.status}'.`
      );
    }

    if (mode === "single" && !data.questionNumber) {
      throw new HttpsError("invalid-argument", 'questionNumber is required when mode is "single".');
    }

    if (!exam.questionPaper?.images?.length) {
      throw new HttpsError("failed-precondition", "No question paper images found.");
    }

    // Download images as base64
    const bucket = admin.storage().bucket();
    const images: Array<{ base64: string; mimeType: string }> = [];

    for (const imagePath of exam.questionPaper.images) {
      const file = bucket.file(imagePath);
      const [buffer] = await file.download();
      const [metadata] = await file.getMetadata();
      images.push({
        base64: buffer.toString("base64"),
        mimeType: (metadata.contentType as string) || "image/jpeg",
      });
    }

    // Run image quality pre-check
    const qualityReport = assessImageQuality(images);
    if (!qualityReport.overallAcceptable) {
      console.warn(
        `[extractQuestions] Image quality warnings for exam ${data.examId}:`,
        qualityReport.warnings
      );
    }

    // Call Gemini via LLMWrapper
    const apiKey = await getGeminiApiKey(data.tenantId);
    const llm = new LLMWrapper({
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
          systemPrompt: EXTRACTION_SYSTEM_PROMPT,
          responseMimeType: "application/json",
        }
      );

      const singleExtracted = parseExtractionResponse(singleResult.text);
      if (singleExtracted.questions.length === 0) {
        throw new HttpsError("internal", `Failed to re-extract question ${data.questionNumber}.`);
      }

      const q = singleExtracted.questions[0];
      const db = admin.firestore();
      const qRef = db.doc(
        `tenants/${data.tenantId}/exams/${data.examId}/questions/${data.questionNumber}`
      );
      const now = FieldValue.serverTimestamp();

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
          scoringMode: "criteria_based" as const,
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
      EXTRACTION_USER_PROMPT,
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
        systemPrompt: EXTRACTION_SYSTEM_PROMPT,
        responseMimeType: "application/json",
      }
    );

    // Parse and validate
    const extracted = parseExtractionResponse(result.text);

    // Save questions to Firestore
    const db = admin.firestore();
    const batch = db.batch();
    const questionsCol = db.collection(`tenants/${data.tenantId}/exams/${data.examId}/questions`);
    const now = FieldValue.serverTimestamp();

    // Build validation warnings for teacher review
    const extractionWarnings: string[] = [...qualityReport.warnings];

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
          scoringMode: "criteria_based" as const,
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
                scoringMode: "criteria_based" as const,
              }
            : null,
        })),
        extractedBy: "ai" as const,
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
