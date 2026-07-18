import {
  useChatSession as useSdkChatSession,
  useChatSessions as useSdkChatSessions,
  useSendChatMessage as useSdkSendChatMessage,
} from "@levelup/query";
import type { ChatSession } from "@levelup/shared-types";

/** Paginated list envelope returned by the SDK chat-session list hook. */
interface ChatSessionPage {
  items?: ChatSession[];
  nextCursor?: string | null;
}

/**
 * Fetch the most recent active chat session for an item (or a specific session
 * by id). Tenant/user scope is implicit in the SDK auth context; the legacy
 * `tenantId`/`userId` params are preserved for call-site compatibility and gate
 * enablement.
 */
export function useChatSession(
  tenantId: string | null,
  userId: string | null,
  itemId: string | null,
  sessionId?: string | null
) {
  const ready = !!userId && !!itemId;

  const detail = useSdkChatSession<ChatSession | null>(sessionId ?? "", {
    enabled: ready && !!sessionId,
  });
  const list = useSdkChatSessions<ChatSessionPage>(
    { itemId: itemId ?? undefined },
    { enabled: ready && !sessionId }
  );

  if (sessionId) {
    return { ...detail, data: (detail.data ?? null) as ChatSession | null };
  }
  return {
    ...list,
    data: (list.data?.items?.[0] ?? null) as ChatSession | null,
  };
}

/** Fetch all chat sessions for an item (one item -> many sessions). */
export function useItemChatSessions(
  tenantId: string | null,
  userId: string | null,
  itemId: string | null
) {
  const ready = !!userId && !!itemId;
  const query = useSdkChatSessions<ChatSessionPage>(
    { itemId: itemId ?? undefined },
    { enabled: ready }
  );
  return {
    ...query,
    data: (query.data?.items ?? []) as ChatSession[],
  };
}

interface SendChatMessageVars {
  tenantId: string;
  spaceId: string;
  storyPointId: string;
  itemId: string;
  message: string;
  sessionId?: string;
  language?: string;
}

/** Maps the legacy mutate payload onto the SDK `sendChatMessage` contract. */
function toSdkVars(params: SendChatMessageVars) {
  const { spaceId, storyPointId, itemId, message, sessionId, language } = params;
  return { spaceId, storyPointId, itemId, text: message, sessionId, language };
}

/**
 * Send a chat message to the AI tutor. Preserves the legacy mutate/mutateAsync
 * payload (`{ tenantId, ..., message }`) and the `{ reply }` result shape that
 * existing callers depend on, mapping to/from the SDK contract.
 */
export function useSendChatMessage() {
  const mutation = useSdkSendChatMessage();

  const mutate = (params: SendChatMessageVars, options?: Parameters<typeof mutation.mutate>[1]) =>
    mutation.mutate(toSdkVars(params) as never, options);

  const mutateAsync = async (params: SendChatMessageVars) => {
    const res = (await mutation.mutateAsync(toSdkVars(params) as never)) as {
      reply?: string;
      message?: { text?: string };
    };
    return { ...res, reply: res.reply ?? res.message?.text ?? "" };
  };

  return { ...mutation, mutate, mutateAsync };
}
