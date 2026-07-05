import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { assertAuth, assertTenantMember } from "../utils/auth";
import { loadItem, loadAgent, loadSpace } from "../utils/firestore";
import { enforceRateLimit } from "../utils/rate-limit";
import { checkMessageSafety, checkRateLimitAbuse } from "../utils/chat-safety";
import { buildTutorSystemPrompt } from "../prompts/tutor";
import { LLMWrapper, getGeminiApiKey } from "@levelup/shared-services/ai";
import { isoNow } from "@levelup/domain";
import { SendChatMessageRequestSchema } from "../contracts/wire";
import { parseRequest } from "../utils";
import type { Agent, ChatSession, ChatMessage, QuestionPayload } from "../types";
import { ChatSessionDocSchema as ChatSessionSchema } from "../contracts/legacy-docs";

interface SendChatMessageRequest {
  tenantId: string;
  spaceId: string;
  storyPointId: string;
  itemId: string;
  sessionId?: string;
  message: string;
  language?: string;
  agentId?: string;
}

/**
 * AI tutor chat — send a message and get a response.
 *
 * Builds context from the current item, resolves tutor agent,
 * and uses Socratic method to guide students.
 * Rate limited: 10 messages/min per user.
 */
export const sendChatMessage = onCall(
  { region: "asia-south1", timeoutSeconds: 30, cors: true },
  async (request) => {
    const callerUid = assertAuth(request.auth);
    const data = parseRequest(request.data, SendChatMessageRequestSchema);

    if (!data.tenantId || !data.spaceId || !data.itemId || !data.message?.trim()) {
      throw new HttpsError(
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

    await assertTenantMember(callerUid, data.tenantId);

    // Safety check: block prompt injection and non-educational content
    const safetyResult = checkMessageSafety(data.message);
    if (!safetyResult.safe) {
      throw new HttpsError(
        "invalid-argument",
        safetyResult.reason ?? "Message blocked by safety filter."
      );
    }

    // Check for rate limit abuse (50 messages/hour)
    const abuseResult = checkRateLimitAbuse(callerUid);
    if (!abuseResult.safe) {
      throw new HttpsError("resource-exhausted", abuseResult.reason ?? "Too many messages.");
    }

    // Rate limit: 10 messages/min per user
    await enforceRateLimit(data.tenantId, callerUid, "chat", 10);

    const db = admin.firestore();

    // Load item
    const item = await loadItem(data.tenantId, data.spaceId, data.itemId);

    // Resolve tutor agent
    let agent: Agent | null = null;
    if (data.agentId) {
      agent = await loadAgent(data.tenantId, data.spaceId, data.agentId);
    }
    if (!agent) {
      const space = await loadSpace(data.tenantId, data.spaceId);
      if (space.defaultTutorAgentId) {
        agent = await loadAgent(data.tenantId, data.spaceId, space.defaultTutorAgentId);
      }
    }

    const language = data.language ?? agent?.defaultLanguage ?? "english";

    // Load or create chat session
    let session: ChatSession;
    let sessionRef: admin.firestore.DocumentReference;

    if (data.sessionId) {
      sessionRef = db.doc(`tenants/${data.tenantId}/chatSessions/${data.sessionId}`);
      const sessionDoc = await sessionRef.get();
      if (!sessionDoc.exists) {
        throw new HttpsError("not-found", "Chat session not found");
      }
      const sessionResult = ChatSessionSchema.safeParse({
        id: sessionDoc.id,
        ...sessionDoc.data(),
      });
      if (!sessionResult.success) {
        logger.error("Invalid ChatSession document", {
          docId: sessionDoc.id,
          errors: sessionResult.error.flatten(),
        });
        throw new HttpsError("internal", "Data integrity error");
      }
      session = sessionResult.data as unknown as ChatSession;
      if (session.userId !== callerUid) {
        throw new HttpsError("permission-denied", "Not your chat session");
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
        questionType:
          item.type === "question" ? (item.payload as QuestionPayload).questionType : undefined,
        agentId: agent?.id ?? undefined,
        agentName: agent?.name ?? "AI Tutor",
        sessionTitle: item.title ?? "Chat Session",
        previewMessage: data.message.substring(0, 100),
        messageCount: 0,
        language,
        isActive: true,
        messages: [],
        systemPrompt: "",
        createdAt: isoNow(),
        updatedAt: isoNow(),
      } satisfies ChatSession;
    }

    // Build system prompt
    const systemPrompt = buildTutorSystemPrompt(agent, item, undefined, undefined, language);

    // Enforce max conversation turns if configured
    if (agent?.maxConversationTurns && session.messages.length >= agent.maxConversationTurns) {
      throw new HttpsError(
        "resource-exhausted",
        `Maximum conversation length of ${agent.maxConversationTurns} messages reached`
      );
    }

    // Load full conversation history from subcollection for better context
    // Use subcollection messages for existing sessions (more complete than preview array)
    let conversationMessages: Array<{ role: "user" | "assistant"; content: string }>;
    let conversationSummary: string | undefined;
    const SUMMARIZE_THRESHOLD = 20;

    if (data.sessionId) {
      const messagesSnap = await sessionRef
        .collection("messages")
        .orderBy("timestamp", "asc")
        .get();
      const allMessages = messagesSnap.docs.map((doc) => {
        const msg = doc.data() as ChatMessage;
        return { role: msg.role as "user" | "assistant", content: msg.text };
      });

      // If conversation is long, use LLM-based summarization for better context
      if (allMessages.length > SUMMARIZE_THRESHOLD) {
        conversationMessages = allMessages.slice(-10);

        // Check if we have a cached summary that's still fresh
        const sessionData = (await sessionRef.get()).data();
        const cachedSummary = sessionData?.conversationSummary as string | undefined;
        const summaryMessageCount = (sessionData?.summaryAtMessageCount as number) ?? 0;
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
            const summaryApiKey = await getGeminiApiKey(data.tenantId);
            const summaryLlm = new LLMWrapper({
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
              .catch((err) => logger.warn("Failed to cache conversation summary:", err));
          } catch (summaryErr) {
            // Fallback to naive truncation if LLM summary fails
            logger.warn("LLM summarization failed, using fallback:", summaryErr);
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
      conversationMessages = session.messages.map((m: ChatMessage) => ({
        role: m.role as "user" | "assistant",
        content: m.text,
      }));
    }

    // Get API key and call LLM
    const apiKey = await getGeminiApiKey(data.tenantId);
    const llm = new LLMWrapper({ provider: "gemini", apiKey, enableLogging: true });

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
    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}_user`,
      role: "user",
      text: data.message,
      timestamp: now,
    };

    const assistantMessage: ChatMessage = {
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
      (err) => logger.warn("Learning insights extraction failed:", err)
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
        updatedAt: isoNow(),
      },
      { merge: !!data.sessionId }
    );

    logger.info(`Chat message in session ${sessionRef.id} for item ${data.itemId}`);

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
async function extractLearningInsights(
  tenantId: string,
  sessionRef: admin.firestore.DocumentReference,
  studentMessage: string,
  tutorReply: string,
  apiKey: string
): Promise<void> {
  const llm = new LLMWrapper({
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
    const insight = insightResult.parsed as {
      concept?: string;
      showedUnderstanding?: boolean;
      struggled?: boolean;
    };

    const updates: Record<string, FieldValue> = {};
    if (insight.concept) {
      updates["learningInsights.conceptsTouched"] = FieldValue.arrayUnion(insight.concept);
    }
    if (insight.showedUnderstanding) {
      updates["learningInsights.masterySignals"] = FieldValue.increment(1);
    }
    if (insight.struggled) {
      updates["learningInsights.struggleSignals"] = FieldValue.increment(1);
    }

    if (Object.keys(updates).length > 0) {
      await sessionRef.update(updates);
    }
  }
}
