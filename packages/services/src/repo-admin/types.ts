/**
 * The `Repos` handle contract (server-shared.md §5.2) — injected as `ctx.repos`.
 *
 * THIS IS THE ONLY SHAPE `@levelup/services` SEES. The concrete implementation in
 * this folder is the single direct-Firestore site (Admin SDK); an in-memory twin
 * (`./testing`) implements the *same* surface for service-unit tests. Both are
 * driven by the T6 conformance suite (tests/sdk/integration/repos-conformance).
 *
 * The interface intentionally mirrors `tests/sdk/fakes/in-memory-repos.ts`
 * (`InMemoryRepos`) — minus the `_*` test-introspection escape hatches, which the
 * testing twin re-adds. Documents move across this boundary as plain
 * `Record<string, unknown>` JSON: the converters (firestore.ts) do the
 * Timestamp↔ISO (D4) + brand strip/restore (D8) work, so services receive
 * already-normalized data and never see a Firestore snapshot or a raw brand.
 */

/** A page of documents + an opaque base64 cursor (null when exhausted). */
export interface RepoPage {
  items: Record<string, unknown>[];
  nextCursor: string | null;
}

export interface ListOptions {
  cursor?: string;
  limit?: number;
  /** Server-side predicate; applied as a Firestore query where possible, else in-memory. */
  filter?: (d: Record<string, unknown>) => boolean;
  /** Equality `where` clauses applied at the query level (field → value). */
  where?: Record<string, unknown>;
  /** Ordering field (default `id`). */
  orderBy?: string;
}

/** A single tenant-scoped entity collection accessor. */
export interface EntityRepo {
  get(tenantId: string, id: string): Promise<Record<string, unknown> | null>;
  /** Server-side N+1 collapse: chunk-of-10 `in` reads + Promise.all (DX-14). */
  getMany(tenantId: string, ids: string[]): Promise<Record<string, unknown>[]>;
  upsert(
    tenantId: string,
    data: Record<string, unknown>,
    now?: string
  ): Promise<{ id: string; created: boolean }>;
  list(tenantId: string, opts?: ListOptions): Promise<RepoPage>;
  delete(tenantId: string, id: string): Promise<void>;
}

/** Authority repo: custom claims mint + token revocation (⚷ REVIEW §6.2). */
export interface ClaimsRepo {
  set(uid: string, claims: Record<string, unknown>): Promise<void>;
  get(uid: string): Promise<Record<string, unknown> | null>;
  revokeRefreshTokens(uid: string): Promise<void>;
}

/** Server-only answer-key subcollection (⚷ REVIEW §6.4, rules deny-all). */
export interface AnswerKeyRepo {
  put(tenantId: string, itemId: string, key: Record<string, unknown>): Promise<void>;
  get(tenantId: string, itemId: string): Promise<Record<string, unknown> | null>;
}

export interface IdempotencyBeginResult {
  status: "new" | "committed";
  result?: unknown;
}

/** Atomic idempotency dedupe (MERGE-IDEMPOTENCY, §5.5). */
export interface IdempotencyRepo {
  /**
   * Transactionally create `tenants/{t}/idempotency/{uid}_{key}` with
   * `status:'in_flight'` + lease. Returns the committed result if present;
   * throws `IDEMPOTENCY_CONFLICT` on an unexpired in-flight lease; reclaims a
   * stale (expired-lease) record.
   */
  begin(tenantId: string, uid: string, key: string): Promise<IdempotencyBeginResult>;
  /** Flip `in_flight → committed` storing the result, in the SAME doc. */
  commit(tenantId: string, uid: string, key: string, result: unknown): Promise<void>;
  /** Free a still-`in_flight` lease (the body threw) so an immediate retry can run. */
  release(tenantId: string, uid: string, key: string): Promise<void>;
}

/** Transactional-outbox repo for must-deliver side effects (§5.3). */
export interface OutboxRepo {
  enqueue(tenantId: string, entry: Record<string, unknown>): Promise<void>;
  /**
   * Non-destructive read (SVC-4). Never mutates delivery status — use for
   * DLQ list/resolve and any other outbox introspection. Optional `kind`
   * filters on `_kind` (e.g. `'gradingDeadLetter'`).
   */
  list(tenantId: string, opts?: { kind?: string }): Promise<Record<string, unknown>[]>;
  /**
   * Patch a single outbox row by logical `id` (or Firestore doc id). Used by
   * `resolveDeadLetter` so sibling pending rows are never drained.
   */
  update(tenantId: string, id: string, patch: Record<string, unknown>): Promise<void>;
  /** Read + clear pending rows (drain worker ONLY). */
  drain(tenantId: string): Promise<Record<string, unknown>[]>;
}

export interface AuditRepo {
  write(tenantId: string, entry: Record<string, unknown>): Promise<void>;
}

/** Rate-limit counter store (server-shared §2.6). Atomically increment+read. */
export interface RateLimitRepo {
  /** Increment the `(subject,tier,window)` counter and return the NEW count. */
  hit(subject: string, tier: string, windowKey: string): Promise<number>;
}

/** Atomic-handle passed to `tx()` — staged outbox commits only on success. */
export interface TxHandle {
  get(
    coll: EntityCollectionName,
    tenantId: string,
    id: string
  ): Promise<Record<string, unknown> | null>;
  upsert(
    coll: EntityCollectionName,
    tenantId: string,
    data: Record<string, unknown>
  ): { id: string };
  enqueueOutbox(tenantId: string, entry: Record<string, unknown>): void;
}

/** The names of the tenant-scoped entity collections exposed on `Repos`. */
export type EntityCollectionName =
  | "spaces"
  | "storyPoints"
  | "items"
  | "tenants"
  | "students"
  | "teachers"
  | "classes"
  | "exams"
  | "submissions"
  | "testSessions"
  | "progressDocs"
  | "notifications"
  | "announcements";

/**
 * The injected admin-repo handle. Services touch Firestore ONLY through this.
 * Both the real Admin-SDK adapter and the in-memory testing twin satisfy it.
 */
export interface Repos {
  // entity repos
  spaces: EntityRepo;
  storyPoints: EntityRepo;
  items: EntityRepo;
  tenants: EntityRepo;
  students: EntityRepo;
  teachers: EntityRepo;
  classes: EntityRepo;
  exams: EntityRepo;
  submissions: EntityRepo;
  testSessions: EntityRepo;
  progressDocs: EntityRepo;
  notifications: EntityRepo;
  announcements: EntityRepo;

  // authority repos
  claims: ClaimsRepo;
  answerKeys: AnswerKeyRepo;
  idempotency: IdempotencyRepo;
  outbox: OutboxRepo;
  audit: AuditRepo;
  /** Per-(subject,tier,window) atomic rate-limit counter (server-shared §2.6). */
  rateLimits: RateLimitRepo;

  /** Single-writer transactional progress aggregator (testsession-progress §progressUpdater). */
  progress: ProgressRepo;

  /** Run a body atomically. On throw, all writes since begin roll back. */
  tx<T>(body: (tx: TxHandle) => Promise<T>): Promise<T>;

  // cursor helpers (base64; must match the testing twin)
  encodeCursor(value: unknown): string;
  decodeCursor(cursor: string): unknown;
}

/** A single per-item progress contribution handed to the progress writer. */
export interface ProgressItemUpdate {
  storyPointId: string;
  itemId: string;
  score: number;
  maxScore: number;
  correct: boolean;
  timeSpentMs?: number;
  /** Cost/answer-stripped client-readable evaluation projection (StoredEvaluation). */
  evaluation?: Record<string, unknown>;
}

export interface ProgressUpdateInput {
  userId: string;
  spaceId: string;
  items: ProgressItemUpdate[];
  /** Total story points in the space, for completion detection. */
  totalStoryPoints?: number;
}

/** Per-story-point rollup slice returned by the progress writer (bounded numerics). */
export interface ProgressStoryPointRollup {
  storyPointId: string;
  pointsEarned: number;
  totalPoints: number;
  completed: boolean;
}

export interface ProgressUpdateResult {
  spaceProgressId: string;
  completed: boolean;
  pointsEarned: number;
  totalPoints: number;
  /**
   * The transaction's per-story-point rollup — feeds the `spaceProgressLive`
   * RTDB projection (AD-12) without a post-tx re-read. Bounded numerics only.
   */
  storyPoints: Record<string, ProgressStoryPointRollup>;
}

/**
 * Single transactional progress writer (the BRAIN of testsession-progress).
 * Read-modify-write on the aggregate doc inside one Firestore tx so N concurrent
 * AI-item completions serialize (Firestore aborts+retries on contention).
 */
export interface ProgressRepo {
  update(tenantId: string, input: ProgressUpdateInput, now?: string): Promise<ProgressUpdateResult>;
  get(tenantId: string, userId: string, spaceId: string): Promise<Record<string, unknown> | null>;
}

/** Options accepted by `createRepos()` / the testing twin. */
export interface CreateReposOptions {
  /** Injected clock (ISO-8601). Defaults to `new Date().toISOString()`. */
  now?: () => string;
  /** Idempotency lease TTL in ms (default 5 min). */
  idempotencyLeaseMs?: number;
}
