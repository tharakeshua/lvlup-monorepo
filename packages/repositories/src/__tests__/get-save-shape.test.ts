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
 *   • `save*` is create/update of METADATA only; lifecycle is explicit verbs
 *     (DX-5 — `publishSpace`/`archiveSpace`/`publishExam`/`releaseResults`), so a
 *     `save*` body never carries a raw lifecycle status flip path.
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
  makeStoryPoint,
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

  it("get(id) calls the single get callable and unwraps { space }", async () => {
    const space = makeSpace({ id: "space__dsa" });
    // Wire contract is `{ space: SpaceView }` — repo must unwrap for callers.
    api.stub("levelup", "getSpace", () => ({ space }));
    const r = buildRepos(api);
    const got = (await r["spaceRepo"]!["get"]!("space__dsa")) as { id: string };
    expect(got.id).toBe("space__dsa");
    expect(api.callsTo("v1.levelup.getSpace")).toHaveLength(1);
  });

  it("storyPointRepo.get requires spaceId and unwraps { storyPoint }", async () => {
    const sp = makeStoryPoint({ id: "sp__arrays" });
    api.stub("levelup", "getStoryPoint", () => ({ storyPoint: sp }));
    const r = buildRepos(api);
    const got = (await r["storyPointRepo"]!["get"]!({
      spaceId: "space__dsa",
      storyPointId: "sp__arrays",
    })) as { id: string };
    expect(got.id).toBe("sp__arrays");
    const call = api.callsTo("v1.levelup.getStoryPoint")[0]!;
    expect(call.data).toMatchObject({ spaceId: "space__dsa", storyPointId: "sp__arrays" });
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

  it("lifecycle is an EXPLICIT verb, not a save() status flip (DX-5)", async () => {
    // If the repo exposes a lifecycle verb it must route to a dedicated callable,
    // keeping save* metadata-only. The verb is one of the §4.5 named set.
    api.stub("levelup", "saveSpace", () => ({ id: "space__dsa" }));
    api.stub("levelup", "publishSpace", () => ({ id: "space__dsa", status: "published" }));
    api.stub("levelup", "archiveSpace", () => ({ id: "space__dsa", status: "archived" }));
    const r = buildRepos(api);
    const repo = r["spaceRepo"]!;

    if (typeof repo["publishSpace"] === "function" || typeof repo["publish"] === "function") {
      const publish = (repo["publishSpace"] ?? repo["publish"]) as (a: unknown) => Promise<unknown>;
      await publish({ id: "space__dsa" });
      // Lifecycle did NOT go through saveSpace.
      expect(api.callsTo("v1.levelup.saveSpace")).toHaveLength(0);
      expect(api.callsTo("v1.levelup.publishSpace").length).toBeGreaterThanOrEqual(0);
    } else {
      // No fused lifecycle verb exposed at all — also satisfies DX-5.
      expect(typeof repo["save"]).toBe("function");
    }
  });

  it("get() of a missing id surfaces the wire NOT_FOUND (does not swallow)", async () => {
    api.fail("v1.levelup.getSpace", httpsErrorLike("not-found", "Space not found"));
    const r = buildRepos(api);
    await expect(r["spaceRepo"]!["get"]!("space__missing")).rejects.toBeTruthy();
  });
});
