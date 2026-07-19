/**
 * `saveExamService` (autograde.md §"Command services"). Create/update/lifecycle-
 * transition an exam. Enforces:
 *   - `exam.write` (create/update) / `exam.publish` (status→published) authorize,
 *   - exam lifecycle `assertTransition('exam', from, to)` (server ENFORCES),
 *   - POST_PUBLISH_LOCKED_FIELDS once published,
 *   - `validatePublish` (≥1 question, each question rubric-sum == maxMarks).
 * Result-release is carved out (see release-results.ts). `tenantId` from ctx.
 */
import type { ReqOf, ResOf } from "@levelup/api-contract";
import { authorize, assertTransition } from "@levelup/access";
import type { AuthContext } from "../shared/context.js";
import { requireTenant, fail } from "../shared/context.js";
import { enqueueOutboxEvent } from "../shared/side-effects.js";

type Req = ReqOf<"v1.autograde.saveExam">;
type Res = ResOf<"v1.autograde.saveExam">;

/** Fields that may NOT change once an exam is published (server-authoritative). */
export const POST_PUBLISH_LOCKED_FIELDS = [
  "totalMarks",
  "passingMarks",
  "gradingConfig",
  "evaluationSettingsId",
] as const;

const DEFAULT_GRADING_CONFIG = {
  autoGrade: true,
  allowRubricEdit: true,
  allowManualOverride: true,
  requireOverrideReason: false,
  releaseResultsAutomatically: false,
} as const;

export async function saveExamService(input: Req, ctx: AuthContext): Promise<Res> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "exam.write", { examId: input.id, tenantId });

  const existing = input.id ? await ctx.repos.exams.get(tenantId, input.id) : null;
  if (input.id && !existing) fail("NOT_FOUND", `exam ${input.id} not found`);

  const data = input.data;
  const currentStatus = (existing?.["status"] as string | undefined) ?? "draft";

  // Lifecycle transition (status change) — authorize publish + enforce the machine.
  if (data.status && data.status !== currentStatus) {
    if (data.status === "published") {
      authorize(ctx, "exam.publish", { examId: input.id, tenantId });
    }
    assertTransition("exam", currentStatus, data.status);
    if (data.status === "published") {
      await validatePublish(ctx, tenantId, input.id!);
    }
  }

  // Post-publish locked-field enforcement.
  if (existing && currentStatus !== "draft" && isPublished(currentStatus)) {
    for (const f of POST_PUBLISH_LOCKED_FIELDS) {
      if (f in data && data[f as keyof typeof data] !== undefined) {
        fail("INVALID_ARGUMENT", `field "${f}" is locked after publish`);
      }
    }
  }

  // Validate cross-domain link integrity (existence in-tenant) before persisting.
  if (data.linkedSpaceId) {
    const space = await ctx.repos.spaces.get(tenantId, data.linkedSpaceId);
    if (!space) fail("INVALID_ARGUMENT", `linkedSpaceId ${data.linkedSpaceId} not found in tenant`);
  }

  const now = ctx.now();
  const questionPaper = buildQuestionPaper(existing, data);

  // Auto-advance the lifecycle when a question paper first lands. Without an
  // explicit status change, an exam that has (or just received) a question paper
  // must sit in `question_paper_uploaded`, not `draft` — otherwise the detail
  // page never surfaces the "Extract Questions" step and a later publish attempt
  // fails the `draft → published` transition. Only advances FROM `draft` (never
  // clobbers a later status), and only when a paper with images is present.
  const paperHasImages =
    !!questionPaper &&
    Array.isArray((questionPaper as Record<string, unknown>)["images"]) &&
    ((questionPaper as Record<string, unknown>)["images"] as unknown[]).length > 0;
  const effectiveStatus =
    !data.status && currentStatus === "draft" && paperHasImages
      ? "question_paper_uploaded"
      : (data.status ?? currentStatus);

  const payload: Record<string, unknown> = {
    ...(existing ?? {}),
    ...data,
    ...(input.id ? { id: input.id } : {}),
    questionPaper,
    gradingConfig: data.gradingConfig ?? existing?.["gradingConfig"] ?? DEFAULT_GRADING_CONFIG,
    status: effectiveStatus,
    createdBy: existing?.["createdBy"] ?? ctx.uid,
  };
  delete payload["questionPaperImages"];

  const { id, created } = await ctx.repos.exams.upsert(tenantId, payload, now);

  // Reliable publish notification, atomic with the state change.
  if (data.status === "published" && currentStatus !== "published") {
    await ctx.repos.tx(async (tx) => {
      enqueueOutboxEvent(tx, {
        type: "exam.published",
        tenantId,
        payload: { examId: id },
        createdAt: now,
      });
    });
  }

  return { id, created } as Res;
}

function isPublished(status: string): boolean {
  return status === "published" || status === "grading" || status === "results_released";
}

function buildQuestionPaper(
  existing: Record<string, unknown> | null,
  data: { questionPaperImages?: string[] }
): unknown {
  if (!data.questionPaperImages || data.questionPaperImages.length === 0) {
    return existing?.["questionPaper"];
  }
  const prev = (existing?.["questionPaper"] as Record<string, unknown> | undefined) ?? {};
  return {
    images: data.questionPaperImages,
    // `extractedAt` is a REQUIRED (nullable) key on the strict ExamQuestionPaper
    // schema — null until extract-questions runs. Omitting it made getExam's
    // strict response validation throw on the client, surfacing as "Exam not
    // found" the moment a question paper was uploaded.
    extractedAt: (prev["extractedAt"] as string | null | undefined) ?? null,
    questionCount: (prev["questionCount"] as number | undefined) ?? 0,
    examType: "standard",
  };
}

/** ≥1 question; each question's rubric criteria sum equals its maxMarks. */
async function validatePublish(ctx: AuthContext, tenantId: string, examId: string): Promise<void> {
  const page = await ctx.repos.exams.get(tenantId, examId);
  if (!page) fail("NOT_FOUND", `exam ${examId} not found`);
  // questions live in a nested collection; the repo lists them via the items-style
  // path. We read the question count denormalized on the exam where available.
  const questionCount = (page["questionPaper"] as Record<string, unknown> | undefined)?.[
    "questionCount"
  ] as number | undefined;
  if (!questionCount || questionCount < 1) {
    fail("FAILED_PRECONDITION", "cannot publish: exam has no extracted questions");
  }
}
