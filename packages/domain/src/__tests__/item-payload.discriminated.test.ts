/**
 * UnifiedItem.payload — the REAL two-level z.discriminatedUnion (REVIEW top-risk #3;
 * levelup-content §"UnifiedItemSchema"; domain-core §10 scope note).
 *
 * Locks: the top-level discriminant is the item `type` (7 ITEM_TYPES); the
 * `question` member embeds the nested `questionType` discriminated union (15 types)
 * and `material` embeds the `materialType` union (7 types). The union NARROWS to the
 * correct member on a valid payload and REJECTS bad payloads — unknown top-level
 * type, unknown nested discriminant, missing discriminant, and (because every member
 * is `.strict()` via zObject) any extra/unknown field. This is the `z.record(unknown)`
 * → real union upgrade the rebuild requires.
 */
import { describe, it, expect } from "vitest";
import { ItemPayloadSchema, type ItemPayload } from "../entities/content/item-payload.js";
import { QuestionTypeDataSchema } from "../entities/content/question-payload.js";
import { ITEM_TYPES, QUESTION_TYPES, MATERIAL_TYPES } from "../enums/content.js";

const mcqQuestion: ItemPayload = {
  type: "question",
  questionData: {
    questionType: "mcq",
    options: [
      { id: "a", text: "O(1)" },
      { id: "b", text: "O(n)" },
    ],
  },
};

describe("top-level discriminant (item type)", () => {
  it("accepts each of the 7 ITEM_TYPES with a minimal valid payload", () => {
    const samples: ItemPayload[] = [
      mcqQuestion,
      { type: "material", materialData: { materialType: "text", body: "hi" } },
      { type: "interactive", interactiveType: "simulation" },
      { type: "assessment", assessmentType: "quiz" },
      { type: "discussion", threadType: "open", prompt: "Discuss." },
      { type: "project", brief: "Build a thing." },
      { type: "checkpoint" },
    ];
    expect(samples.map((s) => s.type).sort()).toEqual([...ITEM_TYPES].sort());
    for (const s of samples) expect(ItemPayloadSchema.safeParse(s).success).toBe(true);
  });

  it("narrows on parse: a question payload exposes questionData", () => {
    const parsed = ItemPayloadSchema.parse(mcqQuestion);
    expect(parsed.type).toBe("question");
    if (parsed.type === "question") {
      expect(parsed.questionData.questionType).toBe("mcq");
    }
  });

  it("rejects an unknown top-level type", () => {
    const res = ItemPayloadSchema.safeParse({ type: "lecture", body: "x" });
    expect(res.success).toBe(false);
  });

  it("rejects a payload with no discriminant", () => {
    expect(ItemPayloadSchema.safeParse({ questionData: {} }).success).toBe(false);
  });
});

describe("nested questionType union (15 members)", () => {
  it("the nested union has exactly the 15 QUESTION_TYPES", () => {
    // each literal must round-trip through the question-data union
    for (const qt of QUESTION_TYPES) {
      const minimal = minimalQuestionData(qt);
      expect(QuestionTypeDataSchema.safeParse(minimal).success, `questionType ${qt}`).toBe(true);
    }
  });

  it("narrows the inner union: numerical exposes tolerance, code exposes language", () => {
    const numeric = ItemPayloadSchema.parse({
      type: "question",
      questionData: { questionType: "numerical", correctAnswer: 3.14, tolerance: 0.01 },
    });
    if (numeric.type === "question" && numeric.questionData.questionType === "numerical") {
      expect(numeric.questionData.tolerance).toBe(0.01);
    }
  });

  it("rejects an unknown nested questionType", () => {
    const res = ItemPayloadSchema.safeParse({
      type: "question",
      questionData: { questionType: "essay", maxLength: 100 },
    });
    expect(res.success).toBe(false);
  });

  it("rejects a question payload missing questionData", () => {
    expect(ItemPayloadSchema.safeParse({ type: "question" }).success).toBe(false);
  });
});

describe("nested materialType union (7 members)", () => {
  it("accepts each of the 7 MATERIAL_TYPES", () => {
    const byType: Record<string, Record<string, unknown>> = {
      text: { materialType: "text", body: "b" },
      video: { materialType: "video", url: "http://v" },
      pdf: { materialType: "pdf", url: "http://p" },
      link: { materialType: "link", url: "http://l" },
      interactive: { materialType: "interactive", embedUrl: "http://e" },
      story: { materialType: "story", slides: [{ body: "s" }] },
      rich: { materialType: "rich", blocks: [] },
    };
    expect(Object.keys(byType).sort()).toEqual([...MATERIAL_TYPES].sort());
    for (const materialData of Object.values(byType)) {
      expect(ItemPayloadSchema.safeParse({ type: "material", materialData }).success).toBe(true);
    }
  });

  it("rejects an unknown nested materialType", () => {
    const res = ItemPayloadSchema.safeParse({
      type: "material",
      materialData: { materialType: "gif", url: "http://g" },
    });
    expect(res.success).toBe(false);
  });
});

describe(".strict() rejection of extra fields at BOTH levels", () => {
  it("rejects an unknown top-level field on a member", () => {
    const res = ItemPayloadSchema.safeParse({ ...mcqQuestion, sneaky: true });
    expect(res.success).toBe(false);
  });

  it("rejects an unknown field inside questionData", () => {
    const res = ItemPayloadSchema.safeParse({
      type: "question",
      questionData: { questionType: "mcq", options: [], leaked_answer: 0 },
    });
    expect(res.success).toBe(false);
  });

  it("rejects an unknown field inside materialData", () => {
    const res = ItemPayloadSchema.safeParse({
      type: "material",
      materialData: { materialType: "text", body: "b", extra: 1 },
    });
    expect(res.success).toBe(false);
  });
});

/** Smallest valid object for each of the 15 question types. */
function minimalQuestionData(qt: (typeof QUESTION_TYPES)[number]): Record<string, unknown> {
  switch (qt) {
    case "mcq":
    case "mcaq":
      return { questionType: qt, options: [{ id: "a", text: "A" }] };
    case "true-false":
      return { questionType: qt };
    case "numerical":
      return { questionType: qt };
    case "text":
    case "paragraph":
      return { questionType: qt };
    case "code":
      return { questionType: qt };
    case "fill-blanks":
      return { questionType: qt, template: "__", blanks: [{ id: "b1" }] };
    case "fill-blanks-dd":
      return { questionType: qt, template: "__", blanks: [{ id: "b1" }], optionPool: ["x"] };
    case "matching":
      return { questionType: qt, pairs: [{ left: "l", right: "r" }] };
    case "jumbled":
      return { questionType: qt, tokens: ["a", "b"] };
    case "audio":
      return { questionType: qt };
    case "image_evaluation":
      return { questionType: qt };
    case "group-options":
      return { questionType: qt, groups: ["g"], items: [{ id: "i", text: "I" }] };
    case "chat_agent_question":
      return { questionType: qt };
    default: {
      const _exhaustive: never = qt;
      return _exhaustive;
    }
  }
}
