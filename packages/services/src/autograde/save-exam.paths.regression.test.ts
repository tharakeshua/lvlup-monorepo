/**
 * REGRESSION — AG-2: v1 autograde accepts Storage PATHS, never URLs.
 *
 * The LEGACY autograde backend validated `questionPaperImages` (and answer-sheet
 * images) with `z.string().url()`, which REJECTED tenant Storage paths like
 * `tenants/{t}/exams/{e}/paper/p1.jpg` and broke exam creation / answer-sheet
 * upload (a P0). The v1 SSOT is a PLAIN storage-path string (see the domain
 * `ExamQuestionPaperSchema.images` doc: "images are tenant storage paths").
 *
 * These tests PIN that invariant across the three v1 layers so the `.url()` P0 can
 * never regress into v1:
 *   1. CONTRACT — the registered wire schemas parse a bare storage path.
 *   2. DOMAIN   — the exam entity schemas carry no `.url()` on image fields.
 *   3. SERVICE  — saveExam / uploadAnswerSheets persist the paths VERBATIM
 *                 (no URL normalization).
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";
import { getCallable } from "@levelup/api-contract";
import { ExamQuestionPaperSchema, ExamQuestionSchema } from "@levelup/domain";
import { makeAuthContext } from "../../../../tests/sdk/harness/auth-context";
import { makeExam } from "../../../../tests/sdk/fakes/entity-factories";
import { saveExamService } from "./save-exam";
import { uploadAnswerSheetsService } from "./upload-answer-sheets";

/** A canonical tenant Storage PATH — NOT a URL. The legacy `.url()` rejected this. */
const PAPER_PATH = "tenants/tenant_x/exams/e1/paper/p1.jpg";

describe("AG-2 — v1 autograde accepts Storage paths, not URLs", () => {
  describe("(1) contract wire schemas parse a bare storage path", () => {
    it("saveExam requestSchema accepts questionPaperImages as storage paths", () => {
      const def = getCallable("v1.autograde.saveExam");
      const res = def.requestSchema.safeParse({
        data: { questionPaperImages: [PAPER_PATH] },
      });
      expect(res.success).toBe(true);
    });

    it("uploadAnswerSheets requestSchema accepts imageUrls as storage paths", () => {
      const def = getCallable("v1.autograde.uploadAnswerSheets");
      const res = def.requestSchema.safeParse({
        examId: "exam_1",
        studentId: "student_1",
        classId: "class_1",
        imageUrls: ["tenants/tenant_x/exams/e1/sheets/s1.jpg"],
      });
      expect(res.success).toBe(true);
    });

    it("documents the P0: a `.url()`-constrained schema WOULD reject the same path", () => {
      // This is exactly the legacy shape that broke exam creation.
      const legacyShape = z.array(z.string().url());
      expect(legacyShape.safeParse([PAPER_PATH]).success).toBe(false);
    });
  });

  describe("(2) domain exam entity schemas carry no `.url()` on image fields", () => {
    it("ExamQuestionPaper.images accepts a bare storage path", () => {
      const res = ExamQuestionPaperSchema.safeParse({
        images: [PAPER_PATH],
        extractedAt: null,
        questionCount: 0,
        examType: "standard",
      });
      expect(res.success).toBe(true);
    });

    it("ExamQuestion.imageUrls accepts bare storage paths", () => {
      const res = ExamQuestionSchema.safeParse({
        id: "examq_1",
        examId: "exam_1",
        text: "Q1",
        imageUrls: ["tenants/tenant_x/exams/e1/questions/q1.jpg"],
        maxMarks: 5,
        order: 0,
        rubric: { mode: "criteria", criteria: [], totalMarks: 5 },
        extractedAt: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      });
      // The image field itself must accept the path (never `.url()`-rejected).
      // (Rubric shape may vary; we only assert the image field is not the failure.)
      const imageIssue = res.success
        ? undefined
        : res.error.issues.find((i) => i.path[0] === "imageUrls");
      expect(imageIssue).toBeUndefined();
    });
  });

  describe("(3) services persist the storage paths VERBATIM (no URL transform)", () => {
    it("saveExamService create stores questionPaperImages verbatim into questionPaper.images", async () => {
      const ctx = makeAuthContext("tenantAdmin");
      const res = (await saveExamService(
        { data: { title: "Midterm", subject: "Math", questionPaperImages: [PAPER_PATH] } },
        ctx
      )) as { id: string; created: boolean };
      expect(res.created).toBe(true);

      const persisted = await ctx.repos.exams.get(ctx.tenantId!, res.id);
      const paper = persisted?.["questionPaper"] as { images: string[] } | undefined;
      // Persisted VERBATIM — byte-for-byte the same path string, no URL normalization.
      expect(paper?.images).toEqual([PAPER_PATH]);
      expect(paper?.images?.[0]).toBe(PAPER_PATH);
      // The raw mutable field is folded into questionPaper, never persisted loose.
      expect(persisted?.["questionPaperImages"]).toBeUndefined();
    });

    it("uploadAnswerSheetsService stores answer-sheet paths verbatim", async () => {
      const ctx = makeAuthContext("scanner");
      // Neutralize the pipeline enqueue seam so the test stays a pure ingest unit.
      (ctx as unknown as { enqueuePipelineAdvance: () => Promise<void> }).enqueuePipelineAdvance =
        async () => {};

      const examId = "exam_e1";
      await ctx.repos.exams.upsert(
        ctx.tenantId!,
        makeExam({ id: examId, tenantId: ctx.tenantId!, status: "published", totalMarks: 10 }),
        ctx.now()
      );

      const paths = [
        `tenants/${ctx.tenantId}/exams/e1/sheets/s1.jpg`,
        `tenants/${ctx.tenantId}/exams/e1/sheets/s2.jpg`,
      ];
      const res = (await uploadAnswerSheetsService(
        {
          examId,
          studentId: "student_sam",
          classId: ctx.classIds[0],
          imageUrls: paths,
        } as never,
        ctx
      )) as { submissionId: string };

      const persisted = await ctx.repos.submissions.get(ctx.tenantId!, res.submissionId);
      const sheets = persisted?.["answerSheets"] as { images: string[] } | undefined;
      expect(sheets?.images).toEqual(paths);
    });
  });
});
