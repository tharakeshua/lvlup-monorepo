/** Learner-owned, allowlisted conversation transcript and history reads. */
import {
  GetConversationRequestSchema,
  ListConversationsRequestSchema,
  type GetConversationRequest,
  type GetConversationResponse,
  type ListConversationsRequest,
  type ListConversationsResponse,
} from "@levelup/api-contract";
import { authorize } from "@levelup/access";
import type { ConversationSessionDoc, ConversationTurnDoc } from "@levelup/domain";
import type { AuthContext } from "../shared/context.js";
import { fail, requireTenant } from "../shared/context.js";
import { contextBaseKey } from "./ids.js";
import {
  projectConversationMessage,
  projectConversationSession,
  projectConversationSummary,
  projectConversationTurn,
  projectGrading,
} from "./projections.js";

export async function getConversationService(
  request: GetConversationRequest,
  ctx: AuthContext
): Promise<GetConversationResponse> {
  const parsed = GetConversationRequestSchema.safeParse(request);
  if (!parsed.success) fail("VALIDATION_ERROR", "Invalid get conversation request");
  const input = parsed.data;
  const tenantId = requireTenant(ctx);
  const session = await ctx.repos.conversations.getSession(tenantId, input.sessionId);
  if (!session) fail("NOT_FOUND", "Conversation session was not found");
  assertConversationOwner(session, ctx);

  const page = await ctx.repos.conversations.listMessages(tenantId, session.id, {
    ...(input.messageCursor ? { cursor: input.messageCursor } : {}),
    limit: input.messageLimit ?? 50,
  });
  const activeTurn = await readActiveTurn(ctx, tenantId, session);
  const submissionId = session.finalization?.submissionId;
  const submission = submissionId
    ? await ctx.repos.itemSubmissions.get(tenantId, submissionId)
    : undefined;
  return {
    session: projectConversationSession(
      session,
      activeTurn,
      projectGrading(session, submission, ctx.now())
    ),
    messages: page.items.map((message) => projectConversationMessage(message)),
    nextMessageCursor: page.nextCursor,
    ...(activeTurn ? { activeTurn: projectConversationTurn(activeTurn) } : {}),
  };
}

export async function listConversationsService(
  request: ListConversationsRequest,
  ctx: AuthContext
): Promise<ListConversationsResponse> {
  const parsed = ListConversationsRequestSchema.safeParse(request);
  if (!parsed.success) fail("VALIDATION_ERROR", "Invalid list conversations request");
  const input = parsed.data;
  const tenantId = requireTenant(ctx);
  authorize(ctx, "chat.send", {
    tenantId,
    ownerUid: ctx.uid,
    ...(input.context ? { spaceId: input.context.spaceId } : {}),
  });

  const page = await ctx.repos.conversations.listSessions(tenantId, ctx.uid, {
    ...(input.mode ? { mode: input.mode } : {}),
    ...(input.status ? { status: input.status } : {}),
    ...(input.context ? { contextBaseKey: contextBaseKey(input.context) } : {}),
    ...(input.cursor ? { cursor: input.cursor } : {}),
    limit: input.limit ?? 20,
  });
  return { items: page.items.map(projectConversationSummary), nextCursor: page.nextCursor };
}

export function assertConversationOwner(session: ConversationSessionDoc, ctx: AuthContext): void {
  const tenantId = requireTenant(ctx);
  if (session.tenantId !== tenantId || session.ownerUid !== ctx.uid) {
    fail("PERMISSION_DENIED", "Conversation session is not owned by this learner");
  }
  authorize(ctx, "chat.send", { tenantId, spaceId: session.context.spaceId, ownerUid: ctx.uid });
}

export async function readActiveTurn(
  ctx: AuthContext,
  tenantId: string,
  session: ConversationSessionDoc
): Promise<ConversationTurnDoc | undefined> {
  if (!session.activeTurnId) return undefined;
  const turn = await ctx.repos.conversations.getTurn(tenantId, session.id, session.activeTurnId);
  return turn ?? undefined;
}
