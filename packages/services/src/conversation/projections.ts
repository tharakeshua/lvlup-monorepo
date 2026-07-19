/** Explicit learner-safe allowlist projections. Never spread durable documents. */
import type {
  ConversationError,
  ConversationMessage,
  ConversationMessageView,
  ConversationSessionDoc,
  ConversationSessionSummaryView,
  ConversationSessionView,
  ConversationTurnDoc,
  ConversationTurnView,
  ItemSubmissionDoc,
} from "@levelup/domain";
import {
  canAbandon,
  canFinish,
  canSend,
  toTurnViewStatus,
  turnMayBeRetried,
} from "./state-machine.js";

export type ConversationGradingProjection = NonNullable<ConversationSessionView["grading"]>;

export function projectConversationMessage(message: ConversationMessage): ConversationMessageView {
  return {
    id: message.id,
    sequence: message.sequence,
    role: message.role,
    origin: message.origin,
    content: message.content,
    ...(message.clientMessageId ? { clientMessageId: message.clientMessageId } : {}),
    deliveryStatus: message.deliveryStatus,
    createdAt: message.createdAt,
    ...(message.completedAt ? { completedAt: message.completedAt } : {}),
  };
}

export function projectConversationTurn(turn: ConversationTurnDoc): ConversationTurnView {
  return {
    id: turn.id,
    clientMessageId: turn.clientMessageId,
    status: toTurnViewStatus(turn.status),
    assistantMessageIds: [...turn.assistantMessageIds],
    ...(turn.error ? { error: projectError(turn.error) } : {}),
  };
}

export function projectConversationSession(
  session: ConversationSessionDoc,
  activeTurn?: ConversationTurnDoc,
  grading?: ConversationGradingProjection
): ConversationSessionView {
  const allowedActions: ConversationSessionView["allowedActions"] = [];
  if (canSend(session)) allowedActions.push("send");
  if (canFinish(session)) allowedActions.push("finish");
  if (canAbandon(session)) allowedActions.push("abandon");
  if (activeTurn && turnMayBeRetried(activeTurn)) allowedActions.push("retry_turn");

  return {
    id: session.id,
    mode: session.mode,
    context: session.context,
    contextBaseKey: session.contextBaseKey,
    contextKey: session.contextKey,
    title: session.title,
    locale: session.locale,
    status: session.status,
    revision: session.revision,
    learnerTurnCount: session.learnerTurnCount,
    publicConfig: session.publicConfig,
    ...(session.completionRecommendation
      ? { completionRecommendation: session.completionRecommendation }
      : {}),
    ...(activeTurn &&
    (activeTurn.status === "claimed" ||
      activeTurn.status === "model_running" ||
      activeTurn.status === "tool_running" ||
      activeTurn.status === "failed_recoverable")
      ? {
          activeTurn: {
            id: activeTurn.id,
            status: activeTurn.status === "failed_recoverable" ? "failed_recoverable" : "running",
            clientMessageId: activeTurn.clientMessageId,
          },
        }
      : {}),
    ...(grading ? { grading } : {}),
    ...(session.safeResult ? { result: session.safeResult } : {}),
    allowedActions,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    ...(session.completedAt ? { completedAt: session.completedAt } : {}),
  };
}

export function projectConversationSummary(
  session: ConversationSessionDoc
): ConversationSessionSummaryView {
  return {
    id: session.id,
    mode: session.mode,
    context: session.context,
    contextBaseKey: session.contextBaseKey,
    title: session.title,
    locale: session.locale,
    status: session.status,
    learnerTurnCount: session.learnerTurnCount,
    ...(session.lastMessageAt ? { lastMessageAt: session.lastMessageAt } : {}),
    ...(session.lastMessagePreview ? { lastMessagePreview: session.lastMessagePreview } : {}),
    updatedAt: session.updatedAt,
    ...(session.completedAt ? { completedAt: session.completedAt } : {}),
  };
}

/** Project submission workflow state without exposing evaluator/model/attempt details. */
export function projectGrading(
  session: ConversationSessionDoc,
  submission: ItemSubmissionDoc | null | undefined,
  now: string
): ConversationGradingProjection | undefined {
  if (session.status !== "grading_pending" && session.status !== "grading_failed") return undefined;
  const workflow = submission?.workflow;
  const error = workflow?.lastError;
  const retryAt = workflow?.nextRetryAt;
  const retryAfterMs = retryAt ? Math.max(1, Date.parse(retryAt) - Date.parse(now)) : undefined;
  return {
    status: session.status === "grading_pending" ? "pending" : "failed",
    retryable: error?.retryable ?? session.status === "grading_pending",
    ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
    ...(error?.safeMessage ? { safeMessage: error.safeMessage } : {}),
  };
}

function projectError(error: ConversationError): ConversationError {
  return { code: error.code, retryable: error.retryable, safeMessage: error.safeMessage };
}
