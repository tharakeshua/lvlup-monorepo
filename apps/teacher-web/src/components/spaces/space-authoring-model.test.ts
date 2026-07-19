import { describe, expect, it } from "vitest";
import {
  SPACE_TEMPLATES,
  getPublishReadiness,
  getReadinessProgress,
} from "./space-authoring-model";

const readySpace = {
  title: "Fractions in context",
  description: "Use models and real-world examples to reason about fractions.",
  accessType: "class_assigned" as const,
  publishedToStore: false,
  thumbnailUrl: undefined,
  storeDescription: undefined,
  storeThumbnailUrl: undefined,
};

describe("space authoring model", () => {
  it("provides distinct templates with canonical starter story-point types", () => {
    expect(SPACE_TEMPLATES.map((template) => template.id)).toEqual([
      "blank",
      "guided-course",
      "practice-set",
      "assessment",
    ]);
    expect(
      SPACE_TEMPLATES.flatMap((template) =>
        template.starterStoryPoints.map((storyPoint) => storyPoint.type)
      )
    ).not.toContain("test");
  });

  it("reports a fully ready private space", () => {
    const readiness = getPublishReadiness(
      readySpace,
      [
        {
          id: "sp_1",
          title: "Model fractions",
          assessmentConfig: undefined,
        },
      ],
      { sp_1: 3 }
    );

    expect(readiness.every((item) => item.ready)).toBe(true);
    expect(getReadinessProgress(readiness)).toBe(100);
  });

  it("keeps loading counts distinct from genuinely empty content", () => {
    const loading = getPublishReadiness(
      readySpace,
      [{ id: "sp_1", title: "Model fractions", assessmentConfig: undefined }],
      {}
    );
    const empty = getPublishReadiness(
      readySpace,
      [{ id: "sp_1", title: "Model fractions", assessmentConfig: undefined }],
      { sp_1: 0 }
    );

    expect(loading.find((item) => item.id === "content")).toMatchObject({
      ready: false,
      description: "Checking content readiness…",
    });
    expect(empty.find((item) => item.id === "content")?.description).toContain("Add content to");
  });

  it("requires complete metadata for an opted-in store listing", () => {
    const readiness = getPublishReadiness(
      {
        ...readySpace,
        accessType: "tenant_wide",
        publishedToStore: true,
      },
      [{ id: "sp_1", title: "Model fractions", assessmentConfig: undefined }],
      { sp_1: 2 }
    );

    expect(readiness.find((item) => item.id === "store")).toMatchObject({
      ready: false,
      tab: "settings",
    });
  });

  it("flags an assessment schedule that closes before it opens", () => {
    const readiness = getPublishReadiness(
      readySpace,
      [
        {
          id: "sp_1",
          title: "Checkpoint",
          assessmentConfig: {
            schedule: {
              opensAt: "2026-08-10T10:00:00.000Z",
              closesAt: "2026-08-10T09:00:00.000Z",
            },
          },
        },
      ],
      { sp_1: 4 }
    );

    expect(readiness.find((item) => item.id === "schedule")?.ready).toBe(false);
  });
});
