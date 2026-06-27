/**
 * `useSubscription` — the realtime cache-write seam (query-infra.md §11).
 *
 * Thin React binding over `transport.subscribe`: it writes the server payload
 * into the query cache (server wins). The default writer puts the payload under
 * the channel's `SUBSCRIPTION_TARGET_KEYS` key; a custom `onPayload` takes over
 * (the caller may reconcile against an optimistic local value). The
 * transport-agnostic `subscribe` seam + `SubscriptionHandle` are owned by
 * `@levelup/realtime`; this is just the binding that writes into RQ's cache.
 */
import { useEffect, useState } from "react";
import type { QueryClient } from "@tanstack/react-query";
import type { SubscriptionName, ParamsOf, PayloadOf } from "@levelup/api-contract";
import { useApi } from "../provider/useApi.js";
import { useApiQueryClient } from "../provider/useApi.js";
import { SUBSCRIPTION_TARGET_KEYS } from "./subscription-keys.js";

export type SubscriptionStatus = "idle" | "live" | "error";

export interface UseSubscriptionResult {
  status: SubscriptionStatus;
}

export function useSubscription<S extends SubscriptionName>(
  name: S,
  params: ParamsOf<S>,
  onPayload?: (payload: PayloadOf<S>, qc: QueryClient) => void
): UseSubscriptionResult {
  const { transport } = useApi();
  const qc = useApiQueryClient();
  const [status, setStatus] = useState<SubscriptionStatus>("idle");

  useEffect(() => {
    const factory = SUBSCRIPTION_TARGET_KEYS[name as string];
    const handle = transport.subscribe(name, params, {
      next: (payload: PayloadOf<S>) => {
        setStatus("live");
        if (onPayload) {
          onPayload(payload, qc);
        } else if (factory) {
          qc.setQueryData(factory(params as Record<string, unknown>), payload);
        }
      },
      error: () => setStatus("error"),
    });
    return () => handle.unsubscribe();
    // params are stable-by-value; serialize so a structurally-equal object
    // doesn't re-subscribe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, JSON.stringify(params)]);

  return { status };
}
