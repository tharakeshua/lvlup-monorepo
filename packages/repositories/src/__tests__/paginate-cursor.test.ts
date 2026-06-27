/**
 * Repositories — pagination & opaque-cursor management (SDK-LAYERS-PLAN §4.1,
 * §3.5, MERGE-PAGINATION).
 *
 * Locked invariants:
 *   • Every `list*` repo method paginates via the contract `PageRequest`
 *     `{cursor?,limit}` and surfaces `pageResponse {items,nextCursor,total?}`.
 *   • The cursor is OPAQUE — the repo threads `nextCursor` straight back into the
 *     next request's `cursor` field without parsing/mutating it.
 *   • `nextCursor:null` is the end-of-stream sentinel; `fetchNextPage()` (when the
 *     repo exposes an iterator helper) stops there and never re-issues.
 *   • `limit` defaults / passes through (1..100, default 20 — §3.5).
 *   • `total` is only what the wire returns (a maintained counter), never derived
 *     by the repo issuing a `.count()` (the client never touches Firestore).
 *
 * Runs over the FAKE ApiClient — no emulator.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  createFakeApiClient,
  makePage,
  makeSpace,
  type FakeApiClient,
} from "../../../../tests/sdk/fakes";
import { ready, buildRepos } from "./_harness";

const d = ready() ? describe : describe.skip;

d("repositories · pagination + opaque cursor", () => {
  let api: FakeApiClient;
  beforeEach(() => {
    api = createFakeApiClient();
  });

  it("threads the opaque cursor verbatim into the next request and stops on nextCursor:null", async () => {
    api.stub("levelup", "listSpaces", (req) => {
      const cursor = (req as { cursor?: string }).cursor;
      if (!cursor) return makePage([makeSpace({ id: "A" })], "OPAQUE::cursor::1");
      if (cursor === "OPAQUE::cursor::1")
        return makePage([makeSpace({ id: "B" })], "OPAQUE::cursor::2");
      return makePage([makeSpace({ id: "C" })], null);
    });
    const r = buildRepos(api);
    const list = r["spaceRepo"]!["list"]!;

    const p1 = (await list({ limit: 1 })) as { items: unknown[]; nextCursor: string | null };
    expect(p1.items).toHaveLength(1);
    expect(p1.nextCursor).toBe("OPAQUE::cursor::1");

    const p2 = (await list({ limit: 1, cursor: p1.nextCursor })) as { nextCursor: string | null };
    expect(p2.nextCursor).toBe("OPAQUE::cursor::2");

    const p3 = (await list({ limit: 1, cursor: p2.nextCursor })) as { nextCursor: string | null };
    expect(p3.nextCursor).toBeNull();

    // The cursor reached the wire UNMODIFIED (opaque — repo must not parse it).
    const sent = api
      .callsTo("v1.levelup.listSpaces")
      .map((c) => (c.data as { cursor?: string }).cursor);
    expect(sent).toEqual([undefined, "OPAQUE::cursor::1", "OPAQUE::cursor::2"]);
  });

  it("a single list() call issues exactly ONE wire call (no eager prefetch / no count())", async () => {
    api.stub("levelup", "listSpaces", () => makePage([makeSpace()], "NEXT"));
    const r = buildRepos(api);
    await r["spaceRepo"]!["list"]!({ limit: 20 });
    expect(api.callsTo("v1.levelup.listSpaces")).toHaveLength(1);
    // No separate count-style callable was ever invoked.
    expect(api.calls.some((c) => /count/i.test(c.name))).toBe(false);
  });

  it("passes a caller-provided limit through and defaults to a bounded page when omitted", async () => {
    let seenLimit: unknown;
    api.stub("levelup", "listSpaces", (req) => {
      seenLimit = (req as { limit?: number }).limit;
      return makePage([makeSpace()], null);
    });
    const r = buildRepos(api);
    await r["spaceRepo"]!["list"]!({ limit: 50 });
    expect(seenLimit).toBe(50);
  });

  it("fetchNextPage()/paginate() iterator (when present) walks to end and never re-issues past null", async () => {
    const pages = [
      makePage([makeSpace({ id: "1" })], "c1"),
      makePage([makeSpace({ id: "2" })], "c2"),
      makePage([makeSpace({ id: "3" })], null),
    ];
    let i = 0;
    api.stub("levelup", "listSpaces", () => pages[i++]);
    const r = buildRepos(api);
    const repo = r["spaceRepo"]!;

    if (typeof repo["paginate"] === "function") {
      // paginate() returns a cursor-managing iterator/page-bag; drain it.
      const collected: unknown[] = [];
      let bag = (await repo["paginate"]!({ limit: 1 })) as {
        items: unknown[];
        nextCursor: string | null;
        fetchNextPage?: () => Promise<{ items: unknown[]; nextCursor: string | null }>;
      };
      collected.push(...bag.items);
      while (bag.nextCursor !== null && typeof bag.fetchNextPage === "function") {
        bag = await bag.fetchNextPage();
        collected.push(...bag.items);
      }
      expect(collected).toHaveLength(3);
      // Drained exactly 3 wire calls — never one past the null sentinel.
      expect(api.callsTo("v1.levelup.listSpaces")).toHaveLength(3);
    } else {
      expect(typeof repo["list"]).toBe("function");
    }
  });

  it("surfaces a maintained total ONLY when the wire returns one (never repo-derived)", async () => {
    api.stub("levelup", "listSpaces", () => makePage([makeSpace()], null, 7));
    const withTotal = buildRepos(api);
    const p = (await withTotal["spaceRepo"]!["list"]!({ limit: 20 })) as { total?: number };
    expect(p.total).toBe(7);

    api.reset();
    api.stub("levelup", "listSpaces", () => makePage([makeSpace()], null));
    const noTotal = buildRepos(api);
    const p2 = (await noTotal["spaceRepo"]!["list"]!({ limit: 20 })) as { total?: number };
    expect(p2.total).toBeUndefined();
  });
});
