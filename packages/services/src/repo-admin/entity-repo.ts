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
  type QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import { docFromFirestore, toFirestore } from "./firestore.js";
import { decodePageCursor, encodePageCursor } from "./cursor.js";
import { chunk } from "./batch-writer.js";
import { tenantCollection } from "./paths.js";
import type { EntityRepo, ListOptions, RepoPage } from "./types.js";

const DEFAULT_LIMIT = 20;

/**
 * Filterable fields that store an ARRAY on the doc but are queried with a single
 * scalar member (e.g. roster reads: `where classIds = classId`). Firestore `==`
 * never matches a scalar against an array element, so these must use
 * `array-contains`. Keep in sync with the entity schemas whose list filters
 * target membership arrays (Student.classIds, Parent.studentIds, etc.).
 */
const ARRAY_MEMBERSHIP_FIELDS = new Set([
  "classIds",
  "studentIds",
  "teacherIds",
  "parentIds",
  "linkedStudentIds",
]);

function nextId(coll: CollectionReference): string {
  return coll.doc().id;
}

function applyCursor(q: Query, orderBy: string, snap: QueryDocumentSnapshot): Query {
  return orderBy === "__name__"
    ? q.startAfter(snap.id)
    : q.startAfter(snap.get(orderBy) as unknown, snap.id);
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
          // Array membership fields (classIds, etc.) must use array-contains when
          // filtered by a single scalar member; `==` would never match an element.
          const op =
            ARRAY_MEMBERSHIP_FIELDS.has(field) && !Array.isArray(value) ? "array-contains" : "==";
          q = q.where(field, op, value);
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
      // Over-fetch matching docs, not raw docs. Some collections intentionally
      // carry mixed child/entity rows and then apply an in-memory discriminator
      // filter. Applying that filter after a single Firestore `limit` can return
      // short pages and hide later matching docs.
      const matched: Array<{ data: Record<string, unknown>; snap: QueryDocumentSnapshot }> = [];
      const batchLimit = limit + 1;
      let pageQuery = q;
      let exhausted = false;
      while (matched.length <= limit && !exhausted) {
        const snap = await pageQuery.limit(batchLimit).get();
        if (snap.docs.length === 0) {
          exhausted = true;
          break;
        }
        for (const d of snap.docs) {
          const data = docFromFirestore({ ...d.data(), id: d.id });
          if (!opts.filter || opts.filter(data)) matched.push({ data, snap: d });
        }
        exhausted = snap.docs.length < batchLimit;
        if (!exhausted) {
          pageQuery = applyCursor(q, orderBy, snap.docs[snap.docs.length - 1]!);
        }
      }

      const hasMore = matched.length > limit;
      const page = matched.slice(0, limit).map((d) => d.data);
      const last = page.length > 0 ? matched[page.length - 1]?.snap : undefined;
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
