/**
 * `levelup-content` SUBSCRIPTION hooks (domains/levelup-content.md "Subscription
 * hooks") — thin wrappers over the `useSubscription` cache-write seam.
 *
 *   • `useChatStream(sessionId)` — appended `ChatMessage`s over `v1.levelup.chatStream`,
 *   • `useServerTime()` — the `/serverTimeOffset` primitive (server clock; lets
 *     the content/runtime UI compute deadlines without trusting the device clock).
 *
 * (`useTestSessionDeadline` is owned by the sibling `testsession-progress` domain.)
 *
 * The default `useSubscription` writer reconciles each payload into the SAME
 * cache key the REST read populated (so the stream and the callable read stay
 * authority-equivalent); callers pass a custom `onPayload` to merge instead.
 */
import { useEffect, useState } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { useApi } from "../provider/useApi.js";
import { useSubscription, type UseSubscriptionResult } from "../realtime/useSubscription.js";

/** Live appended chat messages for an AI-tutor session. */
export function useChatStream(
  sessionId: string,
  onPayload?: (payload: unknown, qc: QueryClient) => void
): UseSubscriptionResult {
  return useSubscription("v1.levelup.chatStream", { sessionId } as never, onPayload as never);
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
