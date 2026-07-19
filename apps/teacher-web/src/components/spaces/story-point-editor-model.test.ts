import { describe, expect, it } from "vitest";
import type { StoryPoint } from "@levelup/domain";
import {
  fromLocalDateTimeValue,
  hasStoryPointErrors,
  normalizeAssessmentConfig,
  normalizeSections,
  normalizeStoryPointType,
  reorderSections,
  toLocalDateTimeValue,
  validateStoryPointDraft,
} from "./story-point-editor-model";

describe("story point editor model", () => {
  it("normalizes legacy assessment fields without losing schedule or adaptive behavior", () => {
    const normalized = normalizeAssessmentConfig({
      shuffleQuestions: true,
      schedule: {
        startAt: { seconds: 1_800_000_000 },
        endAt: { _seconds: 1_800_003_600 },
      },
      adaptiveConfig: {
        enabled: true,
        initialDifficulty: "hard",
        minQuestionsPerDifficulty: 4,
        maxConsecutiveSameDifficulty: 2,
      },
    });

    expect(normalized.shuffle).toBe(true);
    expect(normalized.schedule).toEqual({
      opensAt: "2027-01-15T08:00:00.000Z",
      closesAt: "2027-01-15T09:00:00.000Z",
    });
    expect(normalized.adaptiveConfig).toEqual({
      enabled: true,
      startingDifficulty: "hard",
      stepUpThreshold: 4,
      stepDownThreshold: 2,
    });
  });

  it("keeps datetime-local values in the user's local wall-clock time", () => {
    const iso = fromLocalDateTimeValue("2027-01-15T09:30");
    expect(toLocalDateTimeValue(iso)).toBe("2027-01-15T09:30");
  });

  it("prefers explicit canonical null schedule bounds over stale legacy aliases", () => {
    expect(
      normalizeAssessmentConfig({
        schedule: {
          opensAt: null,
          closesAt: null,
          startAt: { seconds: 1_800_000_000 },
          endAt: { seconds: 1_800_003_600 },
        },
      }).schedule
    ).toEqual({ opensAt: null, closesAt: null });
  });

  it("reindexes sections after keyboard or pointer reordering", () => {
    const sections = normalizeSections([
      { id: "a", title: "Explore", orderIndex: 8 },
      { id: "b", title: "Practice", orderIndex: 2 },
      { id: "c", title: "Reflect", orderIndex: 2 },
    ] as never);

    expect(reorderSections(sections, 2, 0).map(({ id, orderIndex }) => [id, orderIndex])).toEqual([
      ["c", 0],
      ["a", 1],
      ["b", 2],
    ]);
  });

  it("reports invalid schedules and duplicate or empty section titles", () => {
    const draft = {
      title: "  ",
      sections: [
        { id: "a", title: "Practice", orderIndex: 0 },
        { id: "b", title: " practice ", orderIndex: 1 },
        { id: "c", title: "", orderIndex: 2 },
      ],
      assessmentConfig: {
        schedule: {
          opensAt: "2027-01-15T10:00:00.000Z",
          closesAt: "2027-01-15T09:00:00.000Z",
        },
      },
    } as StoryPoint;
    const errors = validateStoryPointDraft(draft);

    expect(hasStoryPointErrors(errors)).toBe(true);
    expect(errors.title).toMatch(/title/i);
    expect(errors.schedule).toMatch(/later/i);
    expect(errors.sections).toMatchObject({
      b: expect.stringMatching(/unique/i),
      c: expect.stringMatching(/empty/i),
    });
  });

  it("maps the removed test alias to the canonical timed test type", () => {
    expect(normalizeStoryPointType("test")).toBe("timed_test");
  });
});
