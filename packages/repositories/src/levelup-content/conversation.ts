/**
 * Conversation repository — the client-facing boundary for the six versioned
 * conversation callables.
 *
 * Conversation documents are intentionally never read from Firestore by a
 * client. This repository therefore has no persistence SDK dependency and
 * returns only the learner-safe wire projections declared in
 * `@levelup/api-contract`:
 *
 *   start / send / finish / get / list / abandon
 */
import type { ReqOf, ResOf } from "@levelup/api-contract";
import { type ApiClientLike, invokeCallable } from "./_kit";

export type StartConversationInput = ReqOf<"v1.levelup.startConversation">;
export type StartConversationResult = ResOf<"v1.levelup.startConversation">;

export type SendConversationTurnInput = ReqOf<"v1.levelup.sendConversationTurn">;
export type SendConversationTurnResult = ResOf<"v1.levelup.sendConversationTurn">;

export type FinishConversationInput = ReqOf<"v1.levelup.finishConversation">;
export type FinishConversationResult = ResOf<"v1.levelup.finishConversation">;

export type GetConversationInput = ReqOf<"v1.levelup.getConversation">;
export type GetConversationResult = ResOf<"v1.levelup.getConversation">;

export type ListConversationsInput = ReqOf<"v1.levelup.listConversations">;
export type ListConversationsResult = ResOf<"v1.levelup.listConversations">;

export type AbandonConversationInput = ReqOf<"v1.levelup.abandonConversation">;
export type AbandonConversationResult = ResOf<"v1.levelup.abandonConversation">;

/**
 * Shaped API-only surface. In particular, this never exposes a durable
 * `ConversationSessionDoc`, private configuration, evidence, leases, or raw
 * evaluation payloads — contract response types are the safe client boundary.
 */
export interface ConversationRepo {
  start(input: StartConversationInput): Promise<StartConversationResult>;
  send(input: SendConversationTurnInput): Promise<SendConversationTurnResult>;
  finish(input: FinishConversationInput): Promise<FinishConversationResult>;
  get(input: GetConversationInput): Promise<GetConversationResult>;
  list(input?: ListConversationsInput): Promise<ListConversationsResult>;
  abandon(input: AbandonConversationInput): Promise<AbandonConversationResult>;
}

export function createConversationRepo(api: ApiClientLike): ConversationRepo {
  const levelup = api.levelup;

  return {
    start: (input) =>
      invokeCallable<"v1.levelup.startConversation">(levelup["startConversation"]!, input),
    send: (input) =>
      invokeCallable<"v1.levelup.sendConversationTurn">(levelup["sendConversationTurn"]!, input),
    finish: (input) =>
      invokeCallable<"v1.levelup.finishConversation">(levelup["finishConversation"]!, input),
    get: (input) =>
      invokeCallable<"v1.levelup.getConversation">(levelup["getConversation"]!, input),
    list: (input = {}) =>
      invokeCallable<"v1.levelup.listConversations">(levelup["listConversations"]!, input),
    abandon: (input) =>
      invokeCallable<"v1.levelup.abandonConversation">(levelup["abandonConversation"]!, input),
  };
}
