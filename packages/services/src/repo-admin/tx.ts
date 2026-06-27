/**
 * `tx(fn)` — a real Firestore transaction giving services a `TxHandle` for atomic
 * state-change + outbox writes (server-shared.md §5.3 / invariant #14). Outbox
 * rows are STAGED inside the transaction and only persisted when the body returns
 * successfully — so a service that throws after a state write leaves NO outbox row
 * (Firestore rolls the whole transaction back).
 *
 * The TxHandle exposes the same `EntityCollectionName`-keyed `get`/`upsert` the
 * in-memory twin exposes. Nested-content collections (`items`) are not writable
 * through the generic tx handle (they need parent ids); progress writes go through
 * the dedicated `progress.update()` single-writer transaction instead.
 */
import {
  FieldPath,
  type DocumentReference,
  type Firestore,
  type Transaction,
} from "firebase-admin/firestore";
import { docFromFirestore, toFirestore } from "./firestore.js";
import { outboxPath, tenantCollection, tenantDoc } from "./paths.js";
import type { EntityCollectionName, TxHandle } from "./types.js";

/** The flat tenant-scoped collection name for each entity-collection key. */
const FLAT_COLLECTION: Record<EntityCollectionName, string> = {
  spaces: "spaces",
  storyPoints: "storyPoints", // top-level mirror id-keyed; nested writes use service-level paths
  items: "items",
  tenants: "tenants",
  students: "students",
  teachers: "teachers",
  classes: "classes",
  exams: "exams",
  submissions: "submissions",
  testSessions: "testSessions",
  progressDocs: "spaceProgress",
  notifications: "notifications",
  announcements: "announcements",
};

export function makeTx(firestore: Firestore, now: () => string) {
  return async function tx<T>(body: (handle: TxHandle) => Promise<T>): Promise<T> {
    const staged: Array<{ tenantId: string; entry: Record<string, unknown> }> = [];

    const result = await firestore.runTransaction(async (transaction: Transaction) => {
      const refFor = (
        coll: EntityCollectionName,
        tenantId: string,
        id: string
      ): DocumentReference =>
        // The LITERAL platform tenant doc lives top-level at `tenants/{tenantId}`
        // (NOT nested under itself) — mirror `makeTenantRepo.isTenantDoc` so a tx
        // write to the tenant's own lifecycle status (e.g. deactivateTenant) lands
        // where the platform reads it, not at the tenant-scoped `tenants/{t}/tenants/{t}`.
        coll === "tenants" && id === tenantId
          ? firestore.doc(tenantDoc(id))
          : firestore.doc(`${tenantCollection(tenantId, FLAT_COLLECTION[coll])}/${id}`);

      // a tx body must do all reads before writes (Firestore rule); we surface
      // get + upsert and let the service order them.
      const reads = new Map<string, Promise<Record<string, unknown> | null>>();

      const handle: TxHandle = {
        async get(coll, tenantId, id) {
          const key = `${coll}/${tenantId}/${id}`;
          let p = reads.get(key);
          if (!p) {
            p = transaction
              .get(refFor(coll, tenantId, id))
              .then((snap) =>
                snap.exists ? docFromFirestore({ ...snap.data(), id: snap.id }) : null
              );
            reads.set(key, p);
          }
          return p;
        },
        upsert(coll, tenantId, data) {
          const id =
            (data["id"] as string | undefined) ??
            firestore.collection(tenantCollection(tenantId, FLAT_COLLECTION[coll])).doc().id;
          const ref = refFor(coll, tenantId, id);
          transaction.set(ref, toFirestore({ ...data, id, tenantId, updatedAt: now() }), {
            merge: true,
          });
          return { id };
        },
        enqueueOutbox(tenantId, entry) {
          // write the outbox doc INSIDE the same transaction (atomic), but also
          // stage it so the in-memory twin's drain-only semantics line up. Here
          // the real write IS atomic, so staging is purely bookkeeping.
          const outRef = firestore.collection(outboxPath(tenantId)).doc();
          transaction.set(
            outRef,
            toFirestore({
              ...entry,
              status: "pending",
              attempts: 0,
              createdAt: now(),
              enqueuedAt: now(),
            })
          );
          staged.push({ tenantId, entry });
        },
      };

      return body(handle);
    });

    return result;
  };
}

export { FieldPath };
