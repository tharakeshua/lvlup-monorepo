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
exports.sendChatMessage = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
const auth_1 = require("../utils/auth");
const firestore_2 = require("../utils/firestore");
const rate_limit_1 = require("../utils/rate-limit");
const chat_safety_1 = require("../utils/chat-safety");
const tutor_1 = require("../prompts/tutor");
const ai_1 = require("@levelup/shared-services/ai");
const shared_types_1 = require("@levelup/shared-types");
const utils_1 = require("../utils");
const shared_types_2 = require("@levelup/shared-types");
/**
 * AI tutor chat — send a message and get a response.
 *
 * Builds context from the current item, resolves tutor agent,
 * and uses Socratic method to guide students.
 * Rate limited: 10 messages/min per user.
 */
exports.sendChatMessage = (0, https_1.onCall)(
  { region: "asia-south1", timeoutSeconds: 30, cors: true },
  async (request) => {
    const callerUid = (0, auth_1.assertAuth)(request.auth);
    const data = (0, utils_1.parseRequest)(
      request.data,
      shared_types_1.SendChatMessageRequestSchema
    );
    if (!data.tenantId || !data.spaceId || !data.itemId || !data.message?.trim()) {
      throw new https_1.HttpsError(
        "invalid-argument",
        "tenantId, spaceId, itemId, and message are required"
      );
    }
    // Sanitize user message: limit length, strip control characters
    const MAX_MESSAGE_LENGTH = 4000;
    if (data.message.length > MAX_MESSAGE_LENGTH) {
      data.message = data.message.substring(0, MAX_MESSAGE_LENGTH);
    }
    // Strip control characters except newlines and tabs
    data.message = data.message.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
    await (0, auth_1.assertTenantMember)(callerUid, data.tenantId);
    // Safety check: block prompt injection and non-educational content
    const safetyResult = (0, chat_safety_1.checkMessageSafety)(data.message);
    if (!safetyResult.safe) {
      throw new https_1.HttpsError(
        "invalid-argument",
        safetyResult.reason ?? "Message blocked by safety filter."
      );
    }
    // Check for rate limit abuse (50 messages/hour)
    const abuseResult = (0, chat_safety_1.checkRateLimitAbuse)(callerUid);
    if (!abuseResult.safe) {
      throw new https_1.HttpsError(
        "resource-exhausted",
        abuseResult.reason ?? "Too many messages."
      );
    }
    // Rate limit: 10 messages/min per user
    await (0, rate_limit_1.enforceRateLimit)(data.tenantId, callerUid, "chat", 10);
    const db = admin.firestore();
    // Load item
    const item = await (0, firestore_2.loadItem)(data.tenantId, data.spaceId, data.itemId);
    // Resolve tutor agent
    let agent = null;
    if (data.agentId) {
      agent = await (0, firestore_2.loadAgent)(data.tenantId, data.spaceId, data.agentId);
    }
    if (!agent) {
      const space = await (0, firestore_2.loadSpace)(data.tenantId, data.spaceId);
      if (space.defaultTutorAgentId) {
        agent = await (0, firestore_2.loadAgent)(
          data.tenantId,
          data.spaceId,
          space.defaultTutorAgentId
        );
      }
    }
    const language = data.language ?? agent?.defaultLanguage ?? "english";
    // Load or create chat session
    let session;
    let sessionRef;
    if (data.sessionId) {
      sessionRef = db.doc(`tenants/${data.tenantId}/chatSessions/${data.sessionId}`);
      const sessionDoc = await sessionRef.get();
      if (!sessionDoc.exists) {
        throw new https_1.HttpsError("not-found", "Chat session not found");
      }
      const sessionResult = shared_types_2.ChatSessionSchema.safeParse({
        id: sessionDoc.id,
        ...sessionDoc.data(),
      });
      if (!sessionResult.success) {
        v2_1.logger.error("Invalid ChatSession document", {
          docId: sessionDoc.id,
          errors: sessionResult.error.flatten(),
        });
        throw new https_1.HttpsError("internal", "Data integrity error");
      }
      session = sessionResult.data;
      if (session.userId !== callerUid) {
        throw new https_1.HttpsError("permission-denied", "Not your chat session");
      }
    } else {
      // Create new session
      sessionRef = db.collection(`tenants/${data.tenantId}/chatSessions`).doc();
      session = {
        id: sessionRef.id,
        tenantId: data.tenantId,
        userId: callerUid,
        spaceId: data.spaceId,
        storyPointId: data.storyPointId,
        itemId: data.itemId,
        questionType: item.type === "question" ? item.payload.questionType : undefined,
        agentId: agent?.id ?? undefined,
        agentName: agent?.name ?? "AI Tutor",
        sessionTitle: item.title ?? "Chat Session",
        previewMessage: data.message.substring(0, 100),
        messageCount: 0,
        language,
        isActive: true,
        messages: [],
        systemPrompt: "",
        createdAt: firestore_1.Timestamp.now(),
        updatedAt: firestore_1.Timestamp.now(),
      };
    }
    // Build system prompt
    const systemPrompt = (0, tutor_1.buildTutorSystemPrompt)(
      agent,
      item,
      undefined,
      undefined,
      language
    );
    // Enforce max conversation turns if configured
    if (agent?.maxConversationTurns && session.messages.length >= agent.maxConversationTurns) {
      throw new https_1.HttpsError(
        "resource-exhausted",
        `Maximum conversation length of ${agent.maxConversationTurns} messages reached`
      );
    }
    // Load full conversation history from subcollection for better context
    // Use subcollection messages for existing sessions (more complete than preview array)
    let conversationMessages;
    let conversationSummary;
    const SUMMARIZE_THRESHOLD = 20;
    if (data.sessionId) {
      const messagesSnap = await sessionRef
        .collection("messages")
        .orderBy("timestamp", "asc")
        .get();
      const allMessages = messagesSnap.docs.map((doc) => {
        const msg = doc.data();
        return { role: msg.role, content: msg.text };
      });
      // If conversation is long, use LLM-based summarization for better context
      if (allMessages.length > SUMMARIZE_THRESHOLD) {
        conversationMessages = allMessages.slice(-10);
        // Check if we have a cached summary that's still fresh
        const sessionData = (await sessionRef.get()).data();
        const cachedSummary = sessionData?.conversationSummary;
        const summaryMessageCount = sessionData?.summaryAtMessageCount ?? 0;
        const messagesSinceSummary = allMessages.length - summaryMessageCount;
        if (cachedSummary && messagesSinceSummary < 10) {
          // Use cached summary — not enough new messages to regenerate
          conversationSummary = cachedSummary;
        } else {
          // Generate fresh LLM summary using cheap model
          const olderMessages = allMessages.slice(0, allMessages.length - 10);
          const summaryInput = olderMessages
            .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
            .join("\n");
          try {
            const summaryApiKey = await (0, ai_1.getGeminiApiKey)(data.tenantId);
            const summaryLlm = new ai_1.LLMWrapper({
              provider: "gemini",
              apiKey: summaryApiKey,
              defaultModel: "gemini-2.5-flash-lite",
              enableLogging: true,
            });
            const summaryResult = await summaryLlm.call(
              `Summarize this tutoring conversation between a student and AI tutor. Focus on:
1. Key topics discussed
2. Student's apparent understanding level (strong/developing/struggling)
3. Concepts the student seems to have mastered
4. Concepts the student is still struggling with

Conversation (${olderMessages.length} messages):
${summaryInput}

Respond with a concise summary (max 300 words).`,
              {
                clientId: data.tenantId,
                userId: "system",
                userRole: "system",
                purpose: "ai_chat",
                operation: "conversation_summarization",
                resourceType: "chatSession",
                resourceId: sessionRef.id,
                model: "gemini-2.5-flash-lite",
                temperature: 0.3,
                maxTokens: 512,
              }
            );
            conversationSummary = `[CONVERSATION SUMMARY — ${olderMessages.length} earlier messages]\n${summaryResult.text}`;
            // Cache the summary (fire-and-forget)
            sessionRef
              .update({
                conversationSummary,
                summaryAtMessageCount: allMessages.length,
              })
              .catch((err) => v2_1.logger.warn("Failed to cache conversation summary:", err));
          } catch (summaryErr) {
            // Fallback to naive truncation if LLM summary fails
            v2_1.logger.warn("LLM summarization failed, using fallback:", summaryErr);
            conversationSummary =
              `[CONVERSATION SUMMARY — ${olderMessages.length} earlier messages]\n` +
              `The student has been discussing this topic. Key exchanges:\n` +
              olderMessages
                .slice(-6)
                .map(
                  (m) =>
                    `${m.role.toUpperCase()}: ${m.content.substring(0, 150)}${m.content.length > 150 ? "..." : ""}`
                )
                .join("\n");
          }
        }
      } else {
        conversationMessages = allMessages;
      }
    } else {
      conversationMessages = session.messages.map((m) => ({
        role: m.role,
        content: m.text,
      }));
    }
    // Get API key and call LLM
    const apiKey = await (0, ai_1.getGeminiApiKey)(data.tenantId);
    const llm = new ai_1.LLMWrapper({ provider: "gemini", apiKey, enableLogging: true });
    // Build the full prompt with conversation history (and summary if long)
    let historySection = "";
    if (conversationSummary) {
      historySection += conversationSummary + "\n\n[RECENT MESSAGES]\n";
    }
    historySection += conversationMessages
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n");
    const wrappedMessage = `<student_message>${data.message}</student_message>`;
    const fullPrompt = historySection
      ? `${historySection}\nUSER: ${wrappedMessage}\n\nRespond as the tutor:`
      : `USER: ${wrappedMessage}\n\nRespond as the tutor:`;
    const result = await llm.call(
      fullPrompt,
      {
        clientId: data.tenantId,
        userId: callerUid,
        userRole: "student",
        purpose: "ai_chat",
        operation: "levelup_tutor_chat",
        resourceType: "item",
        resourceId: data.itemId,
        model: agent?.modelOverride || "gemini-2.5-flash",
        temperature: agent?.temperatureOverride ?? 0.7,
        maxTokens: 2048,
      },
      {
        systemPrompt,
      }
    );
    const replyText = result.text;
    const now = new Date().toISOString();
    // Create new messages
    const userMessage = {
      id: `msg_${Date.now()}_user`,
      role: "user",
      text: data.message,
      timestamp: now,
    };
    const assistantMessage = {
      id: `msg_${Date.now()}_assistant`,
      role: "assistant",
      text: replyText,
      timestamp: now,
      tokensUsed: { input: result.tokens.input, output: result.tokens.output },
    };
    // Write messages to subcollection instead of unbounded array
    const messagesCol = sessionRef.collection("messages");
    await messagesCol.doc(userMessage.id).set(userMessage);
    await messagesCol.doc(assistantMessage.id).set(assistantMessage);
    // Extract learning insights from the exchange (fire-and-forget, cheap model)
    extractLearningInsights(data.tenantId, sessionRef, data.message, replyText, apiKey).catch(
      (err) => v2_1.logger.warn("Learning insights extraction failed:", err)
    );
    // Keep latest N messages in parent doc for preview
    const PREVIEW_MESSAGE_COUNT = 10;
    const allMessages = [...session.messages, userMessage, assistantMessage];
    const previewMessages = allMessages.slice(-PREVIEW_MESSAGE_COUNT);
    await sessionRef.set(
      {
        ...(!data.sessionId ? session : {}),
        messages: previewMessages,
        messageCount: (session.messageCount ?? session.messages.length) + 2,
        systemPrompt,
        previewMessage: data.message.substring(0, 100),
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
      },
      { merge: !!data.sessionId }
    );
    v2_1.logger.info(`Chat message in session ${sessionRef.id} for item ${data.itemId}`);
    return {
      sessionId: sessionRef.id,
      reply: replyText,
      tokensUsed: { input: result.tokens.input, output: result.tokens.output },
    };
  }
);
/**
 * Extract lightweight learning signals from a student-tutor exchange.
 * Runs fire-and-forget using the cheapest model.
 */
async function extractLearningInsights(tenantId, sessionRef, studentMessage, tutorReply, apiKey) {
  const llm = new ai_1.LLMWrapper({
    provider: "gemini",
    apiKey,
    defaultModel: "gemini-2.5-flash-lite",
    enableLogging: true,
    maxRetries: 1,
  });
  const insightResult = await llm.call(
    `Analyze this student-tutor exchange and extract learning signals.

STUDENT: ${studentMessage.substring(0, 500)}
TUTOR: ${tutorReply.substring(0, 500)}

Return JSON:
{
  "concept": "the main concept discussed (1-5 words)",
  "showedUnderstanding": true/false,
  "struggled": true/false
}`,
    {
      clientId: tenantId,
      userId: "system",
      userRole: "system",
      purpose: "ai_chat",
      operation: "learning_insight_extraction",
      resourceType: "chatSession",
      resourceId: sessionRef.id,
      model: "gemini-2.5-flash-lite",
      temperature: 0.1,
      maxTokens: 128,
    },
    { responseMimeType: "application/json" }
  );
  if (insightResult.parsed) {
    const insight = insightResult.parsed;
    const updates = {};
    if (insight.concept) {
      updates["learningInsights.conceptsTouched"] = firestore_1.FieldValue.arrayUnion(
        insight.concept
      );
    }
    if (insight.showedUnderstanding) {
      updates["learningInsights.masterySignals"] = firestore_1.FieldValue.increment(1);
    }
    if (insight.struggled) {
      updates["learningInsights.struggleSignals"] = firestore_1.FieldValue.increment(1);
    }
    if (Object.keys(updates).length > 0) {
      await sessionRef.update(updates);
    }
  }
}
//# sourceMappingURL=send-chat-message.js.map
