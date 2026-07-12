/**
 * Authority repos — the ⚷ server-only writes (REVIEW §6). These never have a
 * client write path (rules deny-all); they are reachable only through a service
 * over this Admin-SDK adapter.
 *
 *   claims      — custom-claims mint + token revocation (§6.2)
 *   answerKeys  — server-only deny-all subcollection put/get (§6.4)
 *   idempotency — atomic transactional dedupe (MERGE-IDEMPOTENCY, §5.5)
 *   outbox      — transactional outbox enqueue/drain (§5.3)
 *   audit       — append-only audit log
 */
import { type Firestore } from "firebase-admin/firestore";
import type { Auth } from "firebase-admin/auth";
import { docFromFirestore, toFirestore } from "./firestore.js";
import { IDEMPOTENCY_CONFLICT, makeIdempotencyConflict } from "./errors.js";
import {
  ANSWER_KEYS_COLLECTION_GROUP,
  answerKeyDoc,
  tenantDoc,
  auditPath,
  idempotencyDoc,
  outboxPath,
} from "./paths.js";
import type {
  AnswerKeyRepo,
  AuditRepo,
  ClaimsRepo,
  IdempotencyBeginResult,
  IdempotencyRepo,
  OutboxRepo,
  RateLimitRepo,
} from "./types.js";

export { IDEMPOTENCY_CONFLICT, makeIdempotencyConflict };

// --- claims ---------------------------------------------------------------

export function makeClaimsRepo(adminAuth: Auth): ClaimsRepo {
  return {
    async set(uid, claims) {
      await adminAuth.setCustomUserClaims(uid, claims);
    },
    async get(uid) {
      const user = await adminAuth.getUser(uid).catch(() => null);
      return (user?.customClaims as Record<string, unknown> | undefined) ?? null;
    },
    async revokeRefreshTokens(uid) {
      await adminAuth.revokeRefreshTokens(uid);
    },
  };
}

// --- answer keys (⚷ §6.4) -------------------------------------------------

export function makeAnswerKeyRepo(firestore: Firestore, now: () => string): AnswerKeyRepo {
  // The answer-key doc lives under the canonical nested item path. Its parent ids
  // are resolved from the key payload (`spaceId`,`storyPointId`) the saveItem
  // service already holds when it strips the key.
  return {
    async put(tenantId, itemId, key) {
      const spaceId = key["spaceId"] as string | undefined;
      const storyPointId = key["storyPointId"] as string | undefined;
      if (!spaceId || !storyPointId) {
        throw new Error("answerKeys.put requires spaceId + storyPointId on the key payload");
      }
      await firestore
        .doc(answerKeyDoc(tenantId, spaceId, storyPointId, itemId))
        .set(toFirestore({ ...key, itemId, tenantId, updatedAt: now() }), { merge: true });
    },
    async get(tenantId, itemId) {
      // Resolve via a collection-group read on the deny-all `answerKeys`
      // subcollection. The seed engine denormalizes `itemId` (and may omit
      // `tenantId`) on the key doc, so filter by `itemId` and verify tenant
      // scope from the parent path to find both seed- and service-written keys.
      const snap = await firestore
        .collectionGroup(ANSWER_KEYS_COLLECTION_GROUP)
        .where("itemId", "==", itemId)
        .get();
      const doc = snap.docs.find((d) => {
        const data = d.data() as { tenantId?: string };
        if (data.tenantId && data.tenantId !== tenantId) return false;
        // Path: {tenantsRoot}/{t}/spaces/{s}/storyPoints/{sp}/items/{i}/answerKeys/{k}.
        // Use the PREFIX-AWARE tenant doc path (LVLUP_COLLECTION_PREFIX) — a hardcoded
        // `tenants/` literal returns null under the v2_ prefix (path is v2_tenants/...).
        return d.ref.path.startsWith(`${tenantDoc(tenantId)}/`);
      });
      if (!doc) return null;
      return docFromFirestore({ ...doc.data() });
    },
  };
}

// --- idempotency (atomic dedupe, §5.5) ------------------------------------

export function makeIdempotencyRepo(
  firestore: Firestore,
  now: () => string,
  leaseMs: number
): IdempotencyRepo {
  return {
    async begin(tenantId, uid, key): Promise<IdempotencyBeginResult> {
      const ref = firestore.doc(idempotencyDoc(tenantId, uid, key));
      return firestore.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const nowMs = Date.parse(now());
        if (snap.exists) {
          const data = snap.data() as {
            status?: string;
            result?: unknown;
            leaseExpiresAt?: string;
          };
          if (data.status === "committed") {
            return { status: "committed", result: data.result };
          }
          // in_flight: conflict unless the lease is stale (then reclaim)
          const expires = data.leaseExpiresAt ? Date.parse(data.leaseExpiresAt) : 0;
          if (expires > nowMs) {
            throw makeIdempotencyConflict();
          }
        }
        tx.set(
          ref,
          toFirestore({
            status: "in_flight",
            uid,
            key,
            createdAt: now(),
            leaseExpiresAt: new Date(nowMs + leaseMs).toISOString(),
          }),
          { merge: true }
        );
        return { status: "new" };
      });
    },
    async commit(tenantId, uid, key, result) {
      await firestore
        .doc(idempotencyDoc(tenantId, uid, key))
        .set(toFirestore({ status: "committed", result, committedAt: now() }), { merge: true });
    },
    async release(tenantId, uid, key) {
      // Free an in-flight lease (the body threw) so an immediate retry can run.
      // Only delete a still-in_flight doc — never clobber a committed result.
      const ref = firestore.doc(idempotencyDoc(tenantId, uid, key));
      const snap = await ref.get();
      if (snap.exists && (snap.data() as { status?: string }).status !== "committed") {
        await ref.delete().catch(() => undefined);
      }
    },
  };
}

// --- outbox (§5.3) --------------------------------------------------------

export function makeOutboxRepo(firestore: Firestore, now: () => string): OutboxRepo {
  return {
    async enqueue(tenantId, entry) {
      const coll = firestore.collection(outboxPath(tenantId));
      // Prefer a stable doc id when the caller supplies one (DLQ resolve/update).
      const logicalId = typeof entry["id"] === "string" ? (entry["id"] as string) : undefined;
      const ref = logicalId ? coll.doc(logicalId) : coll.doc();
      await ref.set(
        toFirestore({
          ...entry,
          id: logicalId ?? ref.id,
          status: "pending",
          // DLQ entries carry their own attempt count — don't clobber it to 0.
          attempts: (entry["attempts"] as number | undefined) ?? 0,
          createdAt: now(),
          enqueuedAt: now(),
        }),
        { merge: true }
      );
    },
    async list(tenantId, opts = {}) {
      const coll = firestore.collection(outboxPath(tenantId));
      const snap = opts.kind ? await coll.where("_kind", "==", opts.kind).get() : await coll.get();
      return snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return docFromFirestore({
          ...data,
          // Prefer caller-supplied logical id; fall back to Firestore doc id.
          id: (typeof data["id"] === "string" ? data["id"] : undefined) ?? d.id,
        });
      });
    },
    async update(tenantId, id, patch) {
      const coll = firestore.collection(outboxPath(tenantId));
      // Fast path: doc id === logical id (enqueue-with-id above).
      const direct = coll.doc(id);
      const directSnap = await direct.get();
      if (directSnap.exists) {
        await direct.set(toFirestore({ ...patch, id }), { merge: true });
        return;
      }
      // Slow path: scan for a row whose data.id matches (legacy coll.add docs).
      const snap = await coll.get();
      const hit = snap.docs.find((d) => {
        const data = d.data() as Record<string, unknown>;
        return data["id"] === id || d.id === id;
      });
      if (!hit) {
        throw new Error(`outbox row ${id} not found`);
      }
      await hit.ref.set(toFirestore({ ...patch, id }), { merge: true });
    },
    async drain(tenantId) {
      const coll = firestore.collection(outboxPath(tenantId));
      const snap = await coll.where("status", "==", "pending").get();
      const rows = snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return docFromFirestore({
          ...data,
          id: (typeof data["id"] === "string" ? data["id"] : undefined) ?? d.id,
        });
      });
      // mark drained rows delivered (the drain worker re-marks failed ones)
      await Promise.all(
        snap.docs.map((d) => d.ref.update({ status: "delivered", deliveredAt: now() }))
      );
      return rows;
    },
  };
}

// --- rate limits (§2.6) ---------------------------------------------------

export function makeRateLimitRepo(firestore: Firestore, now: () => string): RateLimitRepo {
  return {
    async hit(subject, tier, windowKey) {
      // One counter doc per (subject,tier,window). Atomic read-modify-write in a
      // transaction so concurrent calls don't lose increments. Window is pinned
      // by the caller (minute granularity), so old docs simply stop being touched.
      const id = `${subject}__${tier}__${windowKey}`.replace(/\//g, "_");
      const ref = firestore.doc(`_rateLimits/${id}`);
      return firestore.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const prev = snap.exists ? ((snap.data()?.["count"] as number | undefined) ?? 0) : 0;
        const count = prev + 1;
        tx.set(ref, { subject, tier, windowKey, count, updatedAt: now() }, { merge: true });
        return count;
      });
    },
  };
}

// --- audit ----------------------------------------------------------------

export function makeAuditRepo(firestore: Firestore, now: () => string): AuditRepo {
  return {
    async write(tenantId, entry) {
      // ISO at rest (D4) — the audit row keeps the injected server clock, not a
      // FieldValue sentinel (which the write converter would mangle).
      await firestore
        .collection(auditPath(tenantId))
        .add(toFirestore({ ...entry, at: now(), createdAt: now() }));
    },
  };
}
