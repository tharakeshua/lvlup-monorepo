import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { ERROR_MESSAGES } from "@levelup/api-contract";

import { createConversationUuid, hashConversationInput } from "./ids";
import {
  clearConversationResumeState,
  loadConversationResumeState,
  saveConversationResumeState,
} from "./persistence";
import {
  conversationReducer,
  initialConversationMachineState,
  type ConversationMachineState,
} from "./reducer";
import type {
  ConversationContext,
  ConversationController,
  ConversationControllerOptions,
  ConversationError,
  ConversationPage,
  ConversationSessionView,
} from "./types";

function asConversationError(error: unknown): ConversationError {
  if (error && typeof error === "object") {
    const raw = error as Record<string, unknown>;
    const code = typeof raw.code === "string" ? raw.code : "CONVERSATION_UNAVAILABLE";
    const rawMessage = typeof raw.message === "string" ? raw.message : "";
    const contractMessage =
      code in ERROR_MESSAGES ? ERROR_MESSAGES[code as keyof typeof ERROR_MESSAGES] : undefined;
    const safeMessage =
      typeof raw.safeMessage === "string"
        ? raw.safeMessage
        : (contractMessage ??
          (code === "NETWORK_ERROR" ||
          /network|offline|connection|unavailable|timeout/i.test(rawMessage)
            ? "We couldn't reach the conversation right now. Check your connection and try again."
            : "We couldn't update this conversation. Please try again."));
    return {
      code,
      safeMessage,
      retryable:
        raw.retryable === true ||
        code === "NETWORK_ERROR" ||
        /network|offline|connection|unavailable|timeout/i.test(rawMessage),
    };
  }
  return {
    code: "CONVERSATION_UNAVAILABLE",
    safeMessage: "We couldn't update this conversation. Please try again.",
    retryable: true,
  };
}

function isConnectivityError(error: ConversationError): boolean {
  const haystack = `${error.code} ${error.safeMessage}`.toLowerCase();
  return /offline|network|unavailable|connection|timeout/.test(haystack);
}

function sameContext(actual: ConversationContext, expected: ConversationContext): boolean {
  if (actual.kind !== expected.kind) return false;
  if (actual.spaceId !== expected.spaceId) return false;
  if (actual.kind === "tutor" && expected.kind === "tutor") {
    if (actual.scope !== expected.scope) return false;
    if (actual.scope === "space" && expected.scope === "space") return true;
    if (actual.scope === "story_point" && expected.scope === "story_point") {
      return actual.storyPointId === expected.storyPointId;
    }
    if (actual.scope === "item" && expected.scope === "item") {
      return actual.storyPointId === expected.storyPointId && actual.itemId === expected.itemId;
    }
    return false;
  }
  if (actual.kind === "question_help" && expected.kind === "question_help") {
    return (
      actual.storyPointId === expected.storyPointId &&
      actual.itemId === expected.itemId &&
      (actual.attemptId ?? undefined) === (expected.attemptId ?? undefined)
    );
  }
  if (actual.kind === "agent_assessment" && expected.kind === "agent_assessment") {
    return actual.storyPointId === expected.storyPointId && actual.itemId === expected.itemId;
  }
  return false;
}

function hasHardLimit(session?: ConversationSessionView): boolean {
  return (
    session?.publicConfig?.completionPolicy?.hardLimitReached === true ||
    session?.completionRecommendation?.hardLimitReached === true
  );
}

function pageFromSession(session: ConversationSessionView): ConversationPage {
  return { session, messages: [] };
}

/**
 * Server-projection controller used by all three mobile conversation modes.
 *
 * It stores only a small resume record, keeps a UUID stable across a failed
 * turn retry, and intentionally never queues sends offline. The caller injects
 * the query/repository operations so this hook has no Firebase dependency.
 */
export function useConversationController(
  options: ConversationControllerOptions
): ConversationController {
  const {
    autoStart = false,
    context,
    getQuestionHelpDraft,
    locale,
    mode,
    operations,
    sessionId: requestedSessionId,
  } = options;
  const [machine, dispatch] = useReducer(conversationReducer, initialConversationMachineState);
  const machineRef = useRef<ConversationMachineState>(machine);
  const startInFlightRef = useRef(false);
  const sendInFlightRef = useRef(false);
  const finishInFlightRef = useRef(false);
  const abandonInFlightRef = useRef(false);
  const autoStartedRef = useRef(false);
  const finishRequestIdRef = useRef<string>();
  const persistenceTailRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    machineRef.current = machine;
  }, [machine]);

  const queuePersistence = useCallback((task: () => Promise<void>) => {
    persistenceTailRef.current = persistenceTailRef.current.then(task).catch(() => {
      // Storage is a convenience only. A failed device write must never make
      // the server-authoritative conversation unusable.
    });
  }, []);

  useEffect(() => {
    const current = machine;
    const session = current.session;
    if (!session) return;

    // An assessment result can be reopened after navigation/relogin only by
    // its safe server session ID. Other terminal conversations start fresh.
    if (
      session.status === "abandoned" ||
      (session.status === "completed" && mode !== "agent_assessment")
    ) {
      queuePersistence(() => clearConversationResumeState(mode, context));
      return;
    }

    queuePersistence(() =>
      saveConversationResumeState(context, {
        schemaVersion: 1,
        mode,
        contextKey: session.contextKey,
        sessionId: session.id,
        draft: session.status === "completed" ? undefined : current.draft || undefined,
        pendingClientMessageId:
          session.status === "completed" ? undefined : current.pendingClientMessageId,
        pendingInput: session.status === "completed" ? undefined : current.pendingInput,
        pendingInputHash:
          session.status === "completed" || !current.pendingInput
            ? undefined
            : hashConversationInput(current.pendingInput),
        updatedAt: new Date().toISOString(),
      })
    );
  }, [context, machine, mode, queuePersistence]);

  const fetchPage = useCallback(
    async (sessionId: string): Promise<ConversationPage> => operations.get(sessionId),
    [operations]
  );

  const applyServerPage = useCallback(
    (page: ConversationPage): void => {
      if (page.session.mode !== mode || !sameContext(page.session.context, context)) {
        dispatch({
          type: "FATAL",
          error: {
            code: "CONVERSATION_CONTEXT_MISMATCH",
            safeMessage: "That conversation is not available from this learning context.",
            retryable: false,
          },
          offline: false,
        });
        return;
      }
      dispatch({ type: "SYNCED", page });
    },
    [context, mode]
  );

  const reportReadFailure = useCallback((error: unknown): void => {
    const normalized = asConversationError(error);
    dispatch({ type: "FATAL", error: normalized, offline: isConnectivityError(normalized) });
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    const current = machineRef.current;
    const sessionId = current.session?.id;
    if (!sessionId) return;
    try {
      const page = await fetchPage(sessionId);
      applyServerPage(page);
    } catch (error) {
      reportReadFailure(error);
    }
  }, [applyServerPage, fetchPage, reportReadFailure]);

  const beginFresh = useCallback(async (): Promise<void> => {
    const result = await operations.start({
      clientRequestId: createConversationUuid(),
      mode,
      context,
      ...(locale ? { locale } : {}),
    });
    dispatch({ type: "STARTED", result });
  }, [context, locale, mode, operations]);

  const start = useCallback(async (): Promise<void> => {
    if (startInFlightRef.current) return;
    const current = machineRef.current;
    if (current.session?.id) {
      await refresh();
      return;
    }

    startInFlightRef.current = true;
    dispatch({ type: "BOOTSTRAP" });
    try {
      const persisted = await loadConversationResumeState(mode, context);
      const preferredSessionId = requestedSessionId || persisted?.sessionId;

      if (preferredSessionId) {
        try {
          const page = await fetchPage(preferredSessionId);
          if (page.session.mode !== mode || !sameContext(page.session.context, context)) {
            throw {
              code: "CONVERSATION_CONTEXT_MISMATCH",
              safeMessage: "That conversation is not available from this learning context.",
              retryable: false,
            };
          }
          const pendingInputMatchesHash =
            !persisted?.pendingInput ||
            !persisted.pendingInputHash ||
            hashConversationInput(persisted.pendingInput) === persisted.pendingInputHash;
          const restoredPendingInput =
            pendingInputMatchesHash && persisted?.pendingInput ? persisted.pendingInput : undefined;
          dispatch({
            type: "RESTORED",
            page,
            draft: persisted?.draft,
            pendingClientMessageId: persisted?.pendingClientMessageId,
            // Pending input is stored solely to replay the same client UUID with
            // byte-identical user input after process death. Old v1 records
            // without it can still offer a draft-based retry.
            pendingInput: restoredPendingInput,
          });
          const serverAlreadyAccepted = persisted?.pendingClientMessageId
            ? page.messages.some(
                (message) => message.clientMessageId === persisted.pendingClientMessageId
              )
            : false;
          const needsFailedTurnRetry = page.session.activeTurn?.status === "failed_recoverable";
          if (
            persisted?.pendingClientMessageId &&
            !restoredPendingInput &&
            (!serverAlreadyAccepted || needsFailedTurnRetry)
          ) {
            dispatch({
              type: "SEND_FAILED",
              error: {
                code: "PENDING_INPUT_UNAVAILABLE",
                safeMessage:
                  "We could not safely restore this unsent reply. Choose Edit instead to send a new message.",
                retryable: false,
              },
              offline: false,
            });
          }
          return;
        } catch (error) {
          const normalized = asConversationError(error);
          // A route-selected session should never silently become another
          // session. For a stale local record, remove only definite unavailable
          // states; a network failure remains recoverable with the same ID.
          if (
            requestedSessionId ||
            !/not.?found|permission|context_mismatch/i.test(normalized.code)
          ) {
            dispatch({
              type: "FATAL",
              error: normalized,
              offline: isConnectivityError(normalized),
            });
            return;
          }
          await clearConversationResumeState(mode, context);
        }
      }

      await beginFresh();
    } catch (error) {
      const normalized = asConversationError(error);
      dispatch({ type: "FATAL", error: normalized, offline: isConnectivityError(normalized) });
    } finally {
      startInFlightRef.current = false;
    }
  }, [beginFresh, context, fetchPage, mode, refresh, requestedSessionId]);

  useEffect(() => {
    if (!autoStart || autoStartedRef.current) return;
    autoStartedRef.current = true;
    void start();
  }, [autoStart, start]);

  const sendInternal = useCallback(
    async (retry: boolean): Promise<void> => {
      if (sendInFlightRef.current) return;
      const current = machineRef.current;
      const session = current.session;
      if (!session) return;
      const requiredAction =
        retry && session.activeTurn?.status === "failed_recoverable" ? "retry_turn" : "send";
      if (!session.allowedActions?.includes(requiredAction)) return;
      if (
        !retry &&
        (hasHardLimit(session) ||
          session.activeTurn?.status === "running" ||
          (current.uiState !== "active" && current.uiState !== "ready_to_finish"))
      ) {
        return;
      }

      const input = retry
        ? current.pendingInput
        : {
            text: current.draft.trim(),
            ...(getQuestionHelpDraft ? { questionHelpDraft: getQuestionHelpDraft() } : {}),
          };
      if (!input?.text.trim()) return;
      const clientMessageId = retry
        ? current.pendingClientMessageId
        : (current.pendingClientMessageId ?? createConversationUuid());
      if (!clientMessageId) return;

      sendInFlightRef.current = true;
      dispatch({
        type: "SEND_REQUESTED",
        clientMessageId,
        input,
        createdAt: new Date().toISOString(),
      });

      try {
        const response = await operations.send({
          sessionId: session.id,
          clientMessageId,
          input,
        });
        dispatch({ type: "SEND_SUCCEEDED", result: response });
      } catch (error) {
        const normalized = asConversationError(error);
        dispatch({
          type: "SEND_FAILED",
          error: normalized,
          offline: isConnectivityError(normalized),
        });
      } finally {
        sendInFlightRef.current = false;
      }
    },
    [getQuestionHelpDraft, operations]
  );

  const send = useCallback(async (): Promise<void> => {
    const current = machineRef.current;
    if (current.uiState === "send_failed" || current.pendingClientMessageId) return;
    await sendInternal(false);
  }, [sendInternal]);

  const retrySend = useCallback(async (): Promise<void> => {
    const current = machineRef.current;
    if (current.uiState !== "send_failed" || !current.pendingClientMessageId) return;
    if (!current.pendingInput) {
      dispatch({
        type: "SEND_FAILED",
        error: {
          code: "PENDING_INPUT_UNAVAILABLE",
          safeMessage:
            "We could not safely restore this unsent reply. Choose Edit instead to send a new message.",
          retryable: false,
        },
        offline: false,
      });
      return;
    }
    await sendInternal(true);
  }, [sendInternal]);

  const discardFailedSend = useCallback(() => {
    dispatch({ type: "DISCARD_FAILED_SEND" });
  }, []);

  const finish = useCallback(
    async (finishOptions?: { earlyFinishConfirmed?: boolean }): Promise<void> => {
      if (finishInFlightRef.current) return;
      const current = machineRef.current;
      const session = current.session;
      if (!session) return;
      const allowed = session.allowedActions?.includes("finish") ?? false;
      if (!allowed || current.pendingClientMessageId || session.activeTurn?.status === "running")
        return;

      const requestId = finishRequestIdRef.current ?? createConversationUuid();
      finishRequestIdRef.current = requestId;
      finishInFlightRef.current = true;
      dispatch({ type: "FINISHING" });
      try {
        const response = await operations.finish({
          sessionId: session.id,
          clientRequestId: requestId,
          reason: "learner_requested",
          ...(finishOptions?.earlyFinishConfirmed ? { earlyFinishConfirmed: true } : {}),
        });
        finishRequestIdRef.current = undefined;
        dispatch({ type: "FINISHED", session: response.session, result: response.result });
      } catch (error) {
        // A client timeout cannot tell us whether finalization committed. Keep a
        // durable status card and make the next action an authoritative refresh.
        const normalized = asConversationError(error);
        dispatch({ type: "FATAL", error: normalized, offline: isConnectivityError(normalized) });
      } finally {
        finishInFlightRef.current = false;
      }
    },
    [operations]
  );

  const abandon = useCallback(async (): Promise<void> => {
    if (abandonInFlightRef.current) return;
    const session = machineRef.current.session;
    if (!session || !session.allowedActions?.includes("abandon")) return;
    abandonInFlightRef.current = true;
    try {
      const response = await operations.abandon({
        sessionId: session.id,
        clientRequestId: createConversationUuid(),
      });
      dispatch({ type: "ABANDONED", session: response.session });
    } catch (error) {
      const normalized = asConversationError(error);
      dispatch({ type: "FATAL", error: normalized, offline: isConnectivityError(normalized) });
    } finally {
      abandonInFlightRef.current = false;
    }
  }, [operations]);

  return useMemo(() => {
    const session = machine.session;
    const hardLimit = hasHardLimit(session);
    const isTurnActive = session?.activeTurn?.status === "running";
    const allows = (action: "send" | "finish" | "abandon") =>
      session?.allowedActions?.includes(action) ?? false;
    const canSend =
      Boolean(session) &&
      !machine.isOffline &&
      !hardLimit &&
      !isTurnActive &&
      !machine.pendingClientMessageId &&
      (machine.uiState === "active" || machine.uiState === "ready_to_finish") &&
      allows("send") &&
      machine.draft.trim().length > 0;
    const canFinish =
      Boolean(session) &&
      !machine.isOffline &&
      !isTurnActive &&
      !machine.pendingClientMessageId &&
      (machine.uiState === "active" || machine.uiState === "ready_to_finish") &&
      allows("finish");
    const canAbandon =
      Boolean(session) &&
      !machine.pendingClientMessageId &&
      !isTurnActive &&
      allows("abandon") &&
      machine.uiState !== "completed" &&
      machine.uiState !== "abandoned";
    const retryActionAllowed =
      session?.activeTurn?.status === "failed_recoverable"
        ? (session.allowedActions?.includes("retry_turn") ?? false)
        : (session?.allowedActions?.includes("send") ?? false);
    const canRetryFailedTurn =
      machine.uiState === "send_failed" &&
      Boolean(machine.pendingClientMessageId) &&
      Boolean(machine.pendingInput) &&
      retryActionAllowed &&
      machine.error?.retryable !== false;

    return {
      state: machine.uiState,
      session,
      messages: machine.messages,
      draft: machine.draft,
      pendingClientMessageId: machine.pendingClientMessageId,
      error: machine.error,
      canSend,
      canFinish,
      canAbandon,
      canRetryFailedTurn,
      isOffline: machine.isOffline,
      isTurnActive,
      start,
      setDraft: (value: string) => dispatch({ type: "SET_DRAFT", value }),
      send,
      retrySend,
      discardFailedSend,
      finish,
      abandon,
      refresh,
      applyServerPage,
      reportReadFailure,
    } satisfies ConversationController;
  }, [
    abandon,
    applyServerPage,
    discardFailedSend,
    finish,
    machine,
    refresh,
    reportReadFailure,
    retrySend,
    send,
    start,
  ]);
}

/** Use only by lightweight UI previews/tests where no message query is needed. */
export function conversationPageFromSession(session: ConversationSessionView): ConversationPage {
  return pageFromSession(session);
}
