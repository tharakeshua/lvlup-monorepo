/**
 * `levelup-projection` — U2.6: the ONLY writer of the levelup live-ticker RTDB
 * projections (DATA-MODEL-FIX-PLAN.md §10 AD-12; SDK-LAYERS-PLAN §3.3
 * spaceProgressLive / studentLevelLive / achievementUnlock / testSessionDeadline
 * rows). Inherits the AG-5 `grading-projection` convention verbatim: own
 * top-level RTDB root per feature, `{tenantId}`-scoped, Admin-SDK writes only
 * (`.write: false` in database.rules.json throughout), MINIMAL payloads.
 *
 * The four levelup realtime subscriptions read SLIM, SERVER-MAINTAINED
 * projections from RTDB — never Firestore (the legacy Firestore live docs were
 * unprefixed → silently dead on the `v2_` env, and AD-11 keeps client Firestore
 * deny-all):
 *
 *   • `spaceProgressLive/{t}/{userId}/{spaceId}`   ← bounded progress numerics
 *     (status / points / percentage, per-story-point rollup — NO per-item
 *     answers, NO stored evaluations, NO answer keys).
 *   • `studentLevelLive/{t}/{userId}`              ← the `StudentLevel` slim shape
 *     (level / XP / tier counters only).
 *   • `achievementUnlocks/{t}/{userId}/latest`     ← the LATEST unlock event
 *     (denormalized catalog snapshot for display; cleared on mark-seen).
 *   • `testSessionLive/{t}/{userId}/{sessionId}`   ← `{remainingMs,
 *     serverDeadline, status}` ONLY — the live channel never carries question
 *     bodies, answers, or scores (pre- or post-submit).
 *   • `chatBump/{t}/{userId}/{sessionId}`          ← CHAT-1 bump node:
 *     `{rev, lastMessageAt}` ONLY. Message CONTENT never duplicates into RTDB —
 *     the bump is a refetch SIGNAL; the client re-reads `getChatSession`
 *     (signal-over-RTDB, data-over-callable; AD-12 addendum).
 *
 * All roots are USER-owned and keyed by `userId` (== auth uid; AD-9 /
 * ID-CONVENTIONS.md — learning progress belongs to the user across role
 * changes), so owner reads gate on the path `$userId` segment (the
 * `notifications/{t}/{uid}` convention) — no `ownerStudentId` sibling needed.
 *
 * **Seam (FIX-2 owns the composition root).** Producers reach the RTDB writer
 * as an OPTIONAL port on `ctx.repos` (`levelupProjections`). The port INTERFACE
 * is declared here (services-local); the concrete Admin-RTDB adapter lives in
 * `@levelup/functions-adapters` and is wired by the sdk-v1 bootstrap. Until then
 * (and in any ctx that omits it) every projection call DEGRADES GRACEFULLY to a
 * no-op — a write path never fails because the ticker isn't wired. The
 * projection is a pure SIDE-CHANNEL: authority stays in Firestore.
 *
 * **Idempotency.** Every write is a last-write-wins overwrite of the node the
 * flipped `subscription-sources.ts` entries resolve — replaying a transition
 * yields an identical node.
 */
import type { AuthContext, SystemContext } from "../shared/context.js";
import type { ProgressUpdateResult } from "../repo-admin/types.js";

type Doc = Record<string, unknown>;

/** Per-story-point bounded numeric slice — mirrors `StoryPointProgressLiveSchema`. */
export interface StoryPointProgressLiveProjection {
  storyPointId: string;
  status: string;
  pointsEarned: number;
  totalPoints: number;
  percentage: number;
}

/** The slim space-progress projection — mirrors `SpaceProgressLiveSchema`. */
export interface SpaceProgressLiveProjection {
  spaceId: string;
  userId: string;
  status: string;
  pointsEarned: number;
  totalPoints: number;
  percentage: number;
  storyPoints: Record<string, StoryPointProgressLiveProjection>;
  updatedAt: string;
}

/** The slim level projection — mirrors the domain `StudentLevelSchema`. */
export interface StudentLevelProjection {
  id: string;
  tenantId: string;
  userId: string;
  level: number;
  currentXP: number;
  xpToNextLevel: number;
  totalXP: number;
  tier: string;
  achievementCount: number;
  updatedAt: string;
}

/** The unlock-event projection — mirrors the domain `StudentAchievementSchema`. */
export interface AchievementUnlockProjection {
  id: string;
  tenantId: string;
  userId: string;
  achievementId: string;
  /** Denormalized catalog snapshot for display (server writes at unlock). */
  achievement: Doc;
  earnedAt: string;
  seen: boolean;
}

/** The countdown projection — mirrors `TestSessionLiveSchema` (NO test content). */
export interface TestSessionLiveProjection {
  remainingMs: number;
  serverDeadline: string;
  status: string;
}

/**
 * The RTDB projection writer port. The composition root supplies the concrete
 * Admin-RTDB adapter on `ctx.repos.levelupProjections`; these shapes are the
 * injection contract.
 *
 * Node layout the adapter MUST honor (so the flipped subscription-sources node
 * paths resolve):
 *   • `spaceProgressLive/{t}/{userId}/{spaceId}`   ← client-read
 *   • `studentLevelLive/{t}/{userId}`              ← client-read
 *   • `achievementUnlocks/{t}/{userId}/latest`     ← client-read (cleared on seen)
 *   • `testSessionLive/{t}/{userId}/{sessionId}`   ← client-read
 *   • `chatBump/{t}/{userId}/{sessionId}`          ← client-read (rev/lastMessageAt only)
 */
export interface LevelupProjectionPort {
  setSpaceProgress(
    tenantId: string,
    userId: string,
    spaceId: string,
    live: SpaceProgressLiveProjection
  ): Promise<void>;
  setStudentLevel(tenantId: string, userId: string, level: StudentLevelProjection): Promise<void>;
  /** Overwrite the `latest` unlock-event node (one toast at a time; LWW). */
  setAchievementUnlock(
    tenantId: string,
    userId: string,
    event: AchievementUnlockProjection
  ): Promise<void>;
  /** Remove the `latest` unlock-event node (markAchievementsSeen). */
  clearAchievementUnlock(tenantId: string, userId: string): Promise<void>;
  setTestSessionLive(
    tenantId: string,
    userId: string,
    sessionId: string,
    live: TestSessionLiveProjection
  ): Promise<void>;
  /**
   * Atomically bump `chatBump/{t}/{userId}/{sessionId}` = `{rev: increment(1),
   * lastMessageAt}`. The adapter owns the increment primitive; callers pass the
   * message timestamp ONLY — never message content (CHAT-1 / AD-12 addendum).
   */
  bumpChat(
    tenantId: string,
    userId: string,
    sessionId: string,
    lastMessageAt: string
  ): Promise<void>;
}

/** Minimal shape we cast `ctx.repos` to for the optional projection port. */
interface WithLevelupProjections {
  levelupProjections?: LevelupProjectionPort;
}

/** The optional port, or `null` when the composition root hasn't wired it. */
function port(ctx: AuthContext | SystemContext): LevelupProjectionPort | null {
  return (ctx.repos as unknown as WithLevelupProjections).levelupProjections ?? null;
}

/** Derive the tri-state progress status from a completed flag + points. */
function progressStatus(completed: boolean, pointsEarned: number): string {
  return completed ? "completed" : pointsEarned > 0 ? "in_progress" : "not_started";
}

/** Bounded integer percentage (0 when the denominator is 0). */
function pct(earned: number, total: number): number {
  return total > 0 ? Math.round((earned / total) * 100) : 0;
}

/**
 * Project a space-progress update to its live RTDB node. Called by
 * `applyProgress` (the SINGLE progress writer) with the transaction's rollup
 * result — the projection carries the bounded numerics ONLY (never the per-item
 * map, evaluations, or the recompute marker).
 */
export async function projectSpaceProgressLive(
  ctx: AuthContext | SystemContext,
  tenantId: string,
  args: { userId: string; spaceId: string; result: ProgressUpdateResult }
): Promise<void> {
  const p = port(ctx);
  if (!p) return; // ticker not wired — the write path is unaffected
  const { result } = args;
  const storyPoints: Record<string, StoryPointProgressLiveProjection> = {};
  for (const [spId, sp] of Object.entries(result.storyPoints ?? {})) {
    storyPoints[spId] = {
      storyPointId: sp.storyPointId,
      status: progressStatus(sp.completed, sp.pointsEarned),
      pointsEarned: sp.pointsEarned,
      totalPoints: sp.totalPoints,
      percentage: pct(sp.pointsEarned, sp.totalPoints),
    };
  }
  await p.setSpaceProgress(tenantId, args.userId, args.spaceId, {
    spaceId: args.spaceId,
    userId: args.userId,
    status: progressStatus(result.completed, result.pointsEarned),
    pointsEarned: result.pointsEarned,
    totalPoints: result.totalPoints,
    percentage: pct(result.pointsEarned, result.totalPoints),
    storyPoints,
    updatedAt: ctx.now(),
  });
}

/**
 * Project a student's current level/XP to its live RTDB node. Called after any
 * level/XP write (achievement award, XP delta). Whitelists the `StudentLevel`
 * fields with null-safe defaults so a sparse stored doc still projects the
 * strict slim shape.
 */
export async function projectStudentLevel(
  ctx: AuthContext | SystemContext,
  tenantId: string,
  userId: string,
  level: Doc
): Promise<void> {
  const p = port(ctx);
  if (!p) return;
  const num = (v: unknown, d: number): number => (typeof v === "number" ? v : d);
  await p.setStudentLevel(tenantId, userId, {
    id: userId,
    tenantId,
    userId,
    level: num(level["level"], 1),
    currentXP: num(level["currentXP"], num(level["xp"], 0)),
    xpToNextLevel: num(level["xpToNextLevel"], 0),
    totalXP: num(level["totalXP"], num(level["currentXP"], num(level["xp"], 0))),
    tier: typeof level["tier"] === "string" ? (level["tier"] as string) : "bronze",
    achievementCount: num(level["achievementCount"], 0),
    updatedAt: ctx.now(),
  });
}

/**
 * Project a fresh unlock event to the user's `latest` node (the toast channel).
 * Whitelists the `StudentAchievement` fields — the denormalized `achievement`
 * snapshot is the catalog definition (display data; carries no ⚷).
 */
export async function projectAchievementUnlock(
  ctx: AuthContext | SystemContext,
  tenantId: string,
  userId: string,
  event: { id: string; achievementId: string; achievement: Doc; earnedAt: string }
): Promise<void> {
  const p = port(ctx);
  if (!p) return;
  await p.setAchievementUnlock(tenantId, userId, {
    id: event.id,
    tenantId,
    userId,
    achievementId: event.achievementId,
    achievement: event.achievement,
    earnedAt: event.earnedAt,
    seen: false,
  });
}

/**
 * Clear the `latest` unlock node once the user marks unlocks seen. The node is
 * a ticker, not authority — over-clearing is safe (the callable read path
 * remains canonical for the earned list).
 */
export async function clearAchievementUnlockProjection(
  ctx: AuthContext | SystemContext,
  tenantId: string,
  userId: string
): Promise<void> {
  const p = port(ctx);
  if (!p) return;
  await p.clearAchievementUnlock(tenantId, userId);
}

/**
 * Project a test session's live countdown state. Called on start / resume /
 * submit / expire / abandon. `remainingMs` is server-computed at write time
 * and clamped to 0; the client pairs the authoritative `serverDeadline` with
 * `useServerTime()` — it never owns the clock. NOTHING else from the session
 * doc (question order, answers, visited maps, scores) may ride this channel.
 */
export async function projectTestSessionLive(
  ctx: AuthContext | SystemContext,
  tenantId: string,
  args: { sessionId: string; userId: string; serverDeadline: string; status: string }
): Promise<void> {
  const p = port(ctx);
  if (!p) return;
  const now = ctx.now();
  await p.setTestSessionLive(tenantId, args.userId, args.sessionId, {
    remainingMs: Math.max(0, Date.parse(args.serverDeadline) - Date.parse(now)),
    serverDeadline: args.serverDeadline,
    status: args.status,
  });
}

/**
 * Bump the chat session's RTDB signal node after a message append (CHAT-1).
 * Carries the message TIMESTAMP only — the appended message itself stays in
 * Firestore and is served by `getChatSession`; the client treats the bump as a
 * debounced refetch trigger. Replay-safe: an extra bump is an extra refetch,
 * never divergent data.
 */
export async function projectChatBump(
  ctx: AuthContext | SystemContext,
  tenantId: string,
  args: { userId: string; sessionId: string; lastMessageAt: string }
): Promise<void> {
  const p = port(ctx);
  if (!p) return;
  await p.bumpChat(tenantId, args.userId, args.sessionId, args.lastMessageAt);
}
