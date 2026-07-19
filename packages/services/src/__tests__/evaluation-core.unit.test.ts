/**
 * Evaluation Core unit tests (AI-EVALUATION-CORE-PLAN.md Phase 1): prompt
 * composition (persona / rubric scoringModes / dimensions / transcript /
 * injection-guard), dimension-derived responseSchema, and outcome normalization
 * (clamping, whitelisting, severity/mistake enums).
 */
import { describe, it, expect } from "vitest";
import { buildEvaluationPrompt } from "../evaluation/prompt";
import { buildEvaluationResponseSchema, enabledDimensionIds } from "../evaluation/response-schema";
import { evaluateWithAi } from "../evaluation/evaluate";
import type { EvaluationRequest } from "../evaluation/types";

const baseReq = (over: Partial<EvaluationRequest> = {}): EvaluationRequest => ({
  question: { text: "Explain photosynthesis.", questionType: "long_answer", maxScore: 10 },
  answer: { text: "Plants convert light to energy." },
  mode: "interactive",
  operation: "test.evaluate",
  ...over,
});

const SETTINGS = {
  enabledDimensions: [
    { id: "clarity", name: "Clarity", priority: "HIGH", promptGuidance: "secret guidance" },
    { id: "grammar", name: "Grammar", priority: "LOW" },
  ],
};

const RUBRIC = {
  scoringMode: "criteria_based",
  criteria: [
    { id: "c1", name: "Light reaction", maxScore: 6, description: "covers light phase" },
    { id: "c2", name: "Dark reaction", maxScore: 4 },
  ],
  modelAnswer: "SECRET-MODEL-ANSWER",
  evaluatorGuidance: "SECRET-GUIDANCE",
};

describe("buildEvaluationPrompt", () => {
  it("wraps the answer in student_answer tags and includes rubric criteria + secrets", () => {
    const p = buildEvaluationPrompt(baseReq({ rubric: RUBRIC }));
    expect(p).toContain("<student_answer>");
    expect(p).toContain("Plants convert light to energy.");
    expect(p).toContain("[c1] Light reaction (6 marks)");
    expect(p).toContain("SECRET-MODEL-ANSWER");
    expect(p).toContain("SECRET-GUIDANCE");
    expect(p).toContain("Maximum score: 10");
  });

  it("reads legacy criteria.maxPoints when maxScore is absent", () => {
    const p = buildEvaluationPrompt(
      baseReq({
        rubric: { scoringMode: "criteria_based", criteria: [{ name: "Old", maxPoints: 3 }] },
      })
    );
    expect(p).toContain("Old (3 marks)");
  });

  it("injects the agent persona block", () => {
    const p = buildEvaluationPrompt(
      baseReq({
        agent: {
          identity: "Prof. Strict",
          rules: ["No marks for restating the question"],
          strictness: 0.9,
          feedbackStyle: "direct",
          evaluationObjectives: ["conceptual depth"],
        },
      })
    );
    expect(p).toContain("EVALUATOR IDENTITY:\nProf. Strict");
    expect(p).toContain("- No marks for restating the question");
    expect(p).toContain("STRICTNESS");
    expect(p).toContain("conceptual depth");
  });

  it("renders settings dimensions with guidance", () => {
    const p = buildEvaluationPrompt(baseReq({ settings: SETTINGS }));
    expect(p).toContain("FEEDBACK DIMENSIONS");
    expect(p).toContain("clarity — Clarity");
    expect(p).toContain("guidance: secret guidance");
  });

  it("renders holistic rubrics", () => {
    const p = buildEvaluationPrompt(
      baseReq({
        rubric: { scoringMode: "holistic", holisticGuidance: "judge overall", holisticMaxScore: 5 },
      })
    );
    expect(p).toContain("HOLISTIC EVALUATION:\njudge overall");
  });

  it("renders a chat transcript with agent observations, student turns tagged", () => {
    const p = buildEvaluationPrompt(
      baseReq({
        answer: {
          transcript: [
            { role: "user", content: "It uses sunlight" },
            { role: "assistant", content: "What about the inputs?" },
          ],
          observations: [
            { dimensionId: "clarity", evidence: "explained inputs", provisionalScore: 4 },
          ],
        },
      })
    );
    expect(p).toContain("STUDENT: It uses sunlight");
    expect(p).toContain("AGENT: What about the inputs?");
    expect(p).toContain("[clarity] explained inputs (provisional: 4)");
  });

  it("tells the grader to use attached media when the answer is media-only", () => {
    const p = buildEvaluationPrompt(
      baseReq({ answer: { media: [{ storagePath: "tenants/t1/x.jpg" }] } })
    );
    expect(p).toContain("ONLY as the attached media");
  });
});

describe("buildEvaluationResponseSchema", () => {
  it("emits per-dimension structuredFeedback properties, all required", () => {
    const s = buildEvaluationResponseSchema(SETTINGS, null) as Record<string, any>;
    const sf = s["properties"]["structuredFeedback"];
    expect(Object.keys(sf["properties"])).toEqual(["clarity", "grammar"]);
    expect(sf["required"]).toEqual(["clarity", "grammar"]);
    expect(s["required"]).toContain("structuredFeedback");
  });

  it("emits rubricBreakdown only when criteria exist", () => {
    const withCriteria = buildEvaluationResponseSchema(null, RUBRIC) as Record<string, any>;
    expect(withCriteria["properties"]["rubricBreakdown"]).toBeDefined();
    expect(withCriteria["required"]).toContain("rubricBreakdown");
    const bare = buildEvaluationResponseSchema(null, null) as Record<string, any>;
    expect(bare["properties"]["rubricBreakdown"]).toBeUndefined();
    expect(bare["required"]).toContain("confidence");
  });

  it("enabledDimensionIds drops blank ids", () => {
    expect(enabledDimensionIds({ enabledDimensions: [{ id: "a" }, { id: "" }, {}] })).toEqual([
      "a",
    ]);
  });
});

describe("evaluateWithAi", () => {
  const fakeAi = (json: unknown) => {
    const calls: unknown[] = [];
    return {
      calls,
      async generate(req: unknown) {
        calls.push(req);
        return { text: JSON.stringify(json), json, tokensUsed: 48, costUsd: 0.01, model: "m" };
      },
    };
  };

  it("normalizes + clamps the model output and whitelists dimensions", async () => {
    const ai = fakeAi({
      score: 14, // > maxScore → clamped
      confidence: 1.4,
      strengths: ["good"],
      weaknesses: [],
      missingConcepts: [],
      summary: { keyTakeaway: "ok", overallComment: "fine" },
      mistakeClassification: "Conceptual",
      structuredFeedback: {
        clarity: [{ severity: "bogus", message: "unclear intro" }],
        invented: [{ severity: "minor", message: "dropped" }],
      },
      rubricBreakdown: [
        { criterionId: "c1", criterionName: "Light reaction", score: 9, maxScore: 6 },
      ],
    });
    const out = await evaluateWithAi(
      ai as never,
      { tenantId: "t1" },
      baseReq({ settings: SETTINGS, rubric: RUBRIC })
    );
    expect(out.score).toBe(10);
    expect(out.confidence).toBe(1);
    expect(out.correctness).toBe(1);
    expect(out.percentage).toBe(100);
    expect(out.mistakeClassification).toBe("Conceptual");
    expect(Object.keys(out.structuredFeedback ?? {})).toEqual(["clarity", "grammar"]);
    expect(out.structuredFeedback?.["clarity"]?.[0]?.severity).toBe("minor"); // bogus → minor
    expect(out.rubricBreakdown?.[0]?.score).toBe(6); // clamped to criterion max
    expect(out.dimensionsUsed).toEqual(["clarity", "grammar"]);
    expect(out.tokensUsed).toBe(48);
  });

  it("derives correctness/percentage and summary from a legacy feedback string", async () => {
    const ai = fakeAi({ score: 5, confidence: 0.8, feedback: "half right" });
    const out = await evaluateWithAi(ai as never, { tenantId: "t1" }, baseReq());
    expect(out.correctness).toBe(0.5);
    expect(out.percentage).toBe(50);
    expect(out.summary).toEqual({ keyTakeaway: "half right", overallComment: "half right" });
    expect(out.structuredFeedback).toBeUndefined();
  });

  it("sends the unifiedEvaluation prompt key, media, and agent model override", async () => {
    const ai = fakeAi({ score: 1, confidence: 1 });
    await evaluateWithAi(
      ai as never,
      { tenantId: "t1" },
      baseReq({
        agent: { modelOverride: "custom-model", temperatureOverride: 0.2 },
        answer: {
          text: "hi",
          media: [{ storagePath: "tenants/t1/a.jpg", mimeType: "image/jpeg" }],
        },
      })
    );
    const req = ai.calls[0] as Record<string, unknown>;
    expect(req["promptKey"]).toBe("unifiedEvaluation");
    expect(req["model"]).toBe("custom-model");
    expect(req["temperature"]).toBe(0.2);
    expect(Array.isArray(req["images"])).toBe(true);
    expect(req["responseSchema"]).toBeDefined();
  });
});
