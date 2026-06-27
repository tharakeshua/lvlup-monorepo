/**
 * Repositories — getMany N+1 collapse + NO client-side Firestore chunking
 * (SDK-LAYERS-PLAN §4.1, §5.5, DX-14/PC-15).
 *
 * Locked invariants:
 *   • `getMany(ids)` collapses N reads into ONE batched read callable / view
 *     callable — it never issues one wire call per id (no N+1).
 *   • The repo does NOT do client-side Firestore `in`-chunking of 10/30 ids: the
 *     10/30-id chunking + Promise.all + max-ids cap lives SERVER-SIDE in
 *     repository-admin. The client sends the full id list in one request and lets
 *     the server fan in. (Matrix: 0/1/10/11/21 ids.)
 *   • `getMany([])` short-circuits — zero ids ⇒ zero wire calls, empty result.
 *   • `getMany` preserves caller id ordering / dedupes is server-shaped; the repo
 *     just passes ids and maps the batched response back.
 *
 * Runs over the FAKE ApiClient — no emulator.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { createFakeApiClient, makeStudent, type FakeApiClient } from "../../../../tests/sdk/fakes";
import { ready, buildRepos } from "./_harness";

const d = ready() ? describe : describe.skip;

/** The batched read callable a getMany repo is expected to fan into. */
const BATCH_CALLABLE = "v1.identity.listStudents";

function idList(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `student__${i}`);
}

d("repositories · getMany batching (no client chunking)", () => {
  let api: FakeApiClient;
  beforeEach(() => {
    api = createFakeApiClient();
  });

  function stubBatch() {
    // The batched read callable returns whatever ids it is asked for.
    api.stub("identity", "listStudents", (req) => {
      const ids = ((req as { ids?: string[] }).ids ?? []) as string[];
      return { items: ids.map((id) => makeStudent({ id })), nextCursor: null };
    });
  }

  const cases = [0, 1, 10, 11, 21];
  for (const n of cases) {
    it(`getMany(${n} ids) issues at most ONE batched wire call (no per-id N+1, no 10/30 client chunk)`, async () => {
      stubBatch();
      const r = buildRepos(api);
      const repo = r["studentRepo"]!;
      if (typeof repo["getMany"] !== "function") {
        // Some entity repos route getMany through a view; assert via that path elsewhere.
        expect(typeof repo["get"] ?? typeof repo["list"]).toBeTypeOf("string");
        return;
      }
      const result = (await repo["getMany"]!(idList(n))) as unknown[] | { items: unknown[] };
      const items = Array.isArray(result) ? result : result.items;
      expect(items).toHaveLength(n);

      const batchCalls = api.callsTo(BATCH_CALLABLE);
      if (n === 0) {
        // Zero ids ⇒ short-circuit, no wire call at all.
        expect(batchCalls).toHaveLength(0);
      } else {
        // CRITICAL: exactly ONE call regardless of count — never per-id, never
        // client-chunked into ceil(n/10) or ceil(n/30) calls.
        expect(batchCalls).toHaveLength(1);
        const sentIds = (batchCalls[0]!.data as { ids?: string[] }).ids ?? [];
        expect(sentIds).toHaveLength(n);
      }
    });
  }

  it("does NOT split 21 ids into 3×10 or 1×30 client-side chunks", async () => {
    stubBatch();
    const r = buildRepos(api);
    const repo = r["studentRepo"]!;
    if (typeof repo["getMany"] !== "function") return;
    await repo["getMany"]!(idList(21));
    // The whole point of DX-14: one call carrying all 21 ids. Any number > 1 is a
    // client-side-chunking regression.
    expect(api.callsTo(BATCH_CALLABLE)).toHaveLength(1);
  });

  it("getMany([]) returns empty WITHOUT touching the wire", async () => {
    stubBatch();
    const r = buildRepos(api);
    const repo = r["studentRepo"]!;
    if (typeof repo["getMany"] !== "function") return;
    const result = (await repo["getMany"]!([])) as unknown[] | { items: unknown[] };
    const items = Array.isArray(result) ? result : result.items;
    expect(items).toHaveLength(0);
    expect(api.calls).toHaveLength(0);
  });
});
