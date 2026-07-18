/**
 * FIX-1 P0-B/P0-C — the pipeline's AI image seam.
 *
 *  - Scouting passes answer-sheet pages as `{ storagePath }` refs and satisfies
 *    the `answerMapping` requiredVariables (registry contract).
 *  - The mapping INVARIANT: `mapping.imageUrls` carries the REAL storage paths of
 *    the pages the scout routed to each question (was HARDCODED `[]` — P0-C).
 *  - RELMS grading passes the mapped pages as images and satisfies the
 *    `answerGrading` requiredVariables (was {questionId, mapping} — hallucination).
 *  - An UNMAPPED question is never AI-graded blind: it routes to needs_review.
 *  - Scouting failures DLQ (pipelineError + scouting_failed + gradingDeadLetter
 *    with a real `attempts` count) instead of silently stranding the submission.
 *  - Re-scouting UPSERTS question-submissions (deterministic ids), never duplicates.
 */
import { describe, it, expect } from "vitest";
import { PROMPTS } from "@levelup/ai";
import { makeSystemContext } from "../../../../../tests/sdk/harness/auth-context";
import { processAnswerMappingService } from "./process-answer-mapping";
import { processAnswerGradingService } from "./process-answer-grading";
import { advancePipelineService } from "./advance-pipeline";
import { listQuestionSubmissions } from "./questions";

const TENANT = "tenant_contract";
const TS = "2026-01-01T00:00:00.000Z";
const PAGES = ["v2_t/sub/pages/p0.jpg", "v2_t/sub/pages/p1.jpg", "v2_t/sub/pages/p2.jpg"];

const GRADE_JSON = {
  score: 4,
  maxScore: 5,
  confidence: 0.95,
  feedback: "good",
  breakdown: [],
};

// Scout v2 is per-page: page 0 → q1, page 1 → q2, page 2 → q1 (⇒ q1:[0,2], q2:[1],
// the same routing the old monolithic scout produced).
const PER_PAGE_Q: Record<number, string | null> = { 0: "q1", 1: "q2", 2: "q1" };

function pageResponder(perPage: Record<number, string | null>) {
  return (input: { variables?: unknown }) => {
    const pageIndex = (input.variables as { pageIndex: number }).pageIndex;
    const qid = perPage[pageIndex] ?? null;
    return {
      json: {
        pageIndex,
        foundContent: qid
          ? [{ questionId: qid, matchType: "explicit_marker", confidence: 0.9, isPartial: false }]
          : [],
        hasUnknownContent: qid === null,
      },
    };
  };
}

function makeCtx() {
  const ctx = makeSystemContext(TENANT, { clockIso: TS });
  ctx.ai.onGenerate("answerMappingPage", pageResponder(PER_PAGE_Q));
  // Grading converged on the `unifiedEvaluation` prompt (evaluation session).
  ctx.ai.onGenerate("unifiedEvaluation", { json: GRADE_JSON });
  return ctx;
}

async function seed(ctx: ReturnType<typeof makeCtx>, opts: { pages?: string[] } = {}) {
  await ctx.repos.exams.upsert(TENANT, {
    id: "exam_1",
    title: "Midterm",
    totalMarks: 10,
    status: "grading",
    createdAt: TS,
    updatedAt: TS,
  });
  for (const [i, qid] of (["q1", "q2"] as const).entries()) {
    await ctx.repos.exams.upsert(TENANT, {
      id: qid,
      examId: "exam_1",
      text: `Question ${qid}`,
      maxMarks: 5,
      order: i + 1,
      rubric: { criteria: [] },
      _kind: "examQuestion",
    });
  }
  await ctx.repos.submissions.upsert(TENANT, {
    id: "sub_1",
    examId: "exam_1",
    studentId: "student_1",
    pipelineStatus: "uploaded",
    answerSheets: { images: opts.pages ?? PAGES },
    summary: {},
  });
}

describe("FIX-1 — scouting (processAnswerMapping)", () => {
  it("P0-B: scout runs ONE call per page, each { storagePath } ref + satisfies requiredVariables", async () => {
    const ctx = makeCtx();
    await seed(ctx);
    await processAnswerMappingService({ submissionId: "sub_1" }, ctx);

    const calls = ctx.ai.calls.filter((c) => c.promptKey === "answerMappingPage");
    expect(calls).toHaveLength(PAGES.length); // per-page fan-out, not one monolithic call

    for (const call of calls) {
      const variables = call["variables"] as Record<string, unknown>;
      for (const required of PROMPTS.answerMappingPage.requiredVariables) {
        expect(variables[required], `variable "${required}"`).not.toBeUndefined();
      }
      expect(variables["pageCount"]).toBe(3);
      const images = call["images"] as Record<string, unknown>[];
      expect(images).toHaveLength(1); // exactly the one page for this call
      for (const img of images) expect(img["base64"]).toBeUndefined();
    }
    // Every page (by zero-based index) got exactly one call carrying its real path.
    const seen = new Map<number, string>();
    for (const call of calls) {
      const idx = (call["variables"] as Record<string, unknown>)["pageIndex"] as number;
      const img = (call["images"] as Record<string, unknown>[])[0]!;
      seen.set(idx, img["storagePath"] as string);
    }
    expect([...seen.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1])).toEqual(PAGES);
  });

  it("the scout requests a REAL structured schema (not empty `{type:object}`) so Gemini can emit foundContent", async () => {
    // A bare `{ type: "object" }` schema makes Gemini's constrained JSON decoder
    // return an empty `{}` for every page → the scout maps nothing and every page
    // orphans (prod regression). The schema MUST describe the foundContent shape.
    const ctx = makeCtx();
    await seed(ctx);
    await processAnswerMappingService({ submissionId: "sub_1" }, ctx);

    const call = ctx.ai.calls.find((c) => c.promptKey === "answerMappingPage")!;
    const schema = call["responseSchema"] as Record<string, unknown>;
    const props = schema?.["properties"] as Record<string, unknown> | undefined;
    expect(props, "responseSchema.properties must be defined").not.toBeUndefined();
    // foundContent must be an array of {questionId, matchType(enum), confidence, isPartial}.
    const found = props!["foundContent"] as Record<string, unknown>;
    expect(found["type"]).toBe("array");
    const itemProps = (found["items"] as Record<string, unknown>)["properties"] as Record<
      string,
      unknown
    >;
    expect(Object.keys(itemProps).sort()).toEqual([
      "confidence",
      "isPartial",
      "matchType",
      "questionId",
    ]);
    expect((itemProps["matchType"] as Record<string, unknown>)["enum"]).toEqual([
      "explicit_marker",
      "semantic_context",
      "continuation",
      "mixed",
    ]);
    expect(props!["hasUnknownContent"]).toEqual({ type: "boolean" });
  });

  it("P0-C invariant: mapping.imageUrls = the REAL storage paths of the routed pages", async () => {
    const ctx = makeCtx();
    await seed(ctx);
    await processAnswerMappingService({ submissionId: "sub_1" }, ctx);

    const qsubs = await listQuestionSubmissions(ctx, TENANT, "sub_1");
    expect(qsubs).toHaveLength(2);
    const byQ = new Map(
      qsubs.map((q) => [q["questionId"], q["mapping"] as Record<string, unknown>])
    );
    expect(byQ.get("q1")!["imageUrls"]).toEqual([PAGES[0], PAGES[2]]); // zero-based routing
    expect(byQ.get("q1")!["pageIndices"]).toEqual([0, 2]);
    expect(byQ.get("q2")!["imageUrls"]).toEqual([PAGES[1]]);
  });

  it("re-scouting UPSERTS question-submissions (deterministic ids) — never duplicates", async () => {
    const ctx = makeCtx();
    await seed(ctx);
    await processAnswerMappingService({ submissionId: "sub_1" }, ctx);
    await processAnswerMappingService({ submissionId: "sub_1" }, ctx);

    const qsubs = await listQuestionSubmissions(ctx, TENANT, "sub_1");
    expect(qsubs).toHaveLength(2); // NOT 4
    expect(qsubs.map((q) => q["id"]).sort()).toEqual(["sub_1_q1", "sub_1_q2"]);
  });

  it("fails FAILED_PRECONDITION when the submission has no answer-sheet images", async () => {
    const ctx = makeCtx();
    await seed(ctx, { pages: [] });
    await expect(processAnswerMappingService({ submissionId: "sub_1" }, ctx)).rejects.toMatchObject(
      { code: "FAILED_PRECONDITION" }
    );
  });
});

describe("MAPSNIPE-1 — scout v2 per-page fan-out + aggregation", () => {
  it("a per-page scout failure degrades that page to unmapped — the scout never fails wholesale", async () => {
    const ctx = makeCtx();
    // page 1 ALWAYS throws (both attempts) → orphan; page 0→q1, page 2→q2 differ ⇒ no sandwich.
    ctx.ai.onGenerate("answerMappingPage", (input) => {
      const pageIndex = (input.variables as { pageIndex: number }).pageIndex;
      if (pageIndex === 1) throw new Error("scout page 1 boom");
      const qid = pageIndex === 0 ? "q1" : "q2";
      return {
        json: {
          pageIndex,
          foundContent: [
            { questionId: qid, matchType: "explicit_marker", confidence: 0.9, isPartial: false },
          ],
          hasUnknownContent: false,
        },
      };
    });
    await seed(ctx);

    // Does NOT throw despite a page failing.
    await processAnswerMappingService({ submissionId: "sub_1" }, ctx);

    const sub = (await ctx.repos.submissions.get(TENANT, "sub_1"))!;
    const scouting = sub["scoutingResult"] as Record<string, unknown>;
    expect(scouting["unmappedPages"]).toEqual([1]);
    expect(sub["needsScoutReview"]).toBe(true);

    // Both retry attempts ran for the failing page (1 good call each for 0 and 2, 2 for 1).
    expect(ctx.ai.calls.filter((c) => c.promptKey === "answerMappingPage")).toHaveLength(4);

    const qsubs = await listQuestionSubmissions(ctx, TENANT, "sub_1");
    const byQ = new Map(
      qsubs.map((q) => [q["questionId"], q["mapping"] as Record<string, unknown>])
    );
    expect(byQ.get("q1")!["imageUrls"]).toEqual([PAGES[0]]); // still REAL storage paths
    expect(byQ.get("q2")!["imageUrls"]).toEqual([PAGES[2]]);
  });

  it("mixed pages populate mapping.otherQuestionIds on each rider", async () => {
    const ctx = makeCtx();
    // page 0 = mixed q1+q2 ; page 1 = q1 ; page 2 = q2.
    ctx.ai.onGenerate("answerMappingPage", (input) => {
      const pageIndex = (input.variables as { pageIndex: number }).pageIndex;
      const perPage: Record<number, string[]> = { 0: ["q1", "q2"], 1: ["q1"], 2: ["q2"] };
      return {
        json: {
          pageIndex,
          foundContent: (perPage[pageIndex] ?? []).map((questionId) => ({
            questionId,
            matchType: "mixed",
            confidence: 0.9,
            isPartial: false,
          })),
          hasUnknownContent: false,
        },
      };
    });
    await seed(ctx);
    await processAnswerMappingService({ submissionId: "sub_1" }, ctx);

    const qsubs = await listQuestionSubmissions(ctx, TENANT, "sub_1");
    const byQ = new Map(
      qsubs.map((q) => [q["questionId"], q["mapping"] as Record<string, unknown>])
    );
    expect(byQ.get("q1")!["otherQuestionIds"]).toEqual(["q2"]);
    expect(byQ.get("q2")!["otherQuestionIds"]).toEqual(["q1"]);
    // imageUrls still the real page paths the scout routed.
    expect(byQ.get("q1")!["imageUrls"]).toEqual([PAGES[0], PAGES[1]]);
    expect(byQ.get("q2")!["imageUrls"]).toEqual([PAGES[0], PAGES[2]]);
  });
});

describe("FIX-1 — RELMS grading (processAnswerGrading)", () => {
  async function scoutThenGrade() {
    const ctx = makeCtx();
    await seed(ctx);
    await processAnswerMappingService({ submissionId: "sub_1" }, ctx);
    const result = await processAnswerGradingService({ submissionId: "sub_1" }, ctx);
    return { ctx, result };
  }

  it("P0-C: the grading call receives the MAPPED pages as images + valid variables", async () => {
    const { ctx } = await scoutThenGrade();
    const gradeCalls = ctx.ai.calls.filter((c) => c.promptKey === "unifiedEvaluation");
    expect(gradeCalls).toHaveLength(2);

    for (const call of gradeCalls) {
      const variables = call["variables"] as Record<string, unknown>;
      for (const required of PROMPTS.unifiedEvaluation.requiredVariables) {
        expect(variables[required], `variable "${required}"`).not.toBeUndefined();
        expect(variables[required], `variable "${required}"`).not.toBeNull();
      }
      const images = (call["images"] as Record<string, unknown>[]) ?? [];
      expect(images.length).toBeGreaterThan(0); // grading is NEVER image-blind
      for (const img of images) {
        expect(typeof img["storagePath"]).toBe("string");
        expect(img["base64"]).toBeUndefined();
      }
    }
    // q1 was routed pages [0,2] — its grading call carries exactly those pages.
    // The question text ("Question q1") is embedded in the composed evaluationPrompt.
    const q1Call = gradeCalls.find((c) =>
      String((c["variables"] as Record<string, unknown>)["evaluationPrompt"]).includes("q1")
    )!;
    expect((q1Call["images"] as Record<string, unknown>[]).map((i) => i["storagePath"])).toEqual([
      PAGES[0],
      PAGES[2],
    ]);
  });

  it("grades land with scores from the model (no hallucinated empty grades)", async () => {
    const { ctx, result } = await scoutThenGrade();
    expect(result.gradedCount).toBe(2);
    expect(result.failedCount).toBe(0);
    const qsubs = await listQuestionSubmissions(ctx, TENANT, "sub_1");
    for (const q of qsubs) {
      expect((q["evaluation"] as Record<string, unknown>)["score"]).toBe(4);
      expect(q["gradingStatus"]).toBe("graded");
    }
  });

  it("an UNMAPPED question routes to needs_review — never AI-graded blind", async () => {
    const ctx = makeCtx();
    // q2 gets no pages from the scout this time — only page 0 maps (to q1).
    ctx.ai.onGenerate("answerMappingPage", pageResponder({ 0: "q1", 1: null, 2: null }));
    await seed(ctx);
    await processAnswerMappingService({ submissionId: "sub_1" }, ctx);
    const result = await processAnswerGradingService({ submissionId: "sub_1" }, ctx);

    expect(result.gradedCount).toBe(1);
    expect(result.needsReviewCount).toBe(1);
    // Only ONE AI grading call was made (for the mapped q1).
    expect(ctx.ai.calls.filter((c) => c.promptKey === "unifiedEvaluation")).toHaveLength(1);

    const qsubs = await listQuestionSubmissions(ctx, TENANT, "sub_1");
    const q2 = qsubs.find((q) => q["questionId"] === "q2")!;
    expect(q2["gradingStatus"]).toBe("needs_review");
    expect((q2["evaluation"] as Record<string, unknown>)["score"]).toBe(0);
    expect((q2["evaluation"] as Record<string, unknown>)["confidence"]).toBe(0);
  });
});

describe("FIX-1 — scouting failures DLQ (advancePipeline)", () => {
  it("scouting failure → pipelineError + scouting_failed + DLQ entry with attempts", async () => {
    const ctx = makeCtx();
    await seed(ctx, { pages: [] }); // no pages ⇒ scouting throws FAILED_PRECONDITION

    await advancePipelineService({ submissionId: "sub_1", step: "scouting" }, ctx);

    const sub = (await ctx.repos.submissions.get(TENANT, "sub_1"))!;
    expect(sub["pipelineStatus"]).toBe("scouting_failed"); // not stuck at 'scouting'
    const pipelineError = sub["pipelineError"] as Record<string, unknown>;
    expect(pipelineError["step"]).toBe("scouting");
    expect(String(pipelineError["message"])).toContain("no answer-sheet images");
    expect(sub["scoutingRetryCount"]).toBe(1);

    const rows = await ctx.repos.outbox.drain(TENANT);
    const dlq = rows.find((r) => r["_kind"] === "gradingDeadLetter")!;
    expect(dlq).toBeDefined();
    expect(dlq["pipelineStep"]).toBe("scouting");
    expect(dlq["attempts"]).toBe(1); // never the clobbered 0
  });
});
