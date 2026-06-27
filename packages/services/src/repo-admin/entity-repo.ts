/**
 * Admin-SDK entity repo factory — a flat tenant-scoped collection accessor
 * (`get`/`getMany`/`upsert`/`list`/`delete`) with cursor pagination + the
 * chunk-of-10 `getMany` N+1 collapse (DX-14). The converters (firestore.ts) do
 * the Timestamp↔ISO + brand normalization so services receive plain JSON.
 *
 * The nested-content collections (storyPoints, items) override path resolution
 * via `makeNestedItemRepo` — but the public `EntityRepo` surface is identical so
 * services stay path-agnostic (D1).
 */
import {
  FieldPath,
  type CollectionReference,
  type Firestore,
  type Query,
} from "firebase-admin/firestore";
import { docFromFirestore, toFirestore } from "./firestore.js";
import { decodePageCursor, encodePageCursor } from "./cursor.js";
import { chunk } from "./batch-writer.js";
import { tenantCollection } from "./paths.js";
import type { EntityRepo, ListOptions, RepoPage } from "./types.js";

const DEFAULT_LIMIT = 20;

function nextId(coll: CollectionReference): string {
  return coll.doc().id;
}

/** A flat tenant-scoped Firestore collection accessor. */
export function makeEntityRepo(
  firestore: Firestore,
  collectionName: string,
  now: () => string
): EntityRepo {
  const collFor = (tenantId: string): CollectionReference =>
    firestore.collection(tenantCollection(tenantId, collectionName));

  return {
    async get(tenantId, id) {
      const snap = await collFor(tenantId).doc(id).get();
      if (!snap.exists) return null;
      return docFromFirestore({ ...snap.data(), id: snap.id });
    },

    async getMany(tenantId, ids) {
      if (ids.length === 0) return [];
      const coll = collFor(tenantId);
      const chunks = chunk([...new Set(ids)]);
      const results = await Promise.all(
        chunks.map((c) => coll.where(FieldPath.documentId(), "in", c).get())
      );
      const byId = new Map<string, Record<string, unknown>>();
      for (const qs of results) {
        for (const d of qs.docs) {
          byId.set(d.id, docFromFirestore({ ...d.data(), id: d.id }));
        }
      }
      // preserve caller order, drop missing
      return ids.map((id) => byId.get(id)).filter((d): d is Record<string, unknown> => Boolean(d));
    },

    async upsert(tenantId, data, ts = now()) {
      const coll = collFor(tenantId);
      const id = (data["id"] as string | undefined) ?? nextId(coll);
      const ref = coll.doc(id);
      const existing = await ref.get();
      const created = !existing.exists;
      const payload = toFirestore({
        ...data,
        id,
        tenantId,
        updatedAt: ts,
        ...(created ? { createdAt: ts } : {}),
      });
      await ref.set(payload, { merge: true });
      return { id, created };
    },

    async list(tenantId, opts: ListOptions = {}) {
      const orderBy = opts.orderBy ?? "__name__";
      let q: Query = collFor(tenantId);
      if (opts.where) {
        for (const [field, value] of Object.entries(opts.where)) {
          q = q.where(field, "==", value);
        }
      }
      q =
        orderBy === "__name__"
          ? q.orderBy(FieldPath.documentId())
          : q.orderBy(orderBy).orderBy(FieldPath.documentId());

      const limit = opts.limit ?? DEFAULT_LIMIT;
      if (opts.cursor) {
        const cur = decodePageCursor(opts.cursor);
        q = orderBy === "__name__" ? q.startAfter(cur.id) : q.startAfter(cur.v, cur.id);
      }
      // over-fetch by 1 to detect a next page
      const snap = await q.limit(limit + 1).get();
      let docs = snap.docs.map((d) => docFromFirestore({ ...d.data(), id: d.id }));
      if (opts.filter) docs = docs.filter(opts.filter);

      const hasMore = snap.docs.length > limit;
      const page = docs.slice(0, limit);
      const last = page.length > 0 ? snap.docs[page.length - 1] : undefined;
      const nextCursor: RepoPage["nextCursor"] =
        hasMore && last
          ? encodePageCursor({
              v: orderBy === "__name__" ? last.id : (last.get(orderBy) as unknown),
              id: last.id,
            })
          : null;
      return { items: page, nextCursor };
    },

    async delete(tenantId, id) {
      await collFor(tenantId).doc(id).delete();
    },
  };
}
