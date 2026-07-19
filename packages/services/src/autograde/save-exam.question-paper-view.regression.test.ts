/**
 * REGRESSION — "Exam not found" after creating an exam WITH an uploaded question
 * paper (teacher-web autograde exam-create wizard).
 *
 * Root cause: the create/upload write path (`saveExamService` → `buildQuestionPaper`)
 * persisted `questionPaper = { images, questionCount, examType }` but OMITTED the
 * strict-schema-REQUIRED (nullable) `extractedAt` key. `getExam` projects the doc
 * verbatim, and the web api-client runs `validateResponses: true`, so the strict
 * `ExamDetailViewSchema` (→ `ExamQuestionPaperSchema`) parse THREW client-side.
 * `useExam` then errored, `exam` was undefined, and `ExamDetailPage` rendered
 * "Exam not found". It only reproduced WHEN a paper was uploaded (otherwise
 * `questionPaper` is null/optional) — exactly the reported symptom.
 *
 * These tests pin BOTH halves of the fix:
 *   1. WRITER  — a freshly-created exam's `questionPaper` satisfies the strict
 *                domain `ExamQuestionPaperSchema` (has `extractedAt: null`).
 *   2. READER  — `getExamService`'s view parses against the WIRE response schema
 *                (`GetExamResponseSchema`) — the exact validation that threw.
 */
import { describe, it, expect } from "vitest";
import { getCallable } from "@levelup/api-contract";
import { ExamQuestionPaperSchema } from "@levelup/domain";
import { makeAuthContext } from "../../../../tests/sdk/harness/auth-context";
import { saveExamService } from "./save-exam";
import { getExamService } from "./reads";

const PAPER_PATH = "tenants/tenant_x/exams/e1/paper/p1.jpg";

describe('"Exam not found" regression — questionPaper view validates', () => {
  it("(writer) create with a question paper persists a strict-valid questionPaper (extractedAt present)", async () => {
    const ctx = makeAuthContext("tenantAdmin");
    const { id } = (await saveExamService(
      { data: { title: "Midterm", subject: "Math", questionPaperImages: [PAPER_PATH] } },
      ctx
    )) as { id: string; created: boolean };

    const persisted = await ctx.repos.exams.get(ctx.tenantId!, id);
    const paper = persisted?.["questionPaper"];
    // The exact key whose absence broke the strict read.
    expect(paper).toMatchObject({ extractedAt: null, questionCount: 0, examType: "standard" });
    // Full strict-schema parse must succeed (this is what threw before the fix).
    expect(ExamQuestionPaperSchema.safeParse(paper).success).toBe(true);
  });

  it("(reader) getExam view parses against the strict wire response schema", async () => {
    const ctx = makeAuthContext("tenantAdmin");
    const { id } = (await saveExamService(
      { data: { title: "Finals", subject: "Physics", questionPaperImages: [PAPER_PATH] } },
      ctx
    )) as { id: string };

    const view = await getExamService({ id: id as never }, ctx);

    // This is the client-side `validateResponses: true` parse that surfaced as
    // "Exam not found" — it must now succeed.
    const def = getCallable("v1.autograde.getExam");
    const parsed = def.responseSchema.safeParse(view);
    expect(parsed.success).toBe(true);
  });

  it("(status) creating an exam WITH a question paper advances draft → question_paper_uploaded", async () => {
    const ctx = makeAuthContext("tenantAdmin");
    const { id } = (await saveExamService(
      { data: { title: "Quiz", subject: "Bio", questionPaperImages: [PAPER_PATH] } },
      ctx
    )) as { id: string };
    const persisted = await ctx.repos.exams.get(ctx.tenantId!, id);
    // Must NOT be stuck in draft — otherwise the detail page never surfaces
    // "Extract Questions" and a later publish fails draft → published.
    expect(persisted?.["status"]).toBe("question_paper_uploaded");
  });

  it("(status) creating an exam WITHOUT a question paper stays draft", async () => {
    const ctx = makeAuthContext("tenantAdmin");
    const { id } = (await saveExamService({ data: { title: "Empty", subject: "Bio" } }, ctx)) as {
      id: string;
    };
    const persisted = await ctx.repos.exams.get(ctx.tenantId!, id);
    expect(persisted?.["status"]).toBe("draft");
  });

  it("(status) adding a question paper to an existing draft advances it to question_paper_uploaded", async () => {
    const ctx = makeAuthContext("tenantAdmin");
    // Mirrors the wizard: create a draft first (no images), then attach the paper.
    const { id } = (await saveExamService({ data: { title: "Wizard", subject: "Bio" } }, ctx)) as {
      id: string;
    };
    expect((await ctx.repos.exams.get(ctx.tenantId!, id))?.["status"]).toBe("draft");

    await saveExamService(
      {
        id: id as never,
        data: { title: "Wizard", subject: "Bio", questionPaperImages: [PAPER_PATH] },
      },
      ctx
    );
    expect((await ctx.repos.exams.get(ctx.tenantId!, id))?.["status"]).toBe(
      "question_paper_uploaded"
    );
  });

  it("(reader) legacy questionPaper missing extractedAt is normalized so the view still validates", async () => {
    const ctx = makeAuthContext("tenantAdmin");
    // Simulate a doc written by the OLD buggy writer (no extractedAt, stray key).
    const { id } = (await saveExamService({ data: { title: "Legacy", subject: "Chem" } }, ctx)) as {
      id: string;
    };
    await ctx.repos.exams.upsert(
      ctx.tenantId!,
      {
        id,
        questionPaper: { images: [PAPER_PATH], questionCount: 3, examType: "standard" },
      },
      ctx.now()
    );

    const view = await getExamService({ id: id as never }, ctx);
    const def = getCallable("v1.autograde.getExam");
    expect(def.responseSchema.safeParse(view).success).toBe(true);
  });
});
