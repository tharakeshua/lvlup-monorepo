/**
 * Live two-pass extraction pipeline — RTDB phase projection + rubricStatus.
 *
 * Verifies the extraction service drives the slim `extractionProgress` ticker
 * through its phases in order (extracting_questions → questions_extracted →
 * generating_rubrics → complete), ticks the rubric counter per batch, persists
 * `rubricStatus` per question, and NEVER puts ⚷ content on the projection payload.
 */
import { describe, it, expect } from "vitest";
import { makeAuthContext } from "../../../../tests/sdk/harness/auth-context";
import { extractQuestionsService } from "./extract-questions";
import type { ExtractionStatusProjection } from "./pipeline/extraction-projection";

const PAGES = ["tenants/t/exams/exam_x/paper/p1.jpg"];

const QUESTIONS = [
  { text: "Q1", maxMarks: 5, order: 1 },
  { text: "Q2", maxMarks: 5, order: 2 },
  { text: "Q3", maxMarks: 5, order: 3 },
];

const rubricFor = (order: number) => ({
  order,
  rubric: {
    scoringMode: "criteria_based",
    criteria: [{ id: "c1", name: "Correctness", maxScore: 5 }],
    modelAnswer: `a${order}`,
    evaluatorGuidance: "grade strictly",
  },
});

function makeCtxWithSpy() {
  const ctx = makeAuthContext("teacher");
  const statuses: ExtractionStatusProjection[] = [];
  let rubricsGenerated = 0;
  (ctx.repos as unknown as Record<string, unknown>)["extractionProjections"] = {
    async setStatus(_t: string, _e: string, s: ExtractionStatusProjection) {
      rubricsGenerated = s.rubricsGenerated;
      statuses.push({ ...s });
    },
    async bumpRubrics(_t: string, _e: string, delta: number, now: string) {
      rubricsGenerated += delta;
      statuses.push({
        examId: "exam_x",
        phase: "generating_rubrics",
        totalQuestions: QUESTIONS.length,
        rubricsGenerated,
        updatedAt: now,
      });
    },
  };
  ctx.ai.onGenerate("examQuestionExtraction", { json: QUESTIONS });
  ctx.ai.onGenerate("examRubricGeneration", { json: QUESTIONS.map((q) => rubricFor(q.order)) });
  return { ctx, statuses };
}

async function seed(ctx: ReturnType<typeof makeAuthContext>) {
  const tenantId = ctx.tenantId!;
  await ctx.repos.exams.upsert(tenantId, {
    id: "exam_x",
    title: "Midterm",
    examType: "standard",
    totalMarks: 15,
    status: "question_paper_uploaded",
    questionPaper: { images: PAGES, extractedAt: null, questionCount: 0, examType: "standard" },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  return tenantId;
}

describe("live extraction pipeline — phase projection", () => {
  it("projects phases in order and ticks the rubric counter", async () => {
    const { ctx, statuses } = makeCtxWithSpy();
    await seed(ctx);
    await extractQuestionsService({ examId: "exam_x" }, ctx);

    const phases = statuses.map((s) => s.phase);
    expect(phases[0]).toBe("extracting_questions");
    expect(phases).toContain("questions_extracted");
    expect(phases).toContain("generating_rubrics");
    expect(phases[phases.length - 1]).toBe("complete");
    // Ends with all rubrics counted.
    expect(statuses[statuses.length - 1]!.rubricsGenerated).toBe(3);
    // Slim payload — never ⚷ content.
    for (const s of statuses) {
      expect(JSON.stringify(s)).not.toContain("evaluatorGuidance");
      expect(JSON.stringify(s)).not.toContain("modelAnswer");
    }
  });

  it("persists rubricStatus generated after rubric generation", async () => {
    const { ctx } = makeCtxWithSpy();
    const tenantId = await seed(ctx);
    await extractQuestionsService({ examId: "exam_x" }, ctx);

    const page = await ctx.repos.exams.list(tenantId, {
      filter: (d) => d["_kind"] === "examQuestion",
      limit: 100,
    });
    expect(page.items).toHaveLength(3);
    for (const q of page.items) {
      expect(q["rubricStatus"]).toBe("generated");
      expect((q["rubric"] as Record<string, unknown>)["evaluatorGuidance"]).toBe("grade strictly");
    }
  });

  it("mode:'rubrics' resumes only pending questions (skips Pass 1)", async () => {
    const { ctx } = makeCtxWithSpy();
    const tenantId = await seed(ctx);
    // Pre-seed: one generated, one pending question.
    await ctx.repos.exams.upsert(tenantId, {
      id: "exam_x_q1",
      examId: "exam_x",
      text: "Q1",
      maxMarks: 5,
      order: 1,
      rubric: { scoringMode: "criteria_based", criteria: [] },
      rubricStatus: "generated",
      _kind: "examQuestion",
    });
    await ctx.repos.exams.upsert(tenantId, {
      id: "exam_x_q2",
      examId: "exam_x",
      text: "Q2",
      maxMarks: 5,
      order: 2,
      rubric: { scoringMode: "criteria_based", criteria: [] },
      rubricStatus: "pending",
      _kind: "examQuestion",
    });
    ctx.ai.calls.length = 0;

    await extractQuestionsService({ examId: "exam_x", mode: "rubrics" }, ctx);

    // No Pass-1 (examQuestionExtraction) call in resume mode.
    expect(ctx.ai.calls.some((c) => c.promptKey === "examQuestionExtraction")).toBe(false);
    expect(ctx.ai.calls.some((c) => c.promptKey === "examRubricGeneration")).toBe(true);
    const q2 = await ctx.repos.exams.get(tenantId, "exam_x_q2");
    expect(q2!["rubricStatus"]).toBe("generated");
  });

  it("full run sets questionPaper.rubricsGeneratedAt once every rubric generated", async () => {
    const { ctx } = makeCtxWithSpy();
    const tenantId = await seed(ctx);
    await extractQuestionsService({ examId: "exam_x" }, ctx);

    const exam = await ctx.repos.exams.get(tenantId, "exam_x");
    const paper = exam!["questionPaper"] as Record<string, unknown>;
    // The rubric-completion gate field is set → uploadAnswerSheets becomes eligible.
    expect(paper["rubricsGeneratedAt"]).toBeTruthy();
    // Pass-1 fields survive the finalize write (never clobbered).
    expect(paper["extractedAt"]).toBeTruthy();
    expect(paper["questionCount"]).toBe(3);
  });

  it("rubrics-resume projects FULL totals with the already-generated count seeded", async () => {
    const { ctx, statuses } = makeCtxWithSpy();
    const tenantId = await seed(ctx);
    // 3 docs: 2 already generated, 1 pending → resume regenerates only the 1.
    await ctx.repos.exams.upsert(tenantId, {
      id: "exam_x_q1",
      examId: "exam_x",
      text: "Q1",
      maxMarks: 5,
      order: 1,
      rubric: { scoringMode: "criteria_based", criteria: [] },
      rubricStatus: "generated",
      _kind: "examQuestion",
    });
    await ctx.repos.exams.upsert(tenantId, {
      id: "exam_x_q2",
      examId: "exam_x",
      text: "Q2",
      maxMarks: 5,
      order: 2,
      rubric: { scoringMode: "criteria_based", criteria: [] },
      rubricStatus: "generated",
      _kind: "examQuestion",
    });
    await ctx.repos.exams.upsert(tenantId, {
      id: "exam_x_q3",
      examId: "exam_x",
      text: "Q3",
      maxMarks: 5,
      order: 3,
      rubric: { scoringMode: "criteria_based", criteria: [] },
      rubricStatus: "pending",
      _kind: "examQuestion",
    });
    statuses.length = 0;

    await extractQuestionsService({ examId: "exam_x", mode: "rubrics" }, ctx);

    // Every projection carries the WHOLE-exam total (3), not the pending-only count (1).
    for (const s of statuses) expect(s.totalQuestions).toBe(3);
    // Rubric counter is SEEDED at the 2 already-generated, not restarted at 0…
    const generating = statuses.find((s) => s.phase === "generating_rubrics");
    expect(generating!.rubricsGenerated).toBe(2);
    // …and ends at the full 3 (2 seed + 1 bumped).
    expect(statuses[statuses.length - 1]!.rubricsGenerated).toBe(3);
    // All docs now generated → the gate opens.
    const exam = await ctx.repos.exams.get(tenantId, "exam_x");
    expect((exam!["questionPaper"] as Record<string, unknown>)["rubricsGeneratedAt"]).toBeTruthy();
  });

  it("single-mode re-extract with other pending questions does NOT open the gate", async () => {
    const { ctx } = makeCtxWithSpy();
    const tenantId = await seed(ctx);
    // A prior partial rubric run left q2 pending; q1 generated.
    await ctx.repos.exams.upsert(tenantId, {
      id: "exam_x_q1",
      examId: "exam_x",
      text: "Q1",
      maxMarks: 5,
      order: 1,
      rubric: { scoringMode: "criteria_based", criteria: [] },
      rubricStatus: "generated",
      _kind: "examQuestion",
    });
    await ctx.repos.exams.upsert(tenantId, {
      id: "exam_x_q2",
      examId: "exam_x",
      text: "Q2",
      maxMarks: 5,
      order: 2,
      rubric: { scoringMode: "criteria_based", criteria: [] },
      rubricStatus: "pending",
      _kind: "examQuestion",
    });
    // Single-mode Pass 1 re-extracts just question 1.
    ctx.ai.onGenerate("examQuestionExtraction", { json: [{ text: "Q1", maxMarks: 5, order: 1 }] });
    ctx.ai.onGenerate("examRubricGeneration", { json: [rubricFor(1)] });

    const res = await extractQuestionsService(
      { examId: "exam_x", mode: "single", questionNumber: "1" },
      ctx
    );

    // q2 is still pending → the exam is NOT rubric-complete, so the gate stays closed.
    const exam = await ctx.repos.exams.get(tenantId, "exam_x");
    expect((exam!["questionPaper"] as Record<string, unknown>)["rubricsGeneratedAt"]).toBeFalsy();
    expect((res as { warnings: string[] }).warnings).toContain(
      "exam still has questions awaiting rubric generation"
    );
  });
});
