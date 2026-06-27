/**
 * `advancePipelineService` — THE single reducer for submission pipeline transitions
 * (autograde.md §"Pipeline / orchestration services"; be-autograde rec #1). Each
 * step does its work, writes its projection, then enqueues the next step (Cloud
 * Tasks, dedupe id `(submissionId, step)`) so retries never double-grade. This
 * replaces the trigger-runs-worker-inline + duplicated final-status logic. The
 * onCall/trigger/task shells call into here; `enqueuePipelineAdvance` is the
 * enqueue seam (real impl is Cloud Tasks via functions-shared; emulator uses the
 * trigger chain — both land here).
 */
import { assertTransition, canTransition } from "@levelup/access";
import type { AuthContext, SystemContext } from "../../shared/context.js";
import { requireTenant, fail } from "../../shared/context.js";
import { processAnswerMappingService } from "./process-answer-mapping.js";
import { processAnswerGradingService } from "./process-answer-grading.js";
import { finalizeSubmissionService } from "./finalize-submission.js";

export type PipelineStep = "scouting" | "grading" | "finalize";

export interface AdvancePipelineInput {
  submissionId: string;
  step: PipelineStep;
}

/**
 * Enqueue the next pipeline step. In production this is a Cloud Tasks enqueue
 * (functions-shared `enqueueTask`); in the emulator the trigger chain re-drives.
 * The dedupe id `(submissionId, step)` keeps it single-writer + idempotent.
 *
 * In this services package we expose it as an injectable seam: if the ctx carries
 * an `enqueuePipelineAdvance` hook (set by functions-shared) we use it, else we run
 * the step inline (the emulator / unit-test path).
 */
export async function enqueuePipelineAdvance(
  ctx: AuthContext,
  submissionId: string,
  step: PipelineStep
): Promise<void> {
  const hook = (ctx as unknown as { enqueuePipelineAdvance?: PipelineEnqueueHook })
    .enqueuePipelineAdvance;
  if (hook) {
    await hook(submissionId, step);
    return;
  }
  // Inline fallback (emulator / unit tests): drive the reducer directly.
  await advancePipelineService({ submissionId, step }, ctx as SystemContext);
}

export type PipelineEnqueueHook = (submissionId: string, step: PipelineStep) => Promise<void>;

/**
 * The single reducer. Guarded by `pipelineStatus`; each branch is idempotent and
 * advances the status via `assertTransition('submission', ...)`.
 */
export async function advancePipelineService(
  input: AdvancePipelineInput,
  ctx: SystemContext
): Promise<void> {
  const tenantId = requireTenant(ctx);
  const sub = await ctx.repos.submissions.get(tenantId, input.submissionId);
  if (!sub) fail("NOT_FOUND", `submission ${input.submissionId} not found`);
  const status = (sub["pipelineStatus"] as string) ?? "uploaded";

  switch (input.step) {
    case "scouting": {
      // uploaded → scouting → scouting_complete
      if (status !== "uploaded" && status !== "scouting") return; // already past; idempotent
      if (status === "uploaded") {
        await setPipelineStatus(ctx, tenantId, input.submissionId, status, "scouting");
      }
      await processAnswerMappingService({ submissionId: input.submissionId }, ctx);
      await setPipelineStatus(ctx, tenantId, input.submissionId, "scouting", "scouting_complete");
      await enqueuePipelineAdvance(ctx, input.submissionId, "grading");
      return;
    }
    case "grading": {
      if (status !== "scouting_complete" && status !== "grading" && status !== "grading_partial") {
        return;
      }
      if (status === "scouting_complete") {
        await setPipelineStatus(ctx, tenantId, input.submissionId, status, "grading");
      } else if (status === "grading_partial") {
        await setPipelineStatus(ctx, tenantId, input.submissionId, status, "grading");
      }
      const result = await processAnswerGradingService({ submissionId: input.submissionId }, ctx);
      const next = result.allGraded ? "grading_complete" : "grading_partial";
      await setPipelineStatus(ctx, tenantId, input.submissionId, "grading", next);
      if (next === "grading_complete") {
        await enqueuePipelineAdvance(ctx, input.submissionId, "finalize");
      }
      return;
    }
    case "finalize": {
      if (status !== "grading_complete" && status !== "finalization_failed") return;
      await finalizeSubmissionService({ submissionId: input.submissionId }, ctx);
      return;
    }
    default:
      fail("INVALID_ARGUMENT", `unknown pipeline step ${String(input.step)}`);
  }
}

/** Transition the submission pipeline status (server ENFORCES the machine). */
async function setPipelineStatus(
  ctx: SystemContext,
  tenantId: string,
  submissionId: string,
  from: string,
  to: string
): Promise<void> {
  if (from === to) return;
  if (!canTransition("submission", from, to)) {
    assertTransition("submission", from, to); // throws with the contract diagnostic
  }
  await ctx.repos.submissions.upsert(tenantId, { id: submissionId, pipelineStatus: to }, ctx.now());
}
