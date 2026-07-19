/**
 * SECURITY PIN (AD-11 mirror, question side) — answer-bearing extraction guidance
 * must never reach non-authoring clients.
 *
 * The `questionExtraction` prompt now asks the model for `modelAnswer` +
 * `evaluatorGuidance`. The ONLY sanctioned home for those values is INSIDE the
 * question's rubric (`UnifiedRubric.modelAnswer` / `.evaluatorGuidance`), where
 * `projectRubric` strips them for non-authoring roles. These tests pin:
 *   1. CONTRACT — `ExamQuestionViewSchema` carries NO top-level
 *      `modelAnswer`/`evaluationGuidance` keys (strict zObject rejects them).
 *   2. SERVICE  — `listQuestions` drops legacy top-level guidance doc fields for
 *      EVERY role, and strips rubric guidance for non-authoring roles while
 *      keeping it for authoring roles.
 *   3. EXTRACTION — `extractQuestions` folds model-emitted top-level guidance
 *      into the rubric; the persisted doc has no top-level guidance fields.
 *
 * Mirror of the AG-7 submission-side guards (see grading tests).
 */
import { describe, it, expect } from "vitest";
import { getCallable } from "@levelup/api-contract";
import { makeAuthContext } from "../../../../tests/sdk/harness/auth-context";
import { makeExam } from "../../../../tests/sdk/fakes/entity-factories";
import { listQuestionsService } from "./reads";
import { extractQuestionsService } from "./extract-questions";

const TS = "2026-01-01T00:00:00.000Z";
const RUBRIC_WITH_SECRETS = {
  scoringMode: "criteria_based",
  criteria: [{ id: "c1", name: "Correctness", maxScore: 5 }],
  modelAnswer: "V = IR",
  evaluatorGuidance: "Full marks for the formula; partial for a worded statement.",
};

function seedQuestion(ctx: ReturnType<typeof makeAuthContext>, tenantId: string) {
  return ctx.repos.exams.upsert(tenantId, {
    id: "examq_sec",
    _kind: "examQuestion",
    examId: "exam_sec",
    text: "State Ohm's law.",
    maxMarks: 5,
    order: 1,
    rubric: RUBRIC_WITH_SECRETS,
    // Legacy/defensive: top-level guidance doc fields must NEVER project.
    modelAnswer: "V = IR",
    evaluationGuidance: "grade generously",
    createdAt: TS,
    updatedAt: TS,
  });
}

describe("AD-11 mirror — question-side answer guidance never leaks", () => {
  it("(1) contract: ExamQuestionViewSchema rejects top-level modelAnswer/evaluationGuidance", () => {
    const def = getCallable("v1.autograde.listQuestions");
    const base = {
      id: "examq_sec",
      examId: "exam_sec",
      text: "Q",
      maxMarks: 5,
      order: 1,
      rubric: { scoringMode: "criteria_based" },
      createdAt: TS,
      updatedAt: TS,
    };
    expect(def.responseSchema.safeParse({ questions: [base] }).success).toBe(true);
    expect(
      def.responseSchema.safeParse({ questions: [{ ...base, modelAnswer: "V = IR" }] }).success
    ).toBe(false);
    expect(
      def.responseSchema.safeParse({ questions: [{ ...base, evaluationGuidance: "x" }] }).success
    ).toBe(false);
  });

  it("(2) service: non-authoring role gets no guidance anywhere in the view", async () => {
    const ctx = makeAuthContext("student");
    const tenantId = ctx.tenantId!;
    await seedQuestion(ctx, tenantId);
    const res = await listQuestionsService({ examId: "exam_sec" }, ctx);
    const q = res.questions.find((x) => x.id === "examq_sec")! as Record<string, unknown>;
    expect("modelAnswer" in q).toBe(false);
    expect("evaluationGuidance" in q).toBe(false);
    const rubric = q["rubric"] as Record<string, unknown>;
    expect("modelAnswer" in rubric).toBe(false);
    expect("evaluatorGuidance" in rubric).toBe(false);
  });

  it("(2b) service: authoring role gets rubric guidance but never top-level fields", async () => {
    const ctx = makeAuthContext("teacher");
    const tenantId = ctx.tenantId!;
    await seedQuestion(ctx, tenantId);
    const res = await listQuestionsService({ examId: "exam_sec" }, ctx);
    const q = res.questions.find((x) => x.id === "examq_sec")! as Record<string, unknown>;
    expect("modelAnswer" in q).toBe(false);
    expect("evaluationGuidance" in q).toBe(false);
    const rubric = q["rubric"] as Record<string, unknown>;
    expect(rubric["modelAnswer"]).toBe("V = IR");
    expect(rubric["evaluatorGuidance"]).toContain("Full marks");
  });

  it("(3) extraction: model-emitted top-level guidance is folded into the rubric", async () => {
    const ctx = makeAuthContext("teacher");
    const tenantId = ctx.tenantId!;
    await ctx.repos.exams.upsert(
      tenantId,
      makeExam({
        id: "exam_fold",
        status: "question_paper_uploaded",
        questionPaper: {
          images: [`tenants/${tenantId}/exams/exam_fold/question-paper/p1.jpg`],
          extractedAt: null,
          questionCount: 0,
          examType: "standard",
        },
      })
    );
    // Pass 1 — question only (no guidance).
    ctx.ai.onGenerate("examQuestionExtraction", {
      json: [{ text: "State Ohm's law.", maxMarks: 5, order: 1 }],
    });
    // Pass 2 — the rubric carries the ⚷ guidance INSIDE the rubric object.
    ctx.ai.onGenerate("examRubricGeneration", {
      json: [
        {
          order: 1,
          rubric: {
            scoringMode: "criteria_based",
            criteria: [{ id: "c1", name: "Statement", maxScore: 5 }],
            modelAnswer: "V = IR",
            evaluatorGuidance: "Partial credit for a worded statement.",
          },
        },
      ],
    });

    await extractQuestionsService({ examId: "exam_fold" }, ctx);

    const doc = (await ctx.repos.exams.get(tenantId, "exam_fold_q1"))!;
    // ⚷ guidance NEVER as top-level doc fields — only inside the rubric.
    expect(doc["modelAnswer"]).toBeUndefined();
    expect(doc["evaluationGuidance"]).toBeUndefined();
    const rubric = doc["rubric"] as Record<string, unknown>;
    expect(rubric["modelAnswer"]).toBe("V = IR");
    expect(rubric["evaluatorGuidance"]).toBe("Partial credit for a worded statement.");
  });
});
