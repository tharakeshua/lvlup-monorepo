import { describe, expect, it } from "vitest";
import {
  SaveItemRequestSchema,
  SaveSpaceRequestSchema,
  SaveStoryPointRequestSchema,
} from "../callables/levelup/index.js";

const RUBRIC = {
  scoringMode: "holistic",
  holisticGuidance: "Reward clear reasoning.",
  holisticMaxScore: 10,
};

describe("Space authoring mutation contracts", () => {
  it("supports inline rubric snapshots and item attachment persistence", () => {
    expect(
      SaveSpaceRequestSchema.safeParse({
        data: { title: "Physics", type: "learning", defaultRubric: RUBRIC },
      }).success
    ).toBe(true);
    expect(
      SaveStoryPointRequestSchema.safeParse({
        spaceId: "space_1",
        data: { title: "Motion", type: "standard", defaultRubric: RUBRIC },
      }).success
    ).toBe(true);
    expect(
      SaveItemRequestSchema.safeParse({
        spaceId: "space_1",
        storyPointId: "sp_1",
        data: {
          type: "material",
          payload: { type: "material", materialData: { materialType: "pdf", url: "gs://doc" } },
          rubric: RUBRIC,
          attachments: [{ type: "pdf", url: "gs://attachment", sizeBytes: 1024 }],
        },
      }).success
    ).toBe(true);
  });

  it("supports partial reorder, move, and soft-delete commands", () => {
    expect(
      SaveStoryPointRequestSchema.safeParse({
        id: "sp_1",
        spaceId: "space_1",
        data: { orderIndex: 2 },
      }).success
    ).toBe(true);
    expect(
      SaveItemRequestSchema.safeParse({
        id: "item_1",
        spaceId: "space_1",
        storyPointId: "sp_2",
        data: { orderIndex: 3 },
      }).success
    ).toBe(true);
    expect(
      SaveItemRequestSchema.safeParse({
        id: "item_1",
        spaceId: "space_1",
        storyPointId: "sp_1",
        data: { deleted: true },
      }).success
    ).toBe(true);
  });

  it("rejects type/payload mismatches and non-canonical assessment aliases", () => {
    expect(
      SaveItemRequestSchema.safeParse({
        spaceId: "space_1",
        storyPointId: "sp_1",
        data: {
          type: "question",
          payload: { type: "checkpoint", message: "done" },
        },
      }).success
    ).toBe(false);
    expect(
      SaveStoryPointRequestSchema.safeParse({
        spaceId: "space_1",
        data: {
          title: "Quiz",
          type: "quiz",
          assessmentConfig: { shuffleQuestions: true },
        },
      }).success
    ).toBe(false);
  });
});
