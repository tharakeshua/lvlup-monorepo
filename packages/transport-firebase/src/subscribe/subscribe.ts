/**
 * `createSubscribe` (transport-realtime.md §2.2 subscribe/subscribe.ts).
 *
 * The dispatcher wired into the `Transport.subscribe` method. Normalizes the
 * function|callbacks form, looks up the wire-location descriptor, resolves the live
 * `PathContext` (claim tenant + auth uid), and routes to the Firestore or RTDB
 * subscriber. Pure dispatch — no shaping beyond the per-subscriber payload validate.
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
import {
  SUBSCRIPTION_SOURCES,
  type FirestoreSourceDescriptor,
  type RtdbSourceDescriptor,
} from "./subscription-sources.js";
import { subscribeViaFirestore } from "./subscribe-via-firestore.js";
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
    const ctx = getCtx();

    if (descriptor.backend === "firestore") {
      return subscribeViaFirestore(
        services.db,
        descriptor as FirestoreSourceDescriptor<S>,
        params,
        ctx,
        callbacks,
        mode,
        name
      );
    }
    return subscribeViaRTDB(
      services.rtdb,
      descriptor as RtdbSourceDescriptor<S>,
      params,
      ctx,
      callbacks,
      mode,
      name
    );
  };
}
