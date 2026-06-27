/**
 * Analytics trigger services (analytics.md §"Triggers", restructured per
 * be-analytics §5 rec #2). Single-writer + idempotent + outbox; the multi-step
 * fan-out is collapsed into the queued `recomputeOrchestrator`. Each is
 * `(event, ctx: SystemContext) => Promise<void>`.
 */
import type { SystemContext } from "../../shared/context.js";
import type { TriggerEvent } from "../../shared/trigger.js";
import { enqueueOutboxEvent } from "../../shared/side-effects.js";
import { recomputeStudentSummaryService, recomputeExamAnalyticsService } from "../recompute.js";
import { recomputeOrchestratorService } from "../orchestrator.js";

type Doc = Record<string, unknown>;

/** Statuses that mean a submission is graded (shared enum, not a local string set). */
const GRADED_PIPELINE_STATUSES = new Set(["ready_for_review", "reviewed"]);

/**
 * Submission transitioned INTO a graded `pipelineStatus` → recompute the student's
 * autograde section (single-writer) then enqueue the orchestrator. Idempotent on
 * (submissionId, status).
 */
export async function onSubmissionGradedService(
  event: TriggerEvent<Doc>,
  ctx: SystemContext
): Promise<void> {
  const before = event.before;
  const after = event.after;
  if (!after) return;
  const prev = before?.["pipelineStatus"] as string | undefined;
  const next = after["pipelineStatus"] as string;
  if (!GRADED_PIPELINE_STATUSES.has(next) || GRADED_PIPELINE_STATUSES.has(prev ?? "")) return;

  const studentId = after["studentId"] as string;
  await recomputeStudentSummaryService(
    { tenantId: event.tenantId, studentId, section: "autograde" },
    ctx
  );
  await enqueueOrchestrator(ctx, event.tenantId, studentId, "autograde");
}

/**
 * Space progress written → recompute the levelup section + the leaderboard
 * story-point diff (merged), then enqueue the orchestrator. MERGES the two old
 * triggers that both wrote the same summary.
 */
export async function onSpaceProgressUpdatedService(
  event: TriggerEvent<Doc>,
  ctx: SystemContext
): Promise<void> {
  const after = event.after;
  if (!after) return;
  const studentId =
    (after["userId"] as string | undefined) ?? (after["studentId"] as string | undefined);
  if (!studentId) return;
  await recomputeStudentSummaryService(
    { tenantId: event.tenantId, studentId, section: "levelup" },
    ctx
  );
  await enqueueOrchestrator(ctx, event.tenantId, studentId, "levelup");
}

/**
 * Exam results released → recompute exam analytics (single-writer per doc) +
 * outbox results-released notification.
 */
export async function onExamResultsReleasedService(
  event: TriggerEvent<Doc>,
  ctx: SystemContext
): Promise<void> {
  const prev = event.before?.["status"] as string | undefined;
  const next = event.after?.["status"] as string | undefined;
  if (next !== "results_released" || prev === "results_released") return;
  const examId = event.after!["id"] as string;
  await recomputeExamAnalyticsService({ tenantId: event.tenantId, examId }, ctx);
  await ctx.repos.tx(async (tx) => {
    enqueueOutboxEvent(tx, {
      type: "exam.results.released",
      tenantId: event.tenantId,
      payload: { examId },
      createdAt: ctx.now(),
    });
  });
}

/**
 * Cloud Tasks handler — the one `RecomputeMarker` consumer. Thin over the
 * orchestrator service. `(payload, ctx)`.
 */
export async function recomputeOrchestratorHandler(
  payload: {
    tenantId: string;
    studentId: string;
    marker?: { reason: string; requestedAt: string; taskId?: string };
  },
  ctx: SystemContext
): Promise<void> {
  await recomputeOrchestratorService(payload, ctx);
}

async function enqueueOrchestrator(
  ctx: SystemContext,
  tenantId: string,
  studentId: string,
  reason: string
): Promise<void> {
  const hook = (
    ctx as unknown as {
      enqueueRecompute?: (p: {
        tenantId: string;
        studentId: string;
        marker: { reason: string; requestedAt: string; taskId: string };
      }) => Promise<void>;
    }
  ).enqueueRecompute;
  const marker = { reason, requestedAt: ctx.now(), taskId: `${studentId}:${ctx.now()}` };
  if (hook) {
    await hook({ tenantId, studentId, marker });
    return;
  }
  // Inline fallback (emulator / unit test): run the orchestrator directly.
  await recomputeOrchestratorService({ tenantId, studentId, marker }, ctx);
}
