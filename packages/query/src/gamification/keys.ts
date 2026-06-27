/**
 * gamification query-key helpers (domain plan gamification.md §Query hooks,
 * SDK-LAYERS-PLAN §4.2).
 *
 * A thin, domain-shaped facade over the shared `@levelup/query` key factories
 * (`gamificationKeys`/`achievementKeys`/`levelKeys`/`studyGoalKeys`/
 * `studySessionKeys`/`leaderboardKeys` from the registry). The factories own the
 * hierarchical `[domain, kind, …]` convention; these helpers name the specific
 * sub-keys this domain reads so the hooks reference ONE place. Every produced key
 * is rooted at a real `DomainName`, never `['tenants', tenantId, …]` (tenantId is
 * implicit — query-infra.md §4.1).
 *
 *   summary           → gamificationKeys.sub('home', 'summary', { userId })
 *   student level      → levelKeys.detail(userId | 'self')
 *   achievement catalog→ achievementKeys.infinite({ category, onlyActive, … })
 *   earned (unlocks)   → achievementKeys.sub('me', 'earned', { userId, unseenOnly })
 *   leaderboard        → leaderboardKeys.list({ scope, spaceId, storyPointId })
 *   study goals        → studyGoalKeys.infinite({ userId, includeCompleted, … })
 *   study sessions     → studySessionKeys.list({ userId, fromDate, toDate })
 */
import {
  achievementKeys,
  gamificationKeys,
  leaderboardKeys,
  levelKeys,
  studyGoalKeys,
  studySessionKeys,
} from "../keys/registry.js";

/** Drop `undefined` fields → a stable, additive params object. */
function params(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out;
}

const self = (userId?: string): string => userId ?? "self";

export const gamificationQueryKeys = {
  // ── composed gamification home (collapses 5 reads → 1) ───────────────────
  summary: (userId?: string) =>
    gamificationKeys.sub("home", "summary", params({ userId: self(userId) })),

  // ── student level / XP ────────────────────────────────────────────────────
  level: (userId?: string) => levelKeys.detail(self(userId)),

  // ── achievements: definition catalog (paginated) + caller unlocks ─────────
  catalog: (filter?: object) => achievementKeys.infinite(filter ?? {}),
  earned: (userId?: string, unseenOnly?: boolean) =>
    achievementKeys.sub("me", "earned", params({ userId: self(userId), unseenOnly: !!unseenOnly })),

  // ── leaderboard snapshot (pairs with the live subscription) ───────────────
  leaderboard: (filter?: object) => leaderboardKeys.list(filter ?? {}),

  // ── study goals (paginated planner) ───────────────────────────────────────
  goals: (filter?: object) => studyGoalKeys.infinite(filter ?? {}),

  // ── study sessions (heatmap/streak feed) ──────────────────────────────────
  sessions: (filter?: object) => studySessionKeys.list(filter ?? {}),
} as const;

export {
  achievementKeys,
  gamificationKeys,
  leaderboardKeys,
  levelKeys,
  studyGoalKeys,
  studySessionKeys,
};
