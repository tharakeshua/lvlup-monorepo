/**
 * `createSubscribe` (transport-realtime.md §2.2 subscribe/subscribe.ts).
 *
 * The dispatcher wired into the `Transport.subscribe` method. Normalizes the
 * function|callbacks form, looks up the wire-location descriptor, resolves the live
 * `PathContext` (claim tenant + auth uid), and hands off to the RTDB subscriber —
 * the ONLY realtime backend (AD-12 end state, reached by CHAT-1). Pure dispatch —
 * no shaping beyond the per-subscriber payload validate.
 */
import type { ParamsOf, PayloadOf, SubscriptionName } from "@levelup/api-contract";
import type {
  SubscribeCallback,
  SubscriptionCallbacks,
  SubscriptionHandle,
} from "../transport-contract.js";
import type { PathContext } from "../path-context.js";
import type { FirebaseTransportServices } from "../config/firebase-services.js";
import type { ValidateMode } from "./validate-payload.js";
import { SUBSCRIPTION_SOURCES, type RtdbSourceDescriptor } from "./subscription-sources.js";
import { subscribeViaRTDB } from "./subscribe-via-rtdb.js";

function normalize<P>(cb: SubscribeCallback<P>): SubscriptionCallbacks<P> {
  return typeof cb === "function" ? { next: cb } : cb;
}

export function createSubscribe(
  services: FirebaseTransportServices,
  getCtx: () => PathContext,
  mode: ValidateMode
) {
  return function subscribe<S extends SubscriptionName>(
    name: S,
    params: ParamsOf<S>,
    cb: SubscribeCallback<PayloadOf<S>>
  ): SubscriptionHandle {
    const callbacks = normalize(cb);
    const descriptor = SUBSCRIPTION_SOURCES[name];
    return subscribeViaRTDB(
      services.rtdb,
      descriptor as RtdbSourceDescriptor<S>,
      params,
      getCtx(),
      callbacks,
      mode,
      name
    );
  };
}
