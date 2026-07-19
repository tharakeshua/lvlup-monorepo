import { describe, expect, it } from "vitest";
import type { StoryPoint } from "@levelup/domain";
import {
  createStoryPointDuplicatePlan,
  remapSectionIdForDuplicate,
  reorderStoryPoints,
} from "./story-point-structure";

function storyPoint(id: string, orderIndex: number, title = id): StoryPoint {
  return { id, orderIndex, title, sections: [] } as StoryPoint;
}

describe("story point structure operations", () => {
  it("reorders and rewrites every orderIndex for reliable repeated moves", () => {
    const reordered = reorderStoryPoints(
      [storyPoint("a", 7), storyPoint("b", 7), storyPoint("c", 2)],
      2,
      0
    );
    expect(reordered.map(({ id, orderIndex }) => [id, orderIndex])).toEqual([
      ["c", 0],
      ["a", 1],
      ["b", 2],
    ]);
  });

  it("duplicates story-point configuration with fresh ordered section ids", () => {
    const source = {
      ...storyPoint("source", 0, "Fractions"),
      type: "quiz",
      sections: [
        { id: "practice", title: "Practice", orderIndex: 4 },
        { id: "intro", title: "Introduction", orderIndex: 1 },
      ],
      assessmentConfig: {
        shuffle: true,
        schedule: { opensAt: null, closesAt: null },
      },
    } as StoryPoint;
    const plan = createStoryPointDuplicatePlan(source, 3, (section) => `new_${section.id}`);

    expect(plan.data).toMatchObject({
      title: "Fractions copy",
      orderIndex: 3,
      type: "quiz",
      assessmentConfig: { shuffle: true },
      sections: [
        { id: "new_intro", orderIndex: 0 },
        { id: "new_practice", orderIndex: 1 },
      ],
    });
    expect(remapSectionIdForDuplicate("intro", plan.sectionIdMap)).toBe("new_intro");
    expect(remapSectionIdForDuplicate("legacy-missing", plan.sectionIdMap)).toBeUndefined();
  });
});
