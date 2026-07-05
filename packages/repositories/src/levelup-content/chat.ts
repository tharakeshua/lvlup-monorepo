/**
 * chatRepo (SDK-LAYERS-PLAN §4.1, levelup-content.md).
 *
 *   listSessions(filter)  — listChatSessions (paginated)
 *   getSession(id)        — getChatSession (with messages, always-subcollection)
 *   getMany(ids)          — batched
 *   recordMessage(input)  — sendChatMessage (the `send` verb, named with the
 *                           sanctioned `record*` IO prefix); append shaping of the
 *                           returned ChatMessage. Optimistic append lives in
 *                           @levelup/query; the repo just shapes the wire result.
 *
 * Realtime `chatStream` is a SUBSCRIPTIONS concern (owned by @levelup/realtime +
 * @levelup/query useChatStream); the repo exposes only the request/shape edge.
 */
import {
  type ApiClientLike,
  type Page,
  type PageBag,
  type PageRequest,
  batchGetMany,
  makePaginator,
  toPage,
} from "./_kit";

export interface ChatSessionFilter extends PageRequest {
  spaceId?: string;
  itemId?: string;
}

export interface RecordMessageInput {
  sessionId?: string;
  spaceId: string;
  storyPointId: string;
  itemId: string;
  text: string;
  mediaUrls?: string[];
  language?: string;
}

/** Shaped result of an appended chat turn (`{sessionId, message, tokensUsed?}`). */
export interface RecordMessageResult {
  sessionId: string;
  message: unknown;
  tokensUsed?: number;
}

export interface ChatRepo {
  listSessions(filter?: ChatSessionFilter): Promise<Page<unknown>>;
  paginateSessions(filter?: ChatSessionFilter): Promise<PageBag<unknown>>;
  getSession(id: string): Promise<unknown>;
  getMany(ids: readonly string[]): Promise<unknown[]>;
  recordMessage(input: RecordMessageInput): Promise<RecordMessageResult>;
}

export function createChatRepo(api: ApiClientLike): ChatRepo {
  const lv = api.levelup;
  return {
    listSessions: (filter = {}) => lv["listChatSessions"]!(filter).then((r) => toPage(r)),
    paginateSessions: (filter = {}) => makePaginator((req) => lv["listChatSessions"]!(req), filter),
    getSession: (id) =>
      lv["getChatSession"]!({ sessionId: id }).then((r) => {
        // Unwrap the `{ session }` response envelope so consumers get the session
        // object directly (its `messages` array is what the chat screen reads).
        const o = (r ?? {}) as { session?: unknown };
        return o.session ?? r;
      }),
    getMany: (ids) => batchGetMany((req) => lv["listChatSessions"]!(req), ids),
    recordMessage: async (input) => {
      const res = (await lv["sendChatMessage"]!(input)) as RecordMessageResult;
      return res;
    },
  };
}
