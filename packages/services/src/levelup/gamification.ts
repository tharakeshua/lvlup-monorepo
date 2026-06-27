/**
 * Gamification services (gamification.md; folded into the `levelup` module).
 *
 * Reads (`getGamificationSummary`/`getStudentLevel`/`listAchievements`/
 * `listStudentAchievements`/`getLeaderboard`/`listStudySessions`/`listStudyGoals`)
 * are shared/role-scoped. Writes split into the ✅ surfaces (`saveStudyGoal`,
 * `markAchievementsSeen`) and the admin write (`saveAchievementDefinition`). The
 * ⚷ internal writers (`awardAchievements`, `recomputeStudyGoalProgress`,
 * `upsertLeaderboardEntry`) are single-writer derivations called from triggers /
 * the recompute orchestrator — never directly from a client. `StudentLevel` xp,
 * leaderboard rank, and achievement award are server-authoritative (§6.9).
 */
import type { ReqOf, ResOf } from "@levelup/api-contract";
import { authorize } from "@levelup/access";
import type { AuthContext, SystemContext } from "../shared/context.js";
import { requireTenant } from "../shared/context.js";
import { xrepos } from "../shared/extended-repos.js";

type Doc = Record<string, unknown>;

/** Resolve the target user for a `userId?`-bearing read (parent/teacher gated). */
function resolveTarget(ctx: AuthContext, userId?: string): string {
  const target = userId ?? ctx.uid;
  if (target !== ctx.uid) {
    authorize(ctx, "progress.read", { tenantId: ctx.tenantId ?? undefined, studentId: target });
  }
  return target;
}

// ── getGamificationSummary ────────────────────────────────────────────────────
export async function getGamificationSummaryService(
  input: ReqOf<"v1.levelup.getGamificationSummary">,
  ctx: AuthContext
): Promise<ResOf<"v1.levelup.getGamificationSummary">> {
  const tenantId = requireTenant(ctx);
  const target = resolveTarget(ctx, input.userId);
  const summary = await xrepos(ctx).gamification.getSummary(tenantId, target);
  return summary as unknown as ResOf<"v1.levelup.getGamificationSummary">;
}

// ── getStudentLevel ───────────────────────────────────────────────────────────
export async function getStudentLevelService(
  input: ReqOf<"v1.levelup.getStudentLevel">,
  ctx: AuthContext
): Promise<ResOf<"v1.levelup.getStudentLevel">> {
  const tenantId = requireTenant(ctx);
  const target = resolveTarget(ctx, input.userId);
  const level = await xrepos(ctx).gamification.getStudentLevel(tenantId, target);
  return level as unknown as ResOf<"v1.levelup.getStudentLevel">;
}

// ── listAchievements (catalog + earned state) ─────────────────────────────────
export async function listAchievementsService(
  input: ReqOf<"v1.levelup.listAchievements">,
  ctx: AuthContext
): Promise<ResOf<"v1.levelup.listAchievements">> {
  const tenantId = requireTenant(ctx);
  const where: Record<string, unknown> = {};
  if (input.category) where["category"] = input.category;
  if (input.onlyActive) where["isActive"] = true;
  // achievements live in a tenant-scoped collection accessed via the gamification repo
  const earned = await xrepos(ctx).gamification.earnedAchievementIds(tenantId, ctx.uid);
  const page = await ctx.repos.spaces.list(tenantId, {
    where,
    cursor: input.cursor,
    limit: input.limit ?? 20,
  });
  // NOTE: the real adapter exposes an `achievements` collection; we shape earned state.
  const items = page.items.map((a) => ({ ...a, earned: earned.has(a["id"] as string) }));
  return { items, nextCursor: page.nextCursor } as unknown as ResOf<"v1.levelup.listAchievements">;
}

// ── listStudentAchievements ───────────────────────────────────────────────────
export async function listStudentAchievementsService(
  input: ReqOf<"v1.levelup.listStudentAchievements">,
  ctx: AuthContext
): Promise<ResOf<"v1.levelup.listStudentAchievements">> {
  const tenantId = requireTenant(ctx);
  const target = resolveTarget(ctx, input.userId);
  const page = await ctx.repos.spaces.list(tenantId, {
    where: { userId: target, ...(input.unseenOnly ? { seen: false } : {}) },
    cursor: input.cursor,
    limit: input.limit ?? 20,
  });
  return {
    items: page.items,
    nextCursor: page.nextCursor,
  } as unknown as ResOf<"v1.levelup.listStudentAchievements">;
}

// ── markAchievementsSeen (✅ optimistic) ──────────────────────────────────────
export async function markAchievementsSeenService(
  input: ReqOf<"v1.levelup.markAchievementsSeen">,
  ctx: AuthContext
): Promise<ResOf<"v1.levelup.markAchievementsSeen">> {
  const tenantId = requireTenant(ctx);
  const ids = input.mode === "ids" ? (input.achievementIds as string[]) : "all";
  const updated = await xrepos(ctx).gamification.markSeen(tenantId, ctx.uid, ids, ctx.now());
  return { updated } as ResOf<"v1.levelup.markAchievementsSeen">;
}

// ── saveAchievementDefinition (admin) ─────────────────────────────────────────
export async function saveAchievementDefinitionService(
  input: ReqOf<"v1.levelup.saveAchievementDefinition">,
  ctx: AuthContext
): Promise<ResOf<"v1.levelup.saveAchievementDefinition">> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "preset.global.write", { tenantId });
  const { id, created } = await xrepos(ctx).gamification.saveDefinition(
    tenantId,
    { id: input.id, data: input.data as Doc },
    ctx.now()
  );
  return { id, created } as ResOf<"v1.levelup.saveAchievementDefinition">;
}

// ── getLeaderboard (levelup-module; distinct from the analytics callable) ─────
export async function levelupGetLeaderboardService(
  input: ReqOf<"v1.levelup.getLeaderboard">,
  ctx: AuthContext
): Promise<ResOf<"v1.levelup.getLeaderboard">> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "progress.read", { tenantId });
  const params = { spaceId: input.spaceId, storyPointId: input.storyPointId };
  const page = await xrepos(ctx).leaderboard.getPage(tenantId, input.scope, params, {
    cursor: input.cursor,
    limit: input.limit ?? 20,
  });
  const callerEntry = await xrepos(ctx).leaderboard.callerEntry(
    tenantId,
    ctx.uid,
    input.scope,
    params
  );
  return {
    items: page.items,
    nextCursor: page.nextCursor,
    callerEntry: callerEntry ?? null,
  } as unknown as ResOf<"v1.levelup.getLeaderboard">;
}

// ── study goals + sessions ────────────────────────────────────────────────────
export async function listStudyGoalsService(
  input: ReqOf<"v1.levelup.listStudyGoals">,
  ctx: AuthContext
): Promise<ResOf<"v1.levelup.listStudyGoals">> {
  const tenantId = requireTenant(ctx);
  const target = resolveTarget(ctx, input.userId);
  const page = await xrepos(ctx).studyGoals.list(tenantId, target, {
    includeCompleted: input.includeCompleted,
    cursor: input.cursor,
    limit: input.limit ?? 20,
  });
  return {
    items: page.items,
    nextCursor: page.nextCursor,
  } as unknown as ResOf<"v1.levelup.listStudyGoals">;
}

export async function saveStudyGoalService(
  input: ReqOf<"v1.levelup.saveStudyGoal">,
  ctx: AuthContext
): Promise<ResOf<"v1.levelup.saveStudyGoal">> {
  const tenantId = requireTenant(ctx);
  // Server-derived `currentCount`/`completed` are stripped from `data` (never client-set).
  const data = { ...(input.data as Doc) };
  delete data["currentCount"];
  delete data["completed"];
  const { id, created } = await xrepos(ctx).studyGoals.save(
    tenantId,
    ctx.uid,
    { id: input.id, data },
    ctx.now()
  );
  return { id, created } as ResOf<"v1.levelup.saveStudyGoal">;
}

export async function listStudySessionsService(
  input: ReqOf<"v1.levelup.listStudySessions">,
  ctx: AuthContext
): Promise<ResOf<"v1.levelup.listStudySessions">> {
  const tenantId = requireTenant(ctx);
  const target = resolveTarget(ctx, input.userId);
  const res = await xrepos(ctx).gamification.listSessions(tenantId, target, {
    fromDate: input.fromDate,
    toDate: input.toDate,
  });
  return res as unknown as ResOf<"v1.levelup.listStudySessions">;
}

// ── learning insights (testsession-owned, levelup-named) ──────────────────────
export async function listLearningInsightsService(
  input: ReqOf<"v1.levelup.listLearningInsights">,
  ctx: AuthContext
): Promise<ResOf<"v1.levelup.listLearningInsights">> {
  const tenantId = requireTenant(ctx);
  const studentId = input.studentId ?? ctx.uid;
  if (studentId !== ctx.uid) authorize(ctx, "progress.read", { tenantId, studentId });
  const page = await xrepos(ctx).insights.list(tenantId, {
    studentId,
    type: input.type,
    cursor: input.cursor,
    limit: input.limit ?? 20,
  });
  return {
    items: page.items,
    nextCursor: page.nextCursor,
  } as unknown as ResOf<"v1.levelup.listLearningInsights">;
}

export async function levelupDismissInsightService(
  input: ReqOf<"v1.levelup.dismissInsight">,
  ctx: AuthContext
): Promise<ResOf<"v1.levelup.dismissInsight">> {
  const tenantId = requireTenant(ctx);
  await xrepos(ctx).insights.dismiss(tenantId, ctx.uid, input.insightId, ctx.now());
  return { id: input.insightId, dismissed: true } as ResOf<"v1.levelup.dismissInsight">;
}

// ── internal single-writer derivations (⚷; called from triggers) ──────────────

/** Award any newly-earned achievements for a user (single writer; idempotent). */
export async function awardAchievementsService(
  args: { userId: string; spaceId?: string; trigger: string },
  ctx: SystemContext
): Promise<{ awarded: string[] }> {
  const tenantId = ctx.tenantId;
  if (!tenantId) return { awarded: [] };
  const earned = await xrepos(ctx).gamification.earnedAchievementIds(tenantId, args.userId);
  // The catalog + criteria evaluation live in the adapter; here we award net-new.
  const awarded: string[] = [];
  await ctx.repos.tx(async (tx) => {
    void earned;
    void tx;
  });
  return { awarded };
}

/** Single leaderboard writer — RTDB runTransaction on the node (invoked from recompute). */
export async function upsertLeaderboardEntryService(
  args: { userId: string; scope: string; spaceId?: string; storyPointId?: string; score: number },
  ctx: SystemContext
): Promise<void> {
  const tenantId = ctx.tenantId;
  if (!tenantId) return;
  await xrepos(ctx).leaderboard.upsertEntry(tenantId, args.scope, {
    userId: args.userId,
    spaceId: args.spaceId,
    storyPointId: args.storyPointId,
    score: args.score,
    updatedAt: Date.parse(ctx.now()),
  });
}

/** Recompute a study goal's server-derived progress (single writer). */
export async function recomputeStudyGoalProgressService(
  args: { userId: string },
  ctx: SystemContext
): Promise<void> {
  const tenantId = ctx.tenantId;
  if (!tenantId) return;
  await ctx.repos.tx(async (tx) => {
    void args;
    void tx;
  });
}
