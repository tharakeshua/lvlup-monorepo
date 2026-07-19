/**
 * Rubric-completion GATE — `uploadAnswerSheets` (ARCHITECTURE-PLAN.md §3.4, owner
 * directive 2026-07-18). An exam becomes eligible for answer-sheet ingestion (and
 * therefore grading) ONLY after rubric generation completes, recorded on
 * `questionPaper.rubricsGeneratedAt`. Uploading before that fails
 * FAILED_PRECONDITION; once the field is set the upload proceeds.
 */
import { describe, it, expect } from "vitest";
import { makeAuthContext } from "../../../../tests/sdk/harness/auth-context";
import { makeExam } from "../../../../tests/sdk/fakes/entity-factories";
import { uploadAnswerSheetsService } from "./upload-answer-sheets";

function makeScannerCtx() {
  const ctx = makeAuthContext("scanner");
  // Neutralize the pipeline enqueue seam so the test stays a pure ingest unit.
  (ctx as unknown as { enqueuePipelineAdvance: () => Promise<void> }).enqueuePipelineAdvance =
    async () => {};
  return ctx;
}

const paperWith = (rubricsGeneratedAt: string | undefined) => ({
  images: [],
  extractedAt: "2026-01-01T00:00:00.000Z",
  questionCount: 2,
  examType: "standard",
  ...(rubricsGeneratedAt ? { rubricsGeneratedAt } : {}),
});

async function seedExam(ctx: ReturnType<typeof makeScannerCtx>, rubricsGeneratedAt?: string) {
  const examId = "exam_gate";
  await ctx.repos.exams.upsert(
    ctx.tenantId!,
    makeExam({
      id: examId,
      tenantId: ctx.tenantId!,
      status: "published",
      totalMarks: 10,
      questionPaper: paperWith(rubricsGeneratedAt),
    }),
    ctx.now()
  );
  return examId;
}

function uploadInput(
  ctx: ReturnType<typeof makeScannerCtx>,
  examId: string,
  overrides: { imageUrls?: string[]; replace?: boolean; studentId?: string } = {}
) {
  return {
    examId,
    studentId: overrides.studentId ?? "student_sam",
    classId: ctx.classIds[0],
    imageUrls: overrides.imageUrls ?? [`tenants/${ctx.tenantId}/exams/${examId}/sheets/s1.jpg`],
    ...(overrides.replace !== undefined ? { replace: overrides.replace } : {}),
  } as never;
}

describe("uploadAnswerSheets — rubric-completion gate", () => {
  it("REJECTS upload before rubricsGeneratedAt is set (rubric generation incomplete)", async () => {
    const ctx = makeScannerCtx();
    const examId = await seedExam(ctx); // no rubricsGeneratedAt
    await expect(uploadAnswerSheetsService(uploadInput(ctx, examId), ctx)).rejects.toMatchObject({
      code: "FAILED_PRECONDITION",
    });
  });

  it("ALLOWS upload once rubricsGeneratedAt is set", async () => {
    const ctx = makeScannerCtx();
    const examId = await seedExam(ctx, "2026-01-02T00:00:00.000Z");
    const res = (await uploadAnswerSheetsService(uploadInput(ctx, examId), ctx)) as {
      submissionId: string;
    };
    expect(res.submissionId).toBeTruthy();
  });

  it("REJECTS upload when the exam has no questionPaper at all", async () => {
    const ctx = makeScannerCtx();
    const examId = "exam_nopaper";
    await ctx.repos.exams.upsert(
      ctx.tenantId!,
      makeExam({ id: examId, tenantId: ctx.tenantId!, status: "published", totalMarks: 10 }),
      ctx.now()
    );
    await expect(uploadAnswerSheetsService(uploadInput(ctx, examId), ctx)).rejects.toMatchObject({
      code: "FAILED_PRECONDITION",
    });
  });
});

describe("uploadAnswerSheets — re-upload / replace semantics", () => {
  const pathsA = (t: string) => [`tenants/${t}/a1.jpg`, `tenants/${t}/a2.jpg`];
  const pathsB = (t: string) => [`tenants/${t}/b1.jpg`];

  it("an identical scanner retry (same paths) DEDUPES to the same submissionId (no double-create)", async () => {
    const ctx = makeScannerCtx();
    const examId = await seedExam(ctx, "2026-01-02T00:00:00.000Z");
    const first = (await uploadAnswerSheetsService(
      uploadInput(ctx, examId, { imageUrls: pathsA(ctx.tenantId!) }),
      ctx
    )) as { submissionId: string; replaced?: boolean };
    const retry = (await uploadAnswerSheetsService(
      uploadInput(ctx, examId, { imageUrls: pathsA(ctx.tenantId!) }),
      ctx
    )) as { submissionId: string; replaced?: boolean };
    expect(retry.submissionId).toBe(first.submissionId);
    // Idempotent replay of the create — no new submission, still exactly one.
    const page = await ctx.repos.submissions.list(ctx.tenantId!, {
      where: { examId },
      filter: (d) => d["_kind"] !== "questionSubmission",
    });
    expect(page.items).toHaveLength(1);
  });

  it("REJECTS a genuine re-upload (new paths) for an existing submission without replace", async () => {
    const ctx = makeScannerCtx();
    const examId = await seedExam(ctx, "2026-01-02T00:00:00.000Z");
    await uploadAnswerSheetsService(
      uploadInput(ctx, examId, { imageUrls: pathsA(ctx.tenantId!) }),
      ctx
    );
    await expect(
      uploadAnswerSheetsService(uploadInput(ctx, examId, { imageUrls: pathsB(ctx.tenantId!) }), ctx)
    ).rejects.toMatchObject({
      code: "FAILED_PRECONDITION",
      meta: { reason: "submission_exists" },
    });
    // Still exactly one submission; its sheets are UNCHANGED (re-upload was rejected).
    const page = await ctx.repos.submissions.list(ctx.tenantId!, {
      where: { examId },
      filter: (d) => d["_kind"] !== "questionSubmission",
    });
    expect(page.items).toHaveLength(1);
    expect((page.items[0]["answerSheets"] as { images: string[] }).images).toEqual(
      pathsA(ctx.tenantId!)
    );
  });

  it("REPLACES in place with replace:true — updates sheets, resets grading, keeps one submission", async () => {
    const ctx = makeScannerCtx();
    const examId = await seedExam(ctx, "2026-01-02T00:00:00.000Z");
    const created = (await uploadAnswerSheetsService(
      uploadInput(ctx, examId, { imageUrls: pathsA(ctx.tenantId!) }),
      ctx
    )) as { submissionId: string };
    // Simulate a graded + released submission (the state a re-upload must not silently destroy).
    await ctx.repos.submissions.upsert(
      ctx.tenantId!,
      {
        id: created.submissionId,
        pipelineStatus: "reviewed",
        resultsReleased: true,
        resultsReleasedAt: ctx.now(),
        summary: {
          totalScore: 8,
          maxScore: 10,
          percentage: 80,
          grade: "A",
          questionsGraded: 2,
          totalQuestions: 2,
          completedAt: ctx.now(),
        },
      },
      ctx.now()
    );

    const res = (await uploadAnswerSheetsService(
      uploadInput(ctx, examId, { imageUrls: pathsB(ctx.tenantId!), replace: true }),
      ctx
    )) as { submissionId: string; replaced?: boolean };

    expect(res.replaced).toBe(true);
    expect(res.submissionId).toBe(created.submissionId); // invariant: same doc, no new submission

    const doc = await ctx.repos.submissions.get(ctx.tenantId!, created.submissionId);
    expect((doc!["answerSheets"] as { images: string[] }).images).toEqual(pathsB(ctx.tenantId!));
    expect(doc!["pipelineStatus"]).toBe("uploaded"); // pipeline reset
    expect(doc!["resultsReleased"]).toBe(false); // release reset — student loses stale grade until re-released
    expect((doc!["summary"] as { totalScore: number }).totalScore).toBe(0); // score reset

    const page = await ctx.repos.submissions.list(ctx.tenantId!, {
      where: { examId },
      filter: (d) => d["_kind"] !== "questionSubmission",
    });
    expect(page.items).toHaveLength(1);
  });

  it("REJECTS a released submission's re-upload with a released-specific message + flag", async () => {
    const ctx = makeScannerCtx();
    const examId = await seedExam(ctx, "2026-01-02T00:00:00.000Z");
    const created = (await uploadAnswerSheetsService(
      uploadInput(ctx, examId, { imageUrls: pathsA(ctx.tenantId!) }),
      ctx
    )) as { submissionId: string };
    await ctx.repos.submissions.upsert(
      ctx.tenantId!,
      { id: created.submissionId, resultsReleased: true, resultsReleasedAt: ctx.now() },
      ctx.now()
    );
    await expect(
      uploadAnswerSheetsService(uploadInput(ctx, examId, { imageUrls: pathsB(ctx.tenantId!) }), ctx)
    ).rejects.toMatchObject({
      code: "FAILED_PRECONDITION",
      meta: { reason: "submission_exists", resultsReleased: true },
    });
  });
});
