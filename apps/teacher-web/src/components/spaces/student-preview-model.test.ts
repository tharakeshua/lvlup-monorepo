import { describe, expect, it } from "vitest";
import type { UnifiedItem } from "@levelup/shared-types";
import {
  MATERIAL_PREVIEW_TYPES,
  QUESTION_PREVIEW_TYPES,
  buildPreviewSessionSummary,
  isSupportedPreviewItem,
  validatePreviewItem,
} from "./student-preview-model";

const item = (type: "question" | "material", subtype: string): UnifiedItem =>
  ({
    id: `${type}-${subtype}`,
    type,
    content: "Prompt",
    payload:
      type === "question"
        ? { questionType: subtype, content: "Prompt", questionData: {} }
        : { materialType: subtype, content: "Material", url: "https://example.com" },
  }) as UnifiedItem;

describe("student preview parity", () => {
  it("recognizes every canonical question and material type", () => {
    expect(QUESTION_PREVIEW_TYPES).toHaveLength(15);
    expect(MATERIAL_PREVIEW_TYPES).toHaveLength(7);
    for (const type of QUESTION_PREVIEW_TYPES)
      expect(isSupportedPreviewItem(item("question", type))).toBe(true);
    for (const type of MATERIAL_PREVIEW_TYPES)
      expect(isSupportedPreviewItem(item("material", type))).toBe(true);
  });

  it("reports authoring-only validation without blocking playback", () => {
    const invalid = item("question", "mcq");
    (invalid.payload as Record<string, unknown>).questionData = { options: [] };
    expect(validatePreviewItem(invalid)).toContain("Add at least two answer options.");
  });

  it("summarizes only question answers while materials remain paginated content", () => {
    const items = [item("material", "text"), item("question", "text"), item("question", "mcq")];
    expect(
      buildPreviewSessionSummary(items, { "question-text": "Ada" }, new Set(["question-mcq"]))
    ).toEqual({
      answered: 1,
      unanswered: 1,
      markedForReview: 1,
    });
  });
});
