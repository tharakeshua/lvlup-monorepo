import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { assertAuth, assertTenantMember } from "../utils/auth";
import { loadItem, loadAgent, getDb } from "../utils/firestore";
import { resolveRubric } from "../utils/rubric";
import { enforceRateLimit } from "../utils/rate-limit";
import { autoEvaluateSubmission } from "../utils/auto-evaluate";
import { buildEvaluationPrompt } from "../prompts/evaluator";
import { LLMWrapper, getGeminiApiKey } from "@levelup/shared-services/ai";
import { EvaluateAnswerRequestSchema } from "../contracts/wire";
import { parseRequest } from "../utils";
import type { UnifiedEvaluationResult, Agent, QuestionPayload, AnswerKey } from "../types";
import { AUTO_EVALUATABLE_TYPES } from "../types";
import { Timestamp } from "firebase-admin/firestore";

interface EvaluateAnswerRequest {
  tenantId: string;
  spaceId: string;
  storyPointId?: string;
  itemId: string;
  answer: unknown;
  mediaUrls?: string[];
}

/**
 * AI-evaluate a single answer using Gemini.
 *
 * For question types: text, paragraph, code, audio, image_evaluation, chat_agent_question.
 * Resolves evaluator agent and rubric via inheritance chain.
 * Rate limited: 10 AI operations/min per user.
 */
export const evaluateAnswer = onCall(
  { region: "asia-south1", timeoutSeconds: 60, cors: true },
  async (request) => {
    const callerUid = assertAuth(request.auth);
    const data = parseRequest(request.data, EvaluateAnswerRequestSchema);

    if (!data.tenantId || !data.spaceId || !data.itemId || data.answer === undefined) {
      throw new HttpsError(
        "invalid-argument",
        "tenantId, spaceId, itemId, and answer are required"
      );
    }

    await assertTenantMember(callerUid, data.tenantId);

    // Load item (use storyPointId for nested path lookup)
    const item = await loadItem(data.tenantId, data.spaceId, data.itemId, data.storyPointId);

    // Check if this is a deterministic question type — skip AI entirely
    const questionType = (item.payload as QuestionPayload)?.questionType;
    if (questionType && (AUTO_EVALUATABLE_TYPES as readonly string[]).includes(questionType)) {
      // Load answer key from server-only subcollection
      const db = getDb();
      // Try nested path first (storyPoints subcollection), fallback to flat
      const akBasePath = data.storyPointId
        ? `tenants/${data.tenantId}/spaces/${data.spaceId}/storyPoints/${data.storyPointId}/items/${data.itemId}/answerKeys`
        : `tenants/${data.tenantId}/spaces/${data.spaceId}/items/${data.itemId}/answerKeys`;
      let akSnap = await db.collection(akBasePath).limit(1).get();
      // Fallback: if nested path empty and we used it, try flat path
      if (akSnap.empty && data.storyPointId) {
        akSnap = await db
          .collection(
            `tenants/${data.tenantId}/spaces/${data.spaceId}/items/${data.itemId}/answerKeys`
          )
          .limit(1)
          .get();
      }
      const answerKey: AnswerKey | undefined = akSnap.empty
        ? undefined
        : (akSnap.docs[0].data() as AnswerKey);

      const autoResult = autoEvaluateSubmission(
        item,
        {
          itemId: data.itemId,
          questionType,
          answer: data.answer,
          submittedAt: Date.now(),
          timeSpentSeconds: 0,
        },
        answerKey
      );

      if (autoResult) {
        logger.info(
          `Auto-evaluated item ${data.itemId}: ${autoResult.score}/${autoResult.maxScore} (deterministic)`
        );
        return autoResult;
      }
      // Fall through to AI if autoEvaluateSubmission returned null (missing data)
    }

    // --- AI evaluation for subjective question types ---

    // Rate limit: 10 AI operations/min per user
    await enforceRateLimit(data.tenantId, callerUid, "ai", 10);

    // Resolve evaluator agent (item > space default > null)
    let agent: Agent | null = null;
    const agentId = item.meta?.evaluatorAgentId;
    if (agentId) {
      agent = await loadAgent(data.tenantId, data.spaceId, agentId);
    }
    if (!agent) {
      // Try space default
      const db = admin.firestore();
      const spaceDoc = await db.doc(`tenants/${data.tenantId}/spaces/${data.spaceId}`).get();
      const space = spaceDoc.data();
      if (space?.defaultEvaluatorAgentId) {
        agent = await loadAgent(data.tenantId, data.spaceId, space.defaultEvaluatorAgentId);
      }
    }

    // Resolve rubric (item > storyPoint > space > tenant)
    const rubric = await resolveRubric(data.tenantId, data.spaceId, item);

    // Build evaluation prompt
    const prompt = buildEvaluationPrompt(item, data.answer, rubric, agent, data.mediaUrls);

    // Get API key and call LLM
    const apiKey = await getGeminiApiKey(data.tenantId);
    const llm = new LLMWrapper({ provider: "gemini", apiKey, enableLogging: true });

    const result = await llm.call<UnifiedEvaluationResult>(
      prompt,
      {
        clientId: data.tenantId,
        userId: callerUid,
        userRole: "student",
        purpose: "answer_evaluation",
        operation: "levelup_evaluate_answer",
        resourceType: "item",
        resourceId: data.itemId,
        model: agent?.modelOverride || "gemini-2.5-flash",
        temperature: agent?.temperatureOverride ?? 0.3,
        maxTokens: 4096,
      },
      {
        responseMimeType: "application/json",
        ...(data.mediaUrls?.length
          ? {
              // For image evaluation, we'd need to fetch the images
              // For now, the URLs are passed in the prompt text
            }
          : {}),
      }
    );

    if (!result.parsed) {
      throw new HttpsError("internal", "Failed to parse AI evaluation response");
    }

    // Normalize the result
    const evaluation: UnifiedEvaluationResult = {
      ...result.parsed,
      tokensUsed: { input: result.tokens.input, output: result.tokens.output },
      costUsd: result.cost.total,
      gradedAt: Timestamp.now(),
    };

    logger.info(
      `Evaluated item ${data.itemId}: ${evaluation.score}/${evaluation.maxScore} (confidence: ${evaluation.confidence})`
    );

    return evaluation;
  }
);
