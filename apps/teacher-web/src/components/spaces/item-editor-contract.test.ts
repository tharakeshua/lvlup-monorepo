import { describe, expect, it } from "vitest";
import { CALLABLES } from "@levelup/api-contract";
import type { AnswerKey, UnifiedItem } from "@levelup/domain";
import { toItemEditorModel, toSaveItemData, type ItemEditView } from "./item-editor-contract";

const now = "2026-07-18T10:00:00.000Z";

function canonicalQuestion(): UnifiedItem {
  return {
    id: "item_1",
    tenantId: "tenant_1",
    spaceId: "space_1",
    storyPointId: "story_point_1",
    type: "question",
    title: "Capital of France",
    content: "What is the capital of France?",
    orderIndex: 0,
    payload: {
      type: "question",
      basePoints: 10,
      questionData: {
        questionType: "mcq",
        options: [
          { id: "paris", text: "Paris" },
          { id: "rome", text: "Rome" },
        ],
      },
    },
    createdAt: now,
    updatedAt: now,
    createdBy: "teacher_1",
    updatedBy: "teacher_1",
    archivedAt: null,
  } as UnifiedItem;
}

function answerKey(): AnswerKey {
  return {
    id: "answer_key_1",
    itemId: "item_1",
    questionType: "mcq",
    correctAnswer: ["paris"],
    createdAt: now,
    updatedAt: now,
  } as AnswerKey;
}

describe("teacher item editor canonical boundary", () => {
  it("re-hydrates the protected answer key for the form and emits a strict saveItem request", () => {
    const editor = toItemEditorModel({
      ...canonicalQuestion(),
      answerKey: answerKey(),
    } as ItemEditView);

    const options = (
      editor.payload as {
        questionData: { options: Array<{ id: string; isCorrect?: boolean }> };
      }
    ).questionData.options;
    expect(options.find((option) => option.id === "paris")?.isCorrect).toBe(true);
    expect(options.find((option) => option.id === "rome")?.isCorrect).toBe(false);

    const request = {
      id: editor.id,
      spaceId: editor.spaceId,
      storyPointId: editor.storyPointId,
      data: toSaveItemData(editor),
    };
    const parsed = CALLABLES["v1.levelup.saveItem"].requestSchema.safeParse(request);
    expect(parsed.error).toBeUndefined();
    expect(request.data.payload).toMatchObject({
      type: "question",
      questionData: { questionType: "mcq" },
    });
  });

  it("adapts material form fields to the canonical nested materialData union", () => {
    const canonical: UnifiedItem = {
      ...canonicalQuestion(),
      type: "material",
      payload: {
        type: "material",
        materialData: {
          materialType: "video",
          url: "https://example.com/lesson",
          durationSeconds: 90,
        },
      },
    } as UnifiedItem;
    const editor = toItemEditorModel(canonical as ItemEditView);
    const request = {
      id: editor.id,
      spaceId: editor.spaceId,
      storyPointId: editor.storyPointId,
      data: toSaveItemData(editor),
    };

    const parsed = CALLABLES["v1.levelup.saveItem"].requestSchema.safeParse(request);
    expect(parsed.error).toBeUndefined();
    expect(request.data.payload).toEqual({
      type: "material",
      materialData: {
        materialType: "video",
        url: "https://example.com/lesson",
        durationSeconds: 90,
      },
    });
  });

  it("round-trips chat assessment public data without leaking its private answer key", () => {
    const canonical: UnifiedItem = {
      ...canonicalQuestion(),
      id: "item_chat_1",
      title: "Interview a systems candidate",
      meta: { evaluatorAgentId: "agent_evaluator_1" },
      rubricId: "rubric_1",
      rubric: {
        scoringMode: "dimension_based",
        dimensions: [
          { id: "reasoning", name: "Reasoning", priority: "HIGH", weight: 1, scoringScale: 5 },
        ],
      },
      payload: {
        type: "question",
        basePoints: 10,
        questionData: {
          questionType: "chat_agent_question",
          scenario: "Discuss cache invalidation trade-offs with the learner.",
          publicLearningObjectives: [{ id: "tradeoffs", label: "Explain a cache trade-off" }],
          conversationStarters: ["What would you cache first?"],
          interviewerAgentId: "agent_interviewer_1",
          completionPolicy: {
            minLearnerTurns: 3,
            maxLearnerTurns: 6,
            allowEarlyFinish: true,
            hardLimitAction: "auto_finalize",
          },
        },
      },
    } as UnifiedItem;
    const privateKey: AnswerKey = {
      id: "item_chat_1",
      itemId: "item_chat_1",
      questionType: "chat_agent_question",
      correctAnswer: undefined,
      modelAnswer: "A strong answer weighs correctness against freshness and cost.",
      evaluationGuidance: "Look for explicit trade-offs and a justified choice.",
      privateEvaluationObjectives: [
        {
          id: "evidence_tradeoffs",
          rubricDimensionId: "reasoning",
          description: "Cites a concrete invalidation trade-off.",
          evidenceRequirement: "At least one concrete example",
        },
      ],
      createdAt: now,
      updatedAt: now,
    } as AnswerKey;

    const editor = toItemEditorModel({ ...canonical, answerKey: privateKey } as ItemEditView);
    const authoringData = (editor.payload as { questionData: Record<string, unknown> })
      .questionData;
    expect(authoringData).toMatchObject({
      scenario: "Discuss cache invalidation trade-offs with the learner.",
      publicLearningObjectives: [{ id: "tradeoffs", label: "Explain a cache trade-off" }],
      interviewerAgentId: "agent_interviewer_1",
      privateEvaluationObjectives: [{ id: "evidence_tradeoffs", rubricDimensionId: "reasoning" }],
    });

    const request = {
      id: editor.id,
      spaceId: editor.spaceId,
      storyPointId: editor.storyPointId,
      data: toSaveItemData(editor),
    };
    const parsed = CALLABLES["v1.levelup.saveItem"].requestSchema.safeParse(request);
    expect(parsed.error).toBeUndefined();
    const publicQuestionData = (
      request.data.payload as { type: "question"; questionData: Record<string, unknown> }
    ).questionData;
    expect(publicQuestionData).toMatchObject({
      questionType: "chat_agent_question",
      scenario: "Discuss cache invalidation trade-offs with the learner.",
      interviewerAgentId: "agent_interviewer_1",
    });
    expect(publicQuestionData).not.toHaveProperty("modelAnswer");
    expect(publicQuestionData).not.toHaveProperty("privateEvaluationObjectives");
    expect(request.data.answerKey).toMatchObject({
      questionType: "chat_agent_question",
      privateEvaluationObjectives: [{ rubricDimensionId: "reasoning" }],
    });
    expect(request.data.meta).toEqual({ evaluatorAgentId: "agent_evaluator_1" });
    expect(request.data.rubricId).toBe("rubric_1");
    expect(request.data.rubric).toMatchObject({
      dimensions: [{ id: "reasoning" }],
    });
  });
});
