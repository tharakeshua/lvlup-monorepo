/**
 * Transactional outbox for MUST-DELIVER side effects (server-shared.md §2.8).
 * Replaces fire-and-forget `.catch(log)`: the outbox row is written INSIDE the
 * same transaction as the state change → atomic. A drain trigger/scheduler
 * delivers reliably (notifications, content versions, store-listing mirror).
 */
import type { TenantId, Timestamp } from "@levelup/domain";
import type { JsonValue } from "@levelup/api-contract";
import type { TxHandle, Repos, OutboxRecord } from "../context/ports.js";

/** The closed set of reliable side-effect event types. */
export type OutboxEventType =
  | "notification.send"
  | "content.version.created"
  | "store.listing.mirror"
  | "space.published"
  | "space.archived"
  | "exam.published"
  | "exam.results.released"
  | "submission.graded"
  | "membership.changed";

export interface EnqueueOutboxInput {
  type: OutboxEventType;
  tenantId: TenantId | string;
  payload: JsonValue;
  createdAt?: Timestamp;
}

/**
 * Stage an outbox record INSIDE a transaction. Call from within `ctx.repos.tx(...)`
 * so the side-effect record is atomic with the state write (test §14: a throw
 * after the state write leaves NO outbox row via rollback).
 */
export function enqueueOutbox(repos: Repos, tx: TxHandle, rec: EnqueueOutboxInput): void {
  repos.outbox.enqueue(tx, {
    type: rec.type,
    tenantId: rec.tenantId,
    payload: rec.payload,
    createdAt: rec.createdAt,
  });
}

/**
 * Drain a batch of pending outbox records (consumed by the outbox-drain
 * trigger/scheduler shell). `deliver` performs the real side effect; on success
 * the record is marked delivered, on failure marked failed for retry.
 */
export async function drainOutbox(
  repos: Repos,
  deliver: (rec: OutboxRecord) => Promise<void>,
  limit = 50
): Promise<{ delivered: number; failed: number }> {
  const pending = await repos.outbox.claimPending(limit);
  let delivered = 0;
  let failed = 0;
  for (const rec of pending) {
    try {
      await deliver(rec);
      await repos.outbox.markDelivered(rec.id);
      delivered += 1;
    } catch (e) {
      await repos.outbox.markFailed(rec.id, e instanceof Error ? e.message : String(e));
      failed += 1;
    }
  }
  return { delivered, failed };
}
