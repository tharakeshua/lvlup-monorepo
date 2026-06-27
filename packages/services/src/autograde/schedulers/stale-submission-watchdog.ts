/**
 * `staleSubmissionWatchdogService` (autograde.md §"Schedulers", every 15 min;
 * be-autograde rec #6). Collection-group scan for submissions stuck in an
 * in-flight pipeline status past a staleness threshold; re-drives them via the
 * single reducer. Idempotent; escalates to `manual_review_needed` after N retries
 * and writes a DLQ entry. `(payload, ctx: SystemContext)`.
 */
import type { SystemContext } from "../../shared/context.js";
import { advancePipelineService } from "../pipeline/advance-pipeline.js";

/** Statuses that should be progressing; if stale they need a re-drive. */
const IN_FLIGHT = new Set(["scouting", "grading", "grading_partial", "grading_complete"]);
const STALE_MS = 15 * 60 * 1000;
const MAX_WATCHDOG_RETRIES = 3;

export interface StaleWatchdogInput {
  /** The tenant to scan (the scheduler fans out per tenant). */
  tenantId: string;
}

export async function staleSubmissionWatchdogService(
  input: StaleWatchdogInput,
  ctx: SystemContext
): Promise<void> {
  const tenantId = input.tenantId;
  const nowMs = Date.parse(ctx.now());
  let cursor: string | undefined;

  do {
    const page = await ctx.repos.submissions.list(tenantId, {
      filter: (d) =>
        d["_kind"] !== "questionSubmission" &&
        IN_FLIGHT.has(d["pipelineStatus"] as string) &&
        isStale(d, nowMs),
      cursor,
      limit: 100,
    });

    for (const sub of page.items) {
      const id = sub["id"] as string;
      const retries = (sub["watchdogRetryCount"] as number) ?? 0;
      if (retries >= MAX_WATCHDOG_RETRIES) {
        await ctx.repos.submissions.upsert(
          tenantId,
          { id, pipelineStatus: "manual_review_needed" },
          ctx.now()
        );
        await ctx.repos.outbox.enqueue(tenantId, {
          _kind: "gradingDeadLetter",
          submissionId: id,
          pipelineStep: stepForStatus(sub["pipelineStatus"] as string),
          error: "stale submission exceeded watchdog retries",
          attempts: retries,
          lastAttemptAt: ctx.now(),
          resolvedAt: null,
          createdAt: ctx.now(),
        });
        continue;
      }
      await ctx.repos.submissions.upsert(
        tenantId,
        { id, watchdogRetryCount: retries + 1 },
        ctx.now()
      );
      const step = stepForStatus(sub["pipelineStatus"] as string);
      if (step) {
        await advancePipelineService({ submissionId: id, step }, ctx).catch(() => undefined);
      }
    }
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
}

function isStale(sub: Record<string, unknown>, nowMs: number): boolean {
  const updatedAt = Date.parse((sub["updatedAt"] as string) ?? "");
  if (Number.isNaN(updatedAt)) return false;
  return nowMs - updatedAt > STALE_MS;
}

function stepForStatus(status: string): "scouting" | "grading" | "finalize" {
  if (status === "scouting") return "scouting";
  if (status === "grading_complete") return "finalize";
  return "grading";
}
