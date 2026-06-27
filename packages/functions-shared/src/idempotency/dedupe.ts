/**
 * Idempotency dedupe (server-shared.md §2.7). The server half of the §5.4 pattern.
 *
 * Stored via `ctx.repos.idempotency.*` under
 * `tenants/{t}/idempotency/{uid}_{key}`. Mandatory for createOrgUser, bulkImport*,
 * submitTestSession, recordItemAttempt, evaluateAnswer, uploadAnswerSheets,
 * purchaseSpace.
 *
 *   begin()  → returns the cached response if (uid,key) already committed; else
 *              marks the key in-flight (or throws IDEMPOTENCY_CONFLICT on a lease).
 *   commit() → stores the response keyed (uid, idempotencyKey).
 *   release()→ frees an in-flight lease when the body throws (so a retry can run).
 */
import type { JsonValue } from "@levelup/api-contract";
import type { AuthContext } from "../context/auth-context.js";
import { fail } from "../request/fail.js";

/**
 * The canonical `@levelup/services/repo-admin` `IdempotencyRepo` shape:
 *   begin(tenantId, uid, key) → { status: 'new'|'committed'|'in_flight', result? }
 *   commit(tenantId, uid, key, result)
 * (no per-call `name` arg and no `release` — the dedupe key folds the callable name
 * in, and a stale in-flight lease is reclaimed by `begin`'s lease-TTL logic.)
 */
interface AdminIdempotencyRepo {
  begin(tenantId: string, uid: string, key: string): Promise<{ status?: string; result?: unknown }>;
  commit(tenantId: string, uid: string, key: string, result: unknown): Promise<void>;
  release?(tenantId: string, uid: string, key: string): Promise<void>;
}

/** Compose the dedupe doc key from the callable name + the envelope idempotency key. */
function dedupeKey(name: string, idempotencyKey: string): string {
  return `${name}:${idempotencyKey}`;
}

export const dedupe = {
  /** Returns the cached response if present; null means "run the body". Throws on an active lease. */
  async begin<R = unknown>(ctx: AuthContext, name: string): Promise<R | null> {
    const idk = ctx.idempotencyKey;
    if (!idk) return null;
    const repo = ctx.repos.idempotency as unknown as AdminIdempotencyRepo;
    const res = await repo.begin(ctx.tenantId ?? "", ctx.uid, dedupeKey(name, idk));
    if (res.status === "committed") return (res.result ?? null) as R;
    if (res.status === "in_flight") {
      fail("IDEMPOTENCY_CONFLICT", "a request with this idempotency key is in flight", {
        retryable: true,
        meta: { name },
      });
    }
    return null;
  },

  /** Persist the committed response for replay. */
  async commit(ctx: AuthContext, name: string, res: unknown): Promise<void> {
    const idk = ctx.idempotencyKey;
    if (!idk) return;
    const repo = ctx.repos.idempotency as unknown as AdminIdempotencyRepo;
    await repo.commit(ctx.tenantId ?? "", ctx.uid, dedupeKey(name, idk), res as JsonValue);
  },

  /** Release an in-flight lease (call when the service body throws). */
  async release(ctx: AuthContext, name: string): Promise<void> {
    const idk = ctx.idempotencyKey;
    if (!idk) return;
    const repo = ctx.repos.idempotency as unknown as AdminIdempotencyRepo;
    if (typeof repo.release === "function") {
      await repo.release(ctx.tenantId ?? "", ctx.uid, dedupeKey(name, idk)).catch(() => undefined);
    }
  },
};
