/**
 * `subscribeViaRTDB` (transport-realtime.md §2.2 subscribe/subscribe-via-rtdb.ts).
 *
 *  • Resolves the descriptor → a placeholdered node path, applies the PathContext,
 *    and attaches an `onValue` listener.
 *  • Each value → `validatePayload(name, snap.val())` → `cb.next(payload)`.
 *  • First emission resolves `onSynced` (RTDB delivers the server value on attach).
 *  • READ-ONLY: never set()/update()/push() — realtime never writes (principle 5;
 *    asserted by the read-only lint test §8.6).
 *  • `onValue` error → `cb.error(toTransportError(err))`; `off()`-equivalent on unsubscribe.
 *  • Returns an idempotent `SubscriptionHandle`.
 */
import { onValue, ref, type Database } from "firebase/database";
import type { ParamsOf, SubscriptionName, PayloadOf } from "@levelup/api-contract";
import type { SubscriptionCallbacks, SubscriptionHandle } from "../transport-contract.js";
import type { PathContext } from "../path-context.js";
import { applyPathContext, type RtdbSourceDescriptor } from "./subscription-sources.js";
import { validatePayload, type ValidateMode } from "./validate-payload.js";
import { toTransportError } from "./to-transport-error.js";

let rtdbSubSeq = 0;

export function subscribeViaRTDB<S extends SubscriptionName>(
  rtdb: Database,
  descriptor: RtdbSourceDescriptor<S>,
  params: ParamsOf<S>,
  ctx: PathContext,
  cb: SubscriptionCallbacks<PayloadOf<S>>,
  mode: ValidateMode,
  name: S
): SubscriptionHandle {
  const target = descriptor.resolve(params);
  const nodeRef = ref(rtdb, applyPathContext(target.nodePath, ctx));
  const id = `rtdb_${name}_${rtdbSubSeq++}`;
  let active = true;
  let synced = false;

  // onValue returns its own unsubscriber (off-equivalent); read-only listener.
  const detach = onValue(
    nodeRef,
    (snap) => {
      if (!synced) {
        synced = true;
        cb.onSynced?.();
      }
      try {
        cb.next(validatePayload(name, snap.val(), mode));
      } catch (err) {
        cb.error?.(toTransportError(err));
      }
    },
    (err) => cb.error?.(toTransportError(err))
  );

  return {
    id,
    get active() {
      return active;
    },
    unsubscribe() {
      if (!active) return; // idempotent
      active = false;
      detach();
    },
  };
}
