/**
 * Conversation query and mutation hooks.
 *
 * Components reach only this layer; the hooks call `conversationRepo`, which
 * calls versioned API-client callables. The types are derived from the callable
 * contracts so client code can consume only learner-safe response projections.
 */
import { useQuery, type UseQueryOptions, type UseQueryResult } from "@tanstack/react-query";
import type { ReqOf, ResOf } from "@levelup/api-contract";
import type { LevelupContentRepos } from "@levelup/repositories";
import { defineMutation } from "../mutation/define-mutation.js";
import { conversationKeys } from "../keys/registry.js";
import { useApi } from "../provider/useApi.js";

export type ConversationListFilter = ReqOf<"v1.levelup.listConversations">;
export type ConversationDetailInput = ReqOf<"v1.levelup.getConversation">;
export type ConversationMessagesPage = Omit<ConversationDetailInput, "sessionId">;

export type StartConversationVariables = ReqOf<"v1.levelup.startConversation">;
export type StartConversationResponse = ResOf<"v1.levelup.startConversation">;
export type SendConversationTurnVariables = ReqOf<"v1.levelup.sendConversationTurn">;
export type SendConversationTurnResponse = ResOf<"v1.levelup.sendConversationTurn">;
export type FinishConversationVariables = ReqOf<"v1.levelup.finishConversation">;
export type FinishConversationResponse = ResOf<"v1.levelup.finishConversation">;
export type AbandonConversationVariables = ReqOf<"v1.levelup.abandonConversation">;
export type AbandonConversationResponse = ResOf<"v1.levelup.abandonConversation">;
export type ConversationResponse = ResOf<"v1.levelup.getConversation">;
export type ConversationsResponse = ResOf<"v1.levelup.listConversations">;

type ReadOptions<T> = Omit<
  UseQueryOptions<T, unknown, T, readonly unknown[]>,
  "queryKey" | "queryFn"
>;

/** The mutation framework intentionally accepts an open repo bag; narrow it here. */
type ConversationReposSlice = Pick<LevelupContentRepos, "conversationRepo">;
const conversationRepos = (repos: unknown): ConversationReposSlice =>
  repos as ConversationReposSlice;

/** Cursor-paged conversation history, optionally narrowed by mode/status/context. */
export function useConversations(
  filter: ConversationListFilter = {},
  opts?: ReadOptions<ConversationsResponse>
): UseQueryResult<ConversationsResponse, unknown> {
  const { repos } = useApi();

  return useQuery<ConversationsResponse, unknown, ConversationsResponse, readonly unknown[]>({
    queryKey: conversationKeys.list(filter),
    queryFn: () => repos.conversationRepo.list(filter),
    ...opts,
  });
}

/**
 * One authoritative learner-safe session read. `getConversation` returns both
 * lifecycle state and a transcript page; individual transcript-page cache keys
 * are available through `conversationKeys.messages` for controller extensions.
 */
export function useConversation(
  sessionId: string,
  opts?: ReadOptions<ConversationResponse>
): UseQueryResult<ConversationResponse, unknown> {
  const { repos } = useApi();

  return useQuery<ConversationResponse, unknown, ConversationResponse, readonly unknown[]>({
    queryKey: conversationKeys.detail(sessionId),
    queryFn: () =>
      repos.conversationRepo.get({
        sessionId: sessionId as ConversationDetailInput["sessionId"],
      }),
    enabled: Boolean(sessionId) && (opts?.enabled ?? true),
    ...opts,
  });
}

/** Start or resume a server-authoritative session; never optimistically create one. */
export const useStartConversation = defineMutation<
  StartConversationVariables,
  StartConversationResponse
>({
  callable: "v1.levelup.startConversation",
  run: (repos, variables) => conversationRepos(repos).conversationRepo.start(variables),
});

/** Persist and execute one turn; optimistic transcript reconciliation belongs to the controller. */
export const useSendConversationTurn = defineMutation<
  SendConversationTurnVariables,
  SendConversationTurnResponse
>({
  callable: "v1.levelup.sendConversationTurn",
  run: (repos, variables) => conversationRepos(repos).conversationRepo.send(variables),
});

/** Request durable server-owned finalization/evaluation/progress application. */
export const useFinishConversation = defineMutation<
  FinishConversationVariables,
  FinishConversationResponse
>({
  callable: "v1.levelup.finishConversation",
  run: (repos, variables) => conversationRepos(repos).conversationRepo.finish(variables),
});

/** Abandon a resumable session; the server owns allowed-state validation. */
export const useAbandonConversation = defineMutation<
  AbandonConversationVariables,
  AbandonConversationResponse
>({
  callable: "v1.levelup.abandonConversation",
  run: (repos, variables) => conversationRepos(repos).conversationRepo.abandon(variables),
});
