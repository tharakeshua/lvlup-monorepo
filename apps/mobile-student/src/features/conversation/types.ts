/**
 * Mobile-only conversation shapes.
 *
 * These intentionally mirror the learner-safe projection from the frozen
 * conversational-AI LLD. The query adapter narrows the shared contract at the
 * transport boundary, keeping the controller and UI independent of wire
 * details while still consuming the shared typed hooks.
 */
import type { SendConversationTurnRequest } from "@levelup/api-contract";

export type ConversationMode = "tutor" | "question_help" | "agent_assessment";

export type ConversationSessionStatus =
  | "active"
  | "ready_to_finish"
  | "finalizing"
  | "grading_pending"
  | "grading_failed"
  | "completed"
  | "abandoned";

export type ConversationUiState =
  | "bootstrapping"
  | "active"
  | "sending"
  | "send_failed"
  | "ready_to_finish"
  | "finalizing"
  | "grading_pending"
  | "grading_failed"
  | "completed"
  | "abandoned"
  | "fatal";

export type ConversationAction = "send" | "finish" | "abandon" | "retry_turn";

export type TutorContext =
  | { kind: "tutor"; scope: "space"; spaceId: string }
  | { kind: "tutor"; scope: "story_point"; spaceId: string; storyPointId: string }
  | {
      kind: "tutor";
      scope: "item";
      spaceId: string;
      storyPointId: string;
      itemId: string;
    };

export interface QuestionHelpContext {
  kind: "question_help";
  spaceId: string;
  storyPointId: string;
  itemId: string;
  attemptId?: string;
}

export interface AgentAssessmentContext {
  kind: "agent_assessment";
  spaceId: string;
  storyPointId: string;
  itemId: string;
}

export type ConversationContext = TutorContext | QuestionHelpContext | AgentAssessmentContext;

export interface ConversationCitation {
  type: "citation";
  sourceId: string;
  label: string;
  itemId?: string;
  storyPointId?: string;
}

export type ConversationContentBlock =
  | { type: "text"; text: string }
  | ConversationCitation
  | {
      /** Phase 1–5 only permits images; do not add an audio composer here. */
      type: "media";
      mediaKind: "image";
      storagePath: string;
      mimeType: string;
      altText?: string;
    };

export interface ConversationMessageView {
  id: string;
  sequence: number;
  role: "learner" | "assistant";
  origin: "opening" | "turn";
  content: ConversationContentBlock[];
  clientMessageId?: string;
  deliveryStatus: "accepted" | "complete";
  createdAt: string;
  completedAt?: string;
  /** Local-only view metadata; never persisted or sent to the server. */
  localStatus?: "sending" | "failed";
  localError?: ConversationError;
}

export interface ConversationTurnView {
  id: string;
  clientMessageId: string;
  status: "running" | "completed" | "failed_recoverable" | "failed_terminal";
  assistantMessageIds: string[];
  error?: ConversationError;
}

export interface ConversationError {
  code: string;
  safeMessage: string;
  retryable?: boolean;
}

export interface ConversationCompletionPolicy {
  minLearnerTurns?: number;
  maxLearnerTurns?: number;
  allowEarlyFinish?: boolean;
  hardLimitAction?: "auto_finalize";
  hardLimitReached?: boolean;
}

export interface ConversationCompletionRecommendation {
  reasonCode?:
    | "objectives_covered"
    | "learner_requested"
    | "insufficient_new_evidence"
    | "hard_limit";
  coveredPublicObjectiveIds?: string[];
  remainingPublicObjectiveIds?: string[];
  hardLimitReached?: boolean;
  recommendedAt?: string;
}

export interface ConversationObjective {
  id: string;
  label: string;
}

export interface ConversationPublicConfig {
  scenario?: string;
  publicLearningObjectives?: ConversationObjective[];
  conversationStarters?: string[];
  openingMessage?: string;
  completionPolicy?: ConversationCompletionPolicy;
  configurationFingerprint?: string;
  sourceVersions?: {
    resourceType: "space" | "story_point" | "item" | "interviewer_agent";
    resourceId: string;
    version: number;
  }[];
}

export interface ConversationEvaluationView {
  score?: number;
  maxScore?: number;
  correctness?: number;
  percentage?: number;
  summary?: string | { keyTakeaway?: string; overallComment?: string };
  feedback?: string;
  strengths?: string[];
  weaknesses?: string[];
}

export interface ConversationResultView {
  submissionId?: string;
  evaluation?: ConversationEvaluationView;
  progressApplied?: boolean;
}

/** Durable grading projection; do not infer it from a timed-out finish request. */
export interface ConversationGradingView {
  status: "pending" | "failed";
  retryable: boolean;
  retryAfterMs?: number;
  safeMessage?: string;
}

export interface ConversationActiveTurn {
  id: string;
  status: "running" | "failed_recoverable";
  clientMessageId: string;
}

/** The exact learner-safe projection supplied by `getConversation`. */
export interface ConversationSessionView {
  id: string;
  mode: ConversationMode;
  context: ConversationContext;
  contextBaseKey: string;
  contextKey: string;
  title?: string;
  locale?: string;
  status: ConversationSessionStatus;
  revision?: number;
  learnerTurnCount?: number;
  publicConfig?: ConversationPublicConfig;
  completionRecommendation?: ConversationCompletionRecommendation;
  activeTurn?: ConversationActiveTurn;
  result?: ConversationResultView;
  grading?: ConversationGradingView;
  allowedActions?: ConversationAction[];
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string;
}

/** List projections deliberately omit transcript/result internals. */
export interface ConversationSessionSummaryView {
  id: string;
  mode: ConversationMode;
  context: ConversationContext;
  contextBaseKey: string;
  title?: string;
  locale?: string;
  status: ConversationSessionStatus;
  learnerTurnCount?: number;
  /** Learner-safe normalized preview supplied only for the scoped history picker. */
  lastMessagePreview?: string;
  updatedAt?: string;
  completedAt?: string;
}

export interface ConversationPage {
  session: ConversationSessionView;
  messages: ConversationMessageView[];
  nextMessageCursor?: string | null;
  activeTurn?: ConversationTurnView;
}

export interface StartConversationResponse {
  session: ConversationSessionView;
  messages: ConversationMessageView[];
  resumed: boolean;
}

export interface SendConversationResponse {
  session: ConversationSessionView;
  acceptedMessage: ConversationMessageView;
  assistantMessages: ConversationMessageView[];
  turn: ConversationTurnView;
  replayed: boolean;
}

export interface FinishConversationResponse {
  session: ConversationSessionView;
  submission?: { id?: string };
  result?: ConversationResultView;
  replayed: boolean;
}

export interface AbandonConversationResponse {
  session: ConversationSessionView;
  replayed: boolean;
}

/** Learner-controlled, JSON-safe snapshot from the exact callable contract. */
export type QuestionHelpDraftSnapshot = NonNullable<
  SendConversationTurnRequest["input"]["questionHelpDraft"]
>;

/** Exact retryable payload, including image-only media and help draft shape. */
export type ConversationTurnInput = SendConversationTurnRequest["input"];

/**
 * The controller's data seam.  The app's query adapter is the only place that
 * connects this to `@levelup/query`; neither UI component calls a callable or
 * Firebase directly.
 */
export interface ConversationOperations {
  get(sessionId: string): Promise<ConversationPage>;
  start(input: {
    clientRequestId: string;
    mode: ConversationMode;
    context: ConversationContext;
    locale?: string;
  }): Promise<StartConversationResponse>;
  send(input: {
    sessionId: string;
    clientMessageId: string;
    input: ConversationTurnInput;
  }): Promise<SendConversationResponse>;
  finish(input: {
    sessionId: string;
    clientRequestId: string;
    reason: "learner_requested";
    earlyFinishConfirmed?: boolean;
  }): Promise<FinishConversationResponse>;
  abandon(input: {
    sessionId: string;
    clientRequestId: string;
  }): Promise<AbandonConversationResponse>;
}

export interface ConversationController {
  state: ConversationUiState;
  session?: ConversationSessionView;
  messages: ConversationMessageView[];
  draft: string;
  pendingClientMessageId?: string;
  error?: ConversationError;
  canSend: boolean;
  canFinish: boolean;
  canAbandon: boolean;
  /** True only when the original UUID and byte-identical input are both available. */
  canRetryFailedTurn: boolean;
  isOffline: boolean;
  isTurnActive: boolean;

  start(): Promise<void>;
  setDraft(value: string): void;
  send(): Promise<void>;
  retrySend(): Promise<void>;
  /** Leaves the failed turn intact on the server but lets the learner compose anew. */
  discardFailedSend(): void;
  finish(options?: { earlyFinishConfirmed?: boolean }): Promise<void>;
  abandon(): Promise<void>;
  refresh(): Promise<void>;
  /** Query-cache bridge only: apply an already-authoritative callable projection. */
  applyServerPage(page: ConversationPage): void;
  /** Query-cache bridge only: surface a safe read failure without inventing state. */
  reportReadFailure(error: unknown): void;
}

export interface ConversationControllerOptions {
  mode: ConversationMode;
  context: ConversationContext;
  operations: ConversationOperations;
  /** A route-owned session is always preferred over the local resume record. */
  sessionId?: string;
  locale?: string;
  /** Call `start` automatically after reading safe AsyncStorage state. */
  autoStart?: boolean;
  /** Question-help sends this ungraded snapshot on each turn when provided. */
  getQuestionHelpDraft?: () => QuestionHelpDraftSnapshot | undefined;
}
