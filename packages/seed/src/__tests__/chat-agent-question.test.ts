import { describe, expect, it } from "vitest";
import {
  assertFkConsistency,
  type ChatAgentQuestionSeedConfig,
  type SeedConfig,
  validateSeedConfig,
} from "../config/index.js";
import { buildChatAgentAnswerKey, buildItemQuestionData } from "../engine/canonical.js";
import { SeedManifest } from "../engine/manifest.js";
import { Paths } from "../engine/paths.js";
import { IdResolver } from "../engine/resolver.js";
import { seed } from "../engine/run.js";

const assessment: ChatAgentQuestionSeedConfig = {
  key: "ecosystem-interview",
  kind: "question",
  questionType: "chat_agent_question",
  prompt: "Explain how a food-web disruption affects an ecosystem.",
  scenario: "You are advising a conservation team after a predator population declines.",
  publicLearningObjectives: [
    { key: "causal-reasoning", label: "Explain ecological cause and effect" },
    { key: "evidence", label: "Use evidence from the scenario" },
  ],
  conversationStarters: ["I would first identify the affected populations."],
  interviewerAgentKey: "ecosystem-interviewer",
  evaluatorAgentKey: "ecosystem-evaluator",
  completionPolicy: { minLearnerTurns: 2, maxLearnerTurns: 6, allowEarlyFinish: true },
  answer: {
    modelAnswer: "A decrease in predators can cause prey populations to rise.",
    evaluationGuidance: "Look for causal reasoning and use of scenario evidence.",
    privateEvaluationObjectives: [
      {
        key: "causal-reasoning",
        rubricDimensionKey: "reasoning",
        description: "Connects the predator decline to downstream population changes.",
        evidenceRequirement: "Names at least one causal link.",
      },
      {
        key: "evidence",
        rubricDimensionKey: "evidence",
        description: "Uses details from the conservation scenario.",
      },
    ],
  },
  rubricPresetKey: "ecosystem-rubric",
};

function config(): SeedConfig {
  return {
    tenants: [
      {
        key: "chat-assessment-seed",
        name: "Chat Assessment Seed",
        code: "CHATSEED",
        agents: [
          {
            key: "ecosystem-interviewer",
            name: "Ecosystem interviewer",
            spaceKey: "ecosystems",
            type: "interviewer",
            modelPolicyId: "conversation.quality",
            version: 1,
          },
          {
            key: "ecosystem-evaluator",
            name: "Ecosystem evaluator",
            spaceKey: "ecosystems",
            type: "evaluator",
            modelPolicyId: "evaluation.quality",
            version: 1,
          },
        ],
        rubricPresets: [
          {
            key: "ecosystem-rubric",
            name: "Ecosystem evidence rubric",
            rubric: {
              dimensions: [
                { key: "reasoning", label: "Reasoning", weight: 0.6 },
                { key: "evidence", label: "Evidence", weight: 0.4 },
              ],
              totalPoints: 10,
              passingScore: 6,
            },
          },
        ],
        spaces: [
          {
            key: "ecosystems",
            title: "Ecosystems",
            storyPoints: [
              {
                key: "food-webs",
                title: "Food webs",
                items: [assessment],
              },
            ],
          },
        ],
      },
    ],
  };
}

describe("chat_agent_question seed support", () => {
  it("keeps public authoring fields out of the private answer key and vice versa", () => {
    const r = new IdResolver("chat-assessment-seed");
    const publicQuestion = buildItemQuestionData(assessment, {
      interviewerAgentId: r.agentId(assessment.interviewerAgentKey),
    });
    const privateKey = buildChatAgentAnswerKey(assessment);

    expect(publicQuestion).toMatchObject({
      questionType: "chat_agent_question",
      scenario: assessment.scenario,
      interviewerAgentId: r.agentId(assessment.interviewerAgentKey),
      completionPolicy: { hardLimitAction: "auto_finalize" },
    });
    expect(publicQuestion).not.toHaveProperty("modelAnswer");
    expect(publicQuestion).not.toHaveProperty("evaluationGuidance");
    expect(publicQuestion).not.toHaveProperty("privateEvaluationObjectives");
    expect(privateKey).toMatchObject({
      questionType: "chat_agent_question",
      modelAnswer: assessment.answer.modelAnswer,
    });
    expect(
      (privateKey.privateEvaluationObjectives as Array<Record<string, unknown>>)[0]
    ).toMatchObject({ id: "causal-reasoning", rubricDimensionId: "reasoning" });
    expect(privateKey).not.toHaveProperty("scenario");
    expect(privateKey).not.toHaveProperty("publicLearningObjectives");
  });

  it("requires an active same-space interviewer with a policy and valid rubric dimension FKs", () => {
    expect(() => {
      validateSeedConfig(config());
      assertFkConsistency(config());
    }).not.toThrow();

    const invalid = structuredClone(config());
    invalid.tenants[0]!.agents![0]!.type = "tutor";
    invalid.tenants[0]!.spaces![0]!.storyPoints![0]!.items![0] = {
      ...assessment,
      answer: {
        ...assessment.answer,
        privateEvaluationObjectives: [
          {
            ...assessment.answer.privateEvaluationObjectives[0]!,
            rubricDimensionKey: "missing-dimension",
          },
        ],
      },
    };

    expect(() => assertFkConsistency(invalid)).toThrow(/type "interviewer"/);
    expect(() => assertFkConsistency(invalid)).toThrow(/missing-dimension/);
  });

  it("validates an optional evaluator override against same-space evaluator policy", () => {
    const invalid = structuredClone(config());
    invalid.tenants[0]!.agents![1]!.modelPolicyId = "conversation.fast";

    expect(() => assertFkConsistency(invalid)).toThrow(/evaluation\.quality/);

    const missingPolicy = structuredClone(config());
    delete (missingPolicy.tenants[0]!.agents![1] as { modelPolicyId?: string }).modelPolicyId;
    expect(() => assertFkConsistency(missingPolicy)).toThrow(
      /must declare the evaluation\.quality/
    );
  });

  it("requires private objectives to resolve against a dimension-based rubric", () => {
    const invalid = structuredClone(config());
    invalid.tenants[0]!.rubricPresets![0]!.rubric = { totalPoints: 10 };

    expect(() => assertFkConsistency(invalid)).toThrow(/dimension-based rubric/);
  });

  it("uses the item id as the only answer-key id and produces a stable dry-run plan", () => {
    const r = new IdResolver("chat-assessment-seed");
    const tenantId = r.tenantId;
    const spaceId = r.spaceId("ecosystems");
    const storyPointId = r.storyPointId("ecosystems", "food-webs");
    const itemId = r.itemId("ecosystems", "food-webs", assessment.key);
    const path = Paths.answerKey(tenantId, spaceId, storyPointId, itemId);

    expect(path).toBe(
      `${Paths.items(tenantId, spaceId, storyPointId)}/${itemId}/answerKeys/${itemId}`
    );

    const first = new SeedManifest();
    first.record({
      kind: "answerKey",
      path,
      logicalKey: "answerKey:ecosystems/food-webs/ecosystem-interview",
      data: { id: itemId, itemId, privateEvaluationObjectives: [] },
    });
    const second = new SeedManifest();
    second.record({
      kind: "answerKey",
      path,
      logicalKey: "answerKey:ecosystems/food-webs/ecosystem-interview",
      data: { itemId, privateEvaluationObjectives: [], id: itemId },
    });

    expect(first.entries()).toEqual(second.entries());
    expect(first.entries()[0]).toMatchObject({
      logicalKey: "answerKey:ecosystems/food-webs/ecosystem-interview",
      resolvedId: itemId,
      exactPath: path,
      action: "upsert",
    });
  });
});

const emulatorReady = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

(emulatorReady ? describe : describe.skip)("chat_agent_question emulator determinism", () => {
  it("re-runs without duplicate paths or changed canonical documents", async () => {
    const first = await seed(config(), { projectId: "seed-chat-agent-test", logLevel: "silent" });
    const second = await seed(config(), { projectId: "seed-chat-agent-test", logLevel: "silent" });

    expect(first.verify.ok).toBe(true);
    expect(second.verify.ok).toBe(true);
    expect(second.manifest).toEqual(first.manifest);
    expect(
      second.manifest.filter((entry) => entry.verifyAs.includes("assessmentConfiguration"))
    ).toHaveLength(2);
  });
});
