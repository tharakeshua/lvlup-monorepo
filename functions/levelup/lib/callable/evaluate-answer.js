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
exports.evaluateAnswer = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
const auth_1 = require("../utils/auth");
const firestore_1 = require("../utils/firestore");
const rubric_1 = require("../utils/rubric");
const rate_limit_1 = require("../utils/rate-limit");
const auto_evaluate_1 = require("../utils/auto-evaluate");
const evaluator_1 = require("../prompts/evaluator");
const ai_1 = require("@levelup/shared-services/ai");
const wire_1 = require("../contracts/wire");
const utils_1 = require("../utils");
const types_1 = require("../types");
const firestore_2 = require("firebase-admin/firestore");
/**
 * AI-evaluate a single answer using Gemini.
 *
 * For question types: text, paragraph, code, audio, image_evaluation, chat_agent_question.
 * Resolves evaluator agent and rubric via inheritance chain.
 * Rate limited: 10 AI operations/min per user.
 */
exports.evaluateAnswer = (0, https_1.onCall)(
  { region: "asia-south1", timeoutSeconds: 60, cors: true },
  async (request) => {
    const callerUid = (0, auth_1.assertAuth)(request.auth);
    const data = (0, utils_1.parseRequest)(request.data, wire_1.EvaluateAnswerRequestSchema);
    if (!data.tenantId || !data.spaceId || !data.itemId || data.answer === undefined) {
      throw new https_1.HttpsError(
        "invalid-argument",
        "tenantId, spaceId, itemId, and answer are required"
      );
    }
    await (0, auth_1.assertTenantMember)(callerUid, data.tenantId);
    // Load item (use storyPointId for nested path lookup)
    const item = await (0, firestore_1.loadItem)(
      data.tenantId,
      data.spaceId,
      data.itemId,
      data.storyPointId
    );
    // Check if this is a deterministic question type — skip AI entirely
    const questionType = item.payload?.questionType;
    if (questionType && types_1.AUTO_EVALUATABLE_TYPES.includes(questionType)) {
      // Load answer key from server-only subcollection
      const db = (0, firestore_1.getDb)();
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
      const answerKey = akSnap.empty ? undefined : akSnap.docs[0].data();
      const autoResult = (0, auto_evaluate_1.autoEvaluateSubmission)(
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
        v2_1.logger.info(
          `Auto-evaluated item ${data.itemId}: ${autoResult.score}/${autoResult.maxScore} (deterministic)`
        );
        return autoResult;
      }
      // Fall through to AI if autoEvaluateSubmission returned null (missing data)
    }
    // --- AI evaluation for subjective question types ---
    // Rate limit: 10 AI operations/min per user
    await (0, rate_limit_1.enforceRateLimit)(data.tenantId, callerUid, "ai", 10);
    // Resolve evaluator agent (item > space default > null)
    let agent = null;
    const agentId = item.meta?.evaluatorAgentId;
    if (agentId) {
      agent = await (0, firestore_1.loadAgent)(data.tenantId, data.spaceId, agentId);
    }
    if (!agent) {
      // Try space default
      const db = admin.firestore();
      const spaceDoc = await db.doc(`tenants/${data.tenantId}/spaces/${data.spaceId}`).get();
      const space = spaceDoc.data();
      if (space?.defaultEvaluatorAgentId) {
        agent = await (0, firestore_1.loadAgent)(
          data.tenantId,
          data.spaceId,
          space.defaultEvaluatorAgentId
        );
      }
    }
    // Resolve rubric (item > storyPoint > space > tenant)
    const rubric = await (0, rubric_1.resolveRubric)(data.tenantId, data.spaceId, item);
    // Build evaluation prompt
    const prompt = (0, evaluator_1.buildEvaluationPrompt)(
      item,
      data.answer,
      rubric,
      agent,
      data.mediaUrls
    );
    // Get API key and call LLM
    const apiKey = await (0, ai_1.getGeminiApiKey)(data.tenantId);
    const llm = new ai_1.LLMWrapper({ provider: "gemini", apiKey, enableLogging: true });
    const result = await llm.call(
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
      throw new https_1.HttpsError("internal", "Failed to parse AI evaluation response");
    }
    // Normalize the result
    const evaluation = {
      ...result.parsed,
      tokensUsed: { input: result.tokens.input, output: result.tokens.output },
      costUsd: result.cost.total,
      gradedAt: firestore_2.Timestamp.now(),
    };
    v2_1.logger.info(
      `Evaluated item ${data.itemId}: ${evaluation.score}/${evaluation.maxScore} (confidence: ${evaluation.confidence})`
    );
    return evaluation;
  }
);
//# sourceMappingURL=evaluate-answer.js.map
