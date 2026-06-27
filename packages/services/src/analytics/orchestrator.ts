/**
 * `recomputeOrchestratorService` — THE collapse of the 4-writer fan-out
 * (analytics.md §"services/server"; be-analytics rec #2). The ONE consumer of the
 * `RecomputeMarker`. Runs in a defined order: class-summary → leaderboard →
 * milestone-notify → at-risk flag. Debounced/queued (Cloud Tasks), dedupes by
 * taskId, and CLEARS the marker. Replaces the 3-triggers-on-one-doc topology.
 */
import type { SystemContext } from "../shared/context.js";
import { fail } from "../shared/context.js";
import { xrepos } from "../shared/extended-repos.js";
import { recomputeClassSummaryService, detectAtRiskService } from "./recompute.js";
import { updateLeaderboardService } from "./leaderboard.js";
import { sendNotificationService } from "./notify.js";

export interface RecomputeOrchestratorInput {
  tenantId: string;
  studentId: string;
  marker?: { reason: string; requestedAt: string; taskId?: string };
}

export async function recomputeOrchestratorService(
  input: RecomputeOrchestratorInput,
  ctx: SystemContext
): Promise<void> {
  const { tenantId, studentId } = input;
  const summary = await xrepos(ctx).studentSummaries.get(tenantId, studentId);
  if (!summary) fail("NOT_FOUND", `no summary for student ${studentId}`);

  // Dedupe by taskId: if the marker has already been consumed (cleared), no-op.
  const marker = summary["recompute"] as { taskId?: string } | undefined;
  if (input.marker?.taskId && marker?.taskId && marker.taskId !== input.marker.taskId) {
    return; // a newer marker superseded this task — let the newer one run
  }

  const now = ctx.now();
  const classIds = (summary["classIds"] as string[] | undefined) ?? [];

  // 1. class-summary (per assigned class)
  for (const classId of classIds) {
    await recomputeClassSummaryService({ tenantId, classId }, ctx);
  }

  // 2. leaderboard
  await updateLeaderboardService(
    {
      tenantId,
      userId: studentId,
      score: Math.round(((summary["overallScore"] as number | undefined) ?? 0) * 1000),
      scope: "tenant",
    },
    ctx
  );

  // 3. at-risk flag (sets flags only)
  await detectAtRiskService({ tenantId, summaries: [summary] }, ctx);

  // 4. milestone-notify (the single notification path — fixes double-notify)
  const refreshed = await xrepos(ctx).studentSummaries.get(tenantId, studentId);
  if (refreshed?.["isAtRisk"] === true) {
    await sendNotificationService(
      {
        tenantId,
        recipientUid: studentId,
        recipientRole: "student",
        type: "at_risk_intervention",
        title: "Support available",
        body: "We noticed you might need some help — let’s get back on track.",
        entityType: "student",
        entityId: studentId,
      },
      ctx
    );
  }

  // clear the marker (single-consumer contract).
  await xrepos(ctx).studentSummaries.upsert(
    tenantId,
    { id: studentId, recompute: null, lastUpdatedAt: now },
    now
  );
}
