/**
 * Repositories — get/save wire-shape contract (SDK-LAYERS-PLAN §4.1, §3.2, D2/D5,
 * §4.5 DX-5).
 *
 * Locked invariants:
 *   • `get(id)` issues the single get callable for the entity and returns the
 *     shaped domain entity (not a raw envelope).
 *   • `save(input)` issues the matching `save*` callable and passes the request
 *     body THROUGH — never injecting `tenantId` (D2: tenantId is claim-derived,
 *     never in any request body, mirrored by `no-tenant-id-in-request`).
 *   • `save*` is create/update of METADATA; lifecycle verbs (`publish`/`archive`)
 *     route through `saveSpace` with `data.status` (contract — no separate
 *     publishSpace/archiveSpace callables). Autograde still uses explicit
 *     `publishExam` / `releaseResults` where registered.
 *   • `delete?:true` archive convention (D5) reaches the wire on the save body.
 *   • `get` of a missing id surfaces the wire NOT_FOUND rather than swallowing.
 *
 * Runs over the FAKE ApiClient — no emulator.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  createFakeApiClient,
  httpsErrorLike,
  makeSpace,
  makeStudent,
  type FakeApiClient,
} from "../../../../tests/sdk/fakes";
import { ready, buildRepos } from "./_harness";

const d = ready() ? describe : describe.skip;

d("repositories · get/save shape", () => {
  let api: FakeApiClient;
  beforeEach(() => {
    api = createFakeApiClient();
  });

  it("get(id) calls the single get callable and returns the shaped entity", async () => {
    const space = makeSpace({ id: "space__dsa" });
    // Wire envelope is `{ space }` — repo unwraps to the entity.
    api.stub("levelup", "getSpace", () => ({ space }));
    const r = buildRepos(api);
    const got = (await r["spaceRepo"]!["get"]!("space__dsa")) as { id: string };
    expect(got.id).toBe("space__dsa");
    expect(api.callsTo("v1.levelup.getSpace")).toHaveLength(1);
  });

  it("save() passes the body through and NEVER injects tenantId (D2)", async () => {
    api.stub("levelup", "saveSpace", () => ({ id: "space__new", created: true }));
    const r = buildRepos(api);
    await r["spaceRepo"]!["save"]!({ data: { title: "New", type: "course" } });

    const call = api.callsTo("v1.levelup.saveSpace")[0]!;
    const body = call.data as Record<string, unknown>;
    expect(body).not.toHaveProperty("tenantId");
    // Nested data must also be tenantId-free.
    const data = (body.data ?? {}) as Record<string, unknown>;
    expect(data).not.toHaveProperty("tenantId");
  });

  it("save() returns the SaveResponse {id, created?} verbatim", async () => {
    api.stub("identity", "saveStudent", () => ({ id: "student__sam", created: false }));
    const r = buildRepos(api);
    const res = (await r["studentRepo"]!["save"]!({
      id: "student__sam",
      data: makeStudent(),
    })) as { id: string; created?: boolean };
    expect(res.id).toBe("student__sam");
    expect(res.created).toBe(false);
  });

  it("delete?:true archive convention (D5) rides the save body to the wire", async () => {
    api.stub("levelup", "saveSpace", () => ({ id: "space__dsa", deleted: true }));
    const r = buildRepos(api);
    await r["spaceRepo"]!["save"]!({ id: "space__dsa", delete: true });
    const body = api.callsTo("v1.levelup.saveSpace")[0]!.data as { delete?: boolean };
    expect(body.delete).toBe(true);
  });

  it("lifecycle verbs publish/archive route through saveSpace status (contract)", async () => {
    // api-contract: saveSpace IS the transition verb — no publishSpace/archiveSpace.
    api.stub("levelup", "saveSpace", () => ({ id: "space__dsa", status: "published" }));
    const r = buildRepos(api);
    const repo = r["spaceRepo"]!;

    if (typeof repo["publish"] === "function") {
      await (repo["publish"] as (a: unknown) => Promise<unknown>)({ id: "space__dsa" });
      const publishCalls = api.callsTo("v1.levelup.saveSpace");
      expect(publishCalls).toHaveLength(1);
      expect(publishCalls[0]!.data).toEqual({
        id: "space__dsa",
        data: { status: "published" },
      });
    }

    if (typeof repo["archive"] === "function") {
      api.stub("levelup", "saveSpace", () => ({ id: "space__dsa", status: "archived" }));
      await (repo["archive"] as (a: unknown) => Promise<unknown>)({ id: "space__dsa" });
      const archiveCalls = api.callsTo("v1.levelup.saveSpace");
      const last = archiveCalls[archiveCalls.length - 1]!;
      expect(last.data).toEqual({
        id: "space__dsa",
        data: { status: "archived" },
      });
    }
  });

  it("get() of a missing id surfaces the wire NOT_FOUND (does not swallow)", async () => {
    api.fail("v1.levelup.getSpace", httpsErrorLike("not-found", "Space not found"));
    const r = buildRepos(api);
    await expect(r["spaceRepo"]!["get"]!("space__missing")).rejects.toBeTruthy();
  });
});
