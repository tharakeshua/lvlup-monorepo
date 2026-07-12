/**
 * REGRESSION — saveExamQuestion questionCount drift (Fable review of CC-3).
 *
 * Creates use the deterministic id `{examId}_q{order}`. A second create at the
 * SAME order lands on the SAME doc id (an overwrite), so it must NOT bump
 * `exam.questionPaper.questionCount` a second time and must report
 * `created: false`. Before the fix the count was bumped on every id-less call,
 * drifting the count away from the real number of question docs.
 */
import { describe, it, expect } from "vitest";
import { makeAuthContext } from "../../../../tests/sdk/harness/auth-context";
import { makeExam } from "../../../../tests/sdk/fakes/entity-factories";
import { saveExamQuestionService } from "./save-exam-question";

describe("saveExamQuestion — deterministic-id create is count-idempotent", () => {
  it("re-creating at the same order overwrites the doc and does not double-count", async () => {
    const ctx = makeAuthContext("tenantAdmin");
    const tenantId = ctx.tenantId!;
    const exam = makeExam({
      id: "exam_qc",
      questionPaper: { images: [], extractedAt: null, questionCount: 0, examType: "standard" },
    });
    await ctx.repos.exams.upsert(tenantId, exam);

    const first = (await saveExamQuestionService(
      { examId: "exam_qc", data: { text: "State Ohm's law.", maxMarks: 5, order: 1 } },
      ctx
    )) as { id: string; created: boolean };
    expect(first.created).toBe(true);
    expect(first.id).toBe("exam_qc_q1");

    const second = (await saveExamQuestionService(
      { examId: "exam_qc", data: { text: "State and derive Ohm's law.", maxMarks: 5, order: 1 } },
      ctx
    )) as { id: string; created: boolean };
    expect(second.created).toBe(false);
    expect(second.id).toBe(first.id);

    const examDoc = await ctx.repos.exams.get(tenantId, "exam_qc");
    const paper = examDoc?.["questionPaper"] as { questionCount: number } | undefined;
    expect(paper?.questionCount).toBe(1);

    // The overwrite won: latest text persisted on the same doc.
    const q = await ctx.repos.exams.get(tenantId, first.id);
    expect(q?.["text"]).toBe("State and derive Ohm's law.");
    expect(q?.["_kind"]).toBe("examQuestion");
  });

  it("distinct orders create distinct docs and count both", async () => {
    const ctx = makeAuthContext("tenantAdmin");
    const tenantId = ctx.tenantId!;
    await ctx.repos.exams.upsert(
      tenantId,
      makeExam({
        id: "exam_qc2",
        questionPaper: { images: [], extractedAt: null, questionCount: 0, examType: "standard" },
      })
    );

    await saveExamQuestionService(
      { examId: "exam_qc2", data: { text: "Q1", maxMarks: 2, order: 1 } },
      ctx
    );
    await saveExamQuestionService(
      { examId: "exam_qc2", data: { text: "Q2", maxMarks: 3, order: 2 } },
      ctx
    );

    const examDoc = await ctx.repos.exams.get(tenantId, "exam_qc2");
    const paper = examDoc?.["questionPaper"] as { questionCount: number } | undefined;
    expect(paper?.questionCount).toBe(2);
  });
});
