/**
 * `levelup-content` SUBSCRIPTION hooks (domains/levelup-content.md "Subscription
 * hooks") — thin wrappers over the `useSubscription` cache-write seam.
 *
 *   • `useChatStream(sessionId)` — CHAT-1 (AD-12 addendum): listens to the RTDB
 *     BUMP node `chatBump/{t}/{uid}/{sessionId}` (`{rev, lastMessageAt}` — never
 *     chat content) and DEBOUNCE-invalidates `chatKeys.detail(sessionId)`, so the
 *     active `useChatSession` refetches `getChatSession` — the single
 *     authoritative read (signal-over-RTDB, data-over-callable).
 *   • `useServerTime()` — the `/serverTimeOffset` primitive (server clock; lets
 *     the content/runtime UI compute deadlines without trusting the device clock).
 *
 * (`useTestSessionDeadline` is owned by the sibling `testsession-progress` domain.)
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { useApi } from "../provider/useApi.js";
import { chatKeys, conversationKeys } from "../keys/registry.js";
import { useSubscription, type UseSubscriptionResult } from "../realtime/useSubscription.js";

/** Trailing debounce before the bump-triggered refetch (coalesces bump bursts). */
export const CHAT_BUMP_DEBOUNCE_MS = 250;
/** Conversation uses the same RTDB bump node and deliberately the same debounce. */
export const CONVERSATION_BUMP_DEBOUNCE_MS = CHAT_BUMP_DEBOUNCE_MS;

interface BumpHandlerOptions {
  debounceMs?: number;
  onPayload?: (payload: unknown, qc: QueryClient) => void;
}

/**
 * Common signal-only handler for RTDB bumps. The payload is never cached as
 * conversation/chat data: the callback may observe it, then the authoritative
 * callable query is invalidated after a trailing debounce.
 */
export function createBumpRefetchHandler(
  queryKey: readonly unknown[],
  opts?: BumpHandlerOptions
): { handle: (payload: unknown, qc: QueryClient) => void; cancel: () => void } {
  const delay = opts?.debounceMs ?? CHAT_BUMP_DEBOUNCE_MS;
  let timer: ReturnType<typeof setTimeout> | null = null;

  return {
    handle(payload: unknown, qc: QueryClient): void {
      opts?.onPayload?.(payload, qc);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void qc.invalidateQueries({ queryKey });
      }, delay);
    },
    cancel(): void {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}

/**
 * Pure bump-handler factory (exported for unit tests). Each bump payload is
 * forwarded to the optional caller `onPayload`, then a TRAILING debounce
 * invalidates the session-detail key — the user+assistant double-bump of one
 * tutor turn coalesces into a single `getChatSession` refetch.
 */
export function createChatBumpHandler(
  sessionId: string,
  opts?: BumpHandlerOptions
): { handle: (payload: unknown, qc: QueryClient) => void; cancel: () => void } {
  return createBumpRefetchHandler(chatKeys.detail(sessionId), opts);
}

/**
 * Live refetch signal for an AI-tutor session (bump-node pattern). The payload
 * is `{rev, lastMessageAt}` — messages arrive via the invalidated
 * `useChatSession(sessionId)` read, never over RTDB. `onPayload` still receives
 * each raw bump (legacy callers that mapped message arrays degrade to a no-op).
 */
export function useChatStream(
  sessionId: string,
  onPayload?: (payload: unknown, qc: QueryClient) => void
): UseSubscriptionResult {
  // Ref-hold the caller callback: useSubscription captures its onPayload closure
  // per (name, params) subscribe — the ref keeps a swapped prop live without
  // tearing down the RTDB listener.
  const onPayloadRef = useRef(onPayload);
  onPayloadRef.current = onPayload;
  const handler = useMemo(
    () =>
      createChatBumpHandler(sessionId, {
        onPayload: (p, qc) => onPayloadRef.current?.(p, qc),
      }),
    [sessionId]
  );
  useEffect(() => () => handler.cancel(), [handler]);
  return useSubscription("v1.levelup.chatStream", { sessionId } as never, handler.handle as never);
}

/**
 * Conversation's RTDB integration is a bump/refetch signal only. It listens to
 * the existing owner-scoped `chatBump/{tenant}/{owner}/{session}` transport
 * channel and invalidates the session-detail prefix, which also covers every
 * transcript-page child key. Status/messages/results remain callable data.
 */
export function createConversationBumpHandler(
  sessionId: string,
  opts?: BumpHandlerOptions
): { handle: (payload: unknown, qc: QueryClient) => void; cancel: () => void } {
  return createBumpRefetchHandler(conversationKeys.detail(sessionId), {
    debounceMs: opts?.debounceMs ?? CONVERSATION_BUMP_DEBOUNCE_MS,
    onPayload: opts?.onPayload,
  });
}

export function useConversationBump(sessionId: string): UseSubscriptionResult {
  const handler = useMemo(() => createConversationBumpHandler(sessionId), [sessionId]);
  useEffect(() => () => handler.cancel(), [handler]);
  return useSubscription("v1.levelup.chatStream", { sessionId } as never, handler.handle as never);
}

export interface ServerTime {
  /** ms to add to `Date.now()` to approximate the server clock. */
  offsetMs: number;
  /** `Date.now() + offsetMs`. */
  now: () => number;
}

/**
 * The server-time primitive over the transport's `serverTimeOffset` seam
 * (SDK-SERVER §7.1.1). Used to derive countdowns without trusting the
 * (drift-prone) device clock.
 */
export function useServerTime(): ServerTime {
  const { transport } = useApi();
  const [offsetMs, setOffsetMs] = useState(0);
  useEffect(() => {
    const handle = transport.serverTimeOffset((ms: number) => setOffsetMs(ms));
    return () => handle.unsubscribe();
  }, [transport]);
  return { offsetMs, now: () => Date.now() + offsetMs };
}
