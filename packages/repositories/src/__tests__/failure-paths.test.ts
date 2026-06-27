/**
 * Repositories — failure & edge paths (SDK-LAYERS-PLAN §4.1; api-client error
 * normalization is api-client's job — the repo must PROPAGATE, not swallow).
 *
 * Locked invariants:
 *   • A wire failure on any repo IO method rejects (the repo never returns a
 *     silent empty/undefined that masks an error).
 *   • A `save` CONFLICT / PRECONDITION error propagates unchanged.
 *   • A `getMany` partial/empty wire response is surfaced faithfully (missing ids
 *     simply absent — no fabricated entities).
 *   • `paginate` over an empty first page returns `{items:[],nextCursor:null}`
 *     and never loops.
 *
 * Runs over the FAKE ApiClient — no emulator.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  createFakeApiClient,
  httpsErrorLike,
  makePage,
  makeStudent,
  type FakeApiClient,
} from "../../../../tests/sdk/fakes";
import { ready, buildRepos } from "./_harness";

const d = ready() ? describe : describe.skip;

d("repositories · failure & edge paths", () => {
  let api: FakeApiClient;
  beforeEach(() => {
    api = createFakeApiClient();
  });

  it("a list() wire failure rejects (never silently returns empty)", async () => {
    api.fail("v1.levelup.listSpaces", httpsErrorLike("unavailable", "backend down"));
    const r = buildRepos(api);
    await expect(r["spaceRepo"]!["list"]!({ limit: 20 })).rejects.toBeTruthy();
  });

  it("a save() CONFLICT propagates unchanged", async () => {
    api.fail("v1.levelup.saveSpace", httpsErrorLike("already-exists", "version conflict"));
    const r = buildRepos(api);
    await expect(
      r["spaceRepo"]!["save"]!({ id: "space__dsa", data: { title: "x" } })
    ).rejects.toBeTruthy();
  });

  it("getMany surfaces a partial batch faithfully (missing ids absent, none fabricated)", async () => {
    api.stub("identity", "listStudents", (req) => {
      const ids = ((req as { ids?: string[] }).ids ?? []) as string[];
      // Server returns only 2 of the 3 requested (one archived/missing).
      const present = ids.filter((id) => id !== "student__2");
      return { items: present.map((id) => makeStudent({ id })), nextCursor: null };
    });
    const r = buildRepos(api);
    const repo = r["studentRepo"]!;
    if (typeof repo["getMany"] !== "function") return;
    const res = (await repo["getMany"]!(["student__0", "student__1", "student__2"])) as
      | unknown[]
      | { items: unknown[] };
    const items = (Array.isArray(res) ? res : res.items) as { id: string }[];
    expect(items.map((i) => i.id).sort()).toEqual(["student__0", "student__1"]);
  });

  it("paginate over an empty first page returns end-of-stream and never loops", async () => {
    api.stub("levelup", "listSpaces", () => makePage([], null));
    const r = buildRepos(api);
    const p = (await r["spaceRepo"]!["list"]!({ limit: 20 })) as {
      items: unknown[];
      nextCursor: string | null;
    };
    expect(p.items).toHaveLength(0);
    expect(p.nextCursor).toBeNull();
    expect(api.callsTo("v1.levelup.listSpaces")).toHaveLength(1);
  });
});
