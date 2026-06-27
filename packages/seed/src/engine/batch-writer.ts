/**
 * BatchWriter — chunked Firestore writes with auto-flush, retry, and dry-run support.
 *
 * Firestore limits a WriteBatch to 500 operations. This writer accumulates set/update/delete
 * operations and auto-flushes at a safe threshold (default 450 to leave headroom), commits with
 * exponential-backoff retry on transient errors, and reports running counts.
 *
 * Idempotency note: every write here is a `set` (with optional merge) keyed by a deterministic
 * document id from `seedId()`. Re-running the seed re-sets the same docs — no duplicates.
 */

import type { DocumentReference, Firestore, WriteBatch } from "./admin.js";
import type { Logger } from "./logger.js";

export interface BatchWriterOptions {
  /** Auto-flush when pending ops reach this count (Firestore hard cap is 500). */
  maxOpsPerBatch?: number;
  /** Max commit retries on transient failure. */
  maxRetries?: number;
  /** Base backoff in ms (doubled each retry). */
  backoffBaseMs?: number;
  /** When true, no commit is issued — ops are counted and logged only. */
  dryRun?: boolean;
  logger?: Logger;
}

export interface BatchStats {
  /** Total ops enqueued (set + update + delete). */
  totalOps: number;
  /** Total set ops. */
  sets: number;
  updates: number;
  deletes: number;
  /** Number of committed batches. */
  commits: number;
}

const TRANSIENT_CODES = new Set([
  "aborted",
  "unavailable",
  "deadline-exceeded",
  "internal",
  "resource-exhausted",
  4, // DEADLINE_EXCEEDED (numeric grpc)
  8, // RESOURCE_EXHAUSTED
  10, // ABORTED
  13, // INTERNAL
  14, // UNAVAILABLE
]);

function isTransient(err: unknown): boolean {
  const code = (err as { code?: unknown })?.code;
  return code !== undefined && TRANSIENT_CODES.has(code as never);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class BatchWriter {
  private batch: WriteBatch | null = null;
  private pending = 0;
  private readonly max: number;
  private readonly maxRetries: number;
  private readonly backoffBaseMs: number;
  private readonly dryRun: boolean;
  private readonly log?: Logger;

  readonly stats: BatchStats = {
    totalOps: 0,
    sets: 0,
    updates: 0,
    deletes: 0,
    commits: 0,
  };

  constructor(
    private readonly db: Firestore,
    opts: BatchWriterOptions = {}
  ) {
    this.max = Math.min(opts.maxOpsPerBatch ?? 450, 500);
    this.maxRetries = opts.maxRetries ?? 5;
    this.backoffBaseMs = opts.backoffBaseMs ?? 200;
    this.dryRun = opts.dryRun ?? false;
    this.log = opts.logger;
  }

  private ensureBatch(): WriteBatch {
    if (!this.batch) this.batch = this.db.batch();
    return this.batch;
  }

  /** Upsert a document. Defaults to merge:true so re-runs idempotently reconcile fields. */
  async set(
    ref: DocumentReference,
    data: Record<string, unknown>,
    options: { merge?: boolean } = { merge: true }
  ): Promise<void> {
    this.stats.sets++;
    this.stats.totalOps++;
    if (this.dryRun) {
      this.log?.debug(`[dry-run] set ${ref.path}`);
      return;
    }
    this.ensureBatch().set(ref, data, { merge: options.merge ?? true });
    await this.afterEnqueue();
  }

  async update(ref: DocumentReference, data: Record<string, unknown>): Promise<void> {
    this.stats.updates++;
    this.stats.totalOps++;
    if (this.dryRun) {
      this.log?.debug(`[dry-run] update ${ref.path}`);
      return;
    }
    this.ensureBatch().update(ref, data);
    await this.afterEnqueue();
  }

  async delete(ref: DocumentReference): Promise<void> {
    this.stats.deletes++;
    this.stats.totalOps++;
    if (this.dryRun) {
      this.log?.debug(`[dry-run] delete ${ref.path}`);
      return;
    }
    this.ensureBatch().delete(ref);
    await this.afterEnqueue();
  }

  private async afterEnqueue(): Promise<void> {
    this.pending++;
    if (this.pending >= this.max) await this.flush();
  }

  /** Commit the current batch (with retry) and reset. No-op when empty or dry-run. */
  async flush(): Promise<void> {
    if (this.dryRun || !this.batch || this.pending === 0) {
      this.batch = null;
      this.pending = 0;
      return;
    }
    const batch = this.batch;
    const count = this.pending;
    this.batch = null;
    this.pending = 0;

    let attempt = 0;
    for (;;) {
      try {
        await batch.commit();
        this.stats.commits++;
        this.log?.debug(`batch committed (${count} ops, total ${this.stats.totalOps})`);
        return;
      } catch (err) {
        attempt++;
        if (attempt > this.maxRetries || !isTransient(err)) {
          this.log?.error(`batch commit failed after ${attempt} attempt(s)`, err);
          throw err;
        }
        const delay = this.backoffBaseMs * 2 ** (attempt - 1);
        this.log?.warn(`transient commit error, retry ${attempt}/${this.maxRetries} in ${delay}ms`);
        await sleep(delay);
      }
    }
  }
}
