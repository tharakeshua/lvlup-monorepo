/**
 * Conversation query adapter.
 *
 * Components and the controller see only `ConversationOperations`. This is the
 * single app-owned boundary for the T-F query hooks and exact T-A contract
 * variables/results; it never calls Firebase or a generic chat endpoint.
 */
import { useCallback, useMemo } from "react";
import {
  conversationKeys,
  useAbandonConversation,
  useApiQueryClient,
  useFinishConversation,
  useRepos,
  useSendConversationTurn,
  useStartConversation,
  type AbandonConversationResponse as WireAbandonConversationResponse,
  type AbandonConversationVariables,
  type ConversationDetailInput,
  type ConversationListFilter,
  type ConversationResponse,
  type FinishConversationVariables,
  type FinishConversationResponse as WireFinishConversationResponse,
  type SendConversationTurnResponse as WireSendConversationResponse,
  type SendConversationTurnVariables,
  type StartConversationResponse as WireStartConversationResponse,
  type StartConversationVariables,
} from "@levelup/query";

import type {
  AbandonConversationResponse,
  ConversationContext,
  ConversationMode,
  ConversationOperations,
  ConversationPage,
  FinishConversationResponse,
  SendConversationResponse,
  StartConversationResponse,
} from "./types";

/** Exact list filter used by the scoped tutor history picker. */
export function conversationListFilter(input: {
  mode: ConversationMode;
  context: ConversationContext;
}): ConversationListFilter {
  return input as unknown as ConversationListFilter;
}

function startVariables(
  input: Parameters<ConversationOperations["start"]>[0]
): StartConversationVariables {
  return input as unknown as StartConversationVariables;
}

function sendVariables(
  input: Parameters<ConversationOperations["send"]>[0]
): SendConversationTurnVariables {
  return input as unknown as SendConversationTurnVariables;
}

function finishVariables(
  input: Parameters<ConversationOperations["finish"]>[0]
): FinishConversationVariables {
  return input as unknown as FinishConversationVariables;
}

function abandonVariables(
  input: Parameters<ConversationOperations["abandon"]>[0]
): AbandonConversationVariables {
  return input as unknown as AbandonConversationVariables;
}

function pageFromWire(response: ConversationResponse): ConversationPage {
  return response as unknown as ConversationPage;
}

function startFromWire(response: WireStartConversationResponse): StartConversationResponse {
  return response as unknown as StartConversationResponse;
}

function sendFromWire(response: WireSendConversationResponse): SendConversationResponse {
  return response as unknown as SendConversationResponse;
}

function finishFromWire(response: WireFinishConversationResponse): FinishConversationResponse {
  // The finish callable's top-level `result` is a lifecycle discriminator
  // (`completed | grading_pending | grading_failed`), not the learner result
  // card shape. The session projection is the single authoritative location
  // for safe evaluation/progress data.
  const session = response.session as unknown as FinishConversationResponse["session"];
  return {
    session,
    ...(response.submission ? { submission: { id: response.submission.id } } : {}),
    ...(session.result ? { result: session.result } : {}),
    replayed: response.replayed,
  };
}

function abandonFromWire(response: WireAbandonConversationResponse): AbandonConversationResponse {
  return response as unknown as AbandonConversationResponse;
}

/**
 * Shared hook mutations retain T-F's invalidation rules. The one imperative
 * read is needed for startup/resume before a session-detail hook can mount; it
 * still goes through the same query cache/key and repository boundary.
 */
export function useConversationOperations(): ConversationOperations {
  const queryClient = useApiQueryClient();
  const repos = useRepos();
  const { mutateAsync: startConversation } = useStartConversation();
  const { mutateAsync: sendConversationTurn } = useSendConversationTurn();
  const { mutateAsync: finishConversation } = useFinishConversation();
  const { mutateAsync: abandonConversation } = useAbandonConversation();

  const get = useCallback(
    async (sessionId: string): Promise<ConversationPage> => {
      const response = await queryClient.fetchQuery({
        queryKey: conversationKeys.detail(sessionId),
        // A learner-requested refresh should read authoritative state rather
        // than accepting a fresh cache entry from before a timeout.
        staleTime: 0,
        queryFn: () => repos.conversationRepo.get({ sessionId } as ConversationDetailInput),
      });
      return pageFromWire(response);
    },
    [queryClient, repos]
  );

  return useMemo(
    () => ({
      get,
      start: async (input) => startFromWire(await startConversation(startVariables(input))),
      send: async (input) => sendFromWire(await sendConversationTurn(sendVariables(input))),
      finish: async (input) => finishFromWire(await finishConversation(finishVariables(input))),
      abandon: async (input) => abandonFromWire(await abandonConversation(abandonVariables(input))),
    }),
    [abandonConversation, finishConversation, get, sendConversationTurn, startConversation]
  );
}
