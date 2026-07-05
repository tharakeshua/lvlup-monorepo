/**
 * `@levelup/services/repo-admin/testing` — the in-memory `Repos` twin (T6).
 *
 * Implements the SAME `Repos` contract as the Admin-SDK `createRepos()` but over
 * plain Maps, so `@levelup/services` (`fn(input, ctx)`) can be unit-tested with
 * `ctx.repos` set WITHOUT the emulator and without the 30+ hand-rolled
 * firebase-admin mocks. The T6 conformance suite runs one test file against both
 * this twin and the emulator-backed real repos so the fake can never silently
 * diverge on `tx()` atomicity / cursor semantics / idempotency / progress
 * best-score retention.
 *
 * Cursor encoding (base64 JSON) is shared with the real adapter via the same
 * `cursor.ts` module — the one load-bearing cross-driver invariant.
 */
import { encodeCursor, decodeCursor } from "../cursor.js";
import { makeIdempotencyConflict } from "../errors.js";
import { spaceProgressId } from "../paths.js";
import type {
  CreateReposOptions,
  EntityCollectionName,
  EntityRepo,
  ListOptions,
  ProgressRepo,
  ProgressUpdateInput,
  ProgressUpdateResult,
  Repos,
  RepoPage,
  TxHandle,
} from "../types.js";

/** Extends the contract with the `_*` test-introspection escape hatches. */
export interface InMemoryRepos extends Repos {
  claims: Repos["claims"] & { _revoked(uid: string): boolean };
  outbox: Repos["outbox"] & { _all(tenantId: string): Record<string, unknown>[] };
  audit: Repos["audit"] & { _all(tenantId: string): Record<string, unknown>[] };
  _all(coll: EntityCollectionName, tenantId: string): Record<string, unknown>[];
  _reset(): void;
}

type DocStore = Map<string, Map<string, Record<string, unknown>>>;

let idSeq = 0;
const nextId = (): string => `mem_${(idSeq++).toString(36).padStart(8, "0")}`;

const ENTITY_COLLECTIONS: EntityCollectionName[] = [
  "spaces",
  "storyPoints",
  "items",
  "tenants",
  "students",
  "teachers",
  "classes",
  "exams",
  "submissions",
  "testSessions",
  "progressDocs",
  "notifications",
  "announcements",
];

export function createInMemoryRepos(options: CreateReposOptions = {}): InMemoryRepos {
  const now = options.now ?? (() => new Date().toISOString());
  const leaseMs = options.idempotencyLeaseMs ?? 5 * 60 * 1000;

  const stores = new Map<EntityCollectionName, DocStore>();
  const claimsStore = new Map<string, Record<string, unknown>>();
  const revoked = new Set<string>();
  const answerKeyStore = new Map<string, Record<string, unknown>>();
  const idemStore = new Map<
    string,
    { status: "in_flight" | "committed"; result?: unknown; leaseExpiresAt: number }
  >();
  const outboxStore = new Map<string, Record<string, unknown>[]>();
  const auditStore = new Map<string, Record<string, unknown>[]>();
  const rateLimitStore = new Map<string, number>();
  const progressStore = new Map<string, Record<string, unknown>>();

  function store(coll: EntityCollectionName): DocStore {
    let s = stores.get(coll);
    if (!s) {
      s = new Map();
      stores.set(coll, s);
    }
    return s;
  }
  function tenantMap(
    coll: EntityCollectionName,
    tenantId: string
  ): Map<string, Record<string, unknown>> {
    const s = store(coll);
    let t = s.get(tenantId);
    if (!t) {
      t = new Map();
      s.set(tenantId, t);
    }
    return t;
  }
  const outboxFor = (t: string): Record<string, unknown>[] => {
    let r = outboxStore.get(t);
    if (!r) outboxStore.set(t, (r = []));
    return r;
  };
  const auditFor = (t: string): Record<string, unknown>[] => {
    let r = auditStore.get(t);
    if (!r) auditStore.set(t, (r = []));
    return r;
  };

  function makeRepo(coll: EntityCollectionName): EntityRepo {
    return {
      async get(tenantId, id) {
        return tenantMap(coll, tenantId).get(id) ?? null;
      },
      async getMany(tenantId, ids) {
        const t = tenantMap(coll, tenantId);
        return ids.map((id) => t.get(id)).filter((d): d is Record<string, unknown> => Boolean(d));
      },
      async upsert(tenantId, data, ts = now()) {
        const t = tenantMap(coll, tenantId);
        const id = (data["id"] as string | undefined) ?? nextId();
        const created = !t.has(id);
        t.set(id, {
          ...t.get(id),
          ...data,
          id,
          tenantId,
          updatedAt: ts,
          ...(created ? { createdAt: ts } : {}),
        });
        return { id, created };
      },
      async list(tenantId, opts: ListOptions = {}): Promise<RepoPage> {
        const t = tenantMap(coll, tenantId);
        let items = [...t.values()];
        if (opts.where) {
          for (const [f, v] of Object.entries(opts.where)) {
            items = items.filter((d) => d[f] === v);
          }
        }
        if (opts.filter) items = items.filter(opts.filter);
        const orderBy = opts.orderBy ?? "id";
        items.sort((a, b) =>
          String(a[orderBy] ?? a["id"]).localeCompare(String(b[orderBy] ?? b["id"]))
        );
        const limit = opts.limit ?? 20;
        let start = 0;
        if (opts.cursor) {
          const cur = decodeCursor(opts.cursor) as { id: string };
          const idx = items.findIndex((d) => d["id"] === cur.id);
          start = idx >= 0 ? idx + 1 : 0;
        }
        const page = items.slice(start, start + limit);
        const last = page[page.length - 1];
        const nextCursor =
          start + limit < items.length && last
            ? encodeCursor({ v: last[orderBy] ?? last["id"], id: last["id"] })
            : null;
        return { items: page, nextCursor };
      },
      async delete(tenantId, id) {
        tenantMap(coll, tenantId).delete(id);
      },
    };
  }

  const entityRepos = Object.fromEntries(ENTITY_COLLECTIONS.map((c) => [c, makeRepo(c)])) as Record<
    EntityCollectionName,
    EntityRepo
  >;

  const progress: ProgressRepo = {
    async update(tenantId, input: ProgressUpdateInput, ts = now()) {
      const key = `${tenantId}/${spaceProgressId(input.userId, input.spaceId)}`;
      const doc = (progressStore.get(key) ?? {
        id: spaceProgressId(input.userId, input.spaceId),
        userId: input.userId,
        spaceId: input.spaceId,
        tenantId,
        items: {} as Record<string, Record<string, unknown>>,
        storyPoints: {} as Record<string, Record<string, unknown>>,
      }) as Record<string, unknown>;
      const items = (doc["items"] ??= {}) as Record<string, Record<string, unknown>>;
      for (const u of input.items) {
        const prior = items[u.itemId];
        if (!prior || (prior["score"] as number) < u.score) {
          items[u.itemId] = {
            itemId: u.itemId,
            storyPointId: u.storyPointId,
            score: u.score,
            maxScore: u.maxScore,
            correct: u.correct,
            timeSpentMs: u.timeSpentMs,
            evaluation: u.evaluation,
            updatedAt: ts,
          };
        }
      }
      const spAgg = new Map<string, { earned: number; total: number }>();
      for (const e of Object.values(items)) {
        const sp = e["storyPointId"] as string;
        const cur = spAgg.get(sp) ?? { earned: 0, total: 0 };
        cur.earned += e["score"] as number;
        cur.total += e["maxScore"] as number;
        spAgg.set(sp, cur);
      }
      const storyPoints: Record<string, Record<string, unknown>> = {};
      for (const [sp, agg] of spAgg) {
        storyPoints[sp] = {
          storyPointId: sp,
          pointsEarned: agg.earned,
          totalPoints: agg.total,
          completed: agg.total > 0 && agg.earned >= agg.total,
        };
      }
      doc["storyPoints"] = storyPoints;
      const pointsEarned = Object.values(storyPoints).reduce(
        (s, sp) => s + (sp["pointsEarned"] as number),
        0
      );
      const totalPoints = Object.values(storyPoints).reduce(
        (s, sp) => s + (sp["totalPoints"] as number),
        0
      );
      if (input.totalStoryPoints != null) doc["totalStoryPoints"] = input.totalStoryPoints;
      const expected =
        (doc["totalStoryPoints"] as number | undefined) ?? Object.keys(storyPoints).length;
      const completed =
        expected > 0 &&
        Object.keys(storyPoints).length >= expected &&
        Object.values(storyPoints).every((sp) => sp["completed"] === true);
      doc["pointsEarned"] = pointsEarned;
      doc["totalPoints"] = totalPoints;
      doc["completed"] = completed;
      doc["recomputeMarker"] = ts;
      doc["updatedAt"] = ts;
      progressStore.set(key, doc);
      return {
        spaceProgressId: doc["id"] as string,
        completed,
        pointsEarned,
        totalPoints,
        storyPoints: storyPoints as unknown as ProgressUpdateResult["storyPoints"],
      };
    },
    async get(tenantId, userId, spaceId) {
      return progressStore.get(`${tenantId}/${spaceProgressId(userId, spaceId)}`) ?? null;
    },
  };

  const FLAT: Record<EntityCollectionName, EntityCollectionName> = Object.fromEntries(
    ENTITY_COLLECTIONS.map((c) => [c, c])
  ) as Record<EntityCollectionName, EntityCollectionName>;

  const repos: InMemoryRepos = {
    ...entityRepos,

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
        const nowMs = Date.parse(now());
        if (existing?.status === "committed") {
          return { status: "committed", result: existing.result };
        }
        if (existing?.status === "in_flight" && existing.leaseExpiresAt > nowMs) {
          throw makeIdempotencyConflict();
        }
        idemStore.set(k, { status: "in_flight", leaseExpiresAt: nowMs + leaseMs });
        return { status: "new" };
      },
      async commit(tenantId, uid, key, result) {
        idemStore.set(`${tenantId}/${uid}/${key}`, {
          status: "committed",
          result,
          leaseExpiresAt: Number.MAX_SAFE_INTEGER,
        });
      },
      async release(tenantId, uid, key) {
        const k = `${tenantId}/${uid}/${key}`;
        if (idemStore.get(k)?.status !== "committed") idemStore.delete(k);
      },
    },

    outbox: {
      async enqueue(tenantId, entry) {
        outboxFor(tenantId).push({
          ...entry,
          status: "pending",
          // DLQ entries carry their own attempt count — don't clobber it to 0.
          attempts: (entry["attempts"] as number | undefined) ?? 0,
          enqueuedAt: now(),
        });
      },
      async drain(tenantId) {
        const rows = outboxStore.get(tenantId) ?? [];
        outboxStore.set(tenantId, []);
        return rows;
      },
      _all(tenantId) {
        return outboxStore.get(tenantId) ?? [];
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

    rateLimits: {
      async hit(subject, tier, windowKey) {
        const key = `${subject}__${tier}__${windowKey}`;
        const count = (rateLimitStore.get(key) ?? 0) + 1;
        rateLimitStore.set(key, count);
        return count;
      },
    },

    progress,

    async tx<T>(body: (h: TxHandle) => Promise<T>): Promise<T> {
      const snapshot = serializeStores(stores);
      const outboxSnapshot = JSON.stringify([...outboxStore.entries()]);
      const staged: Array<[string, Record<string, unknown>]> = [];
      const handle: TxHandle = {
        async get(coll, tenantId, id) {
          return tenantMap(FLAT[coll], tenantId).get(id) ?? null;
        },
        upsert(coll, tenantId, data) {
          const t = tenantMap(FLAT[coll], tenantId);
          const id = (data["id"] as string | undefined) ?? nextId();
          t.set(id, { ...t.get(id), ...data, id, tenantId, updatedAt: now() });
          return { id };
        },
        enqueueOutbox(tenantId, entry) {
          staged.push([tenantId, entry]);
        },
      };
      try {
        const out = await body(handle);
        for (const [t, entry] of staged) {
          outboxFor(t).push({
            ...entry,
            status: "pending",
            attempts: (entry["attempts"] as number | undefined) ?? 0,
            enqueuedAt: now(),
          });
        }
        return out;
      } catch (e) {
        restoreStores(stores, snapshot);
        outboxStore.clear();
        for (const [t, rows] of JSON.parse(outboxSnapshot) as [
          string,
          Record<string, unknown>[],
        ][]) {
          outboxStore.set(t, rows);
        }
        throw e;
      }
    },

    encodeCursor,
    decodeCursor,

    _all(coll, tenantId) {
      return [...tenantMap(coll, tenantId).values()];
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

function serializeStores(stores: Map<EntityCollectionName, DocStore>): string {
  const flat: Array<[string, Array<[string, Array<[string, Record<string, unknown>]>]>]> = [];
  for (const [coll, ds] of stores) {
    const tenants: Array<[string, Array<[string, Record<string, unknown>]>]> = [];
    for (const [t, docs] of ds) tenants.push([t, [...docs.entries()]]);
    flat.push([coll, tenants]);
  }
  return JSON.stringify(flat);
}

function restoreStores(stores: Map<EntityCollectionName, DocStore>, snapshot: string): void {
  stores.clear();
  const flat = JSON.parse(snapshot) as Array<
    [EntityCollectionName, Array<[string, Array<[string, Record<string, unknown>]>]>]
  >;
  for (const [coll, tenants] of flat) {
    const ds: DocStore = new Map();
    for (const [t, docs] of tenants) ds.set(t, new Map(docs));
    stores.set(coll, ds);
  }
}
