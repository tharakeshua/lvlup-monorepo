/**
 * sendChatMessage — AI chat turn (testsession/content chat, REVIEW §2.2).
 *
 * TWO modes (AI-EVALUATION-CORE-PLAN.md Phase 4):
 *   • TUTOR (default): the generic learning-tutor reply (aiChat prompt), now with
 *     the real item content + conversation history in context.
 *   • CHAT-AGENT QUESTION (`chat_agent_question` items): persona-driven agent
 *     turn (agentChat prompt) with tools — `record_observation` accumulates a
 *     rolling per-dimension scorecard on the session (returned to the client —
 *     the scorecard is learner-visible), `end_conversation` (or the maxTurns
 *     budget) closes the session and runs final grading over the full transcript
 *     + observations through the Evaluation Core, persisting progress.
 *
 * The session is created lazily when `sessionId` is absent (always-subcollection
 * messages, REVIEW D6). ✅ optimistic on the user-append.
 */
import type { ReqOf, ResOf } from "@levelup/api-contract";
import type { StoredEvaluation } from "@levelup/domain";
import { authorize } from "@levelup/access";
import type { AuthContext } from "../shared/context.js";
import { requireTenant, fail } from "../shared/context.js";
import { xrepos } from "../shared/extended-repos.js";
import { projectChatBump } from "./levelup-projection.js";
import { applyProgress } from "./progress-updater.js";
import { normalizeQuestionType } from "./practice.js";
import { resolveLevelupEvaluationConfig } from "../evaluation/resolve.js";
import { evaluateWithAi } from "../evaluation/evaluate.js";
import {
  buildAgentTools,
  buildAgentTurnPrompt,
  observableDimensions,
  parseAgentToolCalls,
} from "../evaluation/agent-chat.js";
import type { AgentObservation, TranscriptTurn } from "../evaluation/types.js";

type Doc = Record<string, unknown>;

const DEFAULT_MAX_TURNS = 12;

/** Resolve the chat-relevant question fields off an item doc (practice.ts shapes). */
function resolveChatQuestion(item: Doc): {
  questionType: string;
  questionText: string;
  questionData: Doc;
  maxScore: number;
} {
  const payload = (item["payload"] as Doc | undefined) ?? {};
  const question = (payload["question"] as Doc | undefined) ?? {};
  const questionData = (payload["questionData"] as Doc | undefined) ?? {};
  const questionType = normalizeQuestionType(
    String(
      (questionData["questionType"] as string | undefined) ??
        (payload["questionType"] as string | undefined) ??
        (question["type"] as string | undefined) ??
        (item["questionType"] as string | undefined) ??
        item["type"] ??
        ""
    )
  );
  const questionText = String(
    item["content"] ??
      question["text"] ??
      questionData["prompt"] ??
      questionData["text"] ??
      item["title"] ??
      ""
  );
  const maxScore =
    (item["maxScore"] as number | undefined) ?? (question["points"] as number | undefined) ?? 1;
  return { questionType, questionText, questionData: { ...question, ...questionData }, maxScore };
}

/** Self-attribution usage block for learner-initiated chat calls (LLM tracking). */
function chatUsage(ctx: AuthContext, related: Record<string, string | undefined>) {
  return {
    actorUserId: ctx.uid,
    actorRole: ctx.role ?? "student",
    initiatedByUserId: ctx.uid,
    initiatorRole: ctx.role ?? "student",
    subjectUserId: ctx.uid,
    billingUserId: ctx.uid,
    related,
  };
}

export async function sendChatMessageService(
  input: ReqOf<"v1.levelup.sendChatMessage">,
  ctx: AuthContext
): Promise<ResOf<"v1.levelup.sendChatMessage">> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "space.read", { spaceId: input.spaceId, tenantId });

  const now = ctx.now();
  const chat = xrepos(ctx).chat;
  const language = input.language ?? "en";

  // Load the item (best-effort — chat still works when the item is unavailable)
  // to detect chat-agent questions and give the model REAL question context.
  let item: Doc | null = null;
  try {
    item = await ctx.repos.items.get(tenantId, input.itemId);
  } catch {
    item = null;
  }
  const q = item ? resolveChatQuestion(item) : null;
  const isAgentQuestion = q?.questionType === "chat_agent_question";

  // Legacy chat is deliberately tutor-only. Agent assessments need the durable
  // session/turn/lease/frozen-context runtime exposed by v1.levelup.startConversation
  // and v1.levelup.sendConversationTurn; never run their evaluator/progress path
  // through this compatibility endpoint.
  if (isAgentQuestion) {
    fail(
      "PRECONDITION_FAILED",
      "Conversational assessments must use the conversation session callables"
    );
  }

  // Resolve / lazily create the session.
  let sessionId = input.sessionId;
  let session: Doc | null = null;
  if (sessionId) {
    session = await chat.getSession(tenantId, sessionId);
    if (!session) fail("NOT_FOUND", "chat session not found");
    if ((session["userId"] as string) !== ctx.uid) fail("PERMISSION_DENIED", "not your session");
    if (session["isActive"] === false) fail("FAILED_PRECONDITION", "chat session has ended");
  } else {
    sessionId = await chat.createSession(tenantId, {
      tenantId,
      userId: ctx.uid,
      spaceId: input.spaceId,
      storyPointId: input.storyPointId,
      itemId: input.itemId,
      sessionTitle: isAgentQuestion ? "Agent conversation" : "Tutor chat",
      previewMessage: input.text,
      language,
      isActive: true,
      messageCount: 0,
      ...(isAgentQuestion ? { questionType: "chat_agent_question" } : {}),
      createdBy: ctx.uid,
      updatedBy: ctx.uid,
    });
  }

  // Prior conversation (oldest → newest) BEFORE this turn — prompt context.
  let history: TranscriptTurn[] = [];
  try {
    history = (await chat.listMessages(tenantId, sessionId)).map((m) => ({
      role: String(m["role"] ?? "user"),
      content: String(m["text"] ?? ""),
    }));
  } catch {
    history = [];
  }

  // 1) Append the learner message (+ bump the RTDB signal node — CHAT-1/AD-12:
  // the bump carries rev/lastMessageAt ONLY, never the message; watchers
  // debounce-refetch getChatSession. The tutor chat is self-owned (AD-9), so
  // the caller uid IS the session owner the bump node is keyed by.)
  await chat.appendMessage(tenantId, sessionId, {
    role: "user",
    text: input.text,
    timestamp: now,
    ...(input.mediaUrls ? { mediaUrls: input.mediaUrls } : {}),
  });
  await projectChatBump(ctx, tenantId, { userId: ctx.uid, sessionId, lastMessageAt: now });

  // Shared call context (LLM-tracking attribution — tracking-framework spec).
  const callCtx = {
    tenantId,
    uid: ctx.uid,
    role: ctx.role ?? "student",
    resourceType: "chatSession",
    resourceId: sessionId,
    spaceId: input.spaceId,
    storyPointId: input.storyPointId,
    itemId: input.itemId,
    chatSessionId: sessionId,
    now: ctx.now,
    usage: chatUsage(ctx, {
      spaceId: input.spaceId,
      storyPointId: input.storyPointId,
      itemId: input.itemId,
      chatSessionId: sessionId,
    }),
  };

  // 2) The AI turn.
  let replyText = "Let me help you with that.";
  let tokensUsed: number | undefined;
  let turnObservations: AgentObservation[] = [];
  let conversationEnded = false;

  if (isAgentQuestion && q) {
    // ── Persona-driven agent turn (tools attached) ────────────────────────────
    const config = await resolveLevelupEvaluationConfig(ctx, tenantId, input.spaceId, item ?? {});
    const dimIds = observableDimensions(config.settings).map((d) => d.id);
    const maxTurns =
      (q.questionData["maxTurns"] as number | undefined) ??
      (config.agent?.["maxConversationTurns"] as number | undefined) ??
      DEFAULT_MAX_TURNS;
    const turnsUsed = history.filter((t) => t.role === "user").length + 1;

    const agentPrompt = buildAgentTurnPrompt({
      questionText: q.questionText,
      questionData: q.questionData,
      agent: config.agent,
      settings: config.settings,
      history,
      message: input.text,
      language,
      turnsUsed,
      maxTurns,
    });

    try {
      const ai = await ctx.ai.generate(
        {
          purpose: "ai_chat",
          promptKey: "agentChat",
          operation: "chat.agentTurn",
          feature: "levelup.agent_question",
          variables: { agentPrompt },
          tools: buildAgentTools(dimIds),
          ...(typeof config.agent?.["modelOverride"] === "string"
            ? { model: config.agent["modelOverride"] as string }
            : {}),
        },
        callCtx
      );
      if (typeof ai.json === "string" && ai.json) replyText = ai.json;
      else if (typeof ai.text === "string" && ai.text) replyText = ai.text;
      else replyText = "";
      if (typeof ai.tokensUsed === "number") tokensUsed = ai.tokensUsed;

      const parsed = parseAgentToolCalls(ai.toolCalls, dimIds, now);
      turnObservations = parsed.observations;
      conversationEnded = parsed.ended;

      // The model answered ONLY with tool calls → one bounded follow-up for the
      // learner-facing reply (no tools ⇒ it must produce text).
      if (!replyText && (turnObservations.length > 0 || conversationEnded)) {
        try {
          const follow = await ctx.ai.generate(
            {
              purpose: "ai_chat",
              promptKey: "agentChat",
              operation: "chat.agentTurn",
              feature: "levelup.agent_question",
              variables: {
                agentPrompt:
                  agentPrompt +
                  "\n\n(Your observations were recorded. Now write your reply to the learner" +
                  (conversationEnded ? ", wrapping up the conversation" : "") +
                  ".)",
              },
            },
            callCtx
          );
          replyText =
            (typeof follow.json === "string" && follow.json) ||
            (typeof follow.text === "string" && follow.text) ||
            "";
          if (typeof follow.tokensUsed === "number")
            tokensUsed = (tokensUsed ?? 0) + follow.tokensUsed;
        } catch {
          /* keep empty; fallback below */
        }
      }
      if (!replyText) {
        replyText = conversationEnded
          ? "Thanks — that completes our conversation. Your responses are being evaluated."
          : "Let's keep going — tell me more.";
      }
    } catch {
      /* gateway unavailable → deterministic fallback reply (still a valid turn) */
    }

    // Turn budget exhausted ⇒ the conversation ends this turn regardless.
    if (!conversationEnded && turnsUsed >= maxTurns) conversationEnded = true;
  } else {
    // ── Generic tutor turn (real item context + history — was bare IDs) ───────
    const historyText = history
      .map((t) => `${t.role === "user" ? "LEARNER" : "TUTOR"}: ${t.content}`)
      .join("\n");
    try {
      const ai = await ctx.ai.generate(
        {
          purpose: "ai_chat",
          feature: "levelup.tutor",
          promptKey: "aiChat",
          operation: "chat.reply",
          variables: {
            itemContext: q?.questionText
              ? `The learner is working on this item: ${q.questionText}`
              : `Space: ${input.spaceId}, Lesson: ${input.storyPointId}, Item: ${input.itemId}`,
            history: historyText,
            message: input.text,
            language,
          },
        },
        callCtx
      );
      // aiChat is structured:false — adapter maps data (text string) → ai.json (string).
      if (typeof ai.json === "string" && ai.json) replyText = ai.json;
      else if (typeof ai.text === "string" && ai.text) replyText = ai.text;
      if (typeof ai.tokensUsed === "number") tokensUsed = ai.tokensUsed;
    } catch {
      /* gateway unavailable → deterministic fallback reply (still a valid turn) */
    }
  }

  // 3) Append + return the assistant message (second bump — the reply is the
  // turn other devices are actually waiting on).
  const messageId = await chat.appendMessage(tenantId, sessionId, {
    role: "assistant",
    text: replyText,
    timestamp: now,
    ...(tokensUsed !== undefined ? { tokensUsed } : {}),
  });
  await projectChatBump(ctx, tenantId, { userId: ctx.uid, sessionId, lastMessageAt: now });

  // 4) Agent-question state: accumulate the rolling scorecard on the session;
  // on end, run final grading over the transcript + observations.
  const priorObservations = Array.isArray(session?.["observations"])
    ? (session["observations"] as AgentObservation[])
    : [];
  const allObservations = [...priorObservations, ...turnObservations];
  let evaluation: StoredEvaluation | undefined;

  if (isAgentQuestion && (turnObservations.length > 0 || conversationEnded)) {
    await chat.updateSession?.(tenantId, sessionId, {
      observations: allObservations as unknown as Doc[],
      ...(conversationEnded ? { isActive: false, endedAt: now, endedBy: "agent" } : {}),
    });
  }

  if (isAgentQuestion && conversationEnded && q) {
    try {
      const config = await resolveLevelupEvaluationConfig(ctx, tenantId, input.spaceId, item ?? {});
      const transcript: TranscriptTurn[] = [
        ...history,
        { role: "user", content: input.text },
        { role: "assistant", content: replyText },
      ];
      const outcome = await evaluateWithAi(ctx.ai, callCtx, {
        question: {
          text: q.questionText,
          questionType: "chat_agent_question",
          maxScore: q.maxScore,
          typeData: q.questionData,
        },
        answer: { transcript, observations: allObservations },
        agent: config.agent,
        rubric: config.rubric,
        settings: config.settings,
        mode: "interactive",
        operation: "chat.finalize",
        feature: "levelup.agent_question",
      });
      evaluation = {
        score: outcome.score,
        maxScore: outcome.maxScore,
        correctness: outcome.correctness,
        percentage: outcome.percentage,
        strengths: outcome.strengths,
        weaknesses: outcome.weaknesses,
        missingConcepts: outcome.missingConcepts,
        ...(outcome.summary ? { summary: outcome.summary } : {}),
        ...(outcome.mistakeClassification
          ? {
              mistakeClassification:
                outcome.mistakeClassification as StoredEvaluation["mistakeClassification"],
            }
          : {}),
        confidence: outcome.confidence,
        ...(outcome.structuredFeedback
          ? {
              structuredFeedback:
                outcome.structuredFeedback as StoredEvaluation["structuredFeedback"],
            }
          : {}),
        ...(outcome.rubricBreakdown
          ? { rubricBreakdown: outcome.rubricBreakdown as StoredEvaluation["rubricBreakdown"] }
          : {}),
      };
      await applyProgress(
        {
          userId: ctx.uid,
          spaceId: input.spaceId,
          items: [
            {
              storyPointId: input.storyPointId,
              itemId: input.itemId,
              score: evaluation.score,
              maxScore: evaluation.maxScore,
              correct: evaluation.correctness >= 1,
              evaluation: evaluation as unknown as Doc,
            },
          ],
        },
        ctx
      );
      await chat.updateSession?.(tenantId, sessionId, {
        evaluation: evaluation as unknown as Doc,
      });
    } catch {
      // Grading failed (gateway down, …): the conversation still ended; the
      // learner can submit the transcript through evaluateAnswer later.
      evaluation = undefined;
    }
  }

  return {
    sessionId,
    message: {
      id: messageId,
      role: "assistant",
      text: replyText,
      timestamp: now,
      ...(tokensUsed !== undefined ? { tokensUsed } : {}),
    },
    ...(tokensUsed !== undefined ? { tokensUsed } : {}),
    ...(isAgentQuestion && allObservations.length > 0
      ? {
          observations: allObservations.map((o) => ({
            dimensionId: o.dimensionId,
            evidence: o.evidence,
            ...(o.provisionalScore !== undefined ? { provisionalScore: o.provisionalScore } : {}),
          })),
        }
      : {}),
    ...(conversationEnded ? { conversationEnded: true } : {}),
    ...(evaluation ? { evaluation } : {}),
  } as unknown as ResOf<"v1.levelup.sendChatMessage">;
}

/* ── read projections (strict-schema exact; VALIDATE_RESPONSES gate) ───────── */

/** Project a raw message doc → domain `ChatMessage` (drops any stray at-rest field). */
function toMessageView(m: Doc): Doc {
  const out: Doc = {
    id: m["id"],
    role: m["role"],
    text: m["text"],
    timestamp: m["timestamp"],
  };
  if (Array.isArray(m["mediaUrls"])) out["mediaUrls"] = m["mediaUrls"];
  if (typeof m["tokensUsed"] === "number") out["tokensUsed"] = m["tokensUsed"];
  return out;
}

/** Project a raw session doc → `ChatSessionView` (systemPrompt ⚷ stripped, strict). */
function toSessionView(s: Doc, messages: Doc[]): Doc {
  const out: Doc = {
    id: s["id"],
    tenantId: s["tenantId"],
    userId: s["userId"],
    spaceId: s["spaceId"],
    storyPointId: s["storyPointId"],
    itemId: s["itemId"],
    sessionTitle: (s["sessionTitle"] as string) ?? "Tutor chat",
    previewMessage: (s["previewMessage"] as string) ?? "",
    messageCount:
      typeof s["messageCount"] === "number" ? (s["messageCount"] as number) : messages.length,
    language: (s["language"] as string) ?? "en",
    isActive: s["isActive"] !== false,
    messages: messages.map(toMessageView),
    createdAt: s["createdAt"],
    updatedAt: s["updatedAt"],
    createdBy: (s["createdBy"] as string) ?? (s["userId"] as string),
    updatedBy: (s["updatedBy"] as string) ?? (s["userId"] as string),
  };
  if (s["questionType"] !== undefined) out["questionType"] = s["questionType"];
  if (s["agentId"] !== undefined) out["agentId"] = s["agentId"];
  if (s["agentName"] !== undefined) out["agentName"] = s["agentName"];
  return out;
}

/** Project a raw session doc → `ChatSessionSummary` (list row; no message body, strict). */
function toSessionSummary(s: Doc): Doc {
  return {
    id: s["id"],
    spaceId: s["spaceId"],
    storyPointId: s["storyPointId"],
    itemId: s["itemId"],
    sessionTitle: (s["sessionTitle"] as string) ?? "Tutor chat",
    previewMessage: (s["previewMessage"] as string) ?? "",
    messageCount: typeof s["messageCount"] === "number" ? (s["messageCount"] as number) : 0,
    language: (s["language"] as string) ?? "en",
    isActive: s["isActive"] !== false,
    updatedAt: s["updatedAt"],
  };
}

/**
 * getChatSession — full ChatSessionView incl. the always-subcollection messages
 * (systemPrompt ⚷ stripped). Owner reads own session; others need `space.read`.
 */
export async function getChatSessionService(
  input: ReqOf<"v1.levelup.getChatSession">,
  ctx: AuthContext
): Promise<ResOf<"v1.levelup.getChatSession">> {
  const tenantId = requireTenant(ctx);
  const chat = xrepos(ctx).chat;

  const session = await chat.getSession(tenantId, input.sessionId);
  if (!session) fail("NOT_FOUND", "chat session not found");
  if ((session["userId"] as string) !== ctx.uid) {
    authorize(ctx, "space.read", { spaceId: session["spaceId"] as string, tenantId });
  }

  const messages = await chat.listMessages(tenantId, input.sessionId);
  return {
    session: toSessionView(session, messages),
  } as unknown as ResOf<"v1.levelup.getChatSession">;
}

/**
 * listChatSessions — paginated ChatSessionSummary list for the caller (own
 * sessions only; most-recently-updated first). No message bodies.
 */
export async function listChatSessionsService(
  input: ReqOf<"v1.levelup.listChatSessions">,
  ctx: AuthContext
): Promise<ResOf<"v1.levelup.listChatSessions">> {
  const tenantId = requireTenant(ctx);
  const chat = xrepos(ctx).chat;

  const page = await chat.listSessions(tenantId, ctx.uid, {
    spaceId: input.spaceId,
    itemId: input.itemId,
    cursor: input.cursor,
    limit: input.limit ?? 20,
  });

  return {
    items: page.items.map(toSessionSummary),
    nextCursor: page.nextCursor,
  } as unknown as ResOf<"v1.levelup.listChatSessions">;
}
