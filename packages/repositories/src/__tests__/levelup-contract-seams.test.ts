import { beforeEach, describe, expect, it } from "vitest";
import {
  createFakeApiClient,
  makeItem,
  makePage,
  makeSpace,
  makeStoryPoint,
  type FakeApiClient,
} from "../../../../tests/sdk/fakes";
import { buildRepos, ready } from "./_harness";

const d = ready() ? describe : describe.skip;

d("repositories · canonical LevelUp contract seams", () => {
  let api: FakeApiClient;

  beforeEach(() => {
    api = createFakeApiClient();
  });

  it("unwraps getSpace and sends the canonical request scope", async () => {
    const space = makeSpace({ id: "space__one" });
    api.stub("levelup", "getSpace", () => ({ space }));

    const result = await buildRepos(api)["spaceRepo"]!["get"]!("space__one");

    expect(result).toEqual(space);
    expect(api.callsTo("v1.levelup.getSpace")[0]!.data).toEqual({
      spaceId: "space__one",
    });
  });

  it("requires full story-point scope and unwraps the response envelope", async () => {
    const storyPoint = makeStoryPoint({ id: "story__one", spaceId: "space__one" });
    api.stub("levelup", "getStoryPoint", () => ({ storyPoint }));

    const result = await buildRepos(api)["storyPointRepo"]!["get"]!({
      spaceId: "space__one",
      storyPointId: "story__one",
    });

    expect(result).toEqual(storyPoint);
    expect(api.callsTo("v1.levelup.getStoryPoint")[0]!.data).toEqual({
      spaceId: "space__one",
      storyPointId: "story__one",
    });
  });

  it("keeps item reads authoring-scoped, unwraps item, and exposes no invented get/getMany", async () => {
    const item = makeItem({ id: "item__one" });
    api.stub("levelup", "getItemForEdit", () => ({ item }));
    const repo = buildRepos(api)["itemRepo"]!;

    const result = (await repo["getForEdit"]!({
      spaceId: "space__one",
      storyPointId: "story__one",
      itemId: "item__one",
    })) as { item: unknown; cacheKey: readonly unknown[] };

    expect(result.item).toEqual(item);
    expect(result.cacheKey).toEqual(["__edit_item__", "item__one"]);
    expect(api.callsTo("v1.levelup.getItemForEdit")[0]!.data).toEqual({
      spaceId: "space__one",
      storyPointId: "story__one",
      itemId: "item__one",
    });
    expect(repo["get"]).toBeUndefined();
    expect(repo["getMany"]).toBeUndefined();
  });

  it("maps soft deletes into data.deleted for all three save contracts", async () => {
    api.stub("levelup", "saveSpace", () => ({ id: "space__one", created: false }));
    api.stub("levelup", "saveStoryPoint", () => ({ id: "story__one", deleted: true }));
    api.stub("levelup", "saveItem", () => ({ id: "item__one", deleted: true }));
    const repos = buildRepos(api);

    await repos["spaceRepo"]!["save"]!({ id: "space__one", data: {}, delete: true });
    await repos["storyPointRepo"]!["save"]!({
      id: "story__one",
      spaceId: "space__one",
      data: { title: "One", type: "practice" },
      delete: true,
    });
    await repos["itemRepo"]!["save"]!({
      id: "item__one",
      spaceId: "space__one",
      storyPointId: "story__one",
      data: {
        type: "material",
        payload: { itemType: "material", materialData: { materialType: "text" } },
      },
      delete: true,
    });

    for (const name of ["saveSpace", "saveStoryPoint", "saveItem"] as const) {
      const body = api.callsTo(`v1.levelup.${name}`)[0]!.data as {
        delete?: boolean;
        data: { deleted?: boolean };
      };
      expect(body).not.toHaveProperty("delete");
      expect(body.data.deleted).toBe(true);
    }
  });

  it("maps publish/archive to saveSpace.data.status instead of nonexistent callables", async () => {
    api.stub("levelup", "saveSpace", () => ({ id: "space__one", created: false }));
    const repo = buildRepos(api)["spaceRepo"]!;

    await repo["publish"]!({ id: "space__one" });
    await repo["archive"]!({ id: "space__one" });

    expect(api.callsTo("v1.levelup.saveSpace").map((call) => call.data)).toEqual([
      { id: "space__one", data: { status: "published" } },
      { id: "space__one", data: { status: "archived" } },
    ]);
    expect(api.callsTo("v1.levelup.publishSpace")).toHaveLength(0);
    expect(api.callsTo("v1.levelup.archiveSpace")).toHaveLength(0);
  });

  it("keeps space detail bounded and marks items incomplete when no batch contract exists", async () => {
    const space = makeSpace({ id: "space__one" });
    api.stub("levelup", "getSpace", () => ({ space }));
    api.stub("levelup", "listStoryPoints", () => ({
      items: [makeStoryPoint({ id: "story__one" }), makeStoryPoint({ id: "story__two" })],
    }));
    api.stub("levelup", "getSpaceProgress", () => ({ progress: null }));
    api.stub("levelup", "listItems", () => makePage([makeItem()]));

    const result = (await buildRepos(api)["spaceDetailViewRepo"]!["get"]!("space__one")) as {
      space: unknown;
      items: unknown[];
      itemsComplete: boolean;
      myProgress: unknown;
    };

    expect(result.space).toEqual(space);
    expect(result.items).toEqual([]);
    expect(result.itemsComplete).toBe(false);
    expect(result.myProgress).toBeNull();
    expect(api.callsTo("v1.levelup.listItems")).toHaveLength(0);
    expect(api.calls).toHaveLength(3);
  });

  it("uses one valid scoped listItems call when the view has one story point", async () => {
    api.stub("levelup", "getSpace", () => ({ space: makeSpace({ id: "space__one" }) }));
    api.stub("levelup", "listStoryPoints", () => ({
      items: [makeStoryPoint({ id: "story__one" })],
    }));
    api.stub("levelup", "getSpaceProgress", () => ({ progress: null }));
    api.stub("levelup", "listItems", () => makePage([makeItem({ id: "item__one" })], null));

    const result = (await buildRepos(api)["spaceDetailViewRepo"]!["get"]!({
      spaceId: "space__one",
    })) as { items: unknown[]; itemsComplete: boolean };

    expect(result.items).toHaveLength(1);
    expect(result.itemsComplete).toBe(true);
    expect(api.callsTo("v1.levelup.listItems")[0]!.data).toEqual({
      spaceId: "space__one",
      storyPointId: "story__one",
      limit: 100,
    });
  });

  it("reads the canonical rating aggregate field", () => {
    const repo = buildRepos(api)["spaceRepo"]!;
    expect(repo["computeAverageRating"]!({ ratingAggregate: { averageRating: 4.25 } })).toBe(4.25);
  });
});
