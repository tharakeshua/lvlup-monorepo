/**
 * FIX-1 P0-A/P0-B/P2-H — extractQuestions AI-seam contract.
 *
 *  - P0-A: the service payload SATISFIES the `questionExtraction` template's
 *    `requiredVariables` (the deployed bug: template needed {examTitle, examType}
 *    but the service sent {examId, mode, …} → crash BEFORE Gemini).
 *  - P0-B: question-paper images reach the gateway as `{ storagePath }` refs
 *    (never a storage path smuggled in the `base64` field).
 *  - P2-H: question docs get DETERMINISTIC ids (`{examId}_q{order}`) so a
 *    re-extract UPSERTS instead of duplicating every question.
 */
import { describe, it, expect } from "vitest";
import { PROMPTS } from "@levelup/ai";
import { makeAuthContext } from "../../../../tests/sdk/harness/auth-context";
import { extractQuestionsService } from "./extract-questions";

const TS = "2026-01-01T00:00:00.000Z";
const PAGES = ["v2_tenants/t/exams/exam_x/paper/p1.jpg", "v2_tenants/t/exams/exam_x/paper/p2.jpg"];

const EXTRACTED = [
  { text: "Q1 text", maxMarks: 5, order: 1, rubric: { criteria: [] } },
  { text: "Q2 text", maxMarks: 5, order: 2, rubric: { criteria: [] } },
];

async function seedExam(ctx: ReturnType<typeof makeAuthContext>) {
  const tenantId = ctx.tenantId!;
  await ctx.repos.exams.upsert(tenantId, {
    id: "exam_x",
    title: "Midterm Algebra",
    examType: "standard",
    totalMarks: 10,
    status: "question_paper_uploaded",
    questionPaper: { images: PAGES },
    createdAt: TS,
    updatedAt: TS,
  });
  return tenantId;
}

function makeCtx() {
  const ctx = makeAuthContext("teacher");
  ctx.ai.onGenerate("questionExtraction", { json: EXTRACTED, text: JSON.stringify(EXTRACTED) });
  return ctx;
}

describe("FIX-1 — extractQuestions AI seam", () => {
  it("P0-A: payload satisfies the prompt's requiredVariables (registry contract)", async () => {
    const ctx = makeCtx();
    await seedExam(ctx);
    await extractQuestionsService({ examId: "exam_x" }, ctx);

    const call = ctx.ai.calls[0]!;
    expect(call.promptKey).toBe("questionExtraction");
    const variables = call["variables"] as Record<string, unknown>;
    for (const required of PROMPTS.questionExtraction.requiredVariables) {
      expect(variables[required], `variable "${required}"`).not.toBeUndefined();
      expect(variables[required], `variable "${required}"`).not.toBeNull();
    }
    // The pedagogically-needed values, from the exam doc:
    expect(variables["examTitle"]).toBe("Midterm Algebra");
    expect(variables["examType"]).toBe("standard");
    expect(variables["mode"]).toBe("full");
  });

  it("P0-B: images are passed as { storagePath } refs — never paths in `base64`", async () => {
    const ctx = makeCtx();
    await seedExam(ctx);
    await extractQuestionsService({ examId: "exam_x" }, ctx);

    const images = ctx.ai.calls[0]!["images"] as Record<string, unknown>[];
    expect(images.map((i) => i["storagePath"])).toEqual(PAGES);
    for (const img of images) expect(img["base64"]).toBeUndefined();
  });

  it("P2-H: re-extract UPSERTS (deterministic ids) — question docs never duplicate", async () => {
    const ctx = makeCtx();
    const tenantId = await seedExam(ctx);

    await extractQuestionsService({ examId: "exam_x" }, ctx);
    await extractQuestionsService({ examId: "exam_x" }, ctx); // re-extract

    const page = await ctx.repos.exams.list(tenantId, {
      filter: (d) => d["_kind"] === "examQuestion",
      limit: 100,
    });
    expect(page.items).toHaveLength(2); // NOT 4
    expect(page.items.map((q) => q["id"]).sort()).toEqual(["exam_x_q1", "exam_x_q2"]);
  });

  it("marks the exam extracted with the question count", async () => {
    const ctx = makeCtx();
    const tenantId = await seedExam(ctx);
    const res = await extractQuestionsService({ examId: "exam_x" }, ctx);
    expect(res.success).toBe(true);
    expect(res.questions).toHaveLength(2);

    const exam = await ctx.repos.exams.get(tenantId, "exam_x");
    expect(exam!["status"]).toBe("question_paper_extracted");
    expect((exam!["questionPaper"] as Record<string, unknown>)["questionCount"]).toBe(2);
  });
});
