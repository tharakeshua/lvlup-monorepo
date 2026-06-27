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

  return { id: input.examId, releasedCount, created: false } as Res;
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
