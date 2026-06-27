/**
 * Outbox event builders (server-shared.md §3.1 `shared/side-effects.ts`). A
 * service writes its state change and an outbox record INSIDE one transaction
 * (atomic); a drain trigger/scheduler delivers the side effect reliably (no
 * fire-and-forget `.catch(log)`). These builders standardize the record shape.
 */
import type { TxHandle } from "../repo-admin/types.js";

export type OutboxEventType =
  | "space.published"
  | "exam.published"
  | "exam.results.released"
  | "submission.finalized"
  | "announcement.published"
  | "notification.emit"
  | "progress.milestone"
  | "ai.budget.alert";

export interface OutboxEventInput {
  type: OutboxEventType;
  tenantId: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

/** Build the canonical outbox record body. */
export function buildOutboxRecord(input: OutboxEventInput): Record<string, unknown> {
  return {
    type: input.type,
    tenantId: input.tenantId,
    payload: input.payload,
    createdAt: input.createdAt,
    status: "pending",
    attempts: 0,
  };
}

/** Stage an outbox event inside an open transaction (commits atomically with state). */
export function enqueueOutboxEvent(tx: TxHandle, input: OutboxEventInput): void {
  tx.enqueueOutbox(input.tenantId, buildOutboxRecord(input));
}
