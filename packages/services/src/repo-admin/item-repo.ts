/**
 * Nested-content item repo (D1 single canonical path). Items live at
 * `tenants/{t}/spaces/{s}/storyPoints/{sp}/items/{id}`. A bare item id is
 * resolved via a collection-group query on `items` filtered to the tenant
 * (`tenantId` is denormalized on every item doc). Writes require the parent ids,
 * which the item doc carries (`spaceId`, `storyPointId`) so the service that owns
 * the item always has them.
 *
 * The public surface is the same `EntityRepo` so services stay path-agnostic.
 */
import { type Firestore, type Query } from "firebase-admin/firestore";
import { docFromFirestore, toFirestore } from "./firestore.js";
import { decodePageCursor, encodePageCursor } from "./cursor.js";
import { chunk } from "./batch-writer.js";
import { ITEMS_COLLECTION_GROUP, itemDoc } from "./paths.js";
import type { ListOptions, ScopedItemRepo } from "./types.js";

const DEFAULT_LIMIT = 20;

function parentIds(data: Record<string, unknown>): { spaceId: string; storyPointId: string } {
  const spaceId = data["spaceId"] as string | undefined;
  const storyPointId = data["storyPointId"] as string | undefined;
  if (!spaceId || !storyPointId) {
    throw new Error("item doc requires spaceId + storyPointId to resolve its nested path (D1)");
  }
  return { spaceId, storyPointId };
}

export function makeItemRepo(firestore: Firestore, now: () => string): ScopedItemRepo {
  const cg = (): Query => firestore.collectionGroup(ITEMS_COLLECTION_GROUP);

  const byIdInTenant = (tenantId: string): Query => cg().where("tenantId", "==", tenantId);

  return {
    async getScoped(tenantId, spaceId, storyPointId, itemId) {
      const snap = await firestore.doc(itemDoc(tenantId, spaceId, storyPointId, itemId)).get();
      if (!snap.exists) return null;
      const data = docFromFirestore({ ...snap.data(), id: snap.id });
      // Exact paths already identify the intended parent; retain this guard so
      // malformed/copied documents never escape as a valid scoped item.
      if (
        data["tenantId"] !== tenantId ||
        data["spaceId"] !== spaceId ||
        data["storyPointId"] !== storyPointId
      ) {
        return null;
      }
      return data;
    },

    async get(tenantId, id) {
      // A collection-group query CANNOT filter by `documentId() == <bare id>`
      // (the value must be a full doc path → "odd number of segments"). Items
      // denormalize their own `id`, so filter on the `id` field instead.
      const snap = await byIdInTenant(tenantId).where("id", "==", id).limit(1).get();
      const doc = snap.docs[0];
      if (!doc) return null;
      return docFromFirestore({ ...doc.data(), id: doc.id });
    },

    async getMany(tenantId, ids) {
      if (ids.length === 0) return [];
      const chunks = chunk([...new Set(ids)]);
      const results = await Promise.all(
        chunks.map((c) => byIdInTenant(tenantId).where("id", "in", c).get())
      );
      const byId = new Map<string, Record<string, unknown>>();
      for (const qs of results) {
        for (const d of qs.docs) {
          byId.set(d.id, docFromFirestore({ ...d.data(), id: d.id }));
        }
      }
      return ids.map((id) => byId.get(id)).filter((d): d is Record<string, unknown> => Boolean(d));
    },

    async upsert(tenantId, data, ts = now()) {
      const { spaceId, storyPointId } = parentIds(data);
      const id = (data["id"] as string | undefined) ?? firestore.collection("_ids").doc().id;
      const ref = firestore.doc(itemDoc(tenantId, spaceId, storyPointId, id));
      const existing = await ref.get();
      const created = !existing.exists;
      await ref.set(
        toFirestore({
          ...data,
          id,
          tenantId,
          spaceId,
          storyPointId,
          updatedAt: ts,
          ...(created ? { createdAt: ts } : {}),
        }),
        { merge: true }
      );
      return { id, created };
    },

    async list(tenantId, opts: ListOptions = {}) {
      // NOTE: a collection-group query CANNOT `orderBy(documentId())` + cursor on a
      // bare id (the cursor must be a full doc path → "odd number of segments").
      // Items per story point are a bounded set, so fetch the filtered group and
      // order/paginate in-memory on the stable doc id.
      let q: Query = byIdInTenant(tenantId);
      if (opts.where) {
        for (const [field, value] of Object.entries(opts.where)) {
          q = q.where(field, "==", value);
        }
      }
      const snap = await q.get();
      let docs = snap.docs
        .map((d) => docFromFirestore({ ...d.data(), id: d.id }))
        .sort((a, b) => String(a["id"]).localeCompare(String(b["id"])));
      if (opts.filter) docs = docs.filter(opts.filter);
      if (opts.cursor) {
        const cur = decodePageCursor(opts.cursor);
        const afterId = String(cur.id);
        docs = docs.filter((d) => String(d["id"]) > afterId);
      }
      const limit = opts.limit ?? DEFAULT_LIMIT;
      const hasMore = docs.length > limit;
      const page = docs.slice(0, limit);
      const last = page[page.length - 1];
      const nextCursor =
        hasMore && last
          ? encodePageCursor({ v: String(last["id"]), id: String(last["id"]) })
          : null;
      return { items: page, nextCursor };
    },

    async delete(tenantId, id) {
      const snap = await byIdInTenant(tenantId).where("id", "==", id).limit(1).get();
      const doc = snap.docs[0];
      if (doc) await doc.ref.delete();
    },
  };
}
