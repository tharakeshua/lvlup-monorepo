/**
 * `subscribeViaFirestore` (transport-realtime.md §2.2 subscribe/subscribe-via-firestore.ts).
 *
 *  • Resolves the descriptor → a placeholdered doc/query target, applies the
 *    PathContext (tenant/uid), and attaches an `onSnapshot` listener.
 *  • doc target  → the whole doc data is the payload (validated).
 *  • query target → the payload is the validated array of doc datas (append-only
 *    streams like chatStream / achievementUnlock).
 *  • `snap.metadata.fromCache === false` on the first server snapshot → `onSynced()`.
 *  • `onSnapshot` error → `cb.error(toTransportError(err))`.
 *  • READ-ONLY: never setDoc/updateDoc/addDoc/deleteDoc — realtime never writes
 *    (principle 5; asserted by the read-only lint test §8.6).
 *  • Returns an idempotent `SubscriptionHandle`.
 */
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
  type Firestore,
  type QueryConstraint,
} from "firebase/firestore";
import type { SubscriptionName, PayloadOf } from "@levelup/api-contract";
import type { SubscriptionCallbacks, SubscriptionHandle } from "../transport-contract.js";
import type { PathContext } from "../path-context.js";
import {
  applyPathContext,
  type FirestoreSourceDescriptor,
  type QueryConstraintSpec,
} from "./subscription-sources.js";
import { validatePayload, type ValidateMode } from "./validate-payload.js";
import { toTransportError } from "./to-transport-error.js";

let firestoreSubSeq = 0;

function buildConstraint(spec: QueryConstraintSpec): QueryConstraint {
  if (spec[0] === "where") {
    const [, field, op, value] = spec;
    return where(field, op, value);
  }
  const [, field, dir] = spec;
  return orderBy(field, dir);
}

export function subscribeViaFirestore<S extends SubscriptionName>(
  db: Firestore,
  descriptor: FirestoreSourceDescriptor<S>,
  params: import("@levelup/api-contract").ParamsOf<S>,
  ctx: PathContext,
  cb: SubscriptionCallbacks<PayloadOf<S>>,
  mode: ValidateMode,
  name: S
): SubscriptionHandle {
  const target = descriptor.resolve(params);
  const id = `fs_${name}_${firestoreSubSeq++}`;
  let active = true;
  let synced = false;

  const onSynced = () => {
    if (!synced) {
      synced = true;
      cb.onSynced?.();
    }
  };
  const handleError = (err: unknown) => cb.error?.(toTransportError(err));

  let detach: () => void;

  if (target.kind === "doc") {
    const ref = doc(db, applyPathContext(target.path, ctx));
    detach = onSnapshot(
      ref,
      (snap) => {
        if (!snap.metadata.fromCache) onSynced();
        if (!snap.exists()) return; // projection not yet written — wait for it
        try {
          cb.next(validatePayload(name, snap.data(), mode));
        } catch (err) {
          handleError(err);
        }
      },
      handleError
    );
  } else {
    const colRef = collection(db, applyPathContext(target.collectionPath, ctx));
    const q = query(colRef, ...target.constraints.map(buildConstraint));
    detach = onSnapshot(
      q,
      (snap) => {
        if (!snap.metadata.fromCache) onSynced();
        try {
          const rows = snap.docs.map((d) => validatePayload(name, d.data(), mode));
          // Append-only query channels surface the full validated array as the payload.
          cb.next(rows as unknown as PayloadOf<S>);
        } catch (err) {
          handleError(err);
        }
      },
      handleError
    );
  }

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
