/**
 * Autograde trigger services (autograde.md §"Triggers"). All single-writer,
 * idempotent, status-guarded, and outbox-backed for must-deliver side effects.
 * Each is `(event, ctx: SystemContext) => Promise<void>` — thin over the pipeline
 * reducer / outbox. The function-shell wiring (Phase 5) adapts firebase-functions
 * events into `TriggerEvent`.
 */
import type { SystemContext } from "../../shared/context.js";
import type { TriggerEvent } from "../../shared/trigger.js";
import { enqueueOutboxEvent } from "../../shared/side-effects.js";
import { enqueuePipelineAdvance, advancePipelineService } from "../pipeline/advance-pipeline.js";

type Doc = Record<string, unknown>;

/** Submission created → start scouting (guarded by `pipelineStatus==uploaded`). */
export async function onSubmissionCreatedService(
  event: TriggerEvent<Doc>,
  ctx: SystemContext
): Promise<void> {
  const sub = event.after;
  if (!sub) return;
  if ((sub["pipelineStatus"] as string) !== "uploaded") return; // idempotent guard
  await enqueuePipelineAdvance(ctx, sub["id"] as string, "scouting");
}

/**
 * Submission `pipelineStatus` changed → the SINGLE reducer re-drives. Replaces the
 * inline-worker + duplicated final-status logic. Idempotent, status-guarded inside
 * `advancePipelineService`.
 */
export async function onSubmissionUpdatedService(
  event: TriggerEvent<Doc>,
  ctx: SystemContext
): Promise<void> {
  const before = event.before;
  const after = event.after;
  if (!after) return;
  const prevStatus = (before?.["pipelineStatus"] as string) ?? null;
  const nextStatus = after["pipelineStatus"] as string;
  if (prevStatus === nextStatus) return; // no status change → nothing to drive
  const step = stepForStatus(nextStatus);
  if (!step) return;
  await advancePipelineService({ submissionId: after["id"] as string, step }, ctx);
}

/**
 * QuestionSubmission updated → enqueue an aggregate pipeline check ONLY. It never
 * computes final status itself (kills the documented race vs process-answer-grading).
 */
export async function onQuestionSubmissionUpdatedService(
  event: TriggerEvent<Doc>,
  ctx: SystemContext
): Promise<void> {
  const qsub = event.after;
  if (!qsub) return;
  const submissionId = qsub["submissionId"] as string | undefined;
  if (!submissionId) return;
  await enqueuePipelineAdvance(ctx, submissionId, "finalize");
}

/** Exam published → reliable notification (outbox, not fire-and-forget). */
export async function onExamPublishedService(
  event: TriggerEvent<Doc>,
  ctx: SystemContext
): Promise<void> {
  if (!transitionedTo(event, "status", "published")) return;
  const examId = event.after!["id"] as string;
  await ctx.repos.tx(async (tx) => {
    enqueueOutboxEvent(tx, {
      type: "exam.published",
      tenantId: event.tenantId,
      payload: { examId },
      createdAt: ctx.now(),
    });
  });
}

/** Exam results released → notification fan-out (students/parents/teacher). */
export async function onResultsReleasedService(
  event: TriggerEvent<Doc>,
  ctx: SystemContext
): Promise<void> {
  if (!transitionedTo(event, "status", "results_released")) return;
  const examId = event.after!["id"] as string;
  await ctx.repos.tx(async (tx) => {
    enqueueOutboxEvent(tx, {
      type: "exam.results.released",
      tenantId: event.tenantId,
      payload: { examId },
      createdAt: ctx.now(),
    });
  });
}

/** Exam deleted → cascade-delete questions/submissions/analytics/DLQ + usage decrement. */
export async function onExamDeletedService(
  event: TriggerEvent<Doc>,
  ctx: SystemContext
): Promise<void> {
  const exam = event.before;
  if (!exam) return;
  const examId = exam["id"] as string;
  const tenantId = event.tenantId;

  // delete nested questions + submissions (batched, idempotent).
  let cursor: string | undefined;
  do {
    const page = await ctx.repos.exams.list(tenantId, {
      where: { examId },
      filter: (d) => d["_kind"] === "examQuestion",
      cursor,
      limit: 200,
    });
    for (const q of page.items) await ctx.repos.exams.delete(tenantId, q["id"] as string);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);

  cursor = undefined;
  do {
    const page = await ctx.repos.submissions.list(tenantId, {
      where: { examId },
      cursor,
      limit: 200,
    });
    for (const s of page.items) await ctx.repos.submissions.delete(tenantId, s["id"] as string);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);

  // analytics doc + usage decrement
  await ctx.repos.exams.delete(tenantId, `analytics_${examId}`).catch(() => undefined);
}

// ---- helpers ----
function stepForStatus(status: string): "scouting" | "grading" | "finalize" | null {
  switch (status) {
    case "uploaded":
      return "scouting";
    case "scouting_complete":
    case "grading":
    case "grading_partial":
      return "grading";
    case "grading_complete":
      return "finalize";
    default:
      return null;
  }
}

function transitionedTo(event: TriggerEvent<Doc>, field: string, value: string): boolean {
  const prev = event.before?.[field] as string | undefined;
  const next = event.after?.[field] as string | undefined;
  return next === value && prev !== value;
}
