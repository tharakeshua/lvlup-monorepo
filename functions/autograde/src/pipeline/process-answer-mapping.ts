/**
 * processAnswerMapping — Panopticon scouting pipeline worker.
 *
 * Maps answer sheet pages to questions using Gemini's large context window.
 * Creates QuestionSubmission documents for each mapped question.
 */

import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { getExam, getExamQuestions, getSubmission } from "../utils/firestore-helpers";
import { LLMWrapper, getGeminiApiKey } from "../utils/llm";
import {
  PANOPTICON_SYSTEM_PROMPT,
  buildPanopticonUserPrompt,
  parsePanopticonResponse,
} from "../prompts/panopticon";

export async function processAnswerMapping(tenantId: string, submissionId: string): Promise<void> {
  const db = admin.firestore();
  const now = FieldValue.serverTimestamp();

  const submission = await getSubmission(tenantId, submissionId);
  if (!submission) throw new Error(`Submission ${submissionId} not found.`);

  const exam = await getExam(tenantId, submission.examId);
  if (!exam) throw new Error(`Exam ${submission.examId} not found.`);

  const questions = await getExamQuestions(tenantId, submission.examId);
  if (questions.length === 0) throw new Error("No questions found for exam.");

  const questionIds = questions.map((q) => q.id);

  // Download question paper and answer sheet images as base64
  const bucket = admin.storage().bucket();
  const images: Array<{ base64: string; mimeType: string }> = [];

  // Question paper images first (for context)
  if (exam.questionPaper?.images) {
    for (const imagePath of exam.questionPaper.images) {
      const file = bucket.file(imagePath);
      const [buffer] = await file.download();
      const [metadata] = await file.getMetadata();
      images.push({
        base64: buffer.toString("base64"),
        mimeType: (metadata.contentType as string) || "image/jpeg",
      });
    }
  }

  // Answer sheet images
  const answerImages: Array<{ base64: string; mimeType: string }> = [];
  for (const imagePath of submission.answerSheets.images) {
    const file = bucket.file(imagePath);
    const [buffer] = await file.download();
    const [metadata] = await file.getMetadata();
    const img = {
      base64: buffer.toString("base64"),
      mimeType: (metadata.contentType as string) || "image/jpeg",
    };
    images.push(img);
    answerImages.push(img);
  }

  // Call Gemini
  const apiKey = await getGeminiApiKey(tenantId);
  const llm = new LLMWrapper({
    provider: "gemini",
    apiKey,
    defaultModel: "gemini-2.5-flash",
    enableLogging: true,
  });

  const userPrompt = buildPanopticonUserPrompt(questionIds);

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
      systemPrompt: PANOPTICON_SYSTEM_PROMPT,
      responseMimeType: "application/json",
    }
  );

  // Parse and validate
  const scouting = parsePanopticonResponse(
    result.text,
    questionIds,
    submission.answerSheets.images.length
  );

  // Create QuestionSubmission documents (chunked at 450 to stay under Firestore 500-op limit)
  const BATCH_LIMIT = 450;
  const batches: admin.firestore.WriteBatch[] = [];
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
