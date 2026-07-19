import { describe, expect, it } from "vitest";
import { makeAuthContext } from "../../../../tests/sdk/harness/auth-context";
import {
  getItemForEditService,
  listItemsService,
  saveItemService,
  saveSpaceService,
  saveStoryPointService,
} from "./content";

const RUBRIC = {
  scoringMode: "holistic",
  holisticGuidance: "Reward clear reasoning.",
  holisticMaxScore: 10,
  modelAnswer: "A complete answer weighs both sides.",
  evaluatorGuidance: "Reward explicit trade-off reasoning.",
};

describe("canonical Space authoring services", () => {
  it("rejects student authoring before any write occurs", async () => {
    const ctx = makeAuthContext("student");

    await expect(
      saveSpaceService({ data: { title: "Forbidden", type: "learning" } }, ctx)
    ).rejects.toMatchObject({ code: "PERMISSION_DENIED" });

    expect((await ctx.repos.spaces.list(ctx.tenantId!, {})).items).toEqual([]);
  });

  it("persists inline rubrics and attachments through create and partial update", async () => {
    const ctx = makeAuthContext("teacher");
    const tenantId = ctx.tenantId!;

    const space = await saveSpaceService(
      {
        data: {
          title: "Physics",
          type: "learning",
          defaultRubric: RUBRIC,
        },
      },
      ctx
    );
    const storyPoint = await saveStoryPointService(
      {
        spaceId: space.id,
        data: {
          title: "Motion",
          type: "standard",
          defaultRubric: RUBRIC,
        },
      },
      ctx
    );
    const item = await saveItemService(
      {
        spaceId: space.id,
        storyPointId: storyPoint.id,
        data: {
          type: "material",
          payload: {
            type: "material",
            materialData: { materialType: "pdf", url: "gs://document" },
          },
          rubric: RUBRIC,
          attachments: [{ type: "pdf", url: "gs://attachment", sizeBytes: 1024 }],
        },
      },
      ctx
    );

    await saveItemService(
      {
        id: item.id,
        spaceId: space.id,
        storyPointId: storyPoint.id,
        data: { orderIndex: 4 },
      },
      ctx
    );

    expect((await ctx.repos.spaces.get(tenantId, space.id))?.["defaultRubric"]).toEqual(RUBRIC);
    expect((await ctx.repos.storyPoints.get(tenantId, storyPoint.id))?.["defaultRubric"]).toEqual(
      RUBRIC
    );
    expect((await ctx.repos.items.get(tenantId, item.id))?.["attachments"]).toEqual([
      { type: "pdf", url: "gs://attachment", sizeBytes: 1024 },
    ]);
    expect((await ctx.repos.items.get(tenantId, item.id))?.["rubric"]).toEqual(RUBRIC);
    expect((await ctx.repos.items.get(tenantId, item.id))?.["orderIndex"]).toBe(4);

    const edit = await getItemForEditService(
      { spaceId: space.id, storyPointId: storyPoint.id, itemId: item.id },
      ctx
    );
    expect(edit.item.rubric).toMatchObject({
      modelAnswer: RUBRIC.modelAnswer,
      evaluatorGuidance: RUBRIC.evaluatorGuidance,
    });

    const listed = await listItemsService({ spaceId: space.id, storyPointId: storyPoint.id }, ctx);
    expect(listed.items[0]?.rubric).not.toHaveProperty("modelAnswer");
    expect(listed.items[0]?.rubric).not.toHaveProperty("evaluatorGuidance");
  });

  it("requires an active item in every active story point before publish", async () => {
    const ctx = makeAuthContext("teacher");
    const space = await saveSpaceService({ data: { title: "Physics", type: "learning" } }, ctx);
    const storyPoint = await saveStoryPointService(
      {
        spaceId: space.id,
        data: { title: "Empty chapter", type: "standard" },
      },
      ctx
    );

    await expect(
      saveSpaceService({ id: space.id, data: { status: "published" } }, ctx)
    ).rejects.toMatchObject({ code: "FAILED_PRECONDITION" });

    await saveItemService(
      {
        spaceId: space.id,
        storyPointId: storyPoint.id,
        data: {
          type: "checkpoint",
          payload: { type: "checkpoint", message: "Ready" },
        },
      },
      ctx
    );

    await expect(
      saveSpaceService({ id: space.id, data: { status: "published" } }, ctx)
    ).resolves.toMatchObject({ id: space.id });
  });

  it("soft-deletes without persisting the command-only deleted flag", async () => {
    const ctx = makeAuthContext("teacher");
    const tenantId = ctx.tenantId!;
    const item = await saveItemService(
      {
        spaceId: "space_1",
        storyPointId: "sp_1",
        data: {
          type: "checkpoint",
          payload: { type: "checkpoint" },
        },
      },
      ctx
    );

    await saveItemService(
      {
        id: item.id,
        spaceId: "space_1",
        storyPointId: "sp_1",
        data: { deleted: true },
      },
      ctx
    );

    const stored = await ctx.repos.items.get(tenantId, item.id);
    expect(stored?.["deleted"]).toBeUndefined();
    expect(stored?.["archivedAt"]).toBe(ctx.now());
  });

  it("moves an existing item with a partial update without losing its canonical payload", async () => {
    const ctx = makeAuthContext("teacher");
    const tenantId = ctx.tenantId!;
    const item = await saveItemService(
      {
        spaceId: "space_1",
        storyPointId: "sp_1",
        data: {
          type: "material",
          payload: {
            type: "material",
            materialData: { materialType: "text", body: "Keep me" },
          },
          orderIndex: 0,
        },
      },
      ctx
    );

    await saveItemService(
      {
        id: item.id,
        spaceId: "space_1",
        storyPointId: "sp_2",
        data: { orderIndex: 7 },
      },
      ctx
    );

    expect(await ctx.repos.items.get(tenantId, item.id)).toMatchObject({
      spaceId: "space_1",
      storyPointId: "sp_2",
      orderIndex: 7,
      type: "material",
      payload: {
        type: "material",
        materialData: { materialType: "text", body: "Keep me" },
      },
    });
  });

  it("publishes, reopens to draft, and republishes without losing publishedAt", async () => {
    const ctx = makeAuthContext("teacher");
    const tenantId = ctx.tenantId!;
    const space = await saveSpaceService({ data: { title: "Lifecycle", type: "learning" } }, ctx);
    const storyPoint = await saveStoryPointService(
      {
        spaceId: space.id,
        data: { title: "Ready", type: "standard" },
      },
      ctx
    );
    await saveItemService(
      {
        spaceId: space.id,
        storyPointId: storyPoint.id,
        data: {
          type: "checkpoint",
          payload: { type: "checkpoint", message: "Ready" },
        },
      },
      ctx
    );

    await saveSpaceService({ id: space.id, data: { status: "published" } }, ctx);
    await saveSpaceService({ id: space.id, data: { status: "draft" } }, ctx);
    await saveSpaceService({ id: space.id, data: { status: "published" } }, ctx);

    expect(await ctx.repos.spaces.get(tenantId, space.id)).toMatchObject({
      status: "published",
      publishedAt: ctx.now(),
    });
  });

  it("stores chat assessment private objectives only in the deny-all answer key", async () => {
    const ctx = makeAuthContext("teacher");
    const tenantId = ctx.tenantId!;
    const agents = new Map<string, Record<string, unknown>>([
      [
        "agent_interviewer_1",
        {
          id: "agent_interviewer_1",
          tenantId,
          spaceId: "space_1",
          type: "interviewer",
          name: "Interview coach",
          isActive: true,
          modelPolicyId: "conversation.quality",
        },
      ],
      [
        "agent_evaluator_1",
        {
          id: "agent_evaluator_1",
          tenantId,
          spaceId: "space_1",
          type: "evaluator",
          name: "Evaluation coach",
          isActive: true,
          modelPolicyId: "evaluation.quality",
        },
      ],
    ]);
    const extended = ctx.repos as unknown as {
      agents: { get: (tenant: string, id: string) => Promise<Record<string, unknown> | null> };
      rubricPresets: {
        get: (tenant: string, id: string) => Promise<Record<string, unknown> | null>;
      };
    };
    extended.agents = {
      async get(_tenant, id) {
        return agents.get(id) ?? null;
      },
    };
    extended.rubricPresets = {
      async get() {
        return null;
      },
    };

    const saved = await saveItemService(
      {
        spaceId: "space_1",
        storyPointId: "story_point_1",
        data: {
          type: "question",
          title: "Cache interview",
          content: "Discuss a cache invalidation decision.",
          payload: {
            type: "question",
            basePoints: 10,
            questionData: {
              questionType: "chat_agent_question",
              scenario: "You are reviewing a cache invalidation design.",
              publicLearningObjectives: [{ id: "tradeoff", label: "Explain a cache trade-off" }],
              conversationStarters: ["What would you invalidate first?"],
              interviewerAgentId: "agent_interviewer_1",
              completionPolicy: {
                minLearnerTurns: 2,
                maxLearnerTurns: 6,
                allowEarlyFinish: true,
                hardLimitAction: "auto_finalize",
              },
            },
          },
          rubric: {
            scoringMode: "dimension_based",
            dimensions: [
              {
                id: "reasoning",
                name: "Reasoning",
                priority: "HIGH",
                weight: 1,
                scoringScale: 5,
              },
            ],
          },
          meta: { evaluatorAgentId: "agent_evaluator_1" },
          answerKey: {
            questionType: "chat_agent_question",
            modelAnswer: "A strong answer balances freshness, cost, and correctness.",
            evaluationGuidance: "Reward a justified trade-off.",
            privateEvaluationObjectives: [
              {
                id: "evidence_tradeoff",
                rubricDimensionId: "reasoning",
                description: "Provides a concrete invalidation trade-off.",
              },
            ],
          },
        },
      } as never,
      ctx
    );

    const stored = await ctx.repos.items.get(tenantId, saved.id);
    const storedQuestion = (stored?.["payload"] as Record<string, unknown>)?.[
      "questionData"
    ] as Record<string, unknown>;
    expect(storedQuestion).toMatchObject({
      questionType: "chat_agent_question",
      scenario: "You are reviewing a cache invalidation design.",
    });
    expect(storedQuestion).not.toHaveProperty("modelAnswer");
    expect(storedQuestion).not.toHaveProperty("privateEvaluationObjectives");
    expect(await ctx.repos.answerKeys.get(tenantId, saved.id)).toMatchObject({
      id: saved.id,
      itemId: saved.id,
      privateEvaluationObjectives: [{ rubricDimensionId: "reasoning" }],
    });

    const authoring = await getItemForEditService(
      { spaceId: "space_1", storyPointId: "story_point_1", itemId: saved.id },
      ctx
    );
    expect(authoring.item.answerKey).toMatchObject({
      privateEvaluationObjectives: [{ id: "evidence_tradeoff" }],
    });
    expect(authoring.item.meta).toMatchObject({ evaluatorAgentId: "agent_evaluator_1" });
    const listed = await listItemsService(
      { spaceId: "space_1", storyPointId: "story_point_1" },
      ctx
    );
    const listedQuestion = (listed.items[0]?.payload as Record<string, unknown>)?.[
      "questionData"
    ] as Record<string, unknown>;
    expect(listedQuestion).not.toHaveProperty("modelAnswer");
    expect(listedQuestion).not.toHaveProperty("privateEvaluationObjectives");
    expect(listed.items[0]?.meta).not.toHaveProperty("evaluatorAgentId");

    // An explicit replacement meta object clears the optional evaluator
    // override; it must not be reintroduced from the prior item state.
    await saveItemService(
      {
        id: saved.id,
        spaceId: "space_1",
        storyPointId: "story_point_1",
        data: { meta: {} },
      } as never,
      ctx
    );
    const cleared = await getItemForEditService(
      { spaceId: "space_1", storyPointId: "story_point_1", itemId: saved.id },
      ctx
    );
    expect(cleared.item.meta?.evaluatorAgentId).toBeUndefined();

    await expect(
      getItemForEditService(
        { spaceId: "space_1", storyPointId: "wrong_story_point", itemId: saved.id },
        ctx
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects a chat assessment whose interviewer is not an active same-space interviewer", async () => {
    const ctx = makeAuthContext("teacher");
    const extended = ctx.repos as unknown as {
      agents: { get: () => Promise<Record<string, unknown> | null> };
    };
    extended.agents = {
      async get() {
        return null;
      },
    };

    await expect(
      saveItemService(
        {
          spaceId: "space_1",
          storyPointId: "story_point_1",
          data: {
            type: "question",
            payload: {
              type: "question",
              questionData: {
                questionType: "chat_agent_question",
                scenario: "Interview scenario",
                publicLearningObjectives: [{ id: "objective", label: "Objective" }],
                interviewerAgentId: "missing_interviewer",
                completionPolicy: {
                  minLearnerTurns: 1,
                  maxLearnerTurns: 2,
                  allowEarlyFinish: true,
                  hardLimitAction: "auto_finalize",
                },
              },
            },
            rubric: {
              scoringMode: "dimension_based",
              dimensions: [{ id: "reasoning", name: "Reasoning", priority: "HIGH" }],
            },
            answerKey: {
              questionType: "chat_agent_question",
              privateEvaluationObjectives: [
                { id: "private", rubricDimensionId: "reasoning", description: "Evidence" },
              ],
            },
          },
        } as never,
        ctx
      )
    ).rejects.toMatchObject({ code: "FAILED_PRECONDITION" });
  });
});
