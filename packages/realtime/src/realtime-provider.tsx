/**
 * `realtime-provider.tsx` — the React context carrying the realtime seam
 * (transport-realtime layer §3.2).
 *
 * Holds the injected transport (the `subscribe`/`serverTimeOffset` half) plus the
 * per-tree `SubscriptionManager` so every `useSubscription` shares one dedupe registry.
 * `@levelup/query`'s `<ApiProvider>` renders this internally so apps wire one provider, but
 * `RealtimeProvider` is independently usable (RN, tests).
 */
import { createContext, createElement, useContext, useMemo, type ReactNode } from "react";
import type { RealtimeTransport } from "./seam.js";
import { createSubscriptionManager, type SubscriptionManager } from "./subscription-manager.js";
import { createServerTimeStore, type ServerTimeStore } from "./server-time-store.js";

export interface RealtimeContextValue {
  transport: Pick<RealtimeTransport, "subscribe" | "serverTimeOffset">;
  manager: SubscriptionManager;
  /** Single shared `serverTimeOffset` subscription, deduped across all `useServerTime` consumers. */
  serverTime: ServerTimeStore;
}

export const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export interface RealtimeProviderProps {
  transport: Pick<RealtimeTransport, "subscribe" | "serverTimeOffset">;
  children: ReactNode;
}

export function RealtimeProvider(props: RealtimeProviderProps) {
  const { transport, children } = props;
  const value = useMemo<RealtimeContextValue>(
    () => ({
      transport,
      manager: createSubscriptionManager(transport),
      serverTime: createServerTimeStore(transport),
    }),
    [transport]
  );
  return createElement(RealtimeContext.Provider, { value }, children);
}

/** Read the realtime context; throws if used outside `<RealtimeProvider>`. */
export function useRealtime(): RealtimeContextValue {
  const ctx = useContext(RealtimeContext);
  if (ctx === null) {
    throw new Error("useRealtime must be used within a <RealtimeProvider>.");
  }
  return ctx;
}
