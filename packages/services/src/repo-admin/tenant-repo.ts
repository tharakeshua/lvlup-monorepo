/**
 * Top-level tenant repo with a generic-store fallback.
 *
 * Two access shapes funnel through `ctx.repos.tenants`:
 *
 *  1. THE TENANT DOC — `get(tenantId, tenantId)` / `list('__platform__', …)` /
 *     `upsert(tenantId, {id: tenantId, …})`. Tenant docs live at the PLATFORM-root
 *     collection `tenants/{tenantId}` (NOT nested under themselves).
 *
 *  2. A `_kind`-DISCRIMINATED GENERIC STORE — much of the analytics + autograde
 *     slice models materialized projections / cost summaries / eval-settings as
 *     `ctx.repos.tenants.get(tenantId, '<kind>_<id>')` (the in-memory-twin idiom).
 *     Those are TENANT-SCOPED, not platform tenants; routing them to the top-level
 *     `tenants` collection would pollute it (and the `tenants`-count idempotency
 *     snapshot). We route any id that is NOT the caller's tenantId (and not a
 *     platform-registry list) to a tenant-scoped generic subcollection
 *     `tenants/{tenantId}/_generic/{id}`, transparently preserving the convention.
 *
 * The public surface is the same `EntityRepo` (+ `getUsageConfig` for the AI seam)
 * so services stay path-agnostic.
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
import { tenantsRoot, tenantDoc, tenantCodeDoc } from "./paths.js";
import type { EntityRepo, ListOptions } from "./types.js";

const DEFAULT_LIMIT = 20;
const PLATFORM = "__platform__";

export function makeTenantRepo(firestore: Firestore, now: () => string): EntityRepo {
  const tenantsColl = (): CollectionReference => firestore.collection(tenantsRoot());
  const genericColl = (tenantId: string): CollectionReference =>
    firestore.collection(`${tenantDoc(tenantId)}/_generic`);

  /** Is `id` the literal tenant doc (top-level), vs a `_kind` generic doc? */
  const isTenantDoc = (tenantId: string, id: string): boolean =>
    tenantId === PLATFORM || id === tenantId;

  return {
    async get(tenantId, id) {
      const coll = isTenantDoc(tenantId, id) ? tenantsColl() : genericColl(tenantId);
      const snap = await coll.doc(id).get();
      if (!snap.exists) return null;
      return docFromFirestore({ ...snap.data(), id: snap.id });
    },

    async getMany(tenantId, ids) {
      if (ids.length === 0) return [];
      // getMany is only used for real tenant docs (platform list); read top-level.
      const chunks = chunk([...new Set(ids)]);
      const results = await Promise.all(
        chunks.map((c) => tenantsColl().where(FieldPath.documentId(), "in", c).get())
      );
      const byId = new Map<string, Record<string, unknown>>();
      for (const qs of results)
        for (const d of qs.docs) byId.set(d.id, docFromFirestore({ ...d.data(), id: d.id }));
      return ids.map((id) => byId.get(id)).filter((d): d is Record<string, unknown> => Boolean(d));
    },

    async upsert(tenantId, data, ts = now()) {
      const explicitId = data["id"] as string | undefined;
      const tenantDoc = explicitId ? isTenantDoc(tenantId, explicitId) : tenantId !== PLATFORM;
      const coll = tenantDoc ? tenantsColl() : genericColl(tenantId);
      const id = explicitId ?? coll.doc().id;
      const ref = coll.doc(id);
      const existing = await ref.get();
      const created = !existing.exists;
      await ref.set(
        toFirestore({ ...data, id, updatedAt: ts, ...(created ? { createdAt: ts } : {}) }),
        { merge: true }
      );
      return { id, created };
    },

    async list(tenantId, opts: ListOptions = {}) {
      // A platform-scoped list enumerates real tenants; a tenant-scoped list (with a
      // `_kind` filter) scans the generic store.
      const coll = tenantId === PLATFORM ? tenantsColl() : genericColl(tenantId);
      let q: Query = coll;
      if (opts.where) for (const [f, v] of Object.entries(opts.where)) q = q.where(f, "==", v);
      q = q.orderBy(FieldPath.documentId());
      const limit = opts.limit ?? DEFAULT_LIMIT;
      if (opts.cursor) q = q.startAfter(decodePageCursor(opts.cursor).id);
      const snap = await q.limit(limit + 1).get();
      let docs = snap.docs.map((d) => docFromFirestore({ ...d.data(), id: d.id }));
      if (opts.filter) docs = docs.filter(opts.filter);
      const hasMore = snap.docs.length > limit;
      const page = docs.slice(0, limit);
      const last = page.length > 0 ? snap.docs[page.length - 1] : undefined;
      const nextCursor = hasMore && last ? encodePageCursor({ v: last.id, id: last.id }) : null;
      return { items: page, nextCursor };
    },

    async delete(tenantId, id) {
      const coll = isTenantDoc(tenantId, id) ? tenantsColl() : genericColl(tenantId);
      await coll.doc(id).delete();
    },

    // AI-gateway usage-config read (the gateway's quota pre-check, `AiRepos.tenants`).
    async getUsageConfig(tenantId: string) {
      const snap = await tenantsColl().doc(tenantId).get();
      const data = snap.data() as { usageConfig?: Record<string, unknown> } | undefined;
      return data?.usageConfig ?? null;
    },

    // Public code-index resolution (`tenantCodes/{code}` → tenantId). The index is
    // the only public-readable map from a join code to a tenant; lookupTenantByCode
    // resolves it server-side, then reads the (top-level) tenant doc.
    async resolveCode(code: string) {
      const snap = await firestore.doc(tenantCodeDoc(code)).get();
      if (!snap.exists) return null;
      return (snap.data()?.["tenantId"] as string | undefined) ?? null;
    },
  } as EntityRepo & {
    getUsageConfig(tenantId: string): Promise<Record<string, unknown> | null>;
    resolveCode(code: string): Promise<string | null>;
  };
}
