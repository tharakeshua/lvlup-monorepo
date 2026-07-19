import { describe, expect, it } from "vitest";
import { CALLABLES } from "@levelup/api-contract";
import type { ItemPayload, UnifiedItem } from "@levelup/domain";
import { MATERIAL_TYPES, QUESTION_TYPES, validateItem } from "./item-authoring-model";
import { toItemEditorModel, toSaveItemData, type ItemEditView } from "./item-editor-contract";

const timestamp = "2026-07-18T10:00:00.000Z";

function itemWithPayload(payload: ItemPayload): ItemEditView {
  return {
    id: `item_${payload.type}`,
    tenantId: "tenant_1",
    spaceId: "space_1",
    storyPointId: "story_point_1",
    type: payload.type,
    title: `${payload.type} fixture`,
    content: payload.type === "question" ? "Fixture question prompt" : undefined,
    orderIndex: 0,
    payload,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: "teacher_1",
    updatedBy: "teacher_1",
    archivedAt: null,
  } as UnifiedItem;
}

function normalize(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

const questionCases: Array<{
  type: (typeof QUESTION_TYPES)[number]["value"];
  questionData: Extract<ItemPayload, { type: "question" }>["questionData"];
}> = [
  {
    type: "mcq",
    questionData: {
      questionType: "mcq",
      options: [
        {
          id: "a",
          text: "Alpha",
          imageUrl: "https://example.com/a.png",
          explanation: "Correct",
          isCorrect: true,
        },
        { id: "b", text: "Beta", isCorrect: false },
      ],
      shuffleOptions: true,
    },
  },
  {
    type: "mcaq",
    questionData: {
      questionType: "mcaq",
      options: [
        { id: "a", text: "Alpha", isCorrect: true },
        { id: "b", text: "Beta", isCorrect: true },
        { id: "c", text: "Gamma", isCorrect: false },
      ],
      shuffleOptions: true,
      minSelections: 1,
      maxSelections: 2,
    },
  },
  {
    type: "true-false",
    questionData: {
      questionType: "true-false",
      correctAnswer: false,
      explanation: "The statement is false.",
    },
  },
  {
    type: "numerical",
    questionData: {
      questionType: "numerical",
      correctAnswer: 42.25,
      tolerance: 0.01,
      unit: "kg",
      decimalPlaces: 2,
    },
  },
  {
    type: "text",
    questionData: {
      questionType: "text",
      modelAnswer: "TypeScript",
      acceptableAnswers: ["TS"],
      caseSensitive: false,
      maxLength: 80,
    },
  },
  {
    type: "paragraph",
    questionData: {
      questionType: "paragraph",
      minWords: 40,
      maxWords: 400,
      modelAnswer: "A complete model answer.",
      evaluationGuidance: "Reward a justified comparison.",
    },
  },
  {
    type: "code",
    questionData: {
      questionType: "code",
      language: "typescript",
      starterCode: "export function add() {}",
      modelAnswer: "export const add = (a: number, b: number) => a + b;",
      testCases: [{ input: "1 2", output: "3" }],
    },
  },
  {
    type: "fill-blanks",
    questionData: {
      questionType: "fill-blanks",
      template: "The ___1___ is blue.",
      blanks: [
        {
          id: "blank_1",
          correctAnswer: "sky",
          acceptableAnswers: ["Sky"],
        },
      ],
    },
  },
  {
    type: "fill-blanks-dd",
    questionData: {
      questionType: "fill-blanks-dd",
      template: "Water is ___1___.",
      blanks: [{ id: "blank_1", correctAnswer: "wet" }],
      optionPool: ["wet", "dry"],
    },
  },
  {
    type: "matching",
    questionData: {
      questionType: "matching",
      pairs: [
        { left: "Redis", right: "Cache" },
        { left: "PostgreSQL", right: "Relational database" },
      ],
      shufflePairs: true,
    },
  },
  {
    type: "jumbled",
    questionData: {
      questionType: "jumbled",
      tokens: ["First", "Second", "Third"],
      correctOrder: [1, 0, 2],
    },
  },
  {
    type: "audio",
    questionData: {
      questionType: "audio",
      promptAudioUrl: "https://example.com/prompt.mp3",
      maxDurationSeconds: 90,
      language: "en",
      modelAnswer: "Expected spoken response",
      evaluationGuidance: "Check clarity and accuracy.",
    },
  },
  {
    type: "image_evaluation",
    questionData: {
      questionType: "image_evaluation",
      referenceImageUrls: ["https://example.com/reference.png"],
      instructions: "Upload a labelled circuit diagram.",
      maxImages: 3,
      modelAnswer: "A correctly labelled series circuit.",
      evaluationGuidance: "Check all labels and connections.",
    },
  },
  {
    type: "group-options",
    questionData: {
      questionType: "group-options",
      groups: ["Mammal", "Bird"],
      items: [
        { id: "whale", text: "Whale", group: "Mammal" },
        { id: "eagle", text: "Eagle", group: "Bird" },
      ],
    },
  },
  {
    type: "chat_agent_question",
    questionData: {
      questionType: "chat_agent_question",
      scenario: "Discuss one system-design trade-off.",
      publicLearningObjectives: [{ id: "tradeoff", label: "Explain a trade-off" }],
      conversationStarters: ["What would you optimize first?"],
      interviewerAgentId: "agent_interviewer_1",
      completionPolicy: {
        minLearnerTurns: 2,
        maxLearnerTurns: 6,
        allowEarlyFinish: true,
        hardLimitAction: "auto_finalize",
      },
    },
  },
];

const materialCases: Array<{
  type: (typeof MATERIAL_TYPES)[number]["value"];
  materialData: Extract<ItemPayload, { type: "material" }>["materialData"];
}> = [
  { type: "text", materialData: { materialType: "text", body: "Lesson body" } },
  {
    type: "video",
    materialData: {
      materialType: "video",
      url: "https://example.com/lesson.mp4",
      durationSeconds: 120,
    },
  },
  {
    type: "pdf",
    materialData: { materialType: "pdf", url: "https://example.com/lesson.pdf" },
  },
  {
    type: "link",
    materialData: {
      materialType: "link",
      url: "https://example.com/resource",
      label: "Open resource",
    },
  },
  {
    type: "interactive",
    materialData: {
      materialType: "interactive",
      embedUrl: "https://example.com/simulation",
    },
  },
  {
    type: "story",
    materialData: {
      materialType: "story",
      slides: [
        { title: "Beginning", body: "Once upon a time" },
        { title: "Ending", body: "The end" },
      ],
    },
  },
  {
    type: "rich",
    materialData: {
      materialType: "rich",
      title: "Rich lesson",
      subtitle: "A structured guide",
      coverImage: "https://example.com/cover.png",
      tags: ["science", "intro"],
      author: { name: "Teacher", avatar: "https://example.com/avatar.png", bio: "Educator" },
      readingTime: 8,
      blocks: [
        { id: "heading_1", type: "heading", content: "Overview", metadata: { level: 2 } },
        { id: "body_1", type: "paragraph", content: "Lesson content" },
      ],
    },
  },
];

describe("all canonical teacher item types", () => {
  it("keeps the regression matrix aligned with the registries", () => {
    expect(questionCases.map(({ type }) => type)).toEqual(QUESTION_TYPES.map(({ value }) => value));
    expect(materialCases.map(({ type }) => type)).toEqual(MATERIAL_TYPES.map(({ value }) => value));
  });

  it.each(questionCases)(
    "creates, reopens, validates, and saves $type questions",
    ({ questionData }) => {
      const original: ItemPayload = {
        type: "question",
        basePoints: 15,
        explanation: "Feedback after submission",
        questionData,
      };
      const editor = toItemEditorModel(itemWithPayload(original));
      const validation = validateItem({
        title: editor.title ?? "",
        content: editor.content,
        isQuestion: true,
        payload: editor.payload,
        attachments: editor.attachments ?? [],
      });
      // The matrix fixture intentionally contains only public ItemPayload data;
      // chat private objectives live in the separate authoring answer key and
      // are covered by item-editor-contract.test.ts.
      if (questionData.questionType === "chat_agent_question") {
        expect(validation).toEqual(["Add at least one private evaluation objective"]);
      } else {
        expect(validation).toEqual([]);
      }

      const request = {
        id: editor.id,
        spaceId: editor.spaceId,
        storyPointId: editor.storyPointId,
        data: toSaveItemData(editor),
      };
      const parsed = CALLABLES["v1.levelup.saveItem"].requestSchema.parse(request);
      expect(normalize(parsed.data.payload)).toEqual(normalize(original));
    }
  );

  it.each(materialCases)(
    "creates, reopens, validates, and saves $type materials",
    ({ materialData }) => {
      const original: ItemPayload = { type: "material", materialData };
      const editor = toItemEditorModel(itemWithPayload(original));
      expect(
        validateItem({
          title: editor.title ?? "",
          content: editor.content,
          isQuestion: false,
          payload: editor.payload,
          attachments: editor.attachments ?? [],
        })
      ).toEqual([]);

      const request = {
        id: editor.id,
        spaceId: editor.spaceId,
        storyPointId: editor.storyPointId,
        data: toSaveItemData(editor),
      };
      const parsed = CALLABLES["v1.levelup.saveItem"].requestSchema.parse(request);
      expect(normalize(parsed.data.payload)).toEqual(normalize(original));
    }
  );

  it("persists attachment storage identity across reopen and save", () => {
    const original = itemWithPayload({
      type: "material",
      materialData: { materialType: "pdf", url: "https://example.com/lesson.pdf" },
    });
    original.attachments = [
      {
        id: "asset_1",
        name: "lesson.pdf",
        url: "https://cdn.example.com/lesson.pdf",
        type: "file",
        mimeType: "application/pdf",
        sizeBytes: 4096,
      },
    ];

    const saved = toSaveItemData(toItemEditorModel(original));
    expect(saved.attachments).toEqual(original.attachments);
  });
});
