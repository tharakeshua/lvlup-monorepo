import { describe, expect, it } from "vitest";
import {
  AssessmentConfigSchema,
  AssessmentScheduleSchema,
  ItemAttachmentSchema,
  ItemPayloadSchema,
  SpaceStatsSchema,
  StoryPointStatsSchema,
} from "../index.js";

const EARLY = "2026-01-01T00:00:00.000Z";
const LATE = "2026-01-02T00:00:00.000Z";

describe("Space content canonical boundary", () => {
  it("uses canonical nested schedule, shuffle, and adaptive fields", () => {
    expect(
      AssessmentConfigSchema.safeParse({
        durationMinutes: 30,
        maxAttempts: 2,
        shuffle: true,
        passingPercentage: 70,
        schedule: { opensAt: EARLY, closesAt: LATE },
        adaptiveConfig: {
          enabled: true,
          startingDifficulty: "medium",
          stepUpThreshold: 2,
          stepDownThreshold: 2,
        },
      }).success
    ).toBe(true);

    expect(
      AssessmentConfigSchema.safeParse({
        shuffleQuestions: true,
        adaptive: true,
      }).success
    ).toBe(false);
    expect(AssessmentScheduleSchema.safeParse({ opensAt: LATE, closesAt: EARLY }).success).toBe(
      false
    );
  });

  it("rejects negative server-owned stats and attachment sizes", () => {
    expect(SpaceStatsSchema.safeParse({ itemCount: -1 }).success).toBe(false);
    expect(StoryPointStatsSchema.safeParse({ completionCount: -1 }).success).toBe(false);
    expect(ItemAttachmentSchema.safeParse({ type: "pdf", url: "", sizeBytes: -1 }).success).toBe(
      false
    );
    expect(
      ItemAttachmentSchema.safeParse({
        id: "attachment_1",
        type: "pdf",
        url: "gs://document",
        mimeType: "application/pdf",
        sizeBytes: 10,
      }).success
    ).toBe(true);
  });

  it("persists supported editor metadata without widening the strict boundary", () => {
    expect(
      ItemPayloadSchema.safeParse({
        type: "question",
        explanation: "Shown after answering",
        questionData: {
          questionType: "image_evaluation",
          instructions: "Upload your working",
          maxImages: 3,
          evaluationGuidance: "Check the diagram labels",
        },
      }).success
    ).toBe(true);
    expect(
      ItemPayloadSchema.safeParse({
        type: "material",
        materialData: {
          materialType: "rich",
          blocks: [{ type: "paragraph", metadata: { emphasis: true } }],
          title: "Worked example",
          tags: ["mechanics"],
        },
      }).success
    ).toBe(true);
  });
});
