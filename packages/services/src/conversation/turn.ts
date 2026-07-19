/** Durable turn claim + bounded typed tool continuation through ctx.ai only. */
import {
  SendConversationTurnRequestSchema,
  type SendConversationTurnRequest,
  type SendConversationTurnResponse,
} from "@levelup/api-contract";
import type {
  ConversationContentBlock,
  ConversationError,
  ConversationMessage,
  ConversationSessionDoc,
  ConversationTurnDoc,
} from "@levelup/domain";
import type { AuthContext, ServiceError } from "../shared/context.js";
import { fail, requireTenant } from "../shared/context.js";
import type { AiGenerateResult, AiMessage } from "../shared/ai.js";
import {
  assistantMessageId,
  canonicalHash,
  conversationTurnId,
  learnerMessageId,
  makeLease,
} from "./ids.js";
import { buildConversationTurnMessages } from "./context-builder.js";
import {
  assertConversationTurnInput,
  assertConversationModeEnabled,
  CONVERSATION_LIMITS,
} from "./policy.js";
import {
  projectConversationMessage,
  projectConversationSession,
  projectConversationTurn,
} from "./projections.js";
import { assertConversationOwner } from "./reads.js";
import { emptyToolStaging, executeConversationTool, toolDeclarationsFor } from "./tools/index.js";

type UsageAggregate = NonNullable<ConversationTurnDoc["usageAggregate"]>;

export async function sendConversationTurnService(
  request: SendConversationTurnRequest,
  ctx: AuthContext
): Promise<SendConversationTurnResponse> {
  const parsed = SendConversationTurnRequestSchema.safeParse(request);
  if (!parsed.success) fail("VALIDATION_ERROR", "Invalid conversation turn request");
  const input = parsed.data;
  const tenantId = requireTenant(ctx);
  const existingSession = await ctx.repos.conversations.getSession(tenantId, input.sessionId);
  if (!existingSession) fail("NOT_FOUND", "Conversation session was not found");
  assertConversationOwner(existingSession, ctx);
  const tenant = await ctx.repos.tenants.get(tenantId, tenantId);
  assertConversationModeEnabled(tenant, existingSession.mode);
  assertConversationTurnInput(input.input, existingSession.mode, tenantId);

  const now = ctx.now();
  const turnId = conversationTurnId(existingSession.id, input.clientMessageId);
  const learnerMessage = {
    id: learnerMessageId(existingSession.id, input.clientMessageId),
    content: learnerContent(input.input),
    createdAt: now,
  };
  const claim = await ctx.repos.conversations.claimTurn({
    tenantId,
    ownerUid: ctx.uid,
    sessionId: existingSession.id,
    turnId,
    clientMessageId: input.clientMessageId,
    requestInputHash: canonicalHash(input.input),
    learnerMessage,
    lease: makeLease(input.clientMessageId, now, CONVERSATION_LIMITS.turnLeaseMs),
    now,
  });

  if (claim.outcome === "completed_replay" || claim.outcome === "terminal_replay") {
    return replayedTurnResponse(
      claim.session,
      claim.turn,
      claim.learnerMessage,
      claim.assistantMessages
    );
  }

  return executeClaimedTurn({
    tenantId,
    ctx,
    input,
    session: claim.session,
    turn: claim.turn,
    learnerMessage: claim.learnerMessage,
  });
}

async function executeClaimedTurn(input: {
  tenantId: string;
  ctx: AuthContext;
  input: SendConversationTurnRequest;
  session: ConversationSessionDoc;
  turn: ConversationTurnDoc;
  learnerMessage: ConversationMessage;
}): Promise<SendConversationTurnResponse> {
  const { tenantId, ctx, session, turn, learnerMessage } = input;
  const leaseToken = turn.lease?.token;
  if (!leaseToken) fail("CONFLICT", "Conversation turn lease was not acquired");

  try {
    if (turn.configurationFingerprint !== session.configurationSnapshot.fingerprint) {
      fail("CONFLICT", "Conversation turn configuration does not match its frozen session");
    }
    const transcript = await ctx.repos.conversations.listMessages(tenantId, session.id, {
      limit: 100,
    });
    const messages = buildConversationTurnMessages({
      session,
      messages: transcript.items,
      ...(input.input.input.questionHelpDraft
        ? { questionHelpDraft: input.input.input.questionHelpDraft }
        : {}),
    });
    const declarations = toolDeclarationsFor(session.mode, turn.toolsetVersion);
    const staging = emptyToolStaging();
    const modelRequestIds: string[] = [];
    const usage = emptyUsage();
    let parentRequestId: string | undefined;
    let toolCallsUsed = 0;
    let toolResultBytes = 0;
    let finalText: string | undefined;

    await ctx.repos.conversations.markTurnPhase({
      tenantId,
      sessionId: session.id,
      turnId: turn.id,
      leaseToken,
      status: "model_running",
      now: ctx.now(),
    });

    for (let step = 0; step < CONVERSATION_LIMITS.maxModelStepsPerTurn; step += 1) {
      const response = await ctx.ai.generate(
        {
          promptKey: session.configurationSnapshot.prompt.key,
          purpose: "ai_chat",
          operation: "conversation.turn",
          feature: featureForMode(session.mode),
          promptVersion: session.configurationSnapshot.prompt.version,
          variables: {},
          modelPolicyId: session.configurationSnapshot.runtimeModelPolicyId,
          messages,
          tools: declarations,
          toolChoice: "auto",
          moderate: true,
        },
        aiCallContext(ctx, tenantId, session, turn, parentRequestId)
      );
      recordGatewayResponse(response, modelRequestIds, usage);
      await ctx.repos.conversations.markTurnPhase({
        tenantId,
        sessionId: session.id,
        turnId: turn.id,
        leaseToken,
        status: "model_running",
        ...(response.requestId ? { modelRequestId: response.requestId } : {}),
        now: ctx.now(),
      });

      const toolCalls = response.toolCalls ?? [];
      if (toolCalls.length === 0) {
        const text = response.text.trim();
        if (!text) fail("INTERNAL_ERROR", "Conversation model returned no learner-facing response");
        finalText = text;
        break;
      }
      if (step + 1 >= CONVERSATION_LIMITS.maxModelStepsPerTurn) {
        fail("INTERNAL_ERROR", "Conversation tool loop reached its model-step limit");
      }
      if (toolCallsUsed + toolCalls.length > CONVERSATION_LIMITS.maxToolCallsPerTurn) {
        fail("PRECONDITION_FAILED", "Conversation tool-call limit exceeded");
      }
      toolCallsUsed += toolCalls.length;
      await ctx.repos.conversations.markTurnPhase({
        tenantId,
        sessionId: session.id,
        turnId: turn.id,
        leaseToken,
        status: "tool_running",
        now: ctx.now(),
      });

      const assistantParts: Extract<AiMessage, { role: "assistant" }>["parts"] = [];
      if (response.text.trim()) {
        assistantParts.push({
          type: "text",
          provenance: "model_output",
          text: response.text.trim(),
        });
      }
      assistantParts.push(
        ...toolCalls.map((call) => ({
          type: "tool_call" as const,
          callId: call.callId,
          name: call.name,
          args: call.args,
        }))
      );
      messages.push({ role: "assistant", parts: assistantParts });

      for (let ordinal = 0; ordinal < toolCalls.length; ordinal += 1) {
        const call = toolCalls[ordinal]!;
        const executed = await executeConversationTool({
          callId: call.callId,
          name: call.name,
          args: call.args,
          step,
          ordinal,
          scope: {
            ctx,
            tenantId,
            ownerUid: ctx.uid,
            session,
            turn,
            messageSequences: new Set(transcript.items.map((message) => message.sequence)),
            now: ctx.now(),
          },
          staging,
        });
        toolResultBytes += executed.invocation.resultBytes ?? 0;
        if (toolResultBytes > CONVERSATION_LIMITS.maxAllToolResultsBytes) {
          fail("PRECONDITION_FAILED", "Conversation cumulative tool-result budget exceeded");
        }
        await ctx.repos.conversations.markTurnPhase({
          tenantId,
          sessionId: session.id,
          turnId: turn.id,
          leaseToken,
          status: "tool_running",
          toolInvocation: executed.invocation,
          now: ctx.now(),
        });
        messages.push({
          role: "tool",
          parts: [
            {
              type: "tool_result",
              callId: call.callId,
              name: call.name,
              result: executed.result,
            },
          ],
        });
      }
      parentRequestId = response.requestId;
    }

    if (!finalText)
      fail("INTERNAL_ERROR", "Conversation model did not finish within its bounded loop");
    const committed = await ctx.repos.conversations.commitTurn({
      tenantId,
      sessionId: session.id,
      turnId: turn.id,
      leaseToken,
      configurationFingerprint: session.configurationSnapshot.fingerprint,
      assistantMessages: [
        {
          id: assistantMessageId(turn.id, 0),
          content: [{ type: "text", text: finalText }],
          createdAt: ctx.now(),
          completedAt: ctx.now(),
        },
      ],
      evidence: staging.evidence,
      ...(staging.completionRecommendation
        ? { completionRecommendation: staging.completionRecommendation }
        : {}),
      modelRequestIds,
      usageAggregate: usage,
      now: ctx.now(),
    });
    if (committed.hardLimitAutoFinalize)
      await signalHardLimitFinalization(ctx, tenantId, committed.session.id);
    return {
      session: projectConversationSession(committed.session),
      acceptedMessage: projectConversationMessage(learnerMessage),
      assistantMessages: committed.assistantMessages.map(projectConversationMessage),
      turn: projectConversationTurn(committed.turn),
      replayed: false,
    };
  } catch (error) {
    const failed = await ctx.repos.conversations.failTurn({
      tenantId,
      sessionId: session.id,
      turnId: turn.id,
      leaseToken,
      terminal: isTerminalTurnError(error),
      error: safeTurnError(error),
      now: ctx.now(),
    });
    if (failed.hardLimitAutoFinalize)
      await signalHardLimitFinalization(ctx, tenantId, failed.session.id);
    return {
      session: projectConversationSession(failed.session),
      acceptedMessage: projectConversationMessage(learnerMessage),
      assistantMessages: [],
      turn: projectConversationTurn(failed.turn),
      replayed: false,
    };
  }
}

function learnerContent(input: SendConversationTurnRequest["input"]): ConversationContentBlock[] {
  return [
    { type: "text", text: input.text },
    ...(input.media ?? []).map((media) => ({
      type: "media" as const,
      mediaKind: "image" as const,
      storagePath: media.storagePath,
      mimeType: media.mimeType,
      ...(media.altText ? { altText: media.altText } : {}),
    })),
  ];
}

function replayedTurnResponse(
  session: ConversationSessionDoc,
  turn: ConversationTurnDoc,
  learnerMessage: ConversationMessage,
  assistantMessages: readonly ConversationMessage[]
): SendConversationTurnResponse {
  return {
    session: projectConversationSession(session),
    acceptedMessage: projectConversationMessage(learnerMessage),
    assistantMessages: assistantMessages.map(projectConversationMessage),
    turn: projectConversationTurn(turn),
    replayed: true,
  };
}

function emptyUsage(): UsageAggregate {
  return { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, costUsd: 0 };
}

function recordGatewayResponse(
  response: AiGenerateResult,
  requestIds: string[],
  usage: UsageAggregate
): void {
  if (response.requestId) requestIds.push(response.requestId);
  usage.inputTokens += response.tokenUsage?.inputTokens ?? 0;
  usage.outputTokens += response.tokenUsage?.outputTokens ?? response.tokensUsed;
  usage.cachedInputTokens += response.tokenUsage?.cachedInputTokens ?? 0;
  usage.costUsd += response.cost?.totalCostUsd ?? response.costUsd;
}

function aiCallContext(
  ctx: AuthContext,
  tenantId: string,
  session: ConversationSessionDoc,
  turn: ConversationTurnDoc,
  parentRequestId: string | undefined
): Parameters<AuthContext["ai"]["generate"]>[1] {
  const context = session.context;
  return {
    tenantId,
    uid: ctx.uid,
    role: ctx.role ?? "student",
    now: ctx.now,
    resourceType: "conversation_turn",
    resourceId: turn.id,
    chatSessionId: session.id,
    spaceId: context.spaceId,
    ...("storyPointId" in context ? { storyPointId: context.storyPointId } : {}),
    ...("itemId" in context ? { itemId: context.itemId } : {}),
    usage: {
      actorUserId: ctx.uid,
      actorRole: ctx.role ?? "student",
      initiatedByUserId: ctx.uid,
      initiatorRole: ctx.role ?? "student",
      subjectUserId: ctx.uid,
      billingUserId: ctx.uid,
      rootRequestId: turn.id,
      traceId: turn.id,
      ...(parentRequestId ? { parentRequestId } : {}),
      related: { conversationSessionId: session.id, conversationTurnId: turn.id },
    },
  };
}

function featureForMode(mode: ConversationSessionDoc["mode"]): string {
  switch (mode) {
    case "tutor":
      return "levelup.tutor";
    case "question_help":
      return "levelup.question_help";
    case "agent_assessment":
      return "levelup.agent_question";
  }
}

function safeTurnError(error: unknown): ConversationError {
  const service = error as Partial<ServiceError> | undefined;
  const code = typeof service?.code === "string" ? service.code : "INTERNAL_ERROR";
  return {
    code,
    retryable: !isTerminalTurnError(error),
    safeMessage:
      code === "QUOTA_EXCEEDED"
        ? "Conversation capacity is temporarily unavailable. Please try again later."
        : code === "FEATURE_DISABLED"
          ? "This conversation feature is no longer available."
          : "We could not complete that response. Retry this message to continue.",
  };
}

function isTerminalTurnError(error: unknown): boolean {
  const code =
    typeof (error as Partial<ServiceError> | undefined)?.code === "string"
      ? (error as Partial<ServiceError>).code
      : undefined;
  return code === "PERMISSION_DENIED" || code === "FEATURE_DISABLED" || code === "VALIDATION_ERROR";
}

async function signalHardLimitFinalization(
  ctx: AuthContext,
  tenantId: string,
  sessionId: string
): Promise<void> {
  // T-E owns finalization. A durable outbox hint accelerates its lease-safe worker;
  // recovery also scans ready_to_finish sessions, so ticker failure cannot lose work.
  await ctx.repos.outbox
    .enqueue(tenantId, { type: "conversation.finalization.resume", sessionId })
    .catch(() => undefined);
}
