/**
 * `releaseResultsService` (autograde.md §"Command services"). Carved out of
 * `saveExam`. Flips `resultsReleased` on releasable submissions (pipeline status ∈
 * {grading_complete, ready_for_review, reviewed}), sets the exam to
 * `results_released`, and enqueues an outbox result-release notification — atomic
 * + idempotent. Gated on the SUBMISSION pipeline status only (fixes the
 * `'grading_complete'`-as-exam-status bug). `tenantId` from ctx.
 */
import type { ReqOf, ResOf } from "@levelup/api-contract";
import { authorize, assertTransition } from "@levelup/access";
import type { AuthContext } from "../shared/context.js";
import { requireTenant, fail } from "../shared/context.js";
import { enqueueOutboxEvent } from "../shared/side-effects.js";
import type { ProgressItemUpdate } from "../repo-admin/types.js";
import { applyProgress } from "../levelup/progress-updater.js";
import { listExamQuestions, listQuestionSubmissions } from "./pipeline/questions.js";

type Req = ReqOf<"v1.autograde.releaseResults">;
type Res = ResOf<"v1.autograde.releaseResults">;

const RELEASABLE_PIPELINE_STATUSES = new Set(["grading_complete", "ready_for_review", "reviewed"]);

export async function releaseResultsService(input: Req, ctx: AuthContext): Promise<Res> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "exam.results.release", { examId: input.examId, tenantId });

  const exam = await ctx.repos.exams.get(tenantId, input.examId);
  if (!exam) fail("NOT_FOUND", `exam ${input.examId} not found`);

  const now = ctx.now();
  const currentStatus = (exam["status"] as string) ?? "grading";

  // Exam lifecycle: grading → results_released (idempotent: re-release is a no-op).
  if (currentStatus !== "results_released") {
    assertTransition("exam", currentStatus, "results_released");
  }

  // Gather releasable submissions for this exam (optionally class-scoped).
  const classIds = input.classIds ? new Set<string>(input.classIds as string[]) : null;
  const submissions = await listAllSubmissions(ctx, tenantId, input.examId);
  const releasable = submissions.filter((s) => {
    if (s["resultsReleased"] === true) return false;
    if (classIds && !classIds.has(s["classId"] as string)) return false;
    return RELEASABLE_PIPELINE_STATUSES.has(s["pipelineStatus"] as string);
  });

  let releasedCount = 0;
  for (const sub of releasable) {
    await ctx.repos.submissions.upsert(
      tenantId,
      { id: sub["id"], resultsReleased: true, resultsReleasedAt: now, resultsReleasedBy: ctx.uid },
      now
    );
    releasedCount += 1;
  }

  // Flip the exam + enqueue the reliable notification atomically.
  await ctx.repos.tx(async (tx) => {
    tx.upsert("exams", tenantId, { id: input.examId, status: "results_released" });
    enqueueOutboxEvent(tx, {
      type: "exam.results.released",
      tenantId,
      payload: { examId: input.examId, releasedCount },
      createdAt: now,
    });
  });

  // Reconcile the just-released question-wise results into each student's space
  // progress (EXAM-SPACE-INTEGRATION MVP §C), when this exam has been converted
  // into a space (`createSpaceFromExamService`). Best-effort: per-student failures
  // never block the release itself — the exam status flip above already committed.
  await reconcileReleasedSubmissionsIntoSpace(ctx, tenantId, exam as Doc, releasable);

  return { id: input.examId, releasedCount, created: false } as Res;
}

type Doc = Record<string, unknown>;

/**
 * Fold each released submission's per-question grades into the linked space's
 * `spaceProgress` aggregate (via the single progress writer), keyed by the
 * item the question was converted into (`ExamQuestion.linkedItemId`). A manual
 * override always wins over the AI evaluation score (the teacher's final say).
 */
async function reconcileReleasedSubmissionsIntoSpace(
  ctx: AuthContext,
  tenantId: string,
  exam: Doc,
  releasedSubmissions: Doc[]
): Promise<void> {
  const spaceId = exam["linkedSpaceId"] as string | undefined;
  const storyPointId = exam["linkedStoryPointId"] as string | undefined;
  if (!spaceId || !storyPointId || releasedSubmissions.length === 0) return;

  const examId = String(exam["id"]);
  const questions = await listExamQuestions(ctx, tenantId, examId);
  const linkedItemByQuestionId = new Map<string, string>();
  for (const q of questions) {
    const linkedItemId = q["linkedItemId"] as string | undefined;
    if (linkedItemId) linkedItemByQuestionId.set(String(q["id"]), linkedItemId);
  }
  if (linkedItemByQuestionId.size === 0) return; // exam not yet converted into items

  for (const sub of releasedSubmissions) {
    try {
      const studentId = sub["studentId"] as string | undefined;
      if (!studentId) continue;
      const student = await ctx.repos.students.get(tenantId, studentId);
      const authUid = student?.["authUid"] as string | undefined;
      if (!authUid) continue; // no linked auth account yet — nothing to reconcile into

      const qSubs = await listQuestionSubmissions(ctx, tenantId, String(sub["id"]));
      const items: ProgressItemUpdate[] = [];
      for (const qs of qSubs) {
        const questionId = qs["questionId"] as string | undefined;
        const itemId = questionId ? linkedItemByQuestionId.get(questionId) : undefined;
        if (!itemId) continue;
        const evaluation = qs["evaluation"] as Doc | undefined;
        if (!evaluation) continue;

        const manualOverride = qs["manualOverride"] as Doc | undefined;
        const maxScore = (evaluation["maxScore"] as number | undefined) ?? 0;
        const score =
          (manualOverride?.["score"] as number | undefined) ??
          (evaluation["score"] as number | undefined) ??
          0;
        const correct =
          maxScore > 0
            ? score >= maxScore
            : (evaluation["correctness"] as number | undefined) === 1;

        items.push({ itemId, storyPointId, score, maxScore, correct, evaluation });
      }
      if (items.length > 0) {
        await applyProgress({ userId: authUid, spaceId, items }, ctx);
      }
    } catch {
      // best-effort: a per-student reconciliation failure must never undo the release.
    }
  }
}

/** Page through all submissions for an exam (server N+1 collapse handled in repo). */
export async function listAllSubmissions(
  ctx: AuthContext,
  tenantId: string,
  examId: string
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  let cursor: string | undefined;
  do {
    const page = await ctx.repos.submissions.list(tenantId, {
      where: { examId },
      cursor,
      limit: 200,
    });
    out.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return out;
}
