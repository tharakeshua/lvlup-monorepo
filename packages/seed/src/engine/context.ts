/**
 * SeedContext — the engine handle threaded through the whole pipeline.
 *
 * Owns: the Admin app (emulator-detected), the injected (fixed) clock for determinism, the
 * logger, the dry-run flag, a shared BatchWriter, and the idempotent write primitives
 * (`ensureDoc` / `ensureCollection`) plus `ensureAuthUser`.
 *
 * Idempotency is structural: every write is a deterministic-id upsert (set+merge), so a re-run
 * reconciles instead of duplicating. `ensureDoc`/`ensureCollection` always stamp/refresh audit
 * fields via the injected clock.
 */

import {
  initAdmin,
  type AdminHandles,
  type DocumentReference,
  type InitAdminOptions,
} from "./admin.js";
import { BatchWriter, type BatchWriterOptions } from "./batch-writer.js";
import { createFixedClock, createSystemClock, type Clock } from "./clock.js";
import { createLogger, type Logger, type LogLevel } from "./logger.js";
import {
  ensureAuthUser,
  type EnsureAuthUserInput,
  type EnsureAuthUserResult,
} from "./ensure-auth-user.js";
import { SeedManifest } from "./manifest.js";

export interface SeedContextOptions extends InitAdminOptions {
  /** No writes are committed when true — ops are counted and logged only. */
  dryRun?: boolean;
  logLevel?: LogLevel;
  /** Inject a clock; default is a FIXED clock (deterministic). Pass createSystemClock() for prod. */
  clock?: Clock;
  /** Fixed-clock anchor epoch (ms) when no clock is provided. */
  clockEpochMs?: number;
  batch?: BatchWriterOptions;
}

export class SeedContext {
  readonly admin: AdminHandles;
  readonly clock: Clock;
  readonly logger: Logger;
  readonly dryRun: boolean;
  readonly batch: BatchWriter;
  /** Deterministic document plan, emitted for dry runs and reused by exact verify. */
  readonly manifest = new SeedManifest();

  /** Running tally of docs ensured per logical kind — surfaced by verify(). */
  readonly counts: Record<string, number> = {};

  constructor(opts: SeedContextOptions) {
    this.admin = initAdmin(opts);
    this.dryRun = opts.dryRun ?? false;
    this.logger = createLogger(opts.logLevel ?? "info", "[seed]");
    this.clock = opts.clock ?? createFixedClock(opts.clockEpochMs);
    this.batch = new BatchWriter(this.admin.db, {
      ...opts.batch,
      dryRun: this.dryRun,
      logger: this.logger.child("batch"),
    });

    const { emulator } = this.admin;
    this.logger.info(
      `context ready — project=${opts.projectId} ` +
        `firestore=${emulator.firestore ? `emulator(${emulator.firestoreHost})` : "REAL"} ` +
        `auth=${emulator.auth ? `emulator(${emulator.authHost})` : "REAL"} ` +
        `dryRun=${this.dryRun}`
    );
    if (!emulator.firestore && !this.dryRun) {
      this.logger.warn("writing to a REAL Firestore project — not the emulator");
    }
  }

  /** Resolve a `DocumentReference` from a slash path (the only path-resolution site). */
  ref(path: string): DocumentReference {
    return this.admin.db.doc(path);
  }

  private bump(kind: string): void {
    this.counts[kind] = (this.counts[kind] ?? 0) + 1;
  }

  /**
   * Idempotent document upsert. Deterministic id is encoded in `path`. Stamps audit fields
   * from the injected clock unless the data already carries them. `merge:true` by default so
   * a re-run reconciles fields without clobbering server-owned ones.
   */
  async ensureDoc(
    kind: string,
    path: string,
    data: Record<string, unknown>,
    options: {
      merge?: boolean;
      stampAudit?: boolean;
      logicalKey?: string;
      verifyAs?: readonly string[];
    } = {}
  ): Promise<void> {
    const stamp = options.stampAudit ?? true;
    const now = this.clock.now();
    const payload: Record<string, unknown> = { ...data };
    if (stamp) {
      // Only fill audit fields that the caller didn't explicitly set.
      if (payload.createdAt === undefined) payload.createdAt = now;
      payload.updatedAt = payload.updatedAt ?? now;
    }
    this.manifest.record({
      kind,
      path,
      data: payload,
      logicalKey: options.logicalKey,
      verifyAs: options.verifyAs,
    });
    await this.batch.set(this.ref(path), payload, { merge: options.merge ?? true });
    this.bump(kind);
  }

  /**
   * Idempotent bulk upsert. Each entry yields `{ path, data }` from its deterministic id.
   * Returns the number of docs ensured.
   */
  async ensureCollection<T>(
    kind: string,
    items: readonly T[],
    toDoc: (
      item: T,
      index: number
    ) => {
      path: string;
      data: Record<string, unknown>;
      logicalKey?: string;
      verifyAs?: readonly string[];
    },
    options: {
      merge?: boolean;
      stampAudit?: boolean;
      logicalKey?: string;
      verifyAs?: readonly string[];
    } = {}
  ): Promise<number> {
    let n = 0;
    for (let i = 0; i < items.length; i++) {
      const item = items[i] as T;
      const { path, data, logicalKey, verifyAs } = toDoc(item, i);
      await this.ensureDoc(kind, path, data, {
        ...options,
        logicalKey: logicalKey ?? options.logicalKey,
        verifyAs: verifyAs ?? options.verifyAs,
      });
      n++;
    }
    return n;
  }

  /** Idempotent Auth user create-or-update + claims (delegates to engine `ensureAuthUser`). */
  async ensureAuthUser(input: EnsureAuthUserInput): Promise<EnsureAuthUserResult> {
    const res = await ensureAuthUser(input, {
      auth: this.admin.auth,
      dryRun: this.dryRun,
      logger: this.logger,
    });
    this.bump("authUser");
    return res;
  }

  /**
   * Set ONLY custom claims on an existing Auth user (does NOT touch password/profile).
   * Used by the membership writer to mint claims through the shared builder without
   * re-reconciling the account. Idempotent (same claim shape => no observable change).
   */
  async setClaims(uid: string, claims: Record<string, unknown>): Promise<void> {
    if (this.dryRun) {
      this.logger.debug(`[dry-run] setClaims ${uid}`);
      return;
    }
    await this.admin.auth.setCustomUserClaims(uid, claims);
    this.bump("claims");
  }

  /** Flush any buffered writes. Call between dependency phases and at the end. */
  async flush(): Promise<void> {
    await this.batch.flush();
  }

  /** Read a single doc back (used by verify()). Returns null if missing or in dry-run. */
  async read(path: string): Promise<Record<string, unknown> | null> {
    if (this.dryRun) return null;
    const snap = await this.ref(path).get();
    return snap.exists ? (snap.data() as Record<string, unknown>) : null;
  }

  /** Count documents in a collection path (used by verify()). 0 in dry-run. */
  async countCollection(collectionPath: string): Promise<number> {
    if (this.dryRun) return 0;
    const agg = await this.admin.db.collection(collectionPath).count().get();
    return agg.data().count;
  }
}

export { createFixedClock, createSystemClock };
