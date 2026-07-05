/**
 * REGRESSION (GATE-B — answerKey get-by-id / scoped-read NOT_FOUND under a
 * collection prefix). The bug: `answerKeys.get(tenantId, itemId)` resolves the key
 * via a collection-group query and then tenant-scopes the match by
 * `d.ref.path.startsWith(...)`. A hardcoded `tenants/${tenantId}/` literal on that
 * filter returns NOTHING under `LVLUP_COLLECTION_PREFIX=v2_` (the real path is
 * `v2_tenants/…`), so LIST worked but GET(id) returned null → NOT_FOUND. The fix
 * uses the PREFIX-AWARE `tenantDoc(tenantId)` so the get path scope is byte-identical
 * to the write/list path scope.
 *
 * This test drives the REAL `makeAnswerKeyRepo` (put → get round-trip) over a
 * minimal in-memory Firestore so the ACTUAL path-building logic runs. It asserts
 * the write path and the get's accepted scope share the SAME prefixed `tenants`
 * root — i.e. get(id) resolves the exact doc put/list wrote. Reverting the fix to
 * a hardcoded `tenants/` literal makes the v2_ case go red (get returns null).
 */
import { afterEach, describe, expect, it } from "vitest";
import { makeAnswerKeyRepo } from "./authority.js";
import { answerKeyDoc, tenantDoc, ANSWER_KEYS_COLLECTION_GROUP } from "./paths.js";

const ENV = "LVLUP_COLLECTION_PREFIX";
const now = () => "2026-07-04T00:00:00.000Z";

/** The parent collection of a doc path (segment before the doc id). */
function parentCollection(path: string): string {
  const segs = path.split("/");
  return segs[segs.length - 2] ?? "";
}

/**
 * Minimal in-memory Firestore covering exactly what `makeAnswerKeyRepo` touches:
 *   • `.doc(path).set(data, {merge})`  (put)
 *   • `.collectionGroup(name).where(f,op,v).get()` → { docs:[{ data(), ref:{path} }] }  (get)
 * The collection-group query matches every stored doc whose PARENT collection === name,
 * then applies the recorded `where` equality filters — the same surface the real
 * Admin SDK exposes, so the repo's prefix-aware path logic runs unchanged.
 */
function makeFakeFirestore() {
  const store = new Map<string, Record<string, unknown>>();
  return {
    _store: store,
    doc(path: string) {
      return {
        async set(data: Record<string, unknown>, _opts?: unknown) {
          store.set(path, { ...(store.get(path) ?? {}), ...data });
        },
      };
    },
    collectionGroup(name: string) {
      const filters: Array<[string, string, unknown]> = [];
      const query = {
        where(field: string, op: string, value: unknown) {
          filters.push([field, op, value]);
          return query;
        },
        async get() {
          const docs = [...store.entries()]
            .filter(([path]) => parentCollection(path) === name)
            .filter(([, data]) => filters.every(([f, , v]) => data[f] === v))
            .map(([path, data]) => ({ data: () => data, ref: { path } }));
          return { docs };
        },
      };
      return query;
    },
  };
}

afterEach(() => {
  delete process.env[ENV];
});

describe("answerKeys repo — get(id) shares the write/list prefixed path scope", () => {
  it("put→get round-trip resolves the key under LVLUP_COLLECTION_PREFIX=v2_ (the GATE-B fix)", async () => {
    process.env[ENV] = "v2_";
    const fs = makeFakeFirestore();
    const repo = makeAnswerKeyRepo(fs as never, now);

    await repo.put("t1", "i1", { spaceId: "s1", storyPointId: "sp1", correctOptionId: "b" });

    // The write landed on the PREFIX-AWARE canonical path (mirror of list).
    const writtenPath = [...fs._store.keys()][0];
    expect(writtenPath).toBe("v2_tenants/t1/spaces/s1/storyPoints/sp1/items/i1/answerKeys/i1");
    expect(writtenPath).toBe(answerKeyDoc("t1", "s1", "sp1", "i1"));
    // The get's tenant scope (tenantDoc) shares the SAME prefixed root as the write.
    expect(writtenPath.startsWith(`${tenantDoc("t1")}/`)).toBe(true);
    expect(parentCollection(writtenPath!)).toBe(ANSWER_KEYS_COLLECTION_GROUP);

    // get(id) must resolve it — a hardcoded `tenants/` scope would return null here.
    const got = await repo.get("t1", "i1");
    expect(got).not.toBeNull();
    expect(got?.["itemId"]).toBe("i1");
    expect(got?.["correctOptionId"]).toBe("b");
  });

  it("put→get round-trip resolves the key with the default empty prefix (byte-identical baseline)", async () => {
    delete process.env[ENV];
    const fs = makeFakeFirestore();
    const repo = makeAnswerKeyRepo(fs as never, now);

    await repo.put("t1", "i1", { spaceId: "s1", storyPointId: "sp1", correctOptionId: "b" });
    const writtenPath = [...fs._store.keys()][0];
    expect(writtenPath).toBe("tenants/t1/spaces/s1/storyPoints/sp1/items/i1/answerKeys/i1");
    expect(writtenPath).toBe(answerKeyDoc("t1", "s1", "sp1", "i1"));

    const got = await repo.get("t1", "i1");
    expect(got).not.toBeNull();
    expect(got?.["itemId"]).toBe("i1");
  });

  it("get(id) tenant-scopes by the prefixed root: a key under a DIFFERENT tenant is not returned", async () => {
    process.env[ENV] = "v2_";
    const fs = makeFakeFirestore();
    const repo = makeAnswerKeyRepo(fs as never, now);

    // Same itemId, different tenant — must NOT leak across the prefixed tenant root.
    await repo.put("t2", "i1", { spaceId: "s9", storyPointId: "sp9", correctOptionId: "z" });

    const got = await repo.get("t1", "i1");
    expect(got).toBeNull();
  });
});
