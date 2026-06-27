/**
 * `use-subscription.ts` — the generic realtime hook every convenience hook wraps
 * (transport-realtime layer §3.2).
 *
 * Subscribes through the context `SubscriptionManager` (so N consumers of the same
 * `(name, params)` share ONE underlying listener), tracks the latest payload + status +
 * `synced`, and tears down on unmount / params change. No DOM — stable across web + RN.
 *
 * It performs **no domain shaping**: the validated payload is returned as-is. Reconciliation
 * with the REST first-paint (the `targetKey` cache write) is `@levelup/query`'s job via `onData`.
 */
import { useEffect, useRef, useState } from "react";
import type {
  SubscriptionName,
  ParamsOf,
  PayloadOf,
  SubscriptionHandle,
  ApiError,
} from "./seam.js";
import { useRealtime } from "./realtime-provider.js";
import { stableStringify } from "./subscription-manager.js";
import type { RealtimeStatus, UseSubscriptionOptions, UseSubscriptionResult } from "./types.js";

export function useSubscription<S extends SubscriptionName>(
  name: S,
  params: ParamsOf<S>,
  opts?: UseSubscriptionOptions
): UseSubscriptionResult<PayloadOf<S>> {
  const { manager } = useRealtime();
  const enabled = opts?.enabled ?? true;

  const [data, setData] = useState<PayloadOf<S> | undefined>(undefined);
  const [status, setStatus] = useState<RealtimeStatus>(enabled ? "connecting" : "idle");
  const [error, setError] = useState<ApiError | undefined>(undefined);
  const [synced, setSynced] = useState(false);

  // Keep the latest onData in a ref so it isn't part of the resubscribe key.
  const onDataRef = useRef<UseSubscriptionOptions["onData"]>(opts?.onData);
  onDataRef.current = opts?.onData;

  // Stable params key so object-identity churn doesn't thrash the subscription.
  const paramsKey = stableStringify(params);

  useEffect(() => {
    if (!enabled) {
      setStatus("idle");
      setSynced(false);
      return;
    }

    setStatus("connecting");
    let cancelled = false;
    let handle: SubscriptionHandle | undefined;

    handle = manager.subscribe(name, params, {
      next: (payload) => {
        if (cancelled) return;
        setData(payload);
        setError(undefined);
        setStatus("live");
        onDataRef.current?.(payload);
      },
      error: (err) => {
        if (cancelled) return;
        setError(err);
        setStatus("error");
      },
      onSynced: () => {
        if (cancelled) return;
        setSynced(true);
      },
    });

    return () => {
      cancelled = true;
      handle?.unsubscribe();
    };
    // `params` is folded into `paramsKey`; `name`/`enabled` are primitives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manager, name, paramsKey, enabled]);

  return { data, status, error, synced };
}
