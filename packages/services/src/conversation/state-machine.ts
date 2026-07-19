/** Pure lifecycle guards shared by command services and projections. */
import type {
  ConversationCompletionRecommendation,
  ConversationMode,
  ConversationSessionDoc,
  ConversationSessionStatus,
  ConversationTurnDoc,
  ConversationTurnStatus,
} from "@levelup/domain";

export const TERMINAL_SESSION_STATUSES = new Set<ConversationSessionStatus>([
  "completed",
  "abandoned",
]);
export const NONTERMINAL_SESSION_STATUSES = new Set<ConversationSessionStatus>([
  "active",
  "ready_to_finish",
  "finalizing",
  "grading_pending",
  "grading_failed",
]);

export function isTerminalSessionStatus(status: ConversationSessionStatus): boolean {
  return TERMINAL_SESSION_STATUSES.has(status);
}

export function isTurnRunning(status: ConversationTurnStatus): boolean {
  return status === "claimed" || status === "model_running" || status === "tool_running";
}

export function isTurnReplayable(status: ConversationTurnStatus): boolean {
  return status === "completed" || status === "failed_terminal";
}

export function isHardLimitReached(
  session: Pick<ConversationSessionDoc, "completionRecommendation">
): boolean {
  return session.completionRecommendation?.hardLimitReached === true;
}

export function canSend(
  session: Pick<ConversationSessionDoc, "status" | "activeTurnId" | "completionRecommendation">
): boolean {
  return (
    (session.status === "active" || session.status === "ready_to_finish") &&
    !session.activeTurnId &&
    !isHardLimitReached(session)
  );
}

export function canFinish(
  session: Pick<ConversationSessionDoc, "status" | "activeTurnId">
): boolean {
  return (
    (session.status === "active" || session.status === "ready_to_finish") && !session.activeTurnId
  );
}

export function canAbandon(
  session: Pick<ConversationSessionDoc, "status" | "activeTurnId" | "completionRecommendation">
): boolean {
  return canFinish(session) && !isHardLimitReached(session);
}

export function nextStatusAfterTurn(
  mode: ConversationMode,
  recommendation: ConversationCompletionRecommendation | undefined,
  hardLimitReached: boolean
): Extract<ConversationSessionStatus, "active" | "ready_to_finish"> {
  return mode === "agent_assessment" && (hardLimitReached || recommendation !== undefined)
    ? "ready_to_finish"
    : "active";
}

export function toTurnViewStatus(
  status: ConversationTurnStatus
): "running" | "completed" | "failed_recoverable" | "failed_terminal" {
  switch (status) {
    case "claimed":
    case "model_running":
    case "tool_running":
      return "running";
    case "completed":
    case "failed_recoverable":
    case "failed_terminal":
      return status;
  }
}

export function turnMayBeRetried(turn: Pick<ConversationTurnDoc, "status">): boolean {
  return turn.status === "failed_recoverable";
}
