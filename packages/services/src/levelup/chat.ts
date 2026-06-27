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
import { requireTenant } from "../shared/context.js";
import { xrepos } from "../shared/extended-repos.js";

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

  // 1) Append the learner message.
  await chat.appendMessage(tenantId, sessionId, {
    role: "user",
    text: input.text,
    timestamp: now,
    ...(input.mediaUrls ? { mediaUrls: input.mediaUrls } : {}),
  });

  // 2) AI tutor reply (gateway is server-side; emulator stub returns deterministic json).
  let replyText = "Let me help you with that.";
  let tokensUsed: number | undefined;
  try {
    const ai = await ctx.ai.generate(
      {
        promptKey: "tutorChat",
        operation: "chat.reply",
        variables: { text: input.text, spaceId: input.spaceId, itemId: input.itemId },
      },
      { tenantId, uid: ctx.uid, now: ctx.now }
    );
    const raw = (ai.json as Doc | undefined) ?? {};
    if (typeof raw["text"] === "string" && raw["text"]) replyText = raw["text"] as string;
    else if (typeof ai.text === "string" && ai.text) replyText = ai.text;
    if (typeof ai.tokensUsed === "number") tokensUsed = ai.tokensUsed;
  } catch {
    /* gateway unavailable → deterministic fallback reply (still a valid turn) */
  }

  // 3) Append + return the assistant message.
  const messageId = await chat.appendMessage(tenantId, sessionId, {
    role: "assistant",
    text: replyText,
    timestamp: now,
    ...(tokensUsed !== undefined ? { tokensUsed } : {}),
  });

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
