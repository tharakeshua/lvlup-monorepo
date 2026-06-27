/**
 * `subscription-manager.ts` — refcount/dedupe over `transport.subscribe`
 * (transport-realtime layer §3.2).
 *
 * N components subscribing the SAME `(name, params)` share ONE underlying
 * `transport.subscribe` call (the realtime-side N+1 collapse). The manager:
 *   - keys entries by `${name}:${stableStringify(params)}`,
 *   - refcounts handles; the LAST `unsubscribe()` tears down the underlying listener,
 *   - replays the last payload (and `synced`/`error` state) to late subscribers immediately
 *     (warm fan-out), so a component mounting after first emission paints instantly.
 *
 * No firebase/* import; it consumes only the injected `RealtimeTransport.subscribe` seam.
 */
import type {
  RealtimeTransport,
  SubscriptionHandle,
  SubscriptionCallbacks,
  SubscriptionName,
  ParamsOf,
  PayloadOf,
  ApiError,
} from "./seam.js";

export interface SubscriptionManager {
  subscribe<S extends SubscriptionName>(
    name: S,
    params: ParamsOf<S>,
    cb: SubscriptionCallbacks<PayloadOf<S>>
  ): SubscriptionHandle;
}

/** Deterministic stringify so `{a:1,b:2}` and `{b:2,a:1}` key the same entry. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "undefined";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`)
    .join(",")}}`;
}

interface Entry {
  /** The underlying single handle from the transport. */
  handle: SubscriptionHandle;
  /** Live consumer callback sets (refcount = size). */
  consumers: Set<SubscriptionCallbacks<unknown>>;
  /** Last payload for warm replay to late subscribers. */
  lastPayload: unknown;
  hasPayload: boolean;
  /** Whether the first server snapshot has been seen (replayed via onSynced). */
  synced: boolean;
  /** Last error, replayed to late subscribers. */
  lastError: ApiError | undefined;
}

let handleSeq = 0;

export function createSubscriptionManager(
  transport: Pick<RealtimeTransport, "subscribe">
): SubscriptionManager {
  const entries = new Map<string, Entry>();

  return {
    subscribe<S extends SubscriptionName>(
      name: S,
      params: ParamsOf<S>,
      cb: SubscriptionCallbacks<PayloadOf<S>>
    ): SubscriptionHandle {
      const key = `${name}:${stableStringify(params)}`;
      const consumer = cb as SubscriptionCallbacks<unknown>;

      let entry = entries.get(key);
      if (!entry) {
        // First consumer for this key — open the single underlying listener.
        const created: Entry = {
          // handle assigned synchronously below; transport.subscribe may emit during this call.
          handle: undefined as unknown as SubscriptionHandle,
          consumers: new Set<SubscriptionCallbacks<unknown>>(),
          lastPayload: undefined,
          hasPayload: false,
          synced: false,
          lastError: undefined,
        };
        entries.set(key, created);
        entry = created;

        created.handle = transport.subscribe(name, params, {
          next: (payload) => {
            created.lastPayload = payload;
            created.hasPayload = true;
            created.lastError = undefined;
            for (const c of created.consumers) c.next(payload);
          },
          error: (err) => {
            created.lastError = err;
            for (const c of created.consumers) c.error?.(err);
          },
          onSynced: () => {
            created.synced = true;
            for (const c of created.consumers) c.onSynced?.();
          },
        });
      }

      const target = entry;
      target.consumers.add(consumer);

      // Warm fan-out: replay current state to the late subscriber synchronously.
      if (target.hasPayload) consumer.next(target.lastPayload as PayloadOf<S>);
      if (target.synced) consumer.onSynced?.();
      if (target.lastError) consumer.error?.(target.lastError);

      let active = true;
      const id = `rt#${++handleSeq}`;
      return {
        id,
        get active() {
          return active;
        },
        unsubscribe() {
          if (!active) return; // idempotent
          active = false;
          target.consumers.delete(consumer);
          if (target.consumers.size === 0) {
            target.handle.unsubscribe();
            entries.delete(key);
          }
        },
      };
    },
  };
}
