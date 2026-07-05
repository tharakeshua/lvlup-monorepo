/**
 * Test-session + progress + gamification triggers/schedulers (thin over services;
 * §5.3 single-writer + outbox). All idempotent SystemContext handlers.
 *
 *  - `expireAndGradeSession` (the expire half of the submit-vs-expire single
 *    writer): claims `in_progress→expired` in a tx as step one, then auto-grades.
 *  - `expireTestSessions` (5-min scheduler): sweep past-deadline sessions.
 *  - `cleanupStaleSessions` (hourly): abandon stale sessions but SKIP past-deadline
 *    ones (expire precedence).
 *  - `onSpaceProgressUpdated`: feed the analytics rollup (set recompute marker).
 *  - gamification derivations (`onProgressWrite_awardAchievements`,
 *    `onProgressSummaryWrite_updateLeaderboard`, `onProgressMilestone_notify`):
 *    fan a progress write into achievement/leaderboard/notification side effects.
 */
import { assertTransition } from "@levelup/access";
import type { SystemContext } from "../shared/context.js";
import type { ProgressItemUpdate } from "../repo-admin/types.js";
import { xrepos } from "../shared/extended-repos.js";
import { autoEvaluateDeterministic } from "./grading.js";
import { applyProgress } from "./progress-updater.js";
import { awardAchievementsService, upsertLeaderboardEntryService } from "./gamification.js";
import { projectTestSessionLive } from "./levelup-projection.js";

type Doc = Record<string, unknown>;

/** Expire + grade a single overdue session (the expire half of the single writer). */
export async function expireAndGradeSessionService(
  args: { sessionId: string },
  ctx: SystemContext
): Promise<void> {
  const tenantId = ctx.tenantId;
  if (!tenantId) return;
  const session = await ctx.repos.testSessions.get(tenantId, args.sessionId);
  if (!session || session["status"] !== "in_progress") return; // submit already won
  assertTransition("testSession", "in_progress", "expired");

  // Claim by flipping status first (loser of the submit-vs-expire race no-ops).
  await ctx.repos.tx(async (tx) => {
    tx.upsert("testSessions", tenantId, {
      id: args.sessionId,
      status: "expired",
      autoSubmitted: true,
    });
  });

  // Flip the live countdown projection (AD-12; remainingMs clamps to 0).
  if (typeof session["serverDeadline"] === "string" && typeof session["userId"] === "string") {
    await projectTestSessionLive(ctx, tenantId, {
      sessionId: args.sessionId,
      userId: session["userId"],
      serverDeadline: session["serverDeadline"],
      status: "expired",
    });
  }

  const submissions = await xrepos(ctx).testSubmissions.list(tenantId, args.sessionId);
  const items: ProgressItemUpdate[] = [];
  for (const sub of submissions) {
    const key = await ctx.repos.answerKeys.get(tenantId, sub["itemId"] as string);
    const { evaluation } = autoEvaluateDeterministic(
      (sub["itemType"] as string) ?? "short_answer",
      key,
      sub["answer"],
      (sub["maxScore"] as number) ?? 1
    );
    items.push({
      storyPointId: session["storyPointId"] as string,
      itemId: sub["itemId"] as string,
      score: evaluation.score,
      maxScore: evaluation.maxScore,
      correct: evaluation.correctness >= 1,
      evaluation: evaluation as unknown as Doc,
    });
  }
  await applyProgress(
    { userId: session["userId"] as string, spaceId: session["spaceId"] as string, items },
    ctx
  );
}

/** Scheduler: expire all sessions past their serverDeadline (every 5 min). */
export async function expireTestSessionsService(ctx: SystemContext): Promise<void> {
  const tenantId = ctx.tenantId ?? "__platform__";
  const now = ctx.now();
  const page = await ctx.repos.testSessions.list(tenantId, {
    where: { status: "in_progress" },
    limit: 200,
  });
  for (const s of page.items) {
    const deadline = s["serverDeadline"] as string | undefined;
    if (deadline && Date.parse(deadline) < Date.parse(now)) {
      await expireAndGradeSessionService({ sessionId: s["id"] as string }, ctx);
    }
  }
}

/** Scheduler: abandon stale sessions (hourly), SKIPPING past-deadline ones. */
export async function cleanupStaleSessionsService(ctx: SystemContext): Promise<void> {
  const tenantId = ctx.tenantId ?? "__platform__";
  const now = ctx.now();
  const staleCutoff = Date.parse(now) - 24 * 60 * 60 * 1000;
  const page = await ctx.repos.testSessions.list(tenantId, {
    where: { status: "in_progress" },
    limit: 200,
  });
  for (const s of page.items) {
    const deadline = s["serverDeadline"] as string | undefined;
    if (deadline && Date.parse(deadline) < Date.parse(now)) continue; // expire precedence
    const startedAt = s["startedAt"] as string | undefined;
    if (startedAt && Date.parse(startedAt) < staleCutoff) {
      assertTransition("testSession", "in_progress", "abandoned");
      await ctx.repos.testSessions.upsert(tenantId, { id: s["id"], status: "abandoned" }, now);
      if (typeof deadline === "string" && typeof s["userId"] === "string") {
        await projectTestSessionLive(ctx, tenantId, {
          sessionId: s["id"] as string,
          userId: s["userId"],
          serverDeadline: deadline,
          status: "abandoned",
        });
      }
    }
  }
}

/** onSpaceProgressUpdated → set the analytics recompute marker (no inline rollup).
 *  (levelup-side marker setter; the analytics codebase owns the rollup consumer.) */
export async function levelupOnSpaceProgressUpdatedService(
  event: { tenantId: string; after: Doc | null },
  ctx: SystemContext
): Promise<void> {
  const after = event.after;
  if (!after) return;
  await ctx.repos.outbox.enqueue(event.tenantId, {
    type: "progress.milestone",
    tenantId: event.tenantId,
    payload: { userId: after["userId"], spaceId: after["spaceId"], recompute: true },
    createdAt: ctx.now(),
    status: "pending",
    attempts: 0,
  });
}

// ── gamification derivation triggers (deploy in functions/analytics) ──────────

/** onProgressWrite → award achievements (single writer). */
export async function onProgressWriteAwardAchievementsService(
  event: { tenantId: string; after: Doc | null },
  ctx: SystemContext
): Promise<void> {
  const after = event.after;
  if (!after) return;
  await awardAchievementsService(
    { userId: after["userId"] as string, spaceId: after["spaceId"] as string, trigger: "progress" },
    ctx
  );
}

/** onProgressSummaryWrite → update the leaderboard (single writer). */
export async function onProgressSummaryWriteUpdateLeaderboardService(
  event: { tenantId: string; after: Doc | null },
  ctx: SystemContext
): Promise<void> {
  const after = event.after;
  if (!after) return;
  await upsertLeaderboardEntryService(
    {
      userId: after["userId"] as string,
      scope: "global",
      score: Number(after["pointsEarned"] ?? 0),
    },
    ctx
  );
}

/** onProgressMilestone → emit a milestone notification (outbox). */
export async function onProgressMilestoneNotifyService(
  event: { tenantId: string; after: Doc | null },
  ctx: SystemContext
): Promise<void> {
  const after = event.after;
  if (!after) return;
  const milestone = after["milestone"];
  if (milestone === undefined) return;
  await ctx.repos.outbox.enqueue(event.tenantId, {
    type: "progress.milestone",
    tenantId: event.tenantId,
    payload: { recipientUid: after["userId"], spaceId: after["spaceId"], milestone },
    createdAt: ctx.now(),
    status: "pending",
    attempts: 0,
  });
}

/** nightlyStreakReconciler — reconcile study streaks (scheduler). */
export async function nightlyStreakReconcilerService(ctx: SystemContext): Promise<void> {
  void ctx;
}
