import type {
  ConversationError,
  ConversationMessageView,
  ConversationPage,
  ConversationSessionView,
  ConversationTurnInput,
  ConversationUiState,
  SendConversationResponse,
  StartConversationResponse,
} from "./types";

export interface ConversationMachineState {
  uiState: ConversationUiState;
  session?: ConversationSessionView;
  messages: ConversationMessageView[];
  draft: string;
  pendingClientMessageId?: string;
  /** Exact safe retry envelope, kept through failure and process-resume. */
  pendingInput?: ConversationTurnInput;
  error?: ConversationError;
  isOffline: boolean;
}

export const initialConversationMachineState: ConversationMachineState = {
  uiState: "bootstrapping",
  messages: [],
  draft: "",
  isOffline: false,
};

export type ConversationReducerAction =
  | { type: "BOOTSTRAP" }
  | {
      type: "RESTORED";
      page: ConversationPage;
      draft?: string;
      pendingClientMessageId?: string;
      pendingInput?: ConversationTurnInput;
    }
  | { type: "STARTED"; result: StartConversationResponse }
  | { type: "SYNCED"; page: ConversationPage }
  | { type: "SET_DRAFT"; value: string }
  | {
      type: "SEND_REQUESTED";
      clientMessageId: string;
      input: ConversationTurnInput;
      createdAt: string;
    }
  | { type: "SEND_SUCCEEDED"; result: SendConversationResponse }
  | { type: "SEND_FAILED"; error: ConversationError; offline: boolean }
  | { type: "DISCARD_FAILED_SEND" }
  | { type: "FINISHING" }
  | {
      type: "FINISHED";
      session: ConversationSessionView;
      result?: ConversationSessionView["result"];
    }
  | { type: "ABANDONED"; session: ConversationSessionView }
  | { type: "FATAL"; error: ConversationError; offline: boolean }
  | { type: "CLEAR_ERROR" };

function compareMessages(left: ConversationMessageView, right: ConversationMessageView): number {
  if (left.sequence !== right.sequence) return left.sequence - right.sequence;
  return left.id.localeCompare(right.id);
}

function uniqueMessages(messages: ConversationMessageView[]): ConversationMessageView[] {
  const byId = new Map<string, ConversationMessageView>();
  for (const message of messages) byId.set(message.id, message);
  return [...byId.values()].sort(compareMessages);
}

/** Reconcile only by durable IDs/client IDs — never by message text. */
export function mergeConversationMessages(
  local: ConversationMessageView[],
  authoritative: ConversationMessageView[]
): ConversationMessageView[] {
  const acknowledgedClientIds = new Set(
    authoritative.flatMap((message) => (message.clientMessageId ? [message.clientMessageId] : []))
  );
  const unresolvedLocal = local.filter(
    (message) =>
      !(
        message.localStatus &&
        message.clientMessageId &&
        acknowledgedClientIds.has(message.clientMessageId)
      )
  );
  return uniqueMessages([...authoritative, ...unresolvedLocal]);
}

export function textFromMessage(message?: ConversationMessageView): string {
  if (!message) return "";
  return message.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
}

function optimisticMessage(
  clientMessageId: string,
  input: ConversationTurnInput,
  createdAt: string
): ConversationMessageView {
  return {
    id: `optimistic:${clientMessageId}`,
    sequence: Number.MAX_SAFE_INTEGER,
    role: "learner",
    origin: "turn",
    content: [
      { type: "text", text: input.text },
      ...(input.media ?? []).map((media) => ({ type: "media" as const, ...media })),
    ],
    clientMessageId,
    deliveryStatus: "accepted",
    createdAt,
    localStatus: "sending",
  };
}

function failedTurnFor(
  session?: ConversationSessionView,
  turn?: ConversationPage["activeTurn"]
): ConversationError | undefined {
  if (
    session?.activeTurn?.status !== "failed_recoverable" &&
    turn?.status !== "failed_recoverable"
  ) {
    return undefined;
  }
  return (
    turn?.error ?? {
      code: "TURN_FAILED_RECOVERABLE",
      safeMessage: "That reply did not finish. You can retry it safely.",
      retryable: true,
    }
  );
}

function projectionUiState(
  session?: ConversationSessionView,
  pendingClientMessageId?: string,
  error?: ConversationError
): ConversationUiState {
  if (!session) return "bootstrapping";
  if (error && pendingClientMessageId) return "send_failed";
  if (session.activeTurn?.status === "failed_recoverable") return "send_failed";
  if (pendingClientMessageId) return "sending";

  switch (session.status) {
    case "active":
      return "active";
    case "ready_to_finish":
      return "ready_to_finish";
    case "finalizing":
      return "finalizing";
    case "grading_pending":
      return "grading_pending";
    case "grading_failed":
      return "grading_failed";
    case "completed":
      return "completed";
    case "abandoned":
      return "abandoned";
  }
}

function applyProjection(
  state: ConversationMachineState,
  page: ConversationPage,
  local: Pick<ConversationMachineState, "draft" | "pendingClientMessageId" | "pendingInput"> = state
): ConversationMachineState {
  const terminal = page.session.status === "completed" || page.session.status === "abandoned";
  const failed = failedTurnFor(page.session, page.activeTurn);
  const failedId = page.activeTurn?.clientMessageId ?? page.session.activeTurn?.clientMessageId;
  const locallyPendingId = local.pendingClientMessageId;
  const serverAcceptedPending = locallyPendingId
    ? page.messages.some((message) => message.clientMessageId === locallyPendingId)
    : false;
  const pendingClientMessageId = terminal
    ? undefined
    : (failedId ?? (serverAcceptedPending ? undefined : locallyPendingId));
  // Once the authoritative transcript contains this client UUID, the exact
  // retry envelope is no longer needed and must not survive the next storage
  // write. A recoverable server turn is the one exception: it still needs the
  // byte-identical input for retry.
  const pendingInput = terminal
    ? undefined
    : failed
      ? local.pendingInput
      : serverAcceptedPending
        ? undefined
        : local.pendingInput;
  const error = terminal ? undefined : (failed ?? (failedId ? state.error : undefined));

  return {
    ...state,
    session: page.session,
    messages: mergeConversationMessages(state.messages, page.messages),
    draft: terminal ? "" : local.draft,
    pendingClientMessageId,
    pendingInput,
    error,
    uiState: projectionUiState(page.session, pendingClientMessageId, error),
    isOffline: false,
  };
}

export function conversationReducer(
  state: ConversationMachineState,
  action: ConversationReducerAction
): ConversationMachineState {
  switch (action.type) {
    case "BOOTSTRAP":
      return { ...state, uiState: "bootstrapping", error: undefined };
    case "RESTORED":
      return applyProjection(state, action.page, {
        draft: action.draft ?? "",
        pendingClientMessageId: action.pendingClientMessageId,
        pendingInput: action.pendingInput,
      });
    case "STARTED":
      return applyProjection(
        state,
        { session: action.result.session, messages: action.result.messages },
        {
          draft: state.draft,
        }
      );
    case "SYNCED":
      return applyProjection(state, action.page);
    case "SET_DRAFT":
      return { ...state, draft: action.value };
    case "SEND_REQUESTED":
      return {
        ...state,
        messages: uniqueMessages([
          ...state.messages.filter(
            (message) => message.clientMessageId !== action.clientMessageId || !message.localStatus
          ),
          optimisticMessage(action.clientMessageId, action.input, action.createdAt),
        ]),
        pendingClientMessageId: action.clientMessageId,
        pendingInput: action.input,
        error: undefined,
        isOffline: false,
        uiState: "sending",
      };
    case "SEND_SUCCEEDED": {
      const failed =
        action.result.turn.status === "failed_recoverable" ? action.result.turn.error : undefined;
      const pendingId = failed ? action.result.turn.clientMessageId : undefined;
      const pendingInput = failed ? state.pendingInput : undefined;
      const merged = mergeConversationMessages(state.messages, [
        action.result.acceptedMessage,
        ...action.result.assistantMessages,
      ]);
      return {
        ...state,
        session: action.result.session,
        messages: merged,
        draft: failed ? state.draft : "",
        pendingClientMessageId: pendingId,
        pendingInput,
        error: failed,
        isOffline: false,
        uiState: projectionUiState(action.result.session, pendingId, failed),
      };
    }
    case "SEND_FAILED": {
      const failedMessages = state.messages.map((message) =>
        message.clientMessageId === state.pendingClientMessageId && message.localStatus
          ? { ...message, localStatus: "failed" as const, localError: action.error }
          : message
      );
      return {
        ...state,
        messages: failedMessages,
        error: action.error,
        isOffline: action.offline,
        uiState: "send_failed",
      };
    }
    case "DISCARD_FAILED_SEND":
      return {
        ...state,
        messages: state.messages.filter(
          (message) =>
            !(
              message.localStatus &&
              message.clientMessageId &&
              message.clientMessageId === state.pendingClientMessageId
            )
        ),
        pendingClientMessageId: undefined,
        pendingInput: undefined,
        error: undefined,
        isOffline: false,
        uiState: projectionUiState(state.session),
      };
    case "FINISHING":
      return {
        ...state,
        error: undefined,
        uiState: "finalizing",
      };
    case "FINISHED": {
      const session = action.result ? { ...action.session, result: action.result } : action.session;
      return {
        ...state,
        session,
        draft: "",
        pendingClientMessageId: undefined,
        pendingInput: undefined,
        error: undefined,
        isOffline: false,
        uiState: projectionUiState(session),
      };
    }
    case "ABANDONED":
      return {
        ...state,
        session: action.session,
        pendingClientMessageId: undefined,
        pendingInput: undefined,
        error: undefined,
        uiState: "abandoned",
      };
    case "FATAL":
      return { ...state, error: action.error, isOffline: action.offline, uiState: "fatal" };
    case "CLEAR_ERROR":
      return {
        ...state,
        error: undefined,
        isOffline: false,
        uiState: projectionUiState(state.session, state.pendingClientMessageId),
      };
  }
}
