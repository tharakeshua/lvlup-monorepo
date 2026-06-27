/**
 * BatchWriter — auto-flushing Firestore Admin batched writer (server-shared.md
 * §5.1 `tx.ts` "batched writer"). Firestore caps a `WriteBatch` at 500 ops; this
 * accumulates writes and flushes at the cap, then commits the remainder on
 * `flush()`. Used by bulk paths (rolloverSession, bulkImport chunks, cascade
 * deletes) where a single transaction would exceed limits.
 *
 * For atomic state+outbox writes use `tx()` (a real Firestore transaction)
 * instead — a batch is NOT a transaction (no reads, no contention retries).
 */
import type { Firestore, WriteBatch, DocumentReference } from "firebase-admin/firestore";
import { toFirestore } from "./firestore.js";

const MAX_BATCH_OPS = 500;

export class BatchWriter {
  private batch: WriteBatch;
  private ops = 0;
  private readonly committed: Promise<unknown>[] = [];

  constructor(private readonly firestore: Firestore) {
    this.batch = firestore.batch();
  }

  set(ref: DocumentReference, data: Record<string, unknown>, merge = false): this {
    this.batch.set(ref, toFirestore(data), { merge });
    this.bump();
    return this;
  }

  update(ref: DocumentReference, data: Record<string, unknown>): this {
    this.batch.update(ref, toFirestore(data));
    this.bump();
    return this;
  }

  delete(ref: DocumentReference): this {
    this.batch.delete(ref);
    this.bump();
    return this;
  }

  private bump(): void {
    this.ops += 1;
    if (this.ops >= MAX_BATCH_OPS) {
      this.committed.push(this.batch.commit());
      this.batch = this.firestore.batch();
      this.ops = 0;
    }
  }

  /** Commit the trailing batch + await all auto-flushed commits. */
  async flush(): Promise<void> {
    if (this.ops > 0) {
      this.committed.push(this.batch.commit());
      this.batch = this.firestore.batch();
      this.ops = 0;
    }
    await Promise.all(this.committed);
  }

  get pendingOps(): number {
    return this.ops;
  }
}

/** Firestore `in` filter cap (chunk-of-10 for `getMany` N+1 collapse, DX-14). */
export const IN_CHUNK_SIZE = 10;

/** Split ids into chunks of 10 for `documentId() in [...]` reads. */
export function chunk<T>(arr: T[], size = IN_CHUNK_SIZE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}
