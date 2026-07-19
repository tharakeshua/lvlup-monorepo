/**
 * REGRESSION (vc9 P0 — "AI text question shows 'Not quite yet' + empty feedback").
 *
 * An AI Assessment Lab `text` question normalizes to `short_answer`
 * (QT_TO_GRADING), and the batch-2 items ship BOTH a server answer key AND a
 * scoring rubric (`dimension_based` / `criteria_based`). Before the fix,
 * `scoreOne`'s `(short_answer|fill_blank) && key` shortcut fired first and
 * binary-matched the learner's free-text answer against the model sentence —
 * always score 0, empty feedback, NO LLM call. The client faithfully rendered
 * that thin eval as an incorrect verdict with no rich sections.
 *
 * The fix: an item carrying an AI rubric (`hasAiRubric`) skips the exact-match
 * shortcut and reaches the unified evaluator, so its answer key becomes grader
 * CONTEXT rather than an exact-match target.
 *
 * These prove the routing at the service seam:
 *   1. text + key + dimension_based rubric → unified evaluator runs, rich eval flows.
 *   2. text + key + criteria_based rubric  → unified evaluator runs (variant guard).
 *   3. text + key + NO rubric              → deterministic exact-match preserved (no LLM).
 */
import { describe, it, expect } from "vitest";
import { makeAuthContext } from "../../../../tests/sdk/harness/auth-context";
import { localSeedId } from "../../../../tests/sdk/harness/fixtures-ids";
import { makeItem } from "../../../../tests/sdk/fakes/entity-factories";
import { recordItemAttemptService, hasAiRubric } from "../index";

const ITEM_ID = localSeedId("item", "arrays.q1");
const SPACE_ID = localSeedId("space", "dsa");
const SP_ID = localSeedId("sp", "arrays");

/** A `text` (→short_answer) item, optionally with a rubric, plus its server key. */
async function seedTextItem(
  ctx: ReturnType<typeof makeAuthContext>,
  rubric?: Record<string, unknown>
) {
  await ctx.repos.items.upsert(
    ctx.tenantId!,
    makeItem({
      id: ITEM_ID,
      spaceId: SPACE_ID,
      storyPointId: SP_ID,
      type: "question",
      payload: { type: "question", questionData: { questionType: "text" } },
      content: "State the worst-case time complexity of binary search and explain why.",
      ...(rubric ? { rubric } : {}),
    }),
    ctx.now()
  );
  await ctx.repos.answerKeys.put(ctx.tenantId!, ITEM_ID, {
    itemId: ITEM_ID,
    spaceId: SPACE_ID,
    storyPointId: SP_ID,
    correctAnswer: "O(log n) because the search space is halved on every comparison.",
    acceptableAnswers: ["O(log n)", "logarithmic", "log n"],
    modelAnswer: "O(log n): each comparison discards half of the remaining search space.",
    evaluationGuidance: "Full credit requires the complexity AND the halving justification.",
  });
}

const goodAnswer =
  "The worst-case time complexity is O(log n). Binary search halves the search " +
  "space each comparison, so it is logarithmic.";

const submit = (ctx: ReturnType<typeof makeAuthContext>, answer: unknown) =>
  recordItemAttemptService(
    { spaceId: SPACE_ID, storyPointId: SP_ID, itemId: ITEM_ID, answer } as never,
    ctx
  );

describe("AI-rubric routing (vc9 P0: text question with key + rubric must reach the AI grader)", () => {
  it("dimension_based rubric → unified evaluator runs and rich feedback flows (NOT binary 0)", async () => {
    const ctx = makeAuthContext("student");
    ctx.ai.onGenerate("unifiedEvaluation", {
      json: {
        score: 1,
        correctness: 1,
        summary: { keyTakeaway: "Correct and well justified.", overallComment: "Nailed it." },
        strengths: ["States O(log n)", "Explains the halving"],
        weaknesses: [],
        missingConcepts: [],
        structuredFeedback: { accuracy: [{ severity: "minor", message: "Solid." }] },
      },
    });
    await seedTextItem(ctx, {
      passingPercentage: 60,
      scoringMode: "dimension_based",
      dimensions: [
        { id: "accuracy", name: "Correctness", weight: 0.7 },
        { id: "justification", name: "Justification", weight: 0.3 },
      ],
    });

    const res = (await submit(ctx, goodAnswer)) as {
      progress: { evaluation: Record<string, unknown> };
    };
    // The unified evaluator was invoked (the whole point — it was skipped before).
    expect(ctx.ai.calls.some((c) => c.promptKey === "unifiedEvaluation")).toBe(true);
    const ev = res.progress.evaluation;
    // A good answer now scores full — not the binary 0 the exact-match shortcut gave.
    expect(ev.percentage).toBe(100);
    expect(ev.correctness).toBe(1);
    // Rich sections the client renders are present (were empty in the P0).
    expect(ev.summary).toBeTruthy();
    expect((ev.strengths as unknown[]).length).toBeGreaterThan(0);
  });

  it("criteria_based rubric → unified evaluator runs (batch-2 variant guard)", async () => {
    const ctx = makeAuthContext("student");
    await seedTextItem(ctx, {
      passingPercentage: 60,
      scoringMode: "criteria_based",
      criteria: [
        { id: "definition", name: "Definition", maxScore: 3, weight: 0.6, levels: [] },
        { id: "analogy", name: "Analogy", maxScore: 2, weight: 0.4, levels: [] },
      ],
    });

    await submit(ctx, goodAnswer);
    expect(ctx.ai.calls.some((c) => c.promptKey === "unifiedEvaluation")).toBe(true);
  });

  it("NO rubric → deterministic exact-match preserved (fast path, no LLM)", async () => {
    const ctx = makeAuthContext("student");
    await seedTextItem(ctx); // no rubric

    // Exact acceptable-answer match → full credit, no AI call.
    const okRes = (await submit(ctx, "O(log n)")) as {
      progress: { evaluation: Record<string, unknown> };
    };
    expect(ctx.ai.calls.length).toBe(0);
    expect(okRes.progress.evaluation.correctness).toBe(1);

    // A free-text non-match on a keyed short-answer (no rubric) stays binary 0.
    const ctx2 = makeAuthContext("student");
    await seedTextItem(ctx2);
    const wrongRes = (await submit(ctx2, "It is very fast, basically instant.")) as {
      progress: { evaluation: Record<string, unknown> };
    };
    expect(ctx2.ai.calls.length).toBe(0);
    expect(wrongRes.progress.evaluation.correctness).toBe(0);
  });
});

describe("hasAiRubric predicate", () => {
  it("true for every AI scoring mode", () => {
    for (const scoringMode of ["criteria_based", "dimension_based", "holistic", "hybrid"]) {
      expect(hasAiRubric({ rubric: { scoringMode } })).toBe(true);
    }
  });
  it("true when the rubric has graded dimensions/criteria but no explicit mode", () => {
    expect(hasAiRubric({ rubric: { dimensions: [{ id: "a" }] } })).toBe(true);
    expect(hasAiRubric({ rubric: { criteria: [{ id: "c" }] } })).toBe(true);
  });
  it("prefers effectiveRubric over rubric", () => {
    expect(hasAiRubric({ effectiveRubric: { scoringMode: "holistic" }, rubric: {} })).toBe(true);
  });
  it("false with no rubric, an empty rubric, or empty ladders", () => {
    expect(hasAiRubric({})).toBe(false);
    expect(hasAiRubric({ rubric: {} })).toBe(false);
    expect(hasAiRubric({ rubric: { dimensions: [], criteria: [] } })).toBe(false);
    expect(hasAiRubric({ rubric: null })).toBe(false);
  });
});
