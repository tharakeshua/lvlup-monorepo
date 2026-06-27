/**
 * Realtime pass-through (api-client-core.md §3.7 / §6.8).
 *
 * api-client owns only the realtime SEAM: it re-exposes `transport.subscribe`
 * typed against `SUBSCRIPTIONS`. In dev (`validateResponses: true`) each emitted
 * payload is parsed against `SUBSCRIPTIONS[name].payload` so realtime drift
 * surfaces the same way response drift does on the callable path. Full hooks,
 * refcount/dedupe, and `useSubscription` live in `@levelup/realtime` /
 * `@levelup/query` — never here.
 */
import { SUBSCRIPTIONS } from "@levelup/api-contract";
import type { SubscriptionName, ParamsOf, PayloadOf } from "@levelup/api-contract";
import type { SubscriptionHandle, SubscriptionListener, Transport } from "./transport.js";

/** The typed `subscribe` function the client surface re-exposes. */
export type SubscribeFn = <S extends SubscriptionName>(
  name: S,
  params: ParamsOf<S>,
  cb: SubscriptionListener<PayloadOf<S>>
) => SubscriptionHandle;

function asNext<P>(cb: SubscriptionListener<P>): (payload: P) => void {
  return typeof cb === "function" ? cb : cb.next;
}

function withCallbacks<P>(
  cb: SubscriptionListener<P>,
  next: (payload: P) => void
): SubscriptionListener<P> {
  if (typeof cb === "function") return next;
  return { ...cb, next };
}

/**
 * Wrap `transport.subscribe` with dev-mode payload validation off
 * `SUBSCRIPTIONS[name].payload`. A valid payload flows to the callback untouched;
 * an off-schema payload in dev throws (surfacing drift) instead of silently
 * delivering a bad shape.
 */
export function makeSubscribe(
  transport: Transport,
  opts: { validateResponses?: boolean } = {}
): SubscribeFn {
  return <S extends SubscriptionName>(
    name: S,
    params: ParamsOf<S>,
    cb: SubscriptionListener<PayloadOf<S>>
  ): SubscriptionHandle => {
    const userNext = asNext(cb);
    if (!opts.validateResponses) {
      return transport.subscribe(name, params, cb);
    }
    const def = SUBSCRIPTIONS[name];
    const validatingNext = (payload: PayloadOf<S>): void => {
      // Dev drift detector: parse throws on an off-schema realtime emission.
      def.payload.parse(payload);
      userNext(payload);
    };
    return transport.subscribe(name, params, withCallbacks(cb, validatingNext));
  };
}
