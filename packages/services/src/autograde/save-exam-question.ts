/**
 * `saveExamQuestionService` (autograde.md §"Command services"). Create/update/delete
 * a single exam question in the flat examQuestion collection. Enforces:
 *   - `exam.write` (teacher/tenantAdmin/staff) authority,
 *   - POST_PUBLISH_LOCKED_FIELDS: structural fields (text, maxMarks, order,
 *     questionType, subQuestions) are locked after publish; rubric is allowed when
 *     `gradingConfig.allowRubricEdit` is true; imageUrls are always allowed,
 *   - Deterministic id `{examId}_q{order}` for creates (idempotent re-upsert),
 *   - `_kind: 'examQuestion'` flat-collection shape (mirrors extract-questions.ts),
 *   - `exam.questionPaper.questionCount` is recomputed after create/delete.
 * `tenantId` from ctx (D2).
 */
import type { ReqOf, ResOf } from "@levelup/api-contract";
import { authorize } from "@levelup/access";
import type { AuthContext } from "../shared/context.js";
import { requireTenant, fail } from "../shared/context.js";
import { validatePathsInTenant } from "./upload-answer-sheets.js";

type Req = ReqOf<"v1.autograde.saveExamQuestion">;
type Res = ResOf<"v1.autograde.saveExamQuestion">;

/** Question fields that may NOT change once an exam is published. */
const QUESTION_POST_PUBLISH_LOCKED_FIELDS = [
  "text",
  "maxMarks",
  "order",
  "questionType",
  "subQuestions",
] as const;

export async function saveExamQuestionService(input: Req, ctx: AuthContext): Promise<Res> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "exam.write", { examId: input.examId, tenantId });

  const exam = await ctx.repos.exams.get(tenantId, input.examId);
  if (!exam) fail("NOT_FOUND", `exam ${input.examId} not found`);

  const examStatus = (exam["status"] as string | undefined) ?? "draft";
  const isPublished =
    examStatus === "published" || examStatus === "grading" || examStatus === "results_released";

  const now = ctx.now();

  // ── DELETE ─────────────────────────────────────────────────────────────────
  if (input.delete === true) {
    if (!input.id) fail("INVALID_ARGUMENT", "id required for delete");
    if (isPublished) {
      fail("FAILED_PRECONDITION", "cannot delete a question from a published exam");
    }
    const existing = await ctx.repos.exams.get(tenantId, input.id);
    if (!existing || existing["_kind"] !== "examQuestion") {
      fail("NOT_FOUND", `question ${input.id} not found`);
    }
    // TxHandle has no delete — repo-level delete is the codebase convention
    // (see autograde/triggers cascade). Count update follows the delete.
    await ctx.repos.exams.delete(tenantId, input.id);
    const paper = exam["questionPaper"] as Record<string, unknown> | undefined;
    const priorCount = (paper?.["questionCount"] as number | undefined) ?? 0;
    if (paper && priorCount > 0) {
      await ctx.repos.exams.upsert(tenantId, {
        id: input.examId,
        questionPaper: { ...paper, questionCount: Math.max(0, priorCount - 1) },
      });
    }
    return { id: input.id, created: false, deleted: true } as Res;
  }

  // ── CREATE / UPDATE ────────────────────────────────────────────────────────
  if (!input.data) fail("INVALID_ARGUMENT", "data required for create/update");

  const data = input.data;

  // imageUrls must be tenant-scoped (mirrors uploadAnswerSheets validation).
  if (data.imageUrls && data.imageUrls.length > 0) {
    validatePathsInTenant(data.imageUrls, tenantId);
  }

  // For creates, require the three identity fields.
  const isCreate = !input.id;
  if (isCreate) {
    if (data.text === undefined) fail("INVALID_ARGUMENT", "data.text required for create");
    if (data.maxMarks === undefined) fail("INVALID_ARGUMENT", "data.maxMarks required for create");
    if (data.order === undefined) fail("INVALID_ARGUMENT", "data.order required for create");
  }

  // Resolve the id (deterministic for creates).
  const questionId = input.id ?? `${input.examId}_q${data.order!}`;

  // Always look up the resolved id: a create at an already-used order hits the
  // same deterministic doc id and must count as an overwrite, not a new row —
  // otherwise questionCount drifts on repeated creates.
  const existing = await ctx.repos.exams.get(tenantId, questionId);
  if (input.id && (!existing || existing["_kind"] !== "examQuestion")) {
    fail("NOT_FOUND", `question ${input.id} not found`);
  }
  if (!input.id && existing && existing["_kind"] !== "examQuestion") {
    fail("FAILED_PRECONDITION", `id ${questionId} collides with a non-question document`);
  }
  const isNewDoc = !existing;

  // POST_PUBLISH_LOCKED enforcement for updates.
  if (isPublished && existing) {
    const gradingConfig = exam["gradingConfig"] as Record<string, unknown> | undefined;
    const allowRubricEdit = gradingConfig?.["allowRubricEdit"] !== false;

    for (const f of QUESTION_POST_PUBLISH_LOCKED_FIELDS) {
      if (f in data && data[f as keyof typeof data] !== undefined) {
        fail("INVALID_ARGUMENT", `question field "${f}" is locked after exam is published`);
      }
    }
    if (!allowRubricEdit && data.rubric !== undefined) {
      fail("INVALID_ARGUMENT", `rubric is locked after exam is published (allowRubricEdit=false)`);
    }
  }

  const payload: Record<string, unknown> = {
    ...(existing ?? {}),
    ...data,
    id: questionId,
    examId: input.examId,
    _kind: "examQuestion",
  };

  await ctx.repos.tx(async (tx) => {
    tx.upsert("exams", tenantId, payload);

    // Recompute questionCount: only genuinely new docs bump the count.
    if (isNewDoc) {
      const paper = exam["questionPaper"] as Record<string, unknown> | undefined;
      const priorCount = (paper?.["questionCount"] as number | undefined) ?? 0;
      tx.upsert("exams", tenantId, {
        id: input.examId,
        questionPaper: {
          ...(paper ?? { images: [], extractedAt: null, examType: "standard" }),
          questionCount: priorCount + 1,
        },
      });
    }
  });

  return { id: questionId, created: isNewDoc } as Res;
}
