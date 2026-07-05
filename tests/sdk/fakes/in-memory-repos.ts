/**
 * In-memory `Repos` fake (testability.md T6) — the sanctioned service-unit-test
 * substrate so `@levelup/services` (`fn(input, ctx)`) can be tested with
 * `ctx.repos` set, WITHOUT the emulator and WITHOUT the 30+ hand-rolled
 * `firebase-admin` mocks platform-infra.md §9.1 is killing.
 *
 * It mirrors the `Repos` surface injected as `ctx.repos` (server-shared.md §5):
 * per-entity collections accessed by `(tenantId, id)`, a `tx()` that runs a body
 * atomically (commit-or-rollback — naive but faithful enough for unit tests),
 * authority repos (`claims.set`/`revokeRefreshTokens`, `answerKeys`, `progress`,
 * `idempotency`, `outbox`, `audit`), and an opaque base64 cursor encode/decode.
 *
 * T6 REQUIRES a conformance suite that runs the SAME test file against both this
 * fake and the emulator-backed real `@levelup/repository-admin`, so the fake can
 * never silently diverge on `tx()` atomicity / cursor semantics / brand-strip.
 * The driver for that lives at tests/sdk/fakes/repos-driver.ts; this file is the
 * in-memory driver. The real `createInMemoryRepos()` is expected to ship from
 * `@levelup/repository-admin/testing`; this is the harness-local stand-in until
 * that lands (and the conformance suite will be pointed at the real one).
 */

export interface InMemoryReposOptions {
  now?: () => string;
}

interface DocStore {
  [tenantId: string]: { [id: string]: Record<string, unknown> };
}

/** A single entity collection accessor. */
export interface EntityRepo {
  get(tenantId: string, id: string): Promise<Record<string, unknown> | null>;
  getMany(tenantId: string, ids: string[]): Promise<Record<string, unknown>[]>;
  upsert(
    tenantId: string,
    data: Record<string, unknown>,
    now?: string
  ): Promise<{ id: string; created: boolean }>;
  list(
    tenantId: string,
    opts?: { cursor?: string; limit?: number; filter?: (d: Record<string, unknown>) => boolean }
  ): Promise<{ items: Record<string, unknown>[]; nextCursor: string | null }>;
  delete(tenantId: string, id: string): Promise<void>;
  /** test introspection */
  _all(tenantId: string): Record<string, unknown>[];
}

export interface InMemoryRepos {
  // entity repos (extend as services need them)
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
  claims: {
    set(uid: string, claims: Record<string, unknown>): Promise<void>;
    get(uid: string): Promise<Record<string, unknown> | null>;
    revokeRefreshTokens(uid: string): Promise<void>;
    _revoked(uid: string): boolean;
  };
  answerKeys: {
    put(tenantId: string, itemId: string, key: Record<string, unknown>): Promise<void>;
    get(tenantId: string, itemId: string): Promise<Record<string, unknown> | null>;
  };
  idempotency: {
    /** Returns committed result if present, else 'in_flight' lease, else throws on conflict. */
    begin(
      tenantId: string,
      uid: string,
      key: string
    ): Promise<{ status: "new" | "committed"; result?: unknown }>;
    commit(tenantId: string, uid: string, key: string, result: unknown): Promise<void>;
  };
  outbox: {
    enqueue(tenantId: string, entry: Record<string, unknown>): Promise<void>;
    drain(tenantId: string): Promise<Record<string, unknown>[]>;
  };
  audit: {
    write(tenantId: string, entry: Record<string, unknown>): Promise<void>;
    _all(tenantId: string): Record<string, unknown>[];
  };

  /**
   * Single-writer transactional progress aggregator (mirror of
   * `repo-admin/types.ts` `ProgressRepo`). Read-modify-write on the per-`(uid,space)`
   * aggregate doc with best-score retention, so N item completions serialize.
   */
  progress: {
    update(
      tenantId: string,
      input: {
        userId: string;
        spaceId: string;
        items: Array<{
          storyPointId: string;
          itemId: string;
          score: number;
          maxScore: number;
          correct: boolean;
          timeSpentMs?: number;
          evaluation?: Record<string, unknown>;
        }>;
        totalStoryPoints?: number;
      },
      now?: string
    ): Promise<{
      spaceProgressId: string;
      completed: boolean;
      pointsEarned: number;
      totalPoints: number;
      storyPoints: Record<
        string,
        { storyPointId: string; pointsEarned: number; totalPoints: number; completed: boolean }
      >;
    }>;
    get(tenantId: string, userId: string, spaceId: string): Promise<Record<string, unknown> | null>;
  };

  /** Per-session item submissions (extended surface; reached via `xrepos`). */
  testSubmissions: {
    list(tenantId: string, sessionId: string): Promise<Record<string, unknown>[]>;
    put(
      tx: TxHandle,
      tenantId: string,
      sessionId: string,
      submission: Record<string, unknown>
    ): void;
    get(
      tenantId: string,
      sessionId: string,
      itemId: string
    ): Promise<Record<string, unknown> | null>;
  };

  /** Per-storyPoint progress read (extended surface; reached via `xrepos`). */
  storyPointProgress: {
    get(
      tenantId: string,
      userId: string,
      spaceId: string,
      storyPointId: string
    ): Promise<Record<string, unknown> | null>;
  };

  /** Run a body atomically. On throw, all writes since begin are rolled back. */
  tx<T>(body: (tx: TxHandle) => Promise<T>): Promise<T>;

  // cursor helpers (must match repository-admin base64 encode/decode)
  encodeCursor(value: unknown): string;
  decodeCursor(cursor: string): unknown;

  /** Reset all stores (between-test isolation). */
  _reset(): void;
}

export interface TxHandle {
  get(
    coll: keyof InMemoryRepos,
    tenantId: string,
    id: string
  ): Promise<Record<string, unknown> | null>;
  upsert(
    coll: keyof InMemoryRepos,
    tenantId: string,
    data: Record<string, unknown>
  ): { id: string };
  enqueueOutbox(tenantId: string, entry: Record<string, unknown>): void;
}

let idSeq = 0;
const nextId = (): string => `mem_${(idSeq++).toString(36).padStart(8, "0")}`;

export function createInMemoryRepos(options: InMemoryReposOptions = {}): InMemoryRepos {
  const now = options.now ?? (() => new Date().toISOString());
  const stores = new Map<string, DocStore>();
  const claimsStore = new Map<string, Record<string, unknown>>();
  const revoked = new Set<string>();
  const answerKeyStore = new Map<string, Record<string, unknown>>();
  const idemStore = new Map<string, { status: "in_flight" | "committed"; result?: unknown }>();
  const outboxStore = new Map<string, Record<string, unknown>[]>();
  const auditStore = new Map<string, Record<string, unknown>[]>();
  // Aggregate space-progress docs keyed by `${tenantId}/${userId}/${spaceId}`.
  const progressStore = new Map<string, Record<string, unknown>>();

  function coll(name: string): DocStore {
    let s = stores.get(name);
    if (!s) {
      s = {};
      stores.set(name, s);
    }
    return s;
  }

  function outboxFor(tenantId: string): Record<string, unknown>[] {
    let rows = outboxStore.get(tenantId);
    if (!rows) {
      rows = [];
      outboxStore.set(tenantId, rows);
    }
    return rows;
  }

  function auditFor(tenantId: string): Record<string, unknown>[] {
    let rows = auditStore.get(tenantId);
    if (!rows) {
      rows = [];
      auditStore.set(tenantId, rows);
    }
    return rows;
  }

  function makeRepo(name: string): EntityRepo {
    return {
      async get(tenantId, id) {
        return coll(name)[tenantId]?.[id] ?? null;
      },
      async getMany(tenantId, ids) {
        const t = coll(name)[tenantId] ?? {};
        return ids.map((id) => t[id]).filter((d): d is Record<string, unknown> => Boolean(d));
      },
      async upsert(tenantId, data, ts = now()) {
        const t = (coll(name)[tenantId] ??= {});
        const id = (data["id"] as string | undefined) ?? nextId();
        const created = !t[id];
        t[id] = {
          ...t[id],
          ...data,
          id,
          tenantId,
          updatedAt: ts,
          ...(created ? { createdAt: ts } : {}),
        };
        return { id, created };
      },
      async list(tenantId, opts = {}) {
        const t = coll(name)[tenantId] ?? {};
        let items = Object.values(t);
        if (opts.filter) items = items.filter(opts.filter);
        items.sort((a, b) => String(a["id"]).localeCompare(String(b["id"])));
        const start = opts.cursor ? Number(Buffer.from(opts.cursor, "base64").toString("utf8")) : 0;
        const limit = opts.limit ?? 20;
        const page = items.slice(start, start + limit);
        const end = start + limit;
        const nextCursor = end < items.length ? Buffer.from(String(end)).toString("base64") : null;
        return { items: page, nextCursor };
      },
      async delete(tenantId, id) {
        delete coll(name)[tenantId]?.[id];
      },
      _all(tenantId) {
        return Object.values(coll(name)[tenantId] ?? {});
      },
    };
  }

  const repos: InMemoryRepos = {
    spaces: makeRepo("spaces"),
    storyPoints: makeRepo("storyPoints"),
    items: makeRepo("items"),
    tenants: makeRepo("tenants"),
    students: makeRepo("students"),
    teachers: makeRepo("teachers"),
    classes: makeRepo("classes"),
    exams: makeRepo("exams"),
    submissions: makeRepo("submissions"),
    testSessions: makeRepo("testSessions"),
    progressDocs: makeRepo("progressDocs"),
    notifications: makeRepo("notifications"),
    announcements: makeRepo("announcements"),

    claims: {
      async set(uid, claims) {
        claimsStore.set(uid, claims);
      },
      async get(uid) {
        return claimsStore.get(uid) ?? null;
      },
      async revokeRefreshTokens(uid) {
        revoked.add(uid);
      },
      _revoked(uid) {
        return revoked.has(uid);
      },
    },

    answerKeys: {
      async put(tenantId, itemId, key) {
        answerKeyStore.set(`${tenantId}/${itemId}`, key);
      },
      async get(tenantId, itemId) {
        return answerKeyStore.get(`${tenantId}/${itemId}`) ?? null;
      },
    },

    idempotency: {
      async begin(tenantId, uid, key) {
        const k = `${tenantId}/${uid}/${key}`;
        const existing = idemStore.get(k);
        if (existing?.status === "committed")
          return { status: "committed", result: existing.result };
        if (existing?.status === "in_flight") {
          const err = new Error("IDEMPOTENCY_CONFLICT");
          (err as { code?: string }).code = "IDEMPOTENCY_CONFLICT";
          throw err;
        }
        idemStore.set(k, { status: "in_flight" });
        return { status: "new" };
      },
      async commit(tenantId, uid, key, result) {
        idemStore.set(`${tenantId}/${uid}/${key}`, { status: "committed", result });
      },
    },

    outbox: {
      async enqueue(tenantId, entry) {
        outboxFor(tenantId).push({ ...entry, enqueuedAt: now() });
      },
      async drain(tenantId) {
        const rows = outboxStore.get(tenantId) ?? [];
        outboxStore.set(tenantId, []);
        return rows;
      },
    },

    audit: {
      async write(tenantId, entry) {
        auditFor(tenantId).push({ ...entry, at: now() });
      },
      _all(tenantId) {
        return auditStore.get(tenantId) ?? [];
      },
    },

    progress: {
      async update(tenantId, input, ts = now()) {
        const key = `${tenantId}/${input.userId}/${input.spaceId}`;
        const spaceProgressId = `${input.userId}_${input.spaceId}`;
        const existing = (progressStore.get(key) ?? {
          id: spaceProgressId,
          tenantId,
          userId: input.userId,
          spaceId: input.spaceId,
          itemProgress: {} as Record<string, Record<string, unknown>>,
        }) as Record<string, unknown>;
        const itemProgress = {
          ...(existing["itemProgress"] as Record<string, Record<string, unknown>> | undefined),
        };

        for (const it of input.items) {
          const prior = itemProgress[it.itemId];
          const priorBest = (prior?.["bestScore"] as number | undefined) ?? -Infinity;
          // Best-score retention: keep the higher score across attempts.
          const bestScore = Math.max(priorBest, it.score);
          itemProgress[it.itemId] = {
            itemId: it.itemId,
            storyPointId: it.storyPointId,
            bestScore,
            maxScore: it.maxScore,
            correct: bestScore >= it.maxScore,
            lastEvaluation: it.evaluation ?? prior?.["lastEvaluation"] ?? null,
            attempts: ((prior?.["attempts"] as number | undefined) ?? 0) + 1,
            updatedAt: ts,
          };
        }

        const pointsEarned = Object.values(itemProgress).reduce(
          (sum, p) => sum + ((p["bestScore"] as number | undefined) ?? 0),
          0
        );
        const totalPoints = Object.values(itemProgress).reduce(
          (sum, p) => sum + ((p["maxScore"] as number | undefined) ?? 0),
          0
        );
        // "completed" when every recorded item is fully correct (best == max).
        const completed =
          Object.values(itemProgress).length > 0 &&
          Object.values(itemProgress).every((p) => (p["correct"] as boolean | undefined) === true);

        const doc: Record<string, unknown> = {
          ...existing,
          id: spaceProgressId,
          itemProgress,
          pointsEarned,
          totalPoints,
          completed,
          analyticsRecomputePending: true,
          updatedAt: ts,
        };
        progressStore.set(key, doc);
        // Per-story-point rollup (mirrors the admin repo) — feeds the
        // spaceProgressLive RTDB projection seam (AD-12).
        const storyPoints: Record<
          string,
          { storyPointId: string; pointsEarned: number; totalPoints: number; completed: boolean }
        > = {};
        for (const p of Object.values(itemProgress)) {
          const spId = p["storyPointId"] as string;
          const sp = storyPoints[spId] ?? {
            storyPointId: spId,
            pointsEarned: 0,
            totalPoints: 0,
            completed: false,
          };
          sp.pointsEarned += (p["bestScore"] as number | undefined) ?? 0;
          sp.totalPoints += (p["maxScore"] as number | undefined) ?? 0;
          storyPoints[spId] = sp;
        }
        for (const sp of Object.values(storyPoints)) {
          sp.completed = sp.totalPoints > 0 && sp.pointsEarned >= sp.totalPoints;
        }
        return { spaceProgressId, completed, pointsEarned, totalPoints, storyPoints };
      },
      async get(tenantId, userId, spaceId) {
        return progressStore.get(`${tenantId}/${userId}/${spaceId}`) ?? null;
      },
    },

    // Per-session item submissions (always-subcollection; D6) — extended surface
    // the levelup test-session services reach through `xrepos(ctx)`.
    testSubmissions: {
      async list(tenantId: string, sessionId: string) {
        const t = coll("testSubmissions")[tenantId] ?? {};
        return Object.values(t).filter((d) => d["sessionId"] === sessionId);
      },
      put(_tx: TxHandle, tenantId: string, sessionId: string, submission: Record<string, unknown>) {
        const t = (coll("testSubmissions")[tenantId] ??= {});
        const id =
          (submission["itemId"] as string | undefined) ??
          (submission["id"] as string | undefined) ??
          nextId();
        t[id] = { ...submission, id, sessionId, tenantId };
      },
      async get(tenantId: string, sessionId: string, itemId: string) {
        return coll("testSubmissions")[tenantId]?.[itemId] ?? null;
      },
    },

    // Per-storyPoint progress read (D6) — reached through `xrepos(ctx)`.
    storyPointProgress: {
      async get(tenantId: string, userId: string, spaceId: string, storyPointId: string) {
        const space = progressStore.get(`${tenantId}/${userId}/${spaceId}`);
        if (!space) return null;
        const itemProgress =
          (space["itemProgress"] as Record<string, Record<string, unknown>>) ?? {};
        const items = Object.values(itemProgress).filter((p) => p["storyPointId"] === storyPointId);
        return items.length > 0 ? { storyPointId, spaceId, userId, items } : null;
      },
    },

    async tx<T>(body: (tx: TxHandle) => Promise<T>): Promise<T> {
      // snapshot for rollback (deep enough for unit tests)
      const snapshot = JSON.stringify([...stores.entries()]);
      const outboxSnapshot = JSON.stringify([...outboxStore.entries()]);
      const stagedOutbox: Array<[string, Record<string, unknown>]> = [];
      const txHandle: TxHandle = {
        get: (collName, tenantId, id) => (repos[collName] as EntityRepo).get(tenantId, id),
        upsert: (collName, tenantId, data) => {
          const id = (data["id"] as string | undefined) ?? nextId();
          const t = (coll(collName as string)[tenantId] ??= {});
          t[id] = { ...t[id], ...data, id, tenantId, updatedAt: now() };
          return { id };
        },
        enqueueOutbox: (tenantId, entry) => {
          stagedOutbox.push([tenantId, entry]);
        },
      };
      try {
        const out = await body(txHandle);
        // commit staged outbox ONLY on success (outbox-atomicity invariant)
        for (const [tenantId, entry] of stagedOutbox) {
          outboxFor(tenantId).push({ ...entry, enqueuedAt: now() });
        }
        return out;
      } catch (e) {
        // rollback doc + outbox writes
        stores.clear();
        for (const [name, store] of JSON.parse(snapshot) as [string, DocStore][])
          stores.set(name, store);
        outboxStore.clear();
        for (const [t, rows] of JSON.parse(outboxSnapshot) as [string, Record<string, unknown>[]][])
          outboxStore.set(t, rows);
        throw e;
      }
    },

    encodeCursor(value) {
      return Buffer.from(JSON.stringify(value), "utf8").toString("base64");
    },
    decodeCursor(cursor) {
      return JSON.parse(Buffer.from(cursor, "base64").toString("utf8"));
    },

    _reset() {
      stores.clear();
      claimsStore.clear();
      revoked.clear();
      answerKeyStore.clear();
      idemStore.clear();
      outboxStore.clear();
      auditStore.clear();
      progressStore.clear();
    },
  };

  return repos;
}
