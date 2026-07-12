/**
 * sendChatMessage — AI tutor turn (testsession/content chat, REVIEW §2.2).
 *
 * Appends the learner message, runs the AI gateway (server-side; cost/quota/key all
 * behind `ctx.ai`), appends the assistant reply, and returns the concrete assistant
 * `ChatMessage` (never `unknown`). The session is created lazily when `sessionId` is
 * absent (always-subcollection messages, REVIEW D6). ✅ optimistic on the user-append.
 */
import type { ReqOf, ResOf } from "@levelup/api-contract";
import { authorize } from "@levelup/access";
import type { AuthContext } from "../shared/context.js";
import { requireTenant, fail } from "../shared/context.js";
import { xrepos } from "../shared/extended-repos.js";
import { projectChatBump } from "./levelup-projection.js";

type Doc = Record<string, unknown>;

export async function sendChatMessageService(
  input: ReqOf<"v1.levelup.sendChatMessage">,
  ctx: AuthContext
): Promise<ResOf<"v1.levelup.sendChatMessage">> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "space.read", { spaceId: input.spaceId, tenantId });

  const now = ctx.now();
  const chat = xrepos(ctx).chat;

  // Resolve / lazily create the session.
  let sessionId = input.sessionId;
  if (!sessionId) {
    sessionId = await chat.createSession(tenantId, {
      tenantId,
      userId: ctx.uid,
      spaceId: input.spaceId,
      storyPointId: input.storyPointId,
      itemId: input.itemId,
      sessionTitle: "Tutor chat",
      previewMessage: input.text,
      language: input.language ?? "en",
      isActive: true,
      messageCount: 0,
      createdBy: ctx.uid,
      updatedBy: ctx.uid,
    });
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

  // 2) AI tutor reply (gateway is server-side; emulator stub returns deterministic text).
  let replyText = "Let me help you with that.";
  let tokensUsed: number | undefined;
  try {
    const ai = await ctx.ai.generate(
      {
        purpose: "ai_chat",
        promptKey: "aiChat",
        operation: "chat.reply",
        variables: {
          itemContext: `Space: ${input.spaceId}, Lesson: ${input.storyPointId}, Item: ${input.itemId}`,
          message: input.text,
          language: input.language ?? "en",
        },
      },
      {
        tenantId,
        uid: ctx.uid,
        role: ctx.role,
        resourceType: "chatSession",
        resourceId: sessionId,
        now: ctx.now,
      }
    );
    // aiChat is structured:false — adapter maps data (text string) → ai.json (string).
    if (typeof ai.json === "string" && ai.json) replyText = ai.json;
    else if (typeof ai.text === "string" && ai.text) replyText = ai.text;
    if (typeof ai.tokensUsed === "number") tokensUsed = ai.tokensUsed;
  } catch {
    /* gateway unavailable → deterministic fallback reply (still a valid turn) */
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
