/** Start/resume one exact-scope conversation without a start-time model call. */
import {
  StartConversationRequestSchema,
  type StartConversationRequest,
  type StartConversationResponse,
} from "@levelup/api-contract";
import { authorize } from "@levelup/access";
import type { AuthContext } from "../shared/context.js";
import { fail, requireTenant } from "../shared/context.js";
import { contextBaseKey, conversationSessionId, openingMessageId } from "./ids.js";
import { assertConversationModeEnabled, assertStartContextMode } from "./policy.js";
import { buildConversationStartPlan } from "./context-builder.js";
import {
  projectConversationMessage,
  projectConversationSession,
  projectGrading,
} from "./projections.js";

export async function startConversationService(
  request: StartConversationRequest,
  ctx: AuthContext
): Promise<StartConversationResponse> {
  const parsed = StartConversationRequestSchema.safeParse(request);
  if (!parsed.success) fail("VALIDATION_ERROR", "Invalid start conversation request");
  const input = parsed.data;
  const tenantId = requireTenant(ctx);
  assertStartContextMode(input.mode, input.context);
  authorize(ctx, "chat.send", { tenantId, spaceId: input.context.spaceId, ownerUid: ctx.uid });

  const tenant = await ctx.repos.tenants.get(tenantId, tenantId);
  assertConversationModeEnabled(tenant, input.mode);

  const now = ctx.now();
  const sessionId = conversationSessionId(tenantId, ctx.uid, input.clientRequestId);
  const plan = await buildConversationStartPlan(
    {
      tenantId,
      ownerUid: ctx.uid,
      mode: input.mode,
      context: input.context,
      ...(input.locale ? { locale: input.locale } : {}),
      now,
    },
    ctx
  );
  const result = await ctx.repos.conversations.start({
    tenantId,
    ownerUid: ctx.uid,
    ...(ctx.entityIds.studentId ? { learnerStudentId: ctx.entityIds.studentId } : {}),
    sessionId,
    clientRequestId: input.clientRequestId,
    mode: input.mode,
    startContext: input.context,
    contextBaseKey: contextBaseKey(input.context),
    sessionBase: plan.sessionBase,
    sourceVersionChecks: plan.sourceVersionChecks,
    openingMessage: {
      id: openingMessageId(sessionId),
      content: [{ type: "text", text: plan.openingText }],
    },
    now,
  });

  const submissionId = result.session.finalization?.submissionId;
  const submission = submissionId
    ? await ctx.repos.itemSubmissions.get(tenantId, submissionId)
    : undefined;
  return {
    session: projectConversationSession(
      result.session,
      undefined,
      projectGrading(result.session, submission, now)
    ),
    messages: result.messages.map((message) => projectConversationMessage(message)),
    resumed: result.resumed,
  };
}
