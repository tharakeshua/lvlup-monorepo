/**
 * `duplicateSpaceService` — server-side deep copy (CC-4, Fable-reviewed).
 * Pins the three properties the client waterfall could not guarantee:
 *   1. The copy is a fresh DRAFT: new ids, cleared classIds, publishedToStore
 *      false, publishedAt null, "(Copy)" title suffix.
 *   2. AD-11: the copied ITEM doc carries no answer fields; the answer key is
 *      copied SERVER-SIDE into answerKeys under the NEW item id.
 *   3. Cursor-loop completeness: >1 page of items (limit 200) all get copied —
 *      a single-page read would silently truncate large spaces.
 */
import { describe, it, expect } from "vitest";
import { makeAuthContext } from "../../../../tests/sdk/harness/auth-context";
import { duplicateSpaceService } from "./content";

const TS = "2026-01-01T00:00:00.000Z";

async function seedSpace(ctx: ReturnType<typeof makeAuthContext>, itemCount: number) {
  const tenantId = ctx.tenantId!;
  await ctx.repos.spaces.upsert(tenantId, {
    id: "space_src",
    title: "Physics I",
    type: "learning",
    status: "published",
    accessType: "class_assigned",
    classIds: ["class_a"],
    publishedToStore: true,
    publishedAt: TS,
    createdAt: TS,
    updatedAt: TS,
  });
  await ctx.repos.storyPoints.upsert(tenantId, {
    id: "sp_src",
    spaceId: "space_src",
    title: "Ohm's law",
    type: "standard",
    createdAt: TS,
    updatedAt: TS,
  });
  for (let i = 1; i <= itemCount; i++) {
    await ctx.repos.items.upsert(tenantId, {
      id: `item_src_${i}`,
      spaceId: "space_src",
      storyPointId: "sp_src",
      itemType: "question",
      title: `Q${i}`,
      createdAt: TS,
      updatedAt: TS,
    });
  }
  await ctx.repos.answerKeys.put(tenantId, "item_src_1", {
    itemId: "item_src_1",
    spaceId: "space_src",
    storyPointId: "sp_src",
    correctAnswer: "V = IR",
  });
  return tenantId;
}

describe("duplicateSpace — server-side deep copy", () => {
  it("copies as a fresh draft with answer keys re-homed server-side", async () => {
    const ctx = makeAuthContext("teacher");
    const tenantId = await seedSpace(ctx, 2);

    const res = (await duplicateSpaceService({ spaceId: "space_src" }, ctx)) as { id: string };
    expect(res.id).not.toBe("space_src");

    const copy = (await ctx.repos.spaces.get(tenantId, res.id))!;
    expect(copy["title"]).toBe("Physics I (Copy)");
    expect(copy["status"]).toBe("draft");
    expect(copy["publishedAt"]).toBeNull();
    expect(copy["publishedToStore"]).toBe(false);
    expect(copy["classIds"]).toEqual([]);

    // New story point + items under the new space.
    const sps = await ctx.repos.storyPoints.list(tenantId, { where: { spaceId: res.id } });
    expect(sps.items.length).toBe(1);
    const newSpId = sps.items[0]!["id"] as string;
    expect(newSpId).not.toBe("sp_src");

    const items = await ctx.repos.items.list(tenantId, { where: { spaceId: res.id } });
    expect(items.items.length).toBe(2);

    // AD-11: the answer key rides answerKeys under the NEW item id; the copied
    // item docs themselves carry no correctAnswer.
    const copiedQ1 = items.items.find((d) => d["title"] === "Q1")!;
    expect(copiedQ1["correctAnswer"]).toBeUndefined();
    const key = await ctx.repos.answerKeys.get(tenantId, copiedQ1["id"] as string);
    expect(key?.["correctAnswer"]).toBe("V = IR");
    expect(key?.["itemId"]).toBe(copiedQ1["id"]);
    expect(key?.["spaceId"]).toBe(res.id);

    // Source untouched.
    const src = (await ctx.repos.spaces.get(tenantId, "space_src"))!;
    expect(src["status"]).toBe("published");
  });

  it("copies ALL items across pagination pages (no single-page truncation)", async () => {
    const ctx = makeAuthContext("teacher");
    const tenantId = await seedSpace(ctx, 250); // > one 200-item page

    const res = (await duplicateSpaceService({ spaceId: "space_src" }, ctx)) as { id: string };
    const items = await ctx.repos.items.list(tenantId, { where: { spaceId: res.id }, limit: 500 });
    expect(items.items.length).toBe(250);
  });
});
