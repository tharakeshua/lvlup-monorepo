/**
 * `gamificationViewRepo` — cross-entity VIEW repo for the student "gamification
 * home" + parent child-overview (SDK-LAYERS-PLAN §4.1, gamification.md
 * §Repositories — "cross-entity VIEW — dashboards").
 *
 * `getSummary(userId?)` is the single server-aggregated round-trip that collapses
 * what would otherwise be FIVE separate reads (level + recent achievements +
 * unseen count + current streak + tenant rank + active goals) into ONE call —
 * the N+1-collapse win flagged for parent-web in REVIEW. Cross-repo composition
 * happens ONLY through this declared view repo (the per-entity repos never import
 * each other — SDK-DESIGN §7.2 god-object guard).
 *
 * Lives under `src/views/**` — the only sanctioned composition surface (R6
 * exception). Composes the injected `api` directly, never a sibling repo module.
 */
import type { GamificationSummary, UserId } from "@levelup/domain";
import type { ApiClient } from "../gamification/api-types.js";

export interface GamificationViewRepo {
  /**
   * ONE server-aggregated read of the composed gamification home payload. Omit
   * `userId` ⇒ self; parent/teacher may pass a child/student `userId` (server
   * authorizes). Collapses 5 reads → 1.
   */
  getSummary(userId?: UserId): Promise<GamificationSummary>;
}

export function createGamificationViewRepo(api: ApiClient): GamificationViewRepo {
  return {
    getSummary: (userId) => api.levelup.getGamificationSummary({ userId }),
  };
}
